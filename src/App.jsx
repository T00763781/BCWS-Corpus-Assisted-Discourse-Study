import React from 'react';
import L from 'leaflet';
import brandLogo from '../assets/logo.svg';
import {
  DASHBOARD_FIRE_YEAR,
  FIRE_CENTRES,
  STAGE_DEFS,
  fetchDashboardData,
  fetchIncidentDetail,
  fetchIncidentList,
  formatDate,
  formatDateTime,
  stageLabel,
} from './bcwsApi.js';

const ROUTES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'weather', label: 'Weather' },
  { id: 'discourse', label: 'Discourse' },
  { id: 'maps', label: 'Maps' },
  { id: 'configure', label: 'Settings' },
];

const BRAND_LOGO = brandLogo;
const STAGE_ORDER = ['OUT_CNTRL', 'HOLDING', 'UNDR_CNTRL', 'OUT'];
const HEALTH = {
  healthy: 'Healthy',
  error: 'Error',
  no_db: 'No DB',
  not_wired: 'Not wired',
  browser_fallback: 'Browser fallback',
  never_captured: 'Never captured',
  capture_running: 'Capture running',
  backfill_due: 'Backfill due',
};

function parseHashRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) return { id: 'dashboard' };
  const parts = hash.split('/').filter(Boolean);
  if (parts[0] === 'incidents' && parts.length >= 3) {
    return { id: 'incident-detail', fireYear: parts[1], incidentNumber: decodeURIComponent(parts[2]) };
  }
  const known = ROUTES.find((route) => route.id === parts[0]);
  return known ? { id: known.id } : { id: 'dashboard' };
}

