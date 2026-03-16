import { useEffect, useState } from "react";
import { fetchAnalytics, fetchConditions, runConnector, type AnalyticsSnapshot, type ConditionSummary } from "./lib/api";
import { KpiCard } from "./components/KpiCard";

const CONNECTOR_KEYS = ["bcws.catalog", "cwfis.summary", "geomet.weather", "social.seed"];

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

  async function run(connectorKey: string) {
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
    <div className="shell">
      <aside className="sidebar">
        <h1>Open Fireside</h1>
        <p className="muted">Local-first wildfire discourse workstation</p>
        <nav>
          <a href="#conditions">Live Conditions</a>
          <a href="#feed">Discourse Feed</a>
          <a href="#actors">Actors</a>
          <a href="#claims">Claims</a>
          <a href="#analysis">Analysis</a>
        </nav>
        <div className="card">
          <div className="card-header">Connector Control</div>
          {CONNECTOR_KEYS.map((connectorKey) => (
            <button key={connectorKey} className="button" onClick={() => run(connectorKey)} disabled={running !== null}>
              {running === connectorKey ? `Running ${connectorKey}...` : `Run ${connectorKey}`}
            </button>
          ))}
        </div>
      </aside>
      <main className="content">
        <header className="hero">
          <div>
            <h2>BC wildfire discourse and conditions</h2>
            <p className="muted">One surface for environment signals, discourse, actor mapping, and diagnostics.</p>
          </div>
          <button className="button secondary" onClick={refresh}>Refresh</button>
        </header>
        {error ? <div className="alert">{error}</div> : null}
        <section className="grid">
          <KpiCard title="Connector Runs" value={analytics?.connector_runs ?? 0} note="Successful and failed run records" />
          <KpiCard title="Condition Snapshots" value={analytics?.condition_snapshots ?? 0} note="Environment and GIS observations" />
          <KpiCard title="Discourse Items" value={analytics?.discourse_items ?? 0} note="Unified cross-source discourse records" />
          <KpiCard title="Actors / Claims" value={`${analytics?.actors ?? 0} / ${analytics?.claims ?? 0}`} note="Tracked discourse entities" />
        </section>

        <section id="conditions" className="panel">
          <h3>Live Conditions</h3>
          <div className="table">
            <div className="table-row table-header-row">
              <div>Source</div>
              <div>Title</div>
              <div>Type</div>
              <div>Region</div>
            </div>
            {conditions.map((condition, index) => (
              <div className="table-row" key={`${condition.source_key}-${index}`}>
                <div>{condition.source_key}</div>
                <div>{condition.title}</div>
                <div>{condition.condition_type}</div>
                <div>{condition.region ?? "-"}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="feed" className="panel split">
          <div className="card">
            <div className="card-header">Discourse Feed</div>
            <p className="muted">Unified feed view lands here once live social connectors are active.</p>
            <ul>
              <li>Cross-platform filtering</li>
              <li>Screenshot and media attachment surfaces</li>
              <li>Reply / repost / quote chain inspection</li>
            </ul>
          </div>
          <div className="card">
            <div className="card-header">Current research posture</div>
            <ul>
              <li>Trust modeled as observed behavior, not analyst priors</li>
              <li>Claims separated cleanly from actors and incident conditions</li>
              <li>Environment timeline aligned against discourse bursts</li>
            </ul>
          </div>
        </section>

        <section id="analysis" className="panel split">
          <div className="card">
            <div className="card-header">Analysis runway</div>
            <ul>
              <li>Bridge-actor detection</li>
              <li>Information-gap markers</li>
              <li>Claim spread timelines</li>
              <li>Map and network views</li>
            </ul>
          </div>
          <div className="card">
            <div className="card-header">Diagnostics</div>
            <p className="muted">Bootstrap, runtime, and environment diagnostics are emitted into <code>.diagnostics/latest</code>.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
