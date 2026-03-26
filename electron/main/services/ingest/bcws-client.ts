import { URLSearchParams } from 'node:url';

const BCWS_API = 'https://wildfiresituation.nrs.gov.bc.ca';
const WFNEWS_ARCGIS = 'https://wfnews-prd.bcwildfireservices.com/services6/ubm4tcTYICKBpist/ArcGIS/rest/services';

type IncidentListRow = {
  incidentGuid: string | null;
  incidentNumber: string;
  fireYear: number;
  incidentName: string;
  fireCentre: string | null;
  stageOfControl: string | null;
  sizeHa: number | null;
  discoveryDate: string | null;
  updatedAt: string;
  causeText: string | null;
  latitude: number | null;
  longitude: number | null;
  resources: Record<string, unknown>;
  responseTypeDetail: string | null;
};

type IncidentDetailPayload = {
  attachments: Array<{
    attachmentGuid: string | null;
    title: string;
    description: string | null;
    imageUrl: string | null;
    mimeType: string | null;
  }>;
  externalLinks: Array<{
    id: string | null;
    category: string | null;
    label: string | null;
    url: string;
  }>;
  perimeterData: unknown | null;
  evacuation: {
    orders: Array<Record<string, unknown>>;
    alerts: Array<Record<string, unknown>>;
  };
  incidentHtml: string;
  officialUpdateCandidates: string[];
};

function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        sp.append(key, String(item));
      }
      continue;
    }
    sp.append(key, String(value));
  }
  return sp.toString();
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
  }
  return response.text();
}

function normalizeListRow(row: Record<string, unknown>): IncidentListRow {
  return {
    incidentGuid: (row.incidentGuid as string) || null,
    incidentNumber: String(row.incidentNumberLabel || row.incidentNumber || ''),
    fireYear: Number(row.fireYear || new Date().getFullYear()),
    incidentName: String(row.incidentName || 'Unnamed Incident'),
    fireCentre: row.fireCentreName ? String(row.fireCentreName) : null,
    stageOfControl: row.stageOfControlCode ? String(row.stageOfControlCode) : null,
    sizeHa: row.incidentSizeEstimatedHa ? Number(row.incidentSizeEstimatedHa) : row.incidentSizeMappedHa ? Number(row.incidentSizeMappedHa) : null,
    discoveryDate: row.discoveryDate ? new Date(Number(row.discoveryDate)).toISOString() : null,
    updatedAt: new Date(Number(row.lastUpdatedTimestamp || row.updateDate || Date.now())).toISOString(),
    causeText: row.incidentCauseDetail ? String(row.incidentCauseDetail) : null,
    latitude: row.latitude !== undefined ? Number(row.latitude) : null,
    longitude: row.longitude !== undefined ? Number(row.longitude) : null,
    resources: {
      personnel: Boolean(row.wildfireCrewResourcesInd),
      imt: Boolean(row.incidentMgmtCrewRsrcInd),
      aviation: Boolean(row.wildfireAviationResourceInd),
      heavy: Boolean(row.heavyEquipmentResourcesInd),
      spu: Boolean(row.structureProtectionRsrcInd),
      personnelCount: Number(row.crewResourceCount || 0),
      imtCount: Number(row.incidentManagementResourceCount || 0),
      aviationCount: Number(row.aviationResourceCount || 0),
      heavyCount: Number(row.heavyEquipmentResourceCount || 0),
      spuCount: Number(row.structureProtectionResourceCount || 0),
    },
    responseTypeDetail: row.responseTypeDetail ? String(row.responseTypeDetail) : null,
  };
}

async function fetchIncidentList(pageRowCount = 1000): Promise<IncidentListRow[]> {
  const query = toQuery({
    pageNumber: 1,
    pageRowCount,
    stageOfControlList: ['OUT_CNTRL', 'HOLDING', 'UNDR_CNTRL', 'OUT', 'FIRE_OF_NOTE'],
    orderBy: 'lastUpdatedTimestamp DESC',
  });

  const payload = (await fetchJson(`${BCWS_API}/wfnews-api/publicPublishedIncident?${query}`)) as {
    collection?: Record<string, unknown>[];
  };

  return (payload.collection || []).map(normalizeListRow).filter((row) => row.incidentNumber);
}

