import React, { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Lock, Mail, Radar, ChevronRight, Loader2 } from "lucide-react";

const BG = "https://static.prod-images.emergentagent.com/jobs/092d8b15-cdce-4724-8442-1a00877b3092/images/c8db60caab62f0e7a77b3866c499a82fd17c0dc6575cac30a0735a63871f998e.png";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@archer.local");
  const [password, setPassword] = useState("archer1300");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bootText, setBootText] = useState("");

  useEffect(() => {
    const lines = [
      "> initialisiere ARCHER_GRID kernel...",
      "> lade subsystem signal_array.so",
      "> rfid handshake [OK]",
      "> tls 1.3 secure channel etabliert",
      "> warte auf operator authentifizierung...",
    ];
    let i = 0;
    let j = 0;
    let buf = "";
    const id = setInterval(() => {
      if (i >= lines.length) {
        clearInterval(id);
        return;
      }
      buf += lines[i][j];
      setBootText(buf);
      j++;
      if (j >= lines[i].length) {
        buf += "\n";
        i++;
        j = 0;
      }
    }, 22);
    return () => clearInterval(id);
  }, []);

  if (user && user !== false) return <Navigate to="/detect" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const r = await login(email, password);
    setLoading(false);
    if (r.ok) navigate("/detect", { replace: true });
    else setError(r.error || "Authentifizierung fehlgeschlagen");
  };

  return (
    <div
      className="min-h-screen relative grid place-items-center px-4 scanlines"
      style={{
        backgroundImage: `url(${BG})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-black/60 holo-grid-bg" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />

      <div className="relative grid lg:grid-cols-2 gap-8 max-w-5xl w-full">
        {/* Boot console */}
        <div className="holo-panel p-6 relative hidden lg:flex flex-col min-h-[420px]">
          <span className="holo-panel-corner tl" />
          <span className="holo-panel-corner tr" />
          <span className="holo-panel-corner bl" />
          <span className="holo-panel-corner br" />
          <div className="hg-scan-line" style={{ height: "120px", opacity: 0.25 }} />
          <div className="flex items-center gap-2 mb-3">
            <Radar className="text-cyan-300 hg-pulse" size={18} />
            <span className="holo-label">System Boot Sequence</span>
          </div>
          <div className="divider-glow mb-4" />
          <pre className="font-mono text-[12px] leading-6 text-cyan-300/90 whitespace-pre-wrap flex-1">
            {bootText}
            <span className="hg-blink">▌</span>
          </pre>
          <div className="mt-4 text-[10px] font-mono text-cyan-400/50 tracking-widest">
            ▸ TARGET: TP-LINK ARCHER C6 // AC1300 DUAL-BAND
          </div>
        </div>

        {/* Login form */}
        <div className="holo-panel holo-panel--accent p-8 relative">
          <span className="holo-panel-corner tl" />
          <span className="holo-panel-corner tr" />
          <span className="holo-panel-corner bl" />
          <span className="holo-panel-corner br" />
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-cyan-400/40 mb-3" style={{ clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))" }}>
              <span className="w-2 h-2 bg-emerald-400 rounded-full hg-pulse" />
              <span className="font-mono text-[10px] tracking-[0.3em] text-emerald-300">CHANNEL SECURE</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl tracking-[0.3em] glow-cyan">
              OPERATOR LOGIN
            </h1>
            <p className="text-cyan-300/60 mt-2 text-sm tracking-wide font-mono">
              ▸ Zugriff nur für autorisiertes Personal
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
            <div>
              <label className="holo-label flex items-center gap-2 mb-2">
                <Mail size={12} /> Operator-ID
              </label>
              <input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@archer.local"
                className="holo-input font-mono"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="holo-label flex items-center gap-2 mb-2">
                <Lock size={12} /> Zugangs-Code
              </label>
              <input
                data-testid="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="holo-input font-mono"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="border border-red-500/50 bg-red-500/10 px-3 py-2 text-red-300 font-mono text-xs" data-testid="login-error">
                ⚠ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-button"
              className="holo-btn w-full justify-center text-base py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Authentifizierung...
                </>
              ) : (
                <>
                  Gateway entriegeln <ChevronRight size={16} />
                </>
              )}
            </button>

            <div className="text-center text-[10px] font-mono text-cyan-400/40 tracking-widest pt-2">
              ▸ DEFAULT // admin@archer.local · archer1300
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
