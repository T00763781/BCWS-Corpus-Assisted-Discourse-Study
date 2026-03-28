import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import initSqlJs from 'sql.js';

const RUNTIME_CONFIG_FILE = 'open-fireside-runtime.json';

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function canonicalStringify(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashPayload(value) {
  return crypto.createHash('sha256').update(canonicalStringify(value)).digest('hex');
}

function asPayloadText(payload) {
  if (payload === null || payload === undefined) return '';
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function classifyFailureCategory(status, errorText) {
  const explicit = String(status || '').trim().toLowerCase();
  if (explicit && explicit !== 'ok') return explicit;
  const text = String(errorText || '').trim().toLowerCase();
  if (!text) return 'error';
  if (text.includes('timed out')) return 'timeout';
  if (text.includes('abort')) return 'aborted';
  if (text.includes('404')) return 'unavailable';
  if (text.includes('parse')) return 'parse_failure';
  if (text.includes('http')) return 'http_error';
  if (text.includes('network') || text.includes('failed to fetch')) return 'network_error';
  return 'error';
}

function incidentKey(fireYear, incidentNumber) {
  return `${String(fireYear)}:${String(incidentNumber)}`;
}

function normalizeBcwsUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith('/')) return `https://wildfiresituation.nrs.gov.bc.ca${text}`;
  return `https://wildfiresituation.nrs.gov.bc.ca/${text.replace(/^\/+/, '')}`;
}

function buildAttachmentBinaryUrl(incidentNumber, attachmentGuid, fireYear, thumbnail = false) {
  if (!incidentNumber || !attachmentGuid) return '';
  const params = new URLSearchParams();
  if (fireYear) params.set('fireYear', String(fireYear));
  if (thumbnail) params.set('thumbnail', 'true');
  const query = params.toString();
  return `https://wildfiresituation.nrs.gov.bc.ca/wfnews-api/publicPublishedIncidentAttachment/${encodeURIComponent(
    String(incidentNumber)
  )}/attachments/${encodeURIComponent(String(attachmentGuid))}/bytes${query ? `?${query}` : ''}`;
}

function isImageAttachment(asset) {
  const mimeType = String(asset?.mimeType || '').toLowerCase();
  return mimeType.startsWith('image/') || Boolean(asset?.imageUrl) || Boolean(asset?.thumbnailUrl);
}

function isVideoAttachment(asset) {
  const mimeType = String(asset?.mimeType || '').toLowerCase();
  return mimeType.startsWith('video/');
}

function isRenderableGalleryAttachment(asset) {
  return isImageAttachment(asset) || isVideoAttachment(asset);
}

function getAttachmentOriginalUrl(asset, fireYear, incidentNumber) {
  return (
    normalizeBcwsUrl(asset?.downloadUrl) ||
    normalizeBcwsUrl(asset?.imageUrl) ||
    buildAttachmentBinaryUrl(incidentNumber, asset?.attachmentGuid, fireYear, false)
  );
}

function getAttachmentThumbnailUrl(asset, fireYear, incidentNumber) {
  return (
    normalizeBcwsUrl(asset?.thumbnailUrl) ||
    (isImageAttachment(asset) ? buildAttachmentBinaryUrl(incidentNumber, asset?.attachmentGuid, fireYear, true) : '')
  );
}

function isDownloadableAttachment(asset, fireYear, incidentNumber) {
  return Boolean(getAttachmentOriginalUrl(asset, fireYear, incidentNumber) || getAttachmentThumbnailUrl(asset, fireYear, incidentNumber));
}

