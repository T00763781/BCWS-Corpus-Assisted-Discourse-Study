using OpenFireside.Core.Abstractions.Persistence;

namespace OpenFireside.Infrastructure.Persistence;

public sealed class ArchiveDatabasePathProvider : IDatabasePathProvider
{
    public string GetDatabasePath()
    {
        var root = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "OpenFireside",
            "v2");
        Directory.CreateDirectory(root);
        return Path.Combine(root, "open-fireside-v2.sqlite");
    }
}
