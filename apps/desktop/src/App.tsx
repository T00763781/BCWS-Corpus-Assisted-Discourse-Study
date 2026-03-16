import { useEffect, useMemo, useState } from "react";
import {
  HashRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  fetchAnalytics,
  fetchDashboardOverview,
  fetchEnvironmentOverview,
  fetchIncidentDetail,
  fetchIncidents,
  fetchMapsCatalog,
  runConnector,
  type AnalyticsSnapshot,
  type DashboardOverview,
  type EnvironmentOverview,
  type IncidentDetail,
  type IncidentSummary,
  type MapCatalogEntry,
} from "./lib/api";

const CONNECTOR_KEYS = ["bcws.catalog", "cwfis.summary", "geomet.weather", "social.seed"];

const MAIN_NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/incidents", label: "Incidents" },
  { to: "/discourse", label: "Discourse" },
  { to: "/environment", label: "Environment" },
  { to: "/maps", label: "Maps" },
  { to: "/configure", label: "Configure" },
];

const INCIDENT_TABS = [
  { key: "response", label: "Response" },
  { key: "gallery", label: "Gallery" },
  { key: "maps", label: "Maps" },
  { key: "discourse", label: "Discourse" },
] as const;

const CONFIGURE_COPY = [
  {
    title: "Study",
    body: "Open Fireside remains incident-first in this phase. Dashboard, Incidents, Environment, and Maps stay aligned to wildfire operations rather than discourse ingestion.",
  },
  {
    title: "Sources",
    body: "BCWS incident catalog and updates are primary. Evacuations, restrictions, CWFIS summaries, and GeoMet outlook layers land into the same incident and fire-centre spine.",
  },
  {
    title: "Watchlists",
    body: "Pin active incidents, watch evacuation state, and refresh environment overlays before attaching expanded discourse ingestion.",
  },
  {
    title: "Linking",
    body: "Discourse remains attached to incident and fire-centre scope. Social records should resolve to a fire number, fire centre, or linked geography before they become first-class UI signals.",
  },
  {
    title: "Storage",
    body: "Runtime endpoints are documented in open_fireside_endpoints.csv. Seed and connector normalization sources remain under the API service so workstation snapshots stay reproducible.",
  },
  {
    title: "Diagnostics",
    body: "Use connector runs from the left rail, then inspect dashboard, incidents, and environment surfaces to verify visible state mutation.",
  },
];

type AppData = {
  analytics: AnalyticsSnapshot | null;
  dashboard: DashboardOverview | null;
  incidents: IncidentSummary[];
  environment: EnvironmentOverview | null;
  mapsCatalog: MapCatalogEntry[];
  error: string | null;
  running: string | null;
  refresh: () => Promise<void>;
  triggerConnector: (connectorKey: string) => Promise<void>;
};

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stageClass(stage: string) {
  const normalized = stage.toLowerCase();
  if (normalized.includes("out")) {
    return "stage-pill stage-pill-out";
  }
  if (normalized.includes("held")) {
    return "stage-pill stage-pill-held";
  }
  return "stage-pill stage-pill-control";
}

