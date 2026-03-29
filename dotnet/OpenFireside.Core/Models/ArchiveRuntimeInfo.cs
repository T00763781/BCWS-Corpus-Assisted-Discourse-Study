namespace OpenFireside.Core.Models;

public sealed record ArchiveRuntimeInfo(
    string DatabasePath,
    bool BootstrapSucceeded,
    string BootstrapMessage
);
