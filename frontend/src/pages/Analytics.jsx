import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import HoloHeader from "../components/holo/HoloHeader";
import HoloPanel from "../components/holo/HoloPanel";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, AreaChart, Area } from "recharts";

const tooltipStyle = {
  backgroundColor: "rgba(2, 9, 23, 0.92)",
  border: "1px solid rgba(0,240,255,0.5)",
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 12,
  color: "#aef6ff",
};

export default function Analytics() {
  const { user } = useAuth();
  const [series, setSeries] = useState([]);

  const load = async () => {
    const { data } = await api.get("/signals/history");
    setSeries(data.series);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  if (user === false) return <Navigate to="/login" replace />;
  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <HoloHeader />
      <main className="flex-1 p-4 lg:p-6 holo-grid-bg">
        <h1 className="font-display text-2xl tracking-[0.3em] glow-cyan mb-4">SIGNAL-ANALYSE</h1>

        <div className="grid lg:grid-cols-2 gap-4">
          <HoloPanel accent title="RSSI Verlauf (60s)" badge="dBm" data-testid="rssi-chart">
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={series}>
                  <CartesianGrid stroke="rgba(0,240,255,0.08)" strokeDasharray="3 3" />
                  <XAxis dataKey="t" hide />
                  <YAxis domain={[-90, -30]} stroke="rgba(0,240,255,0.5)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={() => ""} />
                  <Line type="monotone" dataKey="rssi_2g" stroke="#3b82f6" strokeWidth={2} dot={false} name="2.4G" />
                  <Line type="monotone" dataKey="rssi_5g" stroke="#00f0ff" strokeWidth={2} dot={false} name="5G" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2 font-mono text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-cyan-400 inline-block" /> 5GHz</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> 2.4GHz</span>
            </div>
          </HoloPanel>

          <HoloPanel accent title="Kanal-Auslastung" badge="%">
            <div className="h-72">
              <ResponsiveContainer>
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="util2g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="util5g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(0,240,255,0.08)" strokeDasharray="3 3" />
                  <XAxis dataKey="t" hide />
                  <YAxis domain={[0, 100]} stroke="rgba(0,240,255,0.5)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={() => ""} />
                  <Area type="monotone" dataKey="util_2g" stroke="#3b82f6" fill="url(#util2g)" />
                  <Area type="monotone" dataKey="util_5g" stroke="#00f0ff" fill="url(#util5g)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2 font-mono text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-cyan-400/60 inline-block" /> 5GHz</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-blue-500/60 inline-block" /> 2.4GHz</span>
            </div>
          </HoloPanel>

          <HoloPanel title="Frequenz-Spektrum (sim.)" badge="MHz" className="lg:col-span-2" data-testid="spectrum-panel">
            <Spectrum />
          </HoloPanel>
        </div>
      </main>
    </div>
  );
}

function Spectrum() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 240);
    return () => clearInterval(id);
  }, []);
  const bars = Array.from({ length: 64 }).map((_, i) => {
    const v = 30 + 40 * Math.abs(Math.sin((i + tick) * 0.18)) + Math.random() * 15;
    return v;
  });
  return (
    <div className="h-32 flex items-end gap-[2px]">
      {bars.map((v, i) => (
        <div
          key={i}
          className="flex-1"
          style={{
            height: `${v}%`,
            background: `linear-gradient(to top, rgba(0,240,255,0.1), rgba(0,240,255,${0.4 + v / 200}))`,
            boxShadow: v > 70 ? "0 0 8px rgba(0,240,255,0.5)" : "none",
          }}
        />
      ))}
    </div>
  );
}
