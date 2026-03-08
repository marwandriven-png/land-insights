import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, AlertTriangle, X, TreePine, Zap, Eye, Star, CheckCircle2, AlertCircle, TrendingUp, Lightbulb, MapPin, Maximize2, Minimize2 } from 'lucide-react';
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
    return [result[1], result[0]]; // [lat, lng]
  } catch {
    return [0, 0];
  }
}
interface UrbanContextAnalysisProps {
  plot: PlotData;
  onClose: () => void;
}

interface UrbanData {
  utilities: { type: string; distance: string; impact: string; detail: string }[];
  greenSpaces: { name: string; type: string; distance: string; impact: string }[];
  streetFacing: { plotType: string; roadWidth: string; frontage: string; streetHierarchy: string; insight: string };
  viewOrientation: { facing: string; direction: string; impact: string; premiumEstimate: string };
  urbanScore: { overall: number; greenSpace: number; roadAccess: number; infrastructureImpact: number; amenities: number; walkability: number };
  positiveSignals: string[];
  negativeSignals: string[];
  valueImpact: { factor: string; impact: string; detail: string }[];
  aiInsight: string;
}

export function UrbanContextAnalysis({ plot, onClose }: UrbanContextAnalysisProps) {
  const [data, setData] = useState<UrbanData | null>(null);
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
      const rawX = plot.x;
      const rawY = plot.y;
      let lat: number, lng: number;
      
      // Detect if coordinates are in EPSG:3997 (projected) vs WGS84
      if (rawX > 1000 && rawY > 1000) {
        [lat, lng] = toWGS84(rawX, rawY);
      } else {
        lat = rawY;
        lng = rawX;
      }
      
      let nearbyPlots: PlotData[] = [];

      if (lat && lng && lat !== 0 && lng !== 0) {
        nearbyPlots = await gisService.searchByLocation(lat, lng, 5000, 200);
        nearbyPlots = nearbyPlots.filter(p => p.id !== plot.id);
      }
      setNearbyCount(nearbyPlots.length);

      // Fetch real affection plan data for building setbacks
      let buildingSetbacks: Record<string, string | null> | null = null;
      let podiumSetbacks: Record<string, string | null> | null = null;
      try {
        const affection = await gisService.fetchAffectionPlan(plot.id);
        if (affection) {
          buildingSetbacks = affection.buildingSetbacks;
          podiumSetbacks = affection.podiumSetbacks;
        }
      } catch (e) {
        console.log('Affection plan fetch skipped:', e);
      }

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
        buildingSetbacks: buildingSetbacks || null,
        podiumSetbacks: podiumSetbacks || null,
        lat: lat,
        lng: lng,
      };

      const nearbyPlotsData = nearbyPlots.slice(0, 100).map(p => {
        const [pLat, pLng] = (p.x > 1000 && p.y > 1000) ? toWGS84(p.x, p.y) : [p.y, p.x];
        return {
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
          lat: pLat,
          lng: pLng,
        };
      });

      const { data: result, error: fnError } = await supabase.functions.invoke('urban-context', {
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
            <h3 className="font-bold text-lg">Urban Context Analysis</h3>
            <p className="text-sm text-muted-foreground mt-1">Scanning environment within 5km radius...</p>
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

  const impactColor = (impact: string) => {
    const l = impact.toLowerCase();
    if (l === 'positive') return 'text-green-400';
    if (l === 'negative') return 'text-destructive';
    return 'text-muted-foreground';
  };

  const impactBadgeVariant = (impact: string): 'default' | 'secondary' | 'destructive' => {
    const l = impact.toLowerCase();
    if (l === 'positive') return 'default';
    if (l === 'negative') return 'destructive';
    return 'secondary';
  };

  const scoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-primary';
    if (score >= 4) return 'text-yellow-400';
    return 'text-destructive';
  };

  return (
    <div className="h-full glass-card glow-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))' }}>
            <TreePine className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Urban Context Analysis</h3>
            <p className="text-xs text-muted-foreground">Plot {plot.id} • {nearbyCount} plots scanned</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`text-lg font-black ${scoreColor(data.urbanScore.overall)}`}>
            {data.urbanScore.overall}/10
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">

          {/* 1. Utilities & Infrastructure */}
          <Section icon={<Zap className="w-4 h-4" />} title="Nearby Utilities & Infrastructure">
            {data.utilities.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border/50">
                    <th className="text-left py-1.5 text-muted-foreground font-medium">Type</th>
                    <th className="text-center py-1.5 text-muted-foreground font-medium">Distance</th>
                    <th className="text-center py-1.5 text-muted-foreground font-medium">Impact</th>
                  </tr></thead>
                  <tbody>
                    {data.utilities.map((u, i) => (
                      <tr key={i} className="border-b border-border/20">
                        <td className="py-1.5 font-medium">{u.type}</td>
                        <td className="text-center">{u.distance}</td>
                        <td className="text-center">
                          <Badge variant={impactBadgeVariant(u.impact)} className="text-[10px]">{u.impact}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No significant utility infrastructure detected.</p>
            )}
          </Section>

          {/* 2. Green Spaces */}
          <Section icon={<TreePine className="w-4 h-4" />} title="Parks, Gardens & Green Spaces">
            {data.greenSpaces.length > 0 ? (
              <div className="space-y-1.5">
                {data.greenSpaces.map((g, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/20">
                    <div className="flex items-center gap-2">
                      <TreePine className="w-3.5 h-3.5 text-green-400" />
                      <div>
                        <span className="font-medium">{g.name}</span>
                        <span className="text-muted-foreground ml-1">({g.type})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{g.distance}</span>
                      <Badge variant={impactBadgeVariant(g.impact)} className="text-[10px]">{g.impact}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No green spaces detected nearby.</p>
            )}
          </Section>

          {/* 3. Street Facing */}
          <Section icon={<MapPin className="w-4 h-4" />} title="Street Facing Analysis">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <MetricBox label="Plot Type" value={data.streetFacing.plotType} />
              <MetricBox label="Road Width" value={data.streetFacing.roadWidth} />
              <MetricBox label="Frontage" value={data.streetFacing.frontage} />
              <MetricBox label="Street Hierarchy" value={data.streetFacing.streetHierarchy} />
            </div>
            {/* Real DDA Setback Data */}
            {plot.rawAttributes && (
              <div className="mt-2 p-2 rounded-md bg-muted/20 border border-border/30">
                <p className="text-[10px] font-bold uppercase text-primary mb-1.5">DDA Building Setbacks (meters)</p>
                <div className="grid grid-cols-4 gap-1.5 text-xs text-center">
                  {['BUILDING_SETBACK_SIDE1', 'BUILDING_SETBACK_SIDE2', 'BUILDING_SETBACK_SIDE3', 'BUILDING_SETBACK_SIDE4'].map((key, i) => (
                    <div key={i} className="p-1.5 rounded bg-muted/30">
                      <p className="text-[9px] text-muted-foreground">Side {i + 1}</p>
                      <p className="font-bold">{(plot.rawAttributes as any)?.[key] || 'N/A'}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] font-bold uppercase text-primary mt-2 mb-1.5">Podium Setbacks (meters)</p>
                <div className="grid grid-cols-4 gap-1.5 text-xs text-center">
                  {['PODIUM_SETBACK_SIDE1', 'PODIUM_SETBACK_SIDE2', 'PODIUM_SETBACK_SIDE3', 'PODIUM_SETBACK_SIDE4'].map((key, i) => (
                    <div key={i} className="p-1.5 rounded bg-muted/30">
                      <p className="text-[9px] text-muted-foreground">Side {i + 1}</p>
                      <p className="font-bold">{(plot.rawAttributes as any)?.[key] || 'N/A'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">{data.streetFacing.insight}</p>
          </Section>

          {/* 4. View & Orientation */}
          <Section icon={<Eye className="w-4 h-4" />} title="View & Orientation Intelligence">
            <div className="p-3 rounded-lg bg-muted/20 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Facing: </span><span className="font-bold">{data.viewOrientation.facing}</span></div>
                <div><span className="text-muted-foreground">Direction: </span><span className="font-bold">{data.viewOrientation.direction}</span></div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={impactColor(data.viewOrientation.impact)}>{data.viewOrientation.impact} Impact</span>
                <span className="font-bold text-primary">{data.viewOrientation.premiumEstimate}</span>
              </div>
            </div>
          </Section>

          {/* 5. Urban Quality Score */}
          <Section icon={<Star className="w-4 h-4" />} title="Urban Quality Score" badge={`${data.urbanScore.overall}/10`}>
            <div className="space-y-2">
              {[
                { label: 'Green Space', score: data.urbanScore.greenSpace },
                { label: 'Road Access', score: data.urbanScore.roadAccess },
                { label: 'Infrastructure', score: data.urbanScore.infrastructureImpact },
                { label: 'Amenities', score: data.urbanScore.amenities },
                { label: 'Walkability', score: data.urbanScore.walkability },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  <span className="w-24 text-muted-foreground">{item.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${item.score * 10}%`,
                        background: item.score >= 8 ? 'hsl(var(--primary))' : item.score >= 6 ? 'hsl(var(--secondary))' : 'hsl(var(--muted-foreground))'
                      }}
                    />
                  </div>
                  <span className={`font-bold w-6 text-right ${scoreColor(item.score)}`}>{item.score}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* 6. Positive & Negative Signals */}
          <Section icon={<CheckCircle2 className="w-4 h-4" />} title="Environmental Signals">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-green-400 mb-1.5">Positive</p>
                {data.positiveSignals.map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </div>
                ))}
                {data.positiveSignals.length === 0 && <p className="text-xs text-muted-foreground">None detected</p>}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-destructive mb-1.5">Negative</p>
                {data.negativeSignals.map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </div>
                ))}
                {data.negativeSignals.length === 0 && <p className="text-xs text-muted-foreground">None detected</p>}
              </div>
            </div>
          </Section>

          {/* 7. Developer Value Impact */}
          <Section icon={<TrendingUp className="w-4 h-4" />} title="Developer Value Impact">
            {data.valueImpact.length > 0 ? (
              <div className="space-y-1.5">
                {data.valueImpact.map((v, i) => (
                  <div key={i} className="p-2 rounded-md bg-muted/20 text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium">{v.factor}</span>
                      <span className={`font-bold ${v.impact.includes('+') ? 'text-green-400' : 'text-muted-foreground'}`}>{v.impact}</span>
                    </div>
                    <p className="text-muted-foreground">{v.detail}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No significant value impacts detected.</p>
            )}
          </Section>

          {/* 8. AI Environmental Insight */}
          <Section icon={<Lightbulb className="w-4 h-4" />} title="AI Environmental Insight">
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
              <p className="text-xs leading-relaxed">{data.aiInsight}</p>
            </div>
          </Section>

        </div>
      </ScrollArea>
    </div>
  );
}

function Section({ icon, title, badge, children }: { icon: React.ReactNode; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-primary">{icon}</span>
        <h4 className="text-xs font-bold uppercase tracking-wide text-foreground">{title}</h4>
        {badge && <Badge variant="default" className="text-[10px] px-1.5 py-0 ml-auto">{badge}</Badge>}
      </div>
      {children}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-md bg-muted/30 text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-bold mt-0.5">{value}</p>
    </div>
  );
}
