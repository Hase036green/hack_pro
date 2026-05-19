"""Archer Grid API integration tests - covers auth, router, signals and objects modules."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://signal-heatmap-3d.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@archer.local"
ADMIN_PASSWORD = "archer1300"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["email"] == ADMIN_EMAIL
    return data["token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ----- Auth module -----
class TestAuth:
    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert d["role"] == "admin"
        assert "_id" not in d
        assert "password_hash" not in d

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_logout(self, auth_headers):
        r = requests.post(f"{API}/auth/logout", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ----- Router module -----
class TestRouter:
    def test_detect(self, auth_headers):
        r = requests.get(f"{API}/router/detect", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["found"] is True
        assert "Archer C6" in d["device"]["model"]
        assert d["device"]["interface"].lower().startswith("ethernet")

    def test_detect_unauth(self):
        r = requests.get(f"{API}/router/detect", timeout=15)
        assert r.status_code == 401

    def test_connect_demo(self, auth_headers):
        r = requests.post(
            f"{API}/router/connect",
            headers=auth_headers,
            json={"host": "192.168.0.1", "password": "x", "demo_mode": True},
            timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["connected"] is True
        assert d["mode"] == "demo"

    def test_status(self, auth_headers):
        # ensure connected first
        requests.post(f"{API}/router/connect", headers=auth_headers, json={"demo_mode": True}, timeout=15)
        r = requests.get(f"{API}/router/status", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["connected"] is True
        assert "wifi" in d and "stats" in d
        assert isinstance(d["device_count"], int)

    def test_restart_resets_uptime(self, auth_headers):
        requests.post(f"{API}/router/connect", headers=auth_headers, json={"demo_mode": True}, timeout=15)
        time.sleep(1.2)
        s1 = requests.get(f"{API}/router/status", headers=auth_headers, timeout=15).json()
        assert s1["uptime_sec"] >= 1
        r = requests.post(f"{API}/router/restart", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        s2 = requests.get(f"{API}/router/status", headers=auth_headers, timeout=15).json()
        assert s2["uptime_sec"] < s1["uptime_sec"] + 2

    def test_wifi_update(self, auth_headers):
        body = {"ssid_2g": "TEST_2G", "ssid_5g": "TEST_5G", "tx_power": 75, "channel_2g": 11, "channel_5g": 44}
        r = requests.post(f"{API}/router/wifi", headers=auth_headers, json=body, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k, v in body.items():
            assert d[k] == v
        # Verify persisted
        st = requests.get(f"{API}/router/status", headers=auth_headers, timeout=15).json()
        assert st["wifi"]["ssid_2g"] == "TEST_2G"

    def test_devices_list_and_rssi_changes(self, auth_headers):
        r1 = requests.get(f"{API}/router/devices", headers=auth_headers, timeout=15)
        assert r1.status_code == 200
        d1 = r1.json()["devices"]
        assert len(d1) == 6
        for dev in d1:
            assert set(["mac", "ip", "name", "type", "band", "rssi", "blocked"]).issubset(dev.keys())
        # rssi should vary across calls
        r2 = requests.get(f"{API}/router/devices", headers=auth_headers, timeout=15).json()["devices"]
        # at least one rssi differs OR stays in range (random walk possibly 0)
        any_diff = any(a["rssi"] != b["rssi"] for a, b in zip(d1, r2))
        # If not different in this one call, run again
        if not any_diff:
            r3 = requests.get(f"{API}/router/devices", headers=auth_headers, timeout=15).json()["devices"]
            any_diff = any(a["rssi"] != b["rssi"] for a, b in zip(d1, r3))
        assert any_diff, "RSSI should change across calls"

    def test_device_action_block_and_unblock(self, auth_headers):
        devs = requests.get(f"{API}/router/devices", headers=auth_headers, timeout=15).json()["devices"]
        mac = devs[0]["mac"]
        r = requests.post(f"{API}/router/device-action", headers=auth_headers, json={"mac": mac, "blocked": True}, timeout=15)
        assert r.status_code == 200
        assert r.json()["device"]["blocked"] is True
        # Verify via list
        devs2 = requests.get(f"{API}/router/devices", headers=auth_headers, timeout=15).json()["devices"]
        assert any(d["mac"] == mac and d["blocked"] for d in devs2)
        # Unblock
        r2 = requests.post(f"{API}/router/device-action", headers=auth_headers, json={"mac": mac, "blocked": False}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["device"]["blocked"] is False

    def test_device_action_unknown_mac(self, auth_headers):
        r = requests.post(f"{API}/router/device-action", headers=auth_headers, json={"mac": "00:00:00:00:00:00", "blocked": True}, timeout=15)
        assert r.status_code == 404


# ----- Signals module -----
class TestSignals:
    def test_snapshot(self, auth_headers):
        r = requests.get(f"{API}/signals/snapshot", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert len(d["grid"]) == 144
        assert len(d["objects"]) == 3
        for p in d["grid"][:5]:
            assert 0.0 <= p["intensity"] <= 1.0
        for o in d["objects"]:
            assert set(["x", "y", "z", "confidence", "class"]).issubset(o.keys())

    def test_history(self, auth_headers):
        r = requests.get(f"{API}/signals/history", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        s = r.json()["series"]
        assert len(s) == 60
        for sample in s[:3]:
            assert set(["t", "rssi_2g", "rssi_5g", "util_2g", "util_5g"]).issubset(sample.keys())

    def test_signals_unauth(self):
        assert requests.get(f"{API}/signals/snapshot", timeout=15).status_code == 401
        assert requests.get(f"{API}/signals/history", timeout=15).status_code == 401


# ----- Objects module -----
class TestObjects:
    def test_objects_detected(self, auth_headers):
        r = requests.get(f"{API}/objects/detected", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        objs = r.json()["objects"]
        assert len(objs) == 3

    def test_objects_log(self, auth_headers):
        r = requests.get(f"{API}/objects/log", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        log = r.json()["log"]
        assert isinstance(log, list)
        if log:
            assert set(["id", "ts", "level", "message"]).issubset(log[0].keys())

    def test_objects_unauth(self):
        assert requests.get(f"{API}/objects/detected", timeout=15).status_code == 401
        assert requests.get(f"{API}/objects/log", timeout=15).status_code == 401
