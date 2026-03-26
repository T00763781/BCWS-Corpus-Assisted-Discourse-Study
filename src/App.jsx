import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import L from 'leaflet';
import React from 'react';
import { desktopApi } from './lib/ipc';
import { bindRouteListener, navigateTo, useRouteStore } from './state/routeStore';

const ROUTES = [
  { id: 'incidents', label: 'Incidents', enabled: true },
  { id: 'configure', label: 'Configure', enabled: true },
  { id: 'dashboard', label: 'Dashboard', enabled: true, status: 'disabled-local' },
  { id: 'maps', label: 'Maps', enabled: true, status: 'disabled-local' },
  { id: 'discourse', label: 'Discourse', enabled: true, status: 'disabled-local' },
  { id: 'weather', label: 'Weather', enabled: true, status: 'disabled-local' },
];

export default function App() {
  const route = useRouteStore((state) => state.route);

  React.useEffect(() => bindRouteListener(), []);

  return (
    <div className="app-shell">
      <aside className="left-rail">
        <div className="brand-title">Open Fireside</div>
        <div className="brand-sub">Windows Local Research Tool</div>
        <nav className="route-nav">
          {ROUTES.map((item) => {
            const active = route.id === item.id || (route.id === 'incident-detail' && item.id === 'incidents');
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${active ? 'is-active' : ''}`}
                onClick={() => navigateTo(`/${item.id}`)}
              >
                <span>{item.label}</span>
                {item.status === 'disabled-local' ? <span className="nav-badge">Disabled</span> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="workspace">
        {route.id === 'incidents' ? <IncidentsPage /> : null}
        {route.id === 'incident-detail' ? (
          <IncidentDetailPage fireYear={route.fireYear} incidentNumber={route.incidentNumber} />
        ) : null}
        {route.id === 'configure' ? <ConfigurePage /> : null}
        {['dashboard', 'maps', 'discourse', 'weather'].includes(route.id) ? <ReviewSurface routeId={route.id} /> : null}
      </main>
    </div>
  );
}

function ReviewSurface({ routeId }) {
  return (
    <section className="disabled-surface">
      <div className="disabled-head">
        <h1>{titleCase(routeId)}</h1>
        <span className="disabled-badge">Visible for review, data disabled</span>
      </div>
      <p>
        This module remains visible to preserve renderer review continuity. Live source/network behavior is disabled until
        local-database ingestion coverage is complete.
      </p>
      {routeId === 'dashboard' ? <DashboardReviewPanel /> : null}
      {routeId === 'maps' ? <MapsReviewPanel /> : null}
      {routeId === 'weather' ? <WeatherReviewPanel /> : null}
      {routeId === 'discourse' ? <DiscourseReviewPanel /> : null}
    </section>
  );
}

function DashboardReviewPanel() {
  return (
    <div className="review-grid">
      <article className="card">
        <h2>Overview Snapshot</h2>
        <div className="kv">Active incidents: pending local aggregate</div>
        <div className="kv">Evacuation orders: pending local aggregate</div>
        <div className="kv">Updated from local snapshots only</div>
      </article>
      <article className="card">
        <h2>Map Preview</h2>
        <div className="module-placeholder">Map rendering disabled until perimeter snapshots are complete.</div>
      </article>
      <article className="card">
        <h2>Pinned Incidents</h2>
        <div className="module-placeholder">Pinned workflow preserved in UI backlog. Local state binding pending.</div>
      </article>
      <article className="card">
        <h2>Discourse Signals</h2>
        <div className="module-placeholder">Discourse ingestion intentionally deferred until incident history spine is stable.</div>
      </article>
    </div>
  );
}

function MapsReviewPanel() {
  return (
    <div className="review-grid">
      <article className="card">
        <h2>Perimeter Layers</h2>
        <div className="module-placeholder">Layer catalog retained. Live remote fetching disabled in renderer.</div>
      </article>
      <article className="card">
        <h2>Incident Focus Map</h2>
        <div className="module-placeholder">Will read from local `incident_perimeters` and cached attachments only.</div>
      </article>
    </div>
  );
}

function WeatherReviewPanel() {
  return (
    <div className="review-grid">
      <article className="card">
        <h2>Weather Workspace</h2>
        <div className="module-placeholder">Route preserved for review. Disabled until local weather ingest design is defined.</div>
      </article>
    </div>
  );
}

function DiscourseReviewPanel() {
  return (
    <div className="review-grid">
      <article className="card">
        <h2>Discourse Workspace</h2>
        <div className="module-placeholder">Route preserved with truthful disabled state. No live discourse ingest in current phase.</div>
      </article>
      <article className="card">
        <h2>Future Attachment Points</h2>
        <div className="kv">Incident links: planned</div>
        <div className="kv">Update links: planned</div>
        <div className="kv">Requires stable incident update history baseline</div>
      </article>
    </div>
  );
}

function IncidentsPage() {
  const [query, setQuery] = React.useState('');
  const incidents = useQuery({
    queryKey: ['incidents', query],
    queryFn: () => desktopApi.incidents.list({ query, limit: 200, sort: 'updated_desc' }),
  });

  return (
    <section className="page">
      <div className="page-header">
        <h1>Incidents</h1>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="input"
          placeholder="Search incident name or number"
        />
      </div>

      {incidents.isLoading ? <div className="muted">Loading local incidents...</div> : null}
      {incidents.error ? <div className="error">{String(incidents.error.message || incidents.error)}</div> : null}

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Number</th>
            <th>Stage</th>
            <th>Size (ha)</th>
            <th>Fire Centre</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {(incidents.data?.rows || []).map((row) => (
            <tr
              key={row.incidentId}
              onClick={() => navigateTo(`/incidents/${row.fireYear}/${encodeURIComponent(row.incidentNumber)}`)}
            >
              <td>{row.incidentName}</td>
              <td>{row.incidentNumber}</td>
              <td>{row.stage || '—'}</td>
              <td>{row.sizeHa ?? '—'}</td>
              <td>{row.fireCentre || '—'}</td>
              <td>{formatDateTime(row.updatedAt)}</td>
            </tr>
          ))}
          {!(incidents.data?.rows || []).length && !incidents.isLoading ? (
            <tr>
              <td colSpan="6" className="muted">No incidents found in local DB.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

function IncidentDetailPage({ fireYear, incidentNumber }) {
  const detail = useQuery({
    queryKey: ['incident', fireYear, incidentNumber],
    queryFn: () => desktopApi.incidents.get({ fireYear: Number(fireYear), incidentNumber }),
  });

  const incidentId = detail.data?.incident?.id;
  const history = useQuery({
    queryKey: ['incident-history', incidentId],
    queryFn: () => desktopApi.incidents.history({ incidentId }),
    enabled: Boolean(incidentId),
  });

  const attachments = useQuery({
    queryKey: ['incident-attachments', incidentId],
    queryFn: () => desktopApi.attachments.list({ incidentId }),
    enabled: Boolean(incidentId),
  });

  const supporting = useQuery({
    queryKey: ['incident-supporting', incidentId],
    queryFn: () => desktopApi.incidents.supporting({ incidentId }),
    enabled: Boolean(incidentId),
  });
  const updateDiff = useQuery({
    queryKey: ['incident-update-diff', incidentId],
    queryFn: () => desktopApi.incidents.updateDiff({ incidentId }),
    enabled: Boolean(incidentId),
  });
  const exportDossier = useMutation({
    mutationFn: (format) => desktopApi.exports.generateIncidentDossier({ incidentId, format }),
  });

  const incident = detail.data?.incident;
  const latestSnapshot = detail.data?.latestSnapshot;
  const updates = history.data?.updates || [];

  return (
    <section className="page">
      <button type="button" className="back" onClick={() => navigateTo('/incidents')}>Back to Incidents</button>
      {detail.isLoading ? <div className="muted">Loading local incident record...</div> : null}
      {detail.error ? <div className="error">{String(detail.error.message || detail.error)}</div> : null}

      {incident ? (
        <>
          <div className="detail-grid">
            <article className="card">
              <h1>{incident.incidentName}</h1>
              <div className="button-row">
                <button type="button" className="button" onClick={() => exportDossier.mutate('json')}>
                  Export JSON dossier
                </button>
                <button type="button" className="button" onClick={() => exportDossier.mutate('markdown')}>
                  Export Markdown dossier
                </button>
              </div>
              {exportDossier.data?.filePath ? (
                <div className="kv">Last export: {exportDossier.data.filePath}</div>
              ) : null}
              <div className="kv">Incident Number: {incident.incidentNumber}</div>
              <div className="kv">Fire Year: {incident.fireYear}</div>
              <div className="kv">Stage: {latestSnapshot?.stageOfControl || '—'}</div>
              <div className="kv">Size (ha): {latestSnapshot?.sizeHa ?? '—'}</div>
              <div className="kv">Discovery Date: {latestSnapshot?.discoveryDate || '—'}</div>
              <div className="kv">Cause: {latestSnapshot?.causeText || '—'}</div>
              <div className="kv">Last Local Snapshot: {formatDateTime(latestSnapshot?.observedAt)}</div>
            </article>
            <article className="card">
              <h2>Local Perimeter</h2>
              <PerimeterMap perimeterRow={supporting.data?.latestPerimeter} />
            </article>
          </div>

          <article className="card">
            <h2>Official Response Updates (Newest First)</h2>
            {history.isLoading ? <div className="muted">Loading local update history...</div> : null}
            {!updates.length && !history.isLoading ? <div className="muted">No stored official updates yet.</div> : null}
            {updates.map((item) => (
              <div key={item.id} className="update">
                <div className="update-meta">
                  Observed: {formatDateTime(item.observedAt)}
                  {item.publishedAt ? ` | Published: ${formatDateTime(item.publishedAt)}` : ''}
                </div>
                <p>{item.updateText}</p>
              </div>
            ))}
          </article>

          <article className="card">
            <h2>Latest Update Diff</h2>
            {updateDiff.isLoading ? <div className="muted">Preparing update diff...</div> : null}
            {!updateDiff.data?.available && !updateDiff.isLoading ? (
              <div className="muted">{updateDiff.data?.reason || 'Diff not available yet.'}</div>
            ) : null}
            {updateDiff.data?.available ? (
              <div className="detail-grid">
                <div>
                  <h3>Added</h3>
                  {(updateDiff.data.addedLines || []).length ? (
                    <ul>
                      {(updateDiff.data.addedLines || []).map((line, idx) => <li key={`a-${idx}`}>{line}</li>)}
                    </ul>
                  ) : (
                    <div className="muted">No added lines.</div>
                  )}
                </div>
                <div>
                  <h3>Removed</h3>
                  {(updateDiff.data.removedLines || []).length ? (
                    <ul>
                      {(updateDiff.data.removedLines || []).map((line, idx) => <li key={`r-${idx}`}>{line}</li>)}
                    </ul>
                  ) : (
                    <div className="muted">No removed lines.</div>
                  )}
                </div>
              </div>
            ) : null}
          </article>

          <div className="detail-grid">
            <article className="card">
              <h2>Attachments</h2>
              {(attachments.data || []).length ? (
                <ul>
                  {(attachments.data || []).map((asset) => (
                    <li key={asset.id}>{asset.title}</li>
                  ))}
                </ul>
              ) : (
                <div className="muted">No local attachment records yet.</div>
              )}
            </article>

            <article className="card">
              <h2>External Links</h2>
              {(supporting.data?.externalLinks || []).length ? (
                <ul>
                  {(supporting.data.externalLinks || []).map((link) => (
                    <li key={link.id}>{link.label || link.url}</li>
                  ))}
                </ul>
              ) : (
                <div className="muted">No local external links yet.</div>
              )}
            </article>
          </div>

          <div className="detail-grid">
            <article className="card">
              <h2>Evacuation Notices</h2>
              {(supporting.data?.evacuation || []).length ? (
                <ul>
                  {(supporting.data.evacuation || []).map((notice) => (
                    <li key={notice.id}>
                      {notice.noticeType || 'notice'}: {notice.eventName || 'Unnamed'} ({notice.status || 'unknown'})
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="muted">No local evacuation notices for this incident.</div>
              )}
            </article>

            <article className="card">
              <h2>Provenance</h2>
              <div className="kv">Last ingested: {formatDateTime(supporting.data?.provenance?.lastIngestAt)}</div>
              <div className="kv">Raw records: {supporting.data?.provenance?.rawSourceCount ?? 0}</div>
              <div className="kv">Parser warnings: {supporting.data?.provenance?.warningCount ?? 0}</div>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}

function PerimeterMap({ perimeterRow }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const geoLayerRef = React.useRef(null);

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([54.4, -125.4], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    geoLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (!mapRef.current || !geoLayerRef.current) return;
    geoLayerRef.current.clearLayers();

    if (!perimeterRow?.geometryGeojson) return;

    try {
      const geojson = JSON.parse(perimeterRow.geometryGeojson);
      const layer = L.geoJSON(geojson, {
        style: { color: '#d9381e', weight: 2, fillOpacity: 0.12 },
      }).addTo(geoLayerRef.current);
      mapRef.current.fitBounds(layer.getBounds(), { padding: [12, 12], maxZoom: 10 });
    } catch {
      // Invalid GeoJSON should not break detail rendering.
    }
  }, [perimeterRow]);

  return <div className="perimeter-map" ref={containerRef} />;
}

function ConfigurePage() {
  const queryClient = useQueryClient();
  const paths = useQuery({
    queryKey: ['settings-paths'],
    queryFn: () => desktopApi.settings.getPaths(),
  });
  const syncStatus = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => desktopApi.sync.status({}),
    refetchInterval: 3000,
  });
  const diagnostics = useQuery({
    queryKey: ['ingest-diagnostics'],
    queryFn: () => desktopApi.ingest.diagnostics(),
    refetchInterval: 5000,
  });
  const runs = useQuery({
    queryKey: ['ingest-runs'],
    queryFn: () => desktopApi.ingest.listRuns({ limit: 20 }),
    refetchInterval: 5000,
  });
  const [rawFilterStatus, setRawFilterStatus] = React.useState('');
  const [rawFilterRunId, setRawFilterRunId] = React.useState('');
  const [selectedRawRecordId, setSelectedRawRecordId] = React.useState('');
  const rawRecords = useQuery({
    queryKey: ['raw-records', rawFilterStatus, rawFilterRunId],
    queryFn: () =>
      desktopApi.ingest.listRawRecords({
        parseStatus: rawFilterStatus || null,
        runId: rawFilterRunId || null,
        limit: 50,
        offset: 0,
      }),
    refetchInterval: 5000,
  });
  const rawRecordDetail = useQuery({
    queryKey: ['raw-record-detail', selectedRawRecordId],
    queryFn: () => desktopApi.ingest.getRawRecord({ id: selectedRawRecordId }),
    enabled: Boolean(selectedRawRecordId),
  });
  const ingestConfig = useQuery({
    queryKey: ['settings-ingest-config'],
    queryFn: () => desktopApi.settings.getIngestConfig(),
  });

  const [dbPathInput, setDbPathInput] = React.useState('');
  const [storagePathInput, setStoragePathInput] = React.useState('');
  const [detailTargetLimitInput, setDetailTargetLimitInput] = React.useState('150');
  const [fallbackBudgetInput, setFallbackBudgetInput] = React.useState('5');

  React.useEffect(() => {
    if (paths.data?.dbPath) setDbPathInput(paths.data.dbPath);
    if (paths.data?.storageRoot) setStoragePathInput(paths.data.storageRoot);
  }, [paths.data]);
  React.useEffect(() => {
    if (ingestConfig.data?.detailTargetLimit !== undefined) {
      setDetailTargetLimitInput(String(ingestConfig.data.detailTargetLimit));
    }
    if (ingestConfig.data?.playwrightFallbackBudget !== undefined) {
      setFallbackBudgetInput(String(ingestConfig.data.playwrightFallbackBudget));
    }
  }, [ingestConfig.data]);

  const setDbPath = useMutation({
    mutationFn: (newPath) => desktopApi.settings.setDatabasePath({ newPath, strategy: 'copy_then_switch' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-paths'] }),
  });

  const setStorageRoot = useMutation({
    mutationFn: (newPath) => desktopApi.settings.setStorageRoot({ newPath, strategy: 'copy_then_switch' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-paths'] }),
  });

  const runSync = useMutation({
    mutationFn: (scope) => desktopApi.sync.run({ mode: 'manual', scope }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['ingest-diagnostics'] });
    },
  });
  const setIngestConfig = useMutation({
    mutationFn: (payload) => desktopApi.settings.setIngestConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-ingest-config'] });
    },
  });

  return (
    <section className="page">
      <h1>Configure</h1>
      <p className="muted">Operational control center for local database, local storage, and ingestion controls.</p>

      <div className="detail-grid">
        <article className="card">
          <h2>Database Path</h2>
          <div className="muted">Current: {paths.data?.dbPath || 'Loading...'}</div>
          <input className="input" value={dbPathInput} onChange={(event) => setDbPathInput(event.target.value)} />
          <button type="button" className="button" onClick={() => setDbPath.mutate(dbPathInput)}>
            Copy then switch DB
          </button>
          {setDbPath.error ? <div className="error">{String(setDbPath.error.message || setDbPath.error)}</div> : null}
        </article>

        <article className="card">
          <h2>Storage Root</h2>
          <div className="muted">Current: {paths.data?.storageRoot || 'Loading...'}</div>
          <input className="input" value={storagePathInput} onChange={(event) => setStoragePathInput(event.target.value)} />
          <button type="button" className="button" onClick={() => setStorageRoot.mutate(storagePathInput)}>
            Copy then switch storage
          </button>
          {setStorageRoot.error ? <div className="error">{String(setStorageRoot.error.message || setStorageRoot.error)}</div> : null}
        </article>
      </div>

      <article className="card">
        <h2>Ingest Configuration</h2>
        <div className="kv">Detail target limit</div>
        <input
          className="input"
          value={detailTargetLimitInput}
          onChange={(event) => setDetailTargetLimitInput(event.target.value)}
        />
        <div className="kv">Playwright fallback budget</div>
        <input
          className="input"
          value={fallbackBudgetInput}
          onChange={(event) => setFallbackBudgetInput(event.target.value)}
        />
        <button
          type="button"
          className="button"
          onClick={() =>
            setIngestConfig.mutate({
              detailTargetLimit: Number(detailTargetLimitInput),
              playwrightFallbackBudget: Number(fallbackBudgetInput),
            })
          }
        >
          Save ingest config
        </button>
      </article>

      <article className="card">
        <h2>Sync Controls</h2>
        <div className="button-row">
          <button type="button" className="button" onClick={() => runSync.mutate('list')}>Run list sync</button>
          <button type="button" className="button" onClick={() => runSync.mutate('detail')}>Run detail sync</button>
          <button type="button" className="button" onClick={() => runSync.mutate('full')}>Run full sync</button>
        </div>
        <div className="kv">Current Run: {syncStatus.data?.currentRun?.runId || '—'}</div>
        <div className="kv">Last Run ID: {syncStatus.data?.lastRun?.runId || '—'}</div>
        <div className="kv">Last Run Status: {syncStatus.data?.lastRun?.status || '—'}</div>
        <div className="kv">Last Run At: {formatDateTime(syncStatus.data?.lastRun?.startedAt)}</div>
        {syncStatus.data?.lastRun?.summary ? (
          <pre className="sync-summary">{JSON.stringify(syncStatus.data.lastRun.summary, null, 2)}</pre>
        ) : null}
        {syncStatus.data?.lastRun?.error ? <div className="error">{syncStatus.data.lastRun.error}</div> : null}
      </article>

      <article className="card">
        <h2>Ingestion Diagnostics</h2>
        <div className="kv">Parser warnings: {diagnostics.data?.parseWarnings ?? 0}</div>
        <div className="kv">Parser errors: {diagnostics.data?.parseErrors ?? 0}</div>
        <div className="kv">Recent runs: {(diagnostics.data?.lastRuns || []).length}</div>
        <h3>Recent Runs</h3>
        {(runs.data || []).length ? (
          <ul>
            {(runs.data || []).map((run) => (
              <li key={run.id}>
                {run.id} | {run.status} | {formatDateTime(run.startedAt)}
              </li>
            ))}
          </ul>
        ) : (
          <div className="muted">No run history available.</div>
        )}
        <h3>Raw Source Records</h3>
        <div className="button-row">
          <input
            className="input"
            placeholder="Filter parse status (e.g. warning)"
            value={rawFilterStatus}
            onChange={(event) => setRawFilterStatus(event.target.value)}
          />
          <input
            className="input"
            placeholder="Filter by run id fragment"
            value={rawFilterRunId}
            onChange={(event) => setRawFilterRunId(event.target.value)}
          />
        </div>
        {(rawRecords.data?.rows || []).length ? (
          <ul>
            {(rawRecords.data?.rows || []).map((row) => (
              <li key={row.id}>
                <button type="button" className="button" onClick={() => setSelectedRawRecordId(row.id)}>
                  {row.sourceKind} | {row.parseStatus || 'n/a'} | {formatDateTime(row.fetchedAt)}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="muted">No raw records found for current filters.</div>
        )}
        {rawRecordDetail.data ? (
          <pre className="sync-summary">{JSON.stringify(rawRecordDetail.data, null, 2)}</pre>
        ) : null}
      </article>
    </section>
  );
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function titleCase(value) {
  return String(value || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
