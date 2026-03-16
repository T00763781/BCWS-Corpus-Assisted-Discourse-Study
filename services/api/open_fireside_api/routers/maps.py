from fastapi import APIRouter

from open_fireside_api.schemas import MapCatalogEntry
from open_fireside_api.services.queries import map_catalog

router = APIRouter(prefix="/maps", tags=["maps"])


@router.get("/catalog", response_model=list[MapCatalogEntry])
def get_map_catalog() -> list[MapCatalogEntry]:
    return [MapCatalogEntry(**row) for row in map_catalog()]
