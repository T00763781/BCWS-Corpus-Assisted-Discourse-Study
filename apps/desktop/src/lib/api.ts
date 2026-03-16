export type AnalyticsSnapshot = {
  connector_runs: number;
  condition_snapshots: number;
  discourse_items: number;
  actors: number;
  claims: number;
  incidents?: number;
};

export type ConditionSummary = {
  source_key: string;
  title: string;
  condition_type: string;
  region?: string | null;
  payload: Record<string, unknown>;
};

export type DashboardIncidentSummary = {
  fire_number: string;
  wildfire_name: string;
  stage_of_control: string;
  fire_centre: string;
  size_hectares?: number | null;
  updated_at?: string | null;
};

export type FireCentreOverview = {
  fire_centre: string;
  incident_count: number;
  under_control: number;
  being_held: number;
  out_of_control: number;
  evacuation_alerts: number;
  evacuation_orders: number;
};

export type DashboardOverview = {
  active_incidents: number;
  out_of_control: number;
  being_held: number;
  under_control: number;
  evacuation_orders: number;
  evacuation_alerts: number;
  area_restrictions: number;
  fire_centres: FireCentreOverview[];
  pinned_incidents: DashboardIncidentSummary[];
};

export type IncidentSummary = {
  fire_number: string;
  wildfire_name: string;
  stage_of_control: string;
  size_hectares?: number | null;
  discovered_at?: string | null;
  updated_at?: string | null;
  fire_centre?: string | null;
  location_summary?: string | null;
};

export type IncidentUpdateItem = {
  title: string;
  body: string;
  published_at?: string | null;
  is_current: boolean;
};

export type IncidentRestrictionItem = {
  restriction_type: string;
  title: string;
  status?: string | null;
  authority?: string | null;
  details?: string | null;
};

export type IncidentMapAssetItem = {
  asset_type: string;
  title: string;
  description?: string | null;
  asset_url?: string | null;
  is_download: boolean;
};

export type IncidentEnvironmentContextItem = {
  source_key: string;
  title: string;
  context_type: string;
  summary?: string | null;
  payload: Record<string, unknown>;
};

export type LinkedDiscourseSummary = {
  discourse_item_id: number;
  actor_name?: string | null;
  platform: string;
  body_text?: string | null;
  posted_at?: string | null;
  link_reason?: string | null;
};

export type IncidentDetail = IncidentSummary & {
  suspected_cause?: string | null;
  response_summary?: string | null;
  geometry_reference?: Record<string, unknown> | null;
  perimeter_reference?: Record<string, unknown> | null;
  resources_summary?: Record<string, unknown> | null;
  gallery_summary?: Record<string, unknown> | null;
  map_references?: Record<string, unknown> | null;
  updates: IncidentUpdateItem[];
  restrictions: IncidentRestrictionItem[];
  map_assets: IncidentMapAssetItem[];
  environment_context: IncidentEnvironmentContextItem[];
  linked_discourse: LinkedDiscourseSummary[];
};

export type FireCentreOutlookSummary = {
  fire_centre: string;
  issued_on?: string | null;
  valid_window?: string | null;
  summary: string;
  outlook?: string | null;
};

export type EnvironmentOverview = {
  outlooks: FireCentreOutlookSummary[];
  latest_conditions: ConditionSummary[];
};

export type MapCatalogEntry = IncidentMapAssetItem & {
  fire_number: string;
  wildfire_name: string;
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

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  return request<DashboardOverview>("/dashboard/overview");
}

export async function fetchIncidents(): Promise<IncidentSummary[]> {
  return request<IncidentSummary[]>("/incidents");
}

export async function fetchIncidentDetail(fireNumber: string): Promise<IncidentDetail> {
  return request<IncidentDetail>(`/incidents/${fireNumber}`);
}

export async function fetchEnvironmentOverview(): Promise<EnvironmentOverview> {
  return request<EnvironmentOverview>("/environment/overview");
}

export async function fetchMapsCatalog(): Promise<MapCatalogEntry[]> {
  return request<MapCatalogEntry[]>("/maps/catalog");
}

export async function runConnector(connectorKey: string): Promise<void> {
  await request("/connectors/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connector_key: connectorKey }),
  });
}
