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
    markCaptureRunning: (payload) => ipcRenderer.invoke('db:capture-mark-running', payload),
    markCaptureProgress: (payload) => ipcRenderer.invoke('db:capture-mark-progress', payload),
    markCaptureError: (message, extra) => ipcRenderer.invoke('db:capture-mark-error', message, extra),
    setAutoCheckMinutes: (minutes) => ipcRenderer.invoke('db:set-auto-check-minutes', minutes),
    getCaptureMetrics: () => ipcRenderer.invoke('db:get-capture-metrics'),
    getCaptureSummary: () => ipcRenderer.invoke('db:get-capture-summary'),
    getCaptureRuntime: () => ipcRenderer.invoke('db:get-capture-runtime'),
    getCaptureTargets: () => ipcRenderer.invoke('db:get-capture-targets'),
    recoverResponseHistory: () => ipcRenderer.invoke('db:recover-response-history'),
    saveCapture: (payload) => ipcRenderer.invoke('db:capture-save', payload),
    getIncidentListLocal: () => ipcRenderer.invoke('db:incidents-list-local'),
    getIncidentDetailLocal: (fireYear, incidentNumber) =>
      ipcRenderer.invoke('db:incident-detail-local', fireYear, incidentNumber),
    getIncidentAttachmentAsset: (fireYear, incidentNumber, attachmentGuid, variantRole) =>
      ipcRenderer.invoke('db:incident-attachment-asset', fireYear, incidentNumber, attachmentGuid, variantRole),
    getPinnedIncidents: () => ipcRenderer.invoke('db:pins-list'),
    setIncidentPinned: (payload) => ipcRenderer.invoke('db:pin-set', payload),
    removeIncidentPinned: (fireYear, incidentNumber) => ipcRenderer.invoke('db:pin-remove', fireYear, incidentNumber),
    onAutoCheckTick: (handler) => {
      const wrapped = (_event, payload) => handler(payload);
      ipcRenderer.on('db:auto-check-tick', wrapped);
      return () => ipcRenderer.removeListener('db:auto-check-tick', wrapped);
    },
    onCaptureProgress: (handler) => {
      const wrapped = (_event, payload) => handler(payload);
      ipcRenderer.on('db:capture-progress', wrapped);
      return () => ipcRenderer.removeListener('db:capture-progress', wrapped);
    },
  },
});
