import crypto from 'node:crypto';
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { databaseManager } from '../client';
import {
  incidentAttachments,
  incidentExternalLinks,
  incidentPerimeters,
  incidentSnapshots,
  incidents,
  ingestRuns,
  incidentUpdates,
  rawSourceRecords,
  evacuationNotices,
} from '../schema';

type ListInput = {
  query?: string;
  fireCentre?: string;
  stageCodes?: string[];
  limit?: number;
  offset?: number;
  sort?: 'updated_desc' | 'updated_asc';
};

type IncidentIdentityInput = {
  bcwsIncidentGuid: string | null;
  fireYear: number;
  incidentNumber: string;
};

type IncidentUpsertInput = IncidentIdentityInput & {
  incidentName: string;
  fireCentre: string | null;
  sourceUpdatedAt: string;
};

type SnapshotInput = {
  incidentId: string;
  sourceUpdatedAt: string;
  stageOfControl: string | null;
  sizeHa: number | null;
  discoveryDate: string | null;
  causeText: string | null;
  resourcesJson: string;
  locationJson: string;
};

type UpdateInput = {
  incidentId: string;
  publishedAt: string | null;
  observedAt: string;
  updateText: string;
  sourceRefId: string | null;
};

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function stableHash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

class IncidentsRepository {
  list(input: ListInput = {}): { rows: unknown[]; total: number } {
    const orm = databaseManager.getOrm();
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
    const offset = Math.max(input.offset ?? 0, 0);
    const terms = input.query?.trim();

    const whereParts = [];
    if (terms) {
      whereParts.push(or(like(incidents.incidentName, `%${terms}%`), like(incidents.incidentNumber, `%${terms}%`)));
    }
    if (input.fireCentre) {
      whereParts.push(eq(incidents.fireCentre, input.fireCentre));
    }

    const whereClause = whereParts.length ? and(...whereParts) : undefined;

    const rows = orm
      .select({
        incidentId: incidents.id,
        fireYear: incidents.fireYear,
        incidentNumber: incidents.incidentNumber,
        incidentName: incidents.incidentName,
        fireCentre: incidents.fireCentre,
        updatedAt: incidents.updatedAt,
        stage: incidentSnapshots.stageOfControl,
        sizeHa: incidentSnapshots.sizeHa,
      })
      .from(incidents)
      .leftJoin(
        incidentSnapshots,
        and(eq(incidentSnapshots.incidentId, incidents.id), eq(incidentSnapshots.isCurrent, true))
      )
      .where(whereClause)
      .orderBy(input.sort === 'updated_asc' ? incidents.updatedAt : desc(incidents.updatedAt))
      .limit(limit)
      .offset(offset)
      .all();

    const count = orm.select({ count: sql<number>`count(*)` }).from(incidents).where(whereClause).get();
    return { rows, total: Number(count?.count ?? 0) };
  }

  get(incidentId: string): unknown {
    const orm = databaseManager.getOrm();
    const incident = orm.select().from(incidents).where(eq(incidents.id, incidentId)).get();
    if (!incident) throw new Error(`Incident ${incidentId} not found`);

    const latestSnapshot = orm
      .select()
      .from(incidentSnapshots)
      .where(and(eq(incidentSnapshots.incidentId, incident.id), eq(incidentSnapshots.isCurrent, true)))
      .get();

    return { incident, latestSnapshot: latestSnapshot ?? null };
  }

  getByNaturalKey(fireYear: number, incidentNumber: string): unknown {
    const orm = databaseManager.getOrm();
    const incident = orm
      .select()
      .from(incidents)
      .where(and(eq(incidents.fireYear, fireYear), eq(incidents.incidentNumber, incidentNumber)))
      .get();

    if (!incident) throw new Error(`Incident ${fireYear}/${incidentNumber} not found`);
    return this.get(incident.id);
  }

  history(incidentId: string): unknown {
    const orm = databaseManager.getOrm();
    const latestSnapshot = orm
      .select()
      .from(incidentSnapshots)
      .where(and(eq(incidentSnapshots.incidentId, incidentId), eq(incidentSnapshots.isCurrent, true)))
      .get();

    const updates = orm
      .select()
      .from(incidentUpdates)
      .where(eq(incidentUpdates.incidentId, incidentId))
      .orderBy(desc(incidentUpdates.observedAt), desc(incidentUpdates.publishedAt))
      .all();

    return { latestSnapshot: latestSnapshot ?? null, updates };
  }

