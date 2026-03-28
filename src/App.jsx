import React from 'react';
import L from 'leaflet';
import { fetchBcwsPerimeterWidget } from './bcwsPerimeter.js';
import {
  ARCHIVAL_FIRE_YEAR,
  ARCHIVAL_STAGE_CODES,
  DASHBOARD_FIRE_YEAR,
  FIRE_CENTRES,
  STAGE_DEFS,
  fetchArchivalIncidentList,
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
  { id: 'configure', label: 'Settings' },
];

const STATIC_ASSET_BASE = import.meta.env.BASE_URL;
const APP_ICON_SRC = `${STATIC_ASSET_BASE}assets/icon.svg`;
const PIN_STORAGE_KEY = 'open-fireside-pinned-incidents';

const STAGE_ICON_SRC = {
  FIRE_OF_NOTE: `${STATIC_ASSET_BASE}fire-of-note.svg`,
  UNDR_CNTRL: `${STATIC_ASSET_BASE}assets/under-control.svg`,
  HOLDING: `${STATIC_ASSET_BASE}assets/being-held.svg`,
  OUT_CNTRL: `${STATIC_ASSET_BASE}assets/out-of-control.svg`,
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

function hasDesktopDbBridge() {
  return Boolean(window.openFiresideDesktop?.db);
}

async function fetchDesktopDbStatus() {
  if (!hasDesktopDbBridge()) {
    return {
      hasActiveDb: false,
      dbStateLabel: 'No DB',
      captureStateLabel: 'No DB',
      captureStateCode: 'no_db',
      name: null,
      path: null,
      createdAt: null,
      lastOpenedAt: null,
      lastCapturedAt: null,
      lastSuccessfulCaptureAt: null,
      lastCaptureError: null,
      capturedIncidentCount: 0,
      dbFileSizeBytes: 0,
      autoCheckMinutes: 0,
      autoCheckEnabled: false,
    };
  }
  return window.openFiresideDesktop.db.getStatus();
}

async function fetchLocalIncidentList() {
  if (!hasDesktopDbBridge()) {
    return { ok: false, rows: [], totalRowCount: 0, hasLocalData: false };
  }
  return window.openFiresideDesktop.db.getIncidentListLocal();
}

async function fetchLocalIncidentDetail(fireYear, incidentNumber) {
  if (!hasDesktopDbBridge()) {
    return { ok: false, found: false };
  }
  return window.openFiresideDesktop.db.getIncidentDetailLocal(fireYear, incidentNumber);
}

function pinKey(fireYear, incidentNumber) {
  return `${String(fireYear)}:${String(incidentNumber)}`;
}

function normalizePinnedIncident(record) {
  if (!record?.fireYear || !record?.incidentNumber) return null;
  return {
    fireYear: String(record.fireYear),
    incidentNumber: String(record.incidentNumber),
    incidentName: String(record.incidentName || record.incidentNumber),
    stage: String(record.stage || ''),
    fireCentre: String(record.fireCentre || ''),
    sizeHa:
      record.sizeHa === null || record.sizeHa === undefined || Number.isNaN(Number(record.sizeHa))
        ? null
        : Number(record.sizeHa),
    updatedDate: record.updatedDate ? String(record.updatedDate) : '',
    pinnedAt: record.pinnedAt ? String(record.pinnedAt) : new Date().toISOString(),
  };
}

function readBrowserPins() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PIN_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizePinnedIncident).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeBrowserPins(items) {
  window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(items));
  return items;
}

function buildPinPayload(incident) {
  if (!incident?.fireYear || !incident?.incidentNumber) return null;
  return normalizePinnedIncident({
    fireYear: incident.fireYear,
    incidentNumber: incident.incidentNumber,
    incidentName: incident.incidentName,
    stage: incident.stage,
    fireCentre: incident.fireCentre,
    sizeHa: incident.sizeHa,
    updatedDate: incident.updatedDate,
    pinnedAt: new Date().toISOString(),
  });
}

async function fetchPinnedIncidents({ preferDesktopDb = false } = {}) {
  if (preferDesktopDb && hasDesktopDbBridge() && window.openFiresideDesktop.db.getPinnedIncidents) {
    const result = await window.openFiresideDesktop.db.getPinnedIncidents();
    if (result?.ok) {
      return { ok: true, rows: (result.rows || []).map(normalizePinnedIncident).filter(Boolean), storage: 'desktop-db' };
    }
  }
  return { ok: true, rows: readBrowserPins(), storage: 'browser-local-storage' };
}

async function setPinnedIncidentRecord(record, { preferDesktopDb = false } = {}) {
  if (!record) return { ok: false, error: 'Incident pin payload is missing.', rows: [] };
  if (preferDesktopDb && hasDesktopDbBridge() && window.openFiresideDesktop.db.setIncidentPinned) {
    const result = await window.openFiresideDesktop.db.setIncidentPinned(record);
    return {
      ok: Boolean(result?.ok),
      rows: (result?.rows || []).map(normalizePinnedIncident).filter(Boolean),
      storage: 'desktop-db',
      error: result?.error || '',
    };
  }
  const next = [record, ...readBrowserPins().filter((item) => pinKey(item.fireYear, item.incidentNumber) !== pinKey(record.fireYear, record.incidentNumber))];
  return { ok: true, rows: writeBrowserPins(next), storage: 'browser-local-storage' };
}

async function removePinnedIncidentRecord(fireYear, incidentNumber, { preferDesktopDb = false } = {}) {
  if (preferDesktopDb && hasDesktopDbBridge() && window.openFiresideDesktop.db.removeIncidentPinned) {
    const result = await window.openFiresideDesktop.db.removeIncidentPinned(fireYear, incidentNumber);
    return {
      ok: Boolean(result?.ok),
      rows: (result?.rows || []).map(normalizePinnedIncident).filter(Boolean),
      storage: 'desktop-db',
      error: result?.error || '',
    };
  }
  const next = readBrowserPins().filter((item) => pinKey(item.fireYear, item.incidentNumber) !== pinKey(fireYear, incidentNumber));
  return { ok: true, rows: writeBrowserPins(next), storage: 'browser-local-storage' };
}

async function fetchCaptureSummary() {
  if (!hasDesktopDbBridge() || !window.openFiresideDesktop.db.getCaptureSummary) {
    return {
      listedIncidentCount: 0,
      detailArchivedCount: 0,
      detailFailureCount: 0,
      attachmentsMetadataCount: 0,
      localMediaIncidentCount: 0,
      externalLinksMetadataCount: 0,
      perimeterPayloadCount: 0,
      responseHistoryCount: 0,
      mediaRecordCount: 0,
      thumbnailStoredCount: 0,
      fullImageStoredCount: 0,
      totalMediaBytes: 0,
      archivalFireYear: 0,
      endpointTotalRowCount: 0,
      endpointRowsFetched: 0,
      endpointPageCount: 0,
      persistedIncidentCount: 0,
      completenessStatus: 'partial',
      completenessWarning: '',
      queryScope: {},
      lastRun: null,
      failureCategoryCounts: {},
    };
  }
  return window.openFiresideDesktop.db.getCaptureSummary();
}

async function fetchCaptureRuntime() {
  if (!hasDesktopDbBridge() || !window.openFiresideDesktop.db.getCaptureRuntime) {
    return {
      activeRun: null,
      lastRun: null,
      dbFileSizeBytes: 0,
      lastSuccessfulCaptureAt: null,
    };
  }
  return window.openFiresideDesktop.db.getCaptureRuntime();
}

async function fetchCaptureTargets() {
  if (!hasDesktopDbBridge() || !window.openFiresideDesktop.db.getCaptureTargets) {
    return { ok: false, incompleteKeys: [], incompleteKeySet: {}, recordedCount: 0 };
  }
  return window.openFiresideDesktop.db.getCaptureTargets();
}

