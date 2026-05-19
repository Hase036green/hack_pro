import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Power, Radar, Cpu, Activity, Settings as SettingsIcon, ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const NavItem = ({ to, icon: Icon, label, active, testId }) => (
  <Link
    to={to}
    data-testid={testId}
    className={`flex items-center gap-2 px-3 py-2 border transition-all font-display text-xs tracking-[0.25em] uppercase ${
      active
        ? "border-cyan-400 text-cyan-200 bg-cyan-400/10 shadow-[0_0_14px_rgba(0,240,255,0.35)]"
        : "border-cyan-500/20 text-cyan-300/70 hover:border-cyan-400/60 hover:text-cyan-100"
    }`}
    style={{
      clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
    }}
  >
    <Icon size={14} />
    <span>{label}</span>
  </Link>
);

export default function HoloHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const isActive = (p) => loc.pathname === p;

  return (
    <header className="relative border-b border-cyan-500/30 bg-black/40 backdrop-blur-md">
      <div className="hg-scan-line" style={{ opacity: 0.3 }} />
      <div className="flex items-center justify-between px-6 py-3 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="flex items-center gap-2" data-testid="brand-logo">
            <div className="relative w-9 h-9 border border-cyan-400 grid place-items-center" style={{ clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))" }}>
              <Radar size={18} className="text-cyan-300 hg-pulse" />
            </div>
            <div>
              <div className="font-display text-base text-cyan-200 tracking-[0.4em] glow-cyan">
                ARCHER GRID
              </div>
              <div className="font-mono text-[10px] tracking-widest text-cyan-400/60 -mt-1">
                signal command center · v2.1
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex items-center gap-2 flex-wrap">
          <NavItem to="/dashboard" icon={Radar} label="Sensor" active={isActive("/dashboard")} testId="nav-sensor" />
          <NavItem to="/devices" icon={Cpu} label="Geräte" active={isActive("/devices")} testId="nav-devices" />
          <NavItem to="/analytics" icon={Activity} label="Analyse" active={isActive("/analytics")} testId="nav-analytics" />
          <NavItem to="/control" icon={SettingsIcon} label="Steuerung" active={isActive("/control")} testId="nav-control" />
          <NavItem to="/security" icon={ShieldAlert} label="Console" active={isActive("/security")} testId="nav-security" />
        </nav>

        <div className="flex items-center gap-3">
          <div className="font-mono text-xs text-cyan-300/80 hidden sm:block" data-testid="header-clock">
            {time.toUTCString().slice(17, 25)} UTC
          </div>
          <div className="tag-pill text-cyan-200">
            <span className="w-1.5 h-1.5 bg-emerald-400 hg-pulse rounded-full" />
            {user?.name || "Operator"}
          </div>
          <button onClick={handleLogout} className="holo-btn holo-btn--ghost" data-testid="logout-button">
            <Power size={14} />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
