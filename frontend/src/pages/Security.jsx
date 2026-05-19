import React, { useEffect, useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import HoloHeader from "../components/holo/HoloHeader";
import HoloPanel from "../components/holo/HoloPanel";
import { api, getToken, WS_BASE } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AlertTriangle, Eye, ShieldAlert } from "lucide-react";

export default function Security() {
  const { user } = useAuth();
  const [log, setLog] = useState([]);
  const [live, setLive] = useState({ object_count: 0, avg_rssi: 0, noise: 0 });
  const [objects, setObjects] = useState([]);
  const wsRef = useRef(null);
  const consoleRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get("/objects/log");
      setLog(data.log);
    };
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const t = getToken();
    if (!t) return;
    const ws = new WebSocket(`${WS_BASE}/live?token=${encodeURIComponent(t)}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.type === "snapshot") {
          setLive(m.summary);
          setObjects(m.objects);
        }
      } catch (err) { console.warn("ws message parse failed:", err?.message || err); }
    };
    return () => { try { ws.close(); } catch (err) { console.warn("ws close failed:", err?.message || err); } };
  }, []);

  if (user === false) return <Navigate to="/login" replace />;
  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <HoloHeader />
      <main className="flex-1 p-4 lg:p-6 holo-grid-bg">
        <h1 className="font-display text-2xl tracking-[0.3em] glow-cyan mb-4">OBJECT DETECTION CONSOLE</h1>

        <div className="grid lg:grid-cols-3 gap-4">
          <HoloPanel accent title="Konsole" badge="LIVE" className="lg:col-span-2" data-testid="console-panel">
            <div ref={consoleRef} className="h-[520px] overflow-auto font-mono text-[12px] space-y-1 pr-2">
              {log.map((l) => (
                <div key={l.id} className="flex gap-2">
                  <span className="text-cyan-500/70">[{new Date(l.ts).toLocaleTimeString("de-DE")}]</span>
                  <span className={
                    l.level === "WARN" ? "text-amber-300" :
                    l.level === "ERROR" ? "text-red-400" :
                    "text-cyan-200"
                  }>
                    {l.level === "WARN" ? <AlertTriangle size={11} className="inline mr-1" /> : "▸ "}{l.message}
                  </span>
                </div>
              ))}
              {log.length === 0 && <div className="text-cyan-400/60">▸ keine Ereignisse...</div>}
            </div>
          </HoloPanel>

          <div className="flex flex-col gap-4">
            <HoloPanel title="Sensor-Telemetrie" data-testid="telemetry-panel">
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="border border-cyan-500/20 p-2">
                  <div className="text-cyan-400/60 text-[10px] tracking-widest uppercase">Objekte</div>
                  <div className="text-cyan-100 text-lg">{live.object_count}</div>
                </div>
                <div className="border border-cyan-500/20 p-2">
                  <div className="text-cyan-400/60 text-[10px] tracking-widest uppercase">Avg RSSI</div>
                  <div className="text-cyan-100 text-lg">{live.avg_rssi} dBm</div>
                </div>
                <div className="border border-cyan-500/20 p-2 col-span-2">
                  <div className="text-cyan-400/60 text-[10px] tracking-widest uppercase">Noise Floor</div>
                  <div className="text-cyan-100 text-lg">{live.noise} dBm</div>
                </div>
              </div>
            </HoloPanel>

            <HoloPanel title="Aktive Tracker" badge={`${objects.length}`} data-testid="trackers-panel">
              <ul className="space-y-2">
                {objects.map((o) => (
                  <li key={o.id} className="border border-cyan-500/20 p-2 flex items-center gap-3" data-testid={`tracker-${o.id}`}>
                    <Eye size={14} className="text-cyan-300" />
                    <div className="flex-1">
                      <div className="font-display tracking-[0.2em] text-xs uppercase text-cyan-200">{o.class}</div>
                      <div className="font-mono text-[10px] text-cyan-300/70">({o.x.toFixed(2)}, {o.z.toFixed(2)})</div>
                    </div>
                    <div className={`font-mono text-xs ${o.confidence > 0.75 ? "text-pink-300" : "text-amber-300"}`}>
                      {Math.round(o.confidence * 100)}%
                    </div>
                  </li>
                ))}
                {objects.length === 0 && (
                  <li className="text-xs text-cyan-400/60 flex items-center gap-2">
                    <ShieldAlert size={14} /> Keine aktiven Tracker
                  </li>
                )}
              </ul>
            </HoloPanel>
          </div>
        </div>
      </main>
    </div>
  );
}
