using OpenFireside.Core.ValueObjects;

namespace OpenFireside.Desktop.ViewModels;

public sealed record NavItemViewModel(NavigationTarget Target, string Label);
