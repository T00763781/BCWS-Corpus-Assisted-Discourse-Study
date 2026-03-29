using OpenFireside.Core.Models;
using OpenFireside.Core.ValueObjects;
using OpenFireside.Desktop.Services;
using OpenFireside.Desktop.ViewModels;

namespace OpenFireside.Tests.Persistence;

public sealed class NavigationServiceTests
{
    [Theory]
    [InlineData(NavigationTarget.Dashboard, typeof(DashboardViewModel))]
    [InlineData(NavigationTarget.Incidents, typeof(IncidentsViewModel))]
    [InlineData(NavigationTarget.IncidentDetail, typeof(IncidentDetailViewModel))]
    [InlineData(NavigationTarget.Maps, typeof(MapsViewModel))]
    [InlineData(NavigationTarget.Settings, typeof(SettingsViewModel))]
    public void Navigate_CreatesExpectedWorkspace(NavigationTarget target, Type expectedType)
    {
        var runtimeInfo = new ArchiveRuntimeInfo("C:\\temp\\open-fireside-v2.sqlite", true, "ok");
        var factory = new WorkspaceFactory(runtimeInfo, new NativeTrayHost());
        var navigation = new NavigationService(factory);

        navigation.Navigate(target, new NavigationContext(2025, "G70422"));

        Assert.NotNull(navigation.CurrentWorkspace);
        Assert.IsType(expectedType, navigation.CurrentWorkspace);
    }
}
