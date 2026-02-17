import { useState, useEffect, useMemo } from 'react';
import { Calculator, DollarSign, TrendingUp, Building2, Edit3, Check } from 'lucide-react';
import { PlotData, AffectionPlanData, gisService } from '@/services/DDAGISService';
import { Input } from '@/components/ui/input';
import { calcDSCFeasibility, DSCPlotInput, MIX_TEMPLATES, fmt, fmtM, fmtA, pct, MixKey } from '@/lib/dscFeasibility';

interface FeasibilityCalculatorProps {
  plot: PlotData;
}

interface FeasibilityParams {
  constructionPsf: number;
  landCostPsf: number;
  authorityFeePct: number;
  consultantFeePct: number;
  buaMultiplier: number;
  efficiency: number;
}

const DEFAULT_PARAMS: FeasibilityParams = {
  constructionPsf: 420,
  landCostPsf: 148,
  authorityFeePct: 4,
  consultantFeePct: 3,
  buaMultiplier: 1.45,
  efficiency: 0.95,
};

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

export function FeasibilityCalculator({ plot }: FeasibilityCalculatorProps) {
  const [params, setParams] = useState<FeasibilityParams>(DEFAULT_PARAMS);
  const [editing, setEditing] = useState(false);
  const [plan, setPlan] = useState<AffectionPlanData | null>(null);

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
  }), [dscInput, params]);

  const updateParam = (key: keyof FeasibilityParams, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setParams(prev => ({ ...prev, [key]: num }));
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
          className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {editing ? <Check className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
          {editing ? 'Done' : 'Edit Params'}
        </button>
      </div>

      {/* Editable Parameters */}
      {editing && (
        <div className="grid grid-cols-2 gap-2 mb-3 p-3 rounded-lg bg-muted/30 border border-border/30">
          <div>
            <label className="text-[10px] text-muted-foreground">Construction (PSF)</label>
            <Input type="number" value={params.constructionPsf} onChange={(e) => updateParam('constructionPsf', e.target.value)} className="h-7 text-xs mt-0.5" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Land Cost (PSF)</label>
            <Input type="number" value={params.landCostPsf} onChange={(e) => updateParam('landCostPsf', e.target.value)} className="h-7 text-xs mt-0.5" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Authority Fees (%)</label>
            <Input type="number" value={params.authorityFeePct} onChange={(e) => updateParam('authorityFeePct', e.target.value)} className="h-7 text-xs mt-0.5" step="0.5" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Consultant Fees (%)</label>
            <Input type="number" value={params.consultantFeePct} onChange={(e) => updateParam('consultantFeePct', e.target.value)} className="h-7 text-xs mt-0.5" step="0.5" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">BUA Multiplier (×)</label>
            <Input type="number" value={params.buaMultiplier} onChange={(e) => updateParam('buaMultiplier', e.target.value)} className="h-7 text-xs mt-0.5" step="0.05" min="1" max="2" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Floor Plate Eff. (%)</label>
            <Input type="number" value={Math.round(params.efficiency * 100)} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setParams(p => ({ ...p, efficiency: v / 100 })); }} className="h-7 text-xs mt-0.5" />
          </div>
        </div>
      )}

      {/* BUA */}
      <div className="flex justify-between text-xs mb-2">
        <span className="text-muted-foreground">BUA (GFA × {params.buaMultiplier})</span>
        <span className="text-foreground font-medium">
          {fmt(Math.round(fs.bua / 10.764))} m²
          <span className="text-muted-foreground ml-1">({fmt(Math.round(fs.bua))} sqft)</span>
        </span>
      </div>

      {/* Cost Breakdown */}
      <div className="space-y-1.5 mb-3">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Cost Breakdown</span>
        {[
          { label: `Construction (${params.constructionPsf} PSF)`, value: fs.constructionCost },
          { label: `Land (GFA × ${params.landCostPsf} PSF)`, value: fs.landCost },
          { label: `Authority Fees (${params.authorityFeePct}%)`, value: fs.authorityFees },
          { label: `Consultant Fees (${params.consultantFeePct}%)`, value: fs.consultantFees },
        ].map(item => (
          <div key={item.label} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="text-foreground font-medium">{fmtA(item.value)}</span>
          </div>
        ))}
        <div className="flex justify-between text-xs font-bold border-t border-border/30 pt-1">
          <span className="text-foreground">Total Cost</span>
          <span className="text-foreground">{fmtA(fs.totalCost)}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="data-card py-2 text-center">
          <DollarSign className="w-3 h-3 text-success mx-auto mb-0.5" />
          <div className="text-[10px] text-muted-foreground">Revenue</div>
          <div className="text-xs font-bold text-foreground">{fmtM(fs.grossSales)}</div>
        </div>
        <div className="data-card py-2 text-center">
          <TrendingUp className="w-3 h-3 text-primary mx-auto mb-0.5" />
          <div className="text-[10px] text-muted-foreground">Profit</div>
          <div className={`text-xs font-bold ${fs.grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
            {fmtM(fs.grossProfit)}
          </div>
        </div>
        <div className="data-card py-2 text-center">
          <Building2 className="w-3 h-3 text-secondary mx-auto mb-0.5" />
          <div className="text-[10px] text-muted-foreground">ROI</div>
          <div className={`text-xs font-bold ${fs.roi >= 0 ? 'text-success' : 'text-destructive'}`}>
            {pct(fs.roi)}
          </div>
        </div>
      </div>
    </div>
  );
}
