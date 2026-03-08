import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MapPin, Building2, Layers, TrendingUp, AlertTriangle, BarChart3, Search, Lightbulb, ArrowRight, X, Combine, Maximize2, Minimize2 } from 'lucide-react';
import { PlotData, gisService } from '@/services/DDAGISService';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import proj4 from 'proj4';

proj4.defs('EPSG:3997', '+proj=tmerc +lat_0=0 +lon_0=55.33333333333334 +k=1 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

const SQM_TO_SQFT = 10.7639;

function toWGS84(x: number, y: number): [number, number] {
  try {
    const result = proj4('EPSG:3997', 'EPSG:4326', [x, y]);
    return [result[1], result[0]];
  } catch {
    return [0, 0];
  }
}

interface LandAssemblyIntelligenceProps {
  plot: PlotData;
  onSelectPlot?: (plot: PlotData) => void;
  onClose: () => void;
}

interface AssemblyData {
  sizeCluster: {
    selectedSizeSqft: number;
    ranges: { label: string; minSqft: number; maxSqft: number; count: number }[];
    matchingScaleCount: number;
    insight: string;
  };
  completedBenchmarks: { plotSizeSqft: number; buildingType: string; gfaSqft: number; units: number; developer: string; floors: string }[];
  gfaComparison: { higherGfaPct: number; similarGfaPct: number; lowerGfaPct: number; assessment: string };
  assemblyOpportunity: { detected: boolean; plotCount: number; totalCombinedSqft: number; potentialScale: string; criteria: string };
  developmentPattern: { dominantType: string; patterns: { type: string; count: number; pct: number }[]; recommendation: string };
  absorptionRate: { studio: string; oneBR: string; twoBR: string; threeBR: string; expectedSellOut: string };
  comparablePlots: { plotId: string; sizeSqft: number; gfaSqft?: number; zoning: string; status: string; sizeDiffPct?: number; gfaDiffPct?: number }[];
  alternativeAreas: { area: string; demandScore: string; absorption: string; reason: string }[];
  aiInsight: string;
}

export function LandAssemblyIntelligence({ plot, onSelectPlot, onClose }: LandAssemblyIntelligenceProps) {
  const [data, setData] = useState<AssemblyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nearbyCount, setNearbyCount] = useState(0);

  useEffect(() => {
    runAnalysis();
  }, [plot.id]);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Fetch nearby plots - convert EPSG:3997 to WGS84
      const rawX = plot.x;
      const rawY = plot.y;
      let lat: number, lng: number;
      if (rawX > 1000 && rawY > 1000) {
        [lat, lng] = toWGS84(rawX, rawY);
      } else {
        lat = rawY;
        lng = rawX;
      }
      let nearbyPlots: PlotData[] = [];
      
      if (lat && lng && lat !== 0 && lng !== 0) {
        // Search entire area (5km) to get plots from the same community/master plan
        nearbyPlots = await gisService.searchByLocation(lat, lng, 5000, 200);
        // Exclude the selected plot
        nearbyPlots = nearbyPlots.filter(p => p.id !== plot.id);
      }

      // Also search by area name to ensure we get plots from the same community
      const areaName = plot.location || plot.project || plot.entity || '';
      if (areaName && areaName !== 'Dubai') {
        try {
          const areaPlots = await gisService.searchByArea(undefined, undefined, areaName);
          const existingIds = new Set(nearbyPlots.map(p => p.id));
          existingIds.add(plot.id);
          const uniqueAreaPlots = areaPlots.filter(p => !existingIds.has(p.id));
          nearbyPlots = [...nearbyPlots, ...uniqueAreaPlots];
        } catch (e) {
          console.log('Area search supplementary failed:', e);
        }
      }

      setNearbyCount(nearbyPlots.length);
      // Step 2: Call edge function
      const selectedPlot = {
        id: plot.id,
        location: plot.location || plot.project || plot.entity || '',
        areaSqft: Math.round(plot.area * SQM_TO_SQFT),
        gfaSqft: Math.round(plot.gfa * SQM_TO_SQFT),
        zoning: plot.zoning,
        status: plot.status,
        floors: plot.floors,
        developer: plot.developer || '',
        constructionStatus: plot.constructionStatus || '',
        landUseDetails: plot.landUseDetails || '',
      };

      const nearbyPlotsData = nearbyPlots.slice(0, 100).map(p => ({
        id: p.id,
        location: p.location || p.project || p.entity || '',
        areaSqft: Math.round(p.area * SQM_TO_SQFT),
        gfaSqft: Math.round(p.gfa * SQM_TO_SQFT),
        zoning: p.zoning,
        status: p.status,
        floors: p.floors,
        developer: p.developer || '',
        constructionStatus: p.constructionStatus || '',
        landUseDetails: p.landUseDetails || '',
      }));

      const { data: result, error: fnError } = await supabase.functions.invoke('land-assembly', {
        body: { selectedPlot, nearbyPlots: nearbyPlotsData }
      });

      if (fnError) throw new Error(fnError.message);
      if (result?.error) throw new Error(result.error);

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full glass-card glow-border flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))' }}>
            <Loader2 className="w-8 h-8 animate-spin text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Land Assembly Intelligence</h3>
            <p className="text-sm text-muted-foreground mt-1">Scanning 1km radius & analyzing {nearbyCount > 0 ? `${nearbyCount} nearby plots` : 'surrounding area'}...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full glass-card glow-border flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <h3 className="font-bold">Analysis Failed</h3>
          <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
          <Button variant="outline" size="sm" onClick={runAnalysis}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="h-full glass-card glow-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))' }}>
            <Combine className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Land Assembly Intelligence</h3>
            <p className="text-xs text-muted-foreground">Plot {plot.id} • {nearbyCount} nearby plots in 1km</p>
            {(plot.location || plot.project || plot.entity) && (
              <p className="text-[10px] text-primary font-medium">{plot.location || plot.project || plot.entity}</p>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* 1. Size Cluster */}
          <Section icon={<Layers className="w-4 h-4" />} title="Neighboring Plot Size Clusters" badge={`${data.sizeCluster.matchingScaleCount} matching`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border/50">
                  <th className="text-left py-1.5 text-muted-foreground font-medium">Size Range</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium">Plots</th>
                </tr></thead>
                <tbody>
                  {data.sizeCluster.ranges.map((r, i) => (
                    <tr key={i} className="border-b border-border/20">
                      <td className="py-1.5">{r.label}</td>
                      <td className="text-right font-semibold">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{data.sizeCluster.insight}</p>
          </Section>

          {/* 2. Completed Building Benchmarks */}
          {data.completedBenchmarks.length > 0 && (
            <Section icon={<Building2 className="w-4 h-4" />} title="Completed Building Benchmarks">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border/50">
                    <th className="text-left py-1.5 text-muted-foreground font-medium">Land Size</th>
                    <th className="text-left py-1.5 text-muted-foreground font-medium">Type</th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium">GFA</th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium">Units</th>
                  </tr></thead>
                  <tbody>
                    {data.completedBenchmarks.map((b, i) => (
                      <tr key={i} className="border-b border-border/20">
                        <td className="py-1.5">{b.plotSizeSqft.toLocaleString()} sqft</td>
                        <td className="py-1.5">{b.floors} {b.buildingType}</td>
                        <td className="text-right">{b.gfaSqft.toLocaleString()}</td>
                        <td className="text-right font-semibold">{b.units}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* 3. GFA Comparison */}
          <Section icon={<BarChart3 className="w-4 h-4" />} title="GFA Comparison Analysis">
            <div className="space-y-2">
              <Bar label="Higher GFA" pct={data.gfaComparison.higherGfaPct} color="hsl(var(--primary))" />
              <Bar label="Similar GFA" pct={data.gfaComparison.similarGfaPct} color="hsl(var(--secondary))" />
              <Bar label="Lower GFA" pct={data.gfaComparison.lowerGfaPct} color="hsl(var(--muted-foreground))" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{data.gfaComparison.assessment}</p>
          </Section>

          {/* 4. Assembly Opportunity */}
          <Section icon={<Combine className="w-4 h-4" />} title="Land Assembly Opportunity" badge={data.assemblyOpportunity.detected ? 'Detected' : 'None'} badgeVariant={data.assemblyOpportunity.detected ? 'default' : 'secondary'}>
            {data.assemblyOpportunity.detected ? (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Combinable Plots:</span> <span className="font-bold">{data.assemblyOpportunity.plotCount}</span></div>
                  <div><span className="text-muted-foreground">Total Size:</span> <span className="font-bold">{data.assemblyOpportunity.totalCombinedSqft.toLocaleString()} sqft</span></div>
                </div>
                <p className="text-xs font-medium">{data.assemblyOpportunity.potentialScale}</p>
                <p className="text-xs text-muted-foreground">{data.assemblyOpportunity.criteria}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No adjacent assembly opportunities detected.</p>
            )}
          </Section>

          {/* 5. Development Pattern */}
          <Section icon={<TrendingUp className="w-4 h-4" />} title="Matching Development Pattern" badge={data.developmentPattern.dominantType}>
            <p className="text-[10px] text-primary font-medium mb-1.5">Based on {nearbyCount} real plots in {plot.location || plot.project || plot.entity || 'this area'}</p>
            <div className="space-y-1.5">
              {data.developmentPattern.patterns.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span>{p.type}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${p.pct}%` }} />
                    </div>
                    <span className="font-semibold w-8 text-right">{p.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{data.developmentPattern.recommendation}</p>
          </Section>

          {/* 6. Absorption Rate */}
          <Section icon={<TrendingUp className="w-4 h-4" />} title="Absorption Rate Analysis">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Studio', value: data.absorptionRate.studio },
                { label: '1BR', value: data.absorptionRate.oneBR },
                { label: '2BR', value: data.absorptionRate.twoBR },
                { label: '3BR', value: data.absorptionRate.threeBR },
              ].map(item => (
                <div key={item.label} className="p-2 rounded-md bg-muted/30 text-center">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-bold">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 p-2 rounded-md bg-primary/10 text-xs">
              <span className="text-muted-foreground">Expected Sell-Out: </span>
              <span className="font-bold text-primary">{data.absorptionRate.expectedSellOut}</span>
            </div>
          </Section>

          {/* 7. Comparable Plots (by GFA + Plot Size) */}
          {data.comparablePlots.length > 0 && (
            <Section icon={<Search className="w-4 h-4" />} title="Comparable Plots" badge={`${data.comparablePlots.length} matched`}>
              <p className="text-[10px] text-primary font-medium mb-1.5">Matched by Plot Size ±30% & GFA ±30%</p>
              <div className="space-y-1.5">
                {data.comparablePlots.slice(0, 6).map((cp, i) => (
                  <div key={i} className="text-xs p-2 rounded-md bg-muted/20 hover:bg-muted/30 transition-colors space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-primary" />
                        <span className="font-medium">Plot {cp.plotId}</span>
                      </div>
                      <Badge variant={cp.status === 'Available' || cp.status === 'Empty' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">{cp.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Area: {(cp.sizeSqft || 0).toLocaleString()} sqft</span>
                      <span>GFA: {(cp.gfaSqft || 0).toLocaleString()} sqft</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">{cp.zoning}</span>
                      {(cp.sizeDiffPct !== undefined || cp.gfaDiffPct !== undefined) && (
                        <span className="text-primary font-medium">
                          Δ Size {cp.sizeDiffPct != null ? `${cp.sizeDiffPct > 0 ? '+' : ''}${cp.sizeDiffPct}%` : '—'} · GFA {cp.gfaDiffPct != null ? `${cp.gfaDiffPct > 0 ? '+' : ''}${cp.gfaDiffPct}%` : '—'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 8. Alternative Areas */}
          {data.alternativeAreas.length > 0 && (
            <Section icon={<ArrowRight className="w-4 h-4" />} title="Alternative Development Areas">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border/50">
                    <th className="text-left py-1.5 text-muted-foreground font-medium">Area</th>
                    <th className="text-center py-1.5 text-muted-foreground font-medium">Demand</th>
                    <th className="text-center py-1.5 text-muted-foreground font-medium">Absorption</th>
                  </tr></thead>
                  <tbody>
                    {data.alternativeAreas.map((a, i) => (
                      <tr key={i} className="border-b border-border/20">
                        <td className="py-1.5 font-medium">{a.area}</td>
                        <td className="text-center">
                          <Badge variant={a.demandScore === 'High' ? 'default' : 'secondary'} className="text-[10px]">{a.demandScore}</Badge>
                        </td>
                        <td className="text-center">
                          <Badge variant={a.absorption === 'Fast' ? 'default' : 'secondary'} className="text-[10px]">{a.absorption}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* 9. AI Insight */}
          <Section icon={<Lightbulb className="w-4 h-4" />} title="AI Development Insight">
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
              <p className="text-xs leading-relaxed">{data.aiInsight}</p>
            </div>
          </Section>
        </div>
      </ScrollArea>
    </div>
  );
}

function Section({ icon, title, badge, badgeVariant, children }: { icon: React.ReactNode; title: string; badge?: string; badgeVariant?: 'default' | 'secondary'; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-primary">{icon}</span>
        <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">{title}</h4>
        {badge && <Badge variant={badgeVariant || 'default'} className="text-[10px] px-1.5 py-0 ml-auto">{badge}</Badge>}
      </div>
      {children}
    </div>
  );
}

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-semibold w-8 text-right">{pct}%</span>
    </div>
  );
}
