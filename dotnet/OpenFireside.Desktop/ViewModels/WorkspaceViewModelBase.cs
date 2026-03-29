using OpenFireside.Core.ValueObjects;

namespace OpenFireside.Desktop.ViewModels;

public abstract class WorkspaceViewModelBase : ViewModelBase
{
    protected WorkspaceViewModelBase(NavigationTarget target, string title, string status)
    {
        Target = target;
        Title = title;
        Status = status;
    }

    public NavigationTarget Target { get; }
    public string Title { get; }
    public string Status { get; protected set; }
    public virtual string Summary => Status;
}