  attachments(incidentId: string): unknown[] {
    const orm = databaseManager.getOrm();
    return orm
      .select()
      .from(incidentAttachments)
      .where(eq(incidentAttachments.incidentId, incidentId))
      .orderBy(desc(incidentAttachments.observedAt))
      .all();
  }

  supporting(incidentId: string): unknown {
    const orm = databaseManager.getOrm();

    const externalLinks = orm
      .select()
      .from(incidentExternalLinks)
      .where(eq(incidentExternalLinks.incidentId, incidentId))
      .orderBy(desc(incidentExternalLinks.observedAt))
      .all();

    const latestPerimeter = orm
      .select()
      .from(incidentPerimeters)
      .where(eq(incidentPerimeters.incidentId, incidentId))
      .orderBy(desc(incidentPerimeters.observedAt))
      .get();

    const evacuation = orm
      .select()
      .from(evacuationNotices)
      .where(eq(evacuationNotices.incidentId, incidentId))
      .orderBy(desc(evacuationNotices.observedAt))
      .all();

    const provenance = orm
      .select({
        lastIngestAt: sql<string | null>`max(${rawSourceRecords.fetchedAt})`,
        rawSourceCount: sql<number>`count(*)`,
        warningCount: sql<number>`sum(case when ${rawSourceRecords.parseStatus} = 'warning' then 1 else 0 end)`,
      })
      .from(rawSourceRecords)
      .where(eq(rawSourceRecords.incidentId, incidentId))
      .get();

    return {
      externalLinks,
      latestPerimeter: latestPerimeter ?? null,
      evacuation,
      provenance: {
        lastIngestAt: provenance?.lastIngestAt ?? null,
        rawSourceCount: Number(provenance?.rawSourceCount ?? 0),
        warningCount: Number(provenance?.warningCount ?? 0),
      },
    };
  }

  ingestDiagnostics(): unknown {
    const orm = databaseManager.getOrm();
    const parseWarnings = orm
      .select({ count: sql<number>`count(*)` })
      .from(rawSourceRecords)
      .where(eq(rawSourceRecords.parseStatus, 'warning'))
      .get();

    const parseErrors = orm
      .select({ count: sql<number>`count(*)` })
      .from(rawSourceRecords)
      .where(eq(rawSourceRecords.parseStatus, 'error'))
      .get();

    const lastRuns = orm
      .select()
      .from(ingestRuns)
      .orderBy(desc(ingestRuns.startedAt))
      .limit(10)
      .all();

    return {
      parseWarnings: Number(parseWarnings?.count ?? 0),
      parseErrors: Number(parseErrors?.count ?? 0),
      lastRuns,
    };
  }

  listRuns(limit = 25): unknown[] {
    const orm = databaseManager.getOrm();
    return orm
      .select()
      .from(ingestRuns)
      .orderBy(desc(ingestRuns.startedAt))
      .limit(Math.max(1, Math.min(limit, 200)))
      .all();
  }

  listRawRecords(input: {
    incidentId?: string | null;
    parseStatus?: string | null;
    runId?: string | null;
    limit?: number;
    offset?: number;
  } = {}): { rows: unknown[]; total: number } {
    const orm = databaseManager.getOrm();
    const limit = Math.max(1, Math.min(Number(input.limit ?? 50), 500));
    const offset = Math.max(0, Number(input.offset ?? 0));

    const filters = [];
    if (input.incidentId) filters.push(eq(rawSourceRecords.incidentId, input.incidentId));
    if (input.parseStatus) filters.push(eq(rawSourceRecords.parseStatus, input.parseStatus));
    if (input.runId) filters.push(like(rawSourceRecords.storageRelPath, `%${input.runId}%`));
    const where = filters.length ? and(...filters) : undefined;

    const rows = orm
      .select()
      .from(rawSourceRecords)
      .where(where)
      .orderBy(desc(rawSourceRecords.fetchedAt))
      .limit(limit)
      .offset(offset)
      .all();

    const count = orm.select({ count: sql<number>`count(*)` }).from(rawSourceRecords).where(where).get();
    return { rows, total: Number(count?.count ?? 0) };
  }

