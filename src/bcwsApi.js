const BCWS_API = '/bcws-api';
const BCWS_SITE = '/bcws-site';
const DASHBOARD_EVACUATION_API = '/arcgis/evacuation';
const WFNEWS_ARCGIS = '/wfnews-arcgis/services6/ubm4tcTYICKBpist/ArcGIS/rest/services';
export const DASHBOARD_FIRE_YEAR = 2025;

export const STAGE_DEFS = {
  FIRE_OF_NOTE: { label: 'Wildfire of Note', color: '#c01855' },
  OUT_CNTRL: { label: 'Out of Control', color: '#ef3b2c' },
  HOLDING: { label: 'Being Held', color: '#dccb4d' },
  UNDR_CNTRL: { label: 'Under Control', color: '#44c776' },
  OUT: { label: 'Out', color: '#38422f' },
};

export const FIRE_CENTRES = [
  'Cariboo Fire Centre',
  'Coastal Fire Centre',
  'Kamloops Fire Centre',
  'Northwest Fire Centre',
  'Prince George Fire Centre',
  'Southeast Fire Centre',
];

function toQuery(params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => sp.append(key, item));
      return;
    }
    sp.append(key, value);
  });
  return sp.toString();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
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
    responseTypeCode: row.responseTypeCode,
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

export async function fetchIncidentList({
  search = '',
  fireCentre = '',
  stageCodes = ['OUT_CNTRL', 'HOLDING', 'UNDR_CNTRL', 'OUT'],
  includeNewOnly = false,
  pageRowCount = 500,
} = {}) {
  const query = toQuery({
    pageNumber: 1,
    pageRowCount,
    stageOfControlList: stageCodes,
    newFires: includeNewOnly,
    fireCentreName: fireCentre || null,
    searchText: search || null,
    orderBy: 'lastUpdatedTimestamp DESC',
  });

  const payload = await fetchJson(`${BCWS_API}/wfnews-api/publicPublishedIncident?${query}`);
  const rows = (payload.collection || []).map(normalizeIncidentRow);
  return {
    totalRowCount: payload.totalRowCount ?? rows.length,
    rows,
  };
}

export async function fetchStatistics(fireCentre = 'BC', fireYear = new Date().getFullYear()) {
  const list = await fetchJson(
    `${BCWS_API}/wfnews-api/statistics?${toQuery({ fireYear, fireCentre })}`
  );
  return Array.isArray(list) ? list[0] ?? null : null;
}

export async function fetchDashboardData() {
  const fireYear = DASHBOARD_FIRE_YEAR;
  const [stats, fireCentreStats, fireOfNote, outCntrl, holding, underControl, evacuations] =
    await Promise.all([
      fetchStatistics('BC', fireYear),
      Promise.all(FIRE_CENTRES.map((name) => fetchStatistics(name, fireYear))),
      fetchStageFeatures('FIRE_OF_NOTE'),
      fetchStageFeatures('OUT_CNTRL'),
      fetchStageFeatures('HOLDING'),
      fetchStageFeatures('UNDR_CNTRL'),
      fetchEvacuationSummary(),
    ]);

  return {
    fireYear,
    stats: stats ?? null,
    fireCentreStats: fireCentreStats.filter(Boolean),
    mapLayers: {
      FIRE_OF_NOTE: fireOfNote.features || [],
      OUT_CNTRL: outCntrl.features || [],
      HOLDING: holding.features || [],
      UNDR_CNTRL: underControl.features || [],
    },
    evacuations,
  };
}

export async function fetchStageFeatures(stageCode) {
  return fetchJson(`${BCWS_API}/wfnews-api/publicPublishedIncident/features?stageOfControl=${stageCode}`);
}

export async function fetchEvacuationSummary() {
  const [ordersPayload, alertsPayload] = await Promise.all([
    fetchJson(
      `${DASHBOARD_EVACUATION_API}/FeatureServer/0/query?${toQuery({
        where: "ORDER_ALERT_STATUS='Order'",
        returnCountOnly: true,
        f: 'json',
      })}`
    ),
    fetchJson(
      `${DASHBOARD_EVACUATION_API}/FeatureServer/0/query?${toQuery({
        where: "ORDER_ALERT_STATUS='Alert'",
        returnCountOnly: true,
        f: 'json',
      })}`
    ),
  ]);

  return {
    orders: Number(ordersPayload.count ?? 0),
    alerts: Number(alertsPayload.count ?? 0),
  };
}

