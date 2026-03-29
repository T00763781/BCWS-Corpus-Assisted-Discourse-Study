using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using OpenFireside.Core.Abstractions.Import;
using OpenFireside.Core.Abstractions.Navigation;
using OpenFireside.Core.Models;
using OpenFireside.Core.ValueObjects;
using OpenFireside.Desktop.Services;
using System.Collections.ObjectModel;

namespace OpenFireside.Desktop.ViewModels;

public sealed partial class ShellViewModel : ViewModelBase
{
    private readonly INavigationService _navigationService;
    private readonly IWindowLauncherService _windowLauncherService;
    private readonly DesktopAssetCatalog _assetCatalog;

    [ObservableProperty]
    private bool _isSidebarCollapsed;

    [ObservableProperty]
    private WorkspaceViewModelBase? _currentWorkspace;

    [ObservableProperty]
    private string _currentTitle = "Open Fireside v2";

    public ShellViewModel(
        INavigationService navigationService,
        IWindowLauncherService windowLauncherService,
        DesktopAssetCatalog assetCatalog,
        ArchiveRuntimeInfo runtimeInfo,
        ILegacyArchiveImportService legacyArchiveImportService,
        NativeTrayHost trayHost)
    {
        _navigationService = navigationService;
        _windowLauncherService = windowLauncherService;
        _assetCatalog = assetCatalog;
        RuntimeInfo = runtimeInfo;
        LegacyContract = legacyArchiveImportService.GetContract();
        TrayStatus = trayHost.StatusMessage;

        NavigationItems =
        [
            new NavItemViewModel(NavigationTarget.Dashboard, "Dashboard"),
            new NavItemViewModel(NavigationTarget.Incidents, "Incidents"),
            new NavItemViewModel(NavigationTarget.IncidentDetail, "Incident Detail"),
            new NavItemViewModel(NavigationTarget.Maps, "Maps"),
            new NavItemViewModel(NavigationTarget.Settings, "Settings")
        ];

        _navigationService.CurrentWorkspaceChanged += (_, _) => RefreshCurrentWorkspace();
        RefreshCurrentWorkspace();
    }

    public ObservableCollection<NavItemViewModel> NavigationItems { get; }
    public ArchiveRuntimeInfo RuntimeInfo { get; }
    public LegacyImportContract LegacyContract { get; }
    public string TrayStatus { get; }
    public string SidebarToggleAssetPath => IsSidebarCollapsed ? _assetCatalog.OpenSidebarSvgPath : _assetCatalog.CloseSidebarSvgPath;
    public string BrandIconAssetPath => _assetCatalog.BrandIconSvgPath;
    public string HeaderStatus => RuntimeInfo.BootstrapSucceeded ? "Native SQLite ready" : "Bootstrap warning";

    [RelayCommand]
    private void ToggleSidebar()
    {
        IsSidebarCollapsed = !IsSidebarCollapsed;
        OnPropertyChanged(nameof(SidebarToggleAssetPath));
    }

    [RelayCommand]
    private void Navigate(NavigationTarget target)
    {
        _navigationService.Navigate(target);
    }

    [RelayCommand]
    private void OpenCurrentInNewWindow()
    {
        if (CurrentWorkspace is null) return;
        _windowLauncherService.Open(CurrentWorkspace.Target, ExtractContext(CurrentWorkspace));
    }

    private void RefreshCurrentWorkspace()
    {
        CurrentWorkspace = _navigationService.CurrentWorkspace as WorkspaceViewModelBase;
        CurrentTitle = CurrentWorkspace?.Title ?? "Open Fireside v2";
    }

    private static NavigationContext? ExtractContext(WorkspaceViewModelBase workspace) =>
        workspace switch
        {
            IncidentDetailViewModel detail => new NavigationContext(detail.FireYear, detail.IncidentNumber, detail.Title),
            _ => null
        };
}
