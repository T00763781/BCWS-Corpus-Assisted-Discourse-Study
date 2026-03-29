using OpenFireside.Core.Abstractions.Persistence;
using OpenFireside.Infrastructure.Persistence;

namespace OpenFireside.Tests.Persistence;

public sealed class ArchiveSchemaBootstrapperTests
{
    [Fact]
    public async Task EnsureCreatedAsync_CreatesDatabaseFile()
    {
        var tempRoot = Path.Combine(Path.GetTempPath(), "open-fireside-native-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempRoot);

        var provider = new TestDatabasePathProvider(Path.Combine(tempRoot, "foundation.sqlite"));
        var factory = new SqliteConnectionFactory(provider);
        var bootstrapper = new ArchiveSchemaBootstrapper(factory);

        await bootstrapper.EnsureCreatedAsync();

        Assert.True(File.Exists(provider.GetDatabasePath()));
    }

    private sealed class TestDatabasePathProvider : IDatabasePathProvider
    {
        private readonly string _path;

        public TestDatabasePathProvider(string path)
        {
            _path = path;
        }

        public string GetDatabasePath() => _path;
    }
}
