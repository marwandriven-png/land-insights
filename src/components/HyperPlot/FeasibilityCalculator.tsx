import { useState, useEffect, useMemo } from 'react';
import { Calculator, DollarSign, TrendingUp, Building2, Edit3, Check } from 'lucide-react';
import { PlotData } from '@/services/DDAGISService';
import { Input } from '@/components/ui/input';

interface FeasibilityCalculatorProps {
  plot: PlotData;
}

interface FeasibilityParams {
  constructionPSF: number;
  landCostPSF: number;
  authorityFeePct: number;
  consultantFeePct: number;
  buaMultiplier: number;
}

const DEFAULT_PARAMS: FeasibilityParams = {
  constructionPSF: 420,
  landCostPSF: 725,
  authorityFeePct: 4,
  consultantFeePct: 3,
  buaMultiplier: 1.45,
};

export function FeasibilityCalculator({ plot }: FeasibilityCalculatorProps) {
  const [params, setParams] = useState<FeasibilityParams>(DEFAULT_PARAMS);
  const [editing, setEditing] = useState(false);

  // Reset when plot changes
  useEffect(() => {
    setEditing(false);
  }, [plot.id]);

  const results = useMemo(() => {
    const gfaSqft = plot.gfa * 10.764;
    const buaSqft = gfaSqft * params.buaMultiplier;
    const buaSqm = buaSqft / 10.764;

    const constructionCost = buaSqft * params.constructionPSF;
    const landAreaSqft = plot.area * 10.764;
    const landCost = landAreaSqft * params.landCostPSF;
    const authorityFees = (constructionCost + landCost) * (params.authorityFeePct / 100);
    const consultantFees = constructionCost * (params.consultantFeePct / 100);
    const totalCost = constructionCost + landCost + authorityFees + consultantFees;

    // Revenue estimate: use sale price from plot data
    const revenuePSF = plot.salePrice || 1500;
    const totalRevenue = buaSqft * revenuePSF;
    const profit = totalRevenue - totalCost;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      buaSqft,
      buaSqm,
      constructionCost,
      landCost,
      authorityFees,
      consultantFees,
      totalCost,
      totalRevenue,
      profit,
      roi,
      profitMargin,
    };
  }, [plot, params]);

  const updateParam = (key: keyof FeasibilityParams, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setParams(prev => ({ ...prev, [key]: num }));
    }
  };

  const formatAED = (v: number) => {
    if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `AED ${(v / 1_000).toFixed(0)}K`;
    return `AED ${v.toFixed(0)}`;
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
            <Input
              type="number"
              value={params.constructionPSF}
              onChange={(e) => updateParam('constructionPSF', e.target.value)}
              className="h-7 text-xs mt-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Land Cost (PSF)</label>
            <Input
              type="number"
              value={params.landCostPSF}
              onChange={(e) => updateParam('landCostPSF', e.target.value)}
              className="h-7 text-xs mt-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Authority Fees (%)</label>
            <Input
              type="number"
              value={params.authorityFeePct}
              onChange={(e) => updateParam('authorityFeePct', e.target.value)}
              className="h-7 text-xs mt-0.5"
              step="0.5"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Consultant Fees (%)</label>
            <Input
              type="number"
              value={params.consultantFeePct}
              onChange={(e) => updateParam('consultantFeePct', e.target.value)}
              className="h-7 text-xs mt-0.5"
              step="0.5"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-muted-foreground">BUA Multiplier (GFA × {params.buaMultiplier})</label>
            <Input
              type="number"
              value={params.buaMultiplier}
              onChange={(e) => updateParam('buaMultiplier', e.target.value)}
              className="h-7 text-xs mt-0.5"
              step="0.05"
              min="1"
              max="2"
            />
          </div>
        </div>
      )}

      {/* BUA */}
      <div className="flex justify-between text-xs mb-2">
        <span className="text-muted-foreground">BUA (GFA × {params.buaMultiplier})</span>
        <span className="text-foreground font-medium">
          {results.buaSqm.toLocaleString(undefined, { maximumFractionDigits: 0 })} m²
          <span className="text-muted-foreground ml-1">({results.buaSqft.toLocaleString(undefined, { maximumFractionDigits: 0 })} sqft)</span>
        </span>
      </div>

      {/* Cost Breakdown */}
      <div className="space-y-1.5 mb-3">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Cost Breakdown</span>
        {[
          { label: `Construction (${params.constructionPSF} PSF)`, value: results.constructionCost },
          { label: `Land (${params.landCostPSF} PSF)`, value: results.landCost },
          { label: `Authority Fees (${params.authorityFeePct}%)`, value: results.authorityFees },
          { label: `Consultant Fees (${params.consultantFeePct}%)`, value: results.consultantFees },
        ].map(item => (
          <div key={item.label} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="text-foreground font-medium">{formatAED(item.value)}</span>
          </div>
        ))}
        <div className="flex justify-between text-xs font-bold border-t border-border/30 pt-1">
          <span className="text-foreground">Total Cost</span>
          <span className="text-foreground">{formatAED(results.totalCost)}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="data-card py-2 text-center">
          <DollarSign className="w-3 h-3 text-success mx-auto mb-0.5" />
          <div className="text-[10px] text-muted-foreground">Revenue</div>
          <div className="text-xs font-bold text-foreground">{formatAED(results.totalRevenue)}</div>
        </div>
        <div className="data-card py-2 text-center">
          <TrendingUp className="w-3 h-3 text-primary mx-auto mb-0.5" />
          <div className="text-[10px] text-muted-foreground">Profit</div>
          <div className={`text-xs font-bold ${results.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatAED(results.profit)}
          </div>
        </div>
        <div className="data-card py-2 text-center">
          <Building2 className="w-3 h-3 text-secondary mx-auto mb-0.5" />
          <div className="text-[10px] text-muted-foreground">ROI</div>
          <div className={`text-xs font-bold ${results.roi >= 0 ? 'text-success' : 'text-destructive'}`}>
            {results.roi.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}
