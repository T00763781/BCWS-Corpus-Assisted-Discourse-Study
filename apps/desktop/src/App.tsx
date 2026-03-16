import { type ReactNode, useState } from "react";
import { HashRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import ofLogo from "../../../OF-logo.svg";

const MAIN_NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/incidents", label: "Incidents" },
  { to: "/discourse", label: "Discourse" },
  { to: "/environment", label: "Environment" },
  { to: "/maps", label: "Maps" },
  { to: "/configure", label: "Configure" },
];

const CONFIGURE_TABS = ["Sources", "Dashboard", "Incidents", "Discourse", "Environment", "Maps"] as const;

const PROVENANCE_STATES = ["Live", "Normalized", "Seeded", "Recon-only", "Deferred"];

const VALIDATION_RULES = [
  "Approved source class",
  "Source family / official URL class",
  "Object type",
  "Provenance status",
  "Validation status",
  "Page eligibility",
];

const OBJECT_LIFECYCLE = [
  {
    title: "Raw ingest object",
    body: "Captured from an approved source candidate but not yet normalized into the Open Fireside schema.",
  },
  {
    title: "Normalized object",
    body: "Mapped into a stable object type with source family and official URL class recorded.",
  },
  {
    title: "Validated object",
    body: "Confirmed for provenance, field integrity, and routing rules before it can influence any page surface.",
  },
  {
    title: "Page-eligible object",
    body: "Explicitly promoted for one target page after source and validation checks are complete.",
  },
];

const PAGE_GATES: Record<(typeof CONFIGURE_TABS)[number], { title: string; body: string }[]> = {
  Sources: [
    {
      title: "Sources-first intake",
      body: "Register approved source class, source family, official URL class, and the object types expected from each source before any page receives a widget.",
    },
    {
      title: "Validation ledger",
      body: "Track provenance status as live, normalized, seeded, recon-only, or deferred, then assign validation status and page eligibility per object.",
    },
    {
      title: "Promotion discipline",
      body: "No downstream page repopulation happens until a source object is validated and explicitly promoted from Configure.",
    },
  ],
  Dashboard: [
    {
      title: "Dashboard gate",
      body: "Dashboard remains empty until a validated object is promoted into a dashboard-specific widget contract.",
    },
  ],
  Incidents: [
    {
      title: "Incidents gate",
      body: "Incident views stay neutral until incident objects are validated against approved wildfire sources and routing rules.",
    },
  ],
  Discourse: [
    {
      title: "Discourse gate",
      body: "Discourse remains blocked from display until linkage, provenance, and object type constraints are proven against approved sources.",
    },
  ],
  Environment: [
    {
      title: "Environment gate",
      body: "Environment widgets will be introduced one at a time only after their source family and validation path are explicit.",
    },
  ],
  Maps: [
    {
      title: "Maps gate",
      body: "Maps stays a neutral shell until map objects are validated and promoted from Configure with clear page eligibility.",
    },
  ],
};

type NeutralPageProps = {
  eyebrow: string;
  title: string;
  lede: string;
  note: string;
  children?: ReactNode;
};

function NeutralPage({ eyebrow, title, lede, note, children }: NeutralPageProps) {
  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="lede">{lede}</p>
        </div>
      </section>

      <section className="panel neutral-panel">
        <div className="panel-title">Neutral workspace</div>
        <p className="muted neutral-copy">{note}</p>
      </section>

      {children}
    </>
  );
}

function DashboardPage() {
  return (
    <NeutralPage
      eyebrow="Dashboard"
      title="Dashboard"
      lede="Dashboard remains intentionally empty in this pass."
      note="No summary cards, counts, or live widgets are shown here until validated objects are promoted from Configure."
    />
  );
}

function IncidentListPage() {
  return (
    <NeutralPage
      eyebrow="Incidents"
      title="Incidents"
      lede="Incident surfaces are stripped back to a neutral shell."
      note="No incident list, detail stream, or operational summaries are rendered until approved source objects complete validation and promotion."
    />
  );
}

