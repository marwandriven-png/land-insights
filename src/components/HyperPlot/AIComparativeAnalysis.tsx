import { useState } from 'react';
import { Brain, TrendingUp, Shield, AlertTriangle, DollarSign, Layers, Target, Loader2, BarChart3, CheckCircle, XCircle, Minus, Combine, TreePine, MapPin, ArrowRight, Lightbulb } from 'lucide-react';
import { PlotData, gisService } from '@/services/DDAGISService';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';

const SQM_TO_SQFT = 10.7639;

interface AIComparisonResult {
  plotScores: {
    plotA: ScoreBreakdown;
    plotB: ScoreBreakdown;
  };
  demandHeatmap: {
    distribution: { studio: number; oneBR: number; twoBR: number; threeBR: number };
    plotABenefit: string;
    plotBBenefit: string;
    sellOutTimeline: { plotA: string; plotB: string };
  };
  risks: {
    plotA: RiskItem[];
    plotB: RiskItem[];
  };
  valuationOpportunity: {
    plotA: ValuationData;
    plotB: ValuationData;
  };
  landAssembly: {
    plotA: AssemblyData;
    plotB: AssemblyData;
  };
  landAssemblyIntelligence?: {
    plotA: LandAssemblyIntel;
    plotB: LandAssemblyIntel;
  };
  urbanContext?: {
    plotA: UrbanContextData;
    plotB: UrbanContextData;
  };
  exitStrategies: {
    sellLand: { plotA: string; plotB: string };
    developProject: { plotA: string; plotB: string };
    jointVenture: { plotA: string; plotB: string };
    bestStrategyA: string;
    bestStrategyB: string;
  };
  verdict: {
    winner: 'plotA' | 'plotB';
    reasoning: string[];
    recommendedAction: string;
    confidenceLevel: 'High' | 'Medium' | 'Low';
  };
}

interface ScoreBreakdown {
  overall: number;
  demandStrength: number;
  supplyRisk: number;
  priceTrend: number;
  developmentPotential: number;
  exitLiquidity: number;
}

interface RiskItem { risk: string; severity: 'low' | 'medium' | 'high'; detail: string; }
interface ValuationData { marketPSF: number; plotPSF: number; undervaluation: number; classification: string; }
interface AssemblyData { detected: boolean; adjacentPlots: number; totalPotentialSqft: number; potentialUse: string; valueIncrease: string; }

interface LandAssemblyIntel {
  sizeClusterInsight: string;
  matchingScaleCount: number;
  dominantDevType: string;
  gfaAssessment: string;
  assemblyPotentialScale: string;
  absorptionRate: { studio: string; oneBR: string; twoBR: string; threeBR: string; expectedSellOut: string };
  alternativeAreas: { area: string; demandScore: string; reason: string }[];
}

interface UrbanContextData {
  urbanScore: { overall: number; greenSpace: number; roadAccess: number; infrastructureImpact: number; amenities: number; walkability: number };
  streetFacing: { plotType: string; roadWidth: string; insight: string };
  viewOrientation: { facing: string; premiumEstimate: string };
  positiveSignals: string[];
  negativeSignals: string[];
}

