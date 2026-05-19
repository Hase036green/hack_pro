from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import math
import random
import asyncio
import time
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import bcrypt
import jwt
import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
import uuid

# ---------- Setup ----------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("archer-grid")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-please")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@archer.local")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "archer1300")

app = FastAPI(title="Archer Grid API")
api = APIRouter(prefix="/api")


# ---------- Helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Nicht authentifiziert")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Ungültiger Token-Typ")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Benutzer nicht gefunden")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token abgelaufen")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ungültiger Token")


# ---------- Models ----------
class LoginBody(BaseModel):
    email: str
    password: str


class RouterConnectBody(BaseModel):
    host: str = "192.168.0.1"
    password: str = ""
    demo_mode: bool = True


class WifiSettingsBody(BaseModel):
    ssid_2g: Optional[str] = None
    ssid_5g: Optional[str] = None
    tx_power: Optional[int] = Field(default=None, ge=0, le=100)
    channel_2g: Optional[int] = None
    channel_5g: Optional[int] = None


class DeviceActionBody(BaseModel):
    mac: str
    blocked: bool


# ---------- State (in-memory router emulation + state) ----------
ROUTER_STATE: Dict[str, Any] = {
    "connected": False,
    "mode": "demo",  # demo | live
    "host": "192.168.0.1",
    "model": "TP-Link Archer C6 AC1300",
    "firmware": "1.3.0 Build 20231101",
    "uptime_sec": 0,
    "started_at": time.time(),
    "wifi": {
        "ssid_2g": "ARCHER_GRID_2G",
        "ssid_5g": "ARCHER_GRID_5G",
        "channel_2g": 6,
        "channel_5g": 36,
        "tx_power": 80,
        "encryption": "WPA2/WPA3",
    },
    "stats": {
        "tx_bytes": 0,
        "rx_bytes": 0,
    },
    "detected_at": None,
}


def _seed_devices():
    base = [
        {"mac": "A4:5E:60:11:22:33", "ip": "192.168.0.101", "name": "MacBook-Pro", "type": "laptop", "band": "5G", "vendor": "Apple", "blocked": False},
        {"mac": "DC:A6:32:55:77:88", "ip": "192.168.0.102", "name": "Pixel-8", "type": "phone", "band": "5G", "vendor": "Google", "blocked": False},
        {"mac": "00:1A:2B:3C:4D:5E", "ip": "192.168.0.103", "name": "Samsung-TV", "type": "tv", "band": "2.4G", "vendor": "Samsung", "blocked": False},
        {"mac": "B8:27:EB:AA:BB:CC", "ip": "192.168.0.104", "name": "raspberrypi", "type": "iot", "band": "2.4G", "vendor": "Raspberry Pi", "blocked": False},
        {"mac": "F0:99:BF:11:33:55", "ip": "192.168.0.105", "name": "Echo-Dot", "type": "iot", "band": "2.4G", "vendor": "Amazon", "blocked": False},
        {"mac": "AC:DE:48:00:11:22", "ip": "192.168.0.106", "name": "Galaxy-Watch", "type": "wearable", "band": "2.4G", "vendor": "Samsung", "blocked": False},
    ]
    out = []
    for i, d in enumerate(base):
        angle = (i / len(base)) * math.tau
        r = 2.5 + (i % 3) * 0.7
        d["x"] = round(math.cos(angle) * r, 2)
        d["y"] = round(0.5 + (i % 2) * 0.5, 2)
        d["z"] = round(math.sin(angle) * r, 2)
        d["rssi"] = -40 - int(r * 8) - random.randint(0, 5)
        out.append(d)
    return out


DEVICES: List[Dict[str, Any]] = _seed_devices()
DETECTION_LOG: List[Dict[str, Any]] = []


def _push_log(level: str, message: str):
    DETECTION_LOG.append({
        "id": str(uuid.uuid4()),
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "message": message,
    })
    if len(DETECTION_LOG) > 200:
        del DETECTION_LOG[: len(DETECTION_LOG) - 200]


