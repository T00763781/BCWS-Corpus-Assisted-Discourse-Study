using OpenFireside.Core.Abstractions.Persistence;

namespace OpenFireside.Infrastructure.Persistence;

public sealed class ArchiveSchemaBootstrapper : IArchiveSchemaBootstrapper
{
    private readonly SqliteConnectionFactory _connectionFactory;

    public ArchiveSchemaBootstrapper(SqliteConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task EnsureCreatedAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = _connectionFactory.Create();
        await connection.OpenAsync(cancellationToken);

        foreach (var statement in SchemaStatements.All)
        {
            await using var command = connection.CreateCommand();
            command.CommandText = statement;
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private static class SchemaStatements
    {
        public static IReadOnlyList<string> All { get; } =
        [
            """
            PRAGMA journal_mode = WAL;
            """,
            """
            PRAGMA foreign_keys = ON;
            """,
            """
            CREATE TABLE IF NOT EXISTS incidents (
                fire_year INTEGER NOT NULL,
                incident_number TEXT NOT NULL,
                incident_guid TEXT NOT NULL DEFAULT '',
                incident_name TEXT NOT NULL,
                stage_of_control TEXT NOT NULL DEFAULT '',
                source_state TEXT NOT NULL DEFAULT 'legacy-import-pending',
                location_name TEXT NOT NULL DEFAULT '',
                details_json TEXT NOT NULL DEFAULT '{}',
                list_payload_json TEXT NOT NULL DEFAULT '{}',
                last_synced_at TEXT NOT NULL,
                PRIMARY KEY (fire_year, incident_number)
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS incident_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fire_year INTEGER NOT NULL,
                incident_number TEXT NOT NULL,
                snapshot_kind TEXT NOT NULL,
                payload_hash TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                captured_at TEXT NOT NULL
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS incident_updates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fire_year INTEGER NOT NULL,
                incident_number TEXT NOT NULL,
                update_hash TEXT NOT NULL,
                update_text TEXT NOT NULL,
                published_at TEXT NOT NULL,
                captured_at TEXT NOT NULL
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS incident_assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fire_year INTEGER NOT NULL,
                incident_number TEXT NOT NULL,
                asset_key TEXT NOT NULL,
                attachment_guid TEXT NOT NULL DEFAULT '',
                asset_kind TEXT NOT NULL,
                variant_role TEXT NOT NULL DEFAULT 'original',
                file_name TEXT NOT NULL DEFAULT '',
                mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
                byte_length INTEGER NOT NULL DEFAULT 0,
                content_hash TEXT NOT NULL DEFAULT '',
                source_url TEXT NOT NULL DEFAULT '',
                fetched_at TEXT NOT NULL,
                is_local_binary INTEGER NOT NULL DEFAULT 0,
                blob_bytes BLOB NULL,
                UNIQUE(fire_year, incident_number, asset_key, variant_role)
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS incident_pins (
                fire_year INTEGER NOT NULL,
                incident_number TEXT NOT NULL,
                pinned_at TEXT NOT NULL,
                pinned_via TEXT NOT NULL DEFAULT 'native-v2',
                PRIMARY KEY (fire_year, incident_number)
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS capture_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_mode TEXT NOT NULL,
                scope_label TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT NULL,
                summary_json TEXT NOT NULL DEFAULT '{}'
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS app_state (
                state_key TEXT PRIMARY KEY,
                state_value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        ];
    }
}
