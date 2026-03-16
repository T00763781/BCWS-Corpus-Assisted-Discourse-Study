export type AnalyticsSnapshot = {
  connector_runs: number;
  condition_snapshots: number;
  discourse_items: number;
  actors: number;
  claims: number;
};

export type ConditionSummary = {
  source_key: string;
  title: string;
  condition_type: string;
  region?: string | null;
  payload: Record<string, unknown>;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchAnalytics(): Promise<AnalyticsSnapshot> {
  return request<AnalyticsSnapshot>("/analytics/snapshot");
}

export async function fetchConditions(): Promise<ConditionSummary[]> {
  return request<ConditionSummary[]>("/conditions");
}

export async function runConnector(connectorKey: string): Promise<void> {
  await request("/connectors/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connector_key: connectorKey }),
  });
}
