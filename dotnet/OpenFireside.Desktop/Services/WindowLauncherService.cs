using OpenFireside.Core.Abstractions.Navigation;
using OpenFireside.Core.ValueObjects;

namespace OpenFireside.Desktop.Services;

public sealed class WindowLauncherService : IWindowLauncherService
{
    private readonly NativeCompositionRoot _compositionRoot;

    public WindowLauncherService(NativeCompositionRoot compositionRoot)
    {
        _compositionRoot = compositionRoot;
    }

    public void Open(NavigationTarget target, NavigationContext? context = null)
    {
        var window = _compositionRoot.CreateShellWindow(target, context);
        window.Show();
        window.Activate();
    }
}
