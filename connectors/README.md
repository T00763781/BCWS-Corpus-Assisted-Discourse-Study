# Connector workspace

This directory is reserved for source-specific adapter packages and browser automation workers.

The current v1 repo keeps executable connector logic in `services/api/open_fireside_api/connectors` so the local
service can run end-to-end immediately. Future extraction into standalone packages should preserve the connector
contract and diagnostics semantics already present in the API service.
