import 'fake-indexeddb/auto';
import {
  captureIncidentDetailResult,
  captureIncidentListResult,
} from '../src/localCapture.js';

function toQuery(params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    sp.append(key, value);
  });
  return sp.toString();
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeIncidentRow(row) {
  return {
    incidentGuid: row.incidentGuid,
    publishedIncidentDetailGuid: row.publishedIncidentDetailGuid,
    incidentNumber: row.incidentNumberLabel,
    fireYear: row.fireYear,
    incidentName: row.incidentName,
    location: row.incidentLocation,
    fireCentre: row.fireCentreName,
    stage: row.stageOfControlCode,
    fireOfNote: Boolean(row.fireOfNoteInd),
    discoveryDate: row.discoveryDate,
    updatedDate: row.lastUpdatedTimestamp || row.updateDate,
    sizeHa: row.incidentSizeEstimatedHa ?? row.incidentSizeMappedHa,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    causeDetail: row.incidentCauseDetail,
    responseTypeDetail: row.responseTypeDetail,
    incidentOverview: row.incidentOverview,
    resources: {
      personnel: Boolean(row.wildfireCrewResourcesInd),
      imt: Boolean(row.incidentMgmtCrewRsrcInd),
      aviation: Boolean(row.wildfireAviationResourceInd),
      heavy: Boolean(row.heavyEquipmentResourcesInd),
      spu: Boolean(row.structureProtectionRsrcInd),
      personnelCount: row.crewResourceCount,
      imtCount: row.incidentManagementResourceCount,
      aviationCount: row.aviationResourceCount,
      heavyCount: row.heavyEquipmentResourceCount,
      spuCount: row.structureProtectionResourceCount,
    },
    raw: row,
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

async function run() {
  const apiBase = 'https://wildfiresituation.nrs.gov.bc.ca';
  const listUrl = `${apiBase}/wfnews-api/publicPublishedIncident?${toQuery({
    pageNumber: 1,
    pageRowCount: 2000,
    orderBy: 'lastUpdatedTimestamp DESC',
  })}`;
  const listPayload = await fetchJson(listUrl);
  const targetRaw = (listPayload.collection || []).find((row) => row.incidentNumberLabel === 'G70422');
  if (!targetRaw) throw new Error('G70422 not found in list payload');
  const incident = normalizeIncidentRow(targetRaw);

  const listCapture = await captureIncidentListResult({
    rows: [incident],
    requestUrl: listUrl,
    rawPayload: { collection: [targetRaw] },
  });

  const detailUrl = `${apiBase}/wfnews-api/publicPublishedIncident/G70422?fireYear=2025`;
  const detailPayload = await fetchJson(detailUrl);
  const detailIncident = normalizeIncidentRow(detailPayload);
  const overviewText = htmlToText(detailPayload.incidentOverview);
  if (!overviewText) throw new Error('incidentOverview text is empty for G70422');

  const attachmentsPayload = await fetchJson(
    `${apiBase}/wfnews-api/publicPublishedIncidentAttachment/${detailIncident.incidentGuid}/attachments`
  ).catch(() => ({ collection: [] }));

  const capture1 = await captureIncidentDetailResult({
    incident: detailIncident,
    response: { responseUpdates: [overviewText] },
    responsePageHtml: '',
    requestContext: { detailUrl, enrichmentUrl: '' },
    attachmentsPayload,
    externalPayload: { collection: [] },
    perimeterData: null,
    tiedEvac: { orders: [], alerts: [] },
  });

  await new Promise((resolve) => setTimeout(resolve, 5));
  const capture2 = await captureIncidentDetailResult({
    incident: detailIncident,
    response: { responseUpdates: [overviewText, `${overviewText}\n\n[validation revision marker]`] },
    responsePageHtml: '',
    requestContext: { detailUrl, enrichmentUrl: '' },
    attachmentsPayload,
    externalPayload: { collection: [] },
    perimeterData: null,
    tiedEvac: { orders: [], alerts: [] },
  });

  const localUpdates = capture2.localOfficialUpdates || [];
  const newest = localUpdates[0]?.updateText || '';
  const orderingOk = newest.includes('[validation revision marker]');

  console.log(JSON.stringify({
    incident: detailIncident.incidentNumber,
    listCapture,
    capture1: {
      updateCount: capture1.updateCount,
      recordCounts: capture1.recordCounts,
      capturedAt: capture1.capturedAt,
    },
    capture2: {
      updateCount: capture2.updateCount,
      recordCounts: capture2.recordCounts,
      capturedAt: capture2.capturedAt,
    },
    localUpdatePreview: localUpdates.map((item) => ({
      observedAt: item.observedAt,
      updateHash: item.updateHash?.slice(0, 12),
      startsWith: item.updateText?.slice(0, 72),
    })),
    orderingOk,
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
