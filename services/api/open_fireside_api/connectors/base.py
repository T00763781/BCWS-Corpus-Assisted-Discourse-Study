from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class ConnectorResult:
    status: str
    message: str
    stats: dict | None = None


class Connector(Protocol):
    key: str
    kind: str
    description: str

    def run(self) -> ConnectorResult: ...
