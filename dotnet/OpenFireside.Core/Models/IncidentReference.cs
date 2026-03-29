namespace OpenFireside.Core.Models;

public sealed record IncidentReference(
    int FireYear,
    string IncidentNumber,
    string Name,
    string StageOfControl,
    double? SizeHectares = null
);
