import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { databaseManager } from '../../db/client';
import { incidentsRepository } from '../../db/repositories/incidents-repo';
import { ingestRuns, rawSourceRecords } from '../../db/schema';
import { settingsService } from '../settings-service';
import { bcwsClient, type IncidentListRow } from './bcws-client';
import { ingestParsers } from './parsers';
import { playwrightFallback } from './playwright-fallback';

type SyncScope = 'list' | 'detail' | 'full';

type SyncSummary = {
  incidentsSeen: number;
  incidentMastersUpserted: number;
  incidentSnapshotsInserted: number;
  detailsFetched: number;
  updatesInserted: number;
  parserErrors: number;
  playwrightFallbackAttempts: number;
  playwrightFallbackSuccesses: number;
};

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function contentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function ensureRunRawDir(storageRoot: string, runId: string): string {
  const date = new Date();
  const rel = path.join(
    'raw',
    String(date.getUTCFullYear()),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
    runId
  );
  const abs = path.join(storageRoot, rel);
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

function writeRaw(absRunDir: string, filename: string, body: string): { relPath: string; hash: string } {
  const safeName = filename.replace(/[^a-z0-9_.-]/gi, '_');
  const absPath = path.join(absRunDir, safeName);
  fs.writeFileSync(absPath, body, 'utf-8');
  return {
    relPath: absPath,
    hash: contentHash(body),
  };
}

class IngestEngine {
  async run(
    scope: SyncScope,
    runType: 'manual' | 'scheduled' = 'manual',
    runIdOverride?: string
  ): Promise<{ runId: string; summary: SyncSummary }> {
    const orm = databaseManager.getOrm();
    const startedAt = new Date().toISOString();
    const runId = runIdOverride || id('ingest-run');
    const paths = settingsService.getPaths();
    const ingestConfig = settingsService.getIngestConfig();
    const rawDir = ensureRunRawDir(paths.storageRoot, runId);

    const summary: SyncSummary = {
      incidentsSeen: 0,
      incidentMastersUpserted: 0,
      incidentSnapshotsInserted: 0,
      detailsFetched: 0,
      updatesInserted: 0,
      parserErrors: 0,
      playwrightFallbackAttempts: 0,
      playwrightFallbackSuccesses: 0,
    };
    let playwrightFallbackBudget = ingestConfig.playwrightFallbackBudget;

    orm
      .insert(ingestRuns)
      .values({
        id: runId,
        startedAt,
        endedAt: null,
        runType,
        status: 'running',
        summaryJson: JSON.stringify(summary),
        errorJson: null,
      })
      .run();

    try {
      const listRows = await bcwsClient.fetchIncidentList(1000);
      summary.incidentsSeen = listRows.length;

      const listRawBody = JSON.stringify(listRows, null, 2);
      const listArtifact = writeRaw(rawDir, 'incident-list.json', listRawBody);
      this.insertRawSourceRecord({
        sourceKind: 'bcws.incident_list',
        incidentId: null,
        fetchUrl: 'https://wildfiresituation.nrs.gov.bc.ca/wfnews-api/publicPublishedIncident',
        httpStatus: 200,
        contentType: 'application/json',
        contentHash: listArtifact.hash,
        storageRelPath: listArtifact.relPath,
        parseStatus: 'ok',
        parseError: null,
      });

      const detailTargets: IncidentListRow[] = [];

      for (const row of listRows) {
        const upsertResult = incidentsRepository.upsertIncidentMaster({
          bcwsIncidentGuid: row.incidentGuid,
          fireYear: row.fireYear,
          incidentNumber: row.incidentNumber,
          incidentName: row.incidentName,
          fireCentre: row.fireCentre,
          sourceUpdatedAt: row.updatedAt,
        });
        summary.incidentMastersUpserted += 1;

        const snapshotResult = incidentsRepository.upsertSnapshot({
          incidentId: upsertResult.incidentId,
          sourceUpdatedAt: row.updatedAt,
          stageOfControl: row.stageOfControl,
          sizeHa: row.sizeHa,
          discoveryDate: row.discoveryDate,
          causeText: row.causeText,
          resourcesJson: JSON.stringify(row.resources),
          locationJson: JSON.stringify({ latitude: row.latitude, longitude: row.longitude }),
        });

        if (snapshotResult.inserted) summary.incidentSnapshotsInserted += 1;

        if (scope === 'list') continue;
        if (scope === 'detail' || upsertResult.isNew || upsertResult.sourceChanged) {
          detailTargets.push(row);
        }
      }

      if (scope !== 'list') {
        for (const target of detailTargets.slice(0, ingestConfig.detailTargetLimit)) {
          const identity = incidentsRepository.findByIdentity({
            bcwsIncidentGuid: target.incidentGuid,
            fireYear: target.fireYear,
            incidentNumber: target.incidentNumber,
          });
          if (!identity) continue;

          summary.detailsFetched += 1;
          const observedAt = new Date().toISOString();
          const detail = await bcwsClient.fetchIncidentDetail(target);

          const htmlArtifact = writeRaw(
            rawDir,
            `${target.fireYear}_${target.incidentNumber}_detail.html`,
            detail.incidentHtml || ''
          );

          const sourceRefId = this.insertRawSourceRecord({
            sourceKind: 'bcws.incident_detail_html',
            incidentId: identity.id,
            fetchUrl: `https://wildfiresituation.nrs.gov.bc.ca/incidents?fireYear=${target.fireYear}&incidentNumber=${target.incidentNumber}`,
            httpStatus: 200,
            contentType: 'text/html',
            contentHash: htmlArtifact.hash,
            storageRelPath: htmlArtifact.relPath,
            parseStatus: 'ok',
            parseError: null,
          });

          for (const attachment of detail.attachments) {
            incidentsRepository.insertAttachmentIfNew({
              incidentId: identity.id,
              sourceAttachmentId: attachment.attachmentGuid,
              title: attachment.title,
              url: attachment.imageUrl,
              localPath: null,
              mimeType: attachment.mimeType,
              observedAt,
            });
          }

          for (const link of detail.externalLinks) {
            incidentsRepository.insertExternalLinkIfNew({
              incidentId: identity.id,
              category: link.category,
              label: link.label,
              url: link.url,
              observedAt,
            });
          }

          if (detail.perimeterData) {
            incidentsRepository.insertPerimeterIfChanged({
              incidentId: identity.id,
              observedAt,
              geometryGeojson: JSON.stringify(detail.perimeterData),
              sourceRefId,
            });
          }

          const notices = [
            ...detail.evacuation.orders.map((row) => ({
              noticeType: 'order',
              status: row.status ? String(row.status) : null,
              eventName: row.eventName ? String(row.eventName) : null,
              issuingAgency: row.issuingAgency ? String(row.issuingAgency) : null,
              issuedAt: row.issuedAt ? String(row.issuedAt) : null,
              observedAt,
              sourceRefId,
            })),
            ...detail.evacuation.alerts.map((row) => ({
              noticeType: 'alert',
              status: row.status ? String(row.status) : null,
              eventName: row.eventName ? String(row.eventName) : null,
              issuingAgency: row.issuingAgency ? String(row.issuingAgency) : null,
              issuedAt: row.issuedAt ? String(row.issuedAt) : null,
              observedAt,
              sourceRefId,
            })),
          ];
          incidentsRepository.replaceEvacuationNotices({ incidentId: identity.id, notices });

          const updates = ingestParsers.parseResponseUpdates(detail.incidentHtml);
          const fallbackCandidates = [
            target.responseTypeDetail?.trim() || '',
            ...(detail.officialUpdateCandidates || []),
          ].filter(Boolean);
          const allUpdates = [...new Set([...(updates || []), ...fallbackCandidates])];
          if (!allUpdates.length && playwrightFallbackBudget > 0) {
            playwrightFallbackBudget -= 1;
            summary.playwrightFallbackAttempts += 1;
            const detailUrl = `https://wildfiresituation.nrs.gov.bc.ca/incidents?fireYear=${target.fireYear}&incidentNumber=${target.incidentNumber}`;
            const pwResult = await playwrightFallback.tryPlaywrightFallback({
              url: detailUrl,
              fireYear: target.fireYear,
              incidentNumber: target.incidentNumber,
              rawDir,
            });

            if (pwResult.htmlPath) {
              const htmlRaw = fs.readFileSync(pwResult.htmlPath, 'utf-8');
              this.insertRawSourceRecord({
                sourceKind: 'bcws.incident_detail_playwright_html',
                incidentId: identity.id,
                fetchUrl: detailUrl,
                httpStatus: 200,
                contentType: 'text/html',
                contentHash: contentHash(htmlRaw),
                storageRelPath: pwResult.htmlPath,
                parseStatus: pwResult.updates.length ? 'ok' : 'warning',
                parseError: pwResult.updates.length ? null : pwResult.error || 'Playwright fallback produced no updates',
              });
            }
            for (const jsonArtifactPath of pwResult.jsonArtifacts || []) {
              try {
                const raw = fs.readFileSync(jsonArtifactPath, 'utf-8');
                this.insertRawSourceRecord({
                  sourceKind: 'bcws.incident_detail_playwright_json',
                  incidentId: identity.id,
                  fetchUrl: detailUrl,
                  httpStatus: 200,
                  contentType: 'application/json',
                  contentHash: contentHash(raw),
                  storageRelPath: jsonArtifactPath,
                  parseStatus: pwResult.updates.length ? 'ok' : 'warning',
                  parseError: null,
                });
              } catch {
                // Ignore unreadable artifact and continue ingest.
              }
            }

            if (pwResult.updates.length) {
              summary.playwrightFallbackSuccesses += 1;
              for (const updateText of pwResult.updates) {
                allUpdates.push(updateText);
              }
            } else {
              summary.parserErrors += 1;
              orm
                .update(rawSourceRecords)
                .set({ parseStatus: 'warning', parseError: pwResult.error || 'No response updates parsed from HTML' })
                .where(eq(rawSourceRecords.id, sourceRefId))
                .run();
            }
          } else if (!allUpdates.length) {
            summary.parserErrors += 1;
            orm
              .update(rawSourceRecords)
              .set({ parseStatus: 'warning', parseError: 'No response updates parsed from HTML (fallback budget exhausted)' })
              .where(eq(rawSourceRecords.id, sourceRefId))
              .run();
          }
          const uniqueUpdates = [...new Set(allUpdates)];
          for (const updateText of uniqueUpdates) {
            const inserted = incidentsRepository.insertOfficialUpdateIfNew({
              incidentId: identity.id,
              publishedAt: null,
              observedAt,
              updateText,
              sourceRefId,
            });
            if (inserted.inserted) summary.updatesInserted += 1;
          }

          const detailJsonArtifact = writeRaw(
            rawDir,
            `${target.fireYear}_${target.incidentNumber}_detail.json`,
            JSON.stringify(detail, null, 2)
          );

          this.insertRawSourceRecord({
            sourceKind: 'bcws.incident_detail_payload',
            incidentId: identity.id,
            fetchUrl: `detail payload for ${target.fireYear}/${target.incidentNumber}`,
            httpStatus: 200,
            contentType: 'application/json',
            contentHash: detailJsonArtifact.hash,
            storageRelPath: detailJsonArtifact.relPath,
            parseStatus: 'ok',
            parseError: null,
          });
        }
      }

      orm
        .update(ingestRuns)
        .set({
          endedAt: new Date().toISOString(),
          status: 'completed',
          summaryJson: JSON.stringify(summary),
          errorJson: null,
        })
        .where(eq(ingestRuns.id, runId))
        .run();

      return { runId, summary };
    } catch (error) {
      orm
        .update(ingestRuns)
        .set({
          endedAt: new Date().toISOString(),
          status: 'failed',
          summaryJson: JSON.stringify(summary),
          errorJson: JSON.stringify({ message: error instanceof Error ? error.message : String(error) }),
        })
        .where(eq(ingestRuns.id, runId))
        .run();
      throw error;
    }
  }

  private insertRawSourceRecord(input: {
    sourceKind: string;
    incidentId: string | null;
    fetchUrl: string;
    httpStatus: number;
    contentType: string;
    contentHash: string;
    storageRelPath: string;
    parseStatus: string;
    parseError: string | null;
  }): string {
    const orm = databaseManager.getOrm();
    const rowId = id('raw');
    orm
      .insert(rawSourceRecords)
      .values({
        id: rowId,
        sourceKind: input.sourceKind,
        incidentId: input.incidentId,
        fetchUrl: input.fetchUrl,
        fetchedAt: new Date().toISOString(),
        httpStatus: input.httpStatus,
        contentType: input.contentType,
        contentHash: input.contentHash,
        storageRelPath: input.storageRelPath,
        parserVersion: 'phase3-v1',
        parseStatus: input.parseStatus,
        parseError: input.parseError,
      })
      .run();

    return rowId;
  }
}

export const ingestEngine = new IngestEngine();
