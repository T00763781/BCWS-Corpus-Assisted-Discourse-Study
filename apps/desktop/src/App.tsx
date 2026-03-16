import { useEffect, useState } from "react";
import { HashRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { fetchAnalytics, fetchConditions, runConnector, type AnalyticsSnapshot, type ConditionSummary } from "./lib/api";
import { KpiCard } from "./components/KpiCard";

const CONNECTOR_KEYS = ["bcws.catalog", "cwfis.summary", "geomet.weather", "social.seed"];
const FIRE_CENTRES = ["Cariboo", "Coastal", "Kamloops", "Northwest", "Prince George", "Southeast"];
const MAIN_NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/incidents", label: "Incidents" },
  { to: "/discourse", label: "Discourse" },
  { to: "/environment", label: "Environment" },
  { to: "/maps", label: "Maps" },
  { to: "/configure", label: "Configure" },
];

type AppData = {
  analytics: AnalyticsSnapshot | null;
  conditions: ConditionSummary[];
  error: string | null;
  running: string | null;
  refresh: () => Promise<void>;
  triggerConnector: (connectorKey: string) => Promise<void>;
};

function summarizeConditions(conditions: ConditionSummary[]) {
  return {
    evacuations: conditions.filter((condition) => condition.condition_type.includes("evac")).length,
    restrictions: conditions.filter((condition) => condition.condition_type.includes("restriction")).length,
    weather: conditions.filter((condition) => ["weather_station", "forecast"].includes(condition.condition_type)).length,
    hotspots: conditions.filter((condition) => condition.condition_type === "hotspots").length,
  };
}

