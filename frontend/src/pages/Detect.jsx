import React, { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Radar, Cable, Wifi, CheckCircle2, Loader2, AlertTriangle, Cpu } from "lucide-react";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const ROUTER_IMG = "https://static.prod-images.emergentagent.com/jobs/092d8b15-cdce-4724-8442-1a00877b3092/images/64f20511c62ecbbe495527f989b13cac2e932e39a8ebf23436e8b3f919118410.png";

const STEPS = [
  "USB/LAN Schnittstelle scannen",
  "Ethernet-Link aushandeln (1 Gbps)",
  "ARP Broadcast → 192.168.0.1",
  "HTTP Banner-Grab → tplinkwifi.net",
  "TP-LINK Modell-Identifikation",
  "Firmware Version auslesen",
  "Sensor-Array Sync",
];

export default function Detect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  const [device, setDevice] = useState(null);
  const [error, setError] = useState("");
  const [demoMode, setDemoMode] = useState(true);
  const [host, setHost] = useState("192.168.0.1");
  const [routerPassword, setRouterPassword] = useState("");
  const [phase, setPhase] = useState("scanning"); // scanning | found | connecting | connected

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setProgress((p) => Math.min(100, p + 100 / (STEPS.length * 8)));
      if (i % 8 === 0) setStep((s) => Math.min(STEPS.length - 1, s + 1));
      if (i >= STEPS.length * 8) {
        clearInterval(id);
        runDetect();
      }
    }, 110);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runDetect = async () => {
    try {
      const { data } = await api.get("/router/detect");
      setDevice(data.device);
      setPhase("found");
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const connect = async () => {
    setError("");
    setPhase("connecting");
    try {
      const { data } = await api.post("/router/connect", {
        host,
        password: routerPassword,
        demo_mode: demoMode,
      });
      if (data.connected) {
        setPhase("connected");
        setTimeout(() => navigate("/dashboard"), 700);
      } else {
        setError("Verbindung fehlgeschlagen");
        setPhase("found");
      }
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      setPhase("found");
    }
  };

  if (user === false) return <Navigate to="/login" replace />;
  if (user === null) return null;

  return (
    <div className="min-h-screen relative scanlines holo-grid-bg">
      <div className="hg-scan-line" />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-cyan-400/40 mb-3" style={{ clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))" }}>
            <Radar size={12} className="text-cyan-300 hg-pulse" />
            <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300">HARDWARE_SCAN</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl tracking-[0.25em] glow-cyan" data-testid="detect-title">
            VERBINDUNG ERKENNEN
          </h1>
          <p className="text-cyan-300/60 mt-3 text-sm tracking-wide">
            ARCHER GRID sucht nach physisch verbundenen TP-Link Routern an der Ethernet-Schnittstelle.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Scan visualization */}
          <div className="holo-panel p-6 relative min-h-[460px]">
            <span className="holo-panel-corner tl" />
            <span className="holo-panel-corner tr" />
            <span className="holo-panel-corner bl" />
            <span className="holo-panel-corner br" />
            <div className="flex items-center gap-2 mb-4">
              <Cable className="text-cyan-300" size={16} />
              <span className="holo-label">Kabel-Diagnose</span>
            </div>
            <div className="relative h-56 mb-4 grid place-items-center border border-cyan-500/20 bg-black/40 overflow-hidden">
              <img src={ROUTER_IMG} alt="TP-Link" className="h-full object-contain opacity-90 mix-blend-screen" />
              {phase === "scanning" && (
                <div className="absolute inset-0 hg-scan-line" />
              )}
              <div className="absolute top-2 left-2 font-mono text-[10px] text-cyan-300/80">
                TARGET // 192.168.0.1
              </div>
              <div className="absolute bottom-2 right-2 font-mono text-[10px] text-cyan-300/80">
                {phase === "scanning" ? "SCANNING..." : "LINK ESTABLISHED"}
              </div>
            </div>

            {/* progress bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="text-cyan-300/80">{STEPS[step]}</span>
                <span className="text-cyan-200">{Math.floor(progress)}%</span>
              </div>
              <div className="h-1.5 bg-cyan-900/30 relative overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all"
                  style={{ width: `${progress}%`, boxShadow: "0 0 12px rgba(0,240,255,0.8)" }}
                />
              </div>
            </div>

            <ul className="space-y-1 font-mono text-xs">
              {STEPS.map((s, i) => (
                <li key={s} className={`flex items-center gap-2 ${i <= step ? "text-cyan-200" : "text-cyan-700"}`}>
                  {i < step ? <CheckCircle2 size={12} className="text-emerald-400" /> : i === step ? <Loader2 size={12} className="animate-spin" /> : <span className="w-3 h-3 inline-block border border-cyan-700" />}
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Found device / Connect form */}
          <div className="holo-panel holo-panel--accent p-6 relative min-h-[460px]">
            <span className="holo-panel-corner tl" />
            <span className="holo-panel-corner tr" />
            <span className="holo-panel-corner bl" />
            <span className="holo-panel-corner br" />

            {!device && (
              <div className="h-full grid place-items-center text-center">
                <div>
                  <Loader2 className="animate-spin text-cyan-300 mx-auto mb-3" />
                  <div className="font-display tracking-[0.3em] text-cyan-200">SCAN LÄUFT</div>
                  <p className="text-xs text-cyan-300/60 mt-2 font-mono">Warte auf Hardware-Identifikation...</p>
                </div>
              </div>
            )}

            {device && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="text-emerald-400" size={16} />
                  <span className="holo-label text-emerald-300">Gerät erkannt</span>
                </div>
                <div className="divider-glow mb-4" />
                <div className="grid grid-cols-2 gap-3 mb-5 font-mono text-xs">
                  <Stat label="Modell" value={device.model} />
                  <Stat label="MAC-Adresse" value={device.mac} />
                  <Stat label="Firmware" value={device.firmware} />
                  <Stat label="Schnittstelle" value={device.interface} />
                  <Stat label="Link-Speed" value={device.link_speed} />
                  <Stat label="IP-Adresse" value={device.host} />
                </div>

                <div className="divider-glow mb-4" />
                <div className="flex items-center gap-2 mb-3">
                  <Wifi size={14} className="text-cyan-300" />
                  <span className="holo-label">Verbindungsmodus</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setDemoMode(true)}
                    data-testid="mode-demo-button"
                    className={`px-3 py-2 border text-xs font-display tracking-[0.2em] uppercase ${demoMode ? "border-cyan-400 bg-cyan-400/15 text-cyan-100 shadow-[0_0_12px_rgba(0,240,255,0.3)]" : "border-cyan-500/30 text-cyan-300/70"}`}
                    style={{ clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))" }}
                  >
                    Demo-Modus
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoMode(false)}
                    data-testid="mode-live-button"
                    className={`px-3 py-2 border text-xs font-display tracking-[0.2em] uppercase ${!demoMode ? "border-cyan-400 bg-cyan-400/15 text-cyan-100 shadow-[0_0_12px_rgba(0,240,255,0.3)]" : "border-cyan-500/30 text-cyan-300/70"}`}
                    style={{ clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))" }}
                  >
                    Live-Modus
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="holo-label block mb-1">Router-IP</label>
                    <input
                      data-testid="router-host-input"
                      className="holo-input font-mono text-xs"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      disabled={demoMode}
                    />
                  </div>
                  <div>
                    <label className="holo-label block mb-1">Admin-Passwort</label>
                    <input
                      data-testid="router-password-input"
                      type="password"
                      className="holo-input font-mono text-xs"
                      value={routerPassword}
                      onChange={(e) => setRouterPassword(e.target.value)}
                      placeholder={demoMode ? "—" : "••••••"}
                      disabled={demoMode}
                    />
                  </div>
                </div>

                {!demoMode && (
                  <div className="border border-amber-500/40 bg-amber-500/10 p-2 mb-4 flex gap-2 items-start text-amber-200 text-xs font-mono">
                    <AlertTriangle size={14} className="mt-0.5" />
                    <span>Live-Modus versucht eine Verbindung zur tatsächlichen Router-Admin-Oberfläche. Funktioniert nur, wenn dein Laptop direkt mit dem Archer C6 verbunden ist.</span>
                  </div>
                )}

                {error && (
                  <div className="border border-red-500/50 bg-red-500/10 p-2 mb-4 text-red-300 text-xs font-mono">⚠ {error}</div>
                )}

                <button
                  onClick={connect}
                  data-testid="router-connect-button"
                  disabled={phase === "connecting"}
                  className="holo-btn w-full justify-center py-3"
                >
                  {phase === "connecting" ? <><Loader2 className="animate-spin" size={14} /> Verbinde...</> : phase === "connected" ? <><CheckCircle2 size={14} /> Übernommen</> : <><Cpu size={14} /> Router übernehmen</>}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border border-cyan-500/20 px-3 py-2">
      <div className="text-[9px] tracking-[0.3em] uppercase text-cyan-400/60 font-display">{label}</div>
      <div className="text-cyan-100 mt-0.5 truncate" title={value}>{value}</div>
    </div>
  );
}
