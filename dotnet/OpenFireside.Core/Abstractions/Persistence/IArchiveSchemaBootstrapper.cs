namespace OpenFireside.Core.Abstractions.Persistence;

public interface IArchiveSchemaBootstrapper
{
    Task EnsureCreatedAsync(CancellationToken cancellationToken = default);
}
