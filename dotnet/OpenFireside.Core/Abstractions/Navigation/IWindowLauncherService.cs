using OpenFireside.Core.ValueObjects;

namespace OpenFireside.Core.Abstractions.Navigation;

public interface IWindowLauncherService
{
    void Open(NavigationTarget target, NavigationContext? context = null);
}
