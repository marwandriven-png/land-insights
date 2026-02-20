import { useState, useEffect, useMemo } from 'react';
import { Calculator, DollarSign, TrendingUp, Building2, Edit3, Check } from 'lucide-react';
import { PlotData, AffectionPlanData, gisService } from '@/services/DDAGISService';
import { Input } from '@/components/ui/input';
import { calcDSCFeasibility, DSCPlotInput, MIX_TEMPLATES, fmt, fmtM, fmtA, pct, MixKey, TXN_AVG_PSF, TXN_WEIGHTED_AVG_PSF } from '@/lib/dscFeasibility';

export interface FeasibilityParams {
  constructionPsf: number;
  landCostPsf: number;
  authorityFeePct: number;
  consultantFeePct: number;
  buaMultiplier: number;
  efficiency: number;
  contingencyPct: number;
  financePct: number;
}

export const DEFAULT_FEASIBILITY_PARAMS: FeasibilityParams = {
  constructionPsf: 420,
  landCostPsf: 148,
  authorityFeePct: 4,
  consultantFeePct: 3,
  buaMultiplier: 1.45,
  efficiency: 0.95,
  contingencyPct: 5,
  financePct: 4,
};

interface FeasibilityCalculatorProps {
  plot: PlotData;
  sharedParams?: FeasibilityParams;
  onParamsChange?: (params: FeasibilityParams) => void;
}

// (FeasibilityParams and DEFAULT_FEASIBILITY_PARAMS are exported above)

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
    constraints: plan?.generalNotes || '',
  };
}

