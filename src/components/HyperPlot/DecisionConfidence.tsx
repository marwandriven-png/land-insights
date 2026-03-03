import { useState, useMemo, useEffect } from 'react';
import { Loader2, TrendingUp, DollarSign, Building2, BarChart3, Target, Shield, Printer, Maximize2, Minimize2, Settings2, GitCompareArrows, X, Lightbulb, StickyNote, ChevronRight, Share2, FileWarning } from 'lucide-react';
import { DCShareModal } from './DCShareModal';
import { Checkbox } from '@/components/ui/checkbox';
import { PlotData, AffectionPlanData, gisService } from '@/services/DDAGISService';
import { FeasibilityParams, DEFAULT_FEASIBILITY_PARAMS } from './FeasibilityCalculator';
import { calcDSCFeasibility, DSCPlotInput, DSCFeasibilityResult, MixKey, MIX_TEMPLATES, UNIT_SIZES, RENT_PSF_YR, fmt, fmtM, fmtA, pct } from '@/lib/dscFeasibility';
import { matchCLFFArea, findAnchorArea, normalizeAreaCode, CLFF_AREAS, CLFF_MARKET_DATA, getCLFFOverrides, getCLFFOverridesWithMasterData, type CLFFAreaProfile, type CLFFMarketData } from '@/lib/clffAreaDefaults';
import { getAreaScopedMarketData, resolvePlotAreaCode, matchesAreaCode, extractAreaCodes } from '@/lib/areaResearch';
import { findReportForLocation, AreaReport } from '@/data/areaReports';
import { getAreaData, getCompetitorsAsComparables, getAreaSalesData, getAreaRentalData, generateAreaInsights, evaluateTemplateViability, type AreaMarketData } from '@/data/crossAreaMasterData';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { AnalysisSummary } from './AnalysisSummary';
import { useDBComparables, useDBMarketSnapshot } from '@/hooks/useMarketDataFromDB';


interface DecisionConfidenceProps {
  plot: PlotData;
  comparisonPlots?: PlotData[];
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onExitComparison?: () => void;
  sharedFeasibilityParams?: FeasibilityParams;
  onFeasibilityParamsChange?: (params: FeasibilityParams) => void;
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
    height: plan?.maxHeight || (plot.maxHeight ? `${plot.maxHeight}m` : plot.floors),
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

const toNum = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toPct = (value: unknown): number => {
  const n = toNum(value);
  if (n == null) return 0;
  // Only treat as decimal fraction if strictly < 1 (e.g., 0.38 → 38%)
  // Values >= 1 are already percentages (e.g., 1 → 1%, 38 → 38%)
  return n > 0 && n < 1 ? Math.round(n * 100) : Math.round(n);
};

const normalizeMixPct = (value: unknown): number => {
  const pct = toPct(value);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return 0;
  return pct;
};

const normalizePayPlan = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const parts = value.map((v) => toNum(v)).filter((v): v is number => v != null);
    return parts.length ? parts.map((v) => Math.round(v)).join('/') : null;
  }
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    const booking = toNum(rec.booking ?? rec.downPayment ?? rec.down_payment ?? rec.dp);
    const construction = toNum(rec.construction ?? rec.constructionLinked ?? rec.construction_linked);
    const handover = toNum(rec.handover ?? rec.onHandover ?? rec.postHandover ?? rec.post_handover);
    if (booking != null || construction != null || handover != null) {
      return `${Math.round(booking ?? 0)}/${Math.round(construction ?? 0)}/${Math.round(handover ?? 0)}`;
    }
  }
  return null;
};

const deriveComparablePsf = (raw: any): number | undefined => {
  const explicit = toNum(raw?.psf ?? raw?.avgPsf ?? raw?.avg_psf ?? raw?.pricePsf ?? raw?.price_psf);
  if (explicit && explicit > 0) return explicit;

  const byUnit = [raw?.studioP, raw?.br1P, raw?.br2P, raw?.br3P]
    .map((v) => toNum(v))
    .filter((v): v is number => v != null && v > 100);

  if (!byUnit.length) return undefined;
  return Math.round(byUnit.reduce((sum, v) => sum + v, 0) / byUnit.length);
};

const normalizeComparable = (raw: any) => {
  const unitMix = raw?.unitMix || raw?.unit_mix || raw?.mix || {};
  return {
    ...raw,
    name: raw?.name || raw?.project || raw?.projectName || 'Unnamed Project',
    area: raw?.area || raw?.community || raw?.areaName,
    plotSqft: toNum(raw?.plotSqft ?? raw?.plotSizeSqft ?? raw?.plot_size_sqft ?? raw?.plotAreaSqft) ?? undefined,
    units: toNum(raw?.units ?? raw?.totalUnits ?? raw?.unitCount ?? raw?.unit_count) ?? undefined,
    bua: toNum(raw?.bua ?? raw?.sellableArea ?? raw?.sellable_area ?? raw?.gfa) ?? undefined,
    floors: raw?.floors || raw?.floorsFormula || raw?.floors_formula || undefined,
    psf: deriveComparablePsf(raw),
    priceFrom: toNum(raw?.priceFrom ?? raw?.price_from ?? raw?.price_from_aed ?? raw?.priceFromAed) ?? undefined,
    svc: toNum(raw?.svc ?? raw?.serviceCharge ?? raw?.service_charge ?? raw?.serviceChargePsf ?? raw?.service_charge_psf) ?? undefined,
    studioP: normalizeMixPct(raw?.studioMix ?? raw?.studioPct ?? raw?.studio_mix ?? raw?.studioP ?? raw?.studio_pct ?? unitMix?.studio ?? unitMix?.studioP),
    br1P: normalizeMixPct(raw?.br1Mix ?? raw?.br1Pct ?? raw?.br1_mix ?? raw?.br1P ?? raw?.oneBrP ?? raw?.br1_pct ?? unitMix?.br1 ?? unitMix?.oneBr),
    br2P: normalizeMixPct(raw?.br2Mix ?? raw?.br2Pct ?? raw?.br2_mix ?? raw?.br2P ?? raw?.twoBrP ?? raw?.br2_pct ?? unitMix?.br2 ?? unitMix?.twoBr),
    br3P: normalizeMixPct(raw?.br3Mix ?? raw?.br3Pct ?? raw?.br3_mix ?? raw?.br3P ?? raw?.threeBrP ?? raw?.br3_pct ?? unitMix?.br3 ?? unitMix?.threeBr),
    payPlan: normalizePayPlan(raw?.payPlan ?? raw?.paymentPlan ?? raw?.payment_plan ?? raw?.plan),
  };
};

