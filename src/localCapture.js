const DB_NAME = 'open-fireside-local-capture';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('incidents')) {
        const incidents = db.createObjectStore('incidents', { keyPath: 'id' });
        incidents.createIndex('by_incident_number', ['fireYear', 'incidentNumber'], { unique: true });
        incidents.createIndex('by_updated_at', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('incident_snapshots')) {
        const snapshots = db.createObjectStore('incident_snapshots', { keyPath: 'id' });
        snapshots.createIndex('by_incident_observed', ['incidentId', 'observedAt'], { unique: false });
      }
      if (!db.objectStoreNames.contains('incident_updates')) {
        const updates = db.createObjectStore('incident_updates', { keyPath: 'id' });
        updates.createIndex('by_incident_observed', ['incidentId', 'observedAt'], { unique: false });
        updates.createIndex('by_incident_hash', ['incidentId', 'updateHash'], { unique: true });
      }
      if (!db.objectStoreNames.contains('raw_source_records')) {
        const raw = db.createObjectStore('raw_source_records', { keyPath: 'id' });
        raw.createIndex('by_source_kind', 'sourceKind', { unique: false });
        raw.createIndex('by_fetched_at', 'fetchedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function makeIncidentId(fireYear, incidentNumber) {
  return `${String(fireYear || '')}:${String(incidentNumber || '').trim().toUpperCase()}`;
}

async function sha256(value) {
  const encoded = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function putRawSourceRecord({ sourceKind, fetchUrl, bodyText, parseStatus = 'ok', errorMessage = '' }) {
  const db = await openDb();
  const fetchedAt = Date.now();
  const contentHash = await sha256(bodyText);
  const id = `${sourceKind}:${fetchedAt}:${contentHash.slice(0, 16)}`;
  const tx = db.transaction(['raw_source_records'], 'readwrite');
  tx.objectStore('raw_source_records').put({
    id,
    sourceKind,
    fetchUrl,
    fetchedAt,
    contentHash,
    parseStatus,
    errorMessage: errorMessage || '',
    bodyText: String(bodyText || ''),
  });
  await txDone(tx);
  return { id, fetchedAt, contentHash };
}

async function upsertIncidentAndSnapshot(incident, observedAt) {
  const db = await openDb();
  const incidentId = makeIncidentId(incident.fireYear, incident.incidentNumber);
  const now = Date.now();
  const tx = db.transaction(['incidents', 'incident_snapshots'], 'readwrite');
  const incidents = tx.objectStore('incidents');
  const snapshots = tx.objectStore('incident_snapshots');

  incidents.put({
    id: incidentId,
    fireYear: incident.fireYear,
    incidentNumber: incident.incidentNumber,
    incidentName: incident.incidentName || '',
    fireCentre: incident.fireCentre || '',
    incidentGuid: incident.incidentGuid || '',
    publishedIncidentDetailGuid: incident.publishedIncidentDetailGuid || '',
    latitude: Number.isFinite(incident.latitude) ? incident.latitude : null,
    longitude: Number.isFinite(incident.longitude) ? incident.longitude : null,
    updatedAt: now,
  });

  const snapshotPayload = {
    incidentId,
    observedAt,
    stageOfControl: incident.stage || '',
    sizeHa: Number.isFinite(Number(incident.sizeHa)) ? Number(incident.sizeHa) : null,
    discoveryDate: incident.discoveryDate || null,
    causeText: incident.causeDetail || '',
    location: incident.location || '',
    latitude: Number.isFinite(incident.latitude) ? incident.latitude : null,
    longitude: Number.isFinite(incident.longitude) ? incident.longitude : null,
  };
  const snapshotHash = await sha256(JSON.stringify(snapshotPayload));
  const snapshotId = `${incidentId}:${snapshotHash}`;
  snapshots.put({
    id: snapshotId,
    ...snapshotPayload,
    snapshotHash,
  });

  await txDone(tx);
  return { incidentId, snapshotHash };
}

async function addIncidentUpdatesAppendOnly(incidentId, updates, publishedAt = null, observedAt = Date.now()) {
  if (!incidentId || !Array.isArray(updates) || !updates.length) {
    return { inserted: 0 };
  }
  const db = await openDb();
  const tx = db.transaction(['incident_updates'], 'readwrite');
  const store = tx.objectStore('incident_updates');
  let inserted = 0;

  for (const rawUpdate of updates) {
    const updateText = String(rawUpdate || '').trim();
    if (!updateText) continue;
    const updateHash = await sha256(updateText);
    const id = `${incidentId}:${updateHash}`;
    store.put({
      id,
      incidentId,
      observedAt,
      publishedAt: publishedAt || null,
      updateText,
      updateHash,
    });
    inserted += 1;
  }

  await txDone(tx);
  return { inserted };
}

async function listIncidentUpdatesNewestFirst(incidentId) {
  if (!incidentId) return [];
  const db = await openDb();
  const tx = db.transaction(['incident_updates'], 'readonly');
  const index = tx.objectStore('incident_updates').index('by_incident_observed');
  const range = IDBKeyRange.bound([incidentId, 0], [incidentId, Number.MAX_SAFE_INTEGER]);
  const request = index.getAll(range);
  const rows = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  await txDone(tx);
  rows.sort((a, b) => Number(b.observedAt || 0) - Number(a.observedAt || 0));
  return rows;
}

async function getIncidentCaptureMeta(incidentId) {
  const updates = await listIncidentUpdatesNewestFirst(incidentId);
  const latestObservedAt = updates[0]?.observedAt || null;
  return {
    updateCount: updates.length,
    latestUpdateObservedAt: latestObservedAt,
  };
}

export async function captureIncidentListResult({ rows, requestUrl, rawPayload }) {
  const observedAt = Date.now();
  await putRawSourceRecord({
    sourceKind: 'incident_list_json',
    fetchUrl: requestUrl,
    bodyText: JSON.stringify(rawPayload || {}),
    parseStatus: 'ok',
  });

  for (const row of rows || []) {
    await upsertIncidentAndSnapshot(row, observedAt);
  }

  return {
    capturedAt: observedAt,
    incidentCount: (rows || []).length,
  };
}

export async function captureIncidentDetailResult({
  incident,
  response,
  responsePageHtml,
  requestContext,
  attachmentsPayload,
  externalPayload,
  perimeterData,
  tiedEvac,
}) {
  const observedAt = Date.now();
  const parseStatus = response?.responseUpdates?.length ? 'ok' : 'warning_no_response_updates';

  await putRawSourceRecord({
    sourceKind: 'incident_detail_html',
    fetchUrl: requestContext?.detailUrl || '',
    bodyText: responsePageHtml || '',
    parseStatus,
  });

  await putRawSourceRecord({
    sourceKind: 'incident_detail_enrichment_json',
    fetchUrl: requestContext?.enrichmentUrl || '',
    bodyText: JSON.stringify({
      attachmentsPayload: attachmentsPayload || {},
      externalPayload: externalPayload || {},
      perimeterData: perimeterData || null,
      tiedEvac: tiedEvac || null,
    }),
    parseStatus: 'ok',
  });

  const { incidentId } = await upsertIncidentAndSnapshot(incident, observedAt);
  const updateInsert = await addIncidentUpdatesAppendOnly(
    incidentId,
    response?.responseUpdates || [],
    incident?.updatedDate || null,
    observedAt
  );
  const localUpdates = await listIncidentUpdatesNewestFirst(incidentId);
  const meta = await getIncidentCaptureMeta(incidentId);

  return {
    incidentId,
    capturedAt: observedAt,
    updatesInserted: updateInsert.inserted,
    localOfficialUpdates: localUpdates,
    ...meta,
  };
}
