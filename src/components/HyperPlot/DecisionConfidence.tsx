import { useState, useMemo, useEffect } from 'react';
import { Loader2, TrendingUp, DollarSign, Building2, BarChart3, Target, Shield, Printer, Maximize2, Minimize2, Settings2, GitCompareArrows, X, Lightbulb, StickyNote, ChevronRight, Share2, FileWarning } from 'lucide-react';
import { DCShareModal } from './DCShareModal';
import { Checkbox } from '@/components/ui/checkbox';
import { PlotData, AffectionPlanData, gisService } from '@/services/DDAGISService';
import { FeasibilityParams, DEFAULT_FEASIBILITY_PARAMS } from './FeasibilityCalculator';
import { calcDSCFeasibility, DSCPlotInput, DSCFeasibilityResult, MixKey, MIX_TEMPLATES, UNIT_SIZES, RENT_PSF_YR, fmt, fmtM, fmtA, pct } from '@/lib/dscFeasibility';
import { matchCLFFArea, findAnchorArea, normalizeAreaCode, CLFF_AREAS, CLFF_MARKET_DATA, getCLFFOverrides, type CLFFAreaProfile, type CLFFMarketData } from '@/lib/clffAreaDefaults';
import { getAreaScopedMarketData, resolvePlotAreaCode, matchesAreaCode, extractAreaCodes } from '@/lib/areaResearch';
import { findReportForLocation, AreaReport } from '@/data/areaReports';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { AnalysisSummary } from './AnalysisSummary';


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
  return n > 0 && n <= 1 ? Math.round(n * 100) : Math.round(n);
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
    psf: deriveComparablePsf(raw),
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
    // Fall back to CLFF or anchor area defaults
    if (effectiveClff) return getCLFFOverrides(effectiveClff.area.code);
    return {};
  }, [scopedAiData, areaReport, effectiveClff]);

  const ZERO_UNIT = { studio: 0, br1: 0, br2: 0, br3: 0 };
  const ZERO_COUNT = { studio: 0, br1: 0, br2: 0, br3: 0, total: 0 };

  const areaComps = useMemo(() => {
    const comps = (scopedAiData?.comparables || []) as any[];

    // Normalize shape first so all benchmark sections can render consistently
    const normalized = comps.map(normalizeComparable);

    // STRICT AREA FILTERING: include only same-area projects and reject multi-area scopes
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

    // CLFF or anchor fallback
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
                        { type: 'Studio', u: fs.units.studio, sz: (areaTxnData.avgSize as any).studio || UNIT_SIZES.studio, pr: fs.prices.studio, rent: (areaMarketOverrides as any).unitRents?.studio || RENT_PSF_YR.studio, txnPsf: (areaTxnData.avgPsf as any).studio || 0 },
                        { type: '1 Bedroom', u: fs.units.br1, sz: (areaTxnData.avgSize as any).br1 || UNIT_SIZES.br1, pr: fs.prices.br1, rent: (areaMarketOverrides as any).unitRents?.br1 || RENT_PSF_YR.br1, txnPsf: (areaTxnData.avgPsf as any).br1 || 0 },
                        { type: '2 Bedroom', u: fs.units.br2, sz: (areaTxnData.avgSize as any).br2 || UNIT_SIZES.br2, pr: fs.prices.br2, rent: (areaMarketOverrides as any).unitRents?.br2 || RENT_PSF_YR.br2, txnPsf: (areaTxnData.avgPsf as any).br2 || 0 },
                        { type: '3 Bedroom', u: fs.units.br3, sz: (areaTxnData.avgSize as any).br3 || UNIT_SIZES.br3, pr: fs.prices.br3, rent: (areaMarketOverrides as any).unitRents?.br3 || RENT_PSF_YR.br3, txnPsf: (areaTxnData.avgPsf as any).br3 || 0 },
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
              <Section title={`${areaName} Sales Transactions (Area-Only)`} badge={areaTxnData.count.total ? `${areaTxnData.count.total} txns` : scopedAiData?.isStrictlyScoped ? 'Scoped' : 'No area data'}>
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
                        { type: 'Studio', txn: areaTxnData.count.studio, avgPsf: areaTxnData.avgPsf.studio, medPsf: areaTxnData.medianPsf.studio, sz: areaTxnData.avgSize.studio, pr: areaTxnData.avgPrice.studio },
                        { type: '1 Bedroom', txn: areaTxnData.count.br1, avgPsf: areaTxnData.avgPsf.br1, medPsf: areaTxnData.medianPsf.br1, sz: areaTxnData.avgSize.br1, pr: areaTxnData.avgPrice.br1 },
                        { type: '2 Bedroom', txn: areaTxnData.count.br2, avgPsf: areaTxnData.avgPsf.br2, medPsf: areaTxnData.medianPsf.br2, sz: areaTxnData.avgSize.br2, pr: areaTxnData.avgPrice.br2 },
                        { type: '3 Bedroom', txn: areaTxnData.count.br3, avgPsf: areaTxnData.avgPsf.br3, medPsf: areaTxnData.medianPsf.br3, sz: areaTxnData.avgSize.br3, pr: areaTxnData.avgPrice.br3 },
                      ].map(r => (
                        <TableRow key={r.type}>
                          <TableCell className="text-xs font-medium py-1.5">{r.type}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{r.txn ? fmt(r.txn) : '—'}</TableCell>
                          <TableCell className="text-xs text-right font-mono font-bold py-1.5">AED {fmt(r.avgPsf)}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{r.medPsf ? `AED ${fmt(r.medPsf)}` : '—'}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{fmt(r.sz)} sqft</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{r.pr ? fmtA(r.pr) : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground p-2 rounded-lg bg-muted/30 border border-border/30">
                  💡 GDV is calculated using average selling prices from {areaName} {areaTxnData.count.total ? `${areaTxnData.count.total} real` : ''} transactions per unit type, not a flat benchmark PSF.
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
                        { type: 'Studio', u: fs.units.studio, pr: fs.prices.studio, rev: fs.revBreak.studio, sz: (areaTxnData.avgSize as any).studio || UNIT_SIZES.studio, rent: (areaMarketOverrides as any).unitRents?.studio || RENT_PSF_YR.studio },
                        { type: '1 Bedroom', u: fs.units.br1, pr: fs.prices.br1, rev: fs.revBreak.br1, sz: (areaTxnData.avgSize as any).br1 || UNIT_SIZES.br1, rent: (areaMarketOverrides as any).unitRents?.br1 || RENT_PSF_YR.br1 },
                        { type: '2 Bedroom', u: fs.units.br2, pr: fs.prices.br2, rev: fs.revBreak.br2, sz: (areaTxnData.avgSize as any).br2 || UNIT_SIZES.br2, rent: (areaMarketOverrides as any).unitRents?.br2 || RENT_PSF_YR.br2 },
                        { type: '3 Bedroom', u: fs.units.br3, pr: fs.prices.br3, rev: fs.revBreak.br3, sz: (areaTxnData.avgSize as any).br3 || UNIT_SIZES.br3, rent: (areaMarketOverrides as any).unitRents?.br3 || RENT_PSF_YR.br3 },
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
              <Section title={`${areaName} Competitive Project Analysis`} badge={`${areaComps.length} projects`}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Project', 'Developer', 'Plot (sqft)', 'Units', 'BUA', 'Floors', 'Handover', 'PSF', 'Payment'].map(h => (
                          <TableHead key={h} className="text-[10px] text-right first:text-left whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {areaComps.map((c: any) => (
                        <TableRow key={c.name}>
                          <TableCell className="text-xs font-medium py-1.5 whitespace-nowrap">{c.name}</TableCell>
                          <TableCell className="text-[10px] text-right py-1.5">{c.developer || '—'}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{c.plotSqft ? fmt(c.plotSqft) : '—'}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{c.units || '—'}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{c.bua ? fmt(c.bua) : '—'}</TableCell>
                          <TableCell className="text-[10px] text-right py-1.5">{c.floors || '—'}</TableCell>
                          <TableCell className="text-[10px] text-right py-1.5">{c.handover || '—'}</TableCell>
                          <TableCell className="text-xs text-right font-mono font-bold text-primary py-1.5">{c.psf ? `AED ${fmt(c.psf)}` : '—'}</TableCell>
                          <TableCell className="text-[10px] text-right py-1.5">{c.payPlan || '—'}</TableCell>
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
                      {areaComps.map((c: any) => {
                        const diff = fs.avgPsf - (c.psf || 0);
                        return (
                          <TableRow key={c.name}>
                            <TableCell className="text-xs font-medium py-1.5">{c.name}</TableCell>
                            <TableCell className="text-xs text-right py-1.5">{c.density ? c.density.toFixed(2) : '—'}</TableCell>
                            <TableCell className="text-xs text-right py-1.5">{c.bua ? `${fmt(Math.round(fs.gfa - c.bua))} sqft` : '—'}</TableCell>
                            <TableCell className="text-xs text-right py-1.5">{fs.units.total} vs {c.units || '—'}</TableCell>
                            <TableCell className={`text-xs text-right font-bold py-1.5 ${diff >= 0 ? 'text-success' : 'text-warning'}`}>
                              {c.psf ? `${diff >= 0 ? '+' : ''}AED ${fmt(Math.round(diff))}` : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {areaComps.length > 0 ? (
                  <div className="mt-3 p-2 rounded-lg bg-muted/30 border border-border/30 text-[10px] text-muted-foreground">
                    <strong className="text-foreground">Market Intelligence:</strong> {areaName} sales avg AED {fmt(areaMarketBench.avg)}/sqft{areaTxnData.count.total ? ` (${areaTxnData.count.total} txns)` : ''} · Market range AED {fmt(areaMarketBench.floor)}–{fmt(areaMarketBench.ceiling)}/sqft
                  </div>
                ) : (
                  <div className="mt-3 p-4 rounded-lg bg-warning/5 border border-warning/20 text-xs text-center text-muted-foreground italic">
                    ⚠️ No local benchmarks found for "{areaName}".
                    Please upload area research files to populate competitive analysis.
                  </div>
                )}
              </Section>

              {/* Competitor Unit Mix Breakdown — always render */}
              <Section title={`Competitor Unit Mix Breakdown — ${areaName}`} badge={areaComps.length > 0 ? `${areaComps.length} projects` : 'CLFF Recommended'}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Project', 'Units', 'Studio %', '1BR %', '2BR %', '3BR %', 'Dominant Type'].map(h => (
                          <TableHead key={h} className="text-[10px] text-right first:text-left whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {areaComps.length > 0 ? areaComps.map((c: any) => {
                        const mixes = [
                          { type: 'Studio', pct: c.studioP || 0 },
                          { type: '1BR', pct: c.br1P || 0 },
                          { type: '2BR', pct: c.br2P || 0 },
                          { type: '3BR', pct: c.br3P || 0 },
                        ];
                        const dominant = mixes.reduce((a, b) => a.pct > b.pct ? a : b);
                        return (
                          <TableRow key={c.name}>
                            <TableCell className="text-xs font-medium py-1.5 whitespace-nowrap">{c.name}</TableCell>
                            <TableCell className="text-xs text-right font-mono py-1.5">{c.units || '—'}</TableCell>
                            <TableCell className={`text-xs text-right py-1.5 ${dominant.type === 'Studio' ? 'font-bold text-primary' : ''}`}>{c.studioP || 0}%</TableCell>
                            <TableCell className={`text-xs text-right py-1.5 ${dominant.type === '1BR' ? 'font-bold text-primary' : ''}`}>{c.br1P || 0}%</TableCell>
                            <TableCell className={`text-xs text-right py-1.5 ${dominant.type === '2BR' ? 'font-bold text-primary' : ''}`}>{c.br2P || 0}%</TableCell>
                            <TableCell className={`text-xs text-right py-1.5 ${dominant.type === '3BR' ? 'font-bold text-primary' : ''}`}>{c.br3P || 0}%</TableCell>
                            <TableCell className="text-xs text-right font-bold text-primary py-1.5">{dominant.type} ({dominant.pct}%)</TableCell>
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
                          <TableCell className="text-xs text-right py-1.5 text-muted-foreground">—</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                    <TableFooter>
                      {(() => {
                        if (areaComps.length > 0) {
                          const count = areaComps.length;
                          const avgS = Math.round(areaComps.reduce((a: number, c: any) => a + (c.studioP || 0), 0) / count);
                          const avg1 = Math.round(areaComps.reduce((a: number, c: any) => a + (c.br1P || 0), 0) / count);
                          const avg2 = Math.round(areaComps.reduce((a: number, c: any) => a + (c.br2P || 0), 0) / count);
                          const avg3 = Math.round(areaComps.reduce((a: number, c: any) => a + (c.br3P || 0), 0) / count);
                          return (
                            <TableRow className="bg-primary/10">
                              <TableCell className="text-xs font-bold py-2 text-primary">Market Average</TableCell>
                              <TableCell className="text-xs text-right font-bold py-2 text-primary" colSpan={1}></TableCell>
                              <TableCell className="text-xs text-right font-bold py-2 text-primary">{avgS}%</TableCell>
                              <TableCell className="text-xs text-right font-bold py-2 text-primary">{avg1}%</TableCell>
                              <TableCell className="text-xs text-right font-bold py-2 text-primary">{avg2}%</TableCell>
                              <TableCell className="text-xs text-right font-bold py-2 text-primary">{avg3}%</TableCell>
                              <TableCell className="text-xs text-right font-bold py-2 text-primary" colSpan={1}></TableCell>
                            </TableRow>
                          );
                        }
                        return (
                          <TableRow className="bg-muted/30">
                            <TableCell className="text-xs font-bold py-2 text-muted-foreground" colSpan={7}>
                              Upload area research to populate competitive unit mix data
                            </TableCell>
                          </TableRow>
                        );
                      })()}
                    </TableFooter>
                  </Table>
                </div>
              </Section>

              {/* Pricing Benchmarks */}
              <Section title={`Pricing Benchmarks — ${areaName}`}>
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
                        { metric: 'Avg PSF', vals: [areaTxnData.avgPsf.studio, areaTxnData.avgPsf.br1, areaTxnData.avgPsf.br2, areaTxnData.avgPsf.br3] },
                        { metric: 'Median PSF', vals: [areaTxnData.medianPsf.studio, areaTxnData.medianPsf.br1, areaTxnData.medianPsf.br2, areaTxnData.medianPsf.br3] },
                        { metric: 'Avg Size (sqft)', vals: [areaTxnData.avgSize.studio, areaTxnData.avgSize.br1, areaTxnData.avgSize.br2, areaTxnData.avgSize.br3] },
                        { metric: 'Avg Price', vals: [areaTxnData.avgPrice.studio, areaTxnData.avgPrice.br1, areaTxnData.avgPrice.br2, areaTxnData.avgPrice.br3] },
                        { metric: 'Transactions', vals: [areaTxnData.count.studio, areaTxnData.count.br1, areaTxnData.count.br2, areaTxnData.count.br3] },
                      ].map(row => (
                        <TableRow key={row.metric}>
                          <TableCell className="text-xs font-medium py-1.5">{row.metric}</TableCell>
                          {row.vals.map((v, i) => (
                            <TableCell key={i} className="text-xs text-right font-mono py-1.5">
                              {row.metric === 'Avg Price' ? (v ? fmtA(v) : '—') :
                                row.metric.includes('PSF') ? (v ? `AED ${fmt(v)}` : '—') :
                                  row.metric === 'Avg Size (sqft)' ? (v ? `${fmt(v)} sqft` : '—') :
                                    (v ? fmt(v) : '—')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {
                  areaComps.length > 0 && (() => {
                    const compPsfValues = areaComps
                      .map((c: any) => (typeof c.psf === 'number' ? c.psf : null))
                      .filter((v): v is number => v != null && v > 0);

                    if (!compPsfValues.length) return null;

                    const floor = Math.min(...compPsfValues);
                    const ceiling = Math.max(...compPsfValues);
                    const avg = Math.round(compPsfValues.reduce((s, v) => s + v, 0) / compPsfValues.length);

                    return (
                      <div className="mt-3">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Competitor PSF Range</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="data-card text-center py-2">
                            <div className="text-[10px] text-muted-foreground">Floor</div>
                            <div className="text-sm font-bold font-mono text-foreground">AED {fmt(floor)}</div>
                          </div>
                          <div className="data-card text-center py-2 border-primary/40">
                            <div className="text-[10px] text-muted-foreground">Average</div>
                            <div className="text-sm font-bold font-mono text-primary">AED {fmt(avg)}</div>
                          </div>
                          <div className="data-card text-center py-2">
                            <div className="text-[10px] text-muted-foreground">Ceiling</div>
                            <div className="text-sm font-bold font-mono text-foreground">AED {fmt(ceiling)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                }
              </Section >

              {/* Developer & Payment Plan Benchmarks — always render */}
              <Section title={`Developer & Payment Plan Benchmarks — ${areaName}`} badge={areaCompsWithPlans.length > 0 ? `${areaCompsWithPlans.length} plans` : 'CLFF Default'}>
                {areaCompsWithPlans.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {['Project', 'Payment Structure', 'Type'].map(h => (
                            <TableHead key={h} className="text-[10px] text-right first:text-left">{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {areaCompsWithPlans.map((c: any) => {
                          const plan = c.payPlan as string;
                          const isPostHandover = /post/i.test(plan) || /ph/i.test(plan);
                          const isHeavyBooking = /^[3-9]0/i.test(plan) || /^[4-9]/i.test(plan.split('/')[0]);
                          return (
                            <TableRow key={c.name}>
                              <TableCell className="text-xs font-medium py-1.5 whitespace-nowrap">{c.name}</TableCell>
                              <TableCell className="text-xs text-right font-mono py-1.5">{plan}</TableCell>
                              <TableCell className="text-xs text-right py-1.5">
                                <Badge variant="outline" className={`text-[9px] ${isPostHandover ? 'border-success/40 text-success' : isHeavyBooking ? 'border-warning/40 text-warning' : 'border-primary/40 text-primary'}`}>
                                  {isPostHandover ? 'Post-Handover' : isHeavyBooking ? 'Heavy Booking' : 'Standard'}
                                </Badge>
                              </TableCell>
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
                    <div className="text-[10px] text-muted-foreground mt-3 p-2 rounded bg-muted/30 border border-border/30">
                      💡 Upload area research to see project-specific payment plan benchmarks.
                    </div>
                  </div>
                )}
              </Section>

              {/* Pricing & Payment Benchmarks — always render */}
              <Section title="Pricing & Payment Benchmarks">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="data-card">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Area Pricing Benchmarks</h4>
                    <div className="flex gap-2 flex-wrap mb-2">
                      <div className="flex-1 bg-muted/20 border border-border/30 rounded-lg p-3 text-center">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">Market Floor</div>
                        <div className="text-lg font-bold font-mono">AED {fmt(areaMarketBench.floor)}</div>
                      </div>
                      <div className="flex-1 bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
                        <div className="text-[10px] text-primary uppercase mb-1 font-bold">Market Average</div>
                        <div className="text-lg font-bold font-mono text-primary">AED {fmt(areaMarketBench.avg)}</div>
                      </div>
                      <div className="flex-1 bg-muted/20 border border-border/30 rounded-lg p-3 text-center">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">Market Ceiling</div>
                        <div className="text-lg font-bold font-mono">AED {fmt(areaMarketBench.ceiling)}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground p-2 rounded bg-muted/30 border border-border/30 mt-2">
                      💡 Based on {dataSource === 'AI Upload' ? 'AI-parsed area transactions' : 'CLFF v1 area-specific market data'}.
                    </div>
                  </div>

                  <div className="data-card">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Payment Plan Distribution</h4>
                    <div className="space-y-2">
                      {(() => {
                        const plans = areaCompsWithPlans
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
