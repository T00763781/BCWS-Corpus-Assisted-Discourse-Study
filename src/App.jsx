import React from 'react';
import L from 'leaflet';
import { fetchBcwsPerimeterWidget } from './bcwsPerimeter.js';
import {
  FIRE_CENTRES,
  STAGE_DEFS,
  fetchDashboardData,
  fetchIncidentDetail,
  fetchIncidentList,
  formatDate,
  formatDateTime,
  stageLabel,
} from './bcwsApi.js';
import {
  configureTabs,
  getCandidateWidgetObjects,
  getLiveWidgetObjects,
  initialPageLayouts,
  pageBuilderTabs,
  togglePageEdit,
  addPageColumn,
  addPageWidgetSlot,
} from './objectModel.js';

const ROUTES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'weather', label: 'Weather' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'maps', label: 'Maps' },
  { id: 'discourse', label: 'Discourse' },
  { id: 'configure', label: 'Configure' },
];

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

export default function App() {
  const route = useHashRoute();
  const [configureTab, setConfigureTab] = React.useState('sources');
  const [pageLayouts, setPageLayouts] = React.useState(initialPageLayouts);

  const updatePageLayout = React.useCallback((pageId, recipe) => {
    setPageLayouts((current) => ({
      ...current,
      [pageId]: recipe(current[pageId]),
    }));
  }, []);

  const builderActions = React.useMemo(
    () => ({
      onToggleEdit: (pageId) => updatePageLayout(pageId, togglePageEdit),
      onAddColumn: (pageId) => updatePageLayout(pageId, addPageColumn),
      onAddWidget: (pageId) => updatePageLayout(pageId, addPageWidgetSlot),
    }),
    [updatePageLayout]
  );

  return (
    <div className="app-shell">
      <main className="shell-frame">
        <aside className="left-rail">
          <div className="brand-block">
            <img src="/assets/logo.svg" alt="Open Fireside" className="brand-logo" />
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
          {route.id === 'dashboard' ? <DashboardPage /> : null}
          {route.id === 'incidents' ? <IncidentsListPage /> : null}
          {route.id === 'incident-detail' ? (
            <IncidentDetailPage fireYear={route.fireYear} incidentNumber={route.incidentNumber} />
          ) : null}
          {route.id === 'weather' ? <BlankRoute /> : null}
          {route.id === 'maps' ? <BlankRoute /> : null}
          {route.id === 'discourse' ? <BlankRoute /> : null}
          {route.id === 'configure' ? (
            <ConfigureWorkspace
              configureTab={configureTab}
              setConfigureTab={setConfigureTab}
              pageLayouts={pageLayouts}
              builderActions={builderActions}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}

function DashboardPage() {
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

  React.useEffect(() => {
    load();
  }, [load]);

  const stats = state.data?.stats;
  const fireOfNoteCount = state.data?.mapLayers?.FIRE_OF_NOTE?.length ?? 0;
  const activeCount = stats
    ? (stats.activeOutOfControlFires || 0) +
      (stats.activeBeingHeldFires || 0) +
      (stats.activeUnderControlFires || 0)
    : null;

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <div className="dashboard-kicker">
            {state.data?.fireYear ? `Fire year ${state.data.fireYear}` : 'Dashboard'}
          </div>
          <h1 className="dashboard-title">Dashboard</h1>
        </div>
        <button type="button" className="refresh-chip" onClick={load}>Refresh</button>
      </div>

      {state.phase === 'failure' ? <div className="error-banner">{state.error}</div> : null}

      <div className="dashboard-grid">
        <div className="dashboard-main-card">
          <div className="card-title-row">
            <div className="card-title">Wildfire Overview</div>
            <div className="dashboard-updated">
              {stats?.updateDate ? `Updated ${formatDateTime(stats.updateDate)}` : ''}
            </div>
          </div>
          <div className="stage-legend is-inline">
            {['FIRE_OF_NOTE', 'UNDR_CNTRL', 'HOLDING', 'OUT_CNTRL'].map((code) => (
              <div key={code} className="legend-item">
                <span className="legend-dot" style={{ background: STAGE_DEFS[code].color }} />
                <span>{STAGE_DEFS[code].label}</span>
              </div>
            ))}
          </div>
          <DashboardMap mapLayers={state.data?.mapLayers} />
        </div>

        <div className="dashboard-side-column">
          <div className="metrics-card-grid is-three">
            <MetricCard label="Active" value={displayValue(activeCount)} />
            <MetricCard label="Wildfires of Note" value={displayValue(fireOfNoteCount)} />
            <MetricCard label="New in 24" value={displayValue(stats?.newFires24Hours)} />
            <MetricCard label="Out in 24" value={displayValue(stats?.outFires24Hours)} />
            <MetricCard label="Out in 7" value={displayValue(stats?.outFires7Days)} />
            <MetricCard label="Evacuation Orders" value={displayValue(state.data?.evacuations.orders)} />
            <MetricCard label="Evacuation Alerts" value={displayValue(state.data?.evacuations.alerts)} />
          </div>
          <div className="metrics-card-grid is-three compact">
            <StageMetric label="Out of Control" value={displayValue(stats?.activeOutOfControlFires)} pct={pct(stats?.activeOutOfControlFires, stats)} code="OUT_CNTRL" />
            <StageMetric label="Being Held" value={displayValue(stats?.activeBeingHeldFires)} pct={pct(stats?.activeBeingHeldFires, stats)} code="HOLDING" />
            <StageMetric label="Under Control" value={displayValue(stats?.activeUnderControlFires)} pct={pct(stats?.activeUnderControlFires, stats)} code="UNDR_CNTRL" />
          </div>
          <FireCentreTable statsList={state.data?.fireCentreStats || []} />
        </div>

        <StubPanel title="Discourse Signals" className="dashboard-discourse" />

        <StubPanel title="Incidents (pinned)" className="dashboard-pinned" />
      </div>
    </div>
  );
}

function DashboardMap({ mapLayers }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const markerLayerRef = React.useRef(null);

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([54.4, -125.4], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
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
        })
          .bindTooltip(`${feature.properties?.incident_name || feature.properties?.incident_number_label || 'Incident'}\n${STAGE_DEFS[code]?.label || code}`)
          .addTo(markerLayerRef.current);
      });
    });
    if (bounds.length) {
      mapRef.current.fitBounds(bounds, { padding: [16, 16], maxZoom: 6 });
    }
  }, [mapLayers]);

  return (
    <div className="map-card">
      <div ref={containerRef} className="leaflet-canvas dashboard-map-canvas" />
      <div className="map-help">Drag to pan. Scroll or use +/- to zoom.</div>
    </div>
  );
}

