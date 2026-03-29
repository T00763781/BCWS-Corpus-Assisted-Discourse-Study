namespace OpenFireside.Core.Models;

public sealed record IncidentRecord(
    int FireYear,
    string IncidentNumber,
    string IncidentGuid,
    string Name,
    string StageOfControl,
    string SourceState,
    string JsonPayload,
    DateTimeOffset LastSyncedAt
);

public sealed record IncidentSnapshotRecord(
    long Id,
    int FireYear,
    string IncidentNumber,
    string SnapshotKind,
    string PayloadHash,
    string JsonPayload,
    DateTimeOffset CapturedAt
);

public sealed record IncidentUpdateRecord(
    long Id,
    int FireYear,
    string IncidentNumber,
    string UpdateHash,
    string UpdateText,
    DateTimeOffset PublishedAt,
    DateTimeOffset CapturedAt
);

public sealed record IncidentAssetRecord(
    long Id,
    int FireYear,
    string IncidentNumber,
    string AssetKey,
    string AssetKind,
    string VariantRole,
    string FileName,
    string MimeType,
    long ByteLength,
    string ContentHash,
    string SourceUrl,
    DateTimeOffset FetchedAt
);

public sealed record IncidentPinRecord(
    int FireYear,
    string IncidentNumber,
    DateTimeOffset PinnedAt,
    string PinnedVia
);

public sealed record CaptureRunRecord(
    long Id,
    string RunMode,
    string ScopeLabel,
    DateTimeOffset StartedAt,
    DateTimeOffset? FinishedAt,
    string Status,
    string SummaryJson
);

public sealed record AppStateEntryRecord(
    string StateKey,
    string StateValue,
    DateTimeOffset UpdatedAt
);