async function fetchIncidentDetail(row: IncidentListRow): Promise<IncidentDetailPayload> {
  const [attachmentsPayload, externalPayload, incidentHtml, perimeterData, evacuationPayload, detailRecord] = await Promise.all([
    fetchJson(`${BCWS_API}/wfnews-api/publicPublishedIncidentAttachment/${row.incidentGuid}/attachments`).catch(() => ({ collection: [] })),
    fetchJson(`${BCWS_API}/wfnews-api/publicExternalUri?${toQuery({ incidentGuid: row.incidentGuid, pageNumber: 1, pageRowCount: 100 })}`).catch(() => ({ collection: [] })),
    fetchText(`${BCWS_API}/incidents?${toQuery({ fireYear: row.fireYear, incidentNumber: row.incidentNumber, source: 'list' })}`).catch(() => ''),
    fetchPerimeterByFireNumber(row.incidentNumber).catch(() => null),
    fetchTiedEvacuations(row).catch(() => ({ orders: [], alerts: [] })),
    fetchJson(`${BCWS_API}/wfnews-api/publicPublishedIncident/${row.incidentGuid}`).catch(() => null),
  ]);

  const attachments = ((attachmentsPayload as { collection?: Record<string, unknown>[] }).collection || []).map((item) => ({
    attachmentGuid: (item.attachmentGuid as string) || null,
    title: String(item.attachmentTitle || item.fileName || 'Untitled asset'),
    description: item.attachmentDescription ? String(item.attachmentDescription) : null,
    imageUrl: item.imageURL ? `${BCWS_API}${String(item.imageURL)}` : null,
    mimeType: item.mimeType ? String(item.mimeType) : null,
  }));

  const externalLinks = ((externalPayload as { collection?: Record<string, unknown>[] }).collection || [])
    .map((item) => ({
      id: (item.externalUriGuid as string) || null,
      category: item.externalUriCategoryTag ? String(item.externalUriCategoryTag) : null,
      label: item.externalUriDisplayLabel ? String(item.externalUriDisplayLabel) : null,
      url: String(item.externalUri || ''),
    }))
    .filter((item) => item.url);

  const detailObj = (detailRecord || {}) as Record<string, unknown>;
  const officialUpdateCandidates = [
    row.responseTypeDetail || '',
    detailObj.responseTypeDetail ? String(detailObj.responseTypeDetail) : '',
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    attachments,
    externalLinks,
    perimeterData,
    evacuation: evacuationPayload,
    incidentHtml,
    officialUpdateCandidates,
  };
}

async function fetchPerimeterByFireNumber(fireNumber: string): Promise<unknown> {
  const where = `FIRE_NUMBER='${String(fireNumber).replace(/'/g, "''")}'`;
  return fetchJson(
    `${WFNEWS_ARCGIS}/BCWS_FirePerimeters_PublicView/FeatureServer/0/query?${toQuery({
      where,
      outFields: '*',
      returnGeometry: true,
      outSR: 4326,
      f: 'geojson',
    })}`
  );
}

async function fetchTiedEvacuations(row: IncidentListRow): Promise<{ orders: Array<Record<string, unknown>>; alerts: Array<Record<string, unknown>> }> {
  const lon = Number(row.longitude || -123.5);
  const lat = Number(row.latitude || 54);
  const delta = 0.45;
  const geometry = {
    xmin: lon - delta,
    ymin: lat - delta,
    xmax: lon + delta,
    ymax: lat + delta,
    spatialReference: { wkid: 4326 },
  };

  const payload = (await fetchJson(
    `${WFNEWS_ARCGIS}/Evacuation_Orders_and_Alerts/FeatureServer/0/query?${toQuery({
      returnGeometry: false,
      where: "ORDER_ALERT_STATUS <> 'All Clear' and (EVENT_TYPE = 'Fire' or EVENT_TYPE = 'Wildfire')",
      outFields: '*',
      inSR: 4326,
      outSR: 4326,
      geometry: JSON.stringify(geometry),
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects',
      f: 'pjson',
    })}`
  )) as { features?: Array<{ attributes?: Record<string, unknown> }> };

  const orders: Array<Record<string, unknown>> = [];
  const alerts: Array<Record<string, unknown>> = [];

  for (const feature of payload.features || []) {
    const attrs = feature.attributes || {};
    const status = String(attrs.ORDER_ALERT_STATUS || '');
    const rowData = {
      noticeType: status.toLowerCase().includes('order') ? 'order' : 'alert',
      status,
      eventName: String(attrs.EVENT_NAME || attrs.AREA_DESCRIPTION || attrs.EVENT_TYPE || 'Unnamed notice'),
      issuingAgency: String(attrs.ISSUING_AGENCY || ''),
      issuedAt: attrs.ISSUE_DATE ? new Date(Number(attrs.ISSUE_DATE)).toISOString() : null,
    };
    if (status.toLowerCase().includes('order')) orders.push(rowData);
    else if (status.toLowerCase().includes('alert')) alerts.push(rowData);
  }

  return { orders, alerts };
}

export const bcwsClient = {
  fetchIncidentList,
  fetchIncidentDetail,
};

export type { IncidentListRow, IncidentDetailPayload };