function useHashRoute() {
  const [route, setRoute] = React.useState(parseHashRoute);
  React.useEffect(() => {
    const onChange = () => setRoute(parseHashRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

function navigateTo(next) {
  window.location.hash = next.startsWith('#') ? next.slice(1) : next;
}

function hashText(value) {
  let hash = 0;
  const input = String(value || '');
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function incidentStorageKey(fireYear, incidentNumber) {
  return `open-fireside:incident:${fireYear}:${incidentNumber}`;
}

function readIncidentCapture(fireYear, incidentNumber) {
  try {
    const raw = window.localStorage.getItem(incidentStorageKey(fireYear, incidentNumber));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistIncidentCapture(fireYear, incidentNumber, detailData) {
  const incident = detailData?.incident || {};
  const responseUpdates = detailData?.response?.responseUpdates || [];
  const previous = readIncidentCapture(fireYear, incidentNumber) || {
    incidentKey: { fireYear, incidentNumber },
    updates: [],
    captures: [],
    attachments: [],
    lastCapturedAt: null,
  };

  const nextUpdates = [...previous.updates];
  responseUpdates.forEach((text) => {
    const normalized = String(text || '').trim();
    if (!normalized) return;
    const updateHash = hashText(normalized);
    if (!nextUpdates.find((entry) => entry.updateHash === updateHash)) {
      nextUpdates.push({
        updateHash,
        text: normalized,
        capturedAt: new Date().toISOString(),
        updatedDate: incident.updatedDate || null,
      });
    }
  });

  nextUpdates.sort((a, b) => new Date(b.updatedDate || b.capturedAt) - new Date(a.updatedDate || a.capturedAt));

  const nextRecord = {
    incidentKey: { fireYear, incidentNumber },
    lastCapturedAt: new Date().toISOString(),
    latestIncident: {
      incidentName: incident.incidentName || incidentNumber,
      incidentNumber: incident.incidentNumber || incidentNumber,
      fireCentre: incident.fireCentre || '',
      stage: incident.stage || '',
      sizeHa: incident.sizeHa || null,
      discoveryDate: incident.discoveryDate || null,
      updatedDate: incident.updatedDate || null,
      causeDetail: incident.causeDetail || '',
    },
    captures: [
      {
        capturedAt: new Date().toISOString(),
        attachmentCount: (detailData?.attachments || []).length,
        updateCount: responseUpdates.length,
      },
      ...(previous.captures || []),
    ].slice(0, 20),
    attachments: (detailData?.attachments || []).map((asset) => ({
      attachmentGuid: asset.attachmentGuid,
      title: asset.title,
      imageUrl: asset.imageUrl || '',
      uploadedTimestamp: asset.uploadedTimestamp || null,
    })),
    updates: nextUpdates,
  };

  try {
    window.localStorage.setItem(incidentStorageKey(fireYear, incidentNumber), JSON.stringify(nextRecord));
  } catch {
    // ignore quota/storage errors for now
  }
  return nextRecord;
}

function readAllIncidentCaptures() {
  const records = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('open-fireside:incident:')) {
        const raw = window.localStorage.getItem(key);
        if (raw) records.push(JSON.parse(raw));
      }
    }
  } catch {
    return [];
  }
  return records.sort((a, b) => new Date(b.lastCapturedAt || 0) - new Date(a.lastCapturedAt || 0));
}

function usePipelineStatus() {
  const [status, setStatus] = React.useState({
    incident: { state: 'never_captured', lastRun: null },
    weather: { state: 'not_wired', lastRun: null },
    discourse: { state: 'not_wired', lastRun: null },
    fetchAll: { state: 'browser_fallback', lastRun: null },
  });

  const mark = React.useCallback((key, state) => {
    setStatus((current) => ({
      ...current,
      [key]: {
        state,
        lastRun: state === 'loading' ? current[key].lastRun : new Date().toISOString(),
      },
    }));
  }, []);

  return { status, mark };
}

function pipelineLabel(state) {
  return HEALTH[state] || HEALTH.not_wired;
}

function PageTopBar({ title, pipelineStatus, onTrigger }) {
  const buttons = [
    { id: 'incident', label: 'Incident' },
    { id: 'weather', label: 'Weather' },
    { id: 'discourse', label: 'Discourse' },
    { id: 'fetchAll', label: 'Fetch All' },
  ];
  return (
    <div className="page-topbar">
      <div className="page-topbar__title">{title}</div>
      <div className="page-topbar__actions">
        {buttons.map((button) => (
          <button
            key={button.id}
            type="button"
            className={`topbar-action is-${pipelineStatus[button.id]?.state || 'idle'}`}
            onClick={() => onTrigger(button.id)}
          >
            <span>{button.label}</span>
            <strong>{pipelineLabel(pipelineStatus[button.id]?.state)}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  const [configureTab, setConfigureTab] = React.useState('system');
  const { status, mark } = usePipelineStatus();

  const triggerPipeline = React.useCallback(async (id) => {
    mark(id, 'capture_running');
    if (id === 'weather' || id === 'discourse') {
      window.setTimeout(() => mark(id, 'not_wired'), 500);
      return;
    }
    if (id === 'fetchAll') {
      window.setTimeout(() => mark(id, 'browser_fallback'), 600);
      return;
    }
    window.setTimeout(() => mark(id, 'healthy'), 400);
  }, [mark]);

  return (
    <div className="app-shell">
      <main className="shell-frame">
        <aside className="left-rail">
          <div className="brand-block">
            <img src={BRAND_LOGO} alt="Open Fireside" className="brand-logo" />
          </div>
          <nav className="route-nav" aria-label="Primary navigation">
            {ROUTES.map((item) => {
              const active = route.id === item.id || (route.id === 'incident-detail' && item.id === 'incidents');
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item ${active ? 'is-active' : ''}`}
                  onClick={() => navigateTo(`/${item.id}`)}
                >
                  <span className="nav-marker" aria-hidden="true" />
                  <span className="nav-label">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="workspace">
          {route.id === 'dashboard' ? <DashboardPage pipelineStatus={status} onTriggerPipeline={triggerPipeline} /> : null}
          {route.id === 'incidents' ? <IncidentsListPage pipelineStatus={status} onTriggerPipeline={triggerPipeline} /> : null}
          {route.id === 'incident-detail' ? (
            <IncidentDetailPage
              fireYear={route.fireYear}
              incidentNumber={route.incidentNumber}
              pipelineStatus={status}
              onTriggerPipeline={triggerPipeline}
            />
          ) : null}
          {route.id === 'weather' ? <WeatherPage pipelineStatus={status} onTriggerPipeline={triggerPipeline} /> : null}
          {route.id === 'maps' ? <MapsPage pipelineStatus={status} onTriggerPipeline={triggerPipeline} /> : null}
          {route.id === 'discourse' ? <DiscoursePage pipelineStatus={status} onTriggerPipeline={triggerPipeline} /> : null}
          {route.id === 'configure' ? (
            <ConfigurePage
              configureTab={configureTab}
              setConfigureTab={setConfigureTab}
              pipelineStatus={status}
              onTriggerPipeline={triggerPipeline}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}

function DashboardPage({ pipelineStatus, onTriggerPipeline }) {
  const [state, setState] = React.useState({ phase: 'loading', error: '', data: null });

  const load = React.useCallback(async () => {
    setState({ phase: 'loading', error: '', data: null });
    try {
      const data = await fetchDashboardData();
      setState({ phase: 'success', error: '', data });
    } catch (error) {
      setState({ phase: 'failure', error: error.message || 'Failed to load dashboard', data: null });
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const stats = state.data?.stats;
  const activeCount = stats
    ? (stats.activeOutOfControlFires || 0) + (stats.activeBeingHeldFires || 0) + (stats.activeUnderControlFires || 0)
    : null;

  return (
    <div className="page-layout dashboard-page">
      <PageTopBar title="Dashboard" pipelineStatus={pipelineStatus} onTrigger={onTriggerPipeline} />
      {state.phase === 'failure' ? <div className="error-banner">{state.error}</div> : null}
      <div className="dashboard-header-card">
        <div>
          <div className="dashboard-kicker">Fire year {state.data?.fireYear ?? DASHBOARD_FIRE_YEAR}</div>
        </div>
        <button type="button" className="refresh-chip" onClick={load}>Refresh</button>
      </div>
      <div className="dashboard-grid">
        <section className="dashboard-main-card dashboard-grid__map">
          <div className="card-title-row">
            <div className="card-title">Wildfire Overview</div>
            <div className="dashboard-updated">{stats?.updateDate ? `Updated ${formatDateTime(stats.updateDate)}` : ''}</div>
          </div>
          <div className="stage-legend is-inline">
            {['FIRE_OF_NOTE', 'UNDR_CNTRL', 'HOLDING', 'OUT_CNTRL'].map((code) => (
              <div key={code} className="legend-item">
                <span className="legend-dot" style={{ background: STAGE_DEFS[code]?.color }} />
                <span>{stageLabel(code)}</span>
              </div>
            ))}
          </div>
          <DashboardMap mapLayers={state.data?.mapLayers} />
        </section>
        <div className="dashboard-overview-stack dashboard-grid__overview">
          <div className="metrics-card-grid is-four">
            <MetricCard label="Active" value={displayValue(activeCount)} />
            <MetricCard label="New in 24" value={displayValue(stats?.newFires24Hours)} />
            <MetricCard label="Out in 24" value={displayValue(stats?.outFires24Hours)} />
            <MetricCard label="Out in 7" value={displayValue(stats?.outFires7Days)} />
          </div>
          <StageControlPanel stats={stats} />
          <FireCentreTable statsList={state.data?.fireCentreStats || []} />
        </div>
        <StubPanel title="Discourse Signals" className="dashboard-discourse dashboard-grid__discourse" />
        <StubPanel title="Pinned Incidents" className="dashboard-pinned dashboard-grid__pinned" />
      </div>
    </div>
  );
}

function IncidentsListPage({ pipelineStatus, onTriggerPipeline }) {
  const [search, setSearch] = React.useState('');
  const [fireCentre, setFireCentre] = React.useState('');
  const [selectedStages, setSelectedStages] = React.useState(STAGE_ORDER);
  const [sortState, setSortState] = React.useState({ key: 'updatedDate', direction: 'desc' });
  const [state, setState] = React.useState({ phase: 'loading', error: '', rows: [] });

  const load = React.useCallback(async () => {
    setState((current) => ({ ...current, phase: 'loading', error: '' }));
    try {
      const data = await fetchIncidentList({ search, fireCentre, stageCodes: selectedStages, pageRowCount: 500 });
      setState({ phase: 'success', error: '', rows: data.rows || [] });
    } catch (error) {
      setState({ phase: 'failure', error: error.message || 'Failed to load incidents', rows: [] });
    }
  }, [search, fireCentre, selectedStages]);

  React.useEffect(() => { load(); }, [load]);

  const rows = React.useMemo(() => {
    const nextRows = [...state.rows];
    nextRows.sort((a, b) => compareRows(a, b, sortState));
    return nextRows;
  }, [state.rows, sortState]);

  const toggleStage = (code) => {
    setSelectedStages((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));
  };

  return (
    <div className="page-layout incidents-page">
      <PageTopBar title="Incidents" pipelineStatus={pipelineStatus} onTrigger={async (id) => {
        await onTriggerPipeline(id);
        if (id === 'incident' || id === 'fetchAll') load();
      }} />
      <div className="page-title-block">
        <h1>Incidents</h1>
        <p>Live BCWS incident table with local-ready structure and manual ingest controls.</p>
      </div>
      <div className="list-toolbar list-toolbar--mock">
        <input className="toolbar-input" placeholder="Search incident name or number" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="toolbar-input" value={fireCentre} onChange={(e) => setFireCentre(e.target.value)}>
          <option value="">All fire centres</option>
          {FIRE_CENTRES.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className="toolbar-input" value={`${sortState.key}:${sortState.direction}`} onChange={(e) => {
          const [key, direction] = e.target.value.split(':');
          setSortState({ key, direction });
        }}>
          <option value="updatedDate:desc">Last Updated (Newest)</option>
          <option value="updatedDate:asc">Last Updated (Oldest)</option>
          <option value="discoveryDate:desc">Discovery Date (Newest)</option>
          <option value="discoveryDate:asc">Discovery Date (Oldest)</option>
          <option value="incidentName:asc">Wildfire Name (A-Z)</option>
        </select>
        <button type="button" className="toolbar-button" onClick={load}>Refresh Table</button>
      </div>
      <div className="stage-toggle-row">
        {STAGE_ORDER.map((code) => (
          <button key={code} type="button" className={`stage-toggle ${selectedStages.includes(code) ? 'is-active' : ''}`} data-stage={code} onClick={() => toggleStage(code)}>
            {stageLabel(code)}
          </button>
        ))}
      </div>
      {state.phase === 'failure' ? <div className="error-banner">{state.error}</div> : null}
      <div className="table-shell table-shell--elevated">
        <table className="incident-table">
          <thead>
            <tr>
              <th>Wildfire Name</th>
              <th>Stage of Control</th>
              <th>Fire Centre</th>
              <th>Location</th>
              <th>Discovery Date</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.fireYear}-${row.incidentNumber}`} onClick={() => navigateTo(`/incidents/${row.fireYear}/${encodeURIComponent(row.incidentNumber)}`)}>
                <td>
                  <button type="button" className="incident-link" onClick={(event) => { event.stopPropagation(); navigateTo(`/incidents/${row.fireYear}/${encodeURIComponent(row.incidentNumber)}`); }}>
                    {row.incidentName}
                    <span className="incident-link__meta">({row.incidentNumber})</span>
                  </button>
                </td>
                <td><span className={`stage-pill stage-pill--${row.stage}`}>{stageLabel(row.stage)}</span></td>
                <td>{row.fireCentre}</td>
                <td>{row.location || '—'}</td>
                <td>{formatDate(row.discoveryDate)}</td>
                <td>{formatDate(row.updatedDate)}</td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan="6" className="table-empty">{state.phase === 'loading' ? 'Loading incidents…' : 'No incidents matched the current filters.'}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IncidentDetailPage({ fireYear, incidentNumber, pipelineStatus, onTriggerPipeline }) {
  const [tab, setTab] = React.useState('response');
  const [state, setState] = React.useState({ phase: 'loading', error: '', data: null });
  const [capture, setCapture] = React.useState(() => readIncidentCapture(fireYear, incidentNumber));

  const load = React.useCallback(async () => {
    setState({ phase: 'loading', error: '', data: null });
    try {
      const data = await fetchIncidentDetail(fireYear, incidentNumber);
      setState({ phase: 'success', error: '', data });
      setCapture(persistIncidentCapture(fireYear, incidentNumber, data));
    } catch (error) {
      setState({ phase: 'failure', error: error.message || 'Failed to load incident', data: null });
      setCapture(readIncidentCapture(fireYear, incidentNumber));
    }
  }, [fireYear, incidentNumber]);

  React.useEffect(() => { load(); }, [load]);

  const incident = state.data?.incident || capture?.latestIncident;
  const liveResponse = state.data?.response || {};
  const localUpdates = capture?.updates || [];
  const responseUpdates = localUpdates.length ? localUpdates.map((item) => item.text) : (liveResponse.responseUpdates || []);
  const responseHistory = localUpdates.length
    ? localUpdates
    : responseUpdates.map((text, index) => ({ updateHash: `${index}`, text, capturedAt: incident?.updatedDate || null, updatedDate: incident?.updatedDate || null }));

  return (
    <div className="page-layout incident-detail-page">
      <PageTopBar title="Incidents" pipelineStatus={pipelineStatus} onTrigger={async (id) => {
        await onTriggerPipeline(id);
        if (id === 'incident' || id === 'fetchAll') load();
      }} />
      <div className="detail-heading-row">
        <button type="button" className="back-button" onClick={() => navigateTo('/incidents')}>&larr;</button>
        <div className="detail-heading-text">
          <h1>Incident Detail</h1>
          <p>Official incident history is stacked newest-first and persisted locally after each successful fetch.</p>
        </div>
      </div>
      {state.phase === 'failure' ? <div className="error-banner">{state.error}</div> : null}
      <div className="incident-hero">
        <div className="incident-summary-card">
          <div className="incident-summary-card__title">{incident?.incidentName || incidentNumber}</div>
          <div className="incident-summary-card__list">
            <SummaryRow label={stageLabel(incident?.stage)} color={STAGE_DEFS[incident?.stage]?.color} />
            <SummaryRow label={`Fire Number ${incident?.incidentNumber || incidentNumber}`} />
            <SummaryRow label={`${incident?.sizeHa ?? '—'} Hectares`} />
            <SummaryRow label={`Discovered On ${formatDate(incident?.discoveryDate)}`} />
            <SummaryRow label={`Updated ${formatDateTime(incident?.updatedDate)}`} />
            <SummaryRow label={incident?.fireCentre || '—'} />
          </div>
        </div>
        <IncidentHeroMap incident={incident} perimeterData={state.data?.perimeterData} />
      </div>
      <div className="incident-tabs">
        {['response', 'gallery', 'maps', 'discourse'].map((item) => (
          <button key={item} type="button" className={`incident-tab ${tab === item ? 'is-active' : ''}`} onClick={() => setTab(item)}>
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'response' ? (
        <div className="incident-tab-panel incident-response-layout">
          <section className="response-big-card">
            <div className="response-big-card__header">
              <div>
                <h2>Official Response Updates</h2>
                <div className="capture-meta">
                  Stored locally: {capture?.lastCapturedAt ? formatDateTime(capture.lastCapturedAt) : 'Not yet captured'} · {responseHistory.length} updates
                </div>
              </div>
              <button type="button" className="toolbar-button toolbar-button--compact" onClick={load}>Fetch latest</button>
            </div>
            {responseHistory.length ? responseHistory.map((item, index) => (
              <article key={item.updateHash || index} className="timeline-card">
                <div className="timeline-card__header">
                  <span>Update {responseHistory.length - index}</span>
                  <strong>{formatDate(item.updatedDate || item.capturedAt)}</strong>
                </div>
                <pre>{item.text}</pre>
              </article>
            )) : <div className="text-muted">No response update was parsed from the live BCWS incident page.</div>}
          </section>
          <div className="response-lower-grid">
            <DetailCard title="Evacuations">
              {state.data?.tiedEvac?.orders?.length || state.data?.tiedEvac?.alerts?.length ? (
                <div className="mini-list">
                  {(state.data?.tiedEvac?.orders || []).map((row, idx) => <div key={`order-${idx}`}>Order: {row.eventName}</div>)}
                  {(state.data?.tiedEvac?.alerts || []).map((row, idx) => <div key={`alert-${idx}`}>Alert: {row.eventName}</div>)}
                </div>
              ) : <div className="text-muted">No live evacuation notice intersected the incident envelope.</div>}
            </DetailCard>
            <DetailCard title="Suspected Cause">
              <div>{liveResponse?.suspectedCauseText || incident?.causeDetail || 'No suspected cause is published for this incident.'}</div>
            </DetailCard>
            <DetailCard title="Resources Assigned">
              {liveResponse?.resourcesAssignedText ? <div>{liveResponse.resourcesAssignedText}</div> : <ResourcesAssigned incident={incident} />}
            </DetailCard>
          </div>
        </div>
      ) : null}
      {tab === 'gallery' ? (
        <div className="incident-tab-panel">
          {state.data?.attachments?.length ? (
            <div className="gallery-grid">
              {state.data.attachments.map((asset) => (
                <article key={asset.attachmentGuid} className="gallery-card">
                  <GalleryImage asset={asset} />
                  <div className="gallery-card__title">{asset.title}</div>
                  <div className="gallery-card__date">{formatDate(asset.uploadedTimestamp)}</div>
                </article>
              ))}
            </div>
          ) : <div className="text-muted">No gallery assets are published for this incident.</div>}
        </div>
      ) : null}
      {tab === 'maps' ? (
        <div className="incident-tab-panel maps-panel">
          <h2>Map Downloads</h2>
          {state.data?.externalLinks?.length ? (
            <div className="mini-list">
              {state.data.externalLinks.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="link-row">{link.label || link.url}</a>)}
            </div>
          ) : <p>{liveResponse?.mapMessage || 'There are currently no maps associated with this incident.'}</p>}
        </div>
      ) : null}
      {tab === 'discourse' ? (
        <div className="incident-tab-panel discourse-stub">
          <h2>Discourse Signals</h2>
          <p>Discourse ingestion is not active yet. This tab is reserved for local post/comment evidence linked to the incident.</p>
        </div>
      ) : null}
    </div>
  );
}

function WeatherPage({ pipelineStatus, onTriggerPipeline }) {
  return (
    <div className="page-layout feature-page">
      <PageTopBar title="Weather" pipelineStatus={pipelineStatus} onTrigger={onTriggerPipeline} />
      <div className="page-title-block">
        <h1>Weather</h1>
        <p>Weather ingestion is not wired in this runtime. This page is a placeholder surface only.</p>
      </div>
      <div className="feature-card-grid">
        <DetailCard title="Pipeline Health"><div>{pipelineLabel(pipelineStatus.weather.state)}</div></DetailCard>
        <DetailCard title="Capture State"><div>Never captured in-app. Use browser fallback workflows until ingestion is wired.</div></DetailCard>
      </div>
    </div>
  );
}

function DiscoursePage({ pipelineStatus, onTriggerPipeline }) {
  return (
    <div className="page-layout feature-page">
      <PageTopBar title="Discourse" pipelineStatus={pipelineStatus} onTrigger={onTriggerPipeline} />
      <div className="page-title-block">
        <h1>Discourse</h1>
        <p>Discourse ingestion is not wired in this runtime. This surface is reserved for a later phase.</p>
      </div>
      <div className="feature-card-grid">
        <DetailCard title="Pipeline Health"><div>{pipelineLabel(pipelineStatus.discourse.state)}</div></DetailCard>
        <DetailCard title="Capture State"><div>Never captured in-app. No active ingestion or incident linkage yet.</div></DetailCard>
      </div>
    </div>
  );
}

function MapsPage({ pipelineStatus, onTriggerPipeline }) {
  return (
    <div className="page-layout feature-page">
      <PageTopBar title="Maps" pipelineStatus={pipelineStatus} onTrigger={onTriggerPipeline} />
      <div className="page-title-block">
        <h1>Maps</h1>
        <p>Map utilities remain available via incident pages while a dedicated maps surface is designed.</p>
      </div>
      <StubPanel title="Dedicated map workspace coming next" />
    </div>
  );
}

function ConfigurePage({ configureTab, setConfigureTab, pipelineStatus, onTriggerPipeline }) {
  const captures = readAllIncidentCaptures();
  const stats = {
    incidents: captures.length,
    updates: captures.reduce((sum, item) => sum + (item.updates?.length || 0), 0),
    attachments: captures.reduce((sum, item) => sum + (item.attachments?.length || 0), 0),
  };

  const exportCapture = () => {
    const blob = new Blob([JSON.stringify(captures, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'open-fireside-local-capture.json';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="page-layout configure-page">
      <PageTopBar title="Settings" pipelineStatus={pipelineStatus} onTrigger={onTriggerPipeline} />
      <div className="page-title-block">
        <h1>Settings</h1>
        <p>Current shell status for local capture and placeholder pipelines in the browser runtime.</p>
      </div>
      <div className="configure-top-tabs">
        {[
          { id: 'system', label: 'System' },
          { id: 'ingestion', label: 'Ingestion' },
          { id: 'storage', label: 'Storage' },
        ].map((tab) => (
          <button key={tab.id} type="button" className={`configure-tab ${configureTab === tab.id ? 'is-active' : ''}`} onClick={() => setConfigureTab(tab.id)}>{tab.label}</button>
        ))}
      </div>
      {configureTab === 'system' ? (
        <div className="feature-card-grid feature-card-grid--wide">
          <DetailCard title="Current Runtime"><div>Browser / Vite shell with localStorage-backed capture.</div></DetailCard>
          <DetailCard title="Database Status"><div>No DB in this runtime. Data is browser-local only.</div></DetailCard>
        </div>
      ) : null}
      {configureTab === 'ingestion' ? (
        <div className="feature-card-grid feature-card-grid--wide">
          <DetailCard title="Incident Pipeline"><div>Status: {pipelineLabel(pipelineStatus.incident.state)}</div></DetailCard>
          <DetailCard title="Weather Pipeline"><div>Status: {pipelineLabel(pipelineStatus.weather.state)}</div></DetailCard>
          <DetailCard title="Discourse Pipeline"><div>Status: {pipelineLabel(pipelineStatus.discourse.state)}</div></DetailCard>
          <DetailCard title="Manual Operations"><button type="button" className="toolbar-button" onClick={() => onTriggerPipeline('fetchAll')}>Run Fetch All</button></DetailCard>
        </div>
      ) : null}
      {configureTab === 'storage' ? (
        <div className="feature-card-grid feature-card-grid--wide">
          <DetailCard title="Local Capture Stats">
            <div className="mini-list">
              <div>Incidents captured: {stats.incidents}</div>
              <div>Official updates stored: {stats.updates}</div>
              <div>Attachment records stored: {stats.attachments}</div>
            </div>
          </DetailCard>
          <DetailCard title="Export Snapshot"><button type="button" className="toolbar-button" onClick={exportCapture}>Export local JSON</button></DetailCard>
          <DetailCard title="Storage Notes"><div>Browser fallback only: localStorage capture, No DB, and backfill due when storage is wired.</div></DetailCard>
        </div>
      ) : null}
    </div>
  );
}

function DashboardMap({ mapLayers }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const markerLayerRef = React.useRef(null);

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView([54.4, -125.4], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  React.useEffect(() => {
    if (!markerLayerRef.current || !mapRef.current) return;
    markerLayerRef.current.clearLayers();
    if (!mapLayers) return;
    const bounds = [];
    Object.entries(mapLayers).forEach(([code, features]) => {
      (features || []).forEach((feature) => {
        const coords = feature?.geometry?.coordinates;
        if (!coords || coords.length < 2) return;
        const latlng = [coords[1], coords[0]];
        bounds.push(latlng);
        L.circleMarker(latlng, {
          radius: code === 'FIRE_OF_NOTE' ? 7 : 5,
          color: '#233239',
          weight: 1,
          fillColor: STAGE_DEFS[code]?.color || '#888',
          fillOpacity: 0.95,
        }).addTo(markerLayerRef.current);
      });
    });
    if (bounds.length) mapRef.current.fitBounds(bounds, { padding: [16, 16], maxZoom: 6 });
  }, [mapLayers]);

  return <div className="map-card"><div ref={containerRef} className="leaflet-canvas dashboard-map-canvas" /></div>;
}

function IncidentHeroMap({ incident, perimeterData }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const geoLayerRef = React.useRef(null);

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView([54.4, -125.4], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    geoLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  React.useEffect(() => {
    if (!geoLayerRef.current || !mapRef.current || !incident) return;
    geoLayerRef.current.clearLayers();
    let fitted = false;
    if (perimeterData?.features?.length) {
      const geo = L.geoJSON(perimeterData, { style: { color: '#ff3521', weight: 2, fillOpacity: 0.06 } }).addTo(geoLayerRef.current);
      try { mapRef.current.fitBounds(geo.getBounds(), { padding: [12, 12], maxZoom: 10 }); fitted = true; } catch {}
    }
    if (Number.isFinite(incident.latitude) && Number.isFinite(incident.longitude)) {
      L.circleMarker([incident.latitude, incident.longitude], { radius: 6, color: '#111', fillColor: '#c7ff1a', fillOpacity: 1, weight: 2 }).addTo(geoLayerRef.current);
      if (!fitted) mapRef.current.setView([incident.latitude, incident.longitude], 8);
    }
  }, [incident, perimeterData]);

  return <div ref={containerRef} className="incident-hero-map" />;
}

function FireCentreTable({ statsList }) {
  return (
    <div className="fire-centre-table">
      <div className="card-title">Fire Centre Totals</div>
      <div className="fire-centre-table__header"><span>Fire Centre</span><span>Active</span><span>Out</span><span>Held</span><span>Under</span></div>
      {FIRE_CENTRES.map((name) => {
        const row = statsList.find((item) => item?.fireCentre === name) || null;
        const out = row?.activeOutOfControlFires;
        const held = row?.activeBeingHeldFires;
        const under = row?.activeUnderControlFires;
        const active = row ? Number(out || 0) + Number(held || 0) + Number(under || 0) : null;
        return (
          <div key={name} className="fire-centre-table__row"><span>{name.replace(' Fire Centre', '')}</span><span>{displayValue(active)}</span><span>{displayValue(out)}</span><span>{displayValue(held)}</span><span>{displayValue(under)}</span></div>
        );
      })}
    </div>
  );
}

function StageControlPanel({ stats }) {
  const stages = [
    { code: 'UNDR_CNTRL', label: 'Under Control', value: stats?.activeUnderControlFires ?? null },
    { code: 'HOLDING', label: 'Being Held', value: stats?.activeBeingHeldFires ?? null },
    { code: 'OUT_CNTRL', label: 'Out of Control', value: stats?.activeOutOfControlFires ?? null },
  ];
  const total = stages.reduce((sum, stage) => sum + Number(stage.value || 0), 0);
  return (
    <section className="stage-control-panel">
      <div className="stage-control-bar">
        {stages.map((stage) => <div key={stage.code} className={`stage-control-bar__segment stage-control-bar__segment--${stage.code}`} style={{ width: total > 0 ? `${(Number(stage.value || 0) / total) * 100}%` : '0%', background: STAGE_DEFS[stage.code].color }} />)}
      </div>
      <div className="stage-control-grid">
        {stages.map((stage) => <MetricCard key={stage.code} label={stage.label} value={`${displayValue(stage.value)} · ${pct(stage.value, stats)}`} />)}
      </div>
    </section>
  );
}

function MetricCard({ label, value }) {
  return <div className="metric-card"><div className="metric-card__label">{label}</div><div className="metric-card__value">{value}</div></div>;
}

function DetailCard({ title, children }) {
  return <section className="detail-card"><h3>{title}</h3>{children}</section>;
}

function GalleryImage({ asset }) {
  const [failed, setFailed] = React.useState(false);
  if (!asset.imageUrl) return <div className="gallery-card__empty">No live image URL</div>;
  if (failed) return <div className="gallery-card__empty">Live image unavailable</div>;
  return <img src={asset.imageUrl} alt={asset.title} className="gallery-card__image" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function SummaryRow({ label, color }) {
  return <div className="summary-row">{color ? <span className="legend-dot" style={{ background: color }} /> : <span>&bull;</span>}<span>{label}</span></div>;
}

function StubPanel({ title, className = '' }) {
  return <section className={`stub-panel ${className}`.trim()}><h2>{title}</h2></section>;
}

function ResourcesAssigned({ incident }) {
  const items = [];
  if (incident?.resources?.personnel) items.push(`Personnel${incident.resources.personnelCount ? ` (${incident.resources.personnelCount})` : ''}`);
  if (incident?.resources?.imt) items.push(`IMT${incident.resources.imtCount ? ` (${incident.resources.imtCount})` : ''}`);
  if (incident?.resources?.aviation) items.push(`Aviation${incident.resources.aviationCount ? ` (${incident.resources.aviationCount})` : ''}`);
  if (incident?.resources?.heavy) items.push(`Heavy equipment${incident.resources.heavyCount ? ` (${incident.resources.heavyCount})` : ''}`);
  if (incident?.resources?.spu) items.push(`SPU${incident.resources.spuCount ? ` (${incident.resources.spuCount})` : ''}`);
  return <div>{items.length ? items.join(', ') : 'No resource assignment flags are published for this incident.'}</div>;
}

function pct(value, stats) {
  const total = Number(stats?.activeOutOfControlFires || 0) + Number(stats?.activeBeingHeldFires || 0) + Number(stats?.activeUnderControlFires || 0);
  if (!total) return '0%';
  return `${Math.round((Number(value || 0) / total) * 100)}%`;
}

function displayValue(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toLocaleString('en-CA');
}

function compareRows(a, b, sortState) {
  const direction = sortState.direction === 'asc' ? 1 : -1;
  const left = a[sortState.key];
  const right = b[sortState.key];
  if (sortState.key.toLowerCase().includes('date')) return (Number(left || 0) - Number(right || 0)) * direction;
  return String(left || '').localeCompare(String(right || ''), 'en', { sensitivity: 'base' }) * direction;
}
