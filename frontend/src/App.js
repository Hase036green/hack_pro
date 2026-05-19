import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Detect from "@/pages/Detect";
import Dashboard from "@/pages/Dashboard";
import Devices from "@/pages/Devices";
import Analytics from "@/pages/Analytics";
import Control from "@/pages/Control";
import Security from "@/pages/Security";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="font-display tracking-[0.4em] text-cyan-300 glow-cyan animate-pulse">
          INITIALISIERE...
        </div>
      </div>
    );
  }
  if (!user || user === false) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/detect" element={<Protected><Detect /></Protected>} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/devices" element={<Protected><Devices /></Protected>} />
            <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
            <Route path="/control" element={<Protected><Control /></Protected>} />
            <Route path="/security" element={<Protected><Security /></Protected>} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
