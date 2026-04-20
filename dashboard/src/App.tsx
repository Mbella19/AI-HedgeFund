import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import Home from "./pages/Home";
import Strategies from "./pages/Strategies";
import Events from "./pages/Events";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import { authPing } from "./lib/api";
import { getToken } from "./lib/auth";

type AuthState = "loading" | "open" | "locked";

export default function App() {
  const [auth, setAuth] = useState<AuthState>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await authPing();
        if (cancelled) return;
        if (!r.authRequired) setAuth("open");
        else if (r.ok && getToken()) setAuth("open");
        else setAuth("locked");
      } catch {
        if (!cancelled) setAuth("locked");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (auth === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center mono text-[12px]"
        style={{ background: "var(--bg)", color: "var(--ink-3)" }}
      >
        loading…
      </div>
    );
  }
  if (auth === "locked") return <Login />;

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/overview" element={<Navigate to="/" replace />} />
        <Route path="/strategies" element={<Strategies />} />
        <Route path="/strategies/:id" element={<Strategies />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:id" element={<Events />} />
        <Route path="/runbook" element={<Navigate to="/events" replace />} />
        <Route path="/history" element={<Navigate to="/events" replace />} />
        <Route path="/profile" element={<Settings />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/data" element={<Navigate to="/profile" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
