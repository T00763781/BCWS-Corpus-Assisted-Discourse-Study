import { ipcMain } from 'electron';
import { incidentsRepository } from '../db/repositories/incidents-repo';
import { exportService } from '../services/export-service';
import { settingsService } from '../services/settings-service';
import { syncService } from '../services/sync-service';

async function wrap<T>(fn: () => T | Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: { code: string; message: string } }> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    };
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('incidents.list', (_event, input) => wrap(() => incidentsRepository.list(input)));
  ipcMain.handle('incidents.get', (_event, input) =>
    wrap(() => {
      if (input?.incidentId) {
        return incidentsRepository.get(input.incidentId);
      }
      return incidentsRepository.getByNaturalKey(Number(input.fireYear), String(input.incidentNumber));
    })
  );
  ipcMain.handle('incidents.history', (_event, input) => wrap(() => incidentsRepository.history(String(input.incidentId))));
  ipcMain.handle('incidents.supporting', (_event, input) => wrap(() => incidentsRepository.supporting(String(input.incidentId))));
  ipcMain.handle('incidents.updateDiff', (_event, input) => wrap(() => incidentsRepository.getUpdateDiff(String(input.incidentId))));
  ipcMain.handle('attachments.list', (_event, input) => wrap(() => incidentsRepository.attachments(String(input.incidentId))));
  ipcMain.handle('ingest.diagnostics', () => wrap(() => incidentsRepository.ingestDiagnostics()));
  ipcMain.handle('ingest.diagnostics.listRuns', (_event, input) => wrap(() => incidentsRepository.listRuns(Number(input?.limit ?? 25))));
  ipcMain.handle('ingest.diagnostics.listRawRecords', (_event, input) => wrap(() => incidentsRepository.listRawRecords(input || {})));
  ipcMain.handle('ingest.diagnostics.getRawRecord', (_event, input) => wrap(() => incidentsRepository.getRawRecord(String(input.id))));

  ipcMain.handle('sync.run', (_event, input) => wrap(() => syncService.run(input?.scope ?? 'full')));
  ipcMain.handle('sync.status', (_event, input) => wrap(() => syncService.status(input?.runId)));

  ipcMain.handle('settings.getPaths', () => wrap(() => settingsService.getPaths()));
  ipcMain.handle('settings.setDatabasePath', (_event, input) => wrap(() => settingsService.setDatabasePath(String(input.newPath))));
  ipcMain.handle('settings.setStorageRoot', (_event, input) => wrap(() => settingsService.setStorageRoot(String(input.newPath))));
  ipcMain.handle('settings.getIngestConfig', () => wrap(() => settingsService.getIngestConfig()));
  ipcMain.handle('settings.setIngestConfig', (_event, input) => wrap(() => settingsService.setIngestConfig(input || {})));
  ipcMain.handle('exports.generateIncidentDossier', (_event, input) =>
    wrap(() => exportService.generateIncidentDossier({ incidentId: String(input.incidentId), format: input?.format }))
  );
}
