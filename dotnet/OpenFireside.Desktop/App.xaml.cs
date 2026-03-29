using OpenFireside.Core.ValueObjects;
using OpenFireside.Desktop.Services;
using System.Windows;

namespace OpenFireside.Desktop;

public partial class App : Application
{
    private NativeCompositionRoot? _compositionRoot;

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        _compositionRoot = new NativeCompositionRoot();
        var runtimeInfo = await _compositionRoot.BootstrapAsync();
        var shell = _compositionRoot.CreateShellWindow(NavigationTarget.Dashboard);
        shell.Title = runtimeInfo.BootstrapSucceeded
            ? "Open Fireside v2"
            : "Open Fireside v2 · bootstrap warning";
        shell.Show();
    }
}