interface Props {
  plotA: PlotData;
  plotB: PlotData;
  onClose: () => void;
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = (score / max) * 100;
  const color = score >= 7 ? 'bg-success' : score >= 5 ? 'bg-warning' : 'bg-destructive';
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 bg-muted/50 rounded-full h-2">
        <div className={`h-2 rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs font-bold w-8 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    low: 'border-success/40 text-success bg-success/10',
    medium: 'border-warning/40 text-warning bg-warning/10',
    high: 'border-destructive/40 text-destructive bg-destructive/10',
  };
  return <Badge variant="outline" className={`text-xs ${styles[severity] || ''}`}>{severity}</Badge>;
}

function ClassificationBadge({ classification }: { classification: string }) {
  const styles: Record<string, string> = {
    'Strong Opportunity': 'border-success/40 text-success bg-success/10',
    'Moderate Opportunity': 'border-primary/40 text-primary bg-primary/10',
    'Fair Value': 'border-muted-foreground/40 text-muted-foreground bg-muted/30',
    'Overpriced': 'border-destructive/40 text-destructive bg-destructive/10',
  };
  return <Badge variant="outline" className={`text-xs ${styles[classification] || ''}`}>{classification}</Badge>;
}

function SectionHeader({ num, icon: Icon, title }: { num: number; icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border/50">
      <span className="w-7 h-7 flex items-center justify-center rounded-md bg-gradient-to-br from-primary to-cyan-500 text-primary-foreground font-extrabold text-xs shrink-0">{num}</span>
      <Icon className="w-4 h-4 text-primary" />
      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{title}</h3>
    </div>
  );
}

function UrbanScoreRadar({ label, data }: { label: string; data: UrbanContextData }) {
  const categories = [
    { key: 'greenSpace', label: 'Green' },
    { key: 'roadAccess', label: 'Roads' },
    { key: 'infrastructureImpact', label: 'Infra' },
    { key: 'amenities', label: 'Amenities' },
    { key: 'walkability', label: 'Walk' },
  ] as const;

  return (
    <div className="p-4 rounded-xl border border-border/50 bg-card/50">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-sm">{label}</span>
        <span className={`text-2xl font-black font-mono ${data.urbanScore.overall >= 7 ? 'text-success' : data.urbanScore.overall >= 5 ? 'text-warning' : 'text-destructive'}`}>
          {data.urbanScore.overall.toFixed(1)}
        </span>
      </div>
      <div className="space-y-2 mb-3">
        {categories.map(c => (
          <div key={c.key} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16 shrink-0">{c.label}</span>
            <ScoreBar score={data.urbanScore[c.key]} />
          </div>
        ))}
      </div>
      <div className="space-y-2 text-xs">
        <div className="p-2 rounded-md bg-muted/30">
          <span className="text-muted-foreground">Street: </span>
          <span className="font-medium">{data.streetFacing.plotType} • {data.streetFacing.roadWidth}</span>
        </div>
        <div className="p-2 rounded-md bg-muted/30">
          <span className="text-muted-foreground">View: </span>
          <span className="font-medium">{data.viewOrientation.facing}</span>
          <span className="text-primary ml-1">({data.viewOrientation.premiumEstimate})</span>
        </div>
      </div>
      {data.positiveSignals.length > 0 && (
        <div className="mt-2 space-y-1">
          {data.positiveSignals.slice(0, 3).map((s, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              <CheckCircle className="w-3 h-3 text-success mt-0.5 shrink-0" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
      {data.negativeSignals.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {data.negativeSignals.slice(0, 2).map((s, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              <XCircle className="w-3 h-3 text-destructive mt-0.5 shrink-0" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AIComparativeAnalysis({ plotA, plotB, onClose }: Props) {
  const [result, setResult] = useState<AIComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState('');

  const plotALabel = plotA.id;
  const plotBLabel = plotB.id;
  const plotAArea = plotA.location || plotA.project || plotA.entity || '';
  const plotBArea = plotB.location || plotB.project || plotB.entity || '';

  const fetchNearbyPlots = async (plot: PlotData) => {
    const lat = plot.y;
    const lng = plot.x;
    if (!lat || !lng || lat === 0 || lng === 0) return [];
    try {
      const nearby = await gisService.searchByLocation(lat, lng, 1000);
      return nearby.filter(p => p.id !== plot.id).slice(0, 30).map(p => ({
        id: p.id,
        location: p.location || p.project || p.entity || '',
        areaSqft: Math.round(p.area * SQM_TO_SQFT),
        gfaSqft: Math.round(p.gfa * SQM_TO_SQFT),
        zoning: p.zoning,
        status: p.status,
        floors: p.floors,
        developer: p.developer || '',
      }));
    } catch {
      return [];
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      setLoadingStep('Scanning 1km radius around both plots...');
      const [nearbyA, nearbyB] = await Promise.all([
        fetchNearbyPlots(plotA),
        fetchNearbyPlots(plotB),
      ]);

      setLoadingStep('Running AI comparative analysis across 9 dimensions...');
      const marketContext = `
Plot A location: ${plotA.location || 'Dubai'}. Zoning: ${plotA.zoning}. Area: ${Math.round(plotA.area * SQM_TO_SQFT)} sqft. GFA: ${Math.round(plotA.gfa * SQM_TO_SQFT)} sqft. Nearby: ${nearbyA.length} plots.
Plot B location: ${plotB.location || 'Dubai'}. Zoning: ${plotB.zoning}. Area: ${Math.round(plotB.area * SQM_TO_SQFT)} sqft. GFA: ${Math.round(plotB.gfa * SQM_TO_SQFT)} sqft. Nearby: ${nearbyB.length} plots.
Use Dubai market averages for these zones. Consider current Q1 2026 market conditions.`;

      const { data, error: fnError } = await supabase.functions.invoke('plot-comparison', {
        body: {
          plotA: {
            id: plotA.id, location: plotA.location,
            areaSqft: Math.round(plotA.area * SQM_TO_SQFT),
            gfaSqft: Math.round(plotA.gfa * SQM_TO_SQFT),
            zoning: plotA.zoning, status: plotA.status, floors: plotA.floors, developer: plotA.developer,
          },
          plotB: {
            id: plotB.id, location: plotB.location,
            areaSqft: Math.round(plotB.area * SQM_TO_SQFT),
            gfaSqft: Math.round(plotB.gfa * SQM_TO_SQFT),
            zoning: plotB.zoning, status: plotB.status, floors: plotB.floors, developer: plotB.developer,
          },
          marketContext,
          nearbyPlotsA: nearbyA,
          nearbyPlotsB: nearbyB,
        },
      });

      if (fnError) throw new Error(fnError.message || 'Analysis failed');
      if (data?.error) throw new Error(data.error);
      setResult(data as AIComparisonResult);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Analysis failed';
      setError(msg);
      toast({ title: 'Analysis Failed', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  if (!result && !loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center glass-card glow-border p-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))' }}>
          <Brain className="w-8 h-8 text-primary-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">AI Comparative Analysis</h2>
        <p className="text-sm text-muted-foreground text-center mb-3 max-w-md">
          Generate an advanced investment comparison between <span className="font-bold text-foreground">{plotALabel}</span> and <span className="font-bold text-foreground">{plotBLabel}</span>
        </p>
        <div className="flex flex-wrap gap-1.5 justify-center mb-6">
          {['Intelligence Score', 'Demand Heatmap', 'Risk Detection', 'Valuation', 'Assembly', 'Assembly Intel', 'Urban Context', 'Exit Strategy', 'AI Verdict'].map(s => (
            <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
          ))}
        </div>
        <Button onClick={runAnalysis} size="lg" className="gap-2">
          <Brain className="w-4 h-4" />
          Run 9-Dimension Analysis
        </Button>
        {error && <p className="text-sm text-destructive mt-4">{error}</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center glass-card glow-border">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <h3 className="text-lg font-bold mb-1">Analyzing Plots...</h3>
        <p className="text-sm text-muted-foreground">{loadingStep || 'Running AI comparative analysis'}</p>
      </div>
    );
  }

  if (!result) return null;

  const r = result;
  const winnerLabel = r.verdict.winner === 'plotA' ? plotALabel : plotBLabel;
  const scoreFactors: { key: keyof Omit<ScoreBreakdown, 'overall'>; label: string }[] = [
    { key: 'demandStrength', label: 'Demand Strength' },
    { key: 'supplyRisk', label: 'Supply Risk' },
    { key: 'priceTrend', label: 'Price Trend' },
    { key: 'developmentPotential', label: 'Development Potential' },
    { key: 'exitLiquidity', label: 'Exit Liquidity' },
  ];

  let sectionNum = 0;

  return (
    <div className="h-full glass-card glow-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))' }}>
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-base">AI Comparative Analysis</h2>
            <p className="text-xs text-muted-foreground">{plotALabel} vs {plotBLabel} • 9 dimensions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={runAnalysis} disabled={loading}>Re-analyze</Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-5 space-y-8">

          {/* 1. Plot Intelligence Score */}
          <section>
            <SectionHeader num={++sectionNum} icon={Target} title="Plot Intelligence Score" />
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[{ label: plotALabel, area: plotAArea, scores: r.plotScores.plotA }, { label: plotBLabel, area: plotBArea, scores: r.plotScores.plotB }].map(({ label, area, scores }) => (
                <div key={label} className={`p-4 rounded-xl border ${scores.overall === Math.max(r.plotScores.plotA.overall, r.plotScores.plotB.overall) ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-card/50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-bold text-sm">{label}</span>
                      {area && <div className="text-[10px] text-muted-foreground">{area}</div>}
                    </div>
                    <span className={`text-2xl font-black font-mono ${scores.overall >= 7 ? 'text-success' : scores.overall >= 5 ? 'text-warning' : 'text-destructive'}`}>
                      {scores.overall.toFixed(1)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {scoreFactors.map(f => (
                      <div key={f.key} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-32 shrink-0">{f.label}</span>
                        <ScoreBar score={scores[f.key]} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                {winnerLabel} leads with {Math.max(r.plotScores.plotA.overall, r.plotScores.plotB.overall).toFixed(1)} / 10
              </Badge>
            </div>
          </section>

          {/* 2. Demand Heatmap */}
          <section>
            <SectionHeader num={++sectionNum} icon={BarChart3} title="Demand Heatmap" />
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Studio', pct: r.demandHeatmap.distribution.studio },
                { label: '1 BR', pct: r.demandHeatmap.distribution.oneBR },
                { label: '2 BR', pct: r.demandHeatmap.distribution.twoBR },
                { label: '3 BR', pct: r.demandHeatmap.distribution.threeBR },
              ].map(({ label, pct }) => (
                <div key={label} className="text-center p-3 rounded-xl border border-border/50 bg-card/50">
                  <div className="text-xs text-muted-foreground mb-1">{label}</div>
                  <div className={`text-xl font-black font-mono ${pct >= 30 ? 'text-primary' : pct >= 15 ? 'text-foreground' : 'text-muted-foreground'}`}>{pct}%</div>
                  <div className="mt-1.5 bg-muted/50 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-border/30 bg-card/30">
                <div className="text-xs font-bold text-muted-foreground mb-1">{plotALabel} Benefit</div>
                <p className="text-xs text-foreground">{r.demandHeatmap.plotABenefit}</p>
              </div>
              <div className="p-3 rounded-lg border border-border/30 bg-card/30">
                <div className="text-xs font-bold text-muted-foreground mb-1">{plotBLabel} Benefit</div>
                <p className="text-xs text-foreground">{r.demandHeatmap.plotBBenefit}</p>
              </div>
            </div>
            <div className="mt-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <div className="text-xs font-bold text-primary mb-1">Expected Sell-Out Timeline</div>
              <div className="flex gap-6 text-sm">
                <span><span className="font-bold">{plotALabel}:</span> {r.demandHeatmap.sellOutTimeline.plotA}</span>
                <span><span className="font-bold">{plotBLabel}:</span> {r.demandHeatmap.sellOutTimeline.plotB}</span>
              </div>
            </div>
          </section>

          {/* 3. Risk Detection */}
          <section>
            <SectionHeader num={++sectionNum} icon={AlertTriangle} title="Risk Detection System" />
            <div className="grid grid-cols-2 gap-4">
              {[{ label: plotALabel, area: plotAArea, risks: r.risks.plotA }, { label: plotBLabel, area: plotBArea, risks: r.risks.plotB }].map(({ label, area, risks }) => (
                <div key={label} className="p-4 rounded-xl border border-border/50 bg-card/50">
                  <div className="font-bold text-sm mb-3 flex items-center gap-2">
                    <div><span>{label}</span>{area && <div className="text-[10px] text-muted-foreground font-normal">{area}</div>}</div>
                    {risks.every(r => r.severity === 'low') && <Badge variant="outline" className="text-xs border-success/40 text-success bg-success/10">Low Risk</Badge>}
                    {risks.some(r => r.severity === 'high') && <Badge variant="outline" className="text-xs border-destructive/40 text-destructive bg-destructive/10">⚠ High Risk</Badge>}
                  </div>
                  <div className="space-y-2">
                    {risks.map((risk, i) => (
                      <div key={i} className="p-2 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold">{risk.risk}</span>
                          <SeverityBadge severity={risk.severity} />
                        </div>
                        <p className="text-xs text-muted-foreground">{risk.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Land Owner Opportunity */}
          <section>
            <SectionHeader num={++sectionNum} icon={DollarSign} title="Land Owner Opportunity Alert" />
            <div className="grid grid-cols-2 gap-4">
              {[{ label: plotALabel, val: r.valuationOpportunity.plotA }, { label: plotBLabel, val: r.valuationOpportunity.plotB }].map(({ label, val }) => (
                <div key={label} className="p-4 rounded-xl border border-border/50 bg-card/50">
                  <div className="font-bold text-sm mb-3 flex items-center justify-between">
                    {label}
                    <ClassificationBadge classification={val.classification} />
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Market PSF</span><span className="font-mono font-bold">{val.marketPSF} AED</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Plot PSF</span><span className="font-mono font-bold">{val.plotPSF} AED</span></div>
                    <div className="flex justify-between border-t border-border/30 pt-2">
                      <span className="text-muted-foreground">Undervaluation</span>
                      <span className={`font-mono font-bold ${val.undervaluation > 10 ? 'text-success' : val.undervaluation > 0 ? 'text-primary' : 'text-destructive'}`}>
                        {val.undervaluation > 0 ? '+' : ''}{val.undervaluation}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Land Assembly Detector */}
          <section>
            <SectionHeader num={++sectionNum} icon={Layers} title="Land Assembly Detector" />
            <div className="grid grid-cols-2 gap-4">
              {[{ label: plotALabel, asm: r.landAssembly.plotA }, { label: plotBLabel, asm: r.landAssembly.plotB }].map(({ label, asm }) => (
                <div key={label} className={`p-4 rounded-xl border ${asm.detected ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-card/50'}`}>
                  <div className="font-bold text-sm mb-2 flex items-center gap-2">
                    {label}
                    {asm.detected ? (
                      <Badge variant="outline" className="text-xs border-primary/40 text-primary bg-primary/10">Opportunity Detected</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">No Assembly</Badge>
                    )}
                  </div>
                  {asm.detected ? (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Adjacent Plots</span><span className="font-bold">{asm.adjacentPlots}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Total Potential</span><span className="font-mono font-bold">{asm.totalPotentialSqft.toLocaleString()} sqft</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Potential Use</span><span className="text-foreground">{asm.potentialUse}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Value Increase</span><span className="text-success font-bold">{asm.valueIncrease}</span></div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No adjacent assembly opportunities detected within 100m radius.</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 6. Land Assembly Intelligence */}
          {r.landAssemblyIntelligence && (
            <section>
              <SectionHeader num={++sectionNum} icon={Combine} title="Land Assembly Intelligence" />
              <div className="grid grid-cols-2 gap-4">
                {[{ label: plotALabel, intel: r.landAssemblyIntelligence.plotA }, { label: plotBLabel, intel: r.landAssemblyIntelligence.plotB }].map(({ label, intel }) => (
                  <div key={label} className="p-4 rounded-xl border border-border/50 bg-card/50 space-y-3">
                    <div className="font-bold text-sm flex items-center justify-between">
                      {label}
                      <Badge variant="outline" className="text-[10px]">{intel.dominantDevType}</Badge>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="p-2 rounded-md bg-muted/30">
                        <span className="text-muted-foreground">Size Cluster: </span>
                        <span>{intel.sizeClusterInsight}</span>
                      </div>
                      <div className="p-2 rounded-md bg-muted/30">
                        <span className="text-muted-foreground">GFA: </span>
                        <span>{intel.gfaAssessment}</span>
                      </div>
                      <div className="p-2 rounded-md bg-primary/10 border border-primary/20">
                        <span className="text-muted-foreground">Assembly Scale: </span>
                        <span className="font-bold text-primary">{intel.assemblyPotentialScale}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { label: 'Studio', value: intel.absorptionRate.studio },
                          { label: '1BR', value: intel.absorptionRate.oneBR },
                          { label: '2BR', value: intel.absorptionRate.twoBR },
                          { label: '3BR', value: intel.absorptionRate.threeBR },
                        ].map(item => (
                          <div key={item.label} className="p-1.5 rounded bg-muted/20 text-center">
                            <div className="text-[10px] text-muted-foreground">{item.label}</div>
                            <div className="font-bold text-xs">{item.value}</div>
                          </div>
                        ))}
                      </div>
                      <div className="p-2 rounded-md bg-muted/30">
                        <span className="text-muted-foreground">Sell-Out: </span>
                        <span className="font-bold">{intel.absorptionRate.expectedSellOut}</span>
                      </div>
                    </div>
                    {intel.alternativeAreas.length > 0 && (
                      <div className="border-t border-border/30 pt-2">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Alternative Areas</div>
                        {intel.alternativeAreas.slice(0, 3).map((a, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-0.5">
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-primary" />{a.area}</span>
                            <Badge variant={a.demandScore === 'High' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">{a.demandScore}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 7. Urban Context Analysis */}
          {r.urbanContext && (
            <section>
              <SectionHeader num={++sectionNum} icon={TreePine} title="Urban Context Analysis" />
              <div className="grid grid-cols-2 gap-4">
                <UrbanScoreRadar label={plotALabel} data={r.urbanContext.plotA} />
                <UrbanScoreRadar label={plotBLabel} data={r.urbanContext.plotB} />
              </div>
              <div className="mt-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                <div className="text-xs font-bold text-primary mb-1">Urban Quality Comparison</div>
                <div className="flex gap-6 text-sm">
                  <span><span className="font-bold">{plotALabel}:</span> {r.urbanContext.plotA.urbanScore.overall.toFixed(1)}/10</span>
                  <span><span className="font-bold">{plotBLabel}:</span> {r.urbanContext.plotB.urbanScore.overall.toFixed(1)}/10</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{r.urbanContext.plotA.streetFacing.insight}</p>
              </div>
            </section>
          )}

          {/* 8. Exit Strategy Planner */}
          <section>
            <SectionHeader num={++sectionNum} icon={TrendingUp} title="Exit Strategy Planner" />
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase">Strategy</th>
                    <th className="text-center p-3 font-semibold text-muted-foreground text-xs uppercase">{plotALabel}</th>
                    <th className="text-center p-3 font-semibold text-muted-foreground text-xs uppercase">{plotBLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Sell Land', a: r.exitStrategies.sellLand.plotA, b: r.exitStrategies.sellLand.plotB },
                    { label: 'Develop Project', a: r.exitStrategies.developProject.plotA, b: r.exitStrategies.developProject.plotB },
                    { label: 'Joint Venture', a: r.exitStrategies.jointVenture.plotA, b: r.exitStrategies.jointVenture.plotB },
                  ].map(({ label, a, b }) => (
                    <tr key={label} className="border-b border-border/30">
                      <td className="p-3 font-medium">{label}</td>
                      <td className="p-3 text-center"><ProfitBadge label={a} /></td>
                      <td className="p-3 text-center"><ProfitBadge label={b} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                <div className="text-xs text-muted-foreground mb-0.5">Best for {plotALabel}</div>
                <div className="font-bold text-sm text-primary">{r.exitStrategies.bestStrategyA}</div>
              </div>
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                <div className="text-xs text-muted-foreground mb-0.5">Best for {plotBLabel}</div>
                <div className="font-bold text-sm text-primary">{r.exitStrategies.bestStrategyB}</div>
              </div>
            </div>
          </section>

          {/* 9. AI Verdict */}
          <section>
            <SectionHeader num={++sectionNum} icon={Shield} title="AI Comparative Verdict" />
            <div className="p-5 rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-transparent">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/20">
                  <CheckCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-bold text-lg">{winnerLabel} — Recommended</div>
                  <Badge variant="outline" className={`text-xs ${r.verdict.confidenceLevel === 'High' ? 'border-success/40 text-success' : r.verdict.confidenceLevel === 'Medium' ? 'border-warning/40 text-warning' : 'border-muted-foreground/40 text-muted-foreground'}`}>
                    Confidence: {r.verdict.confidenceLevel}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                {r.verdict.reasoning.map((reason, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="text-xs font-bold text-primary mb-0.5">Recommended Action</div>
                <p className="text-sm font-medium">{r.verdict.recommendedAction}</p>
              </div>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function ProfitBadge({ label }: { label: string }) {
  const lower = label.toLowerCase();
  const isHigh = lower.includes('high');
  const isMedium = lower.includes('medium') || lower.includes('moderate');
  const isLow = lower.includes('low');
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isHigh ? 'bg-success/15 text-success' : isMedium ? 'bg-warning/15 text-warning' : isLow ? 'bg-muted text-muted-foreground' : ''}`}>
      {label}
    </span>
  );
}
