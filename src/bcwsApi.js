const BCWS_API = import.meta.env.DEV
  ? '/bcws-api'
  : 'https://wildfiresituation.nrs.gov.bc.ca';
const BCWS_SITE = import.meta.env.DEV
  ? '/bcws-site'
  : 'https://wildfiresituation.nrs.gov.bc.ca';
const WFNEWS_ARCGIS = import.meta.env.DEV
  ? '/wfnews-arcgis/services6/ubm4tcTYICKBpist/ArcGIS/rest/services'
  : 'https://wfnews-prd.bcwildfireservices.com/services6/ubm4tcTYICKBpist/ArcGIS/rest/services';
export const DASHBOARD_FIRE_YEAR = 2025;
export const ARCHIVAL_FIRE_YEAR = 2025;
export const ARCHIVAL_STAGE_CODES = ['OUT_CNTRL', 'HOLDING', 'UNDR_CNTRL', 'OUT'];

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

const INCIDENT_LIST_ORDER = 'lastUpdatedTimestamp DESC';

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

function toPublicAttachmentUrl(incidentNumberLabel, attachmentGuid, fireYear, thumbnail = false) {
  if (!incidentNumberLabel || !attachmentGuid) return '';
  return `https://wildfiresituation.nrs.gov.bc.ca/wfnews-api/publicPublishedIncidentAttachment/${encodeURIComponent(
    incidentNumberLabel
  )}/attachments/${encodeURIComponent(attachmentGuid)}/bytes?${toQuery({
    fireYear,
    thumbnail: thumbnail ? 'true' : null,
  })}`;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timer);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timer);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyFetchFailure(error, response = null, didTimeout = false) {
  if (didTimeout) {
    return {
      category: 'timeout',
      error: 'Request timed out',
      retryable: true,
    };
  }

  if (response) {
    const code = Number(response.status || 0);
    if (code === 404) {
      return {
        category: 'unavailable',
        error: `${code} ${response.statusText}`,
        retryable: false,
      };
    }
    if (code === 429 || code >= 500) {
      return {
        category: 'http_error',
        error: `${code} ${response.statusText}`,
        retryable: true,
      };
    }
    return {
      category: 'http_error',
      error: `${code} ${response.statusText}`,
      retryable: false,
    };
  }

  if (error instanceof SyntaxError) {
    return {
      category: 'parse_failure',
      error: error.message || 'Failed to parse payload',
      retryable: false,
    };
  }

  const message = error instanceof Error ? error.message || error.name : String(error);
  const lower = message.toLowerCase();
  if (lower.includes('aborted') || lower.includes('aborterror')) {
    return {
      category: 'aborted',
      error: message,
      retryable: true,
    };
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('econn') || lower.includes('socket')) {
    return {
      category: 'network_error',
      error: message,
      retryable: true,
    };
  }
  return {
    category: 'error',
    error: message,
    retryable: false,
  };
}

async function fetchWithRetry(url, mode, options = {}) {
  const {
    timeoutMs = 12000,
    retries = 2,
    backoffMs = 400,
    label = mode,
  } = options;

  let lastFailure = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    let didTimeout = false;
    const timer = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        const failure = classifyFetchFailure(null, response, false);
        failure.httpStatus = Number(response.status || 0);
        failure.attempt = attempt + 1;
        lastFailure = failure;
        if (!failure.retryable || attempt === retries) {
          return {
            ok: false,
            url,
            payload: mode === 'text' ? '' : null,
            status: failure.category,
            error: failure.error,
            attempts: attempt + 1,
            httpStatus: failure.httpStatus || null,
            failureCategory: failure.category,
            label,
          };
        }
        await delay(backoffMs * (attempt + 1));
        continue;
      }

      const payload = mode === 'text' ? await response.text() : await response.json();
      return {
        ok: true,
        url,
        payload,
        status: 'ok',
        error: '',
        attempts: attempt + 1,
        httpStatus: Number(response.status || 200),
        failureCategory: null,
        label,
      };
    } catch (error) {
      const failure = classifyFetchFailure(error, null, didTimeout);
      failure.attempt = attempt + 1;
      lastFailure = failure;
      if (!failure.retryable || attempt === retries) {
        return {
          ok: false,
          url,
          payload: mode === 'text' ? '' : null,
          status: failure.category,
          error: failure.error,
          attempts: attempt + 1,
          httpStatus: null,
          failureCategory: failure.category,
          label,
        };
      }
      await delay(backoffMs * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    url,
    payload: mode === 'text' ? '' : null,
    status: lastFailure?.category || 'error',
    error: lastFailure?.error || 'Unknown fetch failure',
    attempts: lastFailure?.attempt || retries + 1,
    httpStatus: lastFailure?.httpStatus || null,
    failureCategory: lastFailure?.category || 'error',
    label,
  };
}