async function runIncidentCapture({ trigger = 'manual' } = {}) {
  if (!hasDesktopDbBridge()) {
    return { ok: false, error: 'Desktop DB bridge unavailable.' };
  }

  const dbApi = window.openFiresideDesktop.db;
  const capturedAt = new Date().toISOString();
  let listRows = [];
  let targetRows = [];
  let listMetadata = {
    fireYear: ARCHIVAL_FIRE_YEAR,
    totalRowCount: 0,
    endpointRowsFetched: 0,
    pageCountFetched: 0,
    queryScope: {
      fireYear: ARCHIVAL_FIRE_YEAR,
      fireCentreName: '',
      stageCodes: ARCHIVAL_STAGE_CODES,
      searchText: '',
      newFires: false,
      orderBy: 'lastUpdatedTimestamp DESC',
    },
  };
  const detailRecords = [];
  const detailFailures = [];
  try {
    await dbApi.markCaptureRunning({
      trigger,
      startedAt: capturedAt,
      archivalFireYear: ARCHIVAL_FIRE_YEAR,
      currentStageKey: 'list_ingest',
      currentStageLabel: 'List ingest',
      currentArtifactLabel: 'archival pagination',
      currentActivity: `Loading 2025 archival incident pages`,
    });
    const listPayload = await fetchArchivalIncidentList({
      fireYear: ARCHIVAL_FIRE_YEAR,
      stageCodes: ARCHIVAL_STAGE_CODES,
      pageRowCount: 200,
      onProgress: async (progress) => {
        await dbApi.markCaptureProgress({
          archivalFireYear: ARCHIVAL_FIRE_YEAR,
          endpointTotalRowCount: progress.endpointTotalRowCount,
          endpointRowsFetched: progress.endpointRowsFetched,
          endpointPageCount: progress.pageCountFetched,
          listedIncidentCount: progress.matchingRowsFetched,
          currentStageKey: 'list_ingest',
          currentStageLabel: 'List ingest',
          currentArtifactLabel: 'archival pagination',
          currentActivity: `Fetched page ${progress.pageNumber}; ${progress.matchingRowsFetched} matching 2025 rows of ${progress.endpointTotalRowCount || '?'}`,
          forcePersist: true,
        });
      },
    });
    listRows = listPayload.rows || [];
    listMetadata = {
      fireYear: listPayload.fireYear || ARCHIVAL_FIRE_YEAR,
      totalRowCount: listPayload.totalRowCount || listRows.length,
      endpointRowsFetched: listPayload.endpointRowsFetched || listRows.length,
      pageCountFetched: listPayload.pageCountFetched || 0,
      queryScope: listPayload.queryScope || listMetadata.queryScope,
    };
    const captureTargets = await fetchCaptureTargets();
    const incompleteSet = new Set(Object.keys(captureTargets?.incompleteKeySet || {}));
    targetRows = captureTargets?.recordedCount
      ? listRows.filter((row) => incompleteSet.has(`${String(row.fireYear)}:${String(row.incidentNumber)}`))
      : incompleteSet.size
      ? listRows.filter((row) => incompleteSet.has(`${String(row.fireYear)}:${String(row.incidentNumber)}`))
      : listRows;
    await dbApi.markCaptureProgress({
      archivalFireYear: listMetadata.fireYear,
      endpointTotalRowCount: listMetadata.totalRowCount,
      endpointRowsFetched: listMetadata.endpointRowsFetched,
      endpointPageCount: listMetadata.pageCountFetched,
      listedIncidentCount: listRows.length,
      targetedIncidentCount: targetRows.length,
      currentStageKey: 'detail',
      currentStageLabel: 'Detail capture',
      currentArtifactLabel: 'detail + attachments + external links + perimeter',
      currentActivity: `Capturing details for ${targetRows.length} incidents`,
      forcePersist: true,
    });
    const chunkSize = 8;
    for (let index = 0; index < targetRows.length; index += chunkSize) {
      const chunk = targetRows.slice(index, index + chunkSize);
      const chunkLead = chunk[0];
      await dbApi.markCaptureProgress({
        archivalFireYear: listMetadata.fireYear,
        endpointTotalRowCount: listMetadata.totalRowCount,
        endpointRowsFetched: listMetadata.endpointRowsFetched,
        endpointPageCount: listMetadata.pageCountFetched,
        listedIncidentCount: listRows.length,
        targetedIncidentCount: targetRows.length,
        completedIncidentCount: detailRecords.length,
        failedIncidentCount: detailFailures.length,
        currentStageKey: 'detail',
        currentStageLabel: 'Detail capture',
        currentArtifactLabel: 'detail + attachments + external links + perimeter',
        currentIncidentName: chunkLead?.incidentName || '',
        currentIncidentNumber: chunkLead?.incidentNumber || '',
        currentActivity: `Capturing incident details ${Math.min(index + 1, targetRows.length)}-${Math.min(
          index + chunk.length,
          targetRows.length
        )} of ${targetRows.length}`,
      });
      const settled = await Promise.all(
        chunk.map(async (row) => {
          try {
            const detail = await fetchIncidentDetail(row.fireYear, row.incidentNumber, row);
            return { ok: true, row, detail };
          } catch (error) {
            return {
              ok: false,
              row,
              error: error instanceof Error ? error.message : 'Detail capture failed',
            };
          }
        })
      );
      settled.forEach((result) => {
        if (result.ok) {
          detailRecords.push(result.detail);
          return;
        }
        detailFailures.push({
          fireYear: result.row.fireYear,
          incidentNumber: result.row.incidentNumber,
          error: result.error,
        });
      });
      await dbApi.markCaptureProgress({
        archivalFireYear: listMetadata.fireYear,
        endpointTotalRowCount: listMetadata.totalRowCount,
        endpointRowsFetched: listMetadata.endpointRowsFetched,
        endpointPageCount: listMetadata.pageCountFetched,
        listedIncidentCount: listRows.length,
        targetedIncidentCount: targetRows.length,
        completedIncidentCount: detailRecords.length,
        failedIncidentCount: detailFailures.length,
        currentStageKey: 'detail',
        currentStageLabel: 'Detail capture',
        currentArtifactLabel: 'detail + attachments + external links + perimeter',
        currentIncidentName: '',
        currentIncidentNumber: '',
        currentActivity: `Captured detail for ${detailRecords.length} incidents; ${detailFailures.length} failed`,
      });
    }

    await dbApi.markCaptureProgress({
      archivalFireYear: listMetadata.fireYear,
      endpointTotalRowCount: listMetadata.totalRowCount,
      endpointRowsFetched: listMetadata.endpointRowsFetched,
      endpointPageCount: listMetadata.pageCountFetched,
      listedIncidentCount: listRows.length,
      targetedIncidentCount: targetRows.length,
      completedIncidentCount: detailRecords.length,
      failedIncidentCount: detailFailures.length,
      currentStageKey: 'persisting',
      currentStageLabel: 'Persisting run',
      currentArtifactLabel: 'SQLite archive',
      currentActivity: `Writing ${detailRecords.length} archived incidents and media to SQLite`,
      forcePersist: true,
    });
    const saved = await dbApi.saveCapture({
      trigger,
      capturedAt,
      listRows,
      detailRecords,
      detailFailures,
      listMetadata,
    });
    if (!saved?.ok) {
      throw new Error(saved?.error || 'Capture write failed.');
    }

    const metrics = await dbApi.getCaptureMetrics();
    return {
      ok: true,
      saved,
      metrics,
      capturedListCount: saved.capturedListCount ?? listRows.length,
      capturedDetailCount: saved.capturedDetailCount ?? detailRecords.length,
      detailFailureCount: detailFailures.length,
      targetedIncidentCount: targetRows.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Incident capture failed';
    await dbApi.markCaptureError(message, {
      trigger,
      startedAt: capturedAt,
      archivalFireYear: listMetadata.fireYear,
      endpointTotalRowCount: listMetadata.totalRowCount,
      endpointRowsFetched: listMetadata.endpointRowsFetched,
      endpointPageCount: listMetadata.pageCountFetched,
      listedIncidentCount: listRows.length,
      targetedIncidentCount: targetRows.length,
      completedIncidentCount: detailRecords.length,
      failedIncidentCount: detailFailures.length,
    });
    return { ok: false, error: message };
  }
}

export default function App() {
  const route = useHashRoute();
  const [configureTab, setConfigureTab] = React.useState('sources');
  const [pageLayouts, setPageLayouts] = React.useState(initialPageLayouts);
  const [pinnedIncidents, setPinnedIncidents] = React.useState([]);
  const [pinStorageKind, setPinStorageKind] = React.useState('browser-local-storage');
  const [dbStatus, setDbStatus] = React.useState({
    hasActiveDb: false,
    dbStateLabel: 'No DB',
    captureStateLabel: 'No DB',
    captureStateCode: 'no_db',
    name: null,
    path: null,
    createdAt: null,
    lastOpenedAt: null,
    lastCapturedAt: null,
    lastSuccessfulCaptureAt: null,
    lastCaptureError: null,
    capturedIncidentCount: 0,
    dbFileSizeBytes: 0,
    autoCheckMinutes: 0,
    autoCheckEnabled: false,
  });
  const captureInFlightRef = React.useRef(false);

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

  const refreshDbStatus = React.useCallback(async () => {
    const next = await fetchDesktopDbStatus();
    setDbStatus(next);
    return next;
  }, []);

  const refreshPinnedIncidents = React.useCallback(
    async (nextDbStatus = dbStatus) => {
      const result = await fetchPinnedIncidents({ preferDesktopDb: Boolean(nextDbStatus?.hasActiveDb) });
      if (result?.ok) {
        setPinnedIncidents(result.rows || []);
        setPinStorageKind(result.storage || 'browser-local-storage');
      }
      return result;
    },
    [dbStatus]
  );

  React.useEffect(() => {
    refreshDbStatus();
  }, [refreshDbStatus]);

  React.useEffect(() => {
    refreshPinnedIncidents(dbStatus);
  }, [dbStatus, refreshPinnedIncidents]);

  React.useEffect(() => {
    const onStorage = (event) => {
      if (event.key && event.key !== PIN_STORAGE_KEY) return;
      refreshPinnedIncidents(dbStatus);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [dbStatus, refreshPinnedIncidents]);

  const togglePinnedIncident = React.useCallback(
    async (incident, shouldPin) => {
      const payload = buildPinPayload(incident);
      if (!payload) {
        return { ok: false, error: 'Incident pin payload is missing.' };
      }
      const result = shouldPin
        ? await setPinnedIncidentRecord(payload, { preferDesktopDb: Boolean(dbStatus.hasActiveDb) })
        : await removePinnedIncidentRecord(payload.fireYear, payload.incidentNumber, {
            preferDesktopDb: Boolean(dbStatus.hasActiveDb),
          });
      if (result?.ok) {
        setPinnedIncidents(result.rows || []);
        setPinStorageKind(result.storage || (dbStatus.hasActiveDb ? 'desktop-db' : 'browser-local-storage'));
      }
      return result;
    },
    [dbStatus.hasActiveDb]
  );

  const pinnedIncidentKeySet = React.useMemo(
    () => new Set(pinnedIncidents.map((item) => pinKey(item.fireYear, item.incidentNumber))),
    [pinnedIncidents]
  );

  const captureIncidents = React.useCallback(
    async (options = {}) => {
      if (captureInFlightRef.current) {
        return { ok: false, error: 'Capture is already running.' };
      }
      captureInFlightRef.current = true;
      const result = await runIncidentCapture(options);
      await refreshDbStatus();
      captureInFlightRef.current = false;
      return result;
    },
    [refreshDbStatus]
  );

  React.useEffect(() => {
    if (!hasDesktopDbBridge() || !window.openFiresideDesktop.db.onAutoCheckTick) return undefined;
    const unsubscribe = window.openFiresideDesktop.db.onAutoCheckTick(async () => {
      if (captureInFlightRef.current) return;
      await captureIncidents({ trigger: 'auto-check' });
    });
    return unsubscribe;
  }, [captureIncidents]);

  return (
    <div className="app-shell">
      <main className="shell-frame">
        <aside className="left-rail">
          <div className="brand-block">
            <img src={APP_ICON_SRC} alt="" className="brand-icon" aria-hidden="true" />
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
          {route.id === 'dashboard' ? (
            <DashboardPage
              dbStatus={dbStatus}
              pinnedIncidents={pinnedIncidents}
              pinStorageKind={pinStorageKind}
            />
          ) : null}
          {route.id === 'incidents' ? (
            <IncidentsListPage dbStatus={dbStatus} pinnedIncidentKeySet={pinnedIncidentKeySet} />
          ) : null}
          {route.id === 'incident-detail' ? (
            <IncidentDetailPage
              fireYear={route.fireYear}
              incidentNumber={route.incidentNumber}
              dbStatus={dbStatus}
              pinnedIncidentKeySet={pinnedIncidentKeySet}
              onTogglePinnedIncident={togglePinnedIncident}
            />
          ) : null}
          {route.id === 'weather' ? <PlaceholderPage title="Weather" message="Weather workflow is not wired in this runtime yet." /> : null}
          {route.id === 'maps' ? (
            <PlaceholderPage
              title="Maps"
              message="Standalone map workspace is not wired yet. Use incident pages for the currently available perimeter and map-download views."
            />
          ) : null}
          {route.id === 'discourse' ? <PlaceholderPage title="Discourse" message="Discourse workflow is not wired in this runtime yet." /> : null}
          {route.id === 'configure' ? (
            <SettingsHonestyPage
              dbStatus={dbStatus}
              onDbStatusChange={refreshDbStatus}
              onCaptureIncidents={captureIncidents}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}

function PageHeader({ title, subtitle = '', chips = [], actions = null }) {
  return (
    <div className="page-header">
      <div className="page-header__identity">
        <div className="page-header__title-row">
          <h1 className="page-header__title">{title}</h1>
          {subtitle ? <div className="page-header__subtitle">{subtitle}</div> : null}
        </div>
        {chips.length ? (
          <div className="source-health-row page-header__chips" aria-label={`${title} status`}>
            {chips.map((chip) => (
              <SourceHealthChip key={`${chip.label}-${chip.status}`} label={chip.label} status={chip.status} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="page-header__actions">{actions}</div>
    </div>
  );
}

function ToolbarField({ label, children }) {
  return (
    <label className="toolbar-field">
      <span className="toolbar-field__label">{label}</span>
      {children}
    </label>
  );
}

function SettingsSectionCard({ title, eyebrow = '', children, className = '' }) {
  return (
    <section className={`settings-section-card ${className}`.trim()}>
      <div className="settings-section-card__header">
        {eyebrow ? <div className="settings-section-card__eyebrow">{eyebrow}</div> : null}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SettingsDataGrid({ items }) {
  const rows = (items || []).filter((item) => item && item.label);
  return (
    <div className="settings-data-grid">
      {rows.map((item) => (
        <div key={item.label} className="settings-data-grid__item">
          <div className="settings-data-grid__label">{item.label}</div>
          <div className="settings-data-grid__value">{item.value ?? '--'}</div>
        </div>
      ))}
    </div>
  );
}

function CaptureStatusGrid({ items }) {
  const rows = (items || []).filter((item) => item && item.label);
  return (
    <div className="capture-status-grid">
      {rows.map((item) => (
        <div key={item.label} className="capture-status-grid__item">
          <div className="capture-status-grid__label">{item.label}</div>
          <div className="capture-status-grid__value">{item.value ?? '--'}</div>
        </div>
      ))}
    </div>
  );
}

function DashboardPage({ dbStatus, pinnedIncidents, pinStorageKind }) {
  const [state, setState] = React.useState({
    phase: 'loading',
    error: '',
    data: null,
    captureSummary: null,
  });

  const load = React.useCallback(async () => {
    setState((current) => ({
      phase: 'loading',
      error: '',
      data: current.data,
      captureSummary: current.captureSummary,
    }));
    try {
      const [data, captureSummary] = await Promise.all([fetchDashboardData(), fetchCaptureSummary()]);
      setState({ phase: 'success', error: '', data, captureSummary });
    } catch (error) {
      setState((current) => ({
        phase: 'failure',
        error: error.message || 'Failed to load dashboard',
        data: current.data,
        captureSummary: current.captureSummary,
      }));
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const stats = state.data?.stats;
  const captureSummary = state.captureSummary;
  const activeCount = stats
    ? (stats.activeOutOfControlFires || 0) +
      (stats.activeBeingHeldFires || 0) +
      (stats.activeUnderControlFires || 0)
    : null;
  const sourceSignals = React.useMemo(
    () => [
      {
        label: 'Incidents',
        status: dbStatus.hasActiveDb ? dbStatus.captureStateCode : 'no_db',
      },
      { label: 'Weather', status: 'not_wired' },
      { label: 'Discourse', status: 'not_wired' },
      { label: 'Archive', status: dbStatus.hasActiveDb ? 'db_selected' : 'no_db' },
    ],
    [dbStatus.captureStateCode, dbStatus.hasActiveDb]
  );

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle="Live BCWS snapshot with local archive context."
        chips={sourceSignals}
        actions={
          <button type="button" className="refresh-chip" onClick={load}>
            Refresh
          </button>
        }
      />

      {state.phase === 'failure' ? <div className="error-banner">{state.error}</div> : null}

      <div className="dashboard-grid">
        <section className="dashboard-main-card dashboard-grid__map">
          <div className="card-title-row">
            <div className="card-title">Wildfire Overview</div>
            <div className="dashboard-updated">
              {stats?.updateDate ? `Live update ${formatDateTime(stats.updateDate)}` : 'Live BCWS feed'}
            </div>
          </div>
          <div className="stage-legend is-inline">
            {['FIRE_OF_NOTE', 'UNDR_CNTRL', 'HOLDING', 'OUT_CNTRL'].map((code) => (
              <div key={code} className="legend-item">
                <StageGlyph code={code} />
                <span>{STAGE_DEFS[code].label}</span>
              </div>
            ))}
          </div>
          <DashboardMap mapLayers={state.data?.mapLayers} />
        </section>

        <div className="dashboard-overview-stack dashboard-grid__overview">
          <div className="metrics-card-grid is-four">
            <MetricCard label="Active wildfires" value={displayValue(activeCount)} />
            <MetricCard label="New in 24 hours" value={displayValue(stats?.newFires24Hours)} />
            <MetricCard label="Controlled or out in 24 hours" value={displayValue(stats?.outFires24Hours)} />
            <MetricCard label="Controlled or out in 7 days" value={displayValue(stats?.outFires7Days)} />
          </div>

          <StageControlPanel stats={stats} />

          <FireCentreTable statsList={state.data?.fireCentreStats || []} />

          <ArchiveTotalsPanel captureSummary={captureSummary} hasActiveDb={dbStatus.hasActiveDb} />

          <div className="dashboard-evac-grid">
            <MetricCard label="Evacuation Orders" value={displayValue(state.data?.evacuations.orders)} large />
            <MetricCard label="Evacuation Alerts" value={displayValue(state.data?.evacuations.alerts)} large />
          </div>
        </div>

        <StubPanel title="Discourse Signals" className="dashboard-discourse dashboard-grid__discourse" />
        <PinnedIncidentsPanel
          className="dashboard-pinned dashboard-grid__pinned"
          hasActiveDb={dbStatus.hasActiveDb}
          pinnedIncidents={pinnedIncidents}
          pinStorageKind={pinStorageKind}
        />
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
    requestAnimationFrame(() => {
      map.invalidateSize();
    });
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
        const row = statsList.find((item) => item?.fireCentre === name) || null;
        const out = row?.activeOutOfControlFires;
        const held = row?.activeBeingHeldFires;
        const under = row?.activeUnderControlFires;
        const active = row ? Number(out || 0) + Number(held || 0) + Number(under || 0) : null;
        return (
          <div key={name} className="fire-centre-table__row">
            <span>{name.replace(' Fire Centre', '')}</span>
            <span>{displayValue(active)}</span>
            <span>{displayValue(out)}</span>
            <span>{displayValue(held)}</span>
            <span>{displayValue(under)}</span>
          </div>
        );
      })}
    </div>
  );
}

function IncidentsListPage({ dbStatus, pinnedIncidentKeySet }) {
  const [search, setSearch] = React.useState('');
  const [fireCentre, setFireCentre] = React.useState('');
  const [quickFilter, setQuickFilter] = React.useState('all');
  const [selectedStages, setSelectedStages] = React.useState(['OUT_CNTRL', 'HOLDING', 'UNDR_CNTRL', 'OUT']);
  const [sortState, setSortState] = React.useState({ key: 'updatedDate', direction: 'desc' });
  const [state, setState] = React.useState({ phase: 'loading', error: '', rows: [], source: 'live' });
  const columnDefs = React.useMemo(
    () => ({
      incidentName: { label: 'Wildfire Name', type: 'text' },
      stage: { label: 'Stage of Control', type: 'text' },
      sizeHa: { label: 'Size', type: 'number' },
      affordances: { label: 'Archive', type: 'text' },
      fireCentre: { label: 'Fire Centre', type: 'text' },
      location: { label: 'Location', type: 'text' },
      discoveryDate: { label: 'Discovery Date', type: 'date' },
      updatedDate: { label: 'Last Updated', type: 'date' },
    }),
    []
  );

  const load = React.useCallback(async () => {
    setState((current) => ({ ...current, phase: 'loading', error: '' }));
    try {
      if (hasDesktopDbBridge()) {
        const local = await fetchLocalIncidentList();
        if (local?.ok && local?.hasLocalData) {
          setState({ phase: 'success', error: '', rows: local.rows, source: 'local' });
          return;
        }
      }
      const data = await fetchIncidentList({ search, fireCentre, stageCodes: selectedStages, pageRowCount: 500 });
      setState({ phase: 'success', error: '', rows: data.rows, source: 'live' });
    } catch (error) {
      setState({ phase: 'failure', error: error.message || 'Failed to load incidents', rows: [], source: 'live' });
    }
  }, [search, fireCentre, selectedStages]);

  React.useEffect(() => {
    load();
  }, [load]);

  const rows = React.useMemo(() => {
    const searchNeedle = search.trim().toLowerCase();
    const filtered = [...state.rows].filter((row) => {
      if (quickFilter === 'fireOfNote' && !row.fireOfNote) return false;
      if (fireCentre && row.fireCentre !== fireCentre) return false;
      if (selectedStages.length && !selectedStages.includes(row.stage)) return false;
      if (!searchNeedle) return true;
      const haystack = `${row.incidentName || ''} ${row.incidentNumber || ''} ${row.location || ''}`.toLowerCase();
      return haystack.includes(searchNeedle);
    });
    filtered.sort((a, b) => compareRows(a, b, sortState, columnDefs));
    return filtered;
  }, [columnDefs, fireCentre, quickFilter, search, selectedStages, sortState, state.rows]);

  const sortOptions = React.useMemo(
    () => [
      { value: 'updatedDate:desc', label: 'Last Updated (Newest)' },
      { value: 'updatedDate:asc', label: 'Last Updated (Oldest)' },
      { value: 'discoveryDate:desc', label: 'Discovery Date (Newest)' },
      { value: 'discoveryDate:asc', label: 'Discovery Date (Oldest)' },
      { value: 'incidentName:asc', label: 'Wildfire Name (A-Z)' },
      { value: 'incidentName:desc', label: 'Wildfire Name (Z-A)' },
      { value: 'fireCentre:asc', label: 'Fire Centre (A-Z)' },
      { value: 'fireCentre:desc', label: 'Fire Centre (Z-A)' },
    ],
    []
  );

  const handleSortDropdownChange = (event) => {
    const [key, direction] = event.target.value.split(':');
    setSortState({ key, direction });
  };

  const handleHeaderSort = (key) => {
    setSortState((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return {
        key,
        direction: columnDefs[key]?.type === 'text' ? 'asc' : 'desc',
      };
    });
  };

  const toggleStage = (code) => {
    setSelectedStages((current) => {
      if (current.length === 1 && current[0] === code) {
        return ['OUT_CNTRL', 'HOLDING', 'UNDR_CNTRL', 'OUT'];
      }
      return [code];
    });
  };

  const stageIsExclusive = (code) => selectedStages.length === 1 && selectedStages[0] === code;
  const activeFilters = [];
  if (quickFilter === 'fireOfNote') activeFilters.push('Fire of note only');
  if (fireCentre) activeFilters.push(fireCentre);
  if (selectedStages.length === 1) activeFilters.push(stageLabel(selectedStages[0]));
  const resultsLabel = activeFilters.length ? `Filtered by ${activeFilters.join(' | ')}` : 'All active incidents';
  const sourceLabel =
    state.source === 'local'
      ? 'Local archive incidents'
      : dbStatus.hasActiveDb
      ? 'Live BCWS fallback for list rows'
      : 'Live BCWS incidents';
  const headerChips = [
    { label: 'Source', status: state.source === 'local' ? 'db_selected' : dbStatus.hasActiveDb ? 'browser_fallback' : 'healthy' },
    { label: 'Archive', status: dbStatus.hasActiveDb ? 'db_selected' : 'no_db' },
  ];

  return (
    <div className="incidents-page">
      <PageHeader
        title="Incidents"
        subtitle={sourceLabel}
        chips={headerChips}
        actions={
          <button type="button" className="refresh-chip" onClick={load}>
            Refresh
          </button>
        }
      />
      <section className="list-control-panel">
        <div className="list-toolbar">
          <ToolbarField label="Search">
            <input
              className="toolbar-input"
              placeholder="Fire name, number, or location"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </ToolbarField>
          <ToolbarField label="Quick filter">
            <select className="toolbar-input" value={quickFilter} onChange={(event) => setQuickFilter(event.target.value)}>
              <option value="all">All incidents</option>
              <option value="fireOfNote">Fire of note only</option>
            </select>
          </ToolbarField>
          <ToolbarField label="Fire centre">
            <select className="toolbar-input" value={fireCentre} onChange={(event) => setFireCentre(event.target.value)}>
              <option value="">All fire centres</option>
              {FIRE_CENTRES.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </ToolbarField>
          <ToolbarField label="Sort">
            <select className="toolbar-input toolbar-select" value={`${sortState.key}:${sortState.direction}`} onChange={handleSortDropdownChange}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </ToolbarField>
        </div>

        <div className="list-meta-strip">
          <div className="list-results-label">{resultsLabel}</div>
          <div className="list-results-label">{`${rows.length} incidents shown`}</div>
          <div className="list-results-label">{sourceLabel}</div>
        </div>

        <div className="stage-toggle-row list-stage-row">
          {['OUT_CNTRL', 'HOLDING', 'UNDR_CNTRL', 'OUT'].map((code) => (
            <button
              key={code}
              type="button"
              className={`stage-toggle ${stageIsExclusive(code) ? 'is-active' : ''}`}
              data-stage={code}
              onClick={() => toggleStage(code)}
            >
              {stageLabel(code)}
            </button>
          ))}
        </div>
      </section>

      {state.phase === 'failure' ? <div className="error-banner">{state.error}</div> : null}

      <div className="table-shell">
        <table className="incident-table">
          <thead>
            <tr>
              {Object.entries(columnDefs).map(([key, column]) => (
                <th key={key}>
                  <button
                    type="button"
                    className={`table-sort ${sortState.key === key ? 'is-active' : ''}`}
                    onClick={() => handleHeaderSort(key)}
                  >
                    <span>{column.label}</span>
                    <span className="table-sort__direction">{sortIndicator(sortState, key, column.type)}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.fireYear}-${row.incidentNumber}`} onClick={() => navigateTo(`/incidents/${row.fireYear}/${encodeURIComponent(row.incidentNumber)}`)}>
                <td>
                  <div className="incident-name-cell">
                    {pinnedIncidentKeySet.has(pinKey(row.fireYear, row.incidentNumber)) ? (
                      <PinnedPill compact />
                    ) : null}
                    <button type="button" className="incident-link" onClick={(event) => { event.stopPropagation(); navigateTo(`/incidents/${row.fireYear}/${encodeURIComponent(row.incidentNumber)}`); }}>
                      {row.incidentName}
                      <span className="incident-link__meta">({row.incidentNumber})</span>
                    </button>
                  </div>
                </td>
                <td>
                  <span className={`stage-pill stage-pill--${row.stage}`}>{stageLabel(row.stage)}</span>
                </td>
                <td>{formatSizeHa(row.sizeHa)}</td>
                <td><IncidentAffordanceRow affordances={row.affordances} /></td>
                <td>{row.fireCentre}</td>
                <td>{row.location || '—'}</td>
                <td>{formatDate(row.discoveryDate)}</td>
                <td>{formatDate(row.updatedDate)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan="8" className="table-empty">{state.phase === 'loading' ? 'Loading incidents…' : 'No incidents matched the current filters.'}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatMissingArtifacts(missingArtifacts) {
  const items = (missingArtifacts || []).filter(Boolean);
  return items.length ? items.join(', ') : 'required local artifacts are incomplete';
}

function responseSourceNote(source, captureStatus) {
  if (source === 'local') {
    return captureStatus?.hasResponseHistory
      ? 'Response source: Local DB history extracted from archived detail payload.'
      : 'Response source: Local DB detail. No response-history entries were extracted for this incident.';
  }
  if (source === 'mixed') {
    return `Response source: Live BCWS fallback. Local DB response history: ${
      captureStatus?.hasResponseHistory ? 'yes' : 'no'
    }.`;
  }
  return 'Response source: Live BCWS.';
}

function getGalleryMediaState(attachments, pageSource, captureStatus) {
  const items = Array.isArray(attachments) ? attachments : [];
  const renderable = items.filter((asset) => asset?.localMedia || asset?.imageUrl || asset?.thumbnailUrl);
  if (!renderable.length) {
    return 'unavailable';
  }
  const localCount = renderable.filter((asset) => asset?.localMedia).length;
  if (localCount === renderable.length) {
    return 'local';
  }
  if (localCount > 0 || captureStatus?.hasAttachmentsMetadata) {
    return 'mixed';
  }
  return pageSource === 'live' ? 'live' : 'mixed';
}

function gallerySourceNote(galleryState, attachments, captureStatus) {
  const items = Array.isArray(attachments) ? attachments : [];
  const renderable = items.filter((asset) => asset?.localMedia || asset?.imageUrl || asset?.thumbnailUrl);
  const localCount = renderable.filter((asset) => asset?.localMedia).length;
  if (galleryState === 'local') {
    return `Gallery source: Local media from SQLite. Local image bytes available for ${localCount} of ${renderable.length} assets.`;
  }
  if (galleryState === 'mixed') {
    return `Gallery source: Local metadata + live image fallback. Local image bytes available for ${localCount} of ${renderable.length} assets.`;
  }
  if (galleryState === 'live') {
    return `Gallery source: Live BCWS only. Local attachment metadata: ${captureStatus?.hasAttachmentsMetadata ? 'yes' : 'no'}.`;
  }
  return 'Gallery source: Unavailable. No local image bytes or live image URLs are available for this incident.';
}

function base64ToBlob(base64, mimeType) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

function isMapAttachment(asset) {
  const mimeType = String(asset?.mimeType || '').toLowerCase();
  const title = String(asset?.title || asset?.fileName || '').toLowerCase();
  const description = String(asset?.description || '').toLowerCase();
  return (
    mimeType.includes('pdf') ||
    mimeType.includes('geopdf') ||
    title.includes('map') ||
    title.includes('perimeter') ||
    description.includes('map') ||
    description.includes('perimeter')
  );
}

function isMapLink(link) {
  const category = String(link?.category || '').toLowerCase();
  const label = String(link?.label || '').toLowerCase();
  const url = String(link?.url || '').toLowerCase();
  return (
    category.includes('map') ||
    category.includes('pdf') ||
    label.includes('map') ||
    label.includes('perimeter') ||
    label.includes('document') ||
    url.includes('.pdf')
  );
}

function getMapResources(data) {
  const attachmentDocs = (Array.isArray(data?.attachments) ? data.attachments : []).filter(isMapAttachment);
  const externalDocs = (Array.isArray(data?.externalLinks) ? data.externalLinks : []).filter(isMapLink);
  return { attachmentDocs, externalDocs };
}

function getAttachmentDownloadUrl(incident, asset) {
  if (asset?.downloadUrl) return asset.downloadUrl;
  if (!incident?.incidentNumber || !asset?.attachmentGuid) return '';
  const fireYear = incident?.fireYear ? `?fireYear=${encodeURIComponent(incident.fireYear)}` : '';
  return `https://wildfiresituation.nrs.gov.bc.ca/wfnews-api/publicPublishedIncidentAttachment/${encodeURIComponent(
    incident.incidentNumber
  )}/attachments/${encodeURIComponent(asset.attachmentGuid)}/bytes${fireYear}`;
}

function mapsSourceNote(source, captureStatus) {
  if (source === 'local') {
    return 'Maps source: Local perimeter and external-link metadata. Link targets still open live URLs.';
  }
  if (source === 'mixed') {
    return `Maps source: Live BCWS fallback. Local perimeter: ${
      captureStatus?.hasPerimeterPayload ? 'yes' : 'no'
    } | local external links: ${captureStatus?.hasExternalLinksMetadata ? 'yes' : 'no'}.`;
  }
  return 'Maps source: Live BCWS.';
}

function mergeLiveIncidentWithLocalMedia(localData, liveData) {
  const localMediaByAttachmentGuid = new Map(
    (localData?.attachments || [])
      .filter((asset) => asset?.attachmentGuid && asset?.localMedia)
      .map((asset) => [String(asset.attachmentGuid), asset.localMedia])
  );
  return {
    ...liveData,
    attachments: Array.isArray(liveData?.attachments)
      ? liveData.attachments.map((asset) => ({
          ...asset,
          localMedia: localMediaByAttachmentGuid.get(String(asset?.attachmentGuid || '')) || null,
        }))
      : [],
  };
}

function IncidentDetailPage({ fireYear, incidentNumber, dbStatus, pinnedIncidentKeySet, onTogglePinnedIncident }) {
  const [tab, setTab] = React.useState('response');
  const [lightbox, setLightbox] = React.useState(null);
  const [state, setState] = React.useState({
    phase: 'loading',
    error: '',
    data: null,
    source: 'live',
    captureStatus: null,
    sourceReason: '',
  });

  const load = React.useCallback(async () => {
    setState({ phase: 'loading', error: '', data: null, source: 'live', captureStatus: null, sourceReason: '' });
    try {
      if (hasDesktopDbBridge()) {
        const local = await fetchLocalIncidentDetail(fireYear, incidentNumber);
        if (local?.ok && local?.found) {
          if (local.hasCompleteLocalDetail) {
            setState({
              phase: 'success',
              error: '',
              data: local.data,
              source: 'local',
              captureStatus: local.captureStatus || null,
              sourceReason: '',
            });
            return;
          }
          const live = await fetchIncidentDetail(fireYear, incidentNumber, local.data?.incident || null);
          setState({
            phase: 'success',
            error: '',
            data: mergeLiveIncidentWithLocalMedia(local.data, live),
            source: 'mixed',
            captureStatus: local.captureStatus || null,
            sourceReason:
              local.captureStatus?.lastCaptureError ||
              `Missing local artifacts: ${formatMissingArtifacts(local.missingArtifacts)}`,
          });
          return;
        }
      }
      const data = await fetchIncidentDetail(fireYear, incidentNumber);
      setState({ phase: 'success', error: '', data, source: 'live', captureStatus: null, sourceReason: '' });
    } catch (error) {
      setState({
        phase: 'failure',
        error: error.message || 'Failed to load incident',
        data: null,
        source: 'live',
        captureStatus: null,
        sourceReason: '',
      });
    }
  }, [fireYear, incidentNumber]);

  React.useEffect(() => { load(); }, [load]);

  const incident = state.data?.incident;
  const response = state.data?.response;
  const isPinned = pinnedIncidentKeySet.has(pinKey(fireYear, incidentNumber));
  const galleryState = getGalleryMediaState(state.data?.attachments, state.source, state.captureStatus);
  const mapResources = getMapResources(state.data);
  const detailSourceLabel =
    state.source === 'local'
      ? 'Local DB capture'
      : state.source === 'mixed'
      ? `Partial local detail + live fallback${state.sourceReason ? ` (${state.sourceReason})` : ''}`
      : dbStatus.hasActiveDb
      ? 'Live BCWS fallback (no local detail record)'
      : 'Live BCWS';
  const headerChips = [
    {
      label: 'Detail',
      status: state.source === 'local' ? 'db_selected' : state.source === 'mixed' ? 'browser_fallback' : 'healthy',
    },
    { label: 'Storage', status: dbStatus.hasActiveDb ? 'db_selected' : 'no_db' },
  ];

  return (
    <div className="incident-detail-page">
      <PageHeader
        title={incident?.incidentName || incidentNumber}
        subtitle={`${incident?.incidentNumber || incidentNumber} · ${incident?.fireCentre || 'Incident detail'}`}
        chips={headerChips}
        actions={
          <>
            <button
              type="button"
              className={`refresh-chip refresh-chip--secondary pin-action ${isPinned ? 'is-active' : ''}`.trim()}
              onClick={() => incident && onTogglePinnedIncident?.(incident, !isPinned)}
              disabled={!incident}
            >
              {isPinned ? 'Unpin incident' : 'Pin incident'}
            </button>
            <button type="button" className="refresh-chip refresh-chip--secondary" onClick={() => navigateTo('/incidents')}>
              Back to list
            </button>
            <button type="button" className="refresh-chip" onClick={load}>
              Refresh
            </button>
          </>
        }
      />

      {state.phase === 'failure' ? <div className="error-banner">{state.error}</div> : null}

      <div className="incident-hero">
        <div className="incident-summary-card">
          <div className="incident-summary-card__title-row">
            <div className="incident-summary-card__title">{detailSourceLabel}</div>
            {isPinned ? <PinnedPill /> : null}
          </div>
          {state.captureStatus ? (
            <div className="detail-source-note">
              Local artifacts: detail {state.captureStatus.hasDetailSource ? 'yes' : 'no'} | attachments{' '}
              {state.captureStatus.hasAttachmentsMetadata ? 'yes' : 'no'} | media{' '}
              {state.captureStatus.hasLocalMedia ? 'yes' : 'no'} | external links{' '}
              {state.captureStatus.hasExternalLinksMetadata ? 'yes' : 'no'} | perimeter{' '}
              {state.captureStatus.hasPerimeterPayload ? 'yes' : 'no'} | response history{' '}
              {state.captureStatus.hasResponseHistory ? 'yes' : 'no'}
            </div>
          ) : null}
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
            <div className="card-title-row">
              <h2>Response updates</h2>
              <div className="response-source-chip">{responseSourceNote(state.source, state.captureStatus)}</div>
            </div>
            {response?.responseUpdates?.length ? (
              response.responseUpdates.map((item, index) => (
                <article key={`resp-${index}`} className="response-update-block">
                  <pre>{item}</pre>
                </article>
              ))
            ) : (
              <div className="text-muted">
                {state.source === 'local'
                  ? 'No response update is stored in local DB for this incident.'
                  : 'No response update is available from the current source path.'}
              </div>
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
          <div className="text-muted">{gallerySourceNote(galleryState, state.data?.attachments, state.captureStatus)}</div>
          {state.data?.attachments?.length ? (
            <div className="gallery-grid">
              {state.data.attachments.map((asset) => (
                <article key={asset.attachmentGuid} className="gallery-card">
                  <GalleryImage
                    asset={asset}
                    onOpen={(payload) => setLightbox(payload)}
                  />
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
          <div className="text-muted">{mapsSourceNote(state.source, state.captureStatus)}</div>
          {mapResources.attachmentDocs.length || mapResources.externalDocs.length ? (
            <div className="maps-download-grid">
              {mapResources.attachmentDocs.map((asset) => (
                <a
                  key={asset.attachmentGuid}
                  href={getAttachmentDownloadUrl(incident, asset) || asset.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="download-card"
                >
                  <div className="download-card__title">{asset.title || asset.fileName || 'Map document'}</div>
                  <div className="download-card__meta">Archived attachment metadata {asset.mimeType ? `· ${asset.mimeType}` : ''}</div>
                </a>
              ))}
              {mapResources.externalDocs.map((link) => (
                <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="download-card">
                  <div className="download-card__title">{link.label || link.url}</div>
                  <div className="download-card__meta">External map link {link.category ? `· ${link.category}` : ''}</div>
                </a>
              ))}
            </div>
          ) : (
            <>
              <h2>Map Downloads</h2>
              <p>
                {response?.mapMessage ||
                  (state.captureStatus?.hasAttachmentsMetadata || state.captureStatus?.hasExternalLinksMetadata
                    ? 'No archived map download was identified in captured attachments or external links for this incident.'
                    : 'There are currently no maps associated with this incident.')}
              </p>
            </>
          )}
        </div>
      ) : null}

      {lightbox ? (
        <div className="lightbox-backdrop" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
          <div className="lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="lightbox-close" onClick={() => setLightbox(null)}>
              Close
            </button>
            <img src={lightbox.src} alt={lightbox.title} className="lightbox-image" />
            <div className="lightbox-caption">{lightbox.title}</div>
          </div>
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
  const resources = incident?.resources || {};
  if (resources.personnel || Number(resources.personnelCount || 0) > 0) {
    items.push(`Personnel${resources.personnelCount ? ` (${resources.personnelCount})` : ''}`);
  }
  if (resources.imt || Number(resources.imtCount || 0) > 0) {
    items.push(`IMT${resources.imtCount ? ` (${resources.imtCount})` : ''}`);
  }
  if (resources.aviation || Number(resources.aviationCount || 0) > 0) {
    items.push(`Aviation${resources.aviationCount ? ` (${resources.aviationCount})` : ''}`);
  }
  if (resources.heavy || Number(resources.heavyCount || 0) > 0) {
    items.push(`Heavy equipment${resources.heavyCount ? ` (${resources.heavyCount})` : ''}`);
  }
  if (resources.spu || Number(resources.spuCount || 0) > 0) {
    items.push(`SPU${resources.spuCount ? ` (${resources.spuCount})` : ''}`);
  }
  return <div>{items.length ? items.join(', ') : 'No resource counts or assignment flags are published for this incident.'}</div>;
}

function MetricCard({ label, value, large = false }) {
  return (
    <div className={`metric-card ${large ? 'metric-card--large' : ''}`.trim()}>
      <div className="metric-card__label">{label}</div>
      <div className="metric-card__value">{value}</div>
    </div>
  );
}

function IncidentAffordanceRow({ affordances }) {
  const chips = [
    affordances?.hasMedia ? { label: 'Media', tone: 'media' } : null,
    affordances?.hasMapDownloads ? { label: 'Map', tone: 'map' } : null,
    affordances?.hasResponseHistory ? { label: 'Response', tone: 'response' } : null,
  ].filter(Boolean);

  if (!chips.length) {
    return <span className="table-affordance-row__empty">—</span>;
  }

  return (
    <div className="table-affordance-row">
      {chips.map((chip) => (
        <span key={chip.label} className={`table-affordance-chip is-${chip.tone}`.trim()}>
          {chip.label}
        </span>
      ))}
    </div>
  );
}

function SourceHealthChip({ label, status }) {
  return (
    <div className={`source-health-chip is-${status}`.trim()}>
      <span className="source-health-chip__label">{label}</span>
      <span className="source-health-chip__state">{sourceHealthLabel(status)}</span>
    </div>
  );
}

function StageGlyph({ code }) {
  const src = STAGE_ICON_SRC[code];
  if (!src) {
    return <span className="legend-dot" style={{ background: STAGE_DEFS[code]?.color }} />;
  }
  return <img src={src} alt="" className="stage-glyph" aria-hidden="true" />;
}

function StageMetric({ label, value, pct, code }) {
  return (
    <div className="metric-card stage-metric">
      <div className="stage-metric__label">
        <StageGlyph code={code} /> {label}
      </div>
      <div className="stage-metric__numbers">
        <span>{value}</span>
        <span>{pct}</span>
      </div>
    </div>
  );
}

function BlankMetricCard({ label }) {
  return (
    <div className="small-count-chip is-blank" aria-label={`${label} unavailable`}>
      <div className="small-count-chip__label">{label}</div>
      <div className="small-count-chip__value">&mdash;</div>
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

function ArchiveTotalsPanel({ captureSummary, hasActiveDb, className = '' }) {
  const completenessStatus = captureSummary?.completenessStatus || 'partial';
  const headline = !hasActiveDb
    ? 'No local archive is selected.'
    : captureSummary
    ? `Archive scope: ${completenessStatus === 'endpoint-limited' ? 'endpoint-limited published set' : completenessStatus}.`
    : 'Loading local archive totals.';

  return (
    <section className={`stub-panel archive-totals-panel ${className}`.trim()}>
      <div className="card-title-row">
        <h2>Archive Totals</h2>
      </div>
      <div className="text-muted">{headline}</div>
      <div className="metrics-card-grid is-three archive-totals-grid">
        <MetricCard label="Incidents persisted" value={displayValue(captureSummary?.persistedIncidentCount)} large />
        <MetricCard label="Detail archived" value={displayValue(captureSummary?.detailArchivedCount)} large />
        <MetricCard label="Response history" value={displayValue(captureSummary?.responseHistoryCount)} large />
        <MetricCard label="Attachments" value={displayValue(captureSummary?.attachmentsMetadataCount)} large />
        <MetricCard label="External links" value={displayValue(captureSummary?.externalLinksMetadataCount)} large />
        <MetricCard label="Perimeters" value={displayValue(captureSummary?.perimeterPayloadCount)} large />
        <MetricCard label="Incidents with media" value={displayValue(captureSummary?.localMediaIncidentCount)} large />
        <MetricCard label="Media records" value={displayValue(captureSummary?.mediaRecordCount)} large />
        <MetricCard label="Media stored" value={formatBytes(captureSummary?.totalMediaBytes)} large />
      </div>
      <div className="archive-totals-panel__meta">
        <div>
          Endpoint rows: {displayValue(captureSummary?.endpointRowsFetched)} of{' '}
          {displayValue(captureSummary?.endpointTotalRowCount)}
        </div>
        <div>Pages fetched: {displayValue(captureSummary?.endpointPageCount)}</div>
        <div>Status: {captureSummary?.completenessStatus || '--'}</div>
        <div>Scope: {formatQueryScope(captureSummary?.queryScope)}</div>
        <div>Warning: {captureSummary?.completenessWarning || '--'}</div>
      </div>
    </section>
  );
}

function StageControlPanel({ stats }) {
  const stages = [
    {
      code: 'UNDR_CNTRL',
      label: 'Under Control',
      value: stats?.activeUnderControlFires ?? null,
    },
    {
      code: 'HOLDING',
      label: 'Being Held',
      value: stats?.activeBeingHeldFires ?? null,
    },
    {
      code: 'OUT_CNTRL',
      label: 'Out of Control',
      value: stats?.activeOutOfControlFires ?? null,
    },
  ];

  const total = stages.reduce((sum, stage) => sum + Number(stage.value || 0), 0);

  return (
    <section className="stage-control-panel">
      <div className="stage-control-bar" aria-label="Stage of control distribution">
        {stages.map((stage) => {
          const width = total > 0 ? `${(Number(stage.value || 0) / total) * 100}%` : '0%';
          return (
            <div
              key={stage.code}
              className={`stage-control-bar__segment stage-control-bar__segment--${stage.code}`}
              style={{ width, background: STAGE_DEFS[stage.code].color }}
              title={`${stage.label}: ${displayValue(stage.value)} (${pct(stage.value, stats)})`}
            />
          );
        })}
      </div>
      <div className="stage-control-grid">
        {stages.map((stage) => (
          <StageMetric
            key={stage.code}
            label={stage.label}
            value={displayValue(stage.value)}
            pct={pct(stage.value, stats)}
            code={stage.code}
          />
        ))}
      </div>
    </section>
  );
}

function ResourceStubStrip() {
  return (
    <div className="resource-strip">
      <BlankMetricCard label="Personnel" />
      <BlankMetricCard label="IMT" />
      <BlankMetricCard label="Aviation" />
      <BlankMetricCard label="Heavy" />
      <BlankMetricCard label="SPU" />
    </div>
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

function GalleryImage({ asset, onOpen }) {
  const [failed, setFailed] = React.useState(false);
  const [localObjectUrl, setLocalObjectUrl] = React.useState('');

  React.useEffect(() => {
    if (!asset?.localMedia?.base64) {
      setLocalObjectUrl('');
      return undefined;
    }
    const blob = base64ToBlob(asset.localMedia.base64, asset.localMedia.mimeType);
    const nextUrl = URL.createObjectURL(blob);
    setLocalObjectUrl(nextUrl);
    setFailed(false);
    return () => URL.revokeObjectURL(nextUrl);
  }, [asset?.localMedia?.base64, asset?.localMedia?.mimeType]);

  const liveUrl = asset?.imageUrl || asset?.thumbnailUrl || '';
  const sourceUrl = !failed && localObjectUrl ? localObjectUrl : liveUrl;

  if (!sourceUrl) {
    return <div className="gallery-card__empty">Image unavailable</div>;
  }

  if (failed) {
    return <div className="gallery-card__empty">{localObjectUrl ? 'Local image unavailable' : 'Live image unavailable'}</div>;
  }

  return (
    <button
      type="button"
      className="gallery-card__button"
      onClick={() => onOpen?.({ src: sourceUrl, title: asset.title || 'Incident image' })}
    >
      <img
        src={sourceUrl}
        alt={asset.title}
        className="gallery-card__image"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          if (localObjectUrl && liveUrl && sourceUrl === localObjectUrl) {
            setFailed(true);
            return;
          }
          setFailed(true);
        }}
      />
    </button>
  );
}

function PinnedPill({ compact = false }) {
  return <span className={`pinned-pill ${compact ? 'is-compact' : ''}`.trim()}>Pinned</span>;
}

function PinnedIncidentsPanel({ hasActiveDb, pinnedIncidents, pinStorageKind, className = '' }) {
  const items = Array.isArray(pinnedIncidents) ? pinnedIncidents : [];
  return (
    <section className={`stub-panel ${className}`.trim()}>
      <div className="card-title-row">
        <h2>Pinned Incidents</h2>
        {items.length ? <div className="text-muted">{items.length} saved</div> : null}
      </div>
      {items.length ? (
        <div className="pinned-incident-list">
          {items.map((item) => (
            <button
              key={pinKey(item.fireYear, item.incidentNumber)}
              type="button"
              className="pinned-incident-card"
              onClick={() => navigateTo(`/incidents/${item.fireYear}/${encodeURIComponent(item.incidentNumber)}`)}
            >
              <div className="pinned-incident-card__top">
                <PinnedPill compact />
                <span className={`stage-pill stage-pill--${item.stage}`}>{stageLabel(item.stage)}</span>
              </div>
              <div className="pinned-incident-card__title">{item.incidentName || item.incidentNumber}</div>
              <div className="pinned-incident-card__meta">
                <span>{item.incidentNumber}</span>
                <span>{formatSizeHa(item.sizeHa)}</span>
              </div>
              <div className="pinned-incident-card__meta">
                <span>{item.fireCentre || 'Fire centre unavailable'}</span>
                <span>{item.updatedDate ? `Updated ${formatDate(item.updatedDate)}` : 'Update unavailable'}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-muted">
          {hasActiveDb
            ? 'No incidents are pinned yet. Pin an incident from its detail page to keep it on the dashboard.'
            : `No incidents are pinned yet. In this runtime, pins are saved in ${
                pinStorageKind === 'desktop-db' ? 'the active desktop archive' : 'browser local storage'
              }.`}
        </div>
      )}
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

function PlaceholderPage({ title, message }) {
  return (
    <div className="stub-page">
      <PageHeader
        title={title}
        subtitle="Truthful route placeholder"
        chips={[
          { label: 'Route', status: 'not_wired' },
          { label: 'Runtime', status: 'browser_fallback' },
        ]}
      />
      <section className="stub-panel">
        <h2>{title} workspace is not available here yet</h2>
        <p className="placeholder-copy">{message}</p>
      </section>
    </div>
  );
}

function SettingsHonestyPage({ dbStatus, onDbStatusChange, onCaptureIncidents }) {
  const desktopActive = Boolean(window.openFiresideDesktop?.isElectron);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [captureSummary, setCaptureSummary] = React.useState('');
  const [recoverySummary, setRecoverySummary] = React.useState('');
  const [captureRuntime, setCaptureRuntime] = React.useState({
    activeRun: null,
    lastRun: null,
    dbFileSizeBytes: 0,
    lastSuccessfulCaptureAt: null,
  });
  const [captureCompleteness, setCaptureCompleteness] = React.useState({
    listedIncidentCount: 0,
    detailArchivedCount: 0,
    detailFailureCount: 0,
    attachmentsMetadataCount: 0,
    localMediaIncidentCount: 0,
    externalLinksMetadataCount: 0,
    perimeterPayloadCount: 0,
    responseHistoryCount: 0,
    mediaRecordCount: 0,
    thumbnailStoredCount: 0,
    fullImageStoredCount: 0,
    totalMediaBytes: 0,
    archivalFireYear: 0,
    endpointTotalRowCount: 0,
    endpointRowsFetched: 0,
    endpointPageCount: 0,
    persistedIncidentCount: 0,
    completenessStatus: 'partial',
    completenessWarning: '',
    queryScope: {},
    lastRun: null,
    failureCategoryCounts: {},
  });
  const [autoCheckMinutesDraft, setAutoCheckMinutesDraft] = React.useState(String(dbStatus.autoCheckMinutes || 0));

  React.useEffect(() => {
    setAutoCheckMinutesDraft(String(dbStatus.autoCheckMinutes || 0));
  }, [dbStatus.autoCheckMinutes]);

  const refreshCaptureRuntime = React.useCallback(async () => {
    const next = await fetchCaptureRuntime();
    setCaptureRuntime(next);
  }, []);

  const refreshCaptureSummary = React.useCallback(async () => {
    const next = await fetchCaptureSummary();
    setCaptureCompleteness(next);
  }, []);

  React.useEffect(() => {
    refreshCaptureRuntime();
  }, [refreshCaptureRuntime, dbStatus.hasActiveDb, dbStatus.captureStateCode, dbStatus.lastCapturedAt]);

  React.useEffect(() => {
    refreshCaptureSummary();
  }, [refreshCaptureSummary, dbStatus.hasActiveDb, dbStatus.lastCapturedAt]);

  React.useEffect(() => {
    if (!hasDesktopDbBridge() || !window.openFiresideDesktop.db.onCaptureProgress) return undefined;
    const unsubscribe = window.openFiresideDesktop.db.onCaptureProgress((payload) => {
      setCaptureRuntime(payload);
    });
    return unsubscribe;
  }, []);

  const [elapsedTick, setElapsedTick] = React.useState(Date.now());
  React.useEffect(() => {
    if (!captureRuntime.activeRun) return undefined;
    const timer = window.setInterval(() => setElapsedTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [captureRuntime.activeRun]);

  const activeRun = captureRuntime.activeRun;
  const lastRun = captureRuntime.lastRun;
  const completedProgress = Number(activeRun?.completedIncidentCount || 0) + Number(activeRun?.failedIncidentCount || 0);
  const progressPercent = activeRun?.targetedIncidentCount
    ? Math.min(100, Math.round((completedProgress / Number(activeRun.targetedIncidentCount || 0)) * 100))
    : 0;
  const shownElapsedMs = activeRun?.startedAt
    ? Math.max(0, elapsedTick - Date.parse(activeRun.startedAt))
    : 0;

  const runDbAction = async (action) => {
    if (!hasDesktopDbBridge()) return;
    setBusy(true);
    setError('');
    try {
      const result = await action();
      if (result?.error) {
        setError(result.error);
      }
      await onDbStatusChange();
      await refreshCaptureRuntime();
      await refreshCaptureSummary();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'DB action failed');
    } finally {
      setBusy(false);
    }
  };

  const runManualCapture = async () => {
    if (!desktopActive || !hasDesktopDbBridge() || !dbStatus.hasActiveDb) return;
    setBusy(true);
    setError('');
    setCaptureSummary('');
    setRecoverySummary('');
    try {
      const result = await onCaptureIncidents({ trigger: 'manual' });
      if (!result?.ok) {
        throw new Error(result?.error || 'Incident capture failed');
      }
      setCaptureSummary(
        `Captured ${result.capturedListCount} incidents for fire year ${result.saved.runSummary?.archivalFireYear ?? ARCHIVAL_FIRE_YEAR} | endpoint rows ${result.saved.runSummary?.endpointRowsFetched ?? result.capturedListCount} of ${result.saved.runSummary?.endpointTotalRowCount ?? result.capturedListCount} across ${result.saved.runSummary?.endpointPageCount ?? 0} pages | completeness ${result.saved.runSummary?.completenessStatus ?? 'partial'} | targeted detail retries ${result.saved.runSummary?.targetedIncidentCount ?? result.targetedIncidentCount ?? 0} | detail archived ${result.saved.runSummary?.detailCaptureSuccessCount ?? result.capturedDetailCount} | detail failures ${result.saved.runSummary?.detailCaptureFailureCount ?? result.detailFailureCount}.`
      );
      await refreshCaptureRuntime();
      await refreshCaptureSummary();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'Incident capture failed';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const runRecovery = async () => {
    if (!desktopActive || !hasDesktopDbBridge() || !dbStatus.hasActiveDb) return;
    setBusy(true);
    setError('');
    setRecoverySummary('');
    try {
      const result = await window.openFiresideDesktop.db.recoverResponseHistory();
      if (!result?.ok) {
        throw new Error(result?.error || 'Recovery failed');
      }
      await onDbStatusChange();
      await refreshCaptureRuntime();
      await refreshCaptureSummary();
      setRecoverySummary(
        `Recovered ${result.insertedUpdates} response updates from ${result.scannedRecords} archived detail records (G70422 parsed blocks: ${result.g70422?.parsedBlocks ?? 0}, inserted: ${result.g70422?.inserted ?? 0}, reason: ${result.g70422?.reason || 'n/a'}).`
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to recover response history');
    } finally {
      setBusy(false);
    }
  };

  const saveAutoCheckInterval = async () => {
    if (!desktopActive || !hasDesktopDbBridge() || !dbStatus.hasActiveDb) return;
    setBusy(true);
    setError('');
    try {
      const next = Number(autoCheckMinutesDraft || 0);
      const result = await window.openFiresideDesktop.db.setAutoCheckMinutes(next);
      if (result?.error) {
        setError(result.error);
      }
      await onDbStatusChange();
      await refreshCaptureRuntime();
      await refreshCaptureSummary();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to save auto-check interval');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stub-page">
      <PageHeader
        title="Settings"
        subtitle="Runtime, archive controls, and storage at a glance."
        chips={[
          { label: 'Runtime', status: desktopActive ? 'db_selected' : 'browser_fallback' },
          { label: 'Capture', status: dbStatus.captureStateCode },
          { label: 'Archive', status: dbStatus.hasActiveDb ? 'db_selected' : 'no_db' },
        ]}
      />
      <section className="settings-note-card">
        <div className="mini-list">
          <div>{desktopActive ? 'Electron desktop runtime with archive controls enabled.' : 'Public QA web build. Desktop archive controls are intentionally unavailable here.'}</div>
          <div>{dbStatus.hasActiveDb ? `Archive path ready: ${dbStatus.name}` : 'No SQLite archive is selected.'}</div>
          <div>{dbStatus.autoCheckEnabled ? `Auto-check is enabled every ${dbStatus.autoCheckMinutes} minutes.` : 'Auto-check is currently disabled.'}</div>
        </div>
      </section>
      <section className={`capture-status-panel is-${dbStatus.captureStateCode}`.trim()}>
        <div className="capture-status-panel__header">
          <div className="capture-status-panel__title">
            {activeRun ? 'Capture running' : lastRun ? 'Last capture run' : 'Capture status'}
          </div>
          <div className="capture-status-panel__state">{sourceHealthLabel(dbStatus.captureStateCode)}</div>
        </div>
        {activeRun ? (
          <>
            <div className="capture-progress-bar" aria-label="Capture progress">
              <div className="capture-progress-bar__fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <CaptureStatusGrid
              items={[
                { label: 'Run mode', value: activeRun.trigger || 'manual' },
                { label: 'Started', value: activeRun.startedAt ? formatDateTime(Date.parse(activeRun.startedAt)) : '--' },
                { label: 'Elapsed', value: formatDurationMs(shownElapsedMs) },
                { label: 'Archival fire year', value: displayValue(activeRun.archivalFireYear || ARCHIVAL_FIRE_YEAR) },
                { label: 'Endpoint rows', value: `${displayValue(activeRun.endpointRowsFetched)} of ${displayValue(activeRun.endpointTotalRowCount)}` },
                { label: 'Pages fetched', value: displayValue(activeRun.endpointPageCount) },
                { label: 'Targeted incidents', value: displayValue(activeRun.targetedIncidentCount) },
                { label: 'Incidents completed', value: displayValue(activeRun.completedIncidentCount) },
                { label: 'Incidents failed', value: displayValue(activeRun.failedIncidentCount) },
                { label: 'Current stage', value: activeRun.currentStageLabel || '--' },
                { label: 'Current artifact', value: activeRun.currentArtifactLabel || '--' },
                { label: 'Current incident', value: activeRun.currentIncidentName || activeRun.currentIncidentNumber || '--' },
                { label: 'Current activity', value: activeRun.currentActivity || '--' },
              ]}
            />
          </>
        ) : lastRun ? (
          <CaptureStatusGrid
            items={[
              { label: 'Run mode', value: lastRun.trigger || 'manual' },
              { label: 'Started', value: lastRun.startedAt ? formatDateTime(Date.parse(lastRun.startedAt)) : '--' },
              { label: 'Finished', value: lastRun.finishedAt ? formatDateTime(Date.parse(lastRun.finishedAt)) : '--' },
              { label: 'Duration', value: formatDurationMs(lastRun.durationMs) },
              { label: 'Listed incidents', value: displayValue(lastRun.listedIncidentCount) },
              { label: 'Detail archived', value: displayValue(lastRun.detailCaptureSuccessCount) },
              { label: 'Detail failures', value: displayValue(lastRun.detailCaptureFailureCount) },
              { label: 'Attachments', value: displayValue(lastRun.attachmentsCaptureCount) },
              { label: 'External links', value: displayValue(lastRun.externalLinksCaptureCount) },
              { label: 'Perimeter', value: displayValue(lastRun.perimeterCaptureCount) },
              { label: 'Response history', value: displayValue(lastRun.responseHistoryExtractedCount) },
              { label: 'Media attempted', value: displayValue(lastRun.mediaDownloadAttemptedCount) },
              { label: 'Media stored', value: displayValue(lastRun.mediaStoredCount) },
              { label: 'Media failed', value: displayValue(lastRun.mediaFailureCount) },
              {
                label: 'Failure categories',
                value:
                  Object.entries(lastRun.failureCategoryCounts || {})
                    .filter(([, count]) => Number(count) > 0)
                    .map(([key, count]) => `${key} ${count}`)
                    .join(' | ') || '--',
              },
              { label: 'Failure reason', value: lastRun.failureReason || '--' },
            ]}
          />
        ) : (
          <div className="text-muted">No capture run has been recorded yet.</div>
        )}
      </section>
      <div className="settings-grid">
        <SettingsSectionCard title="Runtime and database" eyebrow="Environment">
          <SettingsDataGrid
            items={[
              { label: 'Runtime', value: desktopActive ? 'Electron desktop shell' : 'Public QA web build' },
              { label: 'Archive state', value: dbStatus.hasActiveDb ? 'SQLite archive selected' : 'No archive selected' },
              { label: 'Active DB', value: dbStatus.name || '--' },
              { label: 'Path', value: dbStatus.path || '--' },
              { label: 'DB file size', value: formatBytes(captureRuntime.dbFileSizeBytes) },
              { label: 'Created', value: dbStatus.createdAt ? formatDateTime(Date.parse(dbStatus.createdAt)) : '--' },
              { label: 'Last opened', value: dbStatus.lastOpenedAt ? formatDateTime(Date.parse(dbStatus.lastOpenedAt)) : '--' },
              { label: 'Last successful capture', value: captureRuntime.lastSuccessfulCaptureAt ? formatDateTime(Date.parse(captureRuntime.lastSuccessfulCaptureAt)) : '--' },
            ]}
          />
        </SettingsSectionCard>

        <SettingsSectionCard title="Archive capture" eyebrow="Scope and counts">
          <SettingsDataGrid
            items={[
              { label: 'Archival fire year', value: displayValue(captureCompleteness.archivalFireYear || ARCHIVAL_FIRE_YEAR) },
              { label: 'Endpoint rows', value: `${displayValue(captureCompleteness.endpointRowsFetched)} of ${displayValue(captureCompleteness.endpointTotalRowCount)}` },
              { label: 'Pages fetched', value: displayValue(captureCompleteness.endpointPageCount) },
              { label: 'Incidents persisted', value: displayValue(captureCompleteness.persistedIncidentCount) },
              { label: 'Listed incidents', value: displayValue(captureCompleteness.listedIncidentCount) },
              { label: 'Detail archived', value: displayValue(captureCompleteness.detailArchivedCount) },
              { label: 'Detail failures', value: displayValue(captureCompleteness.detailFailureCount) },
              { label: 'Response history', value: displayValue(captureCompleteness.responseHistoryCount) },
            ]}
          />
          <div className="settings-helper-block">
            <div><strong>Scope:</strong> {formatQueryScope(captureCompleteness.queryScope)}</div>
            <div><strong>Status:</strong> {captureCompleteness.completenessStatus || '--'}</div>
            <div><strong>Warning:</strong> {captureCompleteness.completenessWarning || '--'}</div>
          </div>
        </SettingsSectionCard>

        <SettingsSectionCard title="Storage and media" eyebrow="Archive footprint">
          <SettingsDataGrid
            items={[
              { label: 'Captured incidents', value: displayValue(dbStatus.capturedIncidentCount) },
              { label: 'Incidents with media', value: displayValue(captureCompleteness.localMediaIncidentCount) },
              { label: 'Media records', value: displayValue(captureCompleteness.mediaRecordCount) },
              { label: 'Thumbnails stored', value: displayValue(captureCompleteness.thumbnailStoredCount) },
              { label: 'Full images stored', value: displayValue(captureCompleteness.fullImageStoredCount) },
              { label: 'Media bytes', value: formatBytes(captureCompleteness.totalMediaBytes) },
              { label: 'Attachments metadata', value: displayValue(captureCompleteness.attachmentsMetadataCount) },
              { label: 'External links metadata', value: displayValue(captureCompleteness.externalLinksMetadataCount) },
              { label: 'Perimeter payloads', value: displayValue(captureCompleteness.perimeterPayloadCount) },
              {
                label: 'Failure categories',
                value:
                  Object.entries(captureCompleteness.failureCategoryCounts || {})
                    .filter(([, count]) => Number(count) > 0)
                    .map(([key, count]) => `${key} ${count}`)
                    .join(' | ') || '--',
              },
              { label: 'Last capture error', value: dbStatus.lastCaptureError || '--' },
            ]}
          />
        </SettingsSectionCard>

        <SettingsSectionCard title="Controls and maintenance" eyebrow="Operator actions" className="settings-section-card--wide">
          <div className="settings-action-stack">
            <div className="settings-action-group">
              <ToolbarField label="Auto-check minutes">
                <input
                  className="toolbar-input"
                  type="number"
                  min="0"
                  step="1"
                  value={autoCheckMinutesDraft}
                  onChange={(event) => setAutoCheckMinutesDraft(event.target.value)}
                  disabled={!desktopActive || busy || !dbStatus.hasActiveDb}
                />
              </ToolbarField>
              <button
                type="button"
                className="toolbar-button"
                disabled={!desktopActive || busy || !dbStatus.hasActiveDb}
                onClick={saveAutoCheckInterval}
              >
                Save auto-check
              </button>
            </div>

            <div className="settings-action-grid">
              <button
                type="button"
                className="toolbar-button"
                disabled={!desktopActive || busy}
                onClick={() => runDbAction(() => window.openFiresideDesktop.db.create())}
              >
                Create DB
              </button>
              <button
                type="button"
                className="toolbar-button"
                disabled={!desktopActive || busy}
                onClick={() => runDbAction(() => window.openFiresideDesktop.db.select())}
              >
                Select DB
              </button>
              <button
                type="button"
                className="toolbar-button"
                disabled={!desktopActive || busy || !dbStatus.hasActiveDb || Boolean(activeRun)}
                onClick={runManualCapture}
              >
                Capture incidents
              </button>
              <button
                type="button"
                className="toolbar-button"
                disabled={!desktopActive || busy || !dbStatus.hasActiveDb}
                onClick={runRecovery}
              >
                Recover response history
              </button>
              <button
                type="button"
                className="toolbar-button"
                disabled={!desktopActive || busy || !dbStatus.hasActiveDb}
                onClick={() => runDbAction(() => window.openFiresideDesktop.db.deleteActive())}
              >
                Delete DB
              </button>
            </div>

            <div className="settings-helper-block">
              <div><strong>Capture incidents:</strong> refresh the current 2025 published incident set, detail records, media, map artifacts, and run summary.</div>
              <div><strong>Recover response history:</strong> reprocess archived raw detail payloads without rerunning a full incident capture.</div>
              {!desktopActive ? <div><strong>Browser runtime:</strong> desktop DB lifecycle and capture controls stay unavailable in the public QA build.</div> : null}
            </div>
          </div>
        </SettingsSectionCard>
      </div>

      {captureSummary ? <div className="list-results-label">{captureSummary}</div> : null}
      {recoverySummary ? <div className="list-results-label">{recoverySummary}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
    </div>
  );
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

function formatSizeHa(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const hectares = Number(value);
  return hectares >= 100
    ? `${Math.round(hectares).toLocaleString('en-CA')} ha`
    : `${hectares.toFixed(1)} ha`;
}

function formatQueryScope(scope) {
  if (!scope || typeof scope !== 'object') return '--';
  const parts = [
    scope.fireYear ? `fireYear ${scope.fireYear}` : null,
    Array.isArray(scope.stageCodes) && scope.stageCodes.length ? `stages ${scope.stageCodes.join(', ')}` : null,
    scope.searchText === '' ? 'search empty' : scope.searchText ? `search ${scope.searchText}` : null,
    scope.fireCentreName ? `fire centre ${scope.fireCentreName}` : null,
    Number(scope.pageCountFetched || 0) > 0 ? `pages ${scope.pageCountFetched}` : null,
    scope.clientSideFireYearFilterApplied ? 'client filtered to 2025' : null,
    scope.scopeKind ? `scope ${scope.scopeKind}` : null,
  ].filter(Boolean);
  return parts.join(' | ') || '--';
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let current = bytes;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  const digits = current >= 100 || index === 0 ? 0 : current >= 10 ? 1 : 2;
  return `${current.toFixed(digits)} ${units[index]}`;
}

function formatDurationMs(value) {
  const durationMs = Number(value || 0);
  if (!Number.isFinite(durationMs) || durationMs <= 0) return '0s';
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function sourceHealthLabel(status) {
  if (status === 'db_selected') return 'DB selected';
  if (status === 'browser_fallback') return 'Browser fallback';
  if (status === 'not_wired') return 'Not wired';
  if (status === 'no_db') return 'No DB';
  if (status === 'never_captured') return 'Never captured';
  if (status === 'capture_running') return 'Capture running';
  if (status === 'backfill_due') return 'Backfill due';
  if (status === 'healthy') return 'Healthy';
  return 'Error';
}

function compareRows(a, b, sortState, columnDefs) {
  const column = columnDefs[sortState.key];
  if (!column) return 0;
  const direction = sortState.direction === 'asc' ? 1 : -1;
  const left = a[sortState.key];
  const right = b[sortState.key];

  if (column.type === 'date' || column.type === 'number') {
    return (Number(left || 0) - Number(right || 0)) * direction;
  }

  return String(left || '').localeCompare(String(right || ''), 'en', { sensitivity: 'base' }) * direction;
}

function sortIndicator(sortState, key, type) {
  if (sortState.key !== key) {
    return type === 'text' ? 'A-Z' : 'Newest';
  }
  if (type === 'text') return sortState.direction === 'asc' ? 'A-Z' : 'Z-A';
  if (type === 'number') return sortState.direction === 'asc' ? 'Low-High' : 'High-Low';
  return sortState.direction === 'asc' ? 'Oldest' : 'Newest';
}