  getRawRecord(idValue: string): unknown {
    const orm = databaseManager.getOrm();
    const row = orm.select().from(rawSourceRecords).where(eq(rawSourceRecords.id, idValue)).get();
    if (!row) throw new Error(`Raw source record not found: ${idValue}`);
    return row;
  }

  getUpdateDiff(incidentId: string): unknown {
    const orm = databaseManager.getOrm();
    const updates = orm
      .select()
      .from(incidentUpdates)
      .where(eq(incidentUpdates.incidentId, incidentId))
      .orderBy(desc(incidentUpdates.observedAt), desc(incidentUpdates.publishedAt))
      .limit(2)
      .all();

    if (updates.length < 2) {
      return {
        available: false,
        reason: 'Need at least two stored updates to compute diff.',
        latest: updates[0] ?? null,
        previous: null,
        addedLines: [],
        removedLines: [],
      };
    }

    const [latest, previous] = updates;
    const latestLines = String(latest.updateText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const previousLines = String(previous.updateText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const prevSet = new Set(previousLines);
    const latestSet = new Set(latestLines);

    return {
      available: true,
      latest,
      previous,
      addedLines: latestLines.filter((line) => !prevSet.has(line)),
      removedLines: previousLines.filter((line) => !latestSet.has(line)),
    };
  }

  findByIdentity(identity: IncidentIdentityInput): { id: string; updatedAt: string } | null {
    const orm = databaseManager.getOrm();

    if (identity.bcwsIncidentGuid) {
      const byGuid = orm
        .select({ id: incidents.id, updatedAt: incidents.updatedAt })
        .from(incidents)
        .where(eq(incidents.bcwsIncidentGuid, identity.bcwsIncidentGuid))
        .get();
      if (byGuid) return byGuid;
    }

    return (
      orm
        .select({ id: incidents.id, updatedAt: incidents.updatedAt })
        .from(incidents)
        .where(and(eq(incidents.fireYear, identity.fireYear), eq(incidents.incidentNumber, identity.incidentNumber)))
        .get() ?? null
    );
  }

  upsertIncidentMaster(input: IncidentUpsertInput): { incidentId: string; isNew: boolean; sourceChanged: boolean } {
    const orm = databaseManager.getOrm();
    const existing = this.findByIdentity(input);
    const now = new Date().toISOString();

    if (!existing) {
      const incidentId = id('incident');
      orm
        .insert(incidents)
        .values({
          id: incidentId,
          bcwsIncidentGuid: input.bcwsIncidentGuid,
          fireYear: input.fireYear,
          incidentNumber: input.incidentNumber,
          incidentName: input.incidentName,
          fireCentre: input.fireCentre,
          createdAt: now,
          updatedAt: input.sourceUpdatedAt,
        })
        .run();
      return { incidentId, isNew: true, sourceChanged: true };
    }

    const sourceChanged = existing.updatedAt !== input.sourceUpdatedAt;
    orm
      .update(incidents)
      .set({
        bcwsIncidentGuid: input.bcwsIncidentGuid,
        fireYear: input.fireYear,
        incidentNumber: input.incidentNumber,
        incidentName: input.incidentName,
        fireCentre: input.fireCentre,
        updatedAt: input.sourceUpdatedAt,
      })
      .where(eq(incidents.id, existing.id))
      .run();

    return { incidentId: existing.id, isNew: false, sourceChanged };
  }

  upsertSnapshot(input: SnapshotInput): { inserted: boolean; snapshotId: string | null } {
    const orm = databaseManager.getOrm();
    const snapshotHash = stableHash({
      stageOfControl: input.stageOfControl,
      sizeHa: input.sizeHa,
      discoveryDate: input.discoveryDate,
      causeText: input.causeText,
      resourcesJson: input.resourcesJson,
      locationJson: input.locationJson,
      sourceUpdatedAt: input.sourceUpdatedAt,
    });

    const current = orm
      .select({ id: incidentSnapshots.id, hash: incidentSnapshots.hash })
      .from(incidentSnapshots)
      .where(and(eq(incidentSnapshots.incidentId, input.incidentId), eq(incidentSnapshots.isCurrent, true)))
      .get();

    if (current?.hash === snapshotHash) {
      return { inserted: false, snapshotId: current.id };
    }

    orm
      .update(incidentSnapshots)
      .set({ isCurrent: false })
      .where(and(eq(incidentSnapshots.incidentId, input.incidentId), eq(incidentSnapshots.isCurrent, true)))
      .run();

    const snapshotId = id('snap');
    orm
      .insert(incidentSnapshots)
      .values({
        id: snapshotId,
        incidentId: input.incidentId,
        observedAt: new Date().toISOString(),
        sourceUpdatedAt: input.sourceUpdatedAt,
        stageOfControl: input.stageOfControl,
        sizeHa: input.sizeHa,
        discoveryDate: input.discoveryDate,
        causeText: input.causeText,
        resourcesJson: input.resourcesJson,
        locationJson: input.locationJson,
        hash: snapshotHash,
        isCurrent: true,
      })
      .run();

    return { inserted: true, snapshotId };
  }

  insertOfficialUpdateIfNew(input: UpdateInput): { inserted: boolean; id: string | null } {
    const orm = databaseManager.getOrm();
    const normalized = input.updateText.trim().replace(/\s+/g, ' ');
    if (!normalized) return { inserted: false, id: null };

    const updateHash = stableHash({ incidentId: input.incidentId, updateText: normalized });

    const existing = orm
      .select({ id: incidentUpdates.id })
      .from(incidentUpdates)
      .where(and(eq(incidentUpdates.incidentId, input.incidentId), eq(incidentUpdates.updateHash, updateHash)))
      .get();

    if (existing) return { inserted: false, id: existing.id };

    const rowId = id('upd');
    orm
      .insert(incidentUpdates)
      .values({
        id: rowId,
        incidentId: input.incidentId,
        publishedAt: input.publishedAt,
        observedAt: input.observedAt,
        updateText: normalized,
        updateHash,
        sourceRefId: input.sourceRefId,
      })
      .run();

    return { inserted: true, id: rowId };
  }

  insertAttachmentIfNew(params: {
    incidentId: string;
    sourceAttachmentId: string | null;
    title: string;
    url: string | null;
    localPath: string | null;
    mimeType: string | null;
    observedAt: string;
  }): void {
    const orm = databaseManager.getOrm();
    const dedupeKey = stableHash({
      incidentId: params.incidentId,
      sourceAttachmentId: params.sourceAttachmentId,
      title: params.title,
      url: params.url,
      mimeType: params.mimeType,
    });

    const existing = orm
      .select({ id: incidentAttachments.id })
      .from(incidentAttachments)
      .where(and(eq(incidentAttachments.incidentId, params.incidentId), eq(incidentAttachments.hash, dedupeKey)))
      .get();

    if (existing) return;

    orm
      .insert(incidentAttachments)
      .values({
        id: id('att'),
        incidentId: params.incidentId,
        sourceAttachmentId: params.sourceAttachmentId,
        title: params.title,
        url: params.url,
        localPath: params.localPath,
        mimeType: params.mimeType,
        observedAt: params.observedAt,
        hash: dedupeKey,
      })
      .run();
  }

  insertExternalLinkIfNew(params: {
    incidentId: string;
    category: string | null;
    label: string | null;
    url: string;
    observedAt: string;
  }): void {
    const orm = databaseManager.getOrm();
    const existing = orm
      .select({ id: incidentExternalLinks.id })
      .from(incidentExternalLinks)
      .where(and(eq(incidentExternalLinks.incidentId, params.incidentId), eq(incidentExternalLinks.url, params.url)))
      .get();

    if (existing) return;

    orm
      .insert(incidentExternalLinks)
      .values({
        id: id('link'),
        incidentId: params.incidentId,
        category: params.category,
        label: params.label,
        url: params.url,
        observedAt: params.observedAt,
      })
      .run();
  }

  insertPerimeterIfChanged(params: {
    incidentId: string;
    observedAt: string;
    geometryGeojson: string;
    sourceRefId: string | null;
  }): void {
    const orm = databaseManager.getOrm();
    const geometryHash = stableHash(params.geometryGeojson);

    const latest = orm
      .select({ geometryHash: incidentPerimeters.geometryHash })
      .from(incidentPerimeters)
      .where(eq(incidentPerimeters.incidentId, params.incidentId))
      .orderBy(desc(incidentPerimeters.observedAt))
      .get();

    if (latest?.geometryHash === geometryHash) return;

    orm
      .insert(incidentPerimeters)
      .values({
        id: id('perim'),
        incidentId: params.incidentId,
        observedAt: params.observedAt,
        geometryGeojson: params.geometryGeojson,
        geometryHash,
        sourceRefId: params.sourceRefId,
      })
      .run();
  }

  replaceEvacuationNotices(params: {
    incidentId: string;
    notices: Array<{
      noticeType: string | null;
      status: string | null;
      eventName: string | null;
      issuingAgency: string | null;
      issuedAt: string | null;
      observedAt: string;
      sourceRefId: string | null;
    }>;
  }): void {
    const orm = databaseManager.getOrm();
    orm.delete(evacuationNotices).where(eq(evacuationNotices.incidentId, params.incidentId)).run();

    for (const notice of params.notices) {
      orm
        .insert(evacuationNotices)
        .values({
          id: id('evac'),
          incidentId: params.incidentId,
          noticeType: notice.noticeType,
          status: notice.status,
          eventName: notice.eventName,
          issuingAgency: notice.issuingAgency,
          issuedAt: notice.issuedAt,
          observedAt: notice.observedAt,
          sourceRefId: notice.sourceRefId,
        })
        .run();
    }
  }

  seedIfEmpty(): void {
    const orm = databaseManager.getOrm();
    const count = orm.select({ count: sql<number>`count(*)` }).from(incidents).get();
    if (Number(count?.count ?? 0) > 0) return;

    const incidentId = id('incident');
    const now = new Date().toISOString();

    orm
      .insert(incidents)
      .values({
        id: incidentId,
        bcwsIncidentGuid: 'sample-guid-g70422',
        fireYear: 2024,
        incidentNumber: 'G70422',
        incidentName: 'Kiskatinaw River (Sample)',
        fireCentre: 'Prince George Fire Centre',
        createdAt: now,
        updatedAt: now,
      })
      .run();

    orm
      .insert(incidentSnapshots)
      .values({
        id: id('snap'),
        incidentId,
        observedAt: now,
        sourceUpdatedAt: now,
        stageOfControl: 'OUT_CNTRL',
        sizeHa: 21950,
        discoveryDate: '2024-07-22',
        causeText: 'Under investigation (sample)',
        resourcesJson: JSON.stringify({ personnel: 42, aviation: 2 }),
        locationJson: JSON.stringify({ latitude: 55.02, longitude: -120.17 }),
        hash: id('hash'),
        isCurrent: true,
      })
      .run();

    orm
      .insert(incidentUpdates)
      .values([
        {
          id: id('upd'),
          incidentId,
          publishedAt: now,
          observedAt: now,
          updateText: 'Official update (latest sample): crews continue structure protection and perimeter patrol.',
          updateHash: id('uhash'),
          sourceRefId: null,
        },
        {
          id: id('upd'),
          incidentId,
          publishedAt: new Date(Date.now() - 86_400_000).toISOString(),
          observedAt: new Date(Date.now() - 86_400_000).toISOString(),
          updateText: 'Official update (older sample): smoke impacts expected in nearby areas due to weather shifts.',
          updateHash: id('uhash'),
          sourceRefId: null,
        },
      ])
      .run();

    orm
      .insert(incidentAttachments)
      .values({
        id: id('att'),
        incidentId,
        sourceAttachmentId: 'sample-attachment',
        title: 'Situation Map (Sample)',
        url: 'https://example.invalid/sample-map.pdf',
        localPath: null,
        mimeType: 'application/pdf',
        observedAt: now,
        hash: null,
      })
      .run();
  }
}

export const incidentsRepository = new IncidentsRepository();
export type { IncidentUpsertInput, SnapshotInput, UpdateInput };
