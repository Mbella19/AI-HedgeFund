export type Venue = "tradingview" | "mt5";

export interface LiveMetrics {
  maxDdPct: number;
  maxConsecLoss: number;
  pf30t: number | null;
  ret30d: number;
  totalPnl: number;
  tradeCount: number;
}

export interface Breach {
  rule:
    | "hard_max_dd"
    | "hard_max_consec_loss"
    | "soft_pf_30t"
    | "soft_ret_30d_vs_avg";
  msg: string;
}

export interface LiveStrategy {
  venue: Venue;
  symbol: string;
  live_trades: number;
  metrics: LiveMetrics;
  breaches: Breach[];
}

export interface State {
  timestamp: string;
  strategies: Record<string, LiveStrategy>;
}

export interface Baseline {
  format: "tradingview" | "mt5";
  strategy_id: string;
  venue: Venue;
  symbol: string;
  net_profit: number;
  initial_capital?: number;
  cagr_pct?: number;
  max_dd_c2c_usd?: number;
  max_dd_c2c_pct?: number;
  max_dd_usd?: number;
  max_dd_pct?: number;
  total_trades: number;
  winning_trades?: number;
  losing_trades?: number;
  win_pct: number;
  sharpe?: number;
  sortino?: number;
  profit_factor: number;
  max_consec_loss: number;
  avg_daily_return: number;
  backtest_range: { start: string; end: string };
  params: Record<string, string>;
  source_file: string;
}

export type Baselines = Record<string, Baseline>;

export interface StrategyConfig {
  id: string;
  name: string;
  venue: Venue;
  symbol: string;
  timeframe: string;
  magic: number | null;
  baseline_xlsx: string;
  source_file: string;
  pine_strategy_name: string | null;
}

export interface LoopStatus {
  running: boolean;
  pid: number | null;
  started_at: string | null;
}

export interface Health {
  state_exists: boolean;
  baselines_exists: boolean;
  last_run: string | null;
  mt5_mcp: boolean;
  tv_cdp: boolean;
  loop: LoopStatus;
}

export interface HistoryEntry {
  date: string;
  timestamp: string;
  total: number;
  breached: number;
  total_trades: number;
  total_pnl: number;
}

export interface MonitorEvent {
  id: string;
  created: string;
  diagnosis: boolean;
  tweak: boolean;
  rebuild: boolean;
  files: string[];
}

export interface LiveCsvStatus {
  [symbol: string]:
    | { exists: false }
    | { exists: true; size_bytes: number; modified: string };
}

export interface BotStatus {
  id: string;
  name: string;
  script: string;
  running: boolean;
  pid: number | null;
  started_at: string | null;
}

export interface Proposal {
  id: string;
  created: string;
  files: string[];
  proposed_files: string[];
  validation_report: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  status: "pending" | "approved" | "rejected";
}