async function fetchWithTimeout(url, mode, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return mode === 'text' ? response.text() : response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithMeta(url, options = {}) {
  return fetchWithRetry(url, 'json', options);
}

async function fetchTextWithMeta(url, options = {}) {
  return fetchWithRetry(url, 'text', options);
}

function normalizeIncidentRow(row, rawSource = null) {
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
    rawSource,
  };
}

export async function fetchIncidentList({
  search = '',
  fireCentre = '',
  stageCodes = ARCHIVAL_STAGE_CODES,
  includeNewOnly = false,
  fireYear = null,
  pageRowCount = 500,
  pageNumber = 1,
} = {}) {
  const query = toQuery({
    pageNumber,
    pageRowCount,
    stageOfControlList: stageCodes,
    newFires: includeNewOnly,
    fireCentreName: fireCentre || null,
    fireYear: fireYear || null,
    searchText: search || null,
    orderBy: INCIDENT_LIST_ORDER,
  });
  const sourceUrl = `${BCWS_API}/wfnews-api/publicPublishedIncident?${query}`;
  const payload = await fetchJson(sourceUrl);
  const collection = payload.collection || [];
  const rows = collection.map((row) =>
    normalizeIncidentRow(row, {
      url: sourceUrl,
      status: 'ok',
      pageNumber,
      pageRowCount,
      requestedFireYear: fireYear || null,
    })
  );
  return {
    totalRowCount: payload.totalRowCount ?? rows.length,
    endpointRowsFetched: collection.length,
    pageCountFetched: 1,
    pageNumber,
    pageRowCount,
    queryScope: {
      fireYear: fireYear || null,
      fireCentreName: fireCentre || '',
      stageCodes: Array.isArray(stageCodes) ? stageCodes : [],
      searchText: search || '',
      newFires: Boolean(includeNewOnly),
      orderBy: INCIDENT_LIST_ORDER,
      pageRowCount,
    },
    rows,
  };
}

function mergeIncidentResources(primary = {}, fallback = {}) {
  return {
    personnel: Boolean(primary.personnel || fallback.personnel),
    imt: Boolean(primary.imt || fallback.imt),
    aviation: Boolean(primary.aviation || fallback.aviation),
    heavy: Boolean(primary.heavy || fallback.heavy),
    spu: Boolean(primary.spu || fallback.spu),
    personnelCount: primary.personnelCount ?? fallback.personnelCount ?? null,
    imtCount: primary.imtCount ?? fallback.imtCount ?? null,
    aviationCount: primary.aviationCount ?? fallback.aviationCount ?? null,
    heavyCount: primary.heavyCount ?? fallback.heavyCount ?? null,
    spuCount: primary.spuCount ?? fallback.spuCount ?? null,
  };
}

function mergeIncidentRecord(primary = {}, fallback = {}) {
  return {
    ...fallback,
    ...primary,
    resources: mergeIncidentResources(primary.resources || {}, fallback.resources || {}),
    raw: primary.raw ?? fallback.raw ?? null,
    rawSource: primary.rawSource ?? fallback.rawSource ?? null,
  };
}