# ---------- Signal sensing simulation ----------
def _signal_snapshot(t: float):
    """Generate a 3D point cloud of signal samples and detected 'objects' from RSSI variation."""
    grid = []
    res = 12

    obj_count = 3
    objects = []
    for i in range(obj_count):
        phase = t * 0.4 + i * 2.1
        ox = math.cos(phase) * (1.5 + 0.3 * i)
        oz = math.sin(phase * 0.7) * (1.8 + 0.2 * i)
        oy = 0.8 + 0.4 * math.sin(t * 0.3 + i)
        objects.append({
            "id": f"obj-{i}",
            "x": round(ox, 3),
            "y": round(oy, 3),
            "z": round(oz, 3),
            "confidence": round(0.55 + 0.35 * (0.5 + 0.5 * math.sin(t * 0.6 + i)), 2),
            "size": round(0.3 + 0.15 * (i % 3), 2),
            "class": ["bewegung", "person", "objekt"][i % 3],
        })

    for ix in range(res):
        for iz in range(res):
            x = (ix - (res - 1) / 2) * (8.0 / res)
            z = (iz - (res - 1) / 2) * (8.0 / res)
            d = math.sqrt(x * x + z * z) + 0.0001
            rssi = -30 - 18 * math.log10(d + 0.4)
            for o in objects:
                dx = x - o["x"]
                dz = z - o["z"]
                dist = math.sqrt(dx * dx + dz * dz)
                rssi -= max(0, 18 - dist * 12) * o["confidence"]
            rssi += math.sin(t * 0.9 + x * 0.4 + z * 0.5) * 1.5
            grid.append({"x": round(x, 3), "y": 0.05, "z": round(z, 3), "rssi": round(rssi, 2)})

    rssi_values = [p["rssi"] for p in grid]
    mn, mx = min(rssi_values), max(rssi_values)
    span = (mx - mn) or 1
    for p in grid:
        p["intensity"] = round((p["rssi"] - mn) / span, 3)

    return {"grid": grid, "objects": objects, "t": t}


# ---------- Auth Endpoints ----------
@api.post("/auth/login")
async def auth_login(body: LoginBody, response: Response):
    user = await db.users.find_one({"email": body.email.lower().strip()})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Zugangsdaten ungültig")
    token = create_access_token(user["id"], user["email"])
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=12 * 3600,
        path="/",
    )
    return {
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "name": user.get("name", "Admin"), "role": user.get("role", "admin")},
    }


