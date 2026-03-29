namespace OpenFireside.Desktop.Services;

public sealed class NativeTrayHost
{
    public bool IsAvailable => false;
    public string StatusMessage => "Stubbed. Native tray icon requires icon.svg to .ico conversion for Windows NotifyIcon integration.";

    public void Initialize()
    {
        // Intentionally stubbed in the foundation turn.
    }
}
