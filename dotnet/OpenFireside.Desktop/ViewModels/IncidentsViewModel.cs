using OpenFireside.Core.Models;
using OpenFireside.Core.ValueObjects;
using System.Collections.ObjectModel;

namespace OpenFireside.Desktop.ViewModels;

public sealed class IncidentsViewModel : WorkspaceViewModelBase
{
    public IncidentsViewModel(NavigationContext? context = null)
        : base(NavigationTarget.Incidents, "Incidents", "Placeholder triage surface for native v2")
    {
        SampleIncidents =
        [
            new IncidentReference(2025, "G70422", "Kiskatinaw River", "Under Control", 26044.4),
            new IncidentReference(2025, "G90425", "Summit Lake", "Out of Control", 251.8),
            new IncidentReference(2025, "K60922", "Placer Creek", "Being Held", 5808.1)
        ];
    }

    public ObservableCollection<IncidentReference> SampleIncidents { get; }
}
