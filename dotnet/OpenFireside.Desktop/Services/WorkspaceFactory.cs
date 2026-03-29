using OpenFireside.Core.Models;
using OpenFireside.Core.ValueObjects;
using OpenFireside.Desktop.ViewModels;

namespace OpenFireside.Desktop.Services;

public sealed class WorkspaceFactory
{
    private readonly ArchiveRuntimeInfo _runtimeInfo;
    private readonly NativeTrayHost _trayHost;

    public WorkspaceFactory(ArchiveRuntimeInfo runtimeInfo, NativeTrayHost trayHost)
    {
        _runtimeInfo = runtimeInfo;
        _trayHost = trayHost;
    }

    public WorkspaceViewModelBase Create(NavigationTarget target, NavigationContext? context = null) =>
        target switch
        {
            NavigationTarget.Dashboard => new DashboardViewModel(_runtimeInfo),
            NavigationTarget.Incidents => new IncidentsViewModel(context),
            NavigationTarget.IncidentDetail => new IncidentDetailViewModel(context),
            NavigationTarget.Maps => new MapsViewModel(),
            NavigationTarget.Settings => new SettingsViewModel(_runtimeInfo, _trayHost),
            _ => new DashboardViewModel(_runtimeInfo)
        };
}
