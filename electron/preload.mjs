import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('openFiresideDesktop', {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  db: {
    getStatus: () => ipcRenderer.invoke('db:get-status'),
    create: () => ipcRenderer.invoke('db:create'),
    select: () => ipcRenderer.invoke('db:select'),
    deleteActive: () => ipcRenderer.invoke('db:delete-active'),
    createAtPath: (dbPath) => ipcRenderer.invoke('db:create-at-path', dbPath),
    selectPath: (dbPath) => ipcRenderer.invoke('db:select-path', dbPath),
    markCaptureRunning: () => ipcRenderer.invoke('db:capture-mark-running'),
    markCaptureError: (message) => ipcRenderer.invoke('db:capture-mark-error', message),
    saveCapture: (payload) => ipcRenderer.invoke('db:capture-save', payload),
    getIncidentListLocal: () => ipcRenderer.invoke('db:incidents-list-local'),
    getIncidentDetailLocal: (fireYear, incidentNumber) =>
      ipcRenderer.invoke('db:incident-detail-local', fireYear, incidentNumber),
  },
});
