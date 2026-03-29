using OpenFireside.Core.Abstractions.Import;
using OpenFireside.Core.Models;

namespace OpenFireside.Infrastructure.Import;

public sealed class LegacyArchiveImportServiceStub : ILegacyArchiveImportService
{
    private static readonly LegacyImportContract Contract = new(
        LegacyDatabaseTechnology: "Electron/sql.js SQLite archive",
        RequiredSourceTables:
        [
            "incidents",
            "incident_snapshots",
            "incident_updates",
            "incident_media",
            "incident_pins",
            "capture_runs",
            "app_state"
        ],
        RequiredCompatibilityChecks:
        [
            "Verify legacy DB is readable by the native SQLite provider.",
            "Map incident_media to incident_assets with original binary rows preserved.",
            "Confirm fire_year + incident_number keys are stable across incidents, pins, updates, and assets.",
            "Validate local/live source-state semantics before claiming parity."
        ],
        DeferredConcerns:
        [
            "Legacy response-history extraction remains imported data until native capture exists.",
            "Legacy import must be append-safe and avoid overwriting validated native records blindly.",
            "sql.js-specific blob and schema quirks need validation on real operator DBs."
        ]);

    public LegacyImportContract GetContract() => Contract;

    public Task ValidateCompatibilityAsync(string legacyDatabasePath, CancellationToken cancellationToken = default) =>
        Task.FromException(new NotImplementedException("Legacy archive validation is documented but not implemented in the v2 foundation turn."));

    public Task ImportAsync(string legacyDatabasePath, CancellationToken cancellationToken = default) =>
        Task.FromException(new NotImplementedException("Legacy archive import is documented but not implemented in the v2 foundation turn."));
}