function DiscoursePage() {
  return (
    <NeutralPage
      eyebrow="Discourse"
      title="Discourse"
      lede="Discourse remains off the main product surface until provenance rules are enforced."
      note="No previews, excerpts, or source-linked discourse objects are displayed in this pass."
    />
  );
}

function EnvironmentPage() {
  return (
    <NeutralPage
      eyebrow="Environment"
      title="Environment"
      lede="Environment stays neutral while validation controls move into Configure."
      note="No condition cards, outlooks, or summaries are shown until those objects are validated against approved sources."
    />
  );
}

function MapsPage() {
  return (
    <NeutralPage
      eyebrow="Maps"
      title="Maps"
      lede="Maps keeps only a neutral container in this pass."
      note="No map layers, counts, or operational references are displayed here until map objects are promoted from Configure."
    >
      <section className="panel map-shell-panel">
        <div className="panel-title">Map container</div>
        <div className="neutral-map-shell">Reserved for validated map objects only.</div>
      </section>
    </NeutralPage>
  );
}

function ConfigurePage() {
  const [activeTab, setActiveTab] = useState<(typeof CONFIGURE_TABS)[number]>("Sources");

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Configure</p>
          <h1>Configure</h1>
          <p className="lede">Configure now acts as the control plane that validates source objects before any page is repopulated.</p>
        </div>
      </section>

      <section className="configure-nav-shell">
        <div className="configure-top-nav" role="tablist" aria-label="Configure workspace tabs">
          {CONFIGURE_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`configure-top-tab${activeTab === tab ? " configure-top-tab-active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="configure-grid">
          <section className="panel control-plane-panel">
            <div className="panel-title">Sources-first control plane</div>
            <p className="muted">
              Start in <strong>Sources</strong>. Source registration, provenance review, validation status, and page eligibility happen here before any dashboard, incident, discourse,
              environment, or maps widget is allowed onto the product surface.
            </p>
            <div className="validation-pill-row" aria-label="Provenance states">
              {PROVENANCE_STATES.map((state) => (
                <span className="validation-pill" key={state}>
                  {state}
                </span>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">Validation fields</div>
            <div className="definition-grid">
              {VALIDATION_RULES.map((rule) => (
                <div className="definition-card" key={rule}>
                  <strong>{rule}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="panel span-two">
            <div className="panel-title">{activeTab} workspace gate</div>
            <div className="configure-card-grid">
              {PAGE_GATES[activeTab].map((item) => (
                <article className="definition-card" key={item.title}>
                  <strong>{item.title}</strong>
                  <p className="muted">{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel span-two">
            <div className="panel-title">Proposed object lifecycle</div>
            <div className="lifecycle-grid">
              {OBJECT_LIFECYCLE.map((item) => (
                <article className="lifecycle-card" key={item.title}>
                  <span className="lifecycle-marker" />
                  <strong>{item.title}</strong>
                  <p className="muted">{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel span-two">
            <div className="panel-title">Promotion rule</div>
            <p className="muted">
              Other pages remain intentionally neutral until a validated object is promoted from Configure into a specific route-level widget. This pass establishes the shell, gating fields,
              and workflow only. Live-source ingestion and widget-by-widget rollout remain intentionally absent.
            </p>
          </section>
        </div>
      </section>
    </>
  );
}

function WorkstationLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img alt="Open Fireside logo" className="brand-mark" src={ofLogo} />
          <div>
            <div className="brand-name">Open Fireside</div>
            <div className="brand-sub">Canonical workspace</div>
          </div>
        </div>

        <nav className="nav" aria-label="Primary">
          {MAIN_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? " nav-item-active" : ""}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/incidents" element={<IncidentListPage />} />
          <Route path="/incidents/:incidentId" element={<IncidentListPage />} />
          <Route path="/discourse" element={<DiscoursePage />} />
          <Route path="/environment" element={<EnvironmentPage />} />
          <Route path="/maps" element={<MapsPage />} />
          <Route path="/configure" element={<ConfigurePage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <WorkstationLayout />
    </HashRouter>
  );
}