export function FeasibilityCalculator({ plot, sharedParams, onParamsChange }: FeasibilityCalculatorProps) {
  const [params, setParams] = useState<FeasibilityParams>(sharedParams || DEFAULT_FEASIBILITY_PARAMS);
  const [editing, setEditing] = useState(false);
  const [plan, setPlan] = useState<AffectionPlanData | null>(null);

  // Sync from shared params when they change externally
  useEffect(() => {
    if (sharedParams) setParams(sharedParams);
  }, [sharedParams]);

  useEffect(() => {
    setEditing(false);
    gisService.fetchAffectionPlan(plot.id).then(setPlan).catch(() => {});
  }, [plot.id]);

  const dscInput = useMemo(() => toDSCInput(plot, plan), [plot, plan]);

  const fs = useMemo(() => calcDSCFeasibility(dscInput, 'balanced', {
    constructionPsf: params.constructionPsf,
    landCostPsf: params.landCostPsf,
    buaMultiplier: params.buaMultiplier,
    efficiency: params.efficiency,
    contingencyPct: params.contingencyPct / 100,
    financePct: params.financePct / 100,
  }), [dscInput, params]);

  const updateParam = (key: keyof FeasibilityParams, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      const updated = { ...params, [key]: num };
      setParams(updated);
      onParamsChange?.(updated);
    }
  };

  return (
    <div className="border-t border-border/50 pt-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Feasibility Study</h3>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {editing ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
          {editing ? 'Done' : 'Edit Params'}
        </button>
      </div>

      {/* Editable Parameters */}
      {editing && (
        <div className="grid grid-cols-2 gap-2 mb-3 p-3 rounded-lg bg-muted/30 border border-border/30">
          <div>
            <label className="text-xs text-muted-foreground">Construction (PSF)</label>
            <Input type="number" value={params.constructionPsf} onChange={(e) => updateParam('constructionPsf', e.target.value)} className="h-8 text-sm mt-0.5" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Land Cost (PSF)</label>
            <Input type="number" value={params.landCostPsf} onChange={(e) => updateParam('landCostPsf', e.target.value)} className="h-8 text-sm mt-0.5" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Authority Fees (%)</label>
            <Input type="number" value={params.authorityFeePct} onChange={(e) => updateParam('authorityFeePct', e.target.value)} className="h-8 text-sm mt-0.5" step="0.5" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Consultant Fees (%)</label>
            <Input type="number" value={params.consultantFeePct} onChange={(e) => updateParam('consultantFeePct', e.target.value)} className="h-8 text-sm mt-0.5" step="0.5" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">BUA Multiplier (×)</label>
            <Input type="number" value={params.buaMultiplier} onChange={(e) => updateParam('buaMultiplier', e.target.value)} className="h-8 text-sm mt-0.5" step="0.05" min="1" max="2" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Floor Plate Eff. (%)</label>
            <Input type="number" value={Math.round(params.efficiency * 100)} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) { const updated = { ...params, efficiency: v / 100 }; setParams(updated); onParamsChange?.(updated); } }} className="h-8 text-sm mt-0.5" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Avg PSF (Txn)</label>
            <div className="h-8 text-sm mt-0.5 px-2 flex items-center bg-muted/50 rounded-md text-muted-foreground font-mono">AED {fmt(TXN_WEIGHTED_AVG_PSF)}</div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Contingency (%)</label>
            <Input type="number" value={params.contingencyPct} onChange={(e) => updateParam('contingencyPct', e.target.value)} className="h-8 text-sm mt-0.5" step="0.5" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Finance (%)</label>
            <Input type="number" value={params.financePct} onChange={(e) => updateParam('financePct', e.target.value)} className="h-8 text-sm mt-0.5" step="0.5" />
          </div>
        </div>
      )}

      {/* Sellable Area */}
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">Sellable Area (GFA × {Math.round(params.efficiency * 100)}%)</span>
        <span className="text-foreground font-medium">
          {fmt(Math.round(fs.sellableArea))} sqft
        </span>
      </div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">Avg Selling PSF (Txn)</span>
        <span className="text-foreground font-medium">AED {fmt(Math.round(fs.avgPsf))}</span>
      </div>
      <div className="flex justify-between text-sm mb-2 font-semibold">
        <span className="text-muted-foreground">GDV (Σ Units × Avg Price)</span>
        <span className="text-foreground">{fmtA(fs.grossSales)}</span>
      </div>

      {/* Cost Breakdown */}
      <div className="space-y-1.5 mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cost Breakdown</span>
        {[
          { label: `Construction (${params.constructionPsf} PSF)`, value: fs.constructionCost },
          { label: `Land (GFA × ${params.landCostPsf} PSF)`, value: fs.landCost },
          { label: `Authority Fees (${params.authorityFeePct}%)`, value: fs.authorityFees },
          { label: `Consultant Fees (${params.consultantFeePct}%)`, value: fs.consultantFees },
          { label: `Contingency (${params.contingencyPct}%)`, value: fs.contingency },
          { label: `Finance (${params.financePct}%)`, value: fs.financing },
        ].map(item => (
          <div key={item.label} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="text-foreground font-medium">{fmtA(item.value)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-bold border-t border-border/30 pt-1">
          <span className="text-foreground">Total Cost</span>
          <span className="text-foreground">{fmtA(fs.totalCost)}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="data-card py-2 text-center">
          <DollarSign className="w-4 h-4 text-success mx-auto mb-0.5" />
          <div className="text-xs text-muted-foreground">Revenue</div>
          <div className="text-sm font-bold text-foreground">{fmtM(fs.grossSales)}</div>
        </div>
        <div className="data-card py-2 text-center">
          <TrendingUp className="w-4 h-4 text-primary mx-auto mb-0.5" />
          <div className="text-xs text-muted-foreground">Profit</div>
          <div className={`text-sm font-bold ${fs.grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
            {fmtM(fs.grossProfit)}
          </div>
        </div>
        <div className="data-card py-2 text-center">
          <Building2 className="w-4 h-4 text-secondary mx-auto mb-0.5" />
          <div className="text-xs text-muted-foreground">ROI</div>
          <div className={`text-sm font-bold ${fs.roi >= 0 ? 'text-success' : 'text-destructive'}`}>
            {pct(fs.roi)}
          </div>
        </div>
      </div>
    </div>
  );
}
