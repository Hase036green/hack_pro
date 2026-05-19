import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import HoloHeader from "../components/holo/HoloHeader";
import HoloPanel from "../components/holo/HoloPanel";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Power, Wifi, Save, Loader2, RefreshCw, AlertTriangle } from "lucide-react";

export default function Control() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [wifi, setWifi] = useState({ ssid_2g: "", ssid_5g: "", tx_power: 80, channel_2g: 6, channel_5g: 36 });
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data } = await api.get("/router/status");
    setStatus(data);
    setWifi({
      ssid_2g: data.wifi.ssid_2g,
      ssid_5g: data.wifi.ssid_5g,
      tx_power: data.wifi.tx_power,
      channel_2g: data.wifi.channel_2g,
      channel_5g: data.wifi.channel_5g,
    });
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/router/wifi", wifi);
      setMsg("WLAN-Einstellungen übernommen");
      setTimeout(() => setMsg(""), 2500);
      load();
    } finally {
      setSaving(false);
    }
  };

  const restart = async () => {
    if (!window.confirm("Router wirklich neu starten?")) return;
    setRestarting(true);
    try {
      await api.post("/router/restart");
      setMsg("Router-Neustart eingeleitet");
      setTimeout(() => setMsg(""), 2500);
      load();
    } finally {
      setRestarting(false);
    }
  };

  if (user === false) return <Navigate to="/login" replace />;
  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <HoloHeader />
      <main className="flex-1 p-4 lg:p-6 holo-grid-bg">
        <h1 className="font-display text-2xl tracking-[0.3em] glow-cyan mb-4">ROUTER-STEUERUNG</h1>

        <div className="grid lg:grid-cols-3 gap-4">
          <HoloPanel accent title="WLAN-Konfiguration" data-testid="wifi-panel" className="lg:col-span-2">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="holo-label block mb-1">SSID 2.4 GHz</label>
                <input
                  data-testid="ssid-2g-input"
                  className="holo-input font-mono"
                  value={wifi.ssid_2g}
                  onChange={(e) => setWifi({ ...wifi, ssid_2g: e.target.value })}
                />
              </div>
              <div>
                <label className="holo-label block mb-1">SSID 5 GHz</label>
                <input
                  data-testid="ssid-5g-input"
                  className="holo-input font-mono"
                  value={wifi.ssid_5g}
                  onChange={(e) => setWifi({ ...wifi, ssid_5g: e.target.value })}
                />
              </div>
              <div>
                <label className="holo-label block mb-1">Kanal 2.4G</label>
                <input
                  data-testid="channel-2g-input"
                  type="number"
                  min={1}
                  max={13}
                  className="holo-input font-mono"
                  value={wifi.channel_2g}
                  onChange={(e) => setWifi({ ...wifi, channel_2g: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="holo-label block mb-1">Kanal 5G</label>
                <input
                  data-testid="channel-5g-input"
                  type="number"
                  min={36}
                  max={165}
                  className="holo-input font-mono"
                  value={wifi.channel_5g}
                  onChange={(e) => setWifi({ ...wifi, channel_5g: Number(e.target.value) })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="holo-label block mb-1">Sendeleistung · {wifi.tx_power}%</label>
                <input
                  data-testid="tx-power-input"
                  type="range"
                  min={0}
                  max={100}
                  value={wifi.tx_power}
                  onChange={(e) => setWifi({ ...wifi, tx_power: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-5">
              <button onClick={save} disabled={saving} className="holo-btn" data-testid="save-wifi-button">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Speichere...</> : <><Save size={14} /> Übernehmen</>}
              </button>
              <button onClick={load} className="holo-btn holo-btn--ghost" data-testid="reload-wifi-button">
                <RefreshCw size={14} /> Neu laden
              </button>
              {msg && <span className="font-mono text-xs text-emerald-300">▸ {msg}</span>}
            </div>
          </HoloPanel>

          <div className="flex flex-col gap-4">
            <HoloPanel title="Router-Status" data-testid="status-panel">
              <ul className="space-y-2 font-mono text-xs">
                <Row k="Modell" v={status?.model || "—"} />
                <Row k="Firmware" v={status?.firmware || "—"} />
                <Row k="Modus" v={(status?.mode || "demo").toUpperCase()} />
                <Row k="Host" v={status?.host || "—"} />
                <Row k="Uptime" v={status?.uptime_sec ? `${status.uptime_sec}s` : "—"} />
                <Row k="TX" v={`${(status?.stats?.tx_bytes || 0).toLocaleString()} B`} />
                <Row k="RX" v={`${(status?.stats?.rx_bytes || 0).toLocaleString()} B`} />
                <Row k="Verschlüsselung" v={status?.wifi?.encryption || "—"} />
              </ul>
            </HoloPanel>

            <HoloPanel title="Notfall-Aktionen" data-testid="emergency-panel">
              <div className="flex items-start gap-2 text-amber-300/80 font-mono text-xs mb-3">
                <AlertTriangle size={14} className="mt-0.5" />
                <span>Vorsicht – beendet alle aktiven Verbindungen für ~30s.</span>
              </div>
              <button onClick={restart} disabled={restarting} className="holo-btn holo-btn--danger w-full justify-center" data-testid="router-restart-button">
                {restarting ? <><Loader2 size={14} className="animate-spin" /> Neustarte...</> : <><Power size={14} /> Router neustarten</>}
              </button>
            </HoloPanel>
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-cyan-500/10 pb-1">
      <span className="text-cyan-400/60">{k}</span>
      <span className="text-cyan-100 truncate" title={v}>{v}</span>
    </li>
  );
}