export async function fetchIncidentDetail(fireYear, incidentNumber) {
  const { rows } = await fetchIncidentList({ pageRowCount: 1000 });
  const incident = rows.find(
    (row) => String(row.fireYear) === String(fireYear) && String(row.incidentNumber) === String(incidentNumber)
  );

  if (!incident) {
    throw new Error(`Unable to find incident ${incidentNumber} for ${fireYear}.`);
  }

  const [attachmentsPayload, externalPayload, responsePageHtml, perimeterData, tiedEvac] =
    await Promise.all([
      fetchJson(`${BCWS_API}/wfnews-api/publicPublishedIncidentAttachment/${incident.incidentGuid}/attachments`).catch(() => ({ collection: [] })),
      fetchJson(`${BCWS_API}/wfnews-api/publicExternalUri?${toQuery({ incidentGuid: incident.incidentGuid, pageNumber: 1, pageRowCount: 100 })}`).catch(() => ({ collection: [] })),
      fetchText(`${BCWS_SITE}/incidents?${toQuery({ fireYear, incidentNumber, source: 'list' })}`).catch(() => ''),
      fetchPerimeterByFireNumber(incident.incidentNumber).catch(() => null),
      fetchTiedEvacuations(incident).catch(() => ({ orders: [], alerts: [] })),
    ]);

  const parsed = parseIncidentResponsePage(responsePageHtml);
  const attachments = (attachmentsPayload.collection || []).map((item) => ({
    attachmentGuid: item.attachmentGuid,
    title: item.attachmentTitle || item.fileName || 'Untitled asset',
    description: item.attachmentDescription,
    imageUrl: item.imageURL ? `https://wildfiresituation.nrs.gov.bc.ca${item.imageURL}` : '',
    mimeType: item.mimeType,
    uploadedTimestamp: item.uploadedTimestamp,
  }));
  const externalLinks = (externalPayload.collection || []).map((item) => ({
    id: item.externalUriGuid,
    category: item.externalUriCategoryTag,
    label: item.externalUriDisplayLabel,
    url: item.externalUri,
  }));

  return {
    incident,
    response: parsed,
    attachments,
    externalLinks,
    perimeterData,
    tiedEvac,
  };
}

async function fetchPerimeterByFireNumber(fireNumber) {
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

async function fetchTiedEvacuations(incident) {
  const { xmin, ymin, xmax, ymax } = buildEnvelopeForIncident(incident);
  const payload = await fetchJson(
    `${WFNEWS_ARCGIS}/Evacuation_Orders_and_Alerts/FeatureServer/0/query?${toQuery({
      returnGeometry: false,
      where: "ORDER_ALERT_STATUS <> 'All Clear' and (EVENT_TYPE = 'Fire' or EVENT_TYPE = 'Wildfire')",
      outFields: '*',
      inSR: 4326,
      outSR: 4326,
      geometry: JSON.stringify({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } }),
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects',
      f: 'pjson',
    })}`
  );

  const orders = [];
  const alerts = [];
  (payload.features || []).forEach((feature) => {
    const attrs = feature.attributes || {};
    const row = {
      status: attrs.ORDER_ALERT_STATUS || '',
      eventName: attrs.EVENT_NAME || attrs.AREA_DESCRIPTION || attrs.EVENT_TYPE || 'Unnamed notice',
      issuingAgency: attrs.ISSUING_AGENCY || '',
      issuedAt: attrs.ISSUE_DATE || attrs.NEWS_CREATED_TIMESTAMP || null,
    };
    const lower = String(row.status).toLowerCase();
    if (lower.includes('order')) orders.push(row);
    else if (lower.includes('alert')) alerts.push(row);
  });
  return { orders, alerts };
}

function buildEnvelopeForIncident(incident) {
  const lon = Number(incident.longitude || -123.5);
  const lat = Number(incident.latitude || 54);
  const delta = 0.45;
  return {
    xmin: lon - delta,
    ymin: lat - delta,
    xmax: lon + delta,
    ymax: lat + delta,
  };
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function parseIncidentResponsePage(html) {
  if (!html || typeof DOMParser === 'undefined') {
    return {
      responseUpdates: [],
      evacuationsText: '',
      suspectedCauseText: '',
      resourcesAssignedText: '',
      mapMessage: '',
    };
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');

  const extractSections = (title) => {
    const matches = [...doc.querySelectorAll('h1,h2,h3,h4,h5,button,span,strong,div,p')].filter(
      (node) => normalizeText(node.textContent) === normalizeText(title)
    );

    const sections = [];
    const seen = new Set();
    matches.forEach((match) => {
      let card = match;
      for (let hop = 0; hop < 5 && card; hop += 1) {
        const text = String(card.textContent || '').trim();
        if (text.length > title.length + 8 && text.length < 8000) break;
        card = card.parentElement;
      }
      if (!card) return;
      const text = String(card.innerText || card.textContent || '').trim();
      const cleaned = text.replace(new RegExp(`^${title}`, 'i'), '').trim();
      if (!cleaned) return;
      if (seen.has(cleaned)) return;
      seen.add(cleaned);
      sections.push(cleaned);
    });
    return sections;
  };

  const responseUpdates = extractSections('Response Update');
  const evacuationsText = extractSections('Evacuations')[0] || '';
  const suspectedCauseText = extractSections('Suspected Cause')[0] || '';
  const resourcesAssignedText = extractSections('Resources Assigned')[0] || '';
  const mapMessage = extractSections('Map Downloads')[0] || '';

  return {
    responseUpdates,
    evacuationsText,
    suspectedCauseText,
    resourcesAssignedText,
    mapMessage,
  };
}

export function stageLabel(code) {
  return STAGE_DEFS[code]?.label || code || 'Unknown';
}

export function formatDate(value) {
  if (!value) return '--';
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}



