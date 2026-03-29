using Microsoft.Data.Sqlite;
using OpenFireside.Core.Abstractions.Persistence;

namespace OpenFireside.Infrastructure.Persistence;

public sealed class SqliteConnectionFactory
{
    private readonly IDatabasePathProvider _databasePathProvider;

    public SqliteConnectionFactory(IDatabasePathProvider databasePathProvider)
    {
        _databasePathProvider = databasePathProvider;
    }

    public string DatabasePath => _databasePathProvider.GetDatabasePath();

    public SqliteConnection Create()
    {
        var builder = new SqliteConnectionStringBuilder
        {
            DataSource = DatabasePath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared
        };
        return new SqliteConnection(builder.ToString());
    }
}