@api.get("/auth/me")
async def auth_me(user=Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def auth_logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


# ---------- Router Endpoints ----------
@api.get("/router/detect")
async def router_detect(user=Depends(get_current_user)):
    ROUTER_STATE["detected_at"] = datetime.now(timezone.utc).isoformat()
    return {
        "found": True,
        "device": {
            "model": ROUTER_STATE["model"],
            "firmware": ROUTER_STATE["firmware"],
            "mac": "A4:2B:B0:CA:FE:01",
            "host": ROUTER_STATE["host"],
            "interface": "Ethernet (Cable)",
            "link_speed": "1000 Mbps Full Duplex",
        },
        "detected_at": ROUTER_STATE["detected_at"],
    }


@api.post("/router/connect")
async def router_connect(body: RouterConnectBody, user=Depends(get_current_user)):
    ROUTER_STATE["host"] = body.host
    ROUTER_STATE["mode"] = "demo" if body.demo_mode else "live"
    reachable = True
    if not body.demo_mode:
        try:
            async with httpx.AsyncClient(timeout=2.0) as c:
                r = await c.get(f"http://{body.host}/")
                reachable = r.status_code < 500
        except Exception as e:
            logger.info(f"router live reach failed for {body.host}: {e}")
            reachable = False
    ROUTER_STATE["connected"] = True
    ROUTER_STATE["started_at"] = time.time()
    _push_log("INFO", f"Verbindung hergestellt: {body.host} ({'DEMO' if body.demo_mode else 'LIVE'})")
    return {"connected": True, "mode": ROUTER_STATE["mode"], "reachable": reachable}


@api.get("/router/status")
async def router_status(user=Depends(get_current_user)):
    ROUTER_STATE["uptime_sec"] = int(time.time() - ROUTER_STATE["started_at"]) if ROUTER_STATE["connected"] else 0
    ROUTER_STATE["stats"]["tx_bytes"] += random.randint(800, 12000)
    ROUTER_STATE["stats"]["rx_bytes"] += random.randint(2000, 24000)
    return {**{k: v for k, v in ROUTER_STATE.items()}, "device_count": len([d for d in DEVICES if not d["blocked"]])}


@api.post("/router/restart")
async def router_restart(user=Depends(get_current_user)):
    ROUTER_STATE["started_at"] = time.time()
    ROUTER_STATE["uptime_sec"] = 0
    _push_log("WARN", "Router-Neustart eingeleitet")
    return {"ok": True, "restarted_at": datetime.now(timezone.utc).isoformat()}


@api.post("/router/wifi")
async def router_wifi(body: WifiSettingsBody, user=Depends(get_current_user)):
    for k, v in body.model_dump().items():
        if v is not None:
            ROUTER_STATE["wifi"][k] = v
    _push_log("INFO", "WLAN-Einstellungen aktualisiert")
    return ROUTER_STATE["wifi"]


@api.get("/router/devices")
async def router_devices(user=Depends(get_current_user)):
    for d in DEVICES:
        d["rssi"] = max(-90, min(-30, d["rssi"] + random.randint(-2, 2)))
    return {"devices": DEVICES}


@api.post("/router/device-action")
async def router_device_action(body: DeviceActionBody, user=Depends(get_current_user)):
    for d in DEVICES:
        if d["mac"] == body.mac:
            d["blocked"] = body.blocked
            _push_log("WARN" if body.blocked else "INFO", f"Gerät {d['name']} {'blockiert' if body.blocked else 'freigegeben'}")
            return {"ok": True, "device": d}
    raise HTTPException(404, "Gerät nicht gefunden")


# ---------- Signals & Objects ----------
@api.get("/signals/snapshot")
async def signals_snapshot(user=Depends(get_current_user)):
    return _signal_snapshot(time.time())


@api.get("/signals/history")
async def signals_history(user=Depends(get_current_user)):
    now = time.time()
    series = []
    for i in range(60):
        t = now - (60 - i)
        rssi_2g = -55 + 5 * math.sin(t * 0.15) + random.uniform(-2, 2)
        rssi_5g = -48 + 6 * math.sin(t * 0.22 + 1.2) + random.uniform(-2, 2)
        util_2g = 20 + 15 * math.sin(t * 0.1) + random.uniform(-3, 3)
        util_5g = 30 + 20 * math.sin(t * 0.12 + 0.8) + random.uniform(-3, 3)
        series.append({
            "t": int(t),
            "rssi_2g": round(rssi_2g, 1),
            "rssi_5g": round(rssi_5g, 1),
            "util_2g": round(max(0, util_2g), 1),
            "util_5g": round(max(0, util_5g), 1),
        })
    return {"series": series}


@api.get("/objects/detected")
async def objects_detected(user=Depends(get_current_user)):
    snap = _signal_snapshot(time.time())
    if random.random() < 0.5:
        o = random.choice(snap["objects"])
        _push_log(
            "INFO",
            f"Objekt erkannt @ ({o['x']:.2f}, {o['z']:.2f}) Klasse={o['class']} Konfidenz={o['confidence']:.2f}",
        )
    return {"objects": snap["objects"]}


@api.get("/objects/log")
async def objects_log(user=Depends(get_current_user)):
    return {"log": DETECTION_LOG[-80:][::-1]}


# ---------- WebSocket: Live Stream ----------
@app.websocket("/api/ws/live")
async def ws_live(websocket: WebSocket):
    token = websocket.query_params.get("token")
    try:
        if token:
            jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        else:
            await websocket.close(code=4401)
            return
    except Exception:
        await websocket.close(code=4401)
        return

    await websocket.accept()
    start = time.time()
    try:
        while True:
            t = time.time() - start
            snap = _signal_snapshot(time.time())
            await websocket.send_json({
                "type": "snapshot",
                "t": t,
                "objects": snap["objects"],
                "summary": {
                    "object_count": len(snap["objects"]),
                    "avg_rssi": round(sum(p["rssi"] for p in snap["grid"]) / len(snap["grid"]), 2),
                    "noise": round(random.uniform(-95, -88), 2),
                },
            })
            await asyncio.sleep(0.8)
    except WebSocketDisconnect:
        return
    except Exception as e:
        logger.warning(f"ws disconnect: {e}")
        return


# ---------- Health ----------
@api.get("/")
async def root():
    return {"service": "Archer Grid", "status": "online"}


# ---------- App wiring ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
    except Exception:
        pass
    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL.lower(),
            "name": "Operator",
            "role": "admin",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin seeded: {ADMIN_EMAIL}")
    else:
        if not verify_password(ADMIN_PASSWORD, existing.get("password_hash", "")):
            await db.users.update_one(
                {"email": ADMIN_EMAIL.lower()},
                {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}},
            )
            logger.info("Admin password updated from .env")

    _push_log("INFO", "ARCHER GRID Subsysteme online")
    _push_log("INFO", "Sensor-Array initialisiert (RSSI/CSI-Approx)")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
