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

function incidentKey(fireYear, incidentNumber) {
  return `${String(fireYear)}:${String(incidentNumber)}`;
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

export function createDbLifecycleManager({ app, dialog, BrowserWindow }) {
  const runtimeConfigPath = path.join(app.getPath('userData'), RUNTIME_CONFIG_FILE);
  let sqlPromise;
  let db = null;
  let activeDbPath = null;

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

    ensureColumn(database, 'incidents', 'detail_json', 'detail_json TEXT');
    ensureColumn(database, 'incidents', 'last_snapshot_hash', 'last_snapshot_hash TEXT');
    ensureColumn(database, 'incident_snapshots', 'snapshot_hash', 'snapshot_hash TEXT');
    ensureColumn(database, 'incident_snapshots', 'snapshot_json', 'snapshot_json TEXT');
    ensureColumn(database, 'incident_updates', 'update_hash', 'update_hash TEXT');
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
        lastCaptureError: null,
        capturedIncidentCount: 0,
      };
    }

    const createdAt = getValue(db, 'workspace_meta', 'created_at');
    const lastOpenedAt = getValue(db, 'app_state', 'last_opened_at');
    const captureStateCode = getValue(db, 'app_state', 'capture_state') || 'never_captured';
    const lastCapturedAt = getValue(db, 'app_state', 'last_capture_at');
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
      lastCaptureError,
      capturedIncidentCount,
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

  const markCaptureRunning = () => {
    if (!db) return { ok: false, error: 'No active DB selected.', status: getStatus() };
    setValue(db, 'app_state', 'capture_state', 'capture_running');
    setValue(db, 'app_state', 'last_capture_error', '');
    flushDb();
    return { ok: true, status: getStatus() };
  };

  const markCaptureError = (message) => {
    if (!db) return { ok: false, error: 'No active DB selected.', status: getStatus() };
    setValue(db, 'app_state', 'capture_state', 'error');
    setValue(db, 'app_state', 'last_capture_error', message || 'Capture failed.');
    flushDb();
    return { ok: true, status: getStatus() };
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

  const latestUpdateHash = (fireYear, incidentNumber, updateIndex) => {
    const rows = db.exec(
      'SELECT update_hash FROM incident_updates WHERE fire_year = ? AND incident_number = ? AND update_index = ? ORDER BY id DESC LIMIT 1',
      [String(fireYear), String(incidentNumber), Number(updateIndex)]
    );
    if (!rows.length || !rows[0].values.length) return null;
    return String(rows[0].values[0][0]);
  };

  const writeCaptureRecords = ({ listRows, detailRecords, capturedAt }) => {
    const captureTime = capturedAt || nowIso();
    const detailByIncidentKey = new Map();
    for (const detail of detailRecords) {
      const incident = detail?.incident;
      if (!incident?.incidentNumber || !incident?.fireYear) continue;
      detailByIncidentKey.set(incidentKey(incident.fireYear, incident.incidentNumber), detail);
    }

    let insertedSnapshots = 0;
    let insertedUpdates = 0;
    let insertedRaw = 0;

    db.run('BEGIN TRANSACTION');
    try {
      for (const row of listRows) {
        const key = incidentKey(row.fireYear, row.incidentNumber);
        const detail = detailByIncidentKey.get(key) || null;
        const incident = detail?.incident || row;
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
        if (rawSources) {
          const artifacts = [
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
            appendRawRecord({
              fireYear: incident.fireYear,
              incidentNumber: incident.incidentNumber,
              capturedAt: captureTime,
              ...artifact,
            });
            insertedRaw += 1;
          }
        }

        const updates = Array.isArray(detail?.response?.responseUpdates) ? detail.response.responseUpdates : [];
        updates.forEach((updateText, updateIndex) => {
          const nextText = String(updateText || '').trim();
          if (!nextText) return;
          const nextHash = hashPayload(nextText);
          const prevHash = latestUpdateHash(incident.fireYear, incident.incidentNumber, updateIndex);
          if (prevHash === nextHash) return;
          db.run(
            'INSERT INTO incident_updates (fire_year, incident_number, captured_at, update_index, update_hash, update_text) VALUES (?, ?, ?, ?, ?, ?)',
            [
              String(incident.fireYear),
              String(incident.incidentNumber),
              captureTime,
              Number(updateIndex),
              nextHash,
              nextText,
            ]
          );
          insertedUpdates += 1;
        });
      }

      setValue(db, 'app_state', 'capture_state', 'healthy');
      setValue(db, 'app_state', 'last_capture_at', captureTime);
      setValue(db, 'app_state', 'last_capture_error', '');
      db.run('COMMIT');
      flushDb();
      return {
        ok: true,
        status: getStatus(),
        capturedListCount: listRows.length,
        capturedDetailCount: detailRecords.length,
        insertedSnapshots,
        insertedUpdates,
        insertedRaw,
      };
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  };

  const saveIncidentCapture = ({ listRows = [], detailRecords = [], capturedAt } = {}) => {
    if (!db) return { ok: false, error: 'No active DB selected.', status: getStatus() };
    try {
      return writeCaptureRecords({ listRows, detailRecords, capturedAt });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Capture write failed.';
      setValue(db, 'app_state', 'capture_state', 'error');
      setValue(db, 'app_state', 'last_capture_error', message);
      flushDb();
      return { ok: false, error: message, status: getStatus() };
    }
  };

  const getIncidentListLocal = () => {
    if (!db) return { ok: false, error: 'No active DB selected.', rows: [], hasLocalData: false };
    const rows = db.exec(
      'SELECT row_json FROM incidents ORDER BY COALESCE(updated_date, discovery_date, last_captured_at) DESC'
    );
    const collection = rows.length
      ? rows[0].values.map((valueRow) => safeJsonParse(String(valueRow[0]), null)).filter(Boolean)
      : [];
    return {
      ok: true,
      rows: collection,
      totalRowCount: collection.length,
      hasLocalData: collection.length > 0,
    };
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
      'SELECT update_text FROM incident_updates WHERE fire_year = ? AND incident_number = ? ORDER BY update_index ASC',
      [effectiveFireYear, String(incidentNumber)]
    );
    const storedUpdates = updatesQuery.length
      ? updatesQuery[0].values.map((row) => String(row[0] || '')).filter(Boolean)
      : [];
    parsed.response = parsed.response || {};
    parsed.response.responseUpdates = storedUpdates;
    return { ok: true, found: true, data: parsed };
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

  return {
    autoLoadLastUsed,
    getStatus,
    createDbAtPath,
    selectDbAtPath,
    createNewDb,
    chooseExistingDb,
    deleteActiveDb,
    markCaptureRunning,
    markCaptureError,
    setAutoCheckMinutes,
    saveIncidentCapture,
    getIncidentListLocal,
    getIncidentDetailLocal,
    getCaptureMetrics,
    closeActive,
  };
}
