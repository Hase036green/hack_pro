import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Activity, Radar, Cpu, Wifi, Zap, Eye, Signal, AlertTriangle } from "lucide-react";
import Holo3DRoom from "../components/holo/Holo3DRoom";
import HoloHeader from "../components/holo/HoloHeader";
import HoloPanel from "../components/holo/HoloPanel";
import { api, getToken, WS_BASE } from "../lib/api";
import { useAuth } from "../context/AuthContext";

function StatTile({ label, value, sub, icon: Icon, accent = "cyan" }) {
  const color = {
    cyan: "text-cyan-300",
    amber: "text-amber-300",
    emerald: "text-emerald-300",
    pink: "text-pink-300",
  }[accent];
  return (
    <div className="holo-panel p-3 relative">
      <span className="holo-panel-corner tl" /><span className="holo-panel-corner tr" /><span className="holo-panel-corner bl" /><span className="holo-panel-corner br" />
      <div className="flex items-center gap-2 mb-1">
        <Icon size={12} className={color} />
        <span className="holo-label">{label}</span>
      </div>
      <div className={`font-display text-xl tracking-wider ${color} glow-cyan`}>{value}</div>
      {sub && <div className="font-mono text-[10px] text-cyan-400/60 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [snap, setSnap] = useState({ grid: [], objects: [] });
  const [devices, setDevices] = useState([]);
  const [status, setStatus] = useState(null);
  const [log, setLog] = useState([]);
  const [live, setLive] = useState({ object_count: 0, avg_rssi: 0, noise: 0 });
  const wsRef = useRef(null);
  const logRef = useRef(null);

  // Fetch initial heavy data + periodic refresh
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [s, d, st, lg] = await Promise.all([
          api.get("/signals/snapshot"),
          api.get("/router/devices"),
          api.get("/router/status"),
          api.get("/objects/log"),
        ]);
        if (!mounted) return;
        setSnap(s.data);
        setDevices(d.data.devices);
        setStatus(st.data);
        setLog(lg.data.log);
      } catch (e) {
        console.warn("dashboard load failed:", e?.message || e);
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  // WebSocket live signal
  useEffect(() => {
    const t = getToken();
    if (!t) return;
    const ws = new WebSocket(`${WS_BASE}/live?token=${encodeURIComponent(t)}`);
    wsRef.current = ws;
    ws.onmessage = (evt) => {
      try {
        const m = JSON.parse(evt.data);
        if (m.type === "snapshot") {
          setLive(m.summary);
          setSnap((prev) => ({ ...prev, objects: m.objects }));
        }
      } catch (e) {
        console.warn("ws message parse failed:", e?.message || e);
      }
    };
    ws.onerror = () => {};
    return () => {
      try { ws.close(); } catch (e) { console.warn("ws close failed:", e?.message || e); }
    };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [log]);

  const uptime = useMemo(() => {
    if (!status?.uptime_sec) return "—";
    const s = status.uptime_sec;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  }, [status]);

  if (user === false) return <Navigate to="/login" replace />;
  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <HoloHeader />
      <main className="flex-1 p-4 lg:p-6 holo-grid-bg relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Top stat strip */}
          <div className="lg:col-span-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="stat-tiles">
            <StatTile label="Router" value={status?.connected ? "ONLINE" : "OFFLINE"} sub={status?.model} icon={Wifi} accent={status?.connected ? "emerald" : "amber"} />
            <StatTile label="Modus" value={(status?.mode || "demo").toUpperCase()} sub={status?.host} icon={Cpu} />
            <StatTile label="Uptime" value={uptime} sub="seit Verbindung" icon={Zap} />
            <StatTile label="Geräte" value={(status?.device_count ?? devices.length)} sub="aktiv im Netz" icon={Signal} />
            <StatTile label="Objekte" value={live.object_count || snap.objects.length} sub="Live-Tracking" icon={Eye} accent="pink" />
            <StatTile label="Avg RSSI" value={`${live.avg_rssi || "—"} dBm`} sub={`Noise ${live.noise || "—"}`} icon={Radar} accent="amber" />
          </div>

          {/* Main 3D scene */}
          <HoloPanel
            data-testid="holo-3d-panel"
            accent
            className="lg:col-span-8 p-2 relative h-[520px] lg:h-[640px] overflow-hidden"
            title="3D HOLOGRAMM // Raum-Sensorik"
            badge={`${snap.grid.length} Samples`}
          >
            <div className="absolute inset-0 top-12 pointer-events-none scanlines-soft" />
            <div className="absolute top-3 right-28 z-10 font-mono text-[10px] tracking-widest text-cyan-300/70 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full hg-pulse" /> LIVE
            </div>
            <div className="h-full">
              <Holo3DRoom grid={snap.grid} devices={devices} objects={snap.objects} />
            </div>
            <div className="absolute bottom-2 left-3 font-mono text-[10px] text-cyan-300/60 tracking-widest">
              ▸ Maus: Drehen · Mausrad: Zoom
            </div>
          </HoloPanel>

          {/* Right column */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <HoloPanel title="Erkannte Objekte" badge="LIVE" data-testid="objects-panel">
              <ul className="space-y-2 max-h-[280px] overflow-auto pr-1">
                {snap.objects.length === 0 && (
                  <li className="text-xs font-mono text-cyan-400/60">▸ Sensor-Array initialisiert. Warte auf Signal-Anomalien...</li>
                )}
                {snap.objects.map((o) => (
                  <li
                    key={o.id}
                    data-testid={`object-${o.id}`}
                    className="border border-cyan-500/30 px-3 py-2 bg-cyan-500/5 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-display tracking-[0.2em] text-xs uppercase text-cyan-200">{o.class}</div>
                      <div className="font-mono text-[10px] text-cyan-300/70">
                        ({o.x.toFixed(2)}, {o.z.toFixed(2)}) · Δy={o.y.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm text-cyan-100">{Math.round(o.confidence * 100)}%</div>
                      <div className="text-[9px] uppercase tracking-widest text-cyan-400/60">conf.</div>
                    </div>
                  </li>
                ))}
              </ul>
            </HoloPanel>

            <HoloPanel title="Object Detection Console" badge="LOG" data-testid="log-panel">
              <div ref={logRef} className="h-[230px] overflow-auto pr-1 font-mono text-[11px] space-y-1">
                {log.length === 0 && (
                  <div className="text-cyan-400/60">▸ Konsole initialisiert...</div>
                )}
                {log.map((l) => (
                  <div key={l.id} className="flex gap-2">
                    <span className="text-cyan-500/70">[{new Date(l.ts).toLocaleTimeString("de-DE")}]</span>
                    <span className={
                      l.level === "WARN" ? "text-amber-300" :
                      l.level === "ERROR" ? "text-red-400" :
                      "text-cyan-200"
                    }>
                      {l.level === "WARN" ? <AlertTriangle size={10} className="inline mr-1" /> : "▸ "}{l.message}
                    </span>
                  </div>
                ))}
              </div>
            </HoloPanel>
          </div>
        </div>
      </main>
    </div>
  );
}
