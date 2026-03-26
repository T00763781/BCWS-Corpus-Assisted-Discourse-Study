import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const incidents = sqliteTable(
  'incidents',
  {
    id: text('id').primaryKey(),
    bcwsIncidentGuid: text('bcws_incident_guid'),
    fireYear: integer('fire_year').notNull(),
    incidentNumber: text('incident_number').notNull(),
    incidentName: text('incident_name').notNull(),
    fireCentre: text('fire_centre'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    bcwsGuidUnique: uniqueIndex('incidents_bcws_guid_unique').on(table.bcwsIncidentGuid),
    naturalKeyUnique: uniqueIndex('incidents_fire_year_number_unique').on(table.fireYear, table.incidentNumber),
  })
);

export const incidentSnapshots = sqliteTable('incident_snapshots', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id').notNull(),
  observedAt: text('observed_at').notNull(),
  sourceUpdatedAt: text('source_updated_at'),
  stageOfControl: text('stage_of_control'),
  sizeHa: integer('size_ha'),
  discoveryDate: text('discovery_date'),
  causeText: text('cause_text'),
  resourcesJson: text('resources_json'),
  locationJson: text('location_json'),
  hash: text('hash').notNull(),
  isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(true),
});

export const incidentUpdates = sqliteTable('incident_updates', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id').notNull(),
  publishedAt: text('published_at'),
  observedAt: text('observed_at').notNull(),
  updateText: text('update_text').notNull(),
  updateHash: text('update_hash').notNull(),
  sourceRefId: text('source_ref_id'),
});

export const incidentAttachments = sqliteTable('incident_attachments', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id').notNull(),
  sourceAttachmentId: text('source_attachment_id'),
  title: text('title').notNull(),
  url: text('url'),
  localPath: text('local_path'),
  mimeType: text('mime_type'),
  observedAt: text('observed_at').notNull(),
  hash: text('hash'),
});

export const incidentExternalLinks = sqliteTable('incident_external_links', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id').notNull(),
  category: text('category'),
  label: text('label'),
  url: text('url').notNull(),
  observedAt: text('observed_at').notNull(),
});

export const incidentPerimeters = sqliteTable('incident_perimeters', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id').notNull(),
  observedAt: text('observed_at').notNull(),
  geometryGeojson: text('geometry_geojson').notNull(),
  geometryHash: text('geometry_hash').notNull(),
  sourceRefId: text('source_ref_id'),
});

export const evacuationNotices = sqliteTable('evacuation_notices', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id').notNull(),
  noticeType: text('notice_type'),
  status: text('status'),
  eventName: text('event_name'),
  issuingAgency: text('issuing_agency'),
  issuedAt: text('issued_at'),
  observedAt: text('observed_at').notNull(),
  sourceRefId: text('source_ref_id'),
});

export const rawSourceRecords = sqliteTable('raw_source_records', {
  id: text('id').primaryKey(),
  sourceKind: text('source_kind').notNull(),
  incidentId: text('incident_id'),
  fetchUrl: text('fetch_url').notNull(),
  fetchedAt: text('fetched_at').notNull(),
  httpStatus: integer('http_status'),
  contentType: text('content_type'),
  contentHash: text('content_hash'),
  storageRelPath: text('storage_rel_path'),
  parserVersion: text('parser_version'),
  parseStatus: text('parse_status'),
  parseError: text('parse_error'),
});

export const ingestRuns = sqliteTable('ingest_runs', {
  id: text('id').primaryKey(),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  runType: text('run_type').notNull(),
  status: text('status').notNull(),
  summaryJson: text('summary_json'),
  errorJson: text('error_json'),
});

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const discourseItems = sqliteTable('discourse_items', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  sourceItemId: text('source_item_id').notNull(),
  title: text('title'),
  bodyText: text('body_text'),
  publishedAt: text('published_at'),
});

export const discourseItemComments = sqliteTable('discourse_item_comments', {
  id: text('id').primaryKey(),
  discourseItemId: text('discourse_item_id').notNull(),
  sourceCommentId: text('source_comment_id').notNull(),
  bodyText: text('body_text'),
  publishedAt: text('published_at'),
});

export const incidentDiscourseLinks = sqliteTable('incident_discourse_links', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id').notNull(),
  discourseItemId: text('discourse_item_id').notNull(),
  linkType: text('link_type').notNull(),
  createdAt: text('created_at').notNull(),
});

export const updateDiscourseLinks = sqliteTable('update_discourse_links', {
  id: text('id').primaryKey(),
  incidentUpdateId: text('incident_update_id').notNull(),
  discourseItemId: text('discourse_item_id').notNull(),
  linkType: text('link_type').notNull(),
  createdAt: text('created_at').notNull(),
});
