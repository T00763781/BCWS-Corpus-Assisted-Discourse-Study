using OpenFireside.Core.Models;
using OpenFireside.Core.ValueObjects;
using OpenFireside.Desktop.Services;
using System.Collections.ObjectModel;

namespace OpenFireside.Desktop.ViewModels;

public sealed class SettingsViewModel : WorkspaceViewModelBase
{
    public SettingsViewModel(ArchiveRuntimeInfo runtimeInfo, NativeTrayHost trayHost)
        : base(NavigationTarget.Settings, "Settings", "Native runtime and migration state")
    {
        RuntimeFacts =
        [
            $"Database path: {runtimeInfo.DatabasePath}",
            $"Bootstrap: {runtimeInfo.BootstrapMessage}",
            $"Tray host: {trayHost.StatusMessage}",
            "Legacy Electron/sql.js archive remains import source only."
        ];
    }

    public ObservableCollection<string> RuntimeFacts { get; }
}
