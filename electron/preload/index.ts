import { contextBridge, ipcRenderer } from 'electron';

const api = {
  incidents: {
    list: (input: unknown) => ipcRenderer.invoke('incidents.list', input),
    get: (input: unknown) => ipcRenderer.invoke('incidents.get', input),
    history: (input: unknown) => ipcRenderer.invoke('incidents.history', input),
    supporting: (input: unknown) => ipcRenderer.invoke('incidents.supporting', input),
    updateDiff: (input: unknown) => ipcRenderer.invoke('incidents.updateDiff', input),
  },
  attachments: {
    list: (input: unknown) => ipcRenderer.invoke('attachments.list', input),
  },
  sync: {
    run: (input: unknown) => ipcRenderer.invoke('sync.run', input),
    status: (input: unknown) => ipcRenderer.invoke('sync.status', input),
  },
  ingest: {
    diagnostics: () => ipcRenderer.invoke('ingest.diagnostics'),
    listRuns: (input: unknown) => ipcRenderer.invoke('ingest.diagnostics.listRuns', input),
    listRawRecords: (input: unknown) => ipcRenderer.invoke('ingest.diagnostics.listRawRecords', input),
    getRawRecord: (input: unknown) => ipcRenderer.invoke('ingest.diagnostics.getRawRecord', input),
  },
  settings: {
    getPaths: () => ipcRenderer.invoke('settings.getPaths'),
    setDatabasePath: (input: unknown) => ipcRenderer.invoke('settings.setDatabasePath', input),
    setStorageRoot: (input: unknown) => ipcRenderer.invoke('settings.setStorageRoot', input),
    getIngestConfig: () => ipcRenderer.invoke('settings.getIngestConfig'),
    setIngestConfig: (input: unknown) => ipcRenderer.invoke('settings.setIngestConfig', input),
  },
  exports: {
    generateIncidentDossier: (input: unknown) => ipcRenderer.invoke('exports.generateIncidentDossier', input),
  },
};

contextBridge.exposeInMainWorld('openFiresideApi', api);
