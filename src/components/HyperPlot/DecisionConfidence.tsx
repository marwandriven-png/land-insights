import { useState, useMemo, useEffect } from 'react';
import { Loader2, TrendingUp, DollarSign, Building2, BarChart3, Target, Shield, Printer, Maximize2, Minimize2, Settings2, GitCompareArrows, X, Lightbulb, StickyNote, ChevronRight, Share2 } from 'lucide-react';
import { DCShareModal } from './DCShareModal';
import { Checkbox } from '@/components/ui/checkbox';
import { PlotData, AffectionPlanData, gisService } from '@/services/DDAGISService';
import { calcDSCFeasibility, DSCPlotInput, DSCFeasibilityResult, MixKey, MIX_TEMPLATES, COMPS, UNIT_SIZES, RENT_PSF_YR, BENCHMARK_AVG_PSF, TXN_AVG_PSF, TXN_AVG_SIZE, TXN_AVG_PRICE, TXN_MEDIAN_PSF, TXN_COUNT, TXN_WEIGHTED_AVG_PSF, fmt, fmtM, fmtA, pct } from '@/lib/dscFeasibility';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface DecisionConfidenceProps {
  plot: PlotData;
  comparisonPlots?: PlotData[];
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onExitComparison?: () => void;
}

// Convert PlotData + AffectionPlan into DSCPlotInput (sqft)
function toDSCInput(plot: PlotData, plan: AffectionPlanData | null): DSCPlotInput {
  const areaSqft = plot.area * 10.764;
  const gfaSqft = plot.gfa * 10.764;
  const ratio = areaSqft > 0 ? gfaSqft / areaSqft : 4.5;
  return {
    id: plot.id,
    name: plot.project || plot.location || plot.id,
    area: areaSqft,
    ratio,
    height: plan?.maxHeight || plot.maxHeight ? `${plot.maxHeight}m` : plot.floors,
    zone: plan?.mainLanduse || plot.zoning,
    constraints: plan?.generalNotes || (plan?.maxPlotCoverage ? `Max coverage ${plan.maxPlotCoverage}%` : 'Standard guidelines'),
  };
}

