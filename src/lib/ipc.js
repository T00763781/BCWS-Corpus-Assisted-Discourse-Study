function getApi() {
  if (typeof window === 'undefined' || !window.openFiresideApi) {
    throw new Error('Desktop preload API is unavailable. Launch with Electron (npm run dev:desktop).');
  }
  return window.openFiresideApi;
}

async function unwrap(promise) {
  const result = await promise;
  if (!result?.ok) {
    throw new Error(result?.error?.message || 'IPC request failed');
  }
  return result.data;
}

export const desktopApi = {
  incidents: {
    list: (input) => unwrap(getApi().incidents.list(input)),
    get: (input) => unwrap(getApi().incidents.get(input)),
    history: (input) => unwrap(getApi().incidents.history(input)),
    supporting: (input) => unwrap(getApi().incidents.supporting(input)),
    updateDiff: (input) => unwrap(getApi().incidents.updateDiff(input)),
  },
  attachments: {
    list: (input) => unwrap(getApi().attachments.list(input)),
  },
  sync: {
    run: (input) => unwrap(getApi().sync.run(input)),
    status: (input) => unwrap(getApi().sync.status(input)),
  },
  ingest: {
    diagnostics: () => unwrap(getApi().ingest.diagnostics()),
    listRuns: (input) => unwrap(getApi().ingest.listRuns(input)),
    listRawRecords: (input) => unwrap(getApi().ingest.listRawRecords(input)),
    getRawRecord: (input) => unwrap(getApi().ingest.getRawRecord(input)),
  },
  settings: {
    getPaths: () => unwrap(getApi().settings.getPaths()),
    setDatabasePath: (input) => unwrap(getApi().settings.setDatabasePath(input)),
    setStorageRoot: (input) => unwrap(getApi().settings.setStorageRoot(input)),
    getIngestConfig: () => unwrap(getApi().settings.getIngestConfig()),
    setIngestConfig: (input) => unwrap(getApi().settings.setIngestConfig(input)),
  },
  exports: {
    generateIncidentDossier: (input) => unwrap(getApi().exports.generateIncidentDossier(input)),
  },
};
