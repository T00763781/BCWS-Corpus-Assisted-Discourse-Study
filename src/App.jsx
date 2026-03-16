import React from 'react';
import { fetchBcwsPerimeterWidget } from './bcwsPerimeter.js';
import {
  appRoutes,
  configureTabs,
  getCandidateWidgetObjects,
  getLiveWidgetObjects,
  initialPageLayouts,
  pageBuilderTabs,
  togglePageEdit,
  addPageColumn,
  addPageWidgetSlot,
} from './objectModel.js';

function useHashRoute() {
  const [route, setRoute] = React.useState(() => {
    const hash = window.location.hash.replace('#/', '').trim();
    return appRoutes.some((r) => r.id === hash) ? hash : 'configure';
  });

  React.useEffect(() => {
    const onChange = () => {
      const hash = window.location.hash.replace('#/', '').trim();
      setRoute(appRoutes.some((r) => r.id === hash) ? hash : 'configure');
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = (next) => {
    window.location.hash = `/${next}`;
  };

  return [route, navigate];
}

export default function App() {
  const [route, navigate] = useHashRoute();
  const [configureTab, setConfigureTab] = React.useState('sources');
  const [pageLayouts, setPageLayouts] = React.useState(initialPageLayouts);

  const updatePageLayout = React.useCallback((pageId, recipe) => {
    setPageLayouts((current) => ({
      ...current,
      [pageId]: recipe(current[pageId]),
    }));
  }, []);

  const sharedBuilderActions = React.useMemo(
    () => ({
      onToggleEdit: (pageId) => updatePageLayout(pageId, togglePageEdit),
      onAddColumn: (pageId) => updatePageLayout(pageId, addPageColumn),
      onAddWidget: (pageId) => updatePageLayout(pageId, addPageWidgetSlot),
    }),
    [updatePageLayout]
  );

  const activePageRoute = appRoutes.find((item) => item.id === route);
  const activePageLayout = activePageRoute?.pageId ? pageLayouts[activePageRoute.pageId] : null;

  return (
    <div className="app-shell">
      <main className="shell-frame">
        <aside className="left-rail">
          <div className="brand-block" aria-label="Open Fireside brand">
            <img src="/assets/logo.svg" alt="Open Fireside logo" className="brand-logo" />
          </div>

          <nav className="route-nav" aria-label="Primary">
            {appRoutes.map((item) => {
              const active = item.id === route;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item ${active ? 'is-active' : ''}`}
                  onClick={() => navigate(item.id)}
                >
                  <span className="nav-marker" aria-hidden="true" />
                  <span className="nav-label">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="workspace" aria-label="Workspace">
          {route === 'configure' ? (
            <ConfigureWorkspace
              configureTab={configureTab}
              setConfigureTab={setConfigureTab}
              pageLayouts={pageLayouts}
              builderActions={sharedBuilderActions}
            />
          ) : (
            <PageBuilderSurface
              page={activePageLayout}
              label={activePageRoute?.label ?? ''}
              builderActions={sharedBuilderActions}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function ConfigureWorkspace({ configureTab, setConfigureTab, pageLayouts, builderActions }) {
  const activeBuilderTab = pageBuilderTabs.find((tab) => tab.id === configureTab);

  return (
    <div className="configure-workspace">
      <div className="configure-top-tabs" role="tablist" aria-label="Configure sections">
        {configureTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={configureTab === tab.id}
            className={`configure-tab ${configureTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setConfigureTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="sources-surface" aria-label="Sources surface">
        {configureTab === 'sources' ? <ConfigureSourcesView /> : null}
        {configureTab === 'widgets' ? <ConfigureWidgetsView /> : null}
        {activeBuilderTab ? (
          <PageBuilderSurface
            page={pageLayouts[activeBuilderTab.pageId]}
            label={activeBuilderTab.label}
            builderActions={builderActions}
            insideConfigure
          />
        ) : null}
      </div>
    </div>
  );
}

function ConfigureSourcesView() {
  const liveWidgets = getLiveWidgetObjects().filter((widget) =>
    widget.allowed_config_tabs.includes('sources')
  );

  return (
    <div className="configure-stack">
      {liveWidgets.map((widget) => (
        <WidgetObjectCard key={widget.widget_id} widget={widget} renderActive />
      ))}
    </div>
  );
}

function ConfigureWidgetsView() {
  const liveWidgets = getLiveWidgetObjects().filter((widget) =>
    widget.allowed_config_tabs.includes('widgets')
  );
  const candidateWidgets = getCandidateWidgetObjects();

  return (
    <div className="configure-stack">
      <div className="widget-lab-section">
        <div className="widget-lab-title">Live widget objects</div>
        {liveWidgets.map((widget) => (
          <WidgetObjectCard key={widget.widget_id} widget={widget} renderActive />
        ))}
      </div>

      <div className="widget-lab-section">
        <div className="widget-lab-title">Candidate widgets</div>
        <div className="candidate-widget-list">
          {candidateWidgets.map((widget) => (
            <div key={widget.widget_id} className="candidate-widget-row">
              <div className="candidate-widget-row__main">
                <div className="candidate-widget-row__label">{widget.label}</div>
                <div className="candidate-widget-row__meta">{widget.widget_id}</div>
              </div>
              <div className="candidate-widget-row__status">{widget.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WidgetObjectCard({ widget, renderActive = false }) {
  return (
    <section className="widget-object-card">
      <div className="widget-object-card__meta">
        <div className="widget-object-card__title">{widget.label}</div>
        <div className="widget-object-card__grid">
          <MetaItem label="widget_id" value={widget.widget_id} />
          <MetaItem label="status" value={widget.status} />
          <MetaItem label="render_type" value={widget.render_type} />
          <MetaItem label="source_ids" value={widget.source_ids.join(', ')} />
          <MetaItem label="allowed_pages" value={widget.allowed_pages.join(', ') || 'none'} />
          <MetaItem
            label="allowed_config_tabs"
            value={widget.allowed_config_tabs.join(', ') || 'none'}
          />
          <MetaItem label="fetch_mode" value={widget.fetch_mode} />
          <MetaItem label="notes" value={widget.notes} />
        </div>
      </div>

      {renderActive && widget.render_type === 'bcws_perimeter_layer' ? <BcwsPerimeterWidget /> : null}
    </section>
  );
}

function MetaItem({ label, value }) {
  return (
    <div className="widget-object-card__item">
      <div className="widget-object-card__item-label">{label}</div>
      <div className="widget-object-card__item-value">{value}</div>
    </div>
  );
}

function BcwsPerimeterWidget() {
  const [state, setState] = React.useState({
    phase: 'idle',
    error: '',
    data: null,
  });

  const loadWidget = React.useCallback(async () => {
    setState((current) => ({
      ...current,
      phase: 'loading',
      error: '',
    }));

    try {
      const data = await fetchBcwsPerimeterWidget();
      setState({
        phase: 'success',
        error: '',
        data,
      });
    } catch (error) {
      setState({
        phase: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      });
    }
  }, []);

  React.useEffect(() => {
    loadWidget();
  }, [loadWidget]);

  const specimenRows = state.data?.specimen?.features ?? [];
  const rawSpecimen = state.data?.specimen ? JSON.stringify(state.data.specimen, null, 2) : '';

  return (
    <section className="source-widget" aria-label="BCWS perimeter widget">
      <div className="source-widget__header">
        <div>
          <h2 className="source-widget__title">BCWS Fire Perimeters PublicView</h2>
          <div className="source-widget__source">{state.data?.sourceUrl ?? 'https://services6.arcgis.com/ubm4tcTYICKBpist/ArcGIS/rest/services/BCWS_FirePerimeters_PublicView/FeatureServer/0'}</div>
        </div>
        <button type="button" className="source-widget__button" onClick={loadWidget}>
          Refresh
        </button>
      </div>

      <div className="source-widget__status-grid">
        <StatusItem label="Fetch" value={state.phase} />
        <StatusItem label="Metadata HTTP" value={state.data?.metadataStatus ?? 'n/a'} />
        <StatusItem label="Count HTTP" value={state.data?.countStatus ?? 'n/a'} />
        <StatusItem label="Specimen HTTP" value={state.data?.specimenStatus ?? 'n/a'} />
        <StatusItem label="Last fetched" value={state.data?.fetchedAt ?? 'n/a'} />
      </div>

      {state.phase === 'failure' ? (
        <div className="source-widget__failure">{state.error}</div>
      ) : null}

      <div className="source-widget__summary-grid">
        <SummaryItem label="Layer name" value={state.data?.layerName ?? 'n/a'} />
        <SummaryItem label="Geometry type" value={state.data?.geometryType ?? 'n/a'} />
        <SummaryItem label="Object count" value={state.data?.objectCount ?? 'n/a'} />
        <SummaryItem
          label="Available fields"
          value={state.data?.fields?.length ? state.data.fields.join(', ') : 'n/a'}
        />
      </div>

      <div className="source-widget__table-wrap">
        <table className="source-widget__table">
          <thead>
            <tr>
              <th>FIRE_NUMBER</th>
              <th>FIRE_STATUS</th>
              <th>FIRE_SIZE_HECTARES</th>
              <th>FIRE_URL</th>
            </tr>
          </thead>
          <tbody>
            {specimenRows.length ? (
              specimenRows.map((row, index) => {
                const attrs = row.attributes ?? {};
                return (
                  <tr key={`${attrs.FIRE_NUMBER ?? 'row'}-${index}`}>
                    <td>{attrs.FIRE_NUMBER ?? ''}</td>
                    <td>{attrs.FIRE_STATUS ?? ''}</td>
                    <td>{attrs.FIRE_SIZE_HECTARES ?? ''}</td>
                    <td className="source-widget__url-cell">{attrs.FIRE_URL ?? ''}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="4" className="source-widget__empty">
                  {state.phase === 'loading' ? 'loading' : 'no specimen'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <details className="source-widget__raw">
        <summary>Raw specimen</summary>
        <pre>{rawSpecimen || '{}'}</pre>
      </details>
    </section>
  );
}

function PageBuilderSurface({ page, label, builderActions, insideConfigure = false }) {
  const hasPlacements = page.widget_placements.some((placement) => placement.widget_id);

  return (
    <div className={`page-builder ${insideConfigure ? 'is-nested' : ''}`}>
      <div className="page-builder__bar">
        <div className="page-builder__title">{label}</div>
        <div className="page-builder__controls">
          <button
            type="button"
            className={`page-builder__button ${page.edit_mode ? 'is-active' : ''}`}
            onClick={() => builderActions.onToggleEdit(page.page_id)}
          >
            {page.edit_mode ? 'Edit on' : 'Edit off'}
          </button>
          <button
            type="button"
            className="page-builder__button"
            onClick={() => builderActions.onAddColumn(page.page_id)}
            disabled={!page.edit_mode}
          >
            Add column
          </button>
          <button
            type="button"
            className="page-builder__button"
            onClick={() => builderActions.onAddWidget(page.page_id)}
            disabled={!page.edit_mode}
          >
            Add widget
          </button>
        </div>
      </div>

      {!page.edit_mode && !hasPlacements ? (
        <div className="blank-workspace" aria-hidden="true" />
      ) : (
        <div className="page-builder__surface">
          {page.columns.length ? (
            page.columns.map((column) => {
              const placements = page.widget_placements.filter(
                (placement) => placement.column_id === column.column_id
              );

              return (
                <div key={column.column_id} className="page-builder__column">
                  <div className="page-builder__column-label">{column.column_id}</div>
                  {placements.length ? (
                    placements.map((placement) => (
                      <div key={placement.placement_id} className="page-builder__slot">
                        {placement.widget_id ? placement.widget_id : 'Empty widget slot'}
                      </div>
                    ))
                  ) : (
                    <div className="page-builder__slot is-empty">Empty column</div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="page-builder__empty-surface">Empty page</div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusItem({ label, value }) {
  return (
    <div className="source-widget__status-item">
      <div className="source-widget__label">{label}</div>
      <div className="source-widget__value">{String(value)}</div>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="source-widget__summary-item">
      <div className="source-widget__label">{label}</div>
      <div className="source-widget__value source-widget__value--wrap">{String(value)}</div>
    </div>
  );
}
