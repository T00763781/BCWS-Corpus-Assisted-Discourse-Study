using OpenFireside.Core.Models;

namespace OpenFireside.Core.Abstractions.Import;

public interface ILegacyArchiveImportService
{
    LegacyImportContract GetContract();
    Task ValidateCompatibilityAsync(string legacyDatabasePath, CancellationToken cancellationToken = default);
    Task ImportAsync(string legacyDatabasePath, CancellationToken cancellationToken = default);
}
