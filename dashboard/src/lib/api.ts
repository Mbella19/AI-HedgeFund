import type {
  Baselines,
  BotStatus,
  Health,
  HistoryEntry,
  LiveCsvStatus,
  MonitorEvent,
  Proposal,
  State,
  StrategyConfig,
} from "./types";
import { clearToken, getToken } from "./auth";

function authHeaders(): Record<string, string> {
  const tok = getToken();
  return tok ? { Authorization: `Bearer ${tok}` } : {};
}

function handle401(resp: Response): void {
  if (resp.status !== 401) return;
  clearToken();
  if (typeof window !== "undefined") window.location.reload();
}

async function get<T>(path: string): Promise<T> {
  const resp = await fetch(path, { headers: authHeaders() });
  if (!resp.ok) {
    handle401(resp);
    throw new Error(`${path} → ${resp.status}`);
  }
  return resp.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const resp = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    handle401(resp);
    throw new Error(`${path} → ${resp.status}`);
  }
  return resp.json();
}

export async function authPing(): Promise<{
  authRequired: boolean;
  ok: boolean;
}> {
  const resp = await fetch("/api/auth/ping", { headers: authHeaders() });
  if (resp.status === 401) return { authRequired: true, ok: false };
  return resp.json();
}

export const api = {
  health: () => get<Health>("/api/health"),
  state: () => get<State>("/api/state"),
  baselines: () => get<Baselines>("/api/baselines"),
  strategies: () => get<{ strategies: StrategyConfig[] }>("/api/strategies"),
  history: () => get<{ entries: HistoryEntry[] }>("/api/history"),
  historyDate: (date: string) => get<State>(`/api/history/${date}`),
  dailyLog: () => get<{ log: string }>("/api/daily-log"),
  events: () => get<{ events: MonitorEvent[] }>("/api/events"),
  event: (id: string) =>
    get<{ id: string; files: string[]; content: Record<string, string> }>(
      `/api/events/${id}`
    ),
  liveCsvStatus: () => get<LiveCsvStatus>("/api/live-csv/status"),
  startLoop: () =>
    post<{
      started: boolean;
      already_running?: boolean;
      pid: number | null;
      started_at: string | null;
    }>("/api/run"),
  stopLoop: () =>
    post<{ stopped: boolean; not_running?: boolean; pid?: number }>(
      "/api/stop"
    ),
  runOnce: () => post<{ started: boolean; pid: number }>("/api/run-once"),
  loopLog: (lines = 200) =>
    get<{ log: string; total_lines: number }>(`/api/loop-log?lines=${lines}`),
  bots: () => get<{ bots: BotStatus[] }>("/api/bots"),
  botStart: (id: string) =>
    post<{
      started: boolean;
      already_running?: boolean;
      id: string;
      pid: number;
      started_at: string;
    }>(`/api/bots/${id}/start`),
  botStop: (id: string) =>
    post<{ stopped: boolean; not_running?: boolean; id: string; pid?: number }>(
      `/api/bots/${id}/stop`
    ),
  botLog: (id: string, lines = 200) =>
    get<{ log: string; total_lines: number }>(
      `/api/bots/${id}/log?lines=${lines}`
    ),
  proposals: () => get<{ proposals: Proposal[] }>("/api/proposals"),
  approveProposal: (id: string) =>
    post<{ approved: boolean; id: string }>(`/api/proposals/${id}/approve`),
  rejectProposal: (id: string) =>
    post<{ rejected: boolean; id: string }>(`/api/proposals/${id}/reject`),
  drill: (strategyId: string) =>
    post<{ started: boolean; strategy: string; pid: number }>(
      `/api/drill/${strategyId}`
    ),
};
