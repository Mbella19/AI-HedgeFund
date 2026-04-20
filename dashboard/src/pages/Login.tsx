import { useState, type FormEvent } from "react";
import { authPing } from "../lib/api";
import { setToken } from "../lib/auth";
import { Button, Card } from "../components/primitives";

export default function Login() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    setToken(value.trim());
    try {
      const r = await authPing();
      if (r.ok) {
        window.location.reload();
      } else {
        setError("Token rejected");
        setBusy(false);
      }
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-[360px] grid gap-4">
        <div className="text-center">
          <div
            className="text-[11px] mono"
            style={{ color: "var(--ink-3)", letterSpacing: ".18em" }}
          >
            EOD MONITOR
          </div>
          <div className="text-[22px] font-bold mt-2">Unlock dashboard</div>
          <div
            className="text-[12px] mt-1"
            style={{ color: "var(--ink-3)" }}
          >
            Enter your access token
          </div>
        </div>
        <Card>
          <form onSubmit={onSubmit} className="grid gap-3">
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="token"
              className="mono text-[13px] outline-none"
              style={{
                background: "var(--surface-2)",
                color: "var(--ink-1)",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid var(--line)",
              }}
            />
            {error && (
              <div className="text-[12px]" style={{ color: "var(--red)" }}>
                {error}
              </div>
            )}
            <Button
              kind="mint"
              size="md"
              type="submit"
              disabled={busy || !value.trim()}
            >
              {busy ? "CHECKING…" : "UNLOCK"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
