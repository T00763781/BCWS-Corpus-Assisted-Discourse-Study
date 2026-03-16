from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from open_fireside_api.routers import analytics, conditions, connectors, dashboard, environment, health, incidents, maps
from open_fireside_api.database import bootstrap_database
from open_fireside_config.settings import get_settings
from open_fireside_diagnostics.logging import configure_logging

settings = get_settings()
configure_logging(settings.log_level)
bootstrap_database(settings)

app = FastAPI(
    title="Open Fireside API",
    version="0.1.0",
    description="Local-first wildfire discourse workstation API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Authorization", "Content-Type", "Origin"],
)

api_router = APIRouter(prefix=settings.api_prefix)
api_router.include_router(health.router)
api_router.include_router(conditions.router)
api_router.include_router(analytics.router)
api_router.include_router(connectors.router)
api_router.include_router(dashboard.router)
api_router.include_router(environment.router)
api_router.include_router(incidents.router)
api_router.include_router(maps.router)
app.include_router(api_router)


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/docs", status_code=307)


legacy_router = APIRouter(include_in_schema=False)


@legacy_router.get("/health")
def legacy_health_redirect() -> RedirectResponse:
    return RedirectResponse(url=f"{settings.api_prefix}/health", status_code=307)


@legacy_router.get("/conditions")
def legacy_conditions_redirect() -> RedirectResponse:
    return RedirectResponse(url=f"{settings.api_prefix}/conditions", status_code=307)


@legacy_router.get("/analytics/snapshot")
def legacy_analytics_redirect() -> RedirectResponse:
    return RedirectResponse(url=f"{settings.api_prefix}/analytics/snapshot", status_code=307)


@legacy_router.get("/connectors")
def legacy_connectors_redirect() -> RedirectResponse:
    return RedirectResponse(url=f"{settings.api_prefix}/connectors", status_code=307)


@legacy_router.post("/connectors/run")
def legacy_connector_run_redirect() -> RedirectResponse:
    return RedirectResponse(url=f"{settings.api_prefix}/connectors/run", status_code=307)


app.include_router(legacy_router)