function DashboardPage({ analytics, conditions, error }: Pick<AppData, "analytics" | "conditions" | "error">) {
  const summary = summarizeConditions(conditions);

  return (
    <>
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Wildfire Overview</p>
          <h1>Dashboard</h1>
          <p className="lede">Operational overview aligned to the fire-centre, incident, and environment spine in the approved mockup direction.</p>
        </div>
        <div className="hero-aside">
          <div className="status-pill">Incident/environment phase</div>
          <div className="hero-note">BCWS, CWFIS, and GeoMet signals continue to hydrate the local workstation dataset.</div>
        </div>
      </section>

      {error ? <div className="alert">{error}</div> : null}

      <section className="kpi-grid">
        <KpiCard title="Active Wildfire Signals" value={analytics?.condition_snapshots ?? 0} note="Incident and environment records currently available" />
        <KpiCard title="Connector Runs" value={analytics?.connector_runs ?? 0} note="Successful and failed workstation connector runs" />
        <KpiCard title="Discourse Items" value={analytics?.discourse_items ?? 0} note="Signals ready to attach to incident or fire-centre scope" />
        <KpiCard title="Actors / Claims" value={`${analytics?.actors ?? 0} / ${analytics?.claims ?? 0}`} note="Discourse entities currently attached to the local graph" />
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Fire Centre Summary</p>
              <h2>Wildfire overview</h2>
            </div>
          </div>
          <div className="centre-summary-grid">
            {FIRE_CENTRES.map((centre) => (
              <div key={centre} className="centre-tile">
                <span>{centre}</span>
                <strong>{centre === "Prince George" ? Math.max(1, Math.min(conditions.length, 11)) : 0}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Operational flags</p>
              <h2>Response posture</h2>
            </div>
          </div>
          <div className="metric-list">
            <div className="metric-row"><span>Evacuation orders</span><strong>{summary.evacuations}</strong></div>
            <div className="metric-row"><span>Area restrictions</span><strong>{summary.restrictions}</strong></div>
            <div className="metric-row"><span>Weather overlays</span><strong>{summary.weather}</strong></div>
            <div className="metric-row"><span>Hotspot layers</span><strong>{summary.hotspots}</strong></div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Latest environment rows</p>
            <h2>Incoming BCWS and environment feed</h2>
          </div>
        </div>
        <div className="data-table">
          <div className="data-row data-row-header">
            <span>Source</span>
            <span>Title</span>
            <span>Type</span>
            <span>Region</span>
          </div>
          {conditions.slice(0, 8).map((condition, index) => (
            <div className="data-row" key={`${condition.source_key}-${index}`}>
              <span>{condition.source_key}</span>
              <span>{condition.title}</span>
              <span>{condition.condition_type}</span>
              <span>{condition.region ?? "-"}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function IncidentsPage() {
  return (
    <section className="page-shell">
      <p className="eyebrow">Incident workspace</p>
      <h1>Incidents</h1>
      <p className="lede">This route now exists as a dedicated surface and will be filled by the incident domain API in the next slice.</p>
      <div className="placeholder-grid">
        <div className="panel">
          <h2>Incident list</h2>
          <p className="muted">Search, sort, and filter controls will land here with the normalized BCWS incident catalog.</p>
        </div>
        <div className="panel">
          <h2>Incident detail workspace</h2>
          <p className="muted">Response, Gallery, Maps, and Discourse tabs will render once the incident spine is in place.</p>
        </div>
      </div>
    </section>
  );
}

function EnvironmentPage({ conditions }: Pick<AppData, "conditions">) {
  return (
    <section className="page-shell">
      <p className="eyebrow">Environment</p>
      <h1>Environment</h1>
      <p className="lede">Dedicated environment route for fire-centre weather, hotspot, restriction, and perimeter context.</p>
      <div className="data-table">
        <div className="data-row data-row-header">
          <span>Source</span>
          <span>Layer</span>
          <span>Type</span>
          <span>Region</span>
        </div>
        {conditions.map((condition, index) => (
          <div className="data-row" key={`${condition.source_key}-${index}`}>
            <span>{condition.source_key}</span>
            <span>{condition.title}</span>
            <span>{condition.condition_type}</span>
            <span>{condition.region ?? "-"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DiscoursePage({ analytics }: Pick<AppData, "analytics">) {
  return (
    <section className="page-shell">
      <p className="eyebrow">Discourse</p>
      <h1>Discourse</h1>
      <p className="lede">Discourse remains secondary in this phase and will attach to incident and fire-centre context instead of driving the workstation IA.</p>
      <div className="panel">
        <div className="metric-row"><span>Current discourse items</span><strong>{analytics?.discourse_items ?? 0}</strong></div>
        <div className="metric-row"><span>Tracked actors</span><strong>{analytics?.actors ?? 0}</strong></div>
        <div className="metric-row"><span>Tracked claims</span><strong>{analytics?.claims ?? 0}</strong></div>
      </div>
    </section>
  );
}

function MapsPage() {
  return (
    <section className="page-shell">
      <p className="eyebrow">Maps</p>
      <h1>Maps</h1>
      <p className="lede">Route-level maps surface reserved for perimeter, evacuation, area-restriction, and downloadable incident map layers.</p>
      <div className="map-shell">
        <div className="map-card">Map 1</div>
        <div className="map-card">Map 2</div>
        <div className="map-card">Map 3</div>
        <div className="map-card">Map 4</div>
      </div>
    </section>
  );
}

function ConfigurePage() {
  return (
    <section className="page-shell">
      <p className="eyebrow">Configure</p>
      <h1>Configure</h1>
      <p className="lede">Connector and operator controls stay explicit instead of hiding behind a generic settings page.</p>
      <div className="panel">
        <h2>Workstation configuration</h2>
        <p className="muted">Connector orchestration, source credentials, and diagnostics controls remain local-first and operator-owned.</p>
      </div>
    </section>
  );
}

function WorkstationLayout({ analytics, conditions, error, running, refresh, triggerConnector }: AppData) {
  return (
    <div className="workstation">
      <aside className="workstation-sidebar">
        <div className="brand-block">
          <div className="brand-mark">OF</div>
          <div>
            <p className="eyebrow">Open Fireside</p>
            <h2>Workstation</h2>
          </div>
        </div>

        <nav className="main-nav" aria-label="Primary">
          {MAIN_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-panel">
          <p className="eyebrow">Connector Control</p>
          {CONNECTOR_KEYS.map((connectorKey) => (
            <button key={connectorKey} className="button" onClick={() => triggerConnector(connectorKey)} disabled={running !== null}>
              {running === connectorKey ? `Running ${connectorKey}...` : `Run ${connectorKey}`}
            </button>
          ))}
        </div>

        <div className="sidebar-panel">
          <p className="eyebrow">Data posture</p>
          <div className="metric-row"><span>Connector runs</span><strong>{analytics?.connector_runs ?? 0}</strong></div>
          <div className="metric-row"><span>Condition rows</span><strong>{conditions.length}</strong></div>
        </div>
      </aside>

      <main className="workstation-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Incident and environment spine</p>
            <h1>Open Fireside</h1>
          </div>
          <div className="topbar-actions">
            <div className="status-pill">Runtime healthy</div>
            <button className="button button-compact secondary" onClick={refresh}>Refresh</button>
          </div>
        </header>

        {error ? <div className="alert">{error}</div> : null}

        <Routes>
          <Route path="/dashboard" element={<DashboardPage analytics={analytics} conditions={conditions} error={error} />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/discourse" element={<DiscoursePage analytics={analytics} />} />
          <Route path="/environment" element={<EnvironmentPage conditions={conditions} />} />
          <Route path="/maps" element={<MapsPage />} />
          <Route path="/configure" element={<ConfigurePage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(null);
  const [conditions, setConditions] = useState<ConditionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      const [analyticsData, conditionData] = await Promise.all([fetchAnalytics(), fetchConditions()]);
      setAnalytics(analyticsData);
      setConditions(conditionData);
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
        conditions={conditions}
        error={error}
        running={running}
        refresh={refresh}
        triggerConnector={triggerConnector}
      />
    </HashRouter>
  );
}