// KPI Card
function KpiCard({ label, value, sub, accent, positive, negative }: {
  label: string; value: string; sub?: string; accent?: boolean; positive?: boolean; negative?: boolean;
}) {
  const colorClass = negative ? 'text-destructive' : positive ? 'text-success' : accent ? 'text-primary' : 'text-foreground';
  return (
    <div className={`data-card min-w-[130px] flex-1 ${accent ? 'border-primary/40' : ''}`}>
      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${colorClass}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// Section wrapper with numbered header matching HTML template
function Section({ num, title, badge, children }: { num?: number; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 animate-fade-in">
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border/50">
        {num != null && (
          <span className="w-8 h-8 flex items-center justify-center rounded-md bg-gradient-to-br from-primary to-cyan-500 text-primary-foreground font-extrabold text-xs shrink-0">{num}</span>
        )}
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{title}</h3>
        {badge && <Badge variant="outline" className="text-xs border-primary/40 text-primary ml-auto">{badge}</Badge>}
      </div>
      {children}
    </div>
  );
}

// Progress bar component
function ProgressBar({ label, value, suffix, percent }: { label: string; value: string; suffix?: string; percent: number }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1.5 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}{suffix ? ` ${suffix}` : ''}</span>
      </div>
      <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-500 transition-all duration-700" style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

// Viability indicator
function Viability({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span className={`text-xs font-bold ${pass ? 'text-success' : 'text-destructive'}`}>
      {pass ? '✓' : '⚠'} {label}
    </span>
  );
}

// Check if plot is in Dubai Sports City
function isDSCPlot(plot: PlotData): boolean {
  const loc = (plot.location || '').toLowerCase();
  const proj = (plot.project || '').toLowerCase();
  const zone = (plot.zoning || '').toLowerCase();
  return loc.includes('sport') || proj.includes('sport') || loc.includes('dsc') || proj.includes('dsc') || zone.includes('sport');
}

// Generate comparison insights
function generateComparisonNotes(
  allResults: { id: string; result: DSCFeasibilityResult; input: DSCPlotInput }[]
): string[] {
  if (allResults.length < 2) return [];
  const notes: string[] = [];

  // Best ROI
  const bestRoi = allResults.reduce((a, b) => a.result.roi > b.result.roi ? a : b);
  const worstRoi = allResults.reduce((a, b) => a.result.roi < b.result.roi ? a : b);
  if (bestRoi.id !== worstRoi.id) {
    const diff = ((bestRoi.result.roi - worstRoi.result.roi) * 100).toFixed(1);
    notes.push(`${bestRoi.id} offers the highest ROI at ${pct(bestRoi.result.roi)}, outperforming ${worstRoi.id} by ${diff}pp.`);
  }

  // Best margin
  const bestMargin = allResults.reduce((a, b) => a.result.grossMargin > b.result.grossMargin ? a : b);
  if (bestMargin.id !== bestRoi.id) {
    notes.push(`${bestMargin.id} has the best margin (${pct(bestMargin.result.grossMargin)}), making it lower risk despite not having the highest ROI.`);
  }

  // Highest profit
  const bestProfit = allResults.reduce((a, b) => a.result.grossProfit > b.result.grossProfit ? a : b);
  notes.push(`${bestProfit.id} generates the highest absolute profit at ${fmtM(bestProfit.result.grossProfit)}.`);

  // Lowest cost per sqft
  const lowestCostPsf = allResults.reduce((a, b) =>
    (a.result.totalCost / a.result.sellableArea) < (b.result.totalCost / b.result.sellableArea) ? a : b
  );
  notes.push(`${lowestCostPsf.id} has the lowest development cost per sqft at AED ${fmt(Math.round(lowestCostPsf.result.totalCost / lowestCostPsf.result.sellableArea))}/sqft.`);

  // Yield comparison
  const bestYield = allResults.reduce((a, b) => a.result.grossYield > b.result.grossYield ? a : b);
  if (bestYield.result.grossYield > 0.055) {
    notes.push(`${bestYield.id} offers the strongest rental yield at ${pct(bestYield.result.grossYield)}, above DSC average of 5.5%.`);
  }

  // Break-even
  const lowestBE = allResults.reduce((a, b) => a.result.breakEvenPsf < b.result.breakEvenPsf ? a : b);
  const highestBE = allResults.reduce((a, b) => a.result.breakEvenPsf > b.result.breakEvenPsf ? a : b);
  if (lowestBE.id !== highestBE.id) {
    notes.push(`${lowestBE.id} has the lowest break-even at AED ${fmt(Math.round(lowestBE.result.breakEvenPsf))}/sqft, providing more pricing flexibility.`);
  }

  // GFA comparison
  const largestGfa = allResults.reduce((a, b) => a.result.gfa > b.result.gfa ? a : b);
  const smallestGfa = allResults.reduce((a, b) => a.result.gfa < b.result.gfa ? a : b);
  if (largestGfa.id !== smallestGfa.id) {
    const pctDiff = ((largestGfa.result.gfa - smallestGfa.result.gfa) / smallestGfa.result.gfa * 100).toFixed(0);
    notes.push(`${largestGfa.id} provides ${pctDiff}% more GFA than ${smallestGfa.id}, supporting higher unit density.`);
  }

  return notes;
}

export function DecisionConfidence({ plot, comparisonPlots = [], isFullscreen, onToggleFullscreen, onExitComparison }: DecisionConfidenceProps) {
  const [activeMix, setActiveMix] = useState<MixKey>('balanced');
  const [plan, setPlan] = useState<AffectionPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [overrides, setOverrides] = useState<{ area?: number; ratio?: number; height?: string; efficiency?: number; landCostPsf?: number; constructionPsf?: number; buaMultiplier?: number; avgPsfOverride?: number; contingencyPct?: number; financePct?: number }>({});
  const [activeTab, setActiveTab] = useState<'feasibility' | 'comparison' | 'sensitivity' | 'plotCompare'>('feasibility');
  const [includeContingency, setIncludeContingency] = useState(true);
  const [includeFinance, setIncludeFinance] = useState(true);
  const [userNotes, setUserNotes] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);

  // All plots for tabbed navigation (primary + comparison)
  const allPlots = useMemo(() => {
    const dscPlots = [plot, ...comparisonPlots].filter(p => isDSCPlot(p));
    // Deduplicate by id
    const seen = new Set<string>();
    return dscPlots.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [plot, comparisonPlots]);

  // Active plot tab (which plot's feasibility is shown)
  const [activeTabPlotId, setActiveTabPlotId] = useState(plot.id);

  // Keep activeTabPlotId in sync when primary plot changes
  useEffect(() => {
    if (!allPlots.find(p => p.id === activeTabPlotId)) {
      setActiveTabPlotId(plot.id);
    }
  }, [plot.id, allPlots, activeTabPlotId]);

  const comparisonMode = allPlots.length >= 2;
  const activePlot = allPlots.find(p => p.id === activeTabPlotId) || plot;

  // Fetch affection plan on active plot change
  useEffect(() => {
    setLoading(true);
    setPlan(null);
    setEditMode(false);
    setOverrides({});
    gisService.fetchAffectionPlan(activePlot.id).then(data => {
      setPlan(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [activePlot.id]);

  const dscInput = useMemo(() => {
    const base = toDSCInput(activePlot, plan);
    if (overrides.area) base.area = overrides.area;
    if (overrides.ratio) base.ratio = overrides.ratio;
    if (overrides.height) base.height = overrides.height;
    return base;
  }, [activePlot, plan, overrides]);

  const fs = useMemo(() => {
    const result = calcDSCFeasibility(dscInput, activeMix, {
      efficiency: overrides.efficiency,
      landCostPsf: overrides.landCostPsf,
      constructionPsf: overrides.constructionPsf,
      buaMultiplier: overrides.buaMultiplier,
      avgPsfOverride: overrides.avgPsfOverride,
      contingencyPct: includeContingency ? overrides.contingencyPct : 0,
      financePct: includeFinance ? overrides.financePct : 0,
    });
    return result;
  }, [dscInput, activeMix, overrides, includeContingency, includeFinance]);

  // Compute feasibility for ALL comparison plots (for compare tab + notes)
  const allResults = useMemo(() => {
    return allPlots.map(p => {
      const input = toDSCInput(p, null);
      const result = calcDSCFeasibility(input, activeMix);
      return { id: p.id, plot: p, input, result };
    });
  }, [allPlots, activeMix]);

  // Auto-generated comparison notes
  const compNotes = useMemo(() => generateComparisonNotes(allResults), [allResults]);

  // Auto-switch to compare tab when entering comparison mode
  useEffect(() => {
    if (comparisonMode && allPlots.length >= 3 && activeTab === 'feasibility') {
      setActiveTab('plotCompare');
    }
  }, [comparisonMode, allPlots.length]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center glass-card glow-border">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
          <div className="text-foreground font-bold">Loading Affection Plan...</div>
          <div className="text-xs text-muted-foreground mt-1">Extracting plot constraints from DDA</div>
        </div>
      </div>
    );
  }

  // DSC-only gate
  if (!isDSCPlot(activePlot)) {
    return (
      <div className="h-full flex items-center justify-center glass-card glow-border">
        <div className="text-center max-w-sm">
          <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-2">Dubai Sports City Only</h3>
          <p className="text-sm text-muted-foreground">
            Decision Confidence is currently calibrated for <strong>Dubai Sports City</strong> plots only, using 809 real transactions and 6 active benchmarks.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Plot "{activePlot.location || activePlot.id}" is not in DSC.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden glass-card glow-border">
      {/* ─── COMPARISON PLOT TABS ─── */}
      {comparisonMode && (
        <div className="shrink-0 border-b border-border/50 bg-card/80 backdrop-blur-sm">
          <div className="flex items-center px-4 pt-3 pb-0">
            <div className="flex items-center gap-1.5 mr-3">
              <GitCompareArrows className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Compare Mode</span>
            </div>
            <div className="flex-1" />
            {onExitComparison && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 gap-1 text-muted-foreground hover:text-destructive"
                onClick={onExitComparison}
              >
                <X className="w-3 h-3" />
                Exit Compare
              </Button>
            )}
          </div>
          <div className="flex gap-0 px-4 pt-2">
            {allPlots.map((p, i) => {
              const isActive = p.id === activeTabPlotId;
              const pResult = allResults.find(r => r.id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveTabPlotId(p.id)}
                  className={`relative px-5 py-2.5 text-sm font-bold rounded-t-lg border-x border-t transition-all ${
                    isActive
                      ? 'bg-card border-border/50 text-primary -mb-px z-10'
                      : 'bg-muted/30 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono opacity-50">#{i + 1}</span>
                    <span>{p.id}</span>
                  </div>
                  {pResult && (
                    <div className={`text-[10px] font-mono mt-0.5 ${
                      pResult.result.roi > 0.2 ? 'text-success' : pResult.result.roi > 0 ? 'text-warning' : 'text-destructive'
                    }`}>
                      ROI {pct(pResult.result.roi)}
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div>
             <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Decision Confidence
              {comparisonMode && (
                <Badge variant="outline" className="text-xs border-primary/40 text-primary ml-2">
                  Viewing: {activePlot.id}
                </Badge>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              Plot {activePlot.id} · {dscInput.zone} · {dscInput.height}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              className={`text-xs h-8 gap-1.5 font-bold transition-all ${editMode ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' : 'border-primary/50 text-primary hover:bg-primary/10'}`}
              onClick={() => setEditMode(!editMode)}
            >
              <Settings2 className="w-3.5 h-3.5" />
              {editMode ? '✓ Override ON' : 'Override'}
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => setShowShareModal(true)}>
              <Share2 className="w-3 h-3" /> Share
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => window.print()}>
              <Printer className="w-3 h-3" /> Print
            </Button>
            {onToggleFullscreen && (
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={onToggleFullscreen}>
                {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                {isFullscreen ? 'Exit' : 'Maximize'}
              </Button>
            )}
          </div>
        </div>

        {/* Override inputs */}
        {editMode && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 p-2 rounded-lg bg-muted/30 border border-border/30">
            <div>
              <label className="text-[10px] text-muted-foreground">Plot Area (sqft)</label>
              <Input type="number" className="h-7 text-xs mt-0.5" defaultValue={Math.round(dscInput.area)}
                onChange={e => setOverrides(p => ({ ...p, area: parseFloat(e.target.value) || undefined }))} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Plot Ratio (×)</label>
              <Input type="number" step="0.1" className="h-7 text-xs mt-0.5" defaultValue={dscInput.ratio.toFixed(2)}
                onChange={e => setOverrides(p => ({ ...p, ratio: parseFloat(e.target.value) || undefined }))} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Height</label>
              <Input className="h-7 text-xs mt-0.5" defaultValue={dscInput.height}
                onChange={e => setOverrides(p => ({ ...p, height: e.target.value || undefined }))} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Floor Plate Eff. (%)</label>
              <Input type="number" step="1" className="h-7 text-xs mt-0.5" defaultValue={overrides.efficiency ? overrides.efficiency * 100 : 95}
                onChange={e => { const v = parseFloat(e.target.value); setOverrides(p => ({ ...p, efficiency: v > 0 ? v / 100 : undefined })); }} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Land Cost (PSF)</label>
              <Input type="number" className="h-7 text-xs mt-0.5" defaultValue={overrides.landCostPsf || 148}
                onChange={e => setOverrides(p => ({ ...p, landCostPsf: parseFloat(e.target.value) || undefined }))} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Construction (PSF)</label>
              <Input type="number" className="h-7 text-xs mt-0.5" defaultValue={overrides.constructionPsf || 420}
                onChange={e => setOverrides(p => ({ ...p, constructionPsf: parseFloat(e.target.value) || undefined }))} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">BUA Multiplier (×)</label>
              <Input type="number" step="0.05" className="h-7 text-xs mt-0.5" defaultValue={overrides.buaMultiplier || 1.45}
                onChange={e => setOverrides(p => ({ ...p, buaMultiplier: parseFloat(e.target.value) || undefined }))} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Contingency (%)</label>
              <Input type="number" step="0.5" className="h-7 text-xs mt-0.5" defaultValue={overrides.contingencyPct != null ? overrides.contingencyPct * 100 : 5}
                onChange={e => { const v = parseFloat(e.target.value); setOverrides(p => ({ ...p, contingencyPct: !isNaN(v) ? v / 100 : undefined })); }} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Finance (%)</label>
              <Input type="number" step="0.5" className="h-7 text-xs mt-0.5" defaultValue={overrides.financePct != null ? overrides.financePct * 100 : 4}
                onChange={e => { const v = parseFloat(e.target.value); setOverrides(p => ({ ...p, financePct: !isNaN(v) ? v / 100 : undefined })); }} />
            </div>
          </div>
        )}

        {/* KPI Strip */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <KpiCard label="Total GDV" value={fmtM(fs.grossSales)} sub={`Σ(Units × Avg Price) · Avg PSF AED ${fmt(Math.round(fs.avgPsf))}`} accent />
          <KpiCard label="Total Cost" value={fmtM(fs.totalCost)} sub={`${pct(fs.totalCost / fs.grossSales)} of GDV`} />
          <KpiCard label="Net Profit" value={fmtM(fs.grossProfit)} sub={`Margin: ${pct(fs.grossMargin)}`} positive={fs.grossMargin > 0.2} negative={fs.grossMargin < 0} />
          <KpiCard label="ROI" value={pct(fs.roi)} sub="Return on cost" positive={fs.roi > 0.2} negative={fs.roi < 0} />
          <KpiCard label="Units" value={fmt(fs.units.total)} sub={`${fmt(Math.round(fs.bua))} sqft BUA`} />
          <KpiCard label="Break-Even" value={`AED ${fmt(Math.round(fs.breakEvenPsf))}`} sub="vs AED 1,565 mkt avg" />
          <KpiCard label="Yield" value={pct(fs.grossYield)} sub="Annual rent / GDV" positive={fs.grossYield > 0.055} />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-3 bg-muted/40 p-0.5 rounded-lg">
          {([
            ['feasibility', '📊 Feasibility'],
            ['comparison', '📐 Benchmarks'],
            ['sensitivity', '🎯 Sensitivity'],
            ...(comparisonMode ? [['plotCompare', `⚔️ Compare (${allPlots.length})`]] : []),
          ] as const).map(([k, l]) => (
            <button key={k} onClick={() => setActiveTab(k as typeof activeTab)}
              className={`flex-1 text-[11px] font-bold py-1.5 rounded-md transition-all ${activeTab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">

          {/* ─── FEASIBILITY TAB ─── */}
          {activeTab === 'feasibility' && (
            <>
              {/* 1. Dev Config */}
              <Section num={1} title="Development Configuration">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Plot Details Card */}
                  <div className="data-card">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Plot Details</h4>
                    <div className="space-y-2">
                      {[
                        ['Plot Area', `${fmt(dscInput.area)} sqft`],
                        ['Plot Ratio', `× ${dscInput.ratio.toFixed(2)}`],
                        ['GFA', `${fmt(Math.round(fs.gfa))} sqft`],
                        ['BUA', `${fmt(Math.round(fs.bua))} sqft`],
                        ['Approved Height', dscInput.height],
                        ['Est. Floors', `${fs.residentialFloors}`],
                      ].map(([param, val]) => (
                        <div key={param} className="flex justify-between py-1.5 border-b border-border/30 last:border-0">
                          <span className="text-sm text-muted-foreground">{param}</span>
                          <span className="text-sm font-semibold font-mono text-foreground">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Efficiency Metrics Card */}
                  <div className="data-card">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Efficiency Metrics</h4>
                    <div className="space-y-1">
                      <ProgressBar label="Sellable Area" value={`${fmt(Math.round(fs.sellableArea))} sqft`} suffix={`(${((overrides.efficiency || 0.95) * 100).toFixed(0)}%)`} percent={(overrides.efficiency || 0.95) * 100} />
                      <ProgressBar label="GFA Utilization" value="100%" percent={100} />
                      <ProgressBar label="Avg Selling PSF" value={`AED ${fmt(Math.round(fs.avgPsf))}`} percent={Math.min((fs.avgPsf / 2000) * 100, 100)} />
                      <ProgressBar label="Units / 1,000 sqft" value={(fs.units.total / (fs.sellableArea / 1000)).toFixed(2)} percent={Math.min((fs.units.total / (fs.sellableArea / 1000)) * 30, 100)} />
                    </div>
                    <div className="mt-3 text-[10px] text-muted-foreground p-2 rounded bg-muted/30 border border-border/30">
                      💡 GDV = {fmtA(fs.grossSales)} · {fmt(fs.units.total)} units · {MIX_TEMPLATES[activeMix].tag}
                    </div>
                  </div>
                </div>
              </Section>

              {/* 2. Cost Breakdown */}
              <Section num={2} title="Cost Breakdown">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['', 'Cost Item', 'Basis', 'Rate', 'Amount (AED)', '% of GDV'].map(h => (
                          <TableHead key={h} className="text-xs text-right first:text-left">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { key: 'land', item: 'Land Cost', basis: 'GFA × Land PSF', rate: `AED ${fmt(Math.round(fs.landCost / fs.gfa))}/sqft`, amount: fs.landCost, toggle: null },
                        { key: 'construction', item: 'Construction', basis: `BUA × AED ${overrides.constructionPsf || 420}/sqft`, rate: `AED ${overrides.constructionPsf || 420}/sqft BUA`, amount: fs.constructionCost, toggle: null },
                        { key: 'authority', item: 'Authority Fees', basis: 'DLD + NOC + RERA', rate: '4% of land', amount: fs.authorityFees, toggle: null },
                        { key: 'consultant', item: 'Consultant Fees', basis: 'Architecture, PM', rate: '3% of construction', amount: fs.consultantFees, toggle: null },
                        { key: 'marketing', item: 'Marketing & Sales', basis: 'Broker + campaign', rate: '10% of GDV', amount: fs.marketing, toggle: null },
                        { key: 'contingency', item: 'Contingency', basis: 'Risk buffer', rate: `${((overrides.contingencyPct ?? 0.05) * 100).toFixed(1)}% of construction`, amount: fs.contingency, toggle: { checked: includeContingency, onChange: setIncludeContingency } },
                        { key: 'finance', item: 'Financing', basis: 'Construction carry', rate: `${((overrides.financePct ?? 0.04) * 100).toFixed(1)}% of construction`, amount: fs.financing, toggle: { checked: includeFinance, onChange: setIncludeFinance } },
                      ].map(r => (
                        <TableRow key={r.key} className={r.toggle && !r.toggle.checked ? 'opacity-40' : ''}>
                          <TableCell className="py-1.5 w-8">
                            {r.toggle && (
                              <Checkbox
                                checked={r.toggle.checked}
                                onCheckedChange={(v) => r.toggle!.onChange(!!v)}
                                className="h-3.5 w-3.5"
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-medium py-2">{r.item}</TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground py-2">{r.basis}</TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground py-2">{r.rate}</TableCell>
                          <TableCell className="text-sm text-right font-mono py-2">{fmtA(r.amount)}</TableCell>
                          <TableCell className="text-sm text-right py-2">{pct(r.amount / fs.grossSales)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="text-sm font-bold py-2" colSpan={4}>TOTAL DEVELOPMENT COST</TableCell>
                        <TableCell className="text-sm text-right font-bold py-2">{fmtA(fs.totalCost)}</TableCell>
                        <TableCell className="text-sm text-right font-bold py-2">{pct(fs.totalCost / fs.grossSales)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </Section>

              {/* 3. Unit Breakdown (100% from Sellable Area) */}
              <Section num={3} title="Unit Breakdown" badge="100% of Sellable Area">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Type', 'Count', 'Mix %', 'Size (sqft)', 'Floor Space', '% Sellable', 'Avg PSF', 'Price (AED)', 'Rent PSF/yr', 'Yield'].map(h => (
                          <TableHead key={h} className="text-xs text-right first:text-left">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { type: 'Studio', u: fs.units.studio, sz: UNIT_SIZES.studio, pr: fs.prices.studio, rent: RENT_PSF_YR.studio, txnPsf: TXN_AVG_PSF.studio },
                        { type: '1 Bedroom', u: fs.units.br1, sz: UNIT_SIZES.br1, pr: fs.prices.br1, rent: RENT_PSF_YR.br1, txnPsf: TXN_AVG_PSF.br1 },
                        { type: '2 Bedroom', u: fs.units.br2, sz: UNIT_SIZES.br2, pr: fs.prices.br2, rent: RENT_PSF_YR.br2, txnPsf: TXN_AVG_PSF.br2 },
                        { type: '3 Bedroom', u: fs.units.br3, sz: UNIT_SIZES.br3, pr: fs.prices.br3, rent: RENT_PSF_YR.br3, txnPsf: TXN_AVG_PSF.br3 },
                      ].map(r => (
                        <TableRow key={r.type}>
                          <TableCell className="text-sm font-medium py-2">{r.type}</TableCell>
                          <TableCell className="text-sm text-right font-mono py-2">{fmt(r.u)}</TableCell>
                          <TableCell className="text-sm text-right py-2">{pct(r.u / fs.units.total)}</TableCell>
                          <TableCell className="text-sm text-right py-2">{fmt(r.sz)}</TableCell>
                          <TableCell className="text-sm text-right py-2">{fmt(r.u * r.sz)}</TableCell>
                          <TableCell className="text-sm text-right py-2">{pct((r.u * r.sz) / fs.sellableArea)}</TableCell>
                          <TableCell className="text-sm text-right font-mono py-2">AED {fmt(r.txnPsf)}</TableCell>
                          <TableCell className="text-sm text-right font-mono py-2">{fmtA(r.pr)}</TableCell>
                          <TableCell className="text-sm text-right py-2">AED {r.rent}</TableCell>
                          <TableCell className="text-sm text-right py-2">{pct((r.sz * r.rent) / r.pr)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="text-sm font-bold py-2">TOTAL</TableCell>
                        <TableCell className="text-sm text-right font-bold py-2">{fmt(fs.units.total)}</TableCell>
                        <TableCell className="text-sm text-right font-bold py-2">100%</TableCell>
                        <TableCell className="text-sm text-right py-2">{fmt(Math.round(fs.sellableArea / fs.units.total))} avg</TableCell>
                        <TableCell className="text-sm text-right font-bold py-2">{fmt(Math.round(fs.sellableArea))}</TableCell>
                        <TableCell className="text-sm text-right font-bold py-2">100%</TableCell>
                        <TableCell className="text-sm text-right font-mono py-2">AED {fmt(Math.round(fs.avgPsf))}</TableCell>
                        <TableCell className="text-sm text-right py-2">—</TableCell>
                        <TableCell className="text-sm text-right py-2">—</TableCell>
                        <TableCell className="text-sm text-right font-bold py-2">{pct(fs.grossYield)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </Section>

              {/* Sales Transactions Reference */}
              <Section title="Sales Transactions" badge={`${TXN_COUNT.total} total`}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Unit Type', 'Transactions', 'Avg PSF', 'Median PSF', 'Avg Size', 'Avg Price'].map(h => (
                          <TableHead key={h} className="text-[10px] text-right first:text-left">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { type: 'Studio', txn: TXN_COUNT.studio, avgPsf: TXN_AVG_PSF.studio, medPsf: TXN_MEDIAN_PSF.studio, sz: TXN_AVG_SIZE.studio, pr: TXN_AVG_PRICE.studio },
                        { type: '1 Bedroom', txn: TXN_COUNT.br1, avgPsf: TXN_AVG_PSF.br1, medPsf: TXN_MEDIAN_PSF.br1, sz: TXN_AVG_SIZE.br1, pr: TXN_AVG_PRICE.br1 },
                        { type: '2 Bedroom', txn: TXN_COUNT.br2, avgPsf: TXN_AVG_PSF.br2, medPsf: TXN_MEDIAN_PSF.br2, sz: TXN_AVG_SIZE.br2, pr: TXN_AVG_PRICE.br2 },
                        { type: '3 Bedroom', txn: TXN_COUNT.br3, avgPsf: TXN_AVG_PSF.br3, medPsf: TXN_MEDIAN_PSF.br3, sz: TXN_AVG_SIZE.br3, pr: TXN_AVG_PRICE.br3 },
                      ].map(r => (
                        <TableRow key={r.type}>
                          <TableCell className="text-xs font-medium py-1.5">{r.type}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{fmt(r.txn)}</TableCell>
                          <TableCell className="text-xs text-right font-mono font-bold py-1.5">AED {fmt(r.avgPsf)}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">AED {fmt(r.medPsf)}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{fmt(r.sz)} sqft</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{fmtA(r.pr)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground p-2 rounded-lg bg-muted/30 border border-border/30">
                  💡 GDV is calculated using average selling prices from {TXN_COUNT.total} real DSC transactions per unit type, not a flat benchmark PSF.
                </div>
              </Section>

              <Section num={4} title="Unit Breakdown — Value View">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Type', 'Units', 'Price/Unit', 'Revenue', '% GDV', 'Annual Rent', 'Rental Income'].map(h => (
                          <TableHead key={h} className="text-[10px] text-right first:text-left">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { type: 'Studio', u: fs.units.studio, pr: fs.prices.studio, rev: fs.revBreak.studio, sz: UNIT_SIZES.studio, rent: RENT_PSF_YR.studio },
                        { type: '1 Bedroom', u: fs.units.br1, pr: fs.prices.br1, rev: fs.revBreak.br1, sz: UNIT_SIZES.br1, rent: RENT_PSF_YR.br1 },
                        { type: '2 Bedroom', u: fs.units.br2, pr: fs.prices.br2, rev: fs.revBreak.br2, sz: UNIT_SIZES.br2, rent: RENT_PSF_YR.br2 },
                        { type: '3 Bedroom', u: fs.units.br3, pr: fs.prices.br3, rev: fs.revBreak.br3, sz: UNIT_SIZES.br3, rent: RENT_PSF_YR.br3 },
                      ].map(r => (
                        <TableRow key={r.type}>
                          <TableCell className="text-xs font-medium py-1.5">{r.type}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{fmt(r.u)}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{fmtA(r.pr)}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{fmtA(r.rev)}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{pct(r.rev / fs.grossSales)}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{fmtA(r.sz * r.rent)}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{fmtA(r.u * r.sz * r.rent)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="text-xs font-bold py-1.5">TOTAL</TableCell>
                        <TableCell className="text-xs text-right font-bold py-1.5">{fmt(fs.units.total)}</TableCell>
                        <TableCell className="text-xs text-right py-1.5">—</TableCell>
                        <TableCell className="text-xs text-right font-bold py-1.5">{fmtA(fs.grossSales)}</TableCell>
                        <TableCell className="text-xs text-right font-bold py-1.5">100%</TableCell>
                        <TableCell className="text-xs text-right py-1.5">—</TableCell>
                        <TableCell className="text-xs text-right font-bold py-1.5">{fmtA(fs.annualRent)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </Section>

              {/* 5. Financial Feasibility */}
              <Section num={5} title="Financial Feasibility">
                {/* 5.1 Revenue */}
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-2">5.1 Revenue Projection</div>
                <div className="flex gap-2 flex-wrap mb-4">
                  <KpiCard label="GDV" value={fmtM(fs.grossSales)} sub={`Σ(Units × Avg Price) · ${fmt(fs.units.total)} units`} accent />
                  <KpiCard label="Annual Rental" value={fmtM(fs.annualRent)} sub={`AED ${fmt(Math.round(fs.annualRent / fs.units.total))}/unit/yr`} />
                  <KpiCard label="Rental Yield" value={pct(fs.grossYield)} sub="vs 5.5–6.5% DSC avg" positive={fs.grossYield > 0.055} />
                  <KpiCard label="Avg Selling PSF" value={`AED ${fmt(Math.round(fs.avgPsf))}`} sub={`Wtd avg from ${TXN_COUNT.total} txns`} positive={fs.avgPsf >= TXN_WEIGHTED_AVG_PSF} />
                </div>

              {/* 5.2 Finance Structure */}
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-2">5.2 Finance Structure</div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="data-card">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-xs text-muted-foreground font-semibold uppercase">Equity (40%)</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-foreground">{fmtM(fs.totalCost * 0.4)}</div>
                    <div className="mt-2 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: '40%' }} />
                    </div>
                  </div>
                  <div className="data-card">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-cyan-500" />
                      <span className="text-xs text-muted-foreground font-semibold uppercase">Debt (60%)</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-foreground">{fmtM(fs.totalCost * 0.6)}</div>
                    <div className="mt-2 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-cyan-500" style={{ width: '60%' }} />
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground p-2 rounded-lg bg-muted/30 border border-border/30 mb-4">
                  💡 Total development cost {fmtM(fs.totalCost)} financed via 40/60 equity-debt split. Equity required: {fmtM(fs.totalCost * 0.4)}, debt facility: {fmtM(fs.totalCost * 0.6)}.
                </div>

                {/* 5.3 Profit Summary */}
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-2">5.3 Profit & Return Summary</div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Metric', 'Value', 'Benchmark', 'Status'].map(h => (
                          <TableHead key={h} className="text-[10px] text-right first:text-left">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ['Gross Margin %', pct(fs.grossMargin), 'Min 25–30%', fs.grossMargin >= 0.25],
                        ['ROI', pct(fs.roi), 'Min 20–25%', fs.roi >= 0.20],
                        ['Break-Even PSF', `AED ${fmt(Math.round(fs.breakEvenPsf))}`, 'DSC Avg AED 1,565', fs.breakEvenPsf < 1508],
                        ['Land Cost % GDV', pct(fs.landCost / fs.grossSales), 'Max 40%', fs.landCost / fs.grossSales <= 0.40],
                        ['Rental Yield', pct(fs.grossYield), 'DSC Avg ~5.5%', fs.grossYield >= 0.055],
                      ].map(([metric, val, bench, pass]) => (
                        <TableRow key={metric as string}>
                          <TableCell className="text-xs font-medium py-1.5">{metric}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{val}</TableCell>
                          <TableCell className="text-[10px] text-right text-muted-foreground py-1.5">{bench}</TableCell>
                          <TableCell className="text-right py-1.5">
                            <Viability pass={pass as boolean} label={pass ? 'VIABLE' : 'BELOW MIN'} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Section>

              {/* 6. Payment Plan */}
              <Section num={6} title="Payment Plan Structure">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {Object.entries(fs.payPlan).map(([stage, val]) => (
                    <div key={stage} className="data-card text-center">
                      <div className="text-2xl font-black font-mono text-primary">{val}%</div>
                      <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">
                        {stage === 'booking' ? 'On Booking' : stage === 'construction' ? 'Construction' : 'Handover'}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{fmtA(fs.grossSales * val / 100)}</div>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground p-2 rounded-lg bg-muted/30 border border-border/30">
                  💡 {activeMix === 'investor' ? 'Benchmark: 5/45/50% — most competitive DSC plan, drives investor velocity' :
                    activeMix === 'balanced' ? 'Benchmark: 10/40/50% — balanced developer cashflow with investor incentive' :
                      'Benchmark: 20/40/40% — higher booking de-risks early construction for end-user projects'}
                </div>
              </Section>
            </>
          )}

          {/* ─── COMPARISON TAB ─── */}
          {activeTab === 'comparison' && (
            <>
            {/* Summary Comparison Table */}
            <Section title="Summary Comparison" badge="Strategy Classification">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['Project', 'Total Units', 'Studio %', '1BR %', '2BR %', '3BR %', 'Strategy'].map(h => (
                        <TableHead key={h} className="text-[10px] text-right first:text-left">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COMPS.map(c => {
                      const strategy = c.studioP >= 50 ? 'Investor' : c.br2P >= 40 ? 'Family' : 'Balanced';
                      return (
                        <TableRow key={c.name}>
                          <TableCell className="text-xs font-bold py-1.5">{c.name}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{c.units}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{c.studioP}%</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{c.br1P}%</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{c.br2P}%</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{c.br3P}%</TableCell>
                          <TableCell className="text-xs text-right py-1.5">
                            <Badge variant="outline" className={`text-[10px] ${strategy === 'Investor' ? 'border-primary/40 text-primary' : strategy === 'Family' ? 'border-success/40 text-success' : 'border-warning/40 text-warning'}`}>
                              {strategy}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Your Plot row */}
                    <TableRow className="bg-primary/5 border-t-2 border-primary/30">
                      <TableCell className="text-xs font-bold py-1.5 text-primary">Your Plot</TableCell>
                      <TableCell className="text-xs text-right font-mono font-bold py-1.5">{fs.units.total}</TableCell>
                      <TableCell className="text-xs text-right font-bold py-1.5">{pct(fs.mix.studio)}</TableCell>
                      <TableCell className="text-xs text-right font-bold py-1.5">{pct(fs.mix.br1)}</TableCell>
                      <TableCell className="text-xs text-right font-bold py-1.5">{pct(fs.mix.br2)}</TableCell>
                      <TableCell className="text-xs text-right font-bold py-1.5">{pct(fs.mix.br3)}</TableCell>
                      <TableCell className="text-xs text-right py-1.5">
                        <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px]">
                          {MIX_TEMPLATES[activeMix].label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Section>

            <Section title="Project Comparison — Active DSC Benchmarks" badge="6 projects">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['Project', 'Developer', 'Plot (sqft)', 'Units', 'BUA', 'Floors', 'Handover', 'PSF', 'Studio%', '1BR%', '2BR%', '3BR%', 'Payment'].map(h => (
                        <TableHead key={h} className="text-[10px] text-right first:text-left whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COMPS.map(c => (
                      <TableRow key={c.name}>
                        <TableCell className="text-xs font-medium py-1.5 whitespace-nowrap">{c.name}</TableCell>
                        <TableCell className="text-[10px] text-right py-1.5">{c.developer}</TableCell>
                        <TableCell className="text-xs text-right font-mono py-1.5">{fmt(c.plotSqft)}</TableCell>
                        <TableCell className="text-xs text-right font-mono py-1.5">{c.units}</TableCell>
                        <TableCell className="text-xs text-right font-mono py-1.5">{fmt(c.bua)}</TableCell>
                        <TableCell className="text-[10px] text-right py-1.5">{c.floors}</TableCell>
                        <TableCell className="text-[10px] text-right py-1.5">{c.handover}</TableCell>
                        <TableCell className="text-xs text-right font-mono py-1.5">{c.psf}</TableCell>
                        <TableCell className="text-xs text-right py-1.5">{c.studioP}%</TableCell>
                        <TableCell className="text-xs text-right py-1.5">{c.br1P}%</TableCell>
                        <TableCell className="text-xs text-right py-1.5">{c.br2P}%</TableCell>
                        <TableCell className="text-xs text-right py-1.5">{c.br3P}%</TableCell>
                        <TableCell className="text-[10px] text-right py-1.5">{c.payPlan}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Comparison vs Your Plot */}
              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['Project', 'Density', 'GFA Diff', 'Unit Count', 'PSF vs Yours'].map(h => (
                        <TableHead key={h} className="text-[10px] text-right first:text-left">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COMPS.map(c => {
                      const diff = fs.avgPsf - c.psf;
                      return (
                        <TableRow key={c.name}>
                          <TableCell className="text-xs font-medium py-1.5">{c.name}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{c.density.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{fmt(Math.round(fs.gfa - c.bua))} sqft</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{fs.units.total} vs {c.units}</TableCell>
                          <TableCell className={`text-xs text-right font-bold py-1.5 ${diff >= 0 ? 'text-success' : 'text-warning'}`}>
                            {diff >= 0 ? '+' : ''}AED {fmt(Math.round(diff))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-3 p-2 rounded-lg bg-muted/30 border border-border/30 text-[10px] text-muted-foreground">
                <strong className="text-foreground">Market Intelligence:</strong> DSC sales avg AED 1,565/sqft (809 txns) · Rental avg AED 86/sqft/yr (3,191 txns) · Rental-to-sales ratio 3.9:1 · Avg service charge AED 13–15/sqft
              </div>
            </Section>
            </>
          )}

          {/* ─── SENSITIVITY TAB ─── */}
          {activeTab === 'sensitivity' && (
            <>
              <Section num={7} title="Price Sensitivity Analysis" badge="±10% range">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Scenario', 'PSF', 'Revenue', 'Profit', 'Margin', 'ROI', 'Land %GDV', 'Viability'].map(h => (
                          <TableHead key={h} className="text-[10px] text-right first:text-left">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fs.sens.map((s, i) => {
                        const psf = Math.round(fs.avgPsf * (1 + s.delta));
                        const landPct = fs.landCost / s.revenue;
                        const isBase = s.delta === 0;
                        return (
                          <TableRow key={i} className={isBase ? 'bg-primary/5' : ''}>
                            <TableCell className={`text-xs font-bold py-1.5 ${isBase ? 'text-primary' : s.delta > 0 ? 'text-success' : 'text-warning'}`}>
                              {isBase ? '► BASE' : s.delta > 0 ? `▲ +${Math.abs(s.delta * 100)}%` : `▼ -${Math.abs(s.delta * 100)}%`}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono py-1.5">AED {fmt(psf)}</TableCell>
                            <TableCell className="text-xs text-right font-mono py-1.5">{fmtA(s.revenue)}</TableCell>
                            <TableCell className={`text-xs text-right font-mono py-1.5 ${s.profit > 0 ? 'text-success' : 'text-destructive'}`}>{fmtA(s.profit)}</TableCell>
                            <TableCell className={`text-xs text-right py-1.5 ${s.margin > 0.2 ? 'text-success' : 'text-warning'}`}>{pct(s.margin)}</TableCell>
                            <TableCell className={`text-xs text-right py-1.5 ${s.roi > 0.15 ? 'text-success' : 'text-warning'}`}>{pct(s.roi)}</TableCell>
                            <TableCell className={`text-xs text-right py-1.5 ${landPct <= 0.40 ? 'text-success' : 'text-destructive'}`}>{pct(landPct)}</TableCell>
                            <TableCell className="text-right py-1.5">
                              <Viability pass={s.margin >= 0.25} label={s.margin >= 0.25 ? 'VIABLE' : s.margin >= 0.15 ? 'MARGINAL' : 'LOSS'} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex gap-2 flex-wrap mt-4">
                  <KpiCard label="Break-Even PSF" value={`AED ${fmt(Math.round(fs.breakEvenPsf))}`} sub="Min to cover costs" />
                  <KpiCard label="Market Floor" value="AED 1,452" sub="DSC historical" />
                  <KpiCard label="Market Avg" value="AED 1,565" sub="809-txn avg" accent />
                  <KpiCard label="Market Ceiling" value="AED 1,800" sub="Premium" />
                  <KpiCard label="Buffer" value={`+AED ${fmt(Math.round(1565 - fs.breakEvenPsf))}`} sub="vs break-even" positive={fs.breakEvenPsf < 1565} negative={fs.breakEvenPsf > 1565} />
                </div>
              </Section>

              {/* Developer-Level Sensitivity — What if you sold at each benchmark's PSF? */}
              <Section num={8} title="Developer Benchmark Sensitivity" badge={`${COMPS.length} projects`}>
                <p className="text-xs text-muted-foreground mb-3">
                  Impact on your plot's feasibility if sold at each DSC developer's average PSF
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Developer', 'Project', 'Benchmark PSF', 'Your Revenue', 'Your Profit', 'Margin', 'ROI', 'vs Base'].map(h => (
                          <TableHead key={h} className="text-[10px] text-right first:text-left whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {COMPS.map(c => {
                        const devRevenue = fs.sellableArea * c.psf;
                        const devProfit = devRevenue - fs.totalCost;
                        const devMargin = devProfit / devRevenue;
                        const devRoi = devProfit / fs.totalCost;
                        const deltaVsBase = devRevenue - fs.grossSales;
                        return (
                          <TableRow key={c.name} className={c.psf === Math.max(...COMPS.map(x => x.psf)) ? 'bg-success/5' : c.psf === Math.min(...COMPS.map(x => x.psf)) ? 'bg-warning/5' : ''}>
                            <TableCell className="text-xs font-bold py-1.5">{c.developer}</TableCell>
                            <TableCell className="text-xs text-right text-muted-foreground py-1.5">{c.name}</TableCell>
                            <TableCell className="text-xs text-right font-mono py-1.5">AED {fmt(c.psf)}</TableCell>
                            <TableCell className="text-xs text-right font-mono py-1.5">{fmtM(devRevenue)}</TableCell>
                            <TableCell className={`text-xs text-right font-mono py-1.5 ${devProfit > 0 ? 'text-success' : 'text-destructive'}`}>{fmtM(devProfit)}</TableCell>
                            <TableCell className={`text-xs text-right py-1.5 ${devMargin > 0.2 ? 'text-success' : devMargin > 0 ? 'text-warning' : 'text-destructive'}`}>{pct(devMargin)}</TableCell>
                            <TableCell className={`text-xs text-right py-1.5 ${devRoi > 0.15 ? 'text-success' : devRoi > 0 ? 'text-warning' : 'text-destructive'}`}>{pct(devRoi)}</TableCell>
                            <TableCell className={`text-xs text-right font-mono py-1.5 ${deltaVsBase >= 0 ? 'text-success' : 'text-warning'}`}>
                              {deltaVsBase >= 0 ? '+' : ''}{fmtM(deltaVsBase)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Your plot baseline row */}
                      <TableRow className="bg-primary/5 border-t-2 border-primary/30">
                        <TableCell className="text-xs font-bold py-1.5 text-primary">Your Plot</TableCell>
                        <TableCell className="text-xs text-right text-primary py-1.5">{activePlot.id}</TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold py-1.5 text-primary">AED {fmt(Math.round(fs.avgPsf))}</TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold py-1.5">{fmtM(fs.grossSales)}</TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold py-1.5 text-success">{fmtM(fs.grossProfit)}</TableCell>
                        <TableCell className="text-xs text-right font-bold py-1.5">{pct(fs.grossMargin)}</TableCell>
                        <TableCell className="text-xs text-right font-bold py-1.5">{pct(fs.roi)}</TableCell>
                        <TableCell className="text-xs text-right py-1.5 text-primary font-bold">BASE</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-3 p-2 rounded-lg bg-muted/30 border border-border/30 text-[10px] text-muted-foreground">
                  <strong className="text-foreground">Reading:</strong> Each row shows what your plot's financials would look like if units sold at that developer's benchmark PSF. Higher PSF = higher revenue & ROI. Your weighted avg PSF ({fmt(Math.round(fs.avgPsf))}) is derived from 809 real DSC transactions.
                </div>
              </Section>
            </>
          )}

          {/* ─── PLOT COMPARE TAB ─── */}
          {activeTab === 'plotCompare' && allResults.length >= 2 && (
            <>
              {/* Side-by-side comparison table */}
              <Section title="Side-by-Side Plot Comparison" badge={`${allResults.length} plots`}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs whitespace-nowrap">Metric</TableHead>
                        {allResults.map((r, i) => (
                          <TableHead key={r.id} className={`text-xs text-right whitespace-nowrap ${r.id === activeTabPlotId ? 'text-primary' : ''}`}>
                            {i === 0 ? '📍 ' : ''}{r.id}
                          </TableHead>
                        ))}
                        <TableHead className="text-xs text-right whitespace-nowrap text-success">Best</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { label: 'Location', vals: allResults.map(r => r.plot.location || '-'), best: null },
                        { label: 'Plot Area (sqft)', vals: allResults.map(r => fmt(Math.round(r.input.area))), best: allResults.reduce((a, b) => a.input.area > b.input.area ? a : b).id },
                        { label: 'GFA (sqft)', vals: allResults.map(r => fmt(Math.round(r.result.gfa))), best: allResults.reduce((a, b) => a.result.gfa > b.result.gfa ? a : b).id },
                        { label: 'Sellable Area', vals: allResults.map(r => fmt(Math.round(r.result.sellableArea))), best: allResults.reduce((a, b) => a.result.sellableArea > b.result.sellableArea ? a : b).id },
                        { label: 'Total Units', vals: allResults.map(r => fmt(r.result.units.total)), best: allResults.reduce((a, b) => a.result.units.total > b.result.units.total ? a : b).id },
                        { label: 'GDV', vals: allResults.map(r => fmtM(r.result.grossSales)), best: allResults.reduce((a, b) => a.result.grossSales > b.result.grossSales ? a : b).id },
                        { label: 'Total Cost', vals: allResults.map(r => fmtM(r.result.totalCost)), best: allResults.reduce((a, b) => a.result.totalCost < b.result.totalCost ? a : b).id },
                        { label: 'Net Profit', vals: allResults.map(r => fmtM(r.result.grossProfit)), best: allResults.reduce((a, b) => a.result.grossProfit > b.result.grossProfit ? a : b).id },
                        { label: 'Gross Margin', vals: allResults.map(r => pct(r.result.grossMargin)), best: allResults.reduce((a, b) => a.result.grossMargin > b.result.grossMargin ? a : b).id },
                        { label: 'ROI', vals: allResults.map(r => pct(r.result.roi)), best: allResults.reduce((a, b) => a.result.roi > b.result.roi ? a : b).id },
                        { label: 'Avg PSF', vals: allResults.map(r => `AED ${fmt(Math.round(r.result.avgPsf))}`), best: null },
                        { label: 'Break-Even PSF', vals: allResults.map(r => `AED ${fmt(Math.round(r.result.breakEvenPsf))}`), best: allResults.reduce((a, b) => a.result.breakEvenPsf < b.result.breakEvenPsf ? a : b).id },
                        { label: 'Rental Yield', vals: allResults.map(r => pct(r.result.grossYield)), best: allResults.reduce((a, b) => a.result.grossYield > b.result.grossYield ? a : b).id },
                        { label: 'Cost/sqft', vals: allResults.map(r => `AED ${fmt(Math.round(r.result.totalCost / r.result.sellableArea))}`), best: allResults.reduce((a, b) => (a.result.totalCost / a.result.sellableArea) < (b.result.totalCost / b.result.sellableArea) ? a : b).id },
                        { label: 'Status', vals: allResults.map(r => r.plot.status), best: null },
                      ].map(row => (
                        <TableRow key={row.label}>
                          <TableCell className="text-sm font-medium py-2">{row.label}</TableCell>
                          {row.vals.map((v, i) => (
                            <TableCell key={i} className={`text-sm text-right font-mono py-2 ${
                              allResults[i].id === activeTabPlotId ? 'text-primary font-bold' : ''
                            } ${row.best === allResults[i].id ? 'bg-success/10' : ''}`}>
                              {v}
                            </TableCell>
                          ))}
                          <TableCell className="text-xs text-right text-success font-bold py-2">
                            {row.best || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Section>

              {/* Quick Verdict */}
              <Section title="Quick Verdict">
                {(() => {
                  const bestRoi = allResults.reduce((a, b) => a.result.roi > b.result.roi ? a : b);
                  const bestMargin = allResults.reduce((a, b) => a.result.grossMargin > b.result.grossMargin ? a : b);
                  const bestProfit = allResults.reduce((a, b) => a.result.grossProfit > b.result.grossProfit ? a : b);
                  const bestYield = allResults.reduce((a, b) => a.result.grossYield > b.result.grossYield ? a : b);
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="data-card">
                        <div className="text-xs text-muted-foreground font-semibold uppercase mb-1">Highest ROI</div>
                        <div className="text-base font-bold text-success">{bestRoi.id}</div>
                        <div className="text-sm font-mono text-muted-foreground">{pct(bestRoi.result.roi)}</div>
                      </div>
                      <div className="data-card">
                        <div className="text-xs text-muted-foreground font-semibold uppercase mb-1">Best Margin</div>
                        <div className="text-base font-bold text-success">{bestMargin.id}</div>
                        <div className="text-sm font-mono text-muted-foreground">{pct(bestMargin.result.grossMargin)}</div>
                      </div>
                      <div className="data-card">
                        <div className="text-xs text-muted-foreground font-semibold uppercase mb-1">Highest Profit</div>
                        <div className="text-base font-bold text-success">{bestProfit.id}</div>
                        <div className="text-sm font-mono text-muted-foreground">{fmtM(bestProfit.result.grossProfit)}</div>
                      </div>
                      <div className="data-card">
                        <div className="text-xs text-muted-foreground font-semibold uppercase mb-1">Best Yield</div>
                        <div className="text-base font-bold text-success">{bestYield.id}</div>
                        <div className="text-sm font-mono text-muted-foreground">{pct(bestYield.result.grossYield)}</div>
                      </div>
                    </div>
                  );
                })()}
              </Section>

              {/* Comparison Notes - Auto-generated insights */}
              <Section title="Comparison Notes — Decision Support" badge="AI Insights">
                <div className="space-y-2 mb-4">
                  {compNotes.map((note, i) => (
                    <div key={i} className="flex gap-2 items-start p-2.5 rounded-lg bg-muted/30 border border-border/30">
                      <Lightbulb className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground leading-relaxed">{note}</p>
                    </div>
                  ))}
                </div>

                {/* User notes */}
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <StickyNote className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Notes</span>
                  </div>
                  <Textarea
                    value={userNotes}
                    onChange={e => setUserNotes(e.target.value)}
                    placeholder="Add your own analysis notes here... These will persist while comparison mode is active."
                    className="text-sm min-h-[80px] bg-muted/20 border-border/30"
                  />
                </div>
              </Section>
            </>
          )}

          {activeTab === 'plotCompare' && allResults.length < 2 && (
            <div className="text-center py-12 text-muted-foreground">
              <GitCompareArrows className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No comparison plots selected</p>
              <p className="text-xs mt-1">Click the ⇆ icon on plots in the right sidebar to add up to 3 plots for comparison.</p>
            </div>
          )}

          {/* Bottom spacer for mix nav */}
          <div className="h-20" />
        </div>
      </ScrollArea>

      {/* ─── Bottom Unit Mix Selector ─── */}
      <div className="shrink-0 border-t border-border/50 bg-card/90 backdrop-blur-xl px-2 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider whitespace-nowrap">UNIT MIX:</span>
          {(Object.entries(MIX_TEMPLATES) as [MixKey, typeof MIX_TEMPLATES.investor][]).map(([k, v]) => (
            <button key={k} onClick={() => setActiveMix(k)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-2 rounded-lg border transition-all ${
                activeMix === k
                  ? 'bg-primary/20 border-primary/50 text-foreground'
                  : 'bg-muted/20 border-border/30 text-muted-foreground hover:bg-muted/40'
              }`}>
              <span className="text-sm">{v.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">{v.label}</span>
              <span className="text-[8px] text-muted-foreground">{v.tag}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Share Modal */}
      <DCShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        plotId={activePlot.id}
        activeMix={activeMix}
        fs={fs}
        plotInput={dscInput}
        overrides={overrides}
      />
    </div>
  );
}
