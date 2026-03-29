using OpenFireside.Core.ValueObjects;

namespace OpenFireside.Desktop.ViewModels;

public sealed class IncidentDetailViewModel : WorkspaceViewModelBase
{
    public IncidentDetailViewModel(NavigationContext? context = null)
        : base(
            NavigationTarget.IncidentDetail,
            context?.IncidentNumber is { Length: > 0 } incidentNumber
                ? $"Incident Detail · {incidentNumber}"
                : "Incident Detail",
            "Detached-window-safe incident page scaffold")
    {
        FireYear = context?.FireYear ?? 2025;
        IncidentNumber = context?.IncidentNumber ?? "G70422";
    }

    public int FireYear { get; }
    public string IncidentNumber { get; }
}
