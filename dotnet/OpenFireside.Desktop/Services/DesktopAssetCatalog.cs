using System.IO;

namespace OpenFireside.Desktop.Services;

public sealed class DesktopAssetCatalog
{
    public string BrandIconSvgPath => Resolve("icon.svg");
    public string OpenSidebarSvgPath => Resolve("open-sidebar.svg");
    public string CloseSidebarSvgPath => Resolve("close-sidebar.svg");
    public string PinnedSvgPath => Resolve("pinned.svg");
    public string NonPinnedSvgPath => Resolve("non-pinned.svg");

    private static string Resolve(string fileName) =>
        Path.Combine(AppContext.BaseDirectory, "Assets", fileName);
}