export function DecisionConfidence({ plot, comparisonPlots = [], isFullscreen, onToggleFullscreen, onExitComparison, sharedFeasibilityParams, onFeasibilityParamsChange }: DecisionConfidenceProps) {
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
    const allPlotsRaw = [plot, ...comparisonPlots];
    const seen = new Set<string>();
    return allPlotsRaw.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [plot, comparisonPlots]);

  const [activeTabPlotId, setActiveTabPlotId] = useState(plot.id);

  useEffect(() => {
    if (!allPlots.find(p => p.id === activeTabPlotId)) {
      setActiveTabPlotId(plot.id);
    }
  }, [plot.id, allPlots, activeTabPlotId]);

  const comparisonMode = allPlots.length >= 2;
  const activePlot = allPlots.find(p => p.id === activeTabPlotId) || plot;

  // Fetch affection plan on active plot change — keep overrides & mix static
  useEffect(() => {
    setLoading(true);
    setPlan(null);
    gisService.fetchAffectionPlan(activePlot.id).then(data => {
      setPlan(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [activePlot.id]);

  // Merge shared feasibility params into overrides for calculation
  // CRITICAL: User overrides ALWAYS take priority over CLFF/AI defaults
  const effectiveOverrides = useMemo(() => {
    const sp = sharedFeasibilityParams || DEFAULT_FEASIBILITY_PARAMS;
    return {
      ...overrides,
      // User overrides take absolute priority, then shared params
      efficiency: overrides.efficiency ?? sp.efficiency,
      landCostPsf: overrides.landCostPsf ?? sp.landCostPsf,
      constructionPsf: overrides.constructionPsf ?? sp.constructionPsf,
      buaMultiplier: overrides.buaMultiplier ?? sp.buaMultiplier,
      contingencyPct: overrides.contingencyPct ?? (sp.contingencyPct / 100),
      financePct: overrides.financePct ?? (sp.financePct / 100),
      avgPsfOverride: overrides.avgPsfOverride ?? sp.avgPsfOverride,
    };
  }, [overrides, sharedFeasibilityParams]);

  const dscInput = useMemo(() => {
    const base = toDSCInput(activePlot, plan);
    if (overrides.area) base.area = overrides.area;
    if (overrides.ratio) base.ratio = overrides.ratio;
    if (overrides.height) base.height = overrides.height;
    return base;
  }, [activePlot, plan, overrides]);

  // ─── Data Resolution: AI-parsed upload → CLFF area defaults → Anchor Area → empty ───
  // Priority: Affection Plan landName (raw DLD name) > plot location > keyword scan
  const clffMatch = useMemo(() => {
    // 1. If we have an Affection Plan, try its landName first (DDA returns official DLD area names
    //    like "SAIH SHUAIB 2" which normalizeAreaCode() maps to the correct CLFF code)
    if (plan?.landName) {
      const codeFromPlan = normalizeAreaCode(plan.landName);
      if (codeFromPlan && CLFF_AREAS[codeFromPlan]) {
        return { area: CLFF_AREAS[codeFromPlan], market: CLFF_MARKET_DATA[codeFromPlan] };
      }
    }
    // 2. Fall back to plot location / project name
    const location = activePlot.location || activePlot.project || '';
    return matchCLFFArea(location);
  }, [activePlot, plan]);

  // Anchor area fallback when no exact CLFF match
  const anchorMatch = useMemo(() => {
    if (clffMatch) return null; // Exact match exists
    const location = activePlot.location || activePlot.project || '';
    return findAnchorArea(location);
  }, [activePlot, clffMatch]);

  const plotAreaCode = useMemo(() => {
    const location = activePlot.location || activePlot.project || '';
    return resolvePlotAreaCode(location, plan?.landName, clffMatch?.area.code || null);
  }, [activePlot, plan?.landName, clffMatch?.area.code]);

  const scopedAreaCode = plotAreaCode || clffMatch?.area.code || anchorMatch?.area.code || null;

  const areaReport = useMemo(() => {
    try {
      const stored = localStorage.getItem('hyperplot_area_research_files');
      if (!stored) return null;

      const files = JSON.parse(stored) as Array<{ areaName: string; aiParsed?: boolean; marketData?: Record<string, unknown> }>;
      const candidates = files
        .filter(f => f.aiParsed && f.marketData)
        .map(f => {
          const withArea = { ...(f.marketData as any), areaName: f.areaName };
          const scoped = getAreaScopedMarketData(withArea, scopedAreaCode);
          const hasScopedData = !!scoped && (
            (Array.isArray(scoped.comparables) && scoped.comparables.length > 0) ||
            !!scoped.areaTxn ||
            !!scoped.unitPsf
          );
          const areaNameMatch = matchesAreaCode(f.areaName, scopedAreaCode);
          return { file: f, withArea, hasScopedData, areaNameMatch };
        })
        .filter(c => c.hasScopedData || c.areaNameMatch);

      if (candidates.length === 0) return null;

      const best = candidates.sort((a, b) => Number(b.hasScopedData) - Number(a.hasScopedData))[0];
      // Resolve display name from scoped area code, NOT the file name (which may be multi-area)
      const resolvedName = scopedAreaCode && CLFF_AREAS[scopedAreaCode]
        ? CLFF_AREAS[scopedAreaCode].name
        : best.file.areaName;
      return {
        areaName: resolvedName,
        uploadedOnly: true,
        aiMarketData: best.withArea,
      } as AreaReport & { uploadedOnly?: boolean; aiMarketData?: Record<string, unknown> | null };
    } catch {
      return null;
    }
  }, [scopedAreaCode]);

  // Has data if either AI-parsed upload, CLFF area match, OR anchor area fallback
  const hasAreaData = !!areaReport || !!clffMatch || !!anchorMatch;
  const dataSource = areaReport ? 'AI Upload' : clffMatch ? `CLFF v1 · ${clffMatch.area.name}` : anchorMatch ? `CLFF v1 · ${anchorMatch.area.name} (Anchor)` : null;

  // Effective CLFF/anchor for fallback resolution (restored anchor fallback)
  const effectiveClff = clffMatch || anchorMatch;

  // Always resolve display name from scopedAreaCode when available (prevents consolidated name leak)
  const areaName = (scopedAreaCode && CLFF_AREAS[scopedAreaCode]?.name)
    || areaReport?.areaName || clffMatch?.area.name || anchorMatch?.area.name || 'Unknown Area';
  const isStrictMatch = !!areaReport || !!clffMatch;

  const scopedAiData = useMemo(() => {
    const aiData = (areaReport as any)?.aiMarketData;
    return getAreaScopedMarketData(aiData as any, scopedAreaCode);
  }, [areaReport, scopedAreaCode]);

  // ─── Master Data (crossAreaMasterData.ts) — single source of truth for benchmarks ───
  const masterAreaData = useMemo(() => {
    if (!scopedAreaCode) return null;
    return getAreaData(scopedAreaCode);
  }, [scopedAreaCode]);

  // Extract area-specific market data: AI upload > CLFF > Anchor > empty
  // CRITICAL: User overrides (effectiveOverrides) are applied AFTER this, so they always win
  const areaMarketOverrides = useMemo(() => {
    if (scopedAiData) {
      const result: Record<string, unknown> = {};
      if (scopedAiData.unitPsf) result.unitPsf = scopedAiData.unitPsf;
      if (scopedAiData.unitSizes) result.unitSizes = scopedAiData.unitSizes;
      if (scopedAiData.unitRents) result.unitRents = scopedAiData.unitRents;
      if ((areaReport as any)?.aiMarketData?.constructionPsf) result.constructionPsf = (areaReport as any).aiMarketData.constructionPsf;
      if ((areaReport as any)?.aiMarketData?.landCostPsf) result.landCostPsf = (areaReport as any).aiMarketData.landCostPsf;
      if (Object.keys(result).length > 0) return result;
    }
    // Fall back to CLFF with master data enrichment for sizes and rents
    if (effectiveClff && masterAreaData) {
      return getCLFFOverridesWithMasterData(
        effectiveClff.area.code,
        masterAreaData.salesByUnit as any,
        masterAreaData.rentalByUnit as any
      );
    }
    if (effectiveClff) return getCLFFOverrides(effectiveClff.area.code);
    return {};
  }, [scopedAiData, areaReport, effectiveClff, masterAreaData]);

  const ZERO_UNIT = { studio: 0, br1: 0, br2: 0, br3: 0 };
  const ZERO_COUNT = { studio: 0, br1: 0, br2: 0, br3: 0, total: 0 };

  const masterComps = useMemo(() => {
    if (!scopedAreaCode) return [];
    const comps = getCompetitorsAsComparables(scopedAreaCode);
    return comps.map(normalizeComparable);
  }, [scopedAreaCode]);

  const masterCompsWithPlans = useMemo(
    () => masterComps.filter((c: any) => typeof c.payPlan === 'string' && c.payPlan.trim().length > 0),
    [masterComps]
  );

  const ZERO_FLAGS = { studio: false, br1: false, br2: false, br3: false };

  const masterTxnData = useMemo(() => {
    if (!scopedAreaCode) return { avgPsf: ZERO_UNIT, medianPsf: ZERO_UNIT, avgSize: ZERO_UNIT, avgPrice: ZERO_UNIT, medianPrice: ZERO_UNIT, count: ZERO_COUNT, sharePct: ZERO_UNIT, insufficient: ZERO_FLAGS, noData: ZERO_FLAGS };
    const sales = getAreaSalesData(scopedAreaCode);
    if (!sales) return { avgPsf: ZERO_UNIT, medianPsf: ZERO_UNIT, avgSize: ZERO_UNIT, avgPrice: ZERO_UNIT, medianPrice: ZERO_UNIT, count: ZERO_COUNT, sharePct: ZERO_UNIT, insufficient: ZERO_FLAGS, noData: ZERO_FLAGS };
    return sales;
  }, [scopedAreaCode]);

  const masterMarketBench = useMemo(() => {
    if (!masterAreaData) return { floor: 0, avg: 0, ceiling: 0 };
    const sales = masterAreaData.salesByUnit;
    const psfs = Object.values(sales).map(s => s?.avgPSF).filter((v): v is number => !!v && v > 0);
    if (!psfs.length) return { floor: 0, avg: 0, ceiling: 0 };
    return {
      floor: Math.min(...psfs),
      avg: Math.round(psfs.reduce((a, b) => a + b, 0) / psfs.length),
      ceiling: Math.max(...psfs),
    };
  }, [masterAreaData]);

  // Legacy areaComps kept for feasibility tab backward compat only
  const areaComps = useMemo(() => {
    const comps = (scopedAiData?.comparables || []) as any[];
    const normalized = comps.map(normalizeComparable);
    return normalized.filter((c) => {
      const name = c.name?.toString() || '';
      if (!name.trim()) return false;
      if (/transaction|txn/i.test(name) || /^[0-9\-_]+$/.test(name)) return false;
      if (scopedAreaCode) {
        const scope = [c.area, c.location, c.project].filter(Boolean).join(' ');
        const scopeCodes = extractAreaCodes(scope);
        if (scopeCodes.length > 1) return false;
        if (scopeCodes.length === 1 && scopeCodes[0] !== scopedAreaCode) return false;
      }
      return true;
    });
  }, [scopedAiData, scopedAreaCode]);

  const areaCompsWithPlans = useMemo(
    () => areaComps.filter((c: any) => typeof c.payPlan === 'string' && c.payPlan.trim().length > 0),
    [areaComps]
  );

  const areaTxnData = useMemo(() => {
    const fallbackMarket = effectiveClff?.market;
    const fallbackPsf = {
      studio: fallbackMarket?.studioPsfAvg || 0,
      br1: fallbackMarket?.oneBrPsfAvg || 0,
      br2: fallbackMarket?.twoBrPsfAvg || 0,
      br3: fallbackMarket?.threeBrPsfAvg || 0,
    };
    const safeObj = (val: any, fallback: Record<string, number>) => {
      if (val && typeof val === 'object') return { ...fallback, ...val };
      return fallback;
    };
    if (scopedAiData) {
      return {
        avgPsf: safeObj(scopedAiData.unitPsf, fallbackPsf),
        medianPsf: safeObj(scopedAiData.medianPsf, ZERO_UNIT),
        avgSize: safeObj(scopedAiData.unitSizes, ZERO_UNIT),
        avgPrice: safeObj(scopedAiData.avgPrices, ZERO_UNIT),
        count: safeObj(scopedAiData.txnCount, { ...ZERO_COUNT, total: fallbackMarket?.salesTransactions || 0 }),
      };
    }
    if (fallbackMarket) {
      return {
        avgPsf: fallbackPsf,
        medianPsf: ZERO_UNIT,
        avgSize: ZERO_UNIT,
        avgPrice: ZERO_UNIT,
        count: { studio: 0, br1: 0, br2: 0, br3: 0, total: fallbackMarket.salesTransactions },
      };
    }
    return { avgPsf: ZERO_UNIT, medianPsf: ZERO_UNIT, avgSize: ZERO_UNIT, avgPrice: ZERO_UNIT, count: ZERO_COUNT };
  }, [scopedAiData, effectiveClff]);

  const areaMarketBench = useMemo(() => {
    if (scopedAiData) {
      const floor = scopedAiData.marketFloorPsf || 0;
      const avg = scopedAiData.marketAvgPsf || 0;
      const ceiling = scopedAiData.marketCeilingPsf || 0;

      if (floor || avg || ceiling) {
        return { floor, avg, ceiling };
      }

      const txnPsf = Object.values(scopedAiData.unitPsf || {}).filter((v: any) => typeof v === 'number' && v > 0) as number[];
      if (txnPsf.length > 0) {
        return {
          floor: Math.min(...txnPsf),
          avg: Math.round(txnPsf.reduce((a, b) => a + b, 0) / txnPsf.length),
          ceiling: Math.max(...txnPsf),
        };
      }

      const compPsf = (scopedAiData.comparables || []).map((c: any) => c.psf).filter((v: any) => typeof v === 'number' && v > 0) as number[];
      if (compPsf.length > 0) {
        return {
          floor: Math.min(...compPsf),
          avg: Math.round(compPsf.reduce((a, b) => a + b, 0) / compPsf.length),
          ceiling: Math.max(...compPsf),
        };
      }
    }

    // CLFF or anchor fallback
    if (effectiveClff) {
      const m = effectiveClff.market;
      const psfs = [m.studioPsfAvg, m.oneBrPsfAvg, m.twoBrPsfAvg, m.threeBrPsfAvg].filter(Boolean) as number[];
      const avg = psfs.length > 0 ? Math.round(psfs.reduce((a, b) => a + b, 0) / psfs.length) : 0;
      const floor = psfs.length > 0 ? Math.min(...psfs) : 0;
      const ceiling = psfs.length > 0 ? Math.max(...psfs) : 0;
      return { floor, avg, ceiling };
    }

    return { floor: 0, avg: 0, ceiling: 0 };
  }, [scopedAiData, effectiveClff]);


  const fs = useMemo(() => {
    const result = calcDSCFeasibility(dscInput, activeMix, {
      ...areaMarketOverrides,
      efficiency: effectiveOverrides.efficiency,
      landCostPsf: effectiveOverrides.landCostPsf,
      constructionPsf: effectiveOverrides.constructionPsf,
      buaMultiplier: effectiveOverrides.buaMultiplier,
      avgPsfOverride: effectiveOverrides.avgPsfOverride,
      contingencyPct: includeContingency ? effectiveOverrides.contingencyPct : 0,
      financePct: includeFinance ? effectiveOverrides.financePct : 0,
    });
    return result;
  }, [dscInput, activeMix, effectiveOverrides, includeContingency, includeFinance, areaMarketOverrides]);

  // Compute feasibility for ALL comparison plots (for compare tab + notes)
  const allResults = useMemo(() => {
    return allPlots.map(p => {
      const input = toDSCInput(p, null);
      const result = calcDSCFeasibility(input, activeMix, areaMarketOverrides);
      return { id: p.id, plot: p, input, result };
    });
  }, [allPlots, activeMix, areaMarketOverrides]);

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

  if (!hasAreaData) {
    return (
      <div className="h-full flex items-center justify-center glass-card glow-border">
        <div className="text-center max-w-sm">
          <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-2">No Area Data Available</h3>
          <p className="text-sm text-muted-foreground">
            No matching area profile or anchor area could be resolved for this location. Upload a research file in <strong>Settings → Area Research</strong> for "<strong>{activePlot.location || activePlot.project || activePlot.id}</strong>".
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
                  className={`relative px-5 py-2.5 text-sm font-bold rounded-t-lg border-x border-t transition-all ${isActive
                    ? 'bg-card border-border/50 text-primary -mb-px z-10'
                    : 'bg-muted/30 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono opacity-50">#{i + 1}</span>
                    <span>{p.id}</span>
                  </div>
                  {pResult && (
                    <div className={`text-[10px] font-mono mt-0.5 ${pResult.result.roi > 0.2 ? 'text-success' : pResult.result.roi > 0 ? 'text-warning' : 'text-destructive'
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
              {dataSource && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary ml-2">{dataSource}</Badge>}
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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2 p-2 rounded-lg bg-muted/30 border border-border/30">
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
              <Input type="number" step="1" className="h-7 text-xs mt-0.5" defaultValue={effectiveOverrides.efficiency ? effectiveOverrides.efficiency * 100 : 95}
                onChange={e => { const v = parseFloat(e.target.value); const eff = v > 0 ? v / 100 : undefined; setOverrides(p => ({ ...p, efficiency: eff })); if (eff && onFeasibilityParamsChange && sharedFeasibilityParams) onFeasibilityParamsChange({ ...sharedFeasibilityParams, efficiency: eff }); }} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-bold">Avg Selling PSF ⭐</label>
              <Input type="number" className="h-7 text-xs mt-0.5 border-primary/50" placeholder="Auto from market"
                defaultValue={effectiveOverrides.avgPsfOverride || ''}
                onChange={e => { const v = parseFloat(e.target.value); const psf = !isNaN(v) && v > 0 ? v : undefined; setOverrides(p => ({ ...p, avgPsfOverride: psf })); if (onFeasibilityParamsChange && sharedFeasibilityParams) onFeasibilityParamsChange({ ...sharedFeasibilityParams, avgPsfOverride: psf }); }} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Land Cost (PSF)</label>
              <Input type="number" className="h-7 text-xs mt-0.5"
                value={effectiveOverrides.landCostPsf || ''}
                placeholder={Math.round(areaMarketBench.avg / 10).toString()}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  const psf = !isNaN(v) ? v : undefined;
                  const total = psf ? Math.round(psf * fs.gfa) : undefined;
                  const newOverrides = { ...overrides, landCostPsf: psf, landCost: total };
                  setOverrides(newOverrides);
                  if (onFeasibilityParamsChange && sharedFeasibilityParams) {
                    onFeasibilityParamsChange({ ...sharedFeasibilityParams, ...newOverrides });
                  }
                }}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Construction (PSF)</label>
              <Input type="number" className="h-7 text-xs mt-0.5" defaultValue={effectiveOverrides.constructionPsf || 420}
                onChange={e => { const v = parseFloat(e.target.value) || undefined; setOverrides(p => ({ ...p, constructionPsf: v })); if (v && onFeasibilityParamsChange && sharedFeasibilityParams) onFeasibilityParamsChange({ ...sharedFeasibilityParams, constructionPsf: v }); }} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">BUA Multiplier (×)</label>
              <Input type="number" step="0.05" className="h-7 text-xs mt-0.5" defaultValue={effectiveOverrides.buaMultiplier || 1.45}
                onChange={e => { const v = parseFloat(e.target.value) || undefined; setOverrides(p => ({ ...p, buaMultiplier: v })); if (v && onFeasibilityParamsChange && sharedFeasibilityParams) onFeasibilityParamsChange({ ...sharedFeasibilityParams, buaMultiplier: v }); }} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Contingency (%)</label>
              <Input type="number" step="0.5" className="h-7 text-xs mt-0.5" defaultValue={effectiveOverrides.contingencyPct != null ? effectiveOverrides.contingencyPct * 100 : 5}
                onChange={e => { const v = parseFloat(e.target.value); const pctVal = !isNaN(v) ? v / 100 : undefined; setOverrides(p => ({ ...p, contingencyPct: pctVal })); if (pctVal != null && onFeasibilityParamsChange && sharedFeasibilityParams) onFeasibilityParamsChange({ ...sharedFeasibilityParams, contingencyPct: v }); }} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Finance (%)</label>
              <Input type="number" step="0.5" className="h-7 text-xs mt-0.5" defaultValue={effectiveOverrides.financePct != null ? effectiveOverrides.financePct * 100 : 3}
                onChange={e => { const v = parseFloat(e.target.value); const pctVal = !isNaN(v) ? v / 100 : undefined; setOverrides(p => ({ ...p, financePct: pctVal })); if (pctVal != null && onFeasibilityParamsChange && sharedFeasibilityParams) onFeasibilityParamsChange({ ...sharedFeasibilityParams, financePct: v }); }} />
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
          <KpiCard label="Break-Even" value={`AED ${fmt(Math.round(fs.breakEvenPsf))}`} sub={`vs AED ${fmt(areaMarketBench.avg)} mkt avg`} />
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

              {/* 1.1 Affection Plan Section (Newly Added for visibility) */}
              <Section num={1.1} title="Affection Plan & Constraints">
                {!plan ? (
                  <div className="flex items-center gap-2 py-3 px-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                    <FileWarning className="w-4 h-4 shrink-0" />
                    Affection Plan constraints not available for this plot.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1.5 p-3 rounded-lg bg-muted/20 border border-border/20">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Building Parameters</span>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Max Height</span>
                        <span className="font-semibold">{plan.maxHeight || dscInput.height}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Floors</span>
                        <span className="font-semibold">{plan.maxHeightFloors || fs.residentialFloors}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Plot Coverage</span>
                        <span className="font-semibold">{plan.plotCoverage || '60%'}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 p-3 rounded-lg bg-muted/20 border border-border/20">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Setbacks (Typical)</span>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Front / Road</span>
                        <span className="font-semibold">{plan.buildingSetbacks.side1 || '5m'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Sides</span>
                        <span className="font-semibold">{plan.buildingSetbacks.side2 || '3m'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Rear</span>
                        <span className="font-semibold">{plan.buildingSetbacks.side3 || '5m'}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 p-3 rounded-lg bg-muted/20 border border-border/20">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Land Use</span>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Primary</span>
                        <span className="font-semibold">{plan.mainLanduse || dscInput.zone}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Status</span>
                        <span className="font-semibold text-success">{plan.siteStatus || 'Available'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">GFA Type</span>
                        <span className="font-semibold">{plan.gfaType || 'Residential'}</span>
                      </div>
                    </div>
                  </div>
                )}
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
                        { key: 'land', item: 'Land Cost', basis: 'GFA × Land PSF', rate: <span className={effectiveOverrides.landCostPsf ? 'text-primary font-bold' : ''}>{`AED ${fmt(Math.round(fs.landCost / fs.gfa))}/sqft`}</span>, amount: fs.landCost, toggle: null },
                        { key: 'construction', item: 'Construction', basis: `BUA × Construction PSF`, rate: `AED ${overrides.constructionPsf || (clffMatch?.area.constructionPsf || 420)}/sqft BUA`, amount: fs.constructionCost, toggle: null },
                        { key: 'authority', item: 'Authority / DLD Fees', basis: '4% × Land Cost', rate: '4% of land', amount: fs.authorityFees, toggle: null },
                        { key: 'consultant', item: 'Consultant & Design', basis: '3% × Construction', rate: '3% of construction', amount: fs.consultantFees, toggle: null },
                        { key: 'marketing', item: 'Sales & Marketing', basis: '2% × GDV (Bukadra)', rate: '2% of GDV', amount: fs.marketing, toggle: null },
                        { key: 'contingency', item: 'Contingency Reserve', basis: '% × Construction', rate: `${((overrides.contingencyPct ?? 0.05) * 100).toFixed(1)}% of construction`, amount: fs.contingency, toggle: { checked: includeContingency, onChange: setIncludeContingency } },
                        { key: 'finance', item: 'Finance / Interest', basis: '% × GDV (Bukadra)', rate: `${((overrides.financePct ?? 0.03) * 100).toFixed(1)}% of GDV`, amount: fs.financing, toggle: { checked: includeFinance, onChange: setIncludeFinance } },
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
                        { type: 'Studio', u: fs.units.studio, sz: (areaMarketOverrides as any).unitSizes?.studio || (areaTxnData.avgSize as any).studio || UNIT_SIZES.studio, pr: fs.prices.studio, rent: (areaMarketOverrides as any).unitRents?.studio || RENT_PSF_YR.studio },
                        { type: '1 Bedroom', u: fs.units.br1, sz: (areaMarketOverrides as any).unitSizes?.br1 || (areaTxnData.avgSize as any).br1 || UNIT_SIZES.br1, pr: fs.prices.br1, rent: (areaMarketOverrides as any).unitRents?.br1 || RENT_PSF_YR.br1 },
                        { type: '2 Bedroom', u: fs.units.br2, sz: (areaMarketOverrides as any).unitSizes?.br2 || (areaTxnData.avgSize as any).br2 || UNIT_SIZES.br2, pr: fs.prices.br2, rent: (areaMarketOverrides as any).unitRents?.br2 || RENT_PSF_YR.br2 },
                        { type: '3 Bedroom', u: fs.units.br3, sz: (areaMarketOverrides as any).unitSizes?.br3 || (areaTxnData.avgSize as any).br3 || UNIT_SIZES.br3, pr: fs.prices.br3, rent: (areaMarketOverrides as any).unitRents?.br3 || RENT_PSF_YR.br3 },
                      ].map(r => {
                        // Derive actual PSF from price/size (matches engine calculation exactly)
                        const actualPsf = r.sz > 0 ? Math.round(r.pr / r.sz) : 0;
                        return (
                          <TableRow key={r.type}>
                            <TableCell className="text-sm font-medium py-2">{r.type}</TableCell>
                            <TableCell className="text-sm text-right font-mono py-2">{fmt(r.u)}</TableCell>
                            <TableCell className="text-sm text-right py-2">{pct(r.u / fs.units.total)}</TableCell>
                            <TableCell className="text-sm text-right py-2">{fmt(r.sz)}</TableCell>
                            <TableCell className="text-sm text-right py-2">{fmt(r.u * r.sz)}</TableCell>
                            <TableCell className="text-sm text-right py-2">{pct((r.u * r.sz) / fs.sellableArea)}</TableCell>
                            <TableCell className="text-sm text-right font-mono py-2">AED {fmt(actualPsf)}</TableCell>
                            <TableCell className="text-sm text-right font-mono py-2">{fmtA(r.pr)}</TableCell>
                            <TableCell className="text-sm text-right py-2">AED {r.rent}</TableCell>
                            <TableCell className="text-sm text-right py-2">{pct((r.sz * r.rent) / r.pr)}</TableCell>
                          </TableRow>
                        );
                      })}
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

              {/* Sales Transactions Reference — uses masterTxnData from crossAreaMasterData.ts */}
              <Section title={`${areaName} Sales Transactions (Area-Only)`} badge={masterTxnData.count.total ? `${masterTxnData.count.total} txns` : 'No area data'}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Unit Type', 'Transactions', '% Share', 'Avg PSF', 'Median PSF', 'Avg Size', 'Avg Price', 'Median Price'].map(h => (
                          <TableHead key={h} className="text-[10px] text-right first:text-left">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { type: 'Studio', txn: masterTxnData.count.studio, share: masterTxnData.sharePct.studio, avgPsf: masterTxnData.avgPsf.studio, medPsf: masterTxnData.medianPsf.studio, sz: masterTxnData.avgSize.studio, pr: masterTxnData.avgPrice.studio, medPr: masterTxnData.medianPrice.studio, insuff: masterTxnData.insufficient.studio, noData: masterTxnData.noData.studio },
                        { type: '1 Bedroom', txn: masterTxnData.count.br1, share: masterTxnData.sharePct.br1, avgPsf: masterTxnData.avgPsf.br1, medPsf: masterTxnData.medianPsf.br1, sz: masterTxnData.avgSize.br1, pr: masterTxnData.avgPrice.br1, medPr: masterTxnData.medianPrice.br1, insuff: masterTxnData.insufficient.br1, noData: masterTxnData.noData.br1 },
                        { type: '2 Bedroom', txn: masterTxnData.count.br2, share: masterTxnData.sharePct.br2, avgPsf: masterTxnData.avgPsf.br2, medPsf: masterTxnData.medianPsf.br2, sz: masterTxnData.avgSize.br2, pr: masterTxnData.avgPrice.br2, medPr: masterTxnData.medianPrice.br2, insuff: masterTxnData.insufficient.br2, noData: masterTxnData.noData.br2 },
                        { type: '3 Bedroom', txn: masterTxnData.count.br3, share: masterTxnData.sharePct.br3, avgPsf: masterTxnData.avgPsf.br3, medPsf: masterTxnData.medianPsf.br3, sz: masterTxnData.avgSize.br3, pr: masterTxnData.avgPrice.br3, medPr: masterTxnData.medianPrice.br3, insuff: masterTxnData.insufficient.br3, noData: masterTxnData.noData.br3 },
                      ].filter(r => !r.noData).map(r => (
                        <TableRow key={r.type}>
                          <TableCell className="text-xs font-medium py-1.5">{r.type}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{r.txn ? fmt(r.txn) : '—'}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5 font-bold">{r.share ? `${r.share.toFixed(1)}%` : '—'}</TableCell>
                          <TableCell className="text-xs text-right font-mono font-bold py-1.5">AED {fmt(r.avgPsf)}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{r.medPsf ? `AED ${fmt(r.medPsf)}` : '—'}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{r.sz ? `${fmt(r.sz)} sqft` : '—'}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{r.pr ? fmtA(r.pr) : '—'}{r.insuff ? ' ⚠' : ''}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{r.medPr ? fmtA(r.medPr) : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    {masterTxnData.count.total > 0 && (
                      <TableFooter>
                        <TableRow>
                          <TableCell className="text-xs font-bold py-1.5">TOTAL</TableCell>
                          <TableCell className="text-xs text-right font-bold py-1.5">{fmt(masterTxnData.count.total)}</TableCell>
                          <TableCell className="text-xs text-right font-bold py-1.5">100%</TableCell>
                          <TableCell className="text-xs text-right py-1.5" colSpan={5}>—</TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </div>
                {Object.values(masterTxnData.insufficient).some(v => v) && (
                  <div className="mt-1.5 text-[10px] text-warning p-1.5 rounded bg-warning/10 border border-warning/20">
                    ⚠ Units marked with ⚠ have insufficient transactions (&lt;10) for reliable median calculation.
                  </div>
                )}
                <div className="mt-2 text-[10px] text-muted-foreground p-2 rounded-lg bg-muted/30 border border-border/30">
                  💡 GDV is calculated using average selling PSF from {areaName} market transactions × standard unit sizes. Price = Size × Avg PSF.
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
                        { type: 'Studio', u: fs.units.studio, pr: fs.prices.studio, rev: fs.revBreak.studio, sz: (areaMarketOverrides as any).unitSizes?.studio || (areaTxnData.avgSize as any).studio || UNIT_SIZES.studio, rent: (areaMarketOverrides as any).unitRents?.studio || RENT_PSF_YR.studio },
                        { type: '1 Bedroom', u: fs.units.br1, pr: fs.prices.br1, rev: fs.revBreak.br1, sz: (areaMarketOverrides as any).unitSizes?.br1 || (areaTxnData.avgSize as any).br1 || UNIT_SIZES.br1, rent: (areaMarketOverrides as any).unitRents?.br1 || RENT_PSF_YR.br1 },
                        { type: '2 Bedroom', u: fs.units.br2, pr: fs.prices.br2, rev: fs.revBreak.br2, sz: (areaMarketOverrides as any).unitSizes?.br2 || (areaTxnData.avgSize as any).br2 || UNIT_SIZES.br2, rent: (areaMarketOverrides as any).unitRents?.br2 || RENT_PSF_YR.br2 },
                        { type: '3 Bedroom', u: fs.units.br3, pr: fs.prices.br3, rev: fs.revBreak.br3, sz: (areaMarketOverrides as any).unitSizes?.br3 || (areaTxnData.avgSize as any).br3 || UNIT_SIZES.br3, rent: (areaMarketOverrides as any).unitRents?.br3 || RENT_PSF_YR.br3 },
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
                  <KpiCard label="Rental Yield" value={pct(fs.grossYield)} sub={`vs 5.5–6.5% ${areaName} avg`} positive={fs.grossYield > 0.055} />
                  <KpiCard label="Avg Selling PSF" value={`AED ${fmt(Math.round(fs.avgPsf))}`} sub={`Wtd avg from ${areaTxnData.count.total || '—'} txns`} positive={fs.avgPsf >= areaMarketBench.avg} />
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
                        ['Break-Even PSF', `AED ${fmt(Math.round(fs.breakEvenPsf))}`, `${areaName} Avg AED ${fmt(areaMarketBench.avg)}`, fs.breakEvenPsf < areaMarketBench.avg],
                        ['Land Cost % GDV', pct(fs.landCost / fs.grossSales), 'Max 40%', fs.landCost / fs.grossSales <= 0.40],
                        ['Rental Yield', pct(fs.grossYield), `${areaName} Avg ~5.5%`, fs.grossYield >= 0.055],
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

          {activeTab === 'comparison' && (
            <>
              <Section title={`${areaName} Competitive Project Analysis`} badge={`${masterComps.length} projects · Master Data`}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Project', 'Developer', 'Plot (sqft)', 'GFA (sqft)', 'Sellable (sqft)', 'Units', 'Floors', 'Handover', 'Price From (AED)', 'Payment'].map(h => (
                          <TableHead key={h} className="text-[10px] text-right first:text-left whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {masterComps.map((c: any) => {
                        const gfa = c.plotSqft && c.plotSqft > 0 ? c.plotSqft : c.bua || 0;
                        const sellable = Math.round(gfa * 0.95);
                        return (
                          <TableRow key={c.name}>
                            <TableCell className="text-xs font-medium py-1.5 whitespace-nowrap">{c.name}</TableCell>
                            <TableCell className="text-[10px] text-right py-1.5">{c.developer || '—'}</TableCell>
                            <TableCell className="text-xs text-right font-mono py-1.5">{c.plotSqft ? fmt(c.plotSqft) : '—'}</TableCell>
                            <TableCell className="text-xs text-right font-mono py-1.5">{gfa ? fmt(gfa) : '—'}</TableCell>
                            <TableCell className="text-xs text-right font-mono py-1.5">{sellable ? fmt(sellable) : '—'}</TableCell>
                            <TableCell className="text-xs text-right font-mono py-1.5">{c.units || '—'}</TableCell>
                            <TableCell className="text-[10px] text-right py-1.5">{c.floors || '—'}</TableCell>
                            <TableCell className="text-[10px] text-right py-1.5">{c.handover || '—'}</TableCell>
                            <TableCell className="text-xs text-right font-mono font-bold text-primary py-1.5">{c.priceFrom ? fmtA(c.priceFrom) : c.psf ? `AED ${fmt(c.psf)}/sqft` : '—'}</TableCell>
                            <TableCell className="text-[10px] text-right py-1.5">{c.payPlan || '—'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Comparison vs Your Plot */}
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Project', 'Units/1,000 sqft', 'Efficiency Ratio', 'GFA Diff vs Yours', 'Unit Count vs Yours'].map(h => (
                          <TableHead key={h} className="text-[10px] text-right first:text-left">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {masterComps.map((c: any) => {
                        const gfa = c.plotSqft && c.plotSqft > 0 ? c.plotSqft : c.bua || 0;
                        const sellable = gfa * 0.95;
                        const unitsPerK = gfa > 0 && c.units ? (c.units / (gfa / 1000)).toFixed(2) : '—';
                        const effRatio = gfa > 0 ? (sellable / gfa).toFixed(2) : '—';
                        return (
                          <TableRow key={c.name}>
                            <TableCell className="text-xs font-medium py-1.5">{c.name}</TableCell>
                            <TableCell className="text-xs text-right font-mono py-1.5">{unitsPerK}</TableCell>
                            <TableCell className="text-xs text-right font-mono py-1.5">{effRatio}</TableCell>
                            <TableCell className="text-xs text-right py-1.5">{gfa ? `${fmt(Math.round(fs.gfa - gfa))} sqft` : '—'}</TableCell>
                            <TableCell className="text-xs text-right py-1.5">{fs.units.total} vs {c.units || '—'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {masterComps.length > 0 ? (
                  <div className="mt-3 p-2 rounded-lg bg-muted/30 border border-border/30 text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Market Intelligence:</strong> {areaName} sales avg AED {fmt(masterMarketBench.avg)}/sqft{masterTxnData.count.total ? ` (${masterTxnData.count.total} txns)` : ''} · Market range AED {fmt(masterMarketBench.floor)}–{fmt(masterMarketBench.ceiling)}/sqft
                    <Badge variant="outline" className="text-[9px] ml-2 border-primary/30 text-primary">Cross-Area Master v2</Badge>
                  </div>
                ) : (
                  <div className="mt-3 p-4 rounded-lg bg-warning/5 border border-warning/20 text-xs text-center text-muted-foreground italic">
                    ⚠️ No benchmarks in master dataset for "{areaName}".
                  </div>
                )}
              </Section>

              {/* Competitor Unit Mix Breakdown */}
              <Section title={`Competitor Unit Mix Breakdown — ${areaName}`} badge={masterComps.length > 0 ? `${masterComps.length} projects` : 'CLFF Recommended'}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                         {['Project', 'Units', 'Studio %', '1BR %', '2BR %', '3BR %', 'Avg Size (sqft)', 'Dominant Type'].map(h => (
                          <TableHead key={h} className="text-[10px] text-right first:text-left whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {masterComps.length > 0 ? masterComps.map((c: any) => {
                        const mixes = [
                          { type: 'Studio', pct: c.studioP || 0 },
                          { type: '1BR', pct: c.br1P || 0 },
                          { type: '2BR', pct: c.br2P || 0 },
                          { type: '3BR', pct: c.br3P || 0 },
                        ];
                        const total = mixes.reduce((s, m) => s + m.pct, 0);
                        const dominant = mixes.reduce((a, b) => a.pct > b.pct ? a : b);
                        const gfa = c.plotSqft && c.plotSqft > 0 ? c.plotSqft : c.bua || 0;
                        const sellable = gfa * 0.95;
                        const avgSize = c.units && c.units > 0 ? Math.round(sellable / c.units) : 0;
                        return (
                          <TableRow key={c.name}>
                            <TableCell className="text-xs font-medium py-1.5 whitespace-nowrap">{c.name}</TableCell>
                            <TableCell className="text-xs text-right font-mono py-1.5">{c.units || '—'}</TableCell>
                            <TableCell className={`text-xs text-right py-1.5 ${dominant.type === 'Studio' ? 'font-bold text-primary' : ''}`}>{c.studioP || 0}%</TableCell>
                            <TableCell className={`text-xs text-right py-1.5 ${dominant.type === '1BR' ? 'font-bold text-primary' : ''}`}>{c.br1P || 0}%</TableCell>
                            <TableCell className={`text-xs text-right py-1.5 ${dominant.type === '2BR' ? 'font-bold text-primary' : ''}`}>{c.br2P || 0}%</TableCell>
                            <TableCell className={`text-xs text-right py-1.5 ${dominant.type === '3BR' ? 'font-bold text-primary' : ''}`}>{c.br3P || 0}%</TableCell>
                            <TableCell className="text-xs text-right font-mono py-1.5">{avgSize ? fmt(avgSize) : '—'}</TableCell>
                            <TableCell className="text-xs text-right font-bold text-primary py-1.5">{dominant.type} ({dominant.pct}%){total !== 100 && total > 0 ? <span className="text-destructive ml-1 text-[9px]">Σ{total}%</span> : ''}</TableCell>
                          </TableRow>
                        );
                      }) : (
                        <TableRow>
                          <TableCell className="text-xs font-medium py-1.5 text-muted-foreground italic">CLFF Recommended Mix</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{fmt(fs.units.total)}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{Math.round(fs.mix.studio * 100)}%</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{Math.round(fs.mix.br1 * 100)}%</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{Math.round(fs.mix.br2 * 100)}%</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{Math.round(fs.mix.br3 * 100)}%</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{fmt(Math.round(fs.sellableArea / fs.units.total))}</TableCell>
                          <TableCell className="text-xs text-right py-1.5 text-muted-foreground">—</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                    <TableFooter>
                      {(() => {
                        if (masterComps.length > 0) {
                          const count = masterComps.length;
                          const avgS = Math.round(masterComps.reduce((a: number, c: any) => a + (c.studioP || 0), 0) / count);
                          const avg1 = Math.round(masterComps.reduce((a: number, c: any) => a + (c.br1P || 0), 0) / count);
                          const avg2 = Math.round(masterComps.reduce((a: number, c: any) => a + (c.br2P || 0), 0) / count);
                          const avg3 = Math.round(masterComps.reduce((a: number, c: any) => a + (c.br3P || 0), 0) / count);
                          const avgUnits = Math.round(masterComps.reduce((a: number, c: any) => a + (c.units || 0), 0) / count);
                          return (
                            <TableRow className="bg-primary/10">
                              <TableCell className="text-xs font-bold py-2 text-primary">Market Average</TableCell>
                              <TableCell className="text-xs text-right font-bold py-2 text-primary">{avgUnits || '—'}</TableCell>
                              <TableCell className="text-xs text-right font-bold py-2 text-primary">{avgS}%</TableCell>
                              <TableCell className="text-xs text-right font-bold py-2 text-primary">{avg1}%</TableCell>
                              <TableCell className="text-xs text-right font-bold py-2 text-primary">{avg2}%</TableCell>
                              <TableCell className="text-xs text-right font-bold py-2 text-primary">{avg3}%</TableCell>
                              <TableCell className="text-xs text-right font-bold py-2 text-primary" colSpan={2}></TableCell>
                            </TableRow>
                          );
                        }
                        return (
                          <TableRow className="bg-muted/30">
                            <TableCell className="text-xs font-bold py-2 text-muted-foreground" colSpan={8}>
                              No master data available for this area
                            </TableCell>
                          </TableRow>
                        );
                      })()}
                    </TableFooter>
                  </Table>
                </div>
              </Section>

              {/* Pricing Benchmarks — Enhanced with share %, median, insufficiency flags */}
              <Section title={`Pricing Benchmarks — ${areaName}`} badge="Cross-Area Master v2">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Metric', 'Studio', '1 Bedroom', '2 Bedroom', '3 Bedroom'].map(h => (
                          <TableHead key={h} className="text-[10px] text-right first:text-left">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { metric: 'Transactions', vals: [masterTxnData.count.studio, masterTxnData.count.br1, masterTxnData.count.br2, masterTxnData.count.br3], type: 'count' },
                        { metric: '% Share', vals: [masterTxnData.sharePct?.studio, masterTxnData.sharePct?.br1, masterTxnData.sharePct?.br2, masterTxnData.sharePct?.br3], type: 'pct' },
                        { metric: 'Avg PSF (AED)', vals: [masterTxnData.avgPsf.studio, masterTxnData.avgPsf.br1, masterTxnData.avgPsf.br2, masterTxnData.avgPsf.br3], type: 'psf' },
                        { metric: 'Median PSF (AED)', vals: [masterTxnData.medianPsf.studio, masterTxnData.medianPsf.br1, masterTxnData.medianPsf.br2, masterTxnData.medianPsf.br3], type: 'psf' },
                        { metric: 'Avg Price (AED)', vals: [masterTxnData.avgPrice.studio, masterTxnData.avgPrice.br1, masterTxnData.avgPrice.br2, masterTxnData.avgPrice.br3], type: 'price' },
                        { metric: 'Median Price (AED)', vals: [masterTxnData.medianPrice?.studio, masterTxnData.medianPrice?.br1, masterTxnData.medianPrice?.br2, masterTxnData.medianPrice?.br3], type: 'price' },
                        { metric: 'Avg Size (sqft)', vals: [masterTxnData.avgSize.studio, masterTxnData.avgSize.br1, masterTxnData.avgSize.br2, masterTxnData.avgSize.br3], type: 'size' },
                      ].map(row => {
                        const insufficientFlags = masterTxnData.insufficient || { studio: false, br1: false, br2: false, br3: false };
                        const noDataFlags = masterTxnData.noData || { studio: false, br1: false, br2: false, br3: false };
                        const flagKeys = ['studio', 'br1', 'br2', 'br3'] as const;
                        return (
                          <TableRow key={row.metric}>
                            <TableCell className="text-xs font-medium py-1.5">{row.metric}</TableCell>
                            {row.vals.map((v, i) => {
                              const isInsufficient = insufficientFlags[flagKeys[i]];
                              const isNoData = noDataFlags[flagKeys[i]];
                              let display: string;
                              if (isNoData && row.type !== 'count') {
                                display = '—';
                              } else if (row.type === 'price') {
                                display = v ? fmtA(v) : '—';
                              } else if (row.type === 'psf') {
                                display = v ? `AED ${fmt(v)}` : '—';
                              } else if (row.type === 'size') {
                                display = v ? `${fmt(v)} sqft` : '—';
                              } else if (row.type === 'pct') {
                                display = v ? `${v}%` : '—';
                              } else {
                                display = v != null ? fmt(v) : '—';
                              }
                              return (
                                <TableCell key={i} className={`text-xs text-right font-mono py-1.5 ${isInsufficient && row.metric.includes('Median') ? 'text-warning' : ''}`}>
                                  {display}
                                  {isInsufficient && row.metric.includes('Median') && (
                                    <span className="block text-[8px] text-warning font-normal">{`<${masterTxnData.count[flagKeys[i]]} txns`}</span>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Insufficiency warnings */}
                {masterTxnData.insufficient && Object.entries(masterTxnData.insufficient).some(([, v]) => v) && (
                  <div className="mt-2 p-2 rounded-lg bg-warning/10 border border-warning/20 text-[10px] text-warning flex items-start gap-1.5">
                    <FileWarning className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      {Object.entries(masterTxnData.insufficient)
                        .filter(([, v]) => v)
                        .map(([k]) => k === 'studio' ? 'Studio' : k === 'br1' ? '1BR' : k === 'br2' ? '2BR' : '3BR')
                        .join(', ')} — Insufficient transactions ({'<'}10) to compute reliable median. Values shown but may not be statistically significant.
                    </span>
                  </div>
                )}

                {masterTxnData.noData && Object.entries(masterTxnData.noData).some(([, v]) => v) && (
                  <div className="mt-2 p-2 rounded-lg bg-muted/30 border border-border/30 text-[10px] text-muted-foreground flex items-start gap-1.5">
                    <FileWarning className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      {Object.entries(masterTxnData.noData)
                        .filter(([, v]) => v)
                        .map(([k]) => k === 'studio' ? 'Studio' : k === 'br1' ? '1BR' : k === 'br2' ? '2BR' : '3BR')
                        .join(', ')} — No recorded transactions for this unit type.
                    </span>
                  </div>
                )}

                {
                  masterComps.length > 0 && (() => {
                    const compPriceValues = masterComps
                      .map((c: any) => toNum(c.priceFrom) || (typeof c.psf === 'number' && c.psf > 0 ? c.psf : null))
                      .filter((v): v is number => v != null && v > 0);

                    if (!compPriceValues.length) return null;

                    const floor = Math.min(...compPriceValues);
                    const ceiling = Math.max(...compPriceValues);
                    const avg = Math.round(compPriceValues.reduce((s, v) => s + v, 0) / compPriceValues.length);
                    const hasPriceFrom = masterComps.some((c: any) => toNum(c.priceFrom));

                    return (
                      <div className="mt-3">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Competitor {hasPriceFrom ? 'Price From' : 'PSF'} Range</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="data-card text-center py-2">
                            <div className="text-[10px] text-muted-foreground">Floor</div>
                            <div className="text-sm font-bold font-mono text-foreground">{hasPriceFrom ? fmtA(floor) : `AED ${fmt(floor)}`}</div>
                          </div>
                          <div className="data-card text-center py-2 border-primary/40">
                            <div className="text-[10px] text-muted-foreground">Average</div>
                            <div className="text-sm font-bold font-mono text-primary">{hasPriceFrom ? fmtA(avg) : `AED ${fmt(avg)}`}</div>
                          </div>
                          <div className="data-card text-center py-2">
                            <div className="text-[10px] text-muted-foreground">Ceiling</div>
                            <div className="text-sm font-bold font-mono text-foreground">{hasPriceFrom ? fmtA(ceiling) : `AED ${fmt(ceiling)}`}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                }
              </Section >

              {/* Pricing & Payment Plan Benchmarks */}
              <Section title={`Pricing & Payment Plan Benchmarks — ${areaName}`} badge={masterCompsWithPlans.length > 0 ? `${masterCompsWithPlans.length} plans` : 'CLFF Default'}>
                {masterComps.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {['Project', 'Svc Chg (AED/sqft)', 'Payment Plan', 'Units / 1,000 sqft', 'Efficiency Ratio', 'Notes'].map(h => (
                            <TableHead key={h} className="text-[10px] text-right first:text-left whitespace-nowrap">{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {masterComps.map((c: any) => {
                          const gfa = c.plotSqft && c.plotSqft > 0 ? c.plotSqft : c.bua || 0;
                          const sellable = gfa * 0.95;
                          const unitsPerK = gfa > 0 && c.units ? (c.units / (gfa / 1000)).toFixed(2) : '—';
                          const effRatio = gfa > 0 ? (sellable / gfa).toFixed(2) : '—';
                          const notes: string[] = [];
                          if (c.priceFrom && masterMarketBench.avg && c.priceFrom < masterMarketBench.avg * 0.9) notes.push('Best value entry');
                          if (c.priceFrom && masterMarketBench.avg && c.priceFrom > masterMarketBench.avg * 1.1) notes.push('Premium pricing');
                          if (parseFloat(unitsPerK) > 2) notes.push('Highest density');
                          if (c.svc && c.svc < 14) notes.push('Low svc charge');
                          if (!notes.length) notes.push('Strong yield profile');
                          const plan = c.payPlan as string || '—';
                          return (
                            <TableRow key={c.name}>
                              <TableCell className="text-xs font-medium py-1.5 whitespace-nowrap">{c.name}</TableCell>
                              <TableCell className="text-xs text-right font-mono py-1.5">{c.svc ? `AED ${c.svc}` : '—'}</TableCell>
                              <TableCell className="text-xs text-right font-mono py-1.5">{plan}</TableCell>
                              <TableCell className="text-xs text-right font-mono py-1.5">{unitsPerK}</TableCell>
                              <TableCell className="text-xs text-right font-mono py-1.5">{effRatio}</TableCell>
                              <TableCell className="text-[10px] text-right py-1.5 text-muted-foreground italic">{notes.join(' · ') || '—'}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="data-card p-4">
                    <div className="text-xs text-muted-foreground mb-2">Default CLFF Payment Structure</div>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(fs.payPlan).map(([stage, val]) => (
                        <div key={stage} className="text-center">
                          <div className="text-xl font-black font-mono text-primary">{val}%</div>
                          <div className="text-[10px] text-muted-foreground uppercase">
                            {stage === 'booking' ? 'Booking' : stage === 'construction' ? 'Construction' : 'Handover'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              {/* Pricing & Payment Benchmarks Visual */}
              <Section title="Pricing & Payment Benchmarks">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="data-card">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Area Pricing Benchmarks</h4>
                    <div className="flex gap-2 flex-wrap mb-2">
                      <div className="flex-1 bg-muted/20 border border-border/30 rounded-lg p-3 text-center">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">Market Floor</div>
                        <div className="text-lg font-bold font-mono">AED {fmt(masterMarketBench.floor)}</div>
                      </div>
                      <div className="flex-1 bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
                        <div className="text-[10px] text-primary uppercase mb-1 font-bold">Market Average</div>
                        <div className="text-lg font-bold font-mono text-primary">AED {fmt(masterMarketBench.avg)}</div>
                      </div>
                      <div className="flex-1 bg-muted/20 border border-border/30 rounded-lg p-3 text-center">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">Market Ceiling</div>
                        <div className="text-lg font-bold font-mono">AED {fmt(masterMarketBench.ceiling)}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground p-2 rounded bg-muted/30 border border-border/30 mt-2">
                      💡 Sourced from Cross-Area Master Market Comparison Report (Nov 2025 – Feb 2026).
                    </div>
                  </div>

                  <div className="data-card">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Payment Plan Distribution</h4>
                    <div className="space-y-2">
                      {(() => {
                        const plans = masterCompsWithPlans
                          .map((c: any) => (typeof c.payPlan === 'string' ? c.payPlan.trim() : ''))
                          .filter((p: string) => p.length > 0);

                        if (!plans.length) {
                          return (
                            <div className="text-xs text-muted-foreground">
                              Default: {Object.entries(fs.payPlan).map(([, v]) => `${v}%`).join('/')} (Booking/Construction/Handover)
                            </div>
                          );
                        }

                        const occurrences = plans.reduce((acc: Record<string, number>, p: string) => {
                          acc[p] = (acc[p] || 0) + 1;
                          return acc;
                        }, {});

                        return Object.entries(occurrences).map(([plan, count]) => {
                          const safeCount = Number(count) || 0;
                          const pctOfTotal = plans.length ? Math.max(0, Math.min(100, (safeCount / plans.length) * 100)) : 0;
                          return (
                            <div key={plan} className="mb-2">
                              <div className="flex justify-between text-xs mb-1 gap-2">
                                <span className="truncate">{plan}</span>
                                <span className="font-semibold whitespace-nowrap">{safeCount} Projects ({Math.round(pctOfTotal)}%)</span>
                              </div>
                              <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${pctOfTotal}%` }} />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </Section>

              {/* Demand-Driven Unit Mix Templates */}
              {masterAreaData && masterAreaData.unitMixTemplates.length > 0 && (
                <Section title={`Unit Mix Templates — ${areaName}`} badge={`${masterAreaData.unitMixTemplates.length} templates`}>
                  {masterAreaData.unitMixTemplates.map((template, tIdx) => {
                    const viability = scopedAreaCode ? evaluateTemplateViability(scopedAreaCode, template) : { show: true, warnings: [], supportData: [] };

                    return (
                      <div key={tIdx} className={`mb-4 p-3 rounded-lg border ${viability.show ? 'bg-card border-border/40' : 'bg-muted/20 border-border/20 opacity-60'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className={`text-xs font-bold uppercase tracking-wider ${viability.show ? 'text-primary' : 'text-muted-foreground line-through'}`}>
                            Template {tIdx + 1} — {template.name}
                          </h4>
                          {!viability.show && (
                            <Badge variant="outline" className="text-[9px] border-destructive/40 text-destructive">Hidden — insufficient demand</Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-2">{template.description}</p>

                        {viability.show && (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  {['Unit Type', 'Range', 'Recommended', 'Rationale', 'Viability'].map(h => (
                                    <TableHead key={h} className="text-[10px] text-right first:text-left">{h}</TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {template.units.map((entry, eIdx) => (
                                  <TableRow key={eIdx}>
                                    <TableCell className="text-xs font-medium py-1.5 uppercase">{entry.unitType}</TableCell>
                                    <TableCell className="text-xs text-right font-mono py-1.5">{entry.rangeMin}–{entry.rangeMax}%</TableCell>
                                    <TableCell className="text-xs text-right font-bold font-mono py-1.5 text-primary">{entry.recommended}%</TableCell>
                                    <TableCell className="text-[10px] text-right py-1.5 text-muted-foreground max-w-[200px] truncate" title={entry.rationale}>{entry.rationale}</TableCell>
                                    <TableCell className="text-xs text-right py-1.5">
                                      <span className={`font-bold ${entry.viability === '★' ? 'text-primary' : entry.viability === '✓' ? 'text-success' : entry.viability === '✗' ? 'text-destructive' : 'text-warning'}`}>
                                        {entry.viability}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        {/* Warnings */}
                        {viability.warnings.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {viability.warnings.map((w, i) => (
                              <div key={i} className="flex items-start gap-1.5 p-1.5 rounded bg-warning/10 border border-warning/20 text-[10px] text-warning">
                                <FileWarning className="w-3 h-3 shrink-0 mt-0.5" />
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {viability.supportData.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {viability.supportData.map((s, i) => (
                              <div key={i} className="flex items-start gap-1.5 p-1.5 rounded bg-success/10 border border-success/20 text-[10px] text-success">
                                <Target className="w-3 h-3 shrink-0 mt-0.5" />
                                <span>{s}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Section>
              )}

              {/* Auto-Generated Area Insights */}
              {scopedAreaCode && (() => {
                const insights = generateAreaInsights(scopedAreaCode);
                if (!insights.length) return null;
                return (
                  <Section title={`${areaName} Market Insights`} badge="Data-Derived">
                    <div className="space-y-2">
                      {insights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                          <Lightbulb className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                          <p className="text-xs text-foreground leading-relaxed">{insight}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-[9px] text-muted-foreground p-2 rounded bg-muted/20 border border-border/20">
                      Insights are computed from {areaName} transaction data, competitor supply analysis, and rental yield benchmarks. Not manually authored.
                    </div>
                  </Section>
                );
              })()}
            </>
          )
          }

          {/* ─── SENSITIVITY TAB ─── */}
          {
            activeTab === 'sensitivity' && (
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
                    <KpiCard label="Market Floor" value={`AED ${fmt(areaMarketBench.floor)}`} sub={`${areaName} historical`} />
                    <KpiCard label="Market Avg" value={`AED ${fmt(areaMarketBench.avg)}`} sub={`${areaTxnData.count.total ? `${areaTxnData.count.total}-txn` : ''} avg`} accent />
                    <KpiCard label="Market Ceiling" value={`AED ${fmt(areaMarketBench.ceiling)}`} sub="Premium" />
                    <KpiCard label="Buffer" value={`+AED ${fmt(Math.round(areaMarketBench.avg - fs.breakEvenPsf))}`} sub="vs break-even" positive={fs.breakEvenPsf < areaMarketBench.avg} negative={fs.breakEvenPsf > areaMarketBench.avg} />
                  </div>
                </Section>

              </>
            )
          }

          {/* ─── PLOT COMPARE TAB ─── */}
          {
            activeTab === 'plotCompare' && allResults.length >= 2 && (
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
                              <TableCell key={i} className={`text-sm text-right font-mono py-2 ${allResults[i].id === activeTabPlotId ? 'text-primary font-bold' : ''
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
            )
          }

          {
            activeTab === 'plotCompare' && allResults.length < 2 && (
              <div className="text-center py-12 text-muted-foreground">
                <GitCompareArrows className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No comparison plots selected</p>
                <p className="text-xs mt-1">Click the ⇆ icon on plots in the right sidebar to add up to 3 plots for comparison.</p>
              </div>
            )
          }

          {/* Bottom spacer for mix nav */}
          <div className="h-20" />
        </div >
      </ScrollArea >

      {/* ─── Bottom Unit Mix Selector ─── */}
      < div className="shrink-0 border-t border-border/50 bg-card/90 backdrop-blur-xl px-2 py-2" >
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider whitespace-nowrap">UNIT MIX:</span>
          {(Object.entries(MIX_TEMPLATES) as [MixKey, typeof MIX_TEMPLATES.investor][]).map(([k, v]) => (
            <button key={k} onClick={() => setActiveMix(k)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-2 rounded-lg border transition-all ${activeMix === k
                ? 'bg-primary/20 border-primary/50 text-foreground'
                : 'bg-muted/20 border-border/30 text-muted-foreground hover:bg-muted/40'
                }`}>
              <span className="text-sm">{v.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">{v.label}</span>
              <span className="text-[8px] text-muted-foreground">{v.tag}</span>
            </button>
          ))}
        </div>
      </div >

      {/* Share Modal */}
      < DCShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)
        }
        plotId={activePlot.id}
        activeMix={activeMix}
        fs={fs}
        plotInput={dscInput}
        overrides={effectiveOverrides}
      />
    </div >
  );
}
