namespace OpenFireside.Core.ValueObjects;

public sealed record NavigationContext(
    int? FireYear = null,
    string? IncidentNumber = null,
    string? Title = null
);
