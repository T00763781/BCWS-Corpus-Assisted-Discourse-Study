using OpenFireside.Core.ValueObjects;

namespace OpenFireside.Core.Abstractions.Navigation;

public interface INavigationService
{
    object? CurrentWorkspace { get; }
    NavigationTarget CurrentTarget { get; }
    event EventHandler? CurrentWorkspaceChanged;
    void Navigate(NavigationTarget target, NavigationContext? context = null);
}
