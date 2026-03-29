using OpenFireside.Core.Models;
using OpenFireside.Core.ValueObjects;
using System.Collections.ObjectModel;

namespace OpenFireside.Desktop.ViewModels;

public sealed class MapsViewModel : WorkspaceViewModelBase
{
    public MapsViewModel()
        : base(NavigationTarget.Maps, "Maps", "Tabbed multi-source maps scaffold")
    {
        MapSources =
        [
            new MapSourceDescriptor("BCWS", "https://wildfiresituation.nrs.gov.bc.ca/map", "Primary BC Wildfire Service map surface."),
            new MapSourceDescriptor("CWFIS", "https://cwfis.cfs.nrcan.gc.ca/interactive-map", "Canadian Wildland Fire Information System interactive map."),
            new MapSourceDescriptor("ArcGIS", "https://www.arcgis.com/apps/mapviewer/index.html?layers=c600d51faabf4decaa613e3b86aa75f9", "ArcGIS Map Viewer layer set for wildfire context.")
        ];
    }

    public ObservableCollection<MapSourceDescriptor> MapSources { get; }
}
