const SOURCE_URL =
  'https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/BCWS_FirePerimeters_PublicView/FeatureServer/0';

function buildUrl(path = '', params = {}) {
  const search = new URLSearchParams(params);
  return `${SOURCE_URL}${path}${search.size ? `?${search.toString()}` : ''}`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  const text = await response.text();
  let data = null;

  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  if (data?.error) {
    const code = data.error.code ? ` ${data.error.code}` : '';
    const message = data.error.message ? ` ${data.error.message}` : '';
    throw new Error(`Service error${code}${message}`.trim());
  }

  return {
    status: response.status,
    data,
  };
}

export async function fetchBcwsPerimeterWidget() {
  const fetchedAt = new Date().toISOString();

  const metadata = await fetchJson(buildUrl('', { f: 'pjson' }));
  const count = await fetchJson(
    buildUrl('/query', {
      where: '1=1',
      returnCountOnly: 'true',
      f: 'pjson',
    })
  );
  const specimen = await fetchJson(
    buildUrl('/query', {
      where: '1=1',
      outFields: 'FIRE_NUMBER,FIRE_STATUS,FIRE_SIZE_HECTARES,FIRE_URL,TRACK_DATE',
      resultRecordCount: '5',
      returnGeometry: 'false',
      f: 'pjson',
    })
  );

  return {
    sourceUrl: SOURCE_URL,
    fetchedAt,
    metadataStatus: metadata.status,
    countStatus: count.status,
    specimenStatus: specimen.status,
    layerName: metadata.data?.name ?? '',
    geometryType: metadata.data?.geometryType ?? '',
    capabilities: metadata.data?.capabilities ?? '',
    objectCount: count.data?.count ?? null,
    fields: (metadata.data?.fields ?? []).map((field) => field.name),
    specimen: specimen.data ?? null,
  };
}