function DashboardPage({
  analytics,
  dashboard,
  environment,
  incidents,
}: Pick<AppData, "analytics" | "dashboard" | "environment" | "incidents">) {
  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Wildfire overview</p>
          <h1>Dashboard</h1>
          <p className="lede">Operational wildfire workspace aligned to the approved mockup structure and powered by the normalized incident spine.</p>
        </div>
      </section>

      <section className="dashboard-template-grid">
        <div className="panel span-two">
          <div className="panel-title">British Columbia overview</div>
          <div className="map-placeholder tall-map">
            <div className="map-label">Province map surface</div>
            <div className="legend-row">
              <span className="chip">Incident zones</span>
              <span className="chip">Evacuation overlays</span>
              <span className="chip">Perimeter layers</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Operational totals</div>
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-label">Active wildfires</div>
              <div className="metric-value">{dashboard?.active_incidents ?? incidents.length}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Evacuation alerts</div>
              <div className="metric-value">{dashboard?.evacuation_alerts ?? 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Area restrictions</div>
              <div className="metric-value">{dashboard?.area_restrictions ?? 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Connector runs</div>
              <div className="metric-value">{analytics?.connector_runs ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Stage of control</div>
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-label">Under control</div>
              <div className="metric-value">{dashboard?.under_control ?? 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Being held</div>
              <div className="metric-value">{dashboard?.being_held ?? 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Out of control</div>
              <div className="metric-value">{dashboard?.out_of_control ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Pinned incidents</div>
          <div className="list-card">
            {(dashboard?.pinned_incidents ?? []).map((incident) => (
              <Link className="list-link" key={incident.fire_number} to={`/incidents/${incident.fire_number}`}>
                <div>
                  <strong>{incident.wildfire_name}</strong>
                  <div className="muted">{incident.fire_number} · {incident.fire_centre}</div>
                </div>
                <span className={stageClass(incident.stage_of_control)}>{incident.stage_of_control}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="panel span-two">
          <div className="panel-title">Fire centre matrix</div>
          <div className="matrix-table">
            <div className="data-row data-row-header data-row-five">
              <span>Fire centre</span>
              <span>Incidents</span>
              <span>Under control</span>
              <span>Held</span>
              <span>Out</span>
            </div>
            {(dashboard?.fire_centres ?? []).map((centre) => (
              <div className="data-row data-row-five" key={centre.fire_centre}>
                <span>{centre.fire_centre}</span>
                <span>{centre.incident_count}</span>
                <span>{centre.under_control}</span>
                <span>{centre.being_held}</span>
                <span>{centre.out_of_control}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Discourse posture</div>
          <div className="discourse-grid">
            <div className="metric-card">
              <div className="metric-label">Discourse items</div>
              <div className="metric-value">{analytics?.discourse_items ?? 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Actors</div>
              <div className="metric-value">{analytics?.actors ?? 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Claims</div>
              <div className="metric-value">{analytics?.claims ?? 0}</div>
            </div>
          </div>
          <div className="prose-box">
            Discourse remains secondary in this phase. Signals attach to an incident or fire-centre context rather than driving the product information architecture.
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Fire centre outlooks</div>
          <div className="outlook-grid">
            {(environment?.outlooks ?? []).map((outlook) => (
              <div className="outlook-card" key={`${outlook.fire_centre}-${outlook.issued_on ?? "undated"}`}>
                <strong>{outlook.fire_centre}</strong>
                <div className="muted">{outlook.valid_window ?? "Forecast window pending"}</div>
                <p>{outlook.summary}</p>
                <div className="muted">{formatDateTime(outlook.issued_on)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function IncidentListPage({ incidents }: Pick<AppData, "incidents">) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sortKey, setSortKey] = useState("updated");

  const stages = useMemo(() => {
    return ["all", ...new Set(incidents.map((incident) => incident.stage_of_control))];
  }, [incidents]);

  const filtered = useMemo(() => {
    const lowered = query.toLowerCase();
    const next = incidents.filter((incident) => {
      const matchesText =
        incident.wildfire_name.toLowerCase().includes(lowered) ||
        incident.fire_number.toLowerCase().includes(lowered) ||
        (incident.fire_centre ?? "").toLowerCase().includes(lowered);
      const matchesStage = stageFilter === "all" || incident.stage_of_control === stageFilter;
      return matchesText && matchesStage;
    });

    return next.sort((left, right) => {
      if (sortKey === "name") {
        return left.wildfire_name.localeCompare(right.wildfire_name);
      }
      if (sortKey === "size") {
        return (right.size_hectares ?? 0) - (left.size_hectares ?? 0);
      }
      return (Date.parse(right.updated_at ?? "") || 0) - (Date.parse(left.updated_at ?? "") || 0);
    });
  }, [incidents, query, stageFilter, sortKey]);

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Incident workspace</p>
          <h1>Incidents</h1>
          <p className="lede">Searchable incident catalog backed by the normalized BCWS and environment incident spine.</p>
        </div>
      </section>

      <section className="panel">
        <div className="toolbar">
          <input
            className="text-input"
            placeholder="Search wildfire name, fire number, or fire centre"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="inline-toolbar">
            {stages.map((stage) => (
              <button
                className={`chip${stageFilter === stage ? " chip-active" : ""}`}
                key={stage}
                onClick={() => setStageFilter(stage)}
                type="button"
              >
                {stage === "all" ? "All stages" : stage}
              </button>
            ))}
          </div>
          <select className="text-input" value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
            <option value="updated">Sort by updated</option>
            <option value="name">Sort by name</option>
            <option value="size">Sort by size</option>
          </select>
        </div>

        <div className="data-table">
          <div className="data-row data-row-header data-row-seven">
            <span>Wildfire</span>
            <span>Fire number</span>
            <span>Stage</span>
            <span>Fire centre</span>
            <span>Size</span>
            <span>Discovered</span>
            <span>Updated</span>
          </div>
          {filtered.map((incident) => (
            <button className="data-row data-row-seven table-button" key={incident.fire_number} onClick={() => navigate(`/incidents/${incident.fire_number}`)} type="button">
              <span className="table-link">{incident.wildfire_name}</span>
              <span>{incident.fire_number}</span>
              <span><span className={stageClass(incident.stage_of_control)}>{incident.stage_of_control}</span></span>
              <span>{incident.fire_centre ?? "-"}</span>
              <span>{incident.size_hectares?.toLocaleString() ?? "-"}</span>
              <span>{formatDate(incident.discovered_at)}</span>
              <span>{formatDateTime(incident.updated_at)}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function IncidentDetailPage() {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof INCIDENT_TABS)[number]["key"]>("response");

  useEffect(() => {
    let active = true;
    async function loadIncident() {
      if (!incidentId) {
        return;
      }
      try {
        setError(null);
        const payload = await fetchIncidentDetail(incidentId);
        if (active) {
          setIncident(payload);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }
    loadIncident();
    return () => {
      active = false;
    };
  }, [incidentId]);

  return (
    <>
      <section className="compact-header">
        <button className="back-button" onClick={() => navigate("/incidents")} type="button">Back to incidents</button>
        <div>
          <p className="eyebrow">Incident detail</p>
          <h1>{incident?.wildfire_name ?? incidentId}</h1>
          <div className="meta-list">
            <span>{incident?.fire_number}</span>
            <span>{incident?.fire_centre ?? "-"}</span>
            <span className={stageClass(incident?.stage_of_control ?? "Under Control")}>{incident?.stage_of_control ?? "Loading"}</span>
            <span>{incident?.size_hectares?.toLocaleString() ?? "-"} ha</span>
          </div>
        </div>
      </section>

      {error ? <div className="alert">{error}</div> : null}

      <section className="panel">
        <div className="inline-toolbar">
          {INCIDENT_TABS.map((item) => (
            <button className={`subtab${tab === item.key ? " subtab-active" : ""}`} key={item.key} onClick={() => setTab(item.key)} type="button">
              {item.label}
            </button>
          ))}
        </div>

        {incident ? (
          <>
            {tab === "response" ? (
              <div className="template-grid">
                <div className="panel span-two">
                  <div className="panel-title">Response summary</div>
                  <div className="prose-box">{incident.response_summary ?? "No response summary available yet."}</div>
                  <div className="kv-grid">
                    <div><strong>Suspected cause</strong><span>{incident.suspected_cause ?? "-"}</span></div>
                    <div><strong>Discovered</strong><span>{formatDate(incident.discovered_at)}</span></div>
                    <div><strong>Updated</strong><span>{formatDateTime(incident.updated_at)}</span></div>
                    <div><strong>Location</strong><span>{incident.location_summary ?? "-"}</span></div>
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-title">Restrictions</div>
                  <div className="list-card">
                    {incident.restrictions.map((restriction) => (
                      <div className="incident-card" key={`${restriction.restriction_type}-${restriction.title}`}>
                        <strong>{restriction.title}</strong>
                        <div className="muted">{restriction.restriction_type} · {restriction.status ?? "Status pending"}</div>
                        <p>{restriction.details ?? "No additional restriction detail."}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel span-three">
                  <div className="panel-title">Latest updates</div>
                  <div className="list-card">
                    {incident.updates.map((update) => (
                      <div className="incident-card" key={`${update.title}-${update.published_at ?? "undated"}`}>
                        <strong>{update.title}</strong>
                        <div className="muted">{update.is_current ? "Current update" : "Historical update"} · {formatDateTime(update.published_at)}</div>
                        <p>{update.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "gallery" ? (
              <div className="gallery-grid">
                {incident.map_assets.map((asset) => (
                  <div className="gallery-tile" key={`${asset.asset_type}-${asset.title}`}>
                    <div className="gallery-image">{asset.asset_type}</div>
                        <strong>{asset.title}</strong>
                        <div className="muted">{asset.description ?? asset.asset_type}</div>
                        {asset.asset_url ? <a className="table-link" href={asset.asset_url} rel="noreferrer" target="_blank">Open asset</a> : <span className="muted">No external asset URL</span>}
                      </div>
                ))}
              </div>
            ) : null}

            {tab === "maps" ? (
              <div className="template-grid">
                <div className="panel span-two">
                  <div className="panel-title">Map assets</div>
                  <div className="list-card">
                    {incident.map_assets.map((asset) => (
                      <div className="incident-card" key={`${asset.asset_type}-${asset.title}`}>
                        <strong>{asset.title}</strong>
                        <div className="muted">{asset.asset_type}</div>
                        {asset.asset_url ? <a className="table-link" href={asset.asset_url} rel="noreferrer" target="_blank">Open map reference</a> : <span className="muted">Reference tracked without public URL</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-title">Geometry</div>
                  <pre className="json-block">{JSON.stringify({ geometry_reference: incident.geometry_reference, perimeter_reference: incident.perimeter_reference, map_references: incident.map_references }, null, 2)}</pre>
                </div>
              </div>
            ) : null}

            {tab === "discourse" ? (
              <div className="template-grid">
                <div className="panel span-two">
                  <div className="panel-title">Linked discourse</div>
                  <div className="data-table">
                    <div className="data-row data-row-header data-row-four">
                      <span>Actor</span>
                      <span>Platform</span>
                      <span>Excerpt</span>
                      <span>Posted</span>
                    </div>
                    {incident.linked_discourse.map((entry) => (
                      <div className="data-row data-row-four" key={entry.discourse_item_id}>
                        <span>{entry.actor_name ?? "-"}</span>
                        <span>{entry.platform}</span>
                        <span>{entry.body_text ?? entry.link_reason ?? "-"}</span>
                        <span>{formatDateTime(entry.posted_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-title">Environment bindings</div>
                  <div className="list-card">
                    {incident.environment_context.map((context) => (
                      <div className="incident-card" key={`${context.source_key}-${context.title}`}>
                        <strong>{context.title}</strong>
                        <div className="muted">{context.source_key}</div>
                        <p>{context.summary ?? context.context_type}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="prose-box">Loading incident detail...</div>
        )}
      </section>
    </>
  );
}

function DiscoursePage({ incidents }: Pick<AppData, "incidents">) {
  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Discourse</p>
          <h1>Discourse</h1>
          <p className="lede">Discourse remains attached to incident and fire-centre context. This phase keeps the surface subordinate to the incident workspace.</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">Incident-linked discourse targets</div>
        <div className="list-card">
          {incidents.slice(0, 6).map((incident) => (
            <Link className="list-link" key={incident.fire_number} to={`/incidents/${incident.fire_number}`}>
              <div>
                <strong>{incident.wildfire_name}</strong>
                <div className="muted">{incident.fire_number} · {incident.fire_centre}</div>
              </div>
              <span className="chip">Open incident discourse</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function EnvironmentPage({ environment }: Pick<AppData, "environment">) {
  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Environment</p>
          <h1>Environment</h1>
          <p className="lede">Dedicated environment workspace for fire-centre outlooks and current context records landing from BCWS, CWFIS, and GeoMet.</p>
        </div>
      </section>

      <section className="environment-grid">
        <div className="panel">
          <div className="panel-title">Fire centre outlooks</div>
          <div className="outlook-grid">
            {(environment?.outlooks ?? []).map((outlook) => (
              <div className="outlook-card" key={`${outlook.fire_centre}-${outlook.issued_on ?? "undated"}`}>
                <strong>{outlook.fire_centre}</strong>
                <div className="muted">{outlook.valid_window ?? "Forecast window pending"}</div>
                <p>{outlook.summary}</p>
                <div className="muted">{formatDateTime(outlook.issued_on)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Latest condition records</div>
          <div className="data-table">
            <div className="data-row data-row-header data-row-four">
              <span>Source</span>
              <span>Title</span>
              <span>Type</span>
              <span>Region</span>
            </div>
            {(environment?.latest_conditions ?? []).map((condition, index) => (
              <div className="data-row data-row-four" key={`${condition.source_key}-${index}`}>
                <span>{condition.source_key}</span>
                <span>{condition.title}</span>
                <span>{condition.condition_type}</span>
                <span>{condition.region ?? "-"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function MapsPage({ mapsCatalog }: Pick<AppData, "mapsCatalog">) {
  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Maps</p>
          <h1>Maps</h1>
          <p className="lede">Dedicated maps surface for perimeter, downloadable map references, and incident-level map assets.</p>
        </div>
      </section>

      <section className="panel">
        <div className="inline-toolbar">
          <span className="config-tab config-tab-active">Incident maps</span>
          <span className="config-tab">Perimeters</span>
          <span className="config-tab">Restrictions</span>
        </div>
        <div className="gallery-grid">
          {mapsCatalog.map((asset) => (
            <div className="gallery-tile" key={`${asset.fire_number}-${asset.asset_type}-${asset.title}`}>
              <div className="gallery-image">{asset.asset_type}</div>
              <strong>{asset.title}</strong>
              <div className="muted">{asset.wildfire_name} · {asset.fire_number}</div>
              {asset.asset_url ? <a className="table-link" href={asset.asset_url} rel="noreferrer" target="_blank">Open reference</a> : <span className="muted">Reference tracked without public URL</span>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function ConfigurePage() {
  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Configure</p>
          <h1>Configure</h1>
          <p className="lede">Control plane for study scope, sources, linking rules, and operator diagnostics.</p>
        </div>
      </section>

      <section className="configure-layout">
        <div className="inline-toolbar">
          <span className="config-tab config-tab-active">Control plane</span>
          <span className="config-tab">Sources</span>
          <span className="config-tab">Diagnostics</span>
        </div>
        <div className="config-sections">
          {CONFIGURE_COPY.map((section) => (
            <div className="panel" key={section.title}>
              <div className="panel-title">{section.title}</div>
              <div className="prose-box">{section.body}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function WorkstationLayout({ analytics, dashboard, incidents, environment, mapsCatalog, error, running, refresh, triggerConnector }: AppData) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OF</div>
          <div>
            <div className="brand-name">Open Fireside</div>
            <div className="brand-sub">Workstation</div>
          </div>
        </div>

        <nav className="nav" aria-label="Primary">
          {MAIN_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? " nav-item-active" : ""}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-panel">
          <div className="panel-title">Connector posture</div>
          {CONNECTOR_KEYS.map((connectorKey) => (
            <button className="action" disabled={running !== null} key={connectorKey} onClick={() => triggerConnector(connectorKey)} type="button">
              {running === connectorKey ? `Running ${connectorKey}...` : `Run ${connectorKey}`}
            </button>
          ))}
        </div>

        <div className="sidebar-panel">
          <div className="panel-title">Live posture</div>
          <div className="kv-grid">
            <div><strong>Incidents</strong><span>{dashboard?.active_incidents ?? incidents.length}</span></div>
            <div><strong>Conditions</strong><span>{environment?.latest_conditions.length ?? 0}</span></div>
            <div><strong>Connector runs</strong><span>{analytics?.connector_runs ?? 0}</span></div>
            <div><strong>Status</strong><span className="status-pill healthy">Healthy</span></div>
          </div>
          <button className="action ghost" onClick={refresh} type="button">Refresh workspace</button>
        </div>
      </aside>

      <main className="workspace">
        {error ? <div className="alert">{error}</div> : null}
        <Routes>
          <Route path="/dashboard" element={<DashboardPage analytics={analytics} dashboard={dashboard} environment={environment} incidents={incidents} />} />
          <Route path="/incidents" element={<IncidentListPage incidents={incidents} />} />
          <Route path="/incidents/:incidentId" element={<IncidentDetailPage />} />
          <Route path="/discourse" element={<DiscoursePage incidents={incidents} />} />
          <Route path="/environment" element={<EnvironmentPage environment={environment} />} />
          <Route path="/maps" element={<MapsPage mapsCatalog={mapsCatalog} />} />
          <Route path="/configure" element={<ConfigurePage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(null);
  const [dashboard, setDashboard] = useState<DashboardOverview | null>(null);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [environment, setEnvironment] = useState<EnvironmentOverview | null>(null);
  const [mapsCatalog, setMapsCatalog] = useState<MapCatalogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      const [analyticsData, dashboardData, incidentData, environmentData, mapsData] = await Promise.all([
        fetchAnalytics(),
        fetchDashboardOverview(),
        fetchIncidents(),
        fetchEnvironmentOverview(),
        fetchMapsCatalog(),
      ]);
      setAnalytics(analyticsData);
      setDashboard(dashboardData);
      setIncidents(incidentData);
      setEnvironment(environmentData);
      setMapsCatalog(mapsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function triggerConnector(connectorKey: string) {
    try {
      setRunning(connectorKey);
      setError(null);
      await runConnector(connectorKey);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(null);
    }
  }

  return (
    <HashRouter>
      <WorkstationLayout
        analytics={analytics}
        dashboard={dashboard}
        environment={environment}
        error={error}
        incidents={incidents}
        mapsCatalog={mapsCatalog}
        refresh={refresh}
        running={running}
        triggerConnector={triggerConnector}
      />
    </HashRouter>
  );
}
