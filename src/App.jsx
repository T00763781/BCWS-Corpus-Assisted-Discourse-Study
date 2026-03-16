import React from 'react';
import { fetchBcwsPerimeterWidget } from './bcwsPerimeter.js';

const routes = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'discourse', label: 'Discourse' },
  { id: 'environment', label: 'Environment' },
  { id: 'maps', label: 'Maps' },
  { id: 'configure', label: 'Configure' },
];

const configureTabs = ['Sources', 'Dashboard', 'Incidents', 'Discourse', 'Environment', 'Maps'];

function useHashRoute() {
  const [route, setRoute] = React.useState(() => {
    const hash = window.location.hash.replace('#/', '').trim();
    return routes.some((r) => r.id === hash) ? hash : 'configure';
  });

  React.useEffect(() => {
    const onChange = () => {
      const hash = window.location.hash.replace('#/', '').trim();
      setRoute(routes.some((r) => r.id === hash) ? hash : 'configure');
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

  return (
    <div className="app-shell">
      <main className="shell-frame">
        <aside className="left-rail">
          <div className="brand-block" aria-label="Open Fireside brand">
            <img src="/assets/logo.svg" alt="Open Fireside logo" className="brand-logo" />
          </div>

          <nav className="route-nav" aria-label="Primary">
            {routes.map((item) => {
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
          {route === 'configure' ? <ConfigureWorkspace /> : <BlankWorkspace />} 
        </section>
      </main>
    </div>
  );
}

function BlankWorkspace() {
  return <div className="blank-workspace" aria-hidden="true" />;
}

function ConfigureWorkspace() {
  return (
    <div className="configure-workspace">
      <div className="configure-top-tabs" role="tablist" aria-label="Configure sections">
        {configureTabs.map((tab, index) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={index === 0}
            className={`configure-tab ${index === 0 ? 'is-active' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="sources-surface" aria-label="Sources surface">
        <BcwsPerimeterWidget />
      </div>
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
