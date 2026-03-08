import { useState } from 'react';
import { Loader2, MapPin, Layers, Building2, Search } from 'lucide-react';
import { PlotData, gisService } from '@/services/DDAGISService';
import { fetchNearbyPlots, getPlotAreaName } from '@/services/NearbyPlotsService';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SimilarLandPanelProps {
  plot: PlotData;
  onSelectPlot: (plot: PlotData) => void;
}

const TOLERANCE = 0.06; // ±6%

export function SimilarLandPanel({ plot, onSelectPlot }: SimilarLandPanelProps) {
  const [results, setResults] = useState<PlotData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const minArea = plot.area * (1 - TOLERANCE);
      const maxArea = plot.area * (1 + TOLERANCE);
      const minGfa = plot.gfa * (1 - TOLERANCE);
      const maxGfa = plot.gfa * (1 + TOLERANCE);

      const projectName = getPlotAreaName(plot);

      // Strategy 1: Search by area range + project name
      let found = await gisService.searchByArea(minArea, maxArea, projectName || undefined);

      // Strategy 2: Use normalized nearby-plots service for spatial fallback
      if (found.length < 5) {
        try {
          const { plots: spatialPlots } = await fetchNearbyPlots(plot, {
            radiusMeters: 5000,
            spatialLimit: 200,
            outputLimit: 200,
            includeAreaSearch: false, // already did area search above
          });
          const existingIds = new Set(found.map(p => p.id));
          spatialPlots.forEach(p => { if (!existingIds.has(p.id)) found.push(p); });
        } catch (e) {
          console.log('Spatial fallback search failed:', e);
        }
      }

      // Client-side: filter by area ±6%, GFA ±6%, exclude current plot
      const filtered = found.filter(p => {
        if (p.id === plot.id) return false;
        if (p.area < minArea || p.area > maxArea) return false;
        if (plot.gfa > 0 && p.gfa > 0) {
          if (p.gfa < minGfa || p.gfa > maxGfa) return false;
        }
        return true;
      });

      setResults(filtered);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-border/50 pt-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Similar Land</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSearch}
          disabled={loading}
          className="text-xs h-7 px-2"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Find Similar (±6%)'}
        </Button>
      </div>

      {/* Context info */}
      {!searched && (
        <p className="text-xs text-muted-foreground mb-2">
          Searches for plots with ±6% area & GFA in <span className="font-medium text-foreground">{getPlotAreaName(plot) || 'same area'}</span>
        </p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-xs text-muted-foreground">Searching comparable plots...</span>
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">No similar plots found within ±6% tolerance in the same area.</p>
      )}

      {results.length > 0 && (
        <ScrollArea className="max-h-48">
          <div className="space-y-1.5 pr-2">
            {results.map(p => (
              <button
                key={p.id}
                onClick={() => onSelectPlot(p)}
                className="w-full text-left px-3 py-2.5 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-all text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    Plot {p.id}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    p.status === 'Frozen' ? 'bg-destructive/20 text-destructive' :
                    p.status === 'Available' ? 'bg-success/20 text-success' :
                    'bg-warning/20 text-warning'
                  }`}>{p.status}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    {p.area.toLocaleString()} m²
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    GFA {p.gfa.toLocaleString()} m²
                  </span>
                </div>
                {p.location && (
                  <div className="text-muted-foreground mt-0.5">{p.location}</div>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