function FireCentreTable({ statsList }) {
  return (
    <div className="fire-centre-table">
      <div className="card-title">Fire Centre Totals</div>
      <div className="fire-centre-table__header">
        <span>Fire Centre</span>
        <span>Active</span>
        <span>Out</span>
        <span>Held</span>
        <span>Under</span>
      </div>
      {FIRE_CENTRES.map((name, index) => {
        const row = statsList.find((item) => item?.fireCentre === name) || statsList[index] || null;
        const out = Number(row?.activeOutOfControlFires || 0);
        const held = Number(row?.activeBeingHeldFires || 0);
        const under = Number(row?.activeUnderControlFires || 0);
        return (
          <div key={name} className="fire-centre-table__row">
            <span>{name.replace(' Fire Centre', '')}</span>
            <span>{out + held + under}</span>
            <span>{out}</span>
            <span>{held}</span>
            <span>{under}</span>
          </div>
        );
      })}
    </div>
  );
}

function IncidentsListPage() {
  const [search, setSearch] = React.useState('');
  const [fireCentre, setFireCentre] = React.useState('');
  const [selectedStages, setSelectedStages] = React.useState(['OUT_CNTRL', 'HOLDING', 'UNDR_CNTRL', 'OUT']);
  const [sortKey, setSortKey] = React.useState('lastUpdated');
  const [state, setState] = React.useState({ phase: 'loading', error: '', rows: [] });

  const load = React.useCallback(async () => {
    setState((current) => ({ ...current, phase: 'loading', error: '' }));
    try {
      const data = await fetchIncidentList({ search, fireCentre, stageCodes: selectedStages, pageRowCount: 500 });
      setState({ phase: 'success', error: '', rows: data.rows });
    } catch (error) {
      setState({ phase: 'failure', error: error.message || 'Failed to load incidents', rows: [] });
    }
  }, [search, fireCentre, selectedStages]);

  React.useEffect(() => {
    load();
  }, [load]);

  const rows = React.useMemo(() => {
    const next = [...state.rows];
    next.sort((a, b) => {
      if (sortKey === 'name') return String(a.incidentName).localeCompare(String(b.incidentName));
      return Number(b.updatedDate || 0) - Number(a.updatedDate || 0);
    });
    return next;
  }, [state.rows, sortKey]);

  const toggleStage = (code) => {
    setSelectedStages((current) => {
      if (current.includes(code)) {
        const next = current.filter((item) => item !== code);
        return next.length ? next : current;
      }
      return [...current, code];
    });
  };

  return (
    <div className="incidents-page">
      <div className="list-toolbar">
        <input
          className="toolbar-input"
          placeholder="Search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="toolbar-input" value={fireCentre} onChange={(event) => setFireCentre(event.target.value)}>
          <option value="">Fire Centre</option>
          {FIRE_CENTRES.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <button className="toolbar-button toolbar-button--sort" type="button" onClick={() => setSortKey((current) => current === 'lastUpdated' ? 'name' : 'lastUpdated')}>
          Sort By
        </button>
      </div>

      <div className="stage-toggle-row">
        {['OUT_CNTRL', 'HOLDING', 'UNDR_CNTRL', 'OUT'].map((code) => (
          <button
            key={code}
            type="button"
            className={`stage-toggle ${selectedStages.includes(code) ? 'is-active' : ''}`}
            data-stage={code}
            onClick={() => toggleStage(code)}
          >
            {stageLabel(code)}
          </button>
        ))}
      </div>

      {state.phase === 'failure' ? <div className="error-banner">{state.error}</div> : null}

      <div className="table-shell">
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
                <td>
                  <span className={`stage-pill stage-pill--${row.stage}`}>{stageLabel(row.stage)}</span>
                </td>
                <td>{row.fireCentre}</td>
                <td>{row.location || '—'}</td>
                <td>{formatDate(row.discoveryDate)}</td>
                <td>{formatDate(row.updatedDate)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan="6" className="table-empty">{state.phase === 'loading' ? 'Loading incidents…' : 'No incidents matched the current filters.'}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IncidentDetailPage({ fireYear, incidentNumber }) {
  const [tab, setTab] = React.useState('response');
  const [state, setState] = React.useState({ phase: 'loading', error: '', data: null });

  const load = React.useCallback(async () => {
    setState({ phase: 'loading', error: '', data: null });
    try {
      const data = await fetchIncidentDetail(fireYear, incidentNumber);
      setState({ phase: 'success', error: '', data });
    } catch (error) {
      setState({ phase: 'failure', error: error.message || 'Failed to load incident', data: null });
    }
  }, [fireYear, incidentNumber]);

  React.useEffect(() => { load(); }, [load]);

  const incident = state.data?.incident;
  const response = state.data?.response;

  return (
    <div className="incident-detail-page">
      <button type="button" className="back-button" onClick={() => navigateTo('/incidents')}>&larr;</button>

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
        {[
          { id: 'response', label: 'Response' },
          { id: 'gallery', label: 'Gallery' },
          { id: 'maps', label: 'Maps' },
          { id: 'discourse', label: 'Discourse' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={`incident-tab ${tab === item.id ? 'is-active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'response' ? (
        <div className="incident-tab-panel incident-response-layout">
          <section className="response-big-card">
            <h2>Response Update</h2>
            {response?.responseUpdates?.length ? (
              response.responseUpdates.map((item, index) => (
                <article key={`resp-${index}`} className="response-update-block">
                  <pre>{item}</pre>
                </article>
              ))
            ) : (
              <div className="text-muted">No response update was parsed from the live BCWS incident page.</div>
            )}
          </section>
          <div className="response-lower-grid">
            <DetailCard title="Evacuations">
              {state.data?.tiedEvac.orders?.length || state.data?.tiedEvac.alerts?.length ? (
                <div className="mini-list">
                  {state.data.tiedEvac.orders.map((row, idx) => <div key={`order-${idx}`}>Order: {row.eventName}</div>)}
                  {state.data.tiedEvac.alerts.map((row, idx) => <div key={`alert-${idx}`}>Alert: {row.eventName}</div>)}
                </div>
              ) : response?.evacuationsText ? (
                <div>{response.evacuationsText}</div>
              ) : (
                <div className="text-muted">No live evacuation notice intersected the incident envelope.</div>
              )}
            </DetailCard>
            <DetailCard title="Suspected Cause">
              <div>{response?.suspectedCauseText || incident?.causeDetail || 'No suspected cause is published for this incident.'}</div>
            </DetailCard>
            <DetailCard title="Resources Assigned">
              {response?.resourcesAssignedText ? (
                <div>{response.resourcesAssignedText}</div>
              ) : (
                <ResourcesAssigned incident={incident} />
              )}
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
                  {asset.imageUrl ? <img src={asset.imageUrl} alt={asset.title} className="gallery-card__image" /> : null}
                  <div className="gallery-card__title">{asset.title}</div>
                  <div className="gallery-card__date">{formatDate(asset.uploadedTimestamp)}</div>
                </article>
              ))}
            </div>
          ) : (
            <div className="text-muted">No gallery assets are published for this incident.</div>
          )}
        </div>
      ) : null}

      {tab === 'maps' ? (
        <div className="incident-tab-panel maps-panel">
          {state.data?.externalLinks?.filter((item) => /map|pdf/i.test(item.category || '') || /map/i.test(item.label || '')).length ? (
            <div className="mini-list">
              {state.data.externalLinks
                .filter((item) => /map|pdf/i.test(item.category || '') || /map/i.test(item.label || ''))
                .map((link) => (
                  <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="link-row">
                    {link.label || link.url}
                  </a>
                ))}
            </div>
          ) : (
            <>
              <h2>Map Downloads</h2>
              <p>{response?.mapMessage || 'There are currently no maps associated with this incident.'}</p>
            </>
          )}
        </div>
      ) : null}


    </div>
  );
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
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (!geoLayerRef.current || !mapRef.current || !incident) return;
    geoLayerRef.current.clearLayers();
    let fitted = false;
    if (perimeterData?.features?.length) {
      const geo = L.geoJSON(perimeterData, {
        style: { color: '#ff3521', weight: 2, fillOpacity: 0.06 },
      }).addTo(geoLayerRef.current);
      try {
        mapRef.current.fitBounds(geo.getBounds(), { padding: [12, 12], maxZoom: 10 });
        fitted = true;
      } catch {}
    }
    if (Number.isFinite(incident.latitude) && Number.isFinite(incident.longitude)) {
      const marker = L.circleMarker([incident.latitude, incident.longitude], {
        radius: 6,
        color: '#111',
        fillColor: '#c7ff1a',
        fillOpacity: 1,
        weight: 2,
      }).addTo(geoLayerRef.current);
      marker.bindTooltip(incident.incidentName || incident.incidentNumber);
      if (!fitted) {
        mapRef.current.setView([incident.latitude, incident.longitude], 8);
      }
    }
  }, [incident, perimeterData]);

  return <div ref={containerRef} className="incident-hero-map" />;
}

function ResourcesAssigned({ incident }) {
  const items = [];
  if (incident?.resources.personnel) items.push(`Personnel${incident.resources.personnelCount ? ` (${incident.resources.personnelCount})` : ''}`);
  if (incident?.resources.imt) items.push(`IMT${incident.resources.imtCount ? ` (${incident.resources.imtCount})` : ''}`);
  if (incident?.resources.aviation) items.push(`Aviation${incident.resources.aviationCount ? ` (${incident.resources.aviationCount})` : ''}`);
  if (incident?.resources.heavy) items.push(`Heavy equipment${incident.resources.heavyCount ? ` (${incident.resources.heavyCount})` : ''}`);
  if (incident?.resources.spu) items.push(`SPU${incident.resources.spuCount ? ` (${incident.resources.spuCount})` : ''}`);
  return <div>{items.length ? items.join(', ') : 'No resource assignment flags are published for this incident.'}</div>;
}

function MetricCard({ label, value }) {
  return (
    <div className="metric-card">
      <div className="metric-card__label">{label}</div>
      <div className="metric-card__value">{value}</div>
    </div>
  );
}

function StageMetric({ label, value, pct, code }) {
  return (
    <div className="metric-card stage-metric">
      <div className="stage-metric__label"><span className="legend-dot" style={{ background: STAGE_DEFS[code]?.color }} /> {label}</div>
      <div className="stage-metric__numbers"><span>{value}</span><span>{pct}</span></div>
    </div>
  );
}

function SmallCountChip({ label, value }) {
  return (
    <div className="small-count-chip">
      <div className="small-count-chip__label">{label}</div>
      <div className="small-count-chip__value">{value}</div>
    </div>
  );
}

function StubPanel({ title, className = '' }) {
  return (
    <section className={`stub-panel ${className}`.trim()}>
      <h2>{title}</h2>
    </section>
  );
}

function DetailCard({ title, children }) {
  return (
    <section className="detail-card">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function SummaryRow({ label, color }) {
  return (
    <div className="summary-row">
      {color ? <span className="legend-dot" style={{ background: color }} /> : <span>&bull;</span>}
      <span>{label}</span>
    </div>
  );
}

function BlankRoute() {
  return <div className="blank-workspace" aria-hidden="true" />;
}




function ConfigureWorkspace({ configureTab, setConfigureTab, pageLayouts, builderActions }) {
  const activeBuilderTab = pageBuilderTabs.find((tab) => tab.id === configureTab);

  return (
    <div className="configure-workspace">
      <div className="configure-top-tabs" role="tablist" aria-label="Configure sections">
        {configureTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={configureTab === tab.id}
            className={`configure-tab ${configureTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setConfigureTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="sources-surface">
        {configureTab === 'sources' ? <ConfigureSourcesView /> : null}
        {configureTab === 'widgets' ? <ConfigureWidgetsView /> : null}
        {activeBuilderTab ? (
          <PageBuilderSurface
            page={pageLayouts[activeBuilderTab.pageId]}
            label={activeBuilderTab.label}
            builderActions={builderActions}
            insideConfigure
          />
        ) : null}
      </div>
    </div>
  );
}

function ConfigureSourcesView() {
  const liveWidgets = getLiveWidgetObjects().filter((widget) =>
    widget.allowed_config_tabs.includes('sources')
  );

  return (
    <div className="configure-stack">
      {liveWidgets.map((widget) => (
        <WidgetObjectCard key={widget.widget_id} widget={widget} renderActive />
      ))}
    </div>
  );
}

function ConfigureWidgetsView() {
  const liveWidgets = getLiveWidgetObjects().filter((widget) =>
    widget.allowed_config_tabs.includes('widgets')
  );
  const candidateWidgets = getCandidateWidgetObjects();

  return (
    <div className="configure-stack">
      <section className="widget-lab-section">
        <div className="widget-lab-title">Live widget objects</div>
        {liveWidgets.map((widget) => (
          <WidgetObjectCard key={widget.widget_id} widget={widget} renderActive />
        ))}
      </section>
      <section className="widget-lab-section">
        <div className="widget-lab-title">Candidate widgets</div>
        <div className="candidate-widget-list">
          {candidateWidgets.map((widget) => (
            <div key={widget.widget_id} className="candidate-widget-row">
              <div>
                <div className="candidate-widget-row__label">{widget.label}</div>
                <div className="candidate-widget-row__meta">{widget.widget_id}</div>
              </div>
              <div className="candidate-widget-row__status">{widget.status}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function WidgetObjectCard({ widget, renderActive = false }) {
  return (
    <section className="widget-object-card">
      <div className="widget-object-card__title">{widget.label}</div>
      <div className="widget-object-card__grid">
        <MetaItem label="widget_id" value={widget.widget_id} />
        <MetaItem label="status" value={widget.status} />
        <MetaItem label="render_type" value={widget.render_type} />
        <MetaItem label="source_ids" value={widget.source_ids.join(', ')} />
        <MetaItem label="allowed_pages" value={widget.allowed_pages.join(', ') || 'none'} />
        <MetaItem label="allowed_config_tabs" value={widget.allowed_config_tabs.join(', ') || 'none'} />
        <MetaItem label="fetch_mode" value={widget.fetch_mode} />
        <MetaItem label="notes" value={widget.notes} />
      </div>
      {renderActive && widget.render_type === 'bcws_perimeter_layer' ? <BcwsPerimeterWidget /> : null}
    </section>
  );
}

function BcwsPerimeterWidget() {
  const [state, setState] = React.useState({ phase: 'idle', error: '', data: null });

  const loadWidget = React.useCallback(async () => {
    setState((current) => ({ ...current, phase: 'loading', error: '' }));
    try {
      const data = await fetchBcwsPerimeterWidget();
      setState({ phase: 'success', error: '', data });
    } catch (error) {
      setState({
        phase: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      });
    }
  }, []);

  React.useEffect(() => {
    loadWidget();
  }, [loadWidget]);

  const specimenRows = state.data?.specimen?.features ?? [];
  const rawSpecimen = state.data?.specimen ? JSON.stringify(state.data.specimen, null, 2) : '';

  return (
    <section className="source-widget">
      <div className="source-widget__header">
        <div>
          <h2 className="source-widget__title">BCWS Fire Perimeters PublicView</h2>
          <div className="source-widget__source">
            {state.data?.sourceUrl ||
              'https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/BCWS_FirePerimeters_PublicView/FeatureServer/0'}
          </div>
        </div>
        <button type="button" className="source-widget__button" onClick={loadWidget}>
          Refresh
        </button>
      </div>
      <div className="source-widget__status-grid">
        <StatusItem label="Fetch" value={state.phase} />
        <StatusItem label="Metadata HTTP" value={state.data?.metadataStatus ?? 'n/a'} />
        <StatusItem label="Count HTTP" value={state.data?.countStatus ?? 'n/a'} />
        <StatusItem label="Specimen HTTP" value={state.data?.specimenStatus ?? 'n/a'} />
        <StatusItem label="Last fetched" value={state.data?.fetchedAt ?? 'n/a'} />
      </div>
      {state.phase === 'failure' ? <div className="error-banner">{state.error}</div> : null}
      <div className="source-widget__summary-grid">
        <SummaryItem label="Layer name" value={state.data?.layerName ?? 'n/a'} />
        <SummaryItem label="Geometry type" value={state.data?.geometryType ?? 'n/a'} />
        <SummaryItem label="Object count" value={state.data?.objectCount ?? 'n/a'} />
        <SummaryItem label="Available fields" value={state.data?.fields?.length ? state.data.fields.join(', ') : 'n/a'} />
      </div>
      <div className="source-widget__table-wrap">
        <table className="source-widget__table">
          <thead>
            <tr>
              <th>FIRE_NUMBER</th>
              <th>FIRE_STATUS</th>
              <th>FIRE_SIZE_HECTARES</th>
              <th>FIRE_URL</th>
            </tr>
          </thead>
          <tbody>
            {specimenRows.length ? (
              specimenRows.map((row, index) => {
                const attrs = row.attributes ?? {};
                return (
                  <tr key={`${attrs.FIRE_NUMBER ?? 'row'}-${index}`}>
                    <td>{attrs.FIRE_NUMBER ?? ''}</td>
                    <td>{attrs.FIRE_STATUS ?? ''}</td>
                    <td>{attrs.FIRE_SIZE_HECTARES ?? ''}</td>
                    <td className="source-widget__url-cell">{attrs.FIRE_URL ?? ''}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="4" className="table-empty">
                  {state.phase === 'loading' ? 'Loading...' : 'No specimen rows.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <details className="source-widget__raw">
        <summary>Raw specimen</summary>
        <pre>{rawSpecimen || '{}'}</pre>
      </details>
    </section>
  );
}

function PageBuilderSurface({ page, label, builderActions, insideConfigure = false }) {
  const hasPlacements = page.widget_placements.some((placement) => placement.widget_id);

  return (
    <div className={`page-builder ${insideConfigure ? 'is-nested' : ''}`}>
      <div className="page-builder__bar">
        <div className="page-builder__title">{label}</div>
        <div className="page-builder__controls">
          <button type="button" className={`page-builder__button ${page.edit_mode ? 'is-active' : ''}`} onClick={() => builderActions.onToggleEdit(page.page_id)}>
            {page.edit_mode ? 'Edit on' : 'Edit off'}
          </button>
          <button type="button" className="page-builder__button" onClick={() => builderActions.onAddColumn(page.page_id)} disabled={!page.edit_mode}>
            Add column
          </button>
          <button type="button" className="page-builder__button" onClick={() => builderActions.onAddWidget(page.page_id)} disabled={!page.edit_mode}>
            Add widget
          </button>
        </div>
      </div>
      {!page.edit_mode && !hasPlacements ? (
        <div className="blank-workspace" aria-hidden="true" />
      ) : (
        <div className="page-builder__surface">
          {page.columns.length ? (
            page.columns.map((column) => {
              const placements = page.widget_placements.filter((placement) => placement.column_id === column.column_id);
              return (
                <div key={column.column_id} className="page-builder__column">
                  <div className="page-builder__column-label">{column.column_id}</div>
                  {placements.length ? (
                    placements.map((placement) => (
                      <div key={placement.placement_id} className="page-builder__slot">
                        {placement.widget_id || 'Empty widget slot'}
                      </div>
                    ))
                  ) : (
                    <div className="page-builder__slot is-empty">Empty column</div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="page-builder__empty-surface">Empty page</div>
          )}
        </div>
      )}
    </div>
  );
}
function MetaItem({ label, value }) {
  return (
    <div className="widget-object-card__item">
      <div className="widget-object-card__item-label">{label}</div>
      <div className="widget-object-card__item-value">{String(value)}</div>
    </div>
  );
}

function StatusItem({ label, value }) {
  return (
    <div className="source-widget__status-item">
      <div className="source-widget__label">{label}</div>
      <div className="source-widget__value">{String(value)}</div>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="source-widget__summary-item">
      <div className="source-widget__label">{label}</div>
      <div className="source-widget__value source-widget__value--wrap">{String(value)}</div>
    </div>
  );
}

function pct(value, stats) {
  const total =
    Number(stats?.activeOutOfControlFires || 0) +
    Number(stats?.activeBeingHeldFires || 0) +
    Number(stats?.activeUnderControlFires || 0);
  if (!total) return '0%';
  return `${Math.round((Number(value || 0) / total) * 100)}%`;
}

function displayValue(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '--';
  }
  return Number(value).toLocaleString('en-CA');
}
