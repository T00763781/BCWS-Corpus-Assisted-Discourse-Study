import fs from 'node:fs';
import path from 'node:path';
import { incidentsRepository } from '../db/repositories/incidents-repo';
import { settingsService } from './settings-service';

type ExportFormat = 'json' | 'markdown';

class ExportService {
  generateIncidentDossier(input: { incidentId: string; format?: ExportFormat }): {
    incidentId: string;
    format: ExportFormat;
    filePath: string;
    bytes: number;
  } {
    const format: ExportFormat = input.format === 'markdown' ? 'markdown' : 'json';
    const paths = settingsService.getPaths();
    const exportDir = path.join(paths.storageRoot, 'exports');
    fs.mkdirSync(exportDir, { recursive: true });

    const primary = incidentsRepository.get(input.incidentId) as {
      incident: Record<string, unknown>;
      latestSnapshot: Record<string, unknown> | null;
    };
    const history = incidentsRepository.history(input.incidentId) as {
      latestSnapshot: Record<string, unknown> | null;
      updates: Array<Record<string, unknown>>;
    };
    const supporting = incidentsRepository.supporting(input.incidentId) as Record<string, unknown>;
    const attachments = incidentsRepository.attachments(input.incidentId) as Array<Record<string, unknown>>;

    const incidentNumber = String(primary.incident.incidentNumber || input.incidentId).replace(/[^a-z0-9_-]/gi, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(exportDir, `${incidentNumber}_${timestamp}.${format === 'json' ? 'json' : 'md'}`);

    if (format === 'json') {
      const payload = {
        incident: primary.incident,
        latestSnapshot: primary.latestSnapshot,
        updates: history.updates,
        attachments,
        supporting,
        exportedAt: new Date().toISOString(),
      };
      const text = JSON.stringify(payload, null, 2);
      fs.writeFileSync(filePath, text, 'utf-8');
    } else {
      const lines: string[] = [];
      lines.push(`# Incident Dossier: ${String(primary.incident.incidentName || incidentNumber)}`);
      lines.push('');
      lines.push(`- Incident ID: ${input.incidentId}`);
      lines.push(`- Incident Number: ${String(primary.incident.incidentNumber || 'n/a')}`);
      lines.push(`- Fire Year: ${String(primary.incident.fireYear || 'n/a')}`);
      lines.push(`- Exported At: ${new Date().toISOString()}`);
      lines.push('');
      lines.push('## Latest Snapshot');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(primary.latestSnapshot || {}, null, 2));
      lines.push('```');
      lines.push('');
      lines.push('## Official Updates (Newest First)');
      lines.push('');
      for (const update of history.updates) {
        lines.push(`### ${String(update.observedAt || 'unknown')}`);
        lines.push('');
        lines.push(String(update.updateText || ''));
        lines.push('');
      }
      lines.push('## Attachments');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(attachments, null, 2));
      lines.push('```');
      lines.push('');
      lines.push('## Supporting');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(supporting, null, 2));
      lines.push('```');
      fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    }

    const stat = fs.statSync(filePath);
    return {
      incidentId: input.incidentId,
      format,
      filePath,
      bytes: stat.size,
    };
  }
}

export const exportService = new ExportService();
