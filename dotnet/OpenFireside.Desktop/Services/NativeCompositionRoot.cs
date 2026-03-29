using OpenFireside.Core.Abstractions.Import;
using OpenFireside.Core.Abstractions.Persistence;
using OpenFireside.Core.Models;
using OpenFireside.Core.ValueObjects;
using OpenFireside.Desktop.ViewModels;
using OpenFireside.Desktop.Views;
using OpenFireside.Infrastructure.Import;
using OpenFireside.Infrastructure.Persistence;
using System.IO;

namespace OpenFireside.Desktop.Services;

public sealed class NativeCompositionRoot
{
    private readonly DesktopAssetCatalog _assetCatalog = new();
    private readonly NativeTrayHost _trayHost = new();
    private readonly IDatabasePathProvider _databasePathProvider = new ArchiveDatabasePathProvider();
    private readonly SqliteConnectionFactory _connectionFactory;
    private readonly IArchiveSchemaBootstrapper _schemaBootstrapper;
    private readonly ILegacyArchiveImportService _legacyArchiveImportService = new LegacyArchiveImportServiceStub();

    public NativeCompositionRoot()
    {
        _connectionFactory = new SqliteConnectionFactory(_databasePathProvider);
        _schemaBootstrapper = new ArchiveSchemaBootstrapper(_connectionFactory);
    }

    public async Task<ArchiveRuntimeInfo> BootstrapAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await _schemaBootstrapper.EnsureCreatedAsync(cancellationToken);
            _trayHost.Initialize();
            return new ArchiveRuntimeInfo(_connectionFactory.DatabasePath, true, "Native SQLite bootstrap completed.");
        }
        catch (Exception ex)
        {
            return new ArchiveRuntimeInfo(_connectionFactory.DatabasePath, false, $"Native SQLite bootstrap failed: {ex.Message}");
        }
    }

    public ShellWindow CreateShellWindow(NavigationTarget initialTarget, NavigationContext? context = null)
    {
        var runtimeInfo = new ArchiveRuntimeInfo(_connectionFactory.DatabasePath, File.Exists(_connectionFactory.DatabasePath), "Bootstrap status available in Settings.");
        var workspaceFactory = new WorkspaceFactory(runtimeInfo, _trayHost);
        var navigationService = new NavigationService(workspaceFactory);
        var windowLauncher = new WindowLauncherService(this);
        var shellViewModel = new ShellViewModel(
            navigationService,
            windowLauncher,
            _assetCatalog,
            runtimeInfo,
            _legacyArchiveImportService,
            _trayHost);

        navigationService.Navigate(initialTarget, context);
        return new ShellWindow
        {
            DataContext = shellViewModel
        };
    }
}
