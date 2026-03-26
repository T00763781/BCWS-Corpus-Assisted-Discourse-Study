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
    setAutoCheckMinutes: (minutes) => ipcRenderer.invoke('db:set-auto-check-minutes', minutes),
    getCaptureMetrics: () => ipcRenderer.invoke('db:get-capture-metrics'),
    saveCapture: (payload) => ipcRenderer.invoke('db:capture-save', payload),
    getIncidentListLocal: () => ipcRenderer.invoke('db:incidents-list-local'),
    getIncidentDetailLocal: (fireYear, incidentNumber) =>
      ipcRenderer.invoke('db:incident-detail-local', fireYear, incidentNumber),
    onAutoCheckTick: (handler) => {
      const wrapped = (_event, payload) => handler(payload);
      ipcRenderer.on('db:auto-check-tick', wrapped);
      return () => ipcRenderer.removeListener('db:auto-check-tick', wrapped);
    },
  },
});
