using OpenFireside.Core.Abstractions.Navigation;
using OpenFireside.Core.ValueObjects;

namespace OpenFireside.Desktop.Services;

public sealed class NavigationService : INavigationService
{
    private readonly WorkspaceFactory _workspaceFactory;

    public NavigationService(WorkspaceFactory workspaceFactory)
    {
        _workspaceFactory = workspaceFactory;
    }

    public object? CurrentWorkspace { get; private set; }
    public NavigationTarget CurrentTarget { get; private set; } = NavigationTarget.Dashboard;
    public event EventHandler? CurrentWorkspaceChanged;

    public void Navigate(NavigationTarget target, NavigationContext? context = null)
    {
        CurrentTarget = target;
        CurrentWorkspace = _workspaceFactory.Create(target, context);
        CurrentWorkspaceChanged?.Invoke(this, EventArgs.Empty);
    }
}
