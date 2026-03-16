import React from 'react';

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
      <div className="sources-surface" aria-label="Sources surface" />
    </div>
  );
}
