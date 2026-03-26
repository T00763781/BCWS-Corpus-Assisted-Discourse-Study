import fs from 'node:fs';
import path from 'node:path';
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
        last_captured_at TEXT NOT NULL,
        PRIMARY KEY (fire_year, incident_number)
      )
    `);
    database.run(`
      CREATE TABLE IF NOT EXISTS incident_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fire_year TEXT NOT NULL,
        incident_number TEXT NOT NULL,
        snapshot_type TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      )
    `);
    database.run(`
      CREATE TABLE IF NOT EXISTS incident_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fire_year TEXT NOT NULL,
        incident_number TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        update_index INTEGER NOT NULL,
        update_text TEXT NOT NULL
      )
    `);
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
      const fallbackCreatedAt = fs.existsSync(dbPath)
        ? fs.statSync(dbPath).birthtime.toISOString()
        : nowIso();
      setValue(db, 'workspace_meta', 'created_at', fallbackCreatedAt);
    }
    if (!getValue(db, 'app_state', 'capture_state')) {
      setValue(db, 'app_state', 'capture_state', 'never_captured');
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

  const writeCaptureRecords = ({ listRows, detailRecords, capturedAt }) => {
    const captureTime = capturedAt || nowIso();
    db.run('BEGIN TRANSACTION');
    try {
      for (const row of listRows) {
        db.run(
          `
            INSERT INTO incidents (
              fire_year, incident_number, incident_guid, incident_name, stage, fire_centre, location,
              discovery_date, updated_date, size_ha, latitude, longitude, fire_of_note, row_json, last_captured_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              last_captured_at = excluded.last_captured_at
          `,
          [
            String(row.fireYear),
            String(row.incidentNumber),
            row.incidentGuid || null,
            row.incidentName || null,
            row.stage || null,
            row.fireCentre || null,
            row.location || null,
            row.discoveryDate || null,
            row.updatedDate || null,
            row.sizeHa ?? null,
            Number.isFinite(Number(row.latitude)) ? Number(row.latitude) : null,
            Number.isFinite(Number(row.longitude)) ? Number(row.longitude) : null,
            row.fireOfNote ? 1 : 0,
            JSON.stringify(row),
            captureTime,
          ]
        );
        db.run(
          'INSERT INTO incident_snapshots (fire_year, incident_number, snapshot_type, captured_at, payload_json) VALUES (?, ?, ?, ?, ?)',
          [String(row.fireYear), String(row.incidentNumber), 'list', captureTime, JSON.stringify(row)]
        );
      }

      for (const detail of detailRecords) {
        const incident = detail?.incident;
        if (!incident?.incidentNumber || !incident?.fireYear) continue;
        db.run(
          `
            INSERT INTO incidents (
              fire_year, incident_number, incident_guid, incident_name, stage, fire_centre, location,
              discovery_date, updated_date, size_ha, latitude, longitude, fire_of_note, row_json, detail_json, last_captured_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
              detail_json = excluded.detail_json,
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
            JSON.stringify(incident),
            JSON.stringify(detail),
            captureTime,
          ]
        );
        db.run(
          'INSERT INTO incident_snapshots (fire_year, incident_number, snapshot_type, captured_at, payload_json) VALUES (?, ?, ?, ?, ?)',
          [
            String(incident.fireYear),
            String(incident.incidentNumber),
            'detail',
            captureTime,
            JSON.stringify(detail),
          ]
        );
        db.run('DELETE FROM incident_updates WHERE fire_year = ? AND incident_number = ?', [
          String(incident.fireYear),
          String(incident.incidentNumber),
        ]);
        const updates = Array.isArray(detail?.response?.responseUpdates) ? detail.response.responseUpdates : [];
        updates.forEach((updateText, index) => {
          db.run(
            'INSERT INTO incident_updates (fire_year, incident_number, captured_at, update_index, update_text) VALUES (?, ?, ?, ?, ?)',
            [
              String(incident.fireYear),
              String(incident.incidentNumber),
              captureTime,
              index,
              String(updateText || ''),
            ]
          );
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
        'SELECT detail_json, fire_year FROM incidents WHERE incident_number = ? AND detail_json IS NOT NULL ORDER BY last_captured_at DESC LIMIT 1',
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
    saveIncidentCapture,
    getIncidentListLocal,
    getIncidentDetailLocal,
    closeActive,
  };
}