function attachmentAssetKind(asset) {
  if (isImageAttachment(asset)) return 'image';
  if (isVideoAttachment(asset)) return 'video';
  if (isMapAttachment(asset)) return 'document';
  return 'download';
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

function buildIncidentListAffordances(fireYear, incidentNumber, parsedDetail, captureStatus) {
  const attachments = Array.isArray(parsedDetail?.attachments) ? parsedDetail.attachments : [];
  const externalLinks = Array.isArray(parsedDetail?.externalLinks) ? parsedDetail.externalLinks : [];
  const renderableAttachments = attachments.filter((asset) => isRenderableGalleryAttachment(asset));
  const hasMapDownloads = attachments.some(isMapAttachment) || externalLinks.some(isMapLink);
  const hasLocalRenderableAssets = renderableAttachments.length
    ? hasCompleteLocalAssetsForAttachments(fireYear, incidentNumber, renderableAttachments)
    : false;
  return {
    hasMedia:
      renderableAttachments.length > 0 &&
      (hasLocalRenderableAssets ||
        renderableAttachments.some((asset) =>
          Boolean(getAttachmentOriginalUrl(asset, fireYear, incidentNumber) || getAttachmentThumbnailUrl(asset, fireYear, incidentNumber))
        )),
    hasMapDownloads,
    hasResponseHistory: Boolean(captureStatus?.hasResponseHistory),
  };
}

function getAttachmentAssetTargets(asset, fireYear, incidentNumber) {
  const targets = [];
  const fullUrl = getAttachmentOriginalUrl(asset, fireYear, incidentNumber);
  const thumbnailUrl = getAttachmentThumbnailUrl(asset, fireYear, incidentNumber);
  const assetKind = attachmentAssetKind(asset);
  if (fullUrl) {
    targets.push({ isThumbnail: false, variantRole: 'original', assetKind, sourceUrl: fullUrl });
  }
  if (assetKind === 'image' && thumbnailUrl && thumbnailUrl !== fullUrl) {
    targets.push({ isThumbnail: true, variantRole: 'thumbnail', assetKind, sourceUrl: thumbnailUrl });
  }
  return targets;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyNetworkFailure(error, response = null, didTimeout = false) {
  if (didTimeout) {
    return {
      category: 'timeout',
      error: 'Request timed out',
      retryable: true,
    };
  }

  if (response) {
    const code = Number(response.status || 0);
    if (code === 404) {
      return {
        category: 'unavailable',
        error: `${code} ${response.statusText}`,
        retryable: false,
      };
    }
    if (code === 429 || code >= 500) {
      return {
        category: 'http_error',
        error: `${code} ${response.statusText}`,
        retryable: true,
      };
    }
    return {
      category: 'http_error',
      error: `${code} ${response.statusText}`,
      retryable: false,
    };
  }

  const message = error instanceof Error ? error.message || error.name : String(error);
  const lower = message.toLowerCase();
  if (lower.includes('aborted') || lower.includes('aborterror')) {
    return {
      category: 'aborted',
      error: message,
      retryable: true,
    };
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('econn') || lower.includes('socket')) {
    return {
      category: 'network_error',
      error: message,
      retryable: true,
    };
  }
  return {
    category: 'error',
    error: message,
    retryable: false,
  };
}

async function fetchBinaryWithRetry(url, options = {}) {
  const {
    timeoutMs = 15000,
    retries = 2,
    backoffMs = 500,
  } = options;

  let lastFailure = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    let didTimeout = false;
    const timer = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        const failure = classifyNetworkFailure(null, response, false);
        failure.httpStatus = Number(response.status || 0);
        lastFailure = failure;
        if (!failure.retryable || attempt === retries) {
          return {
            ok: false,
            url,
            status: failure.category,
            error: failure.error,
            httpStatus: failure.httpStatus || null,
            bytes: null,
            mimeType: '',
            byteLength: 0,
          };
        }
        await delay(backoffMs * (attempt + 1));
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const mimeType = String(response.headers.get('content-type') || '').split(';')[0].trim();
      if (mimeType.toLowerCase() === 'text/html') {
        return {
          ok: false,
          url,
          status: 'unavailable',
          error: 'Document proxy returned HTML instead of media bytes',
          httpStatus: Number(response.status || 200),
          bytes: null,
          mimeType,
          byteLength: 0,
        };
      }
      return {
        ok: true,
        url,
        status: 'ok',
        error: '',
        httpStatus: Number(response.status || 200),
        bytes,
        mimeType,
        byteLength: bytes.byteLength,
      };
    } catch (error) {
      const failure = classifyNetworkFailure(error, null, didTimeout);
      lastFailure = failure;
      if (!failure.retryable || attempt === retries) {
        return {
          ok: false,
          url,
          status: failure.category,
          error: failure.error,
          httpStatus: null,
          bytes: null,
          mimeType: '',
          byteLength: 0,
        };
      }
      await delay(backoffMs * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    url,
    status: lastFailure?.category || 'error',
    error: lastFailure?.error || 'Unknown media fetch failure',
    httpStatus: lastFailure?.httpStatus || null,
    bytes: null,
    mimeType: '',
    byteLength: 0,
  };
}

function buildSnapshotPayload(row, detail) {
  const incident = detail?.incident || row || {};
  const response = detail?.response || {};
  return {
    fireYear: String(incident.fireYear || row?.fireYear || ''),
    incidentNumber: String(incident.incidentNumber || row?.incidentNumber || ''),
    stage: incident.stage || row?.stage || '',
    sizeHa: Number(incident.sizeHa ?? row?.sizeHa ?? 0),
    updatedDate: String(incident.updatedDate || row?.updatedDate || ''),
    fireCentre: incident.fireCentre || row?.fireCentre || '',
    discoveryDate: String(incident.discoveryDate || row?.discoveryDate || ''),
    causeDetail: incident.causeDetail || row?.causeDetail || '',
    responseTypeDetail: incident.responseTypeDetail || row?.responseTypeDetail || '',
    responseTypeCode: incident.responseTypeCode || row?.responseTypeCode || '',
    suspectedCauseText: response.suspectedCauseText || '',
    resourcesAssignedText: response.resourcesAssignedText || '',
    evacuationsText: response.evacuationsText || '',
    mapMessage: response.mapMessage || '',
  };
}

function toDurationMs(startedAt, finishedAt = nowIso()) {
  const start = Date.parse(String(startedAt || ''));
  const end = Date.parse(String(finishedAt || ''));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, end - start);
}

function deriveArchivalCompletenessStatus({
  endpointTotalRowCount = 0,
  endpointRowsFetched = 0,
  persistedIncidentCount = 0,
  endpointScopeLimited = false,
} = {}) {
  if (Number(endpointRowsFetched) < Number(endpointTotalRowCount)) return 'partial';
  if (Number(persistedIncidentCount) < Number(endpointRowsFetched)) return 'partial';
  return endpointScopeLimited ? 'endpoint-limited' : 'complete';
}

function buildArchivalCompletenessWarning({
  endpointTotalRowCount = 0,
  endpointRowsFetched = 0,
  persistedIncidentCount = 0,
  endpointScopeLimited = false,
} = {}) {
  if (Number(endpointRowsFetched) < Number(endpointTotalRowCount)) {
    return `Fetched ${endpointRowsFetched} of ${endpointTotalRowCount} endpoint rows for the archival query.`;
  }
  if (Number(persistedIncidentCount) < Number(endpointRowsFetched)) {
    return `Persisted ${persistedIncidentCount} of ${endpointRowsFetched} fetched rows locally.`;
  }
  if (endpointScopeLimited) {
    return 'Upstream archival scope appears limited to the current published 2025 incident subset defined by the stage filters.';
  }
  return '';
}

export function createDbLifecycleManager({ app, dialog, BrowserWindow }) {
  const runtimeConfigPath = path.join(app.getPath('userData'), RUNTIME_CONFIG_FILE);
  let sqlPromise;
  let db = null;
  let activeDbPath = null;
  const captureProgressListeners = new Set();
  let captureRuntime = {
    activeRun: null,
    lastRun: null,
  };
  let lastCaptureRuntimePersistAt = 0;

  const loadSql = async () => {
    if (!sqlPromise) {
      sqlPromise = initSqlJs();
    }
    return sqlPromise;
  };

  const readRuntimeConfig = () => {
    try {
      const raw = fs.readFileSync(runtimeConfigPath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  const writeRuntimeConfig = (next) => {
    fs.mkdirSync(path.dirname(runtimeConfigPath), { recursive: true });
    fs.writeFileSync(runtimeConfigPath, JSON.stringify(next, null, 2));
  };

  const getDbFileSizeBytes = () => {
    try {
      return activeDbPath && fs.existsSync(activeDbPath) ? fs.statSync(activeDbPath).size : 0;
    } catch {
      return 0;
    }
  };

  const normalizeRunSnapshot = (value) => {
    if (!value || typeof value !== 'object') return null;
    const startedAt = value.startedAt ? String(value.startedAt) : null;
    const finishedAt = value.finishedAt ? String(value.finishedAt) : null;
    const base = {
      state: String(value.state || 'idle'),
      trigger: String(value.trigger || ''),
      startedAt,
      finishedAt,
      durationMs:
        Number.isFinite(Number(value.durationMs)) && Number(value.durationMs) >= 0
          ? Number(value.durationMs)
          : startedAt
          ? toDurationMs(startedAt, finishedAt || nowIso())
          : 0,
      listedIncidentCount: Number(value.listedIncidentCount || 0),
      targetedIncidentCount: Number(value.targetedIncidentCount || 0),
      completedIncidentCount: Number(value.completedIncidentCount || 0),
      failedIncidentCount: Number(value.failedIncidentCount || 0),
      currentIncidentName: value.currentIncidentName ? String(value.currentIncidentName) : '',
      currentIncidentNumber: value.currentIncidentNumber ? String(value.currentIncidentNumber) : '',
      currentStageKey: value.currentStageKey ? String(value.currentStageKey) : '',
      currentStageLabel: value.currentStageLabel ? String(value.currentStageLabel) : '',
      currentArtifactLabel: value.currentArtifactLabel ? String(value.currentArtifactLabel) : '',
      currentActivity: value.currentActivity ? String(value.currentActivity) : '',
      failureReason: value.failureReason ? String(value.failureReason) : '',
      detailCaptureSuccessCount: Number(value.detailCaptureSuccessCount || 0),
      detailCaptureFailureCount: Number(value.detailCaptureFailureCount || 0),
      attachmentsCaptureCount: Number(value.attachmentsCaptureCount || 0),
      mediaDownloadAttemptedCount: Number(value.mediaDownloadAttemptedCount || 0),
      mediaStoredCount: Number(value.mediaStoredCount || 0),
      mediaFailureCount: Number(value.mediaFailureCount || 0),
      externalLinksCaptureCount: Number(value.externalLinksCaptureCount || 0),
      perimeterCaptureCount: Number(value.perimeterCaptureCount || 0),
      responseHistoryExtractedCount: Number(value.responseHistoryExtractedCount || 0),
      archivalFireYear: Number(value.archivalFireYear || 0),
      endpointTotalRowCount: Number(value.endpointTotalRowCount || 0),
      endpointRowsFetched: Number(value.endpointRowsFetched || 0),
      endpointPageCount: Number(value.endpointPageCount || 0),
      persistedIncidentCount: Number(value.persistedIncidentCount || 0),
      endpointScopeLimited: Boolean(value.endpointScopeLimited),
      completenessStatus: value.completenessStatus ? String(value.completenessStatus) : '',
      completenessWarning: value.completenessWarning ? String(value.completenessWarning) : '',
      queryScope:
        value.queryScope && typeof value.queryScope === 'object'
          ? value.queryScope
          : safeJsonParse(String(value.queryScope || '{}'), {}),
      failureCategoryCounts:
        value.failureCategoryCounts && typeof value.failureCategoryCounts === 'object'
          ? value.failureCategoryCounts
          : {},
    };
    return base;
  };

  const loadCaptureRuntime = () => {
    const config = readRuntimeConfig();
    captureRuntime = {
      activeRun: normalizeRunSnapshot(config.activeCaptureRun),
      lastRun: normalizeRunSnapshot(config.lastCaptureRun),
    };
  };

  const persistCaptureRuntime = ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && now - lastCaptureRuntimePersistAt < 2000) {
      return;
    }
    const current = readRuntimeConfig();
    writeRuntimeConfig({
      ...current,
      activeCaptureRun: captureRuntime.activeRun,
      lastCaptureRun: captureRuntime.lastRun,
    });
    lastCaptureRuntimePersistAt = now;
  };

  const getCaptureRuntimeState = () => {
    const lastSuccessfulCaptureAt = db ? getValue(db, 'app_state', 'last_successful_capture_at') : null;
    return {
      activeRun: normalizeRunSnapshot(captureRuntime.activeRun),
      lastRun: normalizeRunSnapshot(captureRuntime.lastRun),
      dbFileSizeBytes: getDbFileSizeBytes(),
      lastSuccessfulCaptureAt: lastSuccessfulCaptureAt ? String(lastSuccessfulCaptureAt) : null,
    };
  };

  const emitCaptureRuntime = ({ forcePersist = false } = {}) => {
    persistCaptureRuntime({ force: forcePersist });
    const payload = getCaptureRuntimeState();
    for (const listener of captureProgressListeners) {
      listener(payload);
    }
    return payload;
  };

  const setActiveCaptureRun = (next, options = {}) => {
    captureRuntime.activeRun = normalizeRunSnapshot(next);
    return emitCaptureRuntime(options);
  };

  const updateActiveCaptureRun = (patch, options = {}) => {
    const current = normalizeRunSnapshot(captureRuntime.activeRun) || {
      state: 'running',
      trigger: '',
      startedAt: nowIso(),
    };
    const next = normalizeRunSnapshot({
      ...current,
      ...patch,
      durationMs: current.startedAt ? toDurationMs(current.startedAt, patch?.finishedAt || nowIso()) : 0,
    });
    captureRuntime.activeRun = next;
    return emitCaptureRuntime(options);
  };

  const finalizeCaptureRun = (patch, options = {}) => {
    const current = normalizeRunSnapshot(captureRuntime.activeRun) || {};
    const finishedAt = patch?.finishedAt || nowIso();
    captureRuntime.lastRun = normalizeRunSnapshot({
      ...current,
      ...patch,
      finishedAt,
      durationMs: current.startedAt ? toDurationMs(current.startedAt, finishedAt) : Number(patch?.durationMs || 0),
    });
    captureRuntime.activeRun = null;
    return emitCaptureRuntime({ forcePersist: true, ...options });
  };

  loadCaptureRuntime();

  const setLastUsedPath = (dbPath) => {
    const current = readRuntimeConfig();
    writeRuntimeConfig({ ...current, lastUsedDbPath: dbPath || null });
  };

  const getValue = (database, table, key) => {
    const result = database.exec(`SELECT value FROM ${table} WHERE key = ?`, [key]);
    if (!result.length || !result[0].values.length) return null;
    return String(result[0].values[0][0]);
  };

  const setValue = (database, table, key, value) => {
    database.run(
      `INSERT INTO ${table} (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, String(value)]
    );
  };

  const ensureColumn = (database, table, column, ddl) => {
    const info = database.exec(`PRAGMA table_info(${table})`);
    const hasColumn =
      info.length && info[0].values.some((row) => String(row[1]).toLowerCase() === column.toLowerCase());
    if (!hasColumn) {
      database.run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  };

  const bootstrapTables = (database) => {
    database.run('CREATE TABLE IF NOT EXISTS workspace_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    database.run('CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    database.run(`
      CREATE TABLE IF NOT EXISTS incidents (
        fire_year TEXT NOT NULL,
        incident_number TEXT NOT NULL,
        incident_guid TEXT,
        incident_name TEXT,
        stage TEXT,
        fire_centre TEXT,
        location TEXT,
        discovery_date TEXT,
        updated_date TEXT,
        size_ha REAL,
        latitude REAL,
        longitude REAL,
        fire_of_note INTEGER NOT NULL DEFAULT 0,
        row_json TEXT NOT NULL,
        detail_json TEXT,
        last_snapshot_hash TEXT,
        last_captured_at TEXT NOT NULL,
        PRIMARY KEY (fire_year, incident_number)
      )
    `);
    database.run(`
      CREATE TABLE IF NOT EXISTS incident_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fire_year TEXT NOT NULL,
        incident_number TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        snapshot_hash TEXT NOT NULL,
        snapshot_json TEXT NOT NULL
      )
    `);
    database.run(`
      CREATE TABLE IF NOT EXISTS incident_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fire_year TEXT NOT NULL,
        incident_number TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        update_index INTEGER NOT NULL,
        update_hash TEXT NOT NULL,
        update_text TEXT NOT NULL
      )
    `);
    database.run(`
      CREATE TABLE IF NOT EXISTS raw_source_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fire_year TEXT NOT NULL,
        incident_number TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        source_kind TEXT NOT NULL,
        source_url TEXT,
        status TEXT,
        error_text TEXT,
        payload_text TEXT
      )
    `);
    database.run(`
      CREATE TABLE IF NOT EXISTS incident_capture_status (
        fire_year TEXT NOT NULL,
        incident_number TEXT NOT NULL,
        has_list_row INTEGER NOT NULL DEFAULT 0,
        has_detail_source INTEGER NOT NULL DEFAULT 0,
        has_attachments_metadata INTEGER NOT NULL DEFAULT 0,
        has_local_media INTEGER NOT NULL DEFAULT 0,
        has_external_links_metadata INTEGER NOT NULL DEFAULT 0,
        has_perimeter_payload INTEGER NOT NULL DEFAULT 0,
        has_response_history INTEGER NOT NULL DEFAULT 0,
        last_capture_at TEXT NOT NULL,
        last_capture_error TEXT,
        PRIMARY KEY (fire_year, incident_number)
      )
    `);
    database.run(`
      CREATE TABLE IF NOT EXISTS incident_media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fire_year TEXT NOT NULL,
        incident_number TEXT NOT NULL,
        attachment_guid TEXT NOT NULL,
        asset_kind TEXT NOT NULL DEFAULT 'image',
        variant_role TEXT NOT NULL DEFAULT 'original',
        source_url TEXT NOT NULL,
        file_name TEXT,
        mime_type TEXT,
        byte_length INTEGER NOT NULL DEFAULT 0,
        content_hash TEXT,
        fetched_at TEXT NOT NULL,
        is_thumbnail INTEGER NOT NULL DEFAULT 0,
        blob_bytes BLOB NOT NULL,
        UNIQUE (fire_year, incident_number, attachment_guid, is_thumbnail)
      )
    `);
    database.run(`
      CREATE TABLE IF NOT EXISTS incident_pins (
        fire_year TEXT NOT NULL,
        incident_number TEXT NOT NULL,
        incident_name TEXT,
        stage TEXT,
        fire_centre TEXT,
        size_ha REAL,
        updated_date TEXT,
        pinned_at TEXT NOT NULL,
        PRIMARY KEY (fire_year, incident_number)
      )
    `);
    database.run(`
      CREATE TABLE IF NOT EXISTS capture_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        captured_at TEXT NOT NULL,
        trigger TEXT,
        listed_incident_count INTEGER NOT NULL DEFAULT 0,
        targeted_incident_count INTEGER NOT NULL DEFAULT 0,
        detail_capture_success_count INTEGER NOT NULL DEFAULT 0,
        detail_capture_failure_count INTEGER NOT NULL DEFAULT 0,
        attachments_capture_count INTEGER NOT NULL DEFAULT 0,
        media_download_attempted_count INTEGER NOT NULL DEFAULT 0,
        media_stored_count INTEGER NOT NULL DEFAULT 0,
        media_failure_count INTEGER NOT NULL DEFAULT 0,
        external_links_capture_count INTEGER NOT NULL DEFAULT 0,
        perimeter_capture_count INTEGER NOT NULL DEFAULT 0,
        response_history_extracted_count INTEGER NOT NULL DEFAULT 0,
        archival_fire_year INTEGER NOT NULL DEFAULT 0,
        endpoint_total_row_count INTEGER NOT NULL DEFAULT 0,
        endpoint_rows_fetched INTEGER NOT NULL DEFAULT 0,
        endpoint_page_count INTEGER NOT NULL DEFAULT 0,
        persisted_incident_count INTEGER NOT NULL DEFAULT 0,
        endpoint_scope_limited INTEGER NOT NULL DEFAULT 0,
        completeness_status TEXT NOT NULL DEFAULT 'partial',
        completeness_warning TEXT,
        query_scope_json TEXT NOT NULL DEFAULT '{}',
        artifact_failure_counts_json TEXT NOT NULL DEFAULT '{}'
      )
    `);

    ensureColumn(database, 'incidents', 'detail_json', 'detail_json TEXT');
    ensureColumn(database, 'incidents', 'last_snapshot_hash', 'last_snapshot_hash TEXT');
    ensureColumn(database, 'incident_snapshots', 'snapshot_hash', 'snapshot_hash TEXT');
    ensureColumn(database, 'incident_snapshots', 'snapshot_json', 'snapshot_json TEXT');
    ensureColumn(database, 'incident_updates', 'update_hash', 'update_hash TEXT');
    ensureColumn(database, 'incident_updates', 'update_published_at', 'update_published_at TEXT');
    ensureColumn(database, 'incident_updates', 'source_kind', "source_kind TEXT DEFAULT 'capture-detail'");
    ensureColumn(
      database,
      'capture_runs',
      'targeted_incident_count',
      'targeted_incident_count INTEGER NOT NULL DEFAULT 0'
    );
    ensureColumn(
      database,
      'capture_runs',
      'attachments_capture_count',
      'attachments_capture_count INTEGER NOT NULL DEFAULT 0'
    );
    ensureColumn(
      database,
      'capture_runs',
      'media_download_attempted_count',
      'media_download_attempted_count INTEGER NOT NULL DEFAULT 0'
    );
    ensureColumn(
      database,
      'capture_runs',
      'media_stored_count',
      'media_stored_count INTEGER NOT NULL DEFAULT 0'
    );
    ensureColumn(
      database,
      'capture_runs',
      'media_failure_count',
      'media_failure_count INTEGER NOT NULL DEFAULT 0'
    );
    ensureColumn(
      database,
      'incident_capture_status',
      'has_local_media',
      'has_local_media INTEGER NOT NULL DEFAULT 0'
    );
    ensureColumn(database, 'incident_media', 'asset_kind', "asset_kind TEXT NOT NULL DEFAULT 'image'");
    ensureColumn(database, 'incident_media', 'variant_role', "variant_role TEXT NOT NULL DEFAULT 'original'");
    ensureColumn(
      database,
      'capture_runs',
      'external_links_capture_count',
      'external_links_capture_count INTEGER NOT NULL DEFAULT 0'
    );
    ensureColumn(
      database,
      'capture_runs',
      'perimeter_capture_count',
      'perimeter_capture_count INTEGER NOT NULL DEFAULT 0'
    );
    ensureColumn(
      database,
      'capture_runs',
      'response_history_extracted_count',
      'response_history_extracted_count INTEGER NOT NULL DEFAULT 0'
    );
    ensureColumn(database, 'capture_runs', 'archival_fire_year', 'archival_fire_year INTEGER NOT NULL DEFAULT 0');
    ensureColumn(
      database,
      'capture_runs',
      'endpoint_total_row_count',
      'endpoint_total_row_count INTEGER NOT NULL DEFAULT 0'
    );
    ensureColumn(
      database,
      'capture_runs',
      'endpoint_rows_fetched',
      'endpoint_rows_fetched INTEGER NOT NULL DEFAULT 0'
    );
    ensureColumn(
      database,
      'capture_runs',
      'endpoint_page_count',
      'endpoint_page_count INTEGER NOT NULL DEFAULT 0'
    );
    ensureColumn(
      database,
      'capture_runs',
      'persisted_incident_count',
      'persisted_incident_count INTEGER NOT NULL DEFAULT 0'
    );
    ensureColumn(
      database,
      'capture_runs',
      'endpoint_scope_limited',
      'endpoint_scope_limited INTEGER NOT NULL DEFAULT 0'
    );
    ensureColumn(
      database,
      'capture_runs',
      'completeness_status',
      "completeness_status TEXT NOT NULL DEFAULT 'partial'"
    );
    ensureColumn(database, 'capture_runs', 'completeness_warning', 'completeness_warning TEXT');
    ensureColumn(
      database,
      'capture_runs',
      'query_scope_json',
      "query_scope_json TEXT NOT NULL DEFAULT '{}'"
    );
    ensureColumn(
      database,
      'capture_runs',
      'artifact_failure_counts_json',
      "artifact_failure_counts_json TEXT NOT NULL DEFAULT '{}'"
    );
  };

  const flushDb = () => {
    if (!db || !activeDbPath) return;
    const data = Buffer.from(db.export());
    fs.writeFileSync(activeDbPath, data);
  };

  const closeActive = () => {
    if (db) {
      db.close();
      db = null;
    }
    activeDbPath = null;
  };

  const getStatus = () => {
    if (!db || !activeDbPath) {
      return {
        hasActiveDb: false,
        dbStateLabel: 'No DB',
        captureStateLabel: 'No DB',
        captureStateCode: 'no_db',
        autoCheckMinutes: 0,
        autoCheckEnabled: false,
        name: null,
        path: null,
        createdAt: null,
        lastOpenedAt: null,
        lastCapturedAt: null,
        lastSuccessfulCaptureAt: null,
        lastCaptureError: null,
        capturedIncidentCount: 0,
        dbFileSizeBytes: 0,
      };
    }

    const createdAt = getValue(db, 'workspace_meta', 'created_at');
    const lastOpenedAt = getValue(db, 'app_state', 'last_opened_at');
    const captureStateCode = getValue(db, 'app_state', 'capture_state') || 'never_captured';
    const lastCapturedAt = getValue(db, 'app_state', 'last_capture_at');
    const lastSuccessfulCaptureAt = getValue(db, 'app_state', 'last_successful_capture_at');
    const lastCaptureError = getValue(db, 'app_state', 'last_capture_error');
    const autoCheckMinutes = Number(getValue(db, 'app_state', 'auto_check_minutes') || 0);
    const countResult = db.exec('SELECT COUNT(*) FROM incidents');
    const capturedIncidentCount =
      countResult.length && countResult[0].values.length ? Number(countResult[0].values[0][0]) : 0;
    const captureStateLabelMap = {
      never_captured: 'Never captured',
      capture_running: 'Capture running',
      healthy: 'Healthy',
      error: 'Error',
    };

    return {
      hasActiveDb: true,
      dbStateLabel: 'DB selected',
      captureStateLabel: captureStateLabelMap[captureStateCode] || 'Error',
      captureStateCode,
      autoCheckMinutes,
      autoCheckEnabled: autoCheckMinutes > 0,
      name: path.basename(activeDbPath),
      path: activeDbPath,
      createdAt,
      lastOpenedAt,
      lastCapturedAt,
      lastSuccessfulCaptureAt,
      lastCaptureError,
      capturedIncidentCount,
      dbFileSizeBytes: getDbFileSizeBytes(),
    };
  };

  const openDbAtPath = async (dbPath) => {
    const SQL = await loadSql();
    const bytes = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : null;

    closeActive();
    db = bytes && bytes.length ? new SQL.Database(bytes) : new SQL.Database();
    activeDbPath = dbPath;

    bootstrapTables(db);
    if (!getValue(db, 'workspace_meta', 'created_at')) {
      const fallbackCreatedAt = fs.existsSync(dbPath) ? fs.statSync(dbPath).birthtime.toISOString() : nowIso();
      setValue(db, 'workspace_meta', 'created_at', fallbackCreatedAt);
    }
    if (!getValue(db, 'app_state', 'capture_state')) {
      setValue(db, 'app_state', 'capture_state', 'never_captured');
    }
    if (!getValue(db, 'app_state', 'auto_check_minutes')) {
      setValue(db, 'app_state', 'auto_check_minutes', '0');
    }
    setValue(db, 'app_state', 'last_opened_at', nowIso());
    flushDb();
    setLastUsedPath(dbPath);
    loadCaptureRuntime();
    if (getValue(db, 'app_state', 'capture_state') !== 'capture_running' && captureRuntime.activeRun) {
      captureRuntime.activeRun = null;
      emitCaptureRuntime({ forcePersist: true });
    }
    return getStatus();
  };

  const createDbAtPath = async (dbPath) => {
    const createdAt = nowIso();
    const status = await openDbAtPath(dbPath);
    setValue(db, 'workspace_meta', 'created_at', createdAt);
    setValue(db, 'app_state', 'last_opened_at', nowIso());
    flushDb();
    return { ok: true, canceled: false, status };
  };

  const selectDbAtPath = async (dbPath) => {
    const status = await openDbAtPath(dbPath);
    return { ok: true, canceled: false, status };
  };

  const createNewDb = async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? null;
    const selected = await dialog.showSaveDialog(focusedWindow, {
      title: 'Create Open Fireside DB',
      defaultPath: path.join(app.getPath('documents'), 'open-fireside.sqlite'),
      filters: [
        { name: 'SQLite DB', extensions: ['sqlite', 'db'] },
        { name: 'All files', extensions: ['*'] },
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    });
    if (selected.canceled || !selected.filePath) {
      return { ok: false, canceled: true, status: getStatus() };
    }

    return createDbAtPath(selected.filePath);
  };

  const chooseExistingDb = async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? null;
    const selected = await dialog.showOpenDialog(focusedWindow, {
      title: 'Select Open Fireside DB',
      filters: [
        { name: 'SQLite DB', extensions: ['sqlite', 'db'] },
        { name: 'All files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (selected.canceled || !selected.filePaths.length) {
      return { ok: false, canceled: true, status: getStatus() };
    }
    return selectDbAtPath(selected.filePaths[0]);
  };

  const deleteActiveDb = async () => {
    if (!activeDbPath) {
      return { ok: false, error: 'No active DB selected.', status: getStatus() };
    }
    const dbPath = activeDbPath;
    closeActive();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    setLastUsedPath(null);
    return { ok: true, status: getStatus() };
  };

  const markCaptureRunning = ({
    trigger = 'manual',
    startedAt = nowIso(),
    listedIncidentCount = 0,
    targetedIncidentCount = 0,
    ...extra
  } = {}) => {
    if (!db) return { ok: false, error: 'No active DB selected.', status: getStatus() };
    setValue(db, 'app_state', 'capture_state', 'capture_running');
    setValue(db, 'app_state', 'last_capture_error', '');
    flushDb();
    const runtime = setActiveCaptureRun(
      {
        state: 'running',
        trigger,
        startedAt,
        listedIncidentCount,
        targetedIncidentCount,
        completedIncidentCount: 0,
        failedIncidentCount: 0,
        currentStageKey: extra.currentStageKey || 'list_ingest',
        currentStageLabel: extra.currentStageLabel || 'List ingest',
        currentArtifactLabel: extra.currentArtifactLabel || '',
        currentActivity: extra.currentActivity || 'Loading current incident list',
        ...extra,
      },
      { forcePersist: true }
    );
    return { ok: true, status: getStatus(), runtime };
  };

  const markCaptureProgress = (patch = {}) => {
    if (!db) return { ok: false, error: 'No active DB selected.', status: getStatus() };
    const runtime = updateActiveCaptureRun(patch, {
      forcePersist: Boolean(patch.forcePersist || patch.currentStageKey || patch.finishedAt),
    });
    return { ok: true, status: getStatus(), runtime };
  };

  const markCaptureError = (message, extra = {}) => {
    if (!db) return { ok: false, error: 'No active DB selected.', status: getStatus() };
    setValue(db, 'app_state', 'capture_state', 'error');
    setValue(db, 'app_state', 'last_capture_error', message || 'Capture failed.');
    flushDb();
    const runtime = finalizeCaptureRun(
      {
        ...extra,
        state: 'error',
        finishedAt: extra.finishedAt || nowIso(),
        failureReason: message || 'Capture failed.',
        currentActivity: message || 'Capture failed.',
      },
      { forcePersist: true }
    );
    return { ok: true, status: getStatus(), runtime };
  };

  const setAutoCheckMinutes = (minutes) => {
    if (!db) return { ok: false, error: 'No active DB selected.', status: getStatus() };
    const next = Number(minutes);
    const normalized = Number.isFinite(next) && next > 0 ? Math.max(1, Math.round(next)) : 0;
    setValue(db, 'app_state', 'auto_check_minutes', String(normalized));
    flushDb();
    return { ok: true, status: getStatus() };
  };

  const appendRawRecord = ({ fireYear, incidentNumber, capturedAt, sourceKind, sourceUrl, status, errorText, payload }) => {
    db.run(
      `
      INSERT INTO raw_source_records (
        fire_year, incident_number, captured_at, source_kind, source_url, status, error_text, payload_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        String(fireYear),
        String(incidentNumber),
        capturedAt,
        String(sourceKind || ''),
        sourceUrl || null,
        status || null,
        errorText || null,
        asPayloadText(payload),
      ]
    );
  };

  const getExistingMediaRows = (fireYear, incidentNumber) => {
    const rows = db.exec(
      `
      SELECT attachment_guid, is_thumbnail, source_url,
        CASE
          WHEN variant_role IS NULL OR TRIM(variant_role) = '' THEN CASE WHEN is_thumbnail = 1 THEN 'thumbnail' ELSE 'original' END
          WHEN variant_role = 'original' AND is_thumbnail = 1 THEN 'thumbnail'
          ELSE variant_role
        END AS normalized_variant_role
      FROM incident_media
      WHERE fire_year = ? AND incident_number = ?
      `,
      [String(fireYear), String(incidentNumber)]
    );
    return rows.length ? rows[0].values : [];
  };

  const getStoredAssetAttachmentGuids = (fireYear, incidentNumber, { originalOnly = false } = {}) =>
    new Set(
      getExistingMediaRows(fireYear, incidentNumber)
        .filter((row) => !originalOnly || String(row[3] || (Number(row[1] || 0) ? 'thumbnail' : 'original')) === 'original')
        .map((row) => String(row[0] || ''))
        .filter(Boolean)
    );

  const hasCompleteLocalMediaForAttachments = (fireYear, incidentNumber, attachments = []) => {
    const renderableAttachments = attachments.filter(isRenderableGalleryAttachment);
    if (!renderableAttachments.length) return true;
    const storedAttachmentGuids = getStoredAssetAttachmentGuids(fireYear, incidentNumber, { originalOnly: true });
    return renderableAttachments.every((asset) => storedAttachmentGuids.has(String(asset.attachmentGuid || '')));
  };

  const hasCompleteLocalAssetsForAttachments = (fireYear, incidentNumber, attachments = []) => {
    const downloadableAttachments = attachments.filter((asset) => isDownloadableAttachment(asset, fireYear, incidentNumber));
    if (!downloadableAttachments.length) return true;
    const storedAttachmentGuids = getStoredAssetAttachmentGuids(fireYear, incidentNumber, { originalOnly: true });
    return downloadableAttachments.every((asset) => storedAttachmentGuids.has(String(asset.attachmentGuid || '')));
  };

  const storeIncidentMediaRecord = ({
    fireYear,
    incidentNumber,
    attachmentGuid,
    assetKind,
    variantRole,
    sourceUrl,
    fileName,
    mimeType,
    byteLength,
    contentHash,
    fetchedAt,
    isThumbnail,
    blobBytes,
  }) => {
    db.run(
      `
      INSERT INTO incident_media (
        fire_year, incident_number, attachment_guid, asset_kind, variant_role, source_url, file_name, mime_type,
        byte_length, content_hash, fetched_at, is_thumbnail, blob_bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(fire_year, incident_number, attachment_guid, is_thumbnail) DO UPDATE SET
        asset_kind = excluded.asset_kind,
        variant_role = excluded.variant_role,
        source_url = excluded.source_url,
        file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        byte_length = excluded.byte_length,
        content_hash = excluded.content_hash,
        fetched_at = excluded.fetched_at,
        blob_bytes = excluded.blob_bytes
      `,
      [
        String(fireYear),
        String(incidentNumber),
        String(attachmentGuid || ''),
        assetKind || 'download',
        variantRole || (isThumbnail ? 'thumbnail' : 'original'),
        sourceUrl,
        fileName || null,
        mimeType || null,
        Number(byteLength || 0),
        contentHash || null,
        fetchedAt,
        isThumbnail ? 1 : 0,
        blobBytes,
      ]
    );
  };

  const captureIncidentAssets = async ({ fireYear, incidentNumber, attachments = [], capturedAt, countFailure }) => {
    const existingKeys = new Set(
      getExistingMediaRows(fireYear, incidentNumber).map((row) =>
        `${String(row[0] || '')}:${String(row[3] || (Number(row[1] || 0) ? 'thumbnail' : 'original'))}:${String(row[2] || '')}`
      )
    );
    const downloadableAssets = attachments.filter((asset) => isDownloadableAttachment(asset, fireYear, incidentNumber));
    let mediaDownloadAttemptedCount = 0;
    let mediaStoredCount = 0;
    let mediaFailureCount = 0;

    for (const asset of downloadableAssets) {
      const targets = getAttachmentAssetTargets(asset, fireYear, incidentNumber);
      for (const target of targets) {
        const key = `${String(asset.attachmentGuid || '')}:${target.variantRole}:${target.sourceUrl}`;
        if (existingKeys.has(key)) {
          continue;
        }
        mediaDownloadAttemptedCount += 1;
        const fetched = await fetchBinaryWithRetry(target.sourceUrl, {
          timeoutMs: 15000,
          retries: 2,
          backoffMs: 500,
        });
        if (!fetched.ok || !fetched.bytes?.byteLength) {
          mediaFailureCount += 1;
          countFailure(fetched.status, fetched.error);
          continue;
        }

        storeIncidentMediaRecord({
          fireYear,
          incidentNumber,
          attachmentGuid: asset.attachmentGuid,
          assetKind: target.assetKind,
          variantRole: target.variantRole,
          sourceUrl: target.sourceUrl,
          fileName: asset.fileName || asset.title || null,
          mimeType: fetched.mimeType || asset.mimeType || null,
          byteLength: fetched.byteLength,
          contentHash: crypto.createHash('sha256').update(fetched.bytes).digest('hex'),
          fetchedAt: capturedAt,
          isThumbnail: target.isThumbnail,
          blobBytes: fetched.bytes,
        });
        existingKeys.add(key);
        mediaStoredCount += 1;
      }
    }

    return {
      mediaDownloadAttemptedCount,
      mediaStoredCount,
      mediaFailureCount,
      hasLocalAssets: hasCompleteLocalAssetsForAttachments(fireYear, incidentNumber, attachments),
      hasLocalMedia: hasCompleteLocalMediaForAttachments(fireYear, incidentNumber, attachments),
    };
  };

  const hasUpdateHashForIncident = (fireYear, incidentNumber, updateHash) => {
    const rows = db.exec(
      'SELECT 1 FROM incident_updates WHERE fire_year = ? AND incident_number = ? AND update_hash = ? LIMIT 1',
      [String(fireYear), String(incidentNumber), String(updateHash)]
    );
    return Boolean(rows.length && rows[0].values.length);
  };

  const decodeHtml = (value) =>
    String(value || '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&#x2F;/gi, '/');

  const normalizeUpdateText = (value) =>
    decodeHtml(value)
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const parseDatePrefix = (text) => {
    const value = String(text || '').trim();
    const dateMatch = value.match(
      /^(?:updated\s+)?((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},\s+\d{4})/i
    );
    return dateMatch ? dateMatch[1] : null;
  };

  const extractUpdatesFromDetailApiPayload = (payloadText) => {
    const payload = safeJsonParse(String(payloadText || ''), null);
    const overview = String(payload?.incidentOverview || '').trim();
    if (!payload) return { updates: [], reason: 'detail_api_payload_invalid' };
    if (!overview) return { updates: [], reason: 'no_incident_overview' };

    const lines = decodeHtml(
      overview
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li[^>]*>/gi, '- ')
        .replace(/<[^>]+>/g, ' ')
    )
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    if (!lines.length) {
      return { updates: [], reason: 'incident_overview_empty_after_strip' };
    }

    const updates = [];
    let current = [];
    const flush = () => {
      const text = normalizeUpdateText(current.join('\n'));
      if (text) {
        updates.push({
          text,
          publishedAt: parseDatePrefix(text),
        });
      }
      current = [];
    };

    for (const line of lines) {
      if (/^updated\b/i.test(line)) {
        flush();
      }
      current.push(line);
    }
    flush();

    const deduped = [];
    const seen = new Set();
    for (const row of updates) {
      const key = hashPayload(row.text);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(row);
    }

    return { updates: deduped, reason: deduped.length ? 'detail_api_incident_overview' : 'incident_overview_no_updates' };
  };

  const extractUpdatesFromArchivedHtml = (html) => {
    const source = String(html || '');
    if (!source.trim()) return { updates: [], reason: 'empty_html' };

    const scriptJsonMatches = [...source.matchAll(/"responseUpdates?"\s*:\s*(\[[\s\S]*?\])/gi)];
    const scriptCandidates = [];
    for (const match of scriptJsonMatches) {
      const parsed = safeJsonParse(match[1], null);
      if (!Array.isArray(parsed)) continue;
      for (const item of parsed) {
        const normalized = normalizeUpdateText(item);
        if (normalized) {
          scriptCandidates.push({
            text: normalized,
            publishedAt: parseDatePrefix(normalized),
          });
        }
      }
    }
    if (scriptCandidates.length) {
      return { updates: scriptCandidates, reason: 'script_json' };
    }

    const noScripts = source
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ');
    const plain = decodeHtml(
      noScripts
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
    );

    if (!/response update/i.test(plain)) {
      return { updates: [], reason: 'no_response_update_heading' };
    }

    const cleanedLines = plain
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const stopHeadings = [
      'evacuations',
      'suspected cause',
      'resources assigned',
      'map downloads',
      'gallery',
      'discourse',
    ];
    const updates = [];
    for (let index = 0; index < cleanedLines.length; index += 1) {
      if (!/^response update$/i.test(cleanedLines[index])) continue;
      const block = [];
      for (let cursor = index + 1; cursor < cleanedLines.length; cursor += 1) {
        const current = cleanedLines[cursor];
        if (stopHeadings.some((heading) => current.toLowerCase().startsWith(heading))) break;
        if (/^response update$/i.test(current)) break;
        block.push(current);
      }
      const normalized = normalizeUpdateText(block.join('\n'));
      if (normalized) {
        updates.push({
          text: normalized,
          publishedAt: parseDatePrefix(normalized),
        });
      }
    }

    const deduped = [];
    const seen = new Set();
    for (const row of updates) {
      const key = hashPayload(row.text);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(row);
    }

    return { updates: deduped, reason: deduped.length ? 'heading_blocks' : 'no_blocks_after_heading' };
  };

  const writeCaptureRecords = async ({ listRows, detailRecords, detailFailures, capturedAt, trigger, listMetadata = {} }) => {
    const captureTime = capturedAt || nowIso();
    const detailByIncidentKey = new Map();
    const detailFailureByIncidentKey = new Map();
    for (const detail of detailRecords) {
      const incident = detail?.incident;
      if (!incident?.incidentNumber || !incident?.fireYear) continue;
      detailByIncidentKey.set(incidentKey(incident.fireYear, incident.incidentNumber), detail);
    }
    for (const item of detailFailures || []) {
      if (!item?.incidentNumber || !item?.fireYear) continue;
      detailFailureByIncidentKey.set(
        incidentKey(item.fireYear, item.incidentNumber),
        String(item.error || 'Detail capture failed')
      );
    }

    let insertedSnapshots = 0;
    let insertedUpdates = 0;
    let insertedRaw = 0;
    let detailCaptureSuccessCount = 0;
    let detailCaptureFailureCount = 0;
    let attachmentsCaptureCount = 0;
    let mediaDownloadAttemptedCount = 0;
    let mediaStoredCount = 0;
    let mediaFailureCount = 0;
    let externalLinksCaptureCount = 0;
    let perimeterCaptureCount = 0;
    let responseHistoryExtractedCount = 0;
    const failureCategoryCounts = {
      timeout: 0,
      aborted: 0,
      http_error: 0,
      parse_failure: 0,
      unavailable: 0,
      network_error: 0,
      error: 0,
    };

    const countFailure = (status, errorText) => {
      const category = classifyFailureCategory(status, errorText);
      failureCategoryCounts[category] = (failureCategoryCounts[category] || 0) + 1;
      return category;
    };

    db.run('BEGIN TRANSACTION');
    try {
      for (const row of listRows) {
        const key = incidentKey(row.fireYear, row.incidentNumber);
        const detail = detailByIncidentKey.get(key) || null;
        const detailFailure = detailFailureByIncidentKey.get(key) || '';
        const wasTargeted = Boolean(detail) || Boolean(detailFailure);
        const incident = detail?.incident || row;
        if (wasTargeted) {
          updateActiveCaptureRun(
            {
              currentStageKey: 'persisting',
              currentStageLabel: 'Persisting incident',
              currentArtifactLabel: 'detail records',
              currentIncidentName: incident?.incidentName || '',
              currentIncidentNumber: incident?.incidentNumber || '',
              currentActivity: `Saving ${incident?.incidentName || incident?.incidentNumber || 'incident'}`,
            },
            { forcePersist: true }
          );
        }
        const snapshotPayload = buildSnapshotPayload(row, detail);
        const snapshotHash = hashPayload(snapshotPayload);

        const currentHashQuery = db.exec(
          'SELECT last_snapshot_hash FROM incidents WHERE fire_year = ? AND incident_number = ? LIMIT 1',
          [String(incident.fireYear), String(incident.incidentNumber)]
        );
        const previousHash =
          currentHashQuery.length && currentHashQuery[0].values.length
            ? String(currentHashQuery[0].values[0][0] || '')
            : '';

        db.run(
          `
          INSERT INTO incidents (
            fire_year, incident_number, incident_guid, incident_name, stage, fire_centre, location,
            discovery_date, updated_date, size_ha, latitude, longitude, fire_of_note,
            row_json, detail_json, last_snapshot_hash, last_captured_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(fire_year, incident_number) DO UPDATE SET
            incident_guid = excluded.incident_guid,
            incident_name = excluded.incident_name,
            stage = excluded.stage,
            fire_centre = excluded.fire_centre,
            location = excluded.location,
            discovery_date = excluded.discovery_date,
            updated_date = excluded.updated_date,
            size_ha = excluded.size_ha,
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            fire_of_note = excluded.fire_of_note,
            row_json = excluded.row_json,
            detail_json = COALESCE(excluded.detail_json, incidents.detail_json),
            last_snapshot_hash = excluded.last_snapshot_hash,
            last_captured_at = excluded.last_captured_at
          `,
          [
            String(incident.fireYear),
            String(incident.incidentNumber),
            incident.incidentGuid || null,
            incident.incidentName || null,
            incident.stage || null,
            incident.fireCentre || null,
            incident.location || null,
            incident.discoveryDate || null,
            incident.updatedDate || null,
            incident.sizeHa ?? null,
            Number.isFinite(Number(incident.latitude)) ? Number(incident.latitude) : null,
            Number.isFinite(Number(incident.longitude)) ? Number(incident.longitude) : null,
            incident.fireOfNote ? 1 : 0,
            JSON.stringify(row),
            detail ? JSON.stringify(detail) : null,
            snapshotHash,
            captureTime,
          ]
        );

        if (!previousHash || previousHash !== snapshotHash) {
          db.run(
            'INSERT INTO incident_snapshots (fire_year, incident_number, captured_at, snapshot_hash, snapshot_json) VALUES (?, ?, ?, ?, ?)',
            [
              String(incident.fireYear),
              String(incident.incidentNumber),
              captureTime,
              snapshotHash,
              JSON.stringify(snapshotPayload),
            ]
          );
          insertedSnapshots += 1;
        }

        appendRawRecord({
          fireYear: incident.fireYear,
          incidentNumber: incident.incidentNumber,
          capturedAt: captureTime,
          sourceKind: 'incident_list_row_json',
          sourceUrl: row?.rawSource?.url || null,
          status: row?.rawSource?.status || 'ok',
          errorText: row?.rawSource?.error || null,
          payload: row.raw || row,
        });
        insertedRaw += 1;

        const rawSources = detail?.rawSources;
        let hasDetailSource = false;
        let hasAttachmentsMetadata = false;
        let hasLocalMedia = false;
        let hasExternalLinksMetadata = false;
        let hasPerimeterPayload = false;
        let hasResponseHistory = false;
        let captureError = detailFailure;

        if (rawSources) {
          hasDetailSource = Boolean(rawSources.detailApi?.ok);
          hasAttachmentsMetadata = Boolean(rawSources.attachments?.ok);
          hasExternalLinksMetadata = Boolean(rawSources.external?.ok);
          hasPerimeterPayload = Boolean(rawSources.perimeter?.ok);
          if (hasAttachmentsMetadata) attachmentsCaptureCount += 1;
          if (hasExternalLinksMetadata) externalLinksCaptureCount += 1;
          if (hasPerimeterPayload) perimeterCaptureCount += 1;

          const artifacts = [
            {
              sourceKind: 'incident_detail_api_json',
              sourceUrl: rawSources.detailApi?.url,
              status: rawSources.detailApi?.status || null,
              errorText: rawSources.detailApi?.error || null,
              payload: rawSources.detailApi?.payload,
            },
            {
              sourceKind: 'incident_detail_html',
              sourceUrl: rawSources.responsePage?.url,
              status: rawSources.responsePage?.status || null,
              errorText: rawSources.responsePage?.error || null,
              payload: rawSources.responsePage?.payload,
            },
            {
              sourceKind: 'incident_attachments_json',
              sourceUrl: rawSources.attachments?.url,
              status: rawSources.attachments?.status || null,
              errorText: rawSources.attachments?.error || null,
              payload: rawSources.attachments?.payload,
            },
            {
              sourceKind: 'incident_external_links_json',
              sourceUrl: rawSources.external?.url,
              status: rawSources.external?.status || null,
              errorText: rawSources.external?.error || null,
              payload: rawSources.external?.payload,
            },
            {
              sourceKind: 'incident_perimeter_json',
              sourceUrl: rawSources.perimeter?.url,
              status: rawSources.perimeter?.status || null,
              errorText: rawSources.perimeter?.error || null,
              payload: rawSources.perimeter?.payload,
            },
            {
              sourceKind: 'incident_tied_evac_json',
              sourceUrl: rawSources.tiedEvac?.url,
              status: rawSources.tiedEvac?.status || null,
              errorText: rawSources.tiedEvac?.error || null,
              payload: rawSources.tiedEvac?.payload,
            },
          ];
          for (const artifact of artifacts) {
            if (artifact.status && artifact.status !== 'ok') {
              countFailure(artifact.status, artifact.errorText);
            }
            appendRawRecord({
              fireYear: incident.fireYear,
              incidentNumber: incident.incidentNumber,
              capturedAt: captureTime,
              ...artifact,
            });
            insertedRaw += 1;
          }

          if (hasAttachmentsMetadata) {
            updateActiveCaptureRun(
              {
                currentStageKey: 'media_bytes',
                currentStageLabel: 'Media bytes',
                currentArtifactLabel: 'gallery media',
                currentIncidentName: incident?.incidentName || '',
                currentIncidentNumber: incident?.incidentNumber || '',
                currentActivity: `Archiving media for ${incident?.incidentName || incident?.incidentNumber || 'incident'}`,
              },
              { forcePersist: true }
            );
            const mediaCapture = await captureIncidentAssets({
              fireYear: incident.fireYear,
              incidentNumber: incident.incidentNumber,
              attachments: detail?.attachments || [],
              capturedAt: captureTime,
              countFailure,
            });
            mediaDownloadAttemptedCount += mediaCapture.mediaDownloadAttemptedCount;
            mediaStoredCount += mediaCapture.mediaStoredCount;
            mediaFailureCount += mediaCapture.mediaFailureCount;
            hasLocalMedia = mediaCapture.hasLocalMedia;
          }
        }

        if (!rawSources && detailFailure) {
          countFailure('error', detailFailure);
        }

        if (wasTargeted) {
          if (hasDetailSource) {
            detailCaptureSuccessCount += 1;
          } else {
            detailCaptureFailureCount += 1;
          }
        }

        const parsedUpdates = [];
        const inlineUpdates = Array.isArray(detail?.response?.responseUpdates) ? detail.response.responseUpdates : [];
        inlineUpdates.forEach((item) => {
          const text = normalizeUpdateText(item);
          if (!text) return;
          parsedUpdates.push({ text, publishedAt: parseDatePrefix(text), sourceKind: 'capture-detail' });
        });

        if (!parsedUpdates.length) {
          updateActiveCaptureRun(
            {
              currentStageKey: 'response_extraction',
              currentStageLabel: 'Response extraction',
              currentArtifactLabel: 'response history',
              currentIncidentName: incident?.incidentName || '',
              currentIncidentNumber: incident?.incidentNumber || '',
              currentActivity: `Extracting response history for ${incident?.incidentName || incident?.incidentNumber || 'incident'}`,
            },
            { forcePersist: false }
          );
          const archivedDetailApiPayload = detail?.rawSources?.detailApi?.payload;
          const recoveredFromApi = extractUpdatesFromDetailApiPayload(asPayloadText(archivedDetailApiPayload));
          recoveredFromApi.updates.forEach((item) => {
            parsedUpdates.push({
              text: item.text,
              publishedAt: item.publishedAt || null,
              sourceKind: 'capture-detail-api-overview',
            });
          });
        }

        if (!parsedUpdates.length) {
          const archivedHtml = detail?.rawSources?.responsePage?.payload;
          const recovered = extractUpdatesFromArchivedHtml(archivedHtml);
          recovered.updates.forEach((item) => {
            parsedUpdates.push({
              text: item.text,
              publishedAt: item.publishedAt || null,
              sourceKind: 'capture-archived-html',
            });
          });
        }

        parsedUpdates.forEach((updateRow, updateIndex) => {
          const nextText = normalizeUpdateText(updateRow.text);
          if (!nextText) return;
          const nextHash = hashPayload(nextText);
          if (hasUpdateHashForIncident(incident.fireYear, incident.incidentNumber, nextHash)) return;
          db.run(
            `
            INSERT INTO incident_updates (
              fire_year, incident_number, captured_at, update_index, update_hash, update_text, update_published_at, source_kind
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              String(incident.fireYear),
              String(incident.incidentNumber),
              captureTime,
              Number(updateIndex),
              nextHash,
              nextText,
              updateRow.publishedAt || null,
              updateRow.sourceKind || 'capture-detail',
            ]
          );
          insertedUpdates += 1;
        });

        hasResponseHistory = parsedUpdates.length > 0;
        if (wasTargeted && hasResponseHistory) responseHistoryExtractedCount += 1;

        if (wasTargeted) {
          const missingArtifacts = [];
          if (!hasDetailSource) missingArtifacts.push('detail source');
          if (!hasAttachmentsMetadata) missingArtifacts.push('attachments metadata');
          if (!hasExternalLinksMetadata) missingArtifacts.push('external links metadata');
          if (!hasPerimeterPayload) missingArtifacts.push('perimeter payload');
          if (hasAttachmentsMetadata && !hasLocalMedia) missingArtifacts.push('local media bytes');

          if (!captureError && missingArtifacts.length) {
            captureError = `Missing local artifacts: ${missingArtifacts.join(', ')}`;
          }
          if (!captureError && !hasResponseHistory && detail?.response?.sourceKind === 'detail-api-incidentOverview') {
            captureError = 'Detail overview captured but response history could not be extracted';
          }
          if (!captureError && !hasDetailSource) {
            captureError = rawSources?.detailApi?.error || rawSources?.responsePage?.error || 'Detail source unavailable';
          }
          if (!captureError && !detail && detailFailure) {
            captureError = detailFailure;
          }

          db.run(
            `
            INSERT INTO incident_capture_status (
              fire_year, incident_number, has_list_row, has_detail_source, has_attachments_metadata, has_local_media,
              has_external_links_metadata, has_perimeter_payload, has_response_history, last_capture_at, last_capture_error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(fire_year, incident_number) DO UPDATE SET
              has_list_row = excluded.has_list_row,
              has_detail_source = excluded.has_detail_source,
              has_attachments_metadata = excluded.has_attachments_metadata,
              has_local_media = excluded.has_local_media,
              has_external_links_metadata = excluded.has_external_links_metadata,
              has_perimeter_payload = excluded.has_perimeter_payload,
              has_response_history = excluded.has_response_history,
              last_capture_at = excluded.last_capture_at,
              last_capture_error = excluded.last_capture_error
            `,
            [
              String(incident.fireYear),
              String(incident.incidentNumber),
              1,
              hasDetailSource ? 1 : 0,
              hasAttachmentsMetadata ? 1 : 0,
              hasLocalMedia ? 1 : 0,
              hasExternalLinksMetadata ? 1 : 0,
              hasPerimeterPayload ? 1 : 0,
              hasResponseHistory ? 1 : 0,
              captureTime,
              captureError || null,
            ]
          );
        }
      }

      const archivalFireYear = Number(listMetadata.fireYear || 0);
      const endpointTotalRowCount = Number(listMetadata.totalRowCount || listRows.length || 0);
      const endpointRowsFetched = Number(listMetadata.endpointRowsFetched || listRows.length || 0);
      const endpointPageCount = Number(listMetadata.pageCountFetched || 0);
      const persistedIncidentCount = Number(listRows.length || 0);
      const endpointScopeLimited = Boolean(listMetadata.queryScope?.stageCodes?.length);
      const completenessStatus = deriveArchivalCompletenessStatus({
        endpointTotalRowCount,
        endpointRowsFetched,
        persistedIncidentCount,
        endpointScopeLimited,
      });
      const completenessWarning = buildArchivalCompletenessWarning({
        endpointTotalRowCount,
        endpointRowsFetched,
        persistedIncidentCount,
        endpointScopeLimited,
      });

      db.run(
        `
        INSERT INTO capture_runs (
          captured_at, trigger, listed_incident_count, targeted_incident_count, detail_capture_success_count,
          detail_capture_failure_count, attachments_capture_count, media_download_attempted_count, media_stored_count,
          media_failure_count, external_links_capture_count, perimeter_capture_count, response_history_extracted_count,
          archival_fire_year, endpoint_total_row_count, endpoint_rows_fetched, endpoint_page_count, persisted_incident_count,
          endpoint_scope_limited, completeness_status, completeness_warning, query_scope_json, artifact_failure_counts_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          captureTime,
          trigger || 'manual',
          listRows.length,
          detailRecords.length + (detailFailures?.length || 0),
          detailCaptureSuccessCount,
          detailCaptureFailureCount,
          attachmentsCaptureCount,
          mediaDownloadAttemptedCount,
          mediaStoredCount,
          mediaFailureCount,
          externalLinksCaptureCount,
          perimeterCaptureCount,
          responseHistoryExtractedCount,
          archivalFireYear,
          endpointTotalRowCount,
          endpointRowsFetched,
          endpointPageCount,
          persistedIncidentCount,
          endpointScopeLimited ? 1 : 0,
          completenessStatus,
          completenessWarning || null,
          JSON.stringify(listMetadata.queryScope || {}),
          JSON.stringify(failureCategoryCounts),
        ]
      );

      setValue(db, 'app_state', 'capture_state', 'healthy');
      setValue(db, 'app_state', 'last_capture_at', captureTime);
      setValue(db, 'app_state', 'last_successful_capture_at', captureTime);
      setValue(db, 'app_state', 'last_capture_error', '');
      db.run('COMMIT');
      flushDb();
      const runtime = finalizeCaptureRun(
        {
          state: 'success',
          trigger: captureRuntime.activeRun?.trigger || trigger || 'manual',
          finishedAt: captureTime,
          currentStageKey: '',
          currentStageLabel: '',
          currentArtifactLabel: '',
          currentActivity: 'Capture completed successfully',
          listedIncidentCount: listRows.length,
          targetedIncidentCount: detailRecords.length + (detailFailures?.length || 0),
          completedIncidentCount: detailCaptureSuccessCount,
          failedIncidentCount: detailCaptureFailureCount,
          detailCaptureSuccessCount,
          detailCaptureFailureCount,
          attachmentsCaptureCount,
          mediaDownloadAttemptedCount,
          mediaStoredCount,
          mediaFailureCount,
          externalLinksCaptureCount,
          perimeterCaptureCount,
          responseHistoryExtractedCount,
          archivalFireYear,
          endpointTotalRowCount,
          endpointRowsFetched,
          endpointPageCount,
          persistedIncidentCount,
          endpointScopeLimited,
          completenessStatus,
          completenessWarning,
          queryScope: listMetadata.queryScope || {},
          failureCategoryCounts,
        },
        { forcePersist: true }
      );
      return {
        ok: true,
        status: getStatus(),
        capturedListCount: listRows.length,
        capturedDetailCount: detailRecords.length,
        insertedSnapshots,
        insertedUpdates,
        insertedRaw,
        runSummary: {
          listedIncidentCount: listRows.length,
          targetedIncidentCount: detailRecords.length + (detailFailures?.length || 0),
          detailCaptureSuccessCount,
          detailCaptureFailureCount,
          attachmentsCaptureCount,
          mediaDownloadAttemptedCount,
          mediaStoredCount,
          mediaFailureCount,
          externalLinksCaptureCount,
          perimeterCaptureCount,
          responseHistoryExtractedCount,
          archivalFireYear,
          endpointTotalRowCount,
          endpointRowsFetched,
          endpointPageCount,
          persistedIncidentCount,
          endpointScopeLimited,
          completenessStatus,
          completenessWarning,
          queryScope: listMetadata.queryScope || {},
          failureCategoryCounts,
        },
        runtime,
      };
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  };

  const saveIncidentCapture = async ({
    listRows = [],
    detailRecords = [],
    detailFailures = [],
    capturedAt,
    trigger,
    listMetadata = {},
  } = {}) => {
    if (!db) return { ok: false, error: 'No active DB selected.', status: getStatus() };
    try {
      return await writeCaptureRecords({ listRows, detailRecords, detailFailures, capturedAt, trigger, listMetadata });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Capture write failed.';
      setValue(db, 'app_state', 'capture_state', 'error');
      setValue(db, 'app_state', 'last_capture_error', message);
      flushDb();
      return { ok: false, error: message, status: getStatus() };
    }
  };

  const recoverResponseHistoryFromArchivedRaw = () => {
    if (!db) return { ok: false, error: 'No active DB selected.', status: getStatus() };
    const rawRows = db.exec(
      `
      SELECT id, fire_year, incident_number, captured_at, source_kind, payload_text
      FROM raw_source_records
      WHERE source_kind IN ('incident_detail_api_json', 'incident_detail_html')
      ORDER BY captured_at ASC, id ASC
      `
    );
    const records = rawRows.length ? rawRows[0].values : [];
    let scannedRecords = 0;
    let parsedRecords = 0;
    let insertedUpdates = 0;
    let g70422Reason = '';
    let g70422ParsedBlocks = 0;
    let g70422Inserted = 0;

    db.run('BEGIN TRANSACTION');
    try {
      for (const row of records) {
        scannedRecords += 1;
        const fireYear = String(row[1]);
        const incidentNumber = String(row[2]);
        const capturedAt = String(row[3] || nowIso());
        const sourceKind = String(row[4] || '');
        const sourcePayload = String(row[5] || '');
        const recovered =
          sourceKind === 'incident_detail_api_json'
            ? extractUpdatesFromDetailApiPayload(sourcePayload)
            : extractUpdatesFromArchivedHtml(sourcePayload);
        if (incidentNumber.toUpperCase() === 'G70422') {
          g70422Reason = `${sourceKind}:${recovered.reason}`;
        }
        if (!recovered.updates.length) continue;
        parsedRecords += 1;
        if (incidentNumber.toUpperCase() === 'G70422') {
          g70422ParsedBlocks += recovered.updates.length;
        }
        recovered.updates.forEach((item, updateIndex) => {
          const text = normalizeUpdateText(item.text);
          if (!text) return;
          const updateHash = hashPayload(text);
          if (hasUpdateHashForIncident(fireYear, incidentNumber, updateHash)) return;
          db.run(
            `
            INSERT INTO incident_updates (
              fire_year, incident_number, captured_at, update_index, update_hash, update_text, update_published_at, source_kind
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              fireYear,
              incidentNumber,
              capturedAt,
              Number(updateIndex),
              updateHash,
              text,
              item.publishedAt || null,
              sourceKind === 'incident_detail_api_json' ? 'recovery-detail-api-overview' : 'recovery-archived-html',
            ]
          );
          insertedUpdates += 1;
          if (incidentNumber.toUpperCase() === 'G70422') {
            g70422Inserted += 1;
          }
        });
      }

      db.run('COMMIT');
      flushDb();
      return {
        ok: true,
        status: getStatus(),
        scannedRecords,
        parsedRecords,
        insertedUpdates,
        g70422: {
          parsedBlocks: g70422ParsedBlocks,
          inserted: g70422Inserted,
          reason: g70422Reason || 'no_g70422_raw_record',
        },
      };
    } catch (error) {
      db.run('ROLLBACK');
      const message = error instanceof Error ? error.message : 'Recovery failed';
      return { ok: false, error: message, status: getStatus() };
    }
  };

  const getIncidentListLocal = () => {
    if (!db) return { ok: false, error: 'No active DB selected.', rows: [], hasLocalData: false };
    const rows = db.exec(
      `
      SELECT
        i.fire_year,
        i.incident_number,
        i.row_json,
        i.detail_json,
        s.has_detail_source,
        s.has_attachments_metadata,
        s.has_local_media,
        s.has_external_links_metadata,
        s.has_perimeter_payload,
        s.has_response_history
      FROM incidents AS i
      LEFT JOIN incident_capture_status AS s
        ON s.fire_year = i.fire_year
       AND s.incident_number = i.incident_number
      ORDER BY COALESCE(i.updated_date, i.discovery_date, i.last_captured_at) DESC
      `
    );
    const collection = rows.length
      ? rows[0].values
          .map((valueRow) => {
            const parsedRow = safeJsonParse(String(valueRow[2] || ''), null);
            if (!parsedRow) return null;
            const parsedDetail = safeJsonParse(String(valueRow[3] || ''), null);
            const captureStatus = {
              hasDetailSource: Boolean(valueRow[4]),
              hasAttachmentsMetadata: Boolean(valueRow[5]),
              hasLocalMedia: Boolean(valueRow[6]),
              hasExternalLinksMetadata: Boolean(valueRow[7]),
              hasPerimeterPayload: Boolean(valueRow[8]),
              hasResponseHistory: Boolean(valueRow[9]),
            };
            return {
              ...parsedRow,
              affordances: buildIncidentListAffordances(
                String(valueRow[0] || parsedRow.fireYear || ''),
                String(valueRow[1] || parsedRow.incidentNumber || ''),
                parsedDetail,
                captureStatus
              ),
            };
          })
          .filter(Boolean)
      : [];
    return {
      ok: true,
      rows: collection,
      totalRowCount: collection.length,
      hasLocalData: collection.length > 0,
    };
  };

  const getPinnedIncidents = () => {
    if (!db) return { ok: false, error: 'No active DB selected.', rows: [] };
    const rows = db.exec(
      `
      SELECT
        p.fire_year,
        p.incident_number,
        COALESCE(i.incident_name, p.incident_name),
        COALESCE(i.stage, p.stage),
        COALESCE(i.fire_centre, p.fire_centre),
        COALESCE(i.size_ha, p.size_ha),
        COALESCE(i.updated_date, p.updated_date),
        p.pinned_at
      FROM incident_pins AS p
      LEFT JOIN incidents AS i
        ON i.fire_year = p.fire_year
       AND i.incident_number = p.incident_number
      ORDER BY p.pinned_at DESC, p.fire_year DESC, p.incident_number ASC
      `
    );
    const collection = rows.length
      ? rows[0].values.map((valueRow) => ({
          fireYear: String(valueRow[0] || ''),
          incidentNumber: String(valueRow[1] || ''),
          incidentName: String(valueRow[2] || valueRow[1] || ''),
          stage: String(valueRow[3] || ''),
          fireCentre: String(valueRow[4] || ''),
          sizeHa: valueRow[5] === null || valueRow[5] === undefined ? null : Number(valueRow[5]),
          updatedDate: valueRow[6] ? String(valueRow[6]) : '',
          pinnedAt: valueRow[7] ? String(valueRow[7]) : '',
        }))
      : [];
    return { ok: true, rows: collection };
  };

  const setIncidentPinned = (payload) => {
    if (!db) return { ok: false, error: 'No active DB selected.', rows: [] };
    const fireYear = String(payload?.fireYear || '');
    const incidentNumber = String(payload?.incidentNumber || '');
    if (!fireYear || !incidentNumber) {
      return { ok: false, error: 'fireYear and incidentNumber are required.', rows: [] };
    }
    db.run(
      `
      INSERT INTO incident_pins (
        fire_year, incident_number, incident_name, stage, fire_centre, size_ha, updated_date, pinned_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(fire_year, incident_number) DO UPDATE SET
        incident_name = excluded.incident_name,
        stage = excluded.stage,
        fire_centre = excluded.fire_centre,
        size_ha = excluded.size_ha,
        updated_date = excluded.updated_date,
        pinned_at = excluded.pinned_at
      `,
      [
        fireYear,
        incidentNumber,
        payload?.incidentName ? String(payload.incidentName) : null,
        payload?.stage ? String(payload.stage) : null,
        payload?.fireCentre ? String(payload.fireCentre) : null,
        payload?.sizeHa === null || payload?.sizeHa === undefined || Number.isNaN(Number(payload.sizeHa))
          ? null
          : Number(payload.sizeHa),
        payload?.updatedDate ? String(payload.updatedDate) : null,
        payload?.pinnedAt ? String(payload.pinnedAt) : nowIso(),
      ]
    );
    flushDb();
    return getPinnedIncidents();
  };

  const removeIncidentPinned = (fireYear, incidentNumber) => {
    if (!db) return { ok: false, error: 'No active DB selected.', rows: [] };
    db.run('DELETE FROM incident_pins WHERE fire_year = ? AND incident_number = ?', [
      String(fireYear),
      String(incidentNumber),
    ]);
    flushDb();
    return getPinnedIncidents();
  };

  const getIncidentDetailLocal = (fireYear, incidentNumber) => {
    if (!db) return { ok: false, error: 'No active DB selected.', found: false };
    let query = db.exec(
      'SELECT detail_json FROM incidents WHERE fire_year = ? AND incident_number = ? LIMIT 1',
      [String(fireYear), String(incidentNumber)]
    );
    if (!query.length || !query[0].values.length || !query[0].values[0][0]) {
      query = db.exec(
        'SELECT detail_json FROM incidents WHERE incident_number = ? AND detail_json IS NOT NULL ORDER BY last_captured_at DESC LIMIT 1',
        [String(incidentNumber)]
      );
    }
    if (!query.length || !query[0].values.length || !query[0].values[0][0]) {
      return { ok: true, found: false };
    }
    const parsed = safeJsonParse(String(query[0].values[0][0]), null);
    if (!parsed) return { ok: true, found: false };
    const effectiveFireYear = parsed?.incident?.fireYear ? String(parsed.incident.fireYear) : String(fireYear);
    const updatesQuery = db.exec(
      `
      SELECT update_text
      FROM incident_updates
      WHERE fire_year = ? AND incident_number = ?
      ORDER BY COALESCE(update_published_at, captured_at) ASC, update_index ASC, id ASC
      `,
      [effectiveFireYear, String(incidentNumber)]
    );
    const storedUpdates = updatesQuery.length
      ? updatesQuery[0].values.map((row) => String(row[0] || '')).filter(Boolean)
      : [];
    const statusQuery = db.exec(
      `
      SELECT
        has_list_row,
        has_detail_source,
        has_attachments_metadata,
        has_local_media,
        has_external_links_metadata,
        has_perimeter_payload,
        has_response_history,
        last_capture_at,
        last_capture_error
      FROM incident_capture_status
      WHERE fire_year = ? AND incident_number = ?
      LIMIT 1
      `,
      [effectiveFireYear, String(incidentNumber)]
    );
    const captureStatus = statusQuery.length && statusQuery[0].values.length
      ? {
          hasListRow: Boolean(statusQuery[0].values[0][0]),
          hasDetailSource: Boolean(statusQuery[0].values[0][1]),
          hasAttachmentsMetadata: Boolean(statusQuery[0].values[0][2]),
          hasLocalMedia: Boolean(statusQuery[0].values[0][3]),
          hasExternalLinksMetadata: Boolean(statusQuery[0].values[0][4]),
          hasPerimeterPayload: Boolean(statusQuery[0].values[0][5]),
          hasResponseHistory: Boolean(statusQuery[0].values[0][6]),
          lastCaptureAt: statusQuery[0].values[0][7] ? String(statusQuery[0].values[0][7]) : null,
          lastCaptureError: statusQuery[0].values[0][8] ? String(statusQuery[0].values[0][8]) : null,
        }
      : null;

    const hasCompleteLocalDetail =
      Boolean(captureStatus?.hasDetailSource) &&
      Boolean(captureStatus?.hasAttachmentsMetadata) &&
      Boolean(captureStatus?.hasExternalLinksMetadata) &&
      Boolean(captureStatus?.hasPerimeterPayload);

    const missingArtifacts = captureStatus
      ? [
          captureStatus.hasDetailSource ? null : 'detail source',
          captureStatus.hasAttachmentsMetadata ? null : 'attachments metadata',
          captureStatus.hasLocalAssets || !captureStatus.hasAttachmentsMetadata ? null : 'archived attachment bytes',
          captureStatus.hasLocalMedia || !captureStatus.hasAttachmentsMetadata ? null : 'local media bytes',
          captureStatus.hasExternalLinksMetadata ? null : 'external links metadata',
          captureStatus.hasPerimeterPayload ? null : 'perimeter payload',
        ].filter(Boolean)
      : [];

    const mediaQuery = db.exec(
      `
      SELECT attachment_guid, asset_kind,
        CASE
          WHEN variant_role IS NULL OR TRIM(variant_role) = '' THEN CASE WHEN is_thumbnail = 1 THEN 'thumbnail' ELSE 'original' END
          WHEN variant_role = 'original' AND is_thumbnail = 1 THEN 'thumbnail'
          ELSE variant_role
        END AS normalized_variant_role,
        file_name, mime_type, byte_length, is_thumbnail, source_url, blob_bytes
      FROM incident_media
      WHERE fire_year = ? AND incident_number = ?
      ORDER BY is_thumbnail ASC, fetched_at DESC, id DESC
      `,
      [effectiveFireYear, String(incidentNumber)]
    );
    const mediaRows = mediaQuery.length ? mediaQuery[0].values : [];
    const attachmentAssetMap = new Map();
    mediaRows.forEach((row) => {
      const attachmentGuid = String(row[0] || '');
      if (!attachmentGuid) return;
      const variantRole = String(row[2] || (Boolean(row[6]) ? 'thumbnail' : 'original'));
      const blobValue = row[8];
      const bytes = blobValue instanceof Uint8Array ? blobValue : new Uint8Array(blobValue || []);
      if (!bytes.byteLength) return;
      const existing = attachmentAssetMap.get(attachmentGuid) || {};
      existing[variantRole] = {
        assetKind: String(row[1] || 'download'),
        variantRole,
        fileName: row[3] ? String(row[3]) : '',
        mimeType: String(row[4] || 'application/octet-stream'),
        byteLength: Number(row[5] || bytes.byteLength || 0),
        isThumbnail: Boolean(row[6]),
        sourceUrl: row[7] ? String(row[7]) : '',
        base64: Buffer.from(bytes).toString('base64'),
      };
      attachmentAssetMap.set(attachmentGuid, existing);
    });

    parsed.response = parsed.response || {};
    parsed.response.responseUpdates = storedUpdates;
    parsed.attachments = Array.isArray(parsed.attachments)
      ? parsed.attachments.map((asset) => ({
          ...asset,
          localOriginalAsset: attachmentAssetMap.get(String(asset?.attachmentGuid || ''))?.original || null,
          localThumbnailAsset: attachmentAssetMap.get(String(asset?.attachmentGuid || ''))?.thumbnail || null,
          localMedia: attachmentAssetMap.get(String(asset?.attachmentGuid || ''))?.original || null,
        }))
      : [];
    const actualHasLocalAssets = hasCompleteLocalAssetsForAttachments(
      effectiveFireYear,
      String(incidentNumber),
      parsed.attachments
    );
    const actualHasLocalMedia = hasCompleteLocalMediaForAttachments(
      effectiveFireYear,
      String(incidentNumber),
      parsed.attachments
    );
    if (captureStatus) {
      captureStatus.hasLocalAssets = actualHasLocalAssets;
      captureStatus.hasLocalMedia = actualHasLocalMedia;
    }
    return {
      ok: true,
      found: true,
      hasCompleteLocalDetail,
      captureStatus,
      missingArtifacts,
      data: parsed,
    };
  };

  const getCaptureMetrics = () => {
    if (!db) {
      return {
        incidents: 0,
        snapshots: 0,
        updates: 0,
        rawSourceRecords: 0,
      };
    }
    const count = (table) => {
      const result = db.exec(`SELECT COUNT(*) FROM ${table}`);
      return result.length && result[0].values.length ? Number(result[0].values[0][0]) : 0;
    };
    return {
      incidents: count('incidents'),
      snapshots: count('incident_snapshots'),
      updates: count('incident_updates'),
      rawSourceRecords: count('raw_source_records'),
      incidentMedia: count('incident_media'),
    };
  };

  const getIncidentAttachmentAsset = (fireYear, incidentNumber, attachmentGuid, variantRole = 'original') => {
    if (!db) return { ok: false, error: 'No active DB selected.', found: false };
    const query = db.exec(
      `
      SELECT asset_kind,
        CASE
          WHEN variant_role IS NULL OR TRIM(variant_role) = '' THEN CASE WHEN is_thumbnail = 1 THEN 'thumbnail' ELSE 'original' END
          WHEN variant_role = 'original' AND is_thumbnail = 1 THEN 'thumbnail'
          ELSE variant_role
        END AS normalized_variant_role,
        source_url, file_name, mime_type, byte_length, is_thumbnail, blob_bytes
      FROM incident_media
      WHERE fire_year = ? AND incident_number = ? AND attachment_guid = ?
        AND (
          CASE
            WHEN variant_role IS NULL OR TRIM(variant_role) = '' THEN CASE WHEN is_thumbnail = 1 THEN 'thumbnail' ELSE 'original' END
            WHEN variant_role = 'original' AND is_thumbnail = 1 THEN 'thumbnail'
            ELSE variant_role
          END
        ) = ?
      ORDER BY fetched_at DESC, id DESC
      LIMIT 1
      `,
      [String(fireYear), String(incidentNumber), String(attachmentGuid), String(variantRole || 'original')]
    );
    if (!query.length || !query[0].values.length) {
      return { ok: true, found: false };
    }
    const row = query[0].values[0];
    const blobValue = row[7];
    const bytes = blobValue instanceof Uint8Array ? blobValue : new Uint8Array(blobValue || []);
    if (!bytes.byteLength) {
      return { ok: true, found: false };
    }
    return {
      ok: true,
      found: true,
      asset: {
        assetKind: String(row[0] || 'download'),
        variantRole: String(row[1] || variantRole || 'original'),
        sourceUrl: row[2] ? String(row[2]) : '',
        fileName: row[3] ? String(row[3]) : '',
        mimeType: String(row[4] || 'application/octet-stream'),
        byteLength: Number(row[5] || bytes.byteLength || 0),
        isThumbnail: Boolean(row[6]),
        base64: Buffer.from(bytes).toString('base64'),
      },
    };
  };

  const getIncidentCaptureTargets = () => {
    if (!db) {
      return { ok: false, error: 'No active DB selected.', completeKeys: [], incompleteKeys: [], recordedCount: 0 };
    }
    const countQuery = db.exec('SELECT COUNT(*) FROM incident_capture_status');
    const recordedCount = countQuery.length && countQuery[0].values.length ? Number(countQuery[0].values[0][0] || 0) : 0;
    const rows = db.exec(
      `
      SELECT
        s.fire_year,
        s.incident_number,
        s.has_detail_source,
        s.has_attachments_metadata,
        s.has_external_links_metadata,
        s.has_perimeter_payload,
        i.detail_json
      FROM incident_capture_status
      AS s
      LEFT JOIN incidents AS i
        ON i.fire_year = s.fire_year
       AND i.incident_number = s.incident_number
      `
    );
    const statusRows = rows.length ? rows[0].values : [];
    const incompleteKeys = statusRows
      .filter((row) => {
        const fireYear = String(row[0] || '');
        const incidentNumber = String(row[1] || '');
        const hasDetailSource = Boolean(row[2]);
        const hasAttachmentsMetadata = Boolean(row[3]);
        const hasExternalLinksMetadata = Boolean(row[4]);
        const hasPerimeterPayload = Boolean(row[5]);
        const parsedDetail = safeJsonParse(String(row[6] || ''), null);
        const actualHasLocalAssets = hasAttachmentsMetadata
          ? hasCompleteLocalAssetsForAttachments(fireYear, incidentNumber, parsedDetail?.attachments || [])
          : false;
        const actualHasLocalMedia = hasAttachmentsMetadata
          ? hasCompleteLocalMediaForAttachments(fireYear, incidentNumber, parsedDetail?.attachments || [])
          : false;
        return (
          !hasDetailSource ||
          !hasAttachmentsMetadata ||
          !actualHasLocalAssets ||
          !actualHasLocalMedia ||
          !hasExternalLinksMetadata ||
          !hasPerimeterPayload
        );
      })
      .map((row) => incidentKey(row[0], row[1]));
    return {
      ok: true,
      recordedCount,
      incompleteKeys,
      incompleteKeySet: Object.fromEntries(incompleteKeys.map((key) => [key, true])),
    };
  };

  const getCaptureCompletenessSummary = () => {
    if (!db) {
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
        imageAssetCount: 0,
        documentAssetCount: 0,
        videoAssetCount: 0,
        otherAssetCount: 0,
        imageAssetBytes: 0,
        documentAssetBytes: 0,
        videoAssetBytes: 0,
        otherAssetBytes: 0,
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
    const aggregate = db.exec(
      `
      SELECT
        COUNT(*) AS listed_incident_count,
        SUM(CASE WHEN has_detail_source = 1 THEN 1 ELSE 0 END) AS detail_archived_count,
        SUM(CASE WHEN has_detail_source = 0 THEN 1 ELSE 0 END) AS detail_failure_count,
        SUM(CASE WHEN has_attachments_metadata = 1 THEN 1 ELSE 0 END) AS attachments_metadata_count,
        SUM(CASE WHEN has_external_links_metadata = 1 THEN 1 ELSE 0 END) AS external_links_metadata_count,
        SUM(CASE WHEN has_perimeter_payload = 1 THEN 1 ELSE 0 END) AS perimeter_payload_count,
        SUM(CASE WHEN has_response_history = 1 THEN 1 ELSE 0 END) AS response_history_count
      FROM incident_capture_status
      `
    );
    const mediaAggregate = db.exec(
      `
      SELECT
        COUNT(*) AS media_record_count,
        COUNT(DISTINCT fire_year || ':' || incident_number) AS incident_media_count,
        COUNT(DISTINCT CASE WHEN is_thumbnail = 1 THEN attachment_guid END) AS thumbnail_record_count,
        COUNT(DISTINCT CASE WHEN is_thumbnail = 0 THEN attachment_guid END) AS full_image_record_count,
        COUNT(DISTINCT CASE WHEN is_thumbnail = 0 AND asset_kind = 'image' THEN attachment_guid END) AS image_asset_count,
        COUNT(DISTINCT CASE WHEN is_thumbnail = 0 AND asset_kind = 'document' THEN attachment_guid END) AS document_asset_count,
        COUNT(DISTINCT CASE WHEN is_thumbnail = 0 AND asset_kind = 'video' THEN attachment_guid END) AS video_asset_count,
        COUNT(DISTINCT CASE WHEN is_thumbnail = 0 AND asset_kind NOT IN ('image', 'document', 'video') THEN attachment_guid END) AS other_asset_count,
        COALESCE(SUM(CASE WHEN is_thumbnail = 0 AND asset_kind = 'image' THEN byte_length ELSE 0 END), 0) AS image_asset_bytes,
        COALESCE(SUM(CASE WHEN is_thumbnail = 0 AND asset_kind = 'document' THEN byte_length ELSE 0 END), 0) AS document_asset_bytes,
        COALESCE(SUM(CASE WHEN is_thumbnail = 0 AND asset_kind = 'video' THEN byte_length ELSE 0 END), 0) AS video_asset_bytes,
        COALESCE(SUM(CASE WHEN is_thumbnail = 0 AND asset_kind NOT IN ('image', 'document', 'video') THEN byte_length ELSE 0 END), 0) AS other_asset_bytes,
        COALESCE(SUM(byte_length), 0) AS total_media_bytes
      FROM incident_media
      `
    );
    const mediaSummaryRow = mediaAggregate.length && mediaAggregate[0].values.length ? mediaAggregate[0].values[0] : null;
    const summaryRow = aggregate.length && aggregate[0].values.length ? aggregate[0].values[0] : null;
    const lastRunQuery = db.exec(
      `
      SELECT
        captured_at,
        trigger,
        listed_incident_count,
        targeted_incident_count,
        detail_capture_success_count,
        detail_capture_failure_count,
        attachments_capture_count,
        media_download_attempted_count,
        media_stored_count,
        media_failure_count,
        external_links_capture_count,
        perimeter_capture_count,
        response_history_extracted_count,
        archival_fire_year,
        endpoint_total_row_count,
        endpoint_rows_fetched,
        endpoint_page_count,
        persisted_incident_count,
        endpoint_scope_limited,
        completeness_status,
        completeness_warning,
        query_scope_json,
        artifact_failure_counts_json
      FROM capture_runs
      ORDER BY id DESC
      LIMIT 1
      `
    );
    const runRow = lastRunQuery.length && lastRunQuery[0].values.length ? lastRunQuery[0].values[0] : null;
    return {
      listedIncidentCount: summaryRow ? Number(summaryRow[0] || 0) : 0,
      detailArchivedCount: summaryRow ? Number(summaryRow[1] || 0) : 0,
      detailFailureCount: summaryRow ? Number(summaryRow[2] || 0) : 0,
      attachmentsMetadataCount: summaryRow ? Number(summaryRow[3] || 0) : 0,
      localMediaIncidentCount: mediaSummaryRow ? Number(mediaSummaryRow[1] || 0) : 0,
      externalLinksMetadataCount: summaryRow ? Number(summaryRow[4] || 0) : 0,
      perimeterPayloadCount: summaryRow ? Number(summaryRow[5] || 0) : 0,
      responseHistoryCount: summaryRow ? Number(summaryRow[6] || 0) : 0,
      mediaRecordCount: mediaSummaryRow ? Number(mediaSummaryRow[0] || 0) : 0,
      thumbnailStoredCount: mediaSummaryRow ? Number(mediaSummaryRow[2] || 0) : 0,
      fullImageStoredCount: mediaSummaryRow ? Number(mediaSummaryRow[3] || 0) : 0,
      imageAssetCount: mediaSummaryRow ? Number(mediaSummaryRow[4] || 0) : 0,
      documentAssetCount: mediaSummaryRow ? Number(mediaSummaryRow[5] || 0) : 0,
      videoAssetCount: mediaSummaryRow ? Number(mediaSummaryRow[6] || 0) : 0,
      otherAssetCount: mediaSummaryRow ? Number(mediaSummaryRow[7] || 0) : 0,
      imageAssetBytes: mediaSummaryRow ? Number(mediaSummaryRow[8] || 0) : 0,
      documentAssetBytes: mediaSummaryRow ? Number(mediaSummaryRow[9] || 0) : 0,
      videoAssetBytes: mediaSummaryRow ? Number(mediaSummaryRow[10] || 0) : 0,
      otherAssetBytes: mediaSummaryRow ? Number(mediaSummaryRow[11] || 0) : 0,
      totalMediaBytes: mediaSummaryRow ? Number(mediaSummaryRow[12] || 0) : 0,
      archivalFireYear: runRow ? Number(runRow[13] || 0) : 0,
      endpointTotalRowCount: runRow ? Number(runRow[14] || 0) : 0,
      endpointRowsFetched: runRow ? Number(runRow[15] || 0) : 0,
      endpointPageCount: runRow ? Number(runRow[16] || 0) : 0,
      persistedIncidentCount: runRow ? Number(runRow[17] || 0) : 0,
      completenessStatus: runRow ? String(runRow[19] || 'partial') : 'partial',
      completenessWarning: runRow && runRow[20] ? String(runRow[20]) : '',
      queryScope: runRow ? safeJsonParse(String(runRow[21] || '{}'), {}) : {},
      lastRun: runRow
        ? {
            capturedAt: String(runRow[0] || ''),
            trigger: String(runRow[1] || ''),
            listedIncidentCount: Number(runRow[2] || 0),
            targetedIncidentCount: Number(runRow[3] || 0),
            detailCaptureSuccessCount: Number(runRow[4] || 0),
            detailCaptureFailureCount: Number(runRow[5] || 0),
            attachmentsCaptureCount: Number(runRow[6] || 0),
            mediaDownloadAttemptedCount: Number(runRow[7] || 0),
            mediaStoredCount: Number(runRow[8] || 0),
            mediaFailureCount: Number(runRow[9] || 0),
            externalLinksCaptureCount: Number(runRow[10] || 0),
            perimeterCaptureCount: Number(runRow[11] || 0),
            responseHistoryExtractedCount: Number(runRow[12] || 0),
            archivalFireYear: Number(runRow[13] || 0),
            endpointTotalRowCount: Number(runRow[14] || 0),
            endpointRowsFetched: Number(runRow[15] || 0),
            endpointPageCount: Number(runRow[16] || 0),
            persistedIncidentCount: Number(runRow[17] || 0),
            endpointScopeLimited: Boolean(runRow[18]),
            completenessStatus: String(runRow[19] || 'partial'),
            completenessWarning: runRow[20] ? String(runRow[20]) : '',
            queryScope: safeJsonParse(String(runRow[21] || '{}'), {}),
            failureCategoryCounts: safeJsonParse(String(runRow[22] || '{}'), {}),
          }
        : null,
      failureCategoryCounts: runRow ? safeJsonParse(String(runRow[22] || '{}'), {}) : {},
    };
  };

  const autoLoadLastUsed = async () => {
    const config = readRuntimeConfig();
    const dbPath = config.lastUsedDbPath;
    if (!dbPath) return getStatus();
    if (!fs.existsSync(dbPath)) {
      setLastUsedPath(null);
      return getStatus();
    }
    try {
      return await openDbAtPath(dbPath);
    } catch {
      closeActive();
      setLastUsedPath(null);
      return getStatus();
    }
  };

  const onCaptureProgress = (listener) => {
    captureProgressListeners.add(listener);
    return () => captureProgressListeners.delete(listener);
  };

  return {
    autoLoadLastUsed,
    onCaptureProgress,
    getStatus,
    getCaptureRuntimeState,
    createDbAtPath,
    selectDbAtPath,
    createNewDb,
    chooseExistingDb,
    deleteActiveDb,
    markCaptureRunning,
    markCaptureProgress,
    markCaptureError,
    setAutoCheckMinutes,
    saveIncidentCapture,
    recoverResponseHistoryFromArchivedRaw,
    getIncidentListLocal,
    getIncidentDetailLocal,
    getIncidentAttachmentAsset,
    getPinnedIncidents,
    setIncidentPinned,
    removeIncidentPinned,
    getIncidentCaptureTargets,
    getCaptureMetrics,
    getCaptureCompletenessSummary,
    closeActive,
  };
}

