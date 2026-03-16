from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

_engine = None
_Session = None


class Base(DeclarativeBase):
    pass


def bootstrap_database(settings) -> None:
    global _engine, _Session
    if _engine is not None:
        return
    data_dir = Path(settings.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    db_url = settings.db_url
    connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
    _engine = create_engine(db_url, echo=False, future=True, connect_args=connect_args)
    _Session = sessionmaker(bind=_engine, autoflush=False, autocommit=False, expire_on_commit=False, future=True)
    from open_fireside_api.models.entities import Actor, Claim, ConditionSnapshot, ConnectorRun, DiscourseItem, EndpointCatalogEntry
    Base.metadata.create_all(_engine)


def get_engine():
    return _engine


@contextmanager
def session_scope():
    session = _Session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