export async function fetchArchivalIncidentList({
  fireYear = ARCHIVAL_FIRE_YEAR,
  search = '',
  fireCentre = '',
  stageCodes = ARCHIVAL_STAGE_CODES,
  includeNewOnly = false,
  pageRowCount = 200,
  onProgress = null,
} = {}) {
  const requestedFireYear = Number(fireYear || ARCHIVAL_FIRE_YEAR);
  const deduped = new Map();
  let endpointTotalRowCount = 0;
  let endpointRowsFetched = 0;
  let pageCountFetched = 0;
  let endpointRowsMatchingFireYear = 0;
  let endpointFireYearHonored = true;

  for (let pageNumber = 1; ; pageNumber += 1) {
    const page = await fetchIncidentList({
      search,
      fireCentre,
      stageCodes,
      includeNewOnly,
      fireYear: requestedFireYear,
      pageRowCount,
      pageNumber,
    });
    const pageRows = Array.isArray(page.rows) ? page.rows : [];
    pageCountFetched += 1;
    endpointTotalRowCount = Number(page.totalRowCount || endpointTotalRowCount || 0);
    endpointRowsFetched += Number(page.endpointRowsFetched || pageRows.length || 0);

    pageRows.forEach((row) => {
      if (Number(row.fireYear) !== requestedFireYear) {
        endpointFireYearHonored = false;
        return;
      }
      endpointRowsMatchingFireYear += 1;
      const key = `${String(row.fireYear)}:${String(row.incidentNumber)}`;
      if (!deduped.has(key)) {
        deduped.set(key, row);
      }
    });

    if (onProgress) {
      await onProgress({
        fireYear: requestedFireYear,
        pageNumber,
        pageCountFetched,
        endpointTotalRowCount,
        endpointRowsFetched,
        matchingRowsFetched: endpointRowsMatchingFireYear,
      });
    }

    if (!pageRows.length) break;
    if (endpointTotalRowCount > 0 && endpointRowsFetched >= endpointTotalRowCount) break;
    if (pageRows.length < pageRowCount) break;
  }

  const queryScope = {
    fireYear: requestedFireYear,
    fireCentreName: fireCentre || '',
    stageCodes: Array.isArray(stageCodes) ? stageCodes : [],
    searchText: search || '',
    newFires: Boolean(includeNewOnly),
    orderBy: INCIDENT_LIST_ORDER,
    pageRowCount,
    pageCountFetched,
    endpointFireYearHonored,
    clientSideFireYearFilterApplied: !endpointFireYearHonored,
    scopeKind: stageCodes?.length ? 'current-published-stage-filtered' : 'published-result-set',
  };

  return {
    fireYear: requestedFireYear,
    totalRowCount: endpointTotalRowCount,
    endpointRowsFetched,
    endpointRowsMatchingFireYear,
    pageCountFetched,
    rows: Array.from(deduped.values()),
    queryScope,
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
  const payload = await fetchJson(
    `${WFNEWS_ARCGIS}/Evacuation_Orders_and_Alerts/FeatureServer/0/query?${toQuery({
      where: "ORDER_ALERT_STATUS <> 'All Clear' and (EVENT_TYPE = 'Fire' or EVENT_TYPE = 'Wildfire')",
      outFields: '*',
      returnGeometry: false,
      f: 'pjson',
    })}`
  );

  const features = payload.features || [];
  let orders = 0;
  let alerts = 0;

  features.forEach((feature) => {
    const status = String(feature?.attributes?.ORDER_ALERT_STATUS || '').toLowerCase();
    if (status.includes('order')) orders += 1;
    if (status.includes('alert')) alerts += 1;
  });

  return {
    orders,
    alerts,
  };
}

export async function fetchIncidentDetail(fireYear, incidentNumber, seedIncident = null) {
  const incident = seedIncident
    ? seedIncident
    : (
        await fetchArchivalIncidentList({
          fireYear,
          stageCodes: ARCHIVAL_STAGE_CODES,
          pageRowCount: 200,
        })
      ).rows.find(
        (row) => String(row.fireYear) === String(fireYear) && String(row.incidentNumber) === String(incidentNumber)
      );

  if (!incident) {
    throw new Error(`Unable to find incident ${incidentNumber} for ${fireYear}.`);
  }

  const attachmentsUrl = `${BCWS_API}/wfnews-api/publicPublishedIncidentAttachment/${incident.incidentGuid}/attachments`;
  const externalUrl = `${BCWS_API}/wfnews-api/publicExternalUri?${toQuery({
    incidentGuid: incident.incidentGuid,
    pageNumber: 1,
    pageRowCount: 100,
  })}`;
  const detailApiUrl = `${BCWS_API}/wfnews-api/publicPublishedIncident/${incident.incidentGuid}`;
  const responsePageUrl = `${BCWS_SITE}/incidents?${toQuery({ fireYear, incidentNumber, source: 'list' })}`;
  const perimeterUrl = buildPerimeterQueryUrl(incident.incidentNumber);
  const tiedEvacUrl = buildTiedEvacQueryUrl(incident);

  const [detailApiResult, responsePageResult, attachmentsResult, externalResult, perimeterResult, tiedEvacResult] = await Promise.all([
    fetchJsonWithMeta(detailApiUrl, { timeoutMs: 14000, retries: 2, backoffMs: 500, label: 'detail_api' }),
    fetchTextWithMeta(responsePageUrl, { timeoutMs: 14000, retries: 1, backoffMs: 500, label: 'detail_html' }),
    fetchJsonWithMeta(attachmentsUrl, { timeoutMs: 10000, retries: 2, backoffMs: 400, label: 'attachments' }),
    fetchJsonWithMeta(externalUrl, { timeoutMs: 10000, retries: 2, backoffMs: 400, label: 'external_links' }),
    fetchJsonWithMeta(perimeterUrl, { timeoutMs: 12000, retries: 2, backoffMs: 500, label: 'perimeter' }),
    fetchJsonWithMeta(tiedEvacUrl, { timeoutMs: 12000, retries: 1, backoffMs: 500, label: 'tied_evac' }),
  ]);

  const detailPayload = detailApiResult.ok ? detailApiResult.payload : null;
  const normalizedIncident = detailPayload
    ? mergeIncidentRecord(
        normalizeIncidentRow(detailPayload, { url: detailApiUrl, status: detailApiResult.status || 'ok' }),
        incident
      )
    : incident;

  const parsed = mergeIncidentResponse(
    parseIncidentDetailPayload(detailPayload),
    parseIncidentResponsePage(responsePageResult.payload || '')
  );
  const attachments = ((attachmentsResult.payload?.collection) || []).map((item) => ({
    attachmentGuid: item.attachmentGuid,
    title: item.attachmentTitle || item.fileName || 'Untitled asset',
    description: item.attachmentDescription,
    fileName: item.fileName || item.attachmentTitle || '',
    downloadUrl: toPublicAttachmentUrl(incident.incidentNumber, item.attachmentGuid, fireYear, false),
    imageUrl: String(item.mimeType || '').toLowerCase().startsWith('image/')
      ? toPublicAttachmentUrl(incident.incidentNumber, item.attachmentGuid, fireYear, false)
      : '',
    thumbnailUrl: String(item.mimeType || '').toLowerCase().startsWith('image/')
      ? toPublicAttachmentUrl(incident.incidentNumber, item.attachmentGuid, fireYear, true)
      : '',
    mimeType: item.mimeType,
    uploadedTimestamp: item.uploadedTimestamp,
  }));
  const externalLinks = ((externalResult.payload?.collection) || []).map((item) => ({
    id: item.externalUriGuid,
    category: item.externalUriCategoryTag,
    label: item.externalUriDisplayLabel,
    url: item.externalUri,
  }));
  const perimeterData = perimeterResult.ok ? perimeterResult.payload : null;
  const tiedEvac = parseTiedEvacPayload(tiedEvacResult.ok ? tiedEvacResult.payload : null);

  return {
    incident: normalizedIncident,
    response: parsed,
    attachments,
    externalLinks,
    perimeterData,
    tiedEvac,
    rawSources: {
      attachments: attachmentsResult,
      external: externalResult,
      detailApi: detailApiResult,
      responsePage: responsePageResult,
      perimeter: perimeterResult,
      tiedEvac: tiedEvacResult,
    },
  };
}

function buildPerimeterQueryUrl(fireNumber) {
  const where = `FIRE_NUMBER='${String(fireNumber).replace(/'/g, "''")}'`;
  return `${WFNEWS_ARCGIS}/BCWS_FirePerimeters_PublicView/FeatureServer/0/query?${toQuery({
    where,
    outFields: '*',
    returnGeometry: true,
    outSR: 4326,
    f: 'geojson',
  })}`;
}

async function fetchPerimeterByFireNumber(fireNumber) {
  return fetchJson(buildPerimeterQueryUrl(fireNumber));
}

function buildTiedEvacQueryUrl(incident) {
  const { xmin, ymin, xmax, ymax } = buildEnvelopeForIncident(incident);
  return `${WFNEWS_ARCGIS}/Evacuation_Orders_and_Alerts/FeatureServer/0/query?${toQuery({
    returnGeometry: false,
    where: "ORDER_ALERT_STATUS <> 'All Clear' and (EVENT_TYPE = 'Fire' or EVENT_TYPE = 'Wildfire')",
    outFields: '*',
    inSR: 4326,
    outSR: 4326,
    geometry: JSON.stringify({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    f: 'pjson',
  })}`;
}

function parseTiedEvacPayload(payload) {
  if (!payload || !Array.isArray(payload.features)) {
    return { orders: [], alerts: [] };
  }

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

async function fetchTiedEvacuations(incident) {
  const payload = await fetchJson(buildTiedEvacQueryUrl(incident));
  return parseTiedEvacPayload(payload);
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

function decodeHtml(html) {
  if (!html || typeof DOMParser === 'undefined') return String(html || '');
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  return doc.documentElement.textContent || '';
}

function toPlainText(value) {
  return decodeHtml(String(value || '')).replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function extractOverviewUpdates(overviewHtml) {
  if (!overviewHtml || typeof DOMParser === 'undefined') {
    return [];
  }

  const doc = new DOMParser().parseFromString(`<div id="overview-root">${overviewHtml}</div>`, 'text/html');
  const root = doc.getElementById('overview-root');
  if (!root) return [];

  const blocks = [];
  root.childNodes.forEach((node) => {
    const text = toPlainText(node.textContent || '');
    if (text) blocks.push(text);
  });
  if (!blocks.length) return [];

  const updates = [];
  let current = [];
  const flush = () => {
    const text = current.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (text) updates.push(text);
    current = [];
  };

  blocks.forEach((block) => {
    if (/^updated\b/i.test(block)) {
      flush();
    }
    current.push(block);
  });
  flush();
  return updates;
}

function buildResourcesAssignedText(detailPayload) {
  const detailed = [
    detailPayload?.resourceDetail,
    detailPayload?.wildfireCrewResourcesDetail,
    detailPayload?.incidentMgmtCrewRsrcDetail,
    detailPayload?.wildfireAviationResourceDetail,
    detailPayload?.heavyEquipmentResourcesDetail,
    detailPayload?.structureProtectionRsrcDetail,
  ]
    .map((value) => toPlainText(value))
    .filter(Boolean);

  return detailed.length ? detailed.join('\n\n') : '';
}

function parseIncidentDetailPayload(detailPayload) {
  if (!detailPayload) {
    return {
      responseUpdates: [],
      evacuationsText: '',
      suspectedCauseText: '',
      resourcesAssignedText: '',
      mapMessage: '',
      sourceKind: 'none',
    };
  }

  return {
    responseUpdates: extractOverviewUpdates(detailPayload.incidentOverview),
    evacuationsText: '',
    suspectedCauseText: toPlainText(detailPayload.incidentCauseDetail),
    resourcesAssignedText: buildResourcesAssignedText(detailPayload),
    mapMessage: '',
    sourceKind: detailPayload.incidentOverview ? 'detail-api-incidentOverview' : 'detail-api-fields',
  };
}

function parseIncidentResponsePage(html) {
  if (!html || typeof DOMParser === 'undefined') {
    return {
      responseUpdates: [],
      evacuationsText: '',
      suspectedCauseText: '',
      resourcesAssignedText: '',
      mapMessage: '',
      sourceKind: 'none',
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
    sourceKind: responseUpdates.length ? 'response-page-html' : 'response-page-shell',
  };
}

function mergeIncidentResponse(detailResponse, pageResponse) {
  return {
    responseUpdates: detailResponse.responseUpdates.length
      ? detailResponse.responseUpdates
      : pageResponse.responseUpdates,
    evacuationsText: detailResponse.evacuationsText || pageResponse.evacuationsText || '',
    suspectedCauseText: detailResponse.suspectedCauseText || pageResponse.suspectedCauseText || '',
    resourcesAssignedText: detailResponse.resourcesAssignedText || pageResponse.resourcesAssignedText || '',
    mapMessage: detailResponse.mapMessage || pageResponse.mapMessage || '',
    sourceKind:
      detailResponse.responseUpdates.length ||
      detailResponse.suspectedCauseText ||
      detailResponse.resourcesAssignedText
        ? detailResponse.sourceKind
        : pageResponse.sourceKind,
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




