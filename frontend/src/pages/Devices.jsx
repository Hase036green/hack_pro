import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import HoloHeader from "../components/holo/HoloHeader";
import HoloPanel from "../components/holo/HoloPanel";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Smartphone, Laptop2, Tv2, Watch, Cpu, ShieldOff, ShieldCheck, RefreshCw } from "lucide-react";

const iconFor = (type) => {
  switch (type) {
    case "phone": return Smartphone;
    case "laptop": return Laptop2;
    case "tv": return Tv2;
    case "wearable": return Watch;
    default: return Cpu;
  }
};

function rssiBars(rssi) {
  if (rssi >= -50) return 5;
  if (rssi >= -60) return 4;
  if (rssi >= -70) return 3;
  if (rssi >= -80) return 2;
  return 1;
}

export default function Devices() {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/router/devices");
      setDevices(data.devices);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, []);

  const toggleBlock = async (d) => {
    await api.post("/router/device-action", { mac: d.mac, blocked: !d.blocked });
    load();
  };

  if (user === false) return <Navigate to="/login" replace />;
  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <HoloHeader />
      <main className="flex-1 p-4 lg:p-6 holo-grid-bg">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-2xl tracking-[0.3em] glow-cyan">VERBUNDENE GERÄTE</h1>
          <button onClick={load} className="holo-btn holo-btn--ghost" data-testid="refresh-devices">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Aktualisieren
          </button>
        </div>
        <HoloPanel accent title={`Aktive Clients · ${devices.length}`} badge="LIVE">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body min-w-[760px]">
              <thead>
                <tr className="text-left">
                  <th className="holo-label py-2 px-2">Gerät</th>
                  <th className="holo-label py-2 px-2">Typ</th>
                  <th className="holo-label py-2 px-2">IP</th>
                  <th className="holo-label py-2 px-2">MAC</th>
                  <th className="holo-label py-2 px-2">Band</th>
                  <th className="holo-label py-2 px-2">Signal</th>
                  <th className="holo-label py-2 px-2">Status</th>
                  <th className="holo-label py-2 px-2">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => {
                  const Ico = iconFor(d.type);
                  const bars = rssiBars(d.rssi);
                  return (
                    <tr key={d.mac} data-testid={`device-row-${d.mac}`} className="border-t border-cyan-500/20 hover:bg-cyan-500/5">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Ico size={16} className="text-cyan-300" />
                          <div>
                            <div className="text-cyan-100">{d.name}</div>
                            <div className="text-[10px] text-cyan-400/60 font-mono">{d.vendor}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 font-mono text-xs text-cyan-300/80 uppercase">{d.type}</td>
                      <td className="py-2 px-2 font-mono text-xs text-cyan-200">{d.ip}</td>
                      <td className="py-2 px-2 font-mono text-xs text-cyan-200">{d.mac}</td>
                      <td className="py-2 px-2 font-mono text-xs text-cyan-300/80">{d.band}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((b) => (
                            <span
                              key={b}
                              className="inline-block w-1.5"
                              style={{
                                height: `${4 + b * 3}px`,
                                background: b <= bars ? "#00f0ff" : "rgba(0,240,255,0.15)",
                                boxShadow: b <= bars ? "0 0 6px rgba(0,240,255,0.6)" : "none",
                              }}
                            />
                          ))}
                          <span className="ml-2 font-mono text-xs text-cyan-200">{d.rssi} dBm</span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        {d.blocked ? (
                          <span className="tag-pill text-red-300 border-red-400/40 bg-red-500/10">BLOCKIERT</span>
                        ) : (
                          <span className="tag-pill text-emerald-300 border-emerald-400/40 bg-emerald-500/10">AKTIV</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <button
                          data-testid={`device-action-${d.mac}`}
                          onClick={() => toggleBlock(d)}
                          className={`holo-btn ${d.blocked ? "" : "holo-btn--danger"} py-1.5 px-3`}
                        >
                          {d.blocked ? <><ShieldCheck size={12} /> Freigeben</> : <><ShieldOff size={12} /> Blockieren</>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </HoloPanel>
      </main>
    </div>
  );
}
