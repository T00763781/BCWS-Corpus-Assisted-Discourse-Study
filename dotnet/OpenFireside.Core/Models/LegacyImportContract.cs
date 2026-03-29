namespace OpenFireside.Core.Models;

public sealed record LegacyImportContract(
    string LegacyDatabaseTechnology,
    IReadOnlyList<string> RequiredSourceTables,
    IReadOnlyList<string> RequiredCompatibilityChecks,
    IReadOnlyList<string> DeferredConcerns
);
