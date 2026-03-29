using OpenFireside.Core.Models;
using OpenFireside.Core.ValueObjects;
using System.Collections.ObjectModel;

namespace OpenFireside.Desktop.ViewModels;

public sealed class DashboardViewModel : WorkspaceViewModelBase
{
    public DashboardViewModel(ArchiveRuntimeInfo runtimeInfo)
        : base(NavigationTarget.Dashboard, "Dashboard", "Native operator dashboard scaffold")
    {
        Notes =
        [
            "Archive totals are intentionally not carried into v2 dashboard design by default.",
            "Derived resource deployment counts are planned once source truth is validated.",
            runtimeInfo.BootstrapMessage
        ];
    }

    public ObservableCollection<string> Notes { get; }
}
