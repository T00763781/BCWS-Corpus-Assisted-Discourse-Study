export const appRoutes = [
  { id: 'dashboard', label: 'Dashboard', pageId: 'dashboard' },
  { id: 'weather', label: 'Weather', pageId: 'weather' },
  { id: 'incidents', label: 'Incidents', pageId: 'incidents' },
  { id: 'discourse', label: 'Discourse', pageId: 'discourse' },
  { id: 'maps', label: 'Maps', pageId: 'maps' },
  { id: 'configure', label: 'Configure' },
];

export const pageBuilderTabs = [
  { id: 'dashboard', label: 'Dashboard', pageId: 'dashboard' },
  { id: 'weather', label: 'Weather', pageId: 'weather' },
  { id: 'incidents', label: 'Incidents', pageId: 'incidents' },
  { id: 'discourse', label: 'Discourse', pageId: 'discourse' },
  { id: 'maps', label: 'Maps', pageId: 'maps' },
];

export const configureTabs = [
  { id: 'sources', label: 'Sources' },
  { id: 'widgets', label: 'Widgets' },
  ...pageBuilderTabs.map((tab) => ({ id: tab.id, label: tab.label, pageId: tab.pageId })),
];

export const widgetDefinitions = [
  {
    widget_id: 'bcws_perimeter_layer_candidate',
    label: 'Perimeter map layer',
    source_ids: ['bcws_map', 'bcws_dashboard', 'bcws_list'],
    status: 'configure_sources_only',
    render_type: 'bcws_perimeter_layer',
    allowed_pages: [],
    allowed_config_tabs: ['sources', 'widgets'],
    fetch_mode: 'live_arcgis_feature_layer',
    notes:
      'Implemented only in Configure > Sources. Not approved for promotion to Dashboard, Incidents, or Maps yet.',
  },
  {
    widget_id: 'bcws_road_safety_overlay_candidate',
    label: 'Road-safety overlay',
    source_ids: ['bcws_map', 'bcws_dashboard'],
    status: 'candidate_only',
    render_type: 'candidate_only',
    allowed_pages: ['maps'],
    allowed_config_tabs: ['widgets'],
    fetch_mode: 'verified_arcgis_feature_layer',
    notes: 'Candidate-only.',
  },
  {
    widget_id: 'bcws_recreation_closures_overlay_candidate',
    label: 'Recreation closures overlay',
    source_ids: ['bcws_map', 'bcws_dashboard'],
    status: 'candidate_only',
    render_type: 'candidate_only',
    allowed_pages: ['maps'],
    allowed_config_tabs: ['widgets'],
    fetch_mode: 'verified_arcgis_feature_layer',
    notes: 'Candidate-only.',
  },
  {
    widget_id: 'bcws_incident_totals_candidate',
    label: 'Incident totals',
    source_ids: ['bcws_dashboard', 'bcws_list'],
    status: 'candidate_only',
    render_type: 'candidate_only',
    allowed_pages: ['dashboard'],
    allowed_config_tabs: ['widgets'],
    fetch_mode: 'unresolved_data_contract',
    notes: 'Candidate-only.',
  },
  {
    widget_id: 'bcws_stage_of_control_counts_candidate',
    label: 'Stage-of-control counts',
    source_ids: ['bcws_dashboard'],
    status: 'candidate_only',
    render_type: 'candidate_only',
    allowed_pages: ['dashboard'],
    allowed_config_tabs: ['widgets'],
    fetch_mode: 'unresolved_data_contract',
    notes: 'Candidate-only.',
  },
  {
    widget_id: 'bcws_incident_list_table_candidate',
    label: 'Incident list table',
    source_ids: ['bcws_list'],
    status: 'candidate_only',
    render_type: 'candidate_only',
    allowed_pages: ['incidents'],
    allowed_config_tabs: ['widgets'],
    fetch_mode: 'unresolved_data_contract',
    notes: 'Candidate-only.',
  },
];

export const initialPageLayouts = {
  dashboard: {
    page_id: 'dashboard',
    route: '/dashboard',
    edit_mode: false,
    columns: [],
    widget_placements: [],
  },
  weather: {
    page_id: 'weather',
    route: '/weather',
    edit_mode: false,
    columns: [],
    widget_placements: [],
  },
  incidents: {
    page_id: 'incidents',
    route: '/incidents',
    edit_mode: false,
    columns: [],
    widget_placements: [],
  },
  discourse: {
    page_id: 'discourse',
    route: '/discourse',
    edit_mode: false,
    columns: [],
    widget_placements: [],
  },
  maps: {
    page_id: 'maps',
    route: '/maps',
    edit_mode: false,
    columns: [],
    widget_placements: [],
  },
};

let nextColumnId = 1;
let nextPlacementId = 1;

function makeColumn(pageId) {
  return {
    column_id: `${pageId}-column-${nextColumnId++}`,
    layout_slots: [],
  };
}

function makePlacement(pageId, columnId) {
  return {
    placement_id: `${pageId}-placement-${nextPlacementId++}`,
    column_id: columnId,
    widget_id: null,
  };
}

export function togglePageEdit(layout) {
  return {
    ...layout,
    edit_mode: !layout.edit_mode,
  };
}

export function addPageColumn(layout) {
  return {
    ...layout,
    columns: [...layout.columns, makeColumn(layout.page_id)],
  };
}

export function addPageWidgetSlot(layout) {
  const hasColumns = layout.columns.length > 0;
  const columns = hasColumns ? [...layout.columns] : [makeColumn(layout.page_id)];
  const targetColumn = columns[columns.length - 1];
  const placement = makePlacement(layout.page_id, targetColumn.column_id);
  const nextColumn = {
    ...targetColumn,
    layout_slots: [...targetColumn.layout_slots, placement.placement_id],
  };

  return {
    ...layout,
    columns: columns.map((column) =>
      column.column_id === nextColumn.column_id ? nextColumn : column
    ),
    widget_placements: [...layout.widget_placements, placement],
  };
}

export function getLiveWidgetObjects() {
  return widgetDefinitions.filter((widget) => widget.status !== 'candidate_only');
}

export function getCandidateWidgetObjects() {
  return widgetDefinitions.filter((widget) => widget.status === 'candidate_only');
}
