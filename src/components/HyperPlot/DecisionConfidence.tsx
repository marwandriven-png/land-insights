import { useState, useMemo, useEffect } from 'react';
import { Loader2, TrendingUp, DollarSign, Building2, BarChart3, Target, Shield, Printer, Maximize2, Minimize2 } from 'lucide-react';
import { PlotData, AffectionPlanData, gisService } from '@/services/DDAGISService';
import { calcDSCFeasibility, DSCPlotInput, DSCFeasibilityResult, MixKey, MIX_TEMPLATES, COMPS, UNIT_SIZES, RENT_PSF_YR, fmt, fmtM, fmtA, pct } from '@/lib/dscFeasibility';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DecisionConfidenceProps {
  plot: PlotData;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
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
      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${colorClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// Section wrapper
function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</h3>
        {badge && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">{badge}</Badge>}
      </div>
      {children}
    </div>
  );
}

// Viability indicator
function Viability({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span className={`text-[11px] font-bold ${pass ? 'text-success' : 'text-destructive'}`}>
      {pass ? '✓' : '⚠'} {label}
    </span>
  );
}

export function DecisionConfidence({ plot, isFullscreen, onToggleFullscreen }: DecisionConfidenceProps) {
  const [activeMix, setActiveMix] = useState<MixKey>('balanced');
  const [plan, setPlan] = useState<AffectionPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [overrides, setOverrides] = useState<{ area?: number; ratio?: number; height?: string; efficiency?: number; landCostPsf?: number; constructionPsf?: number; buaMultiplier?: number }>({});
  const [activeTab, setActiveTab] = useState<'feasibility' | 'comparison' | 'sensitivity'>('feasibility');

  // Fetch affection plan on plot change
  useEffect(() => {
    setLoading(true);
    setPlan(null);
    setEditMode(false);
    setOverrides({});
    gisService.fetchAffectionPlan(plot.id).then(data => {
      setPlan(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [plot.id]);

  const dscInput = useMemo(() => {
    const base = toDSCInput(plot, plan);
    if (overrides.area) base.area = overrides.area;
    if (overrides.ratio) base.ratio = overrides.ratio;
    if (overrides.height) base.height = overrides.height;
    return base;
  }, [plot, plan, overrides]);

  const fs = useMemo(() => calcDSCFeasibility(dscInput, activeMix, {
    efficiency: overrides.efficiency,
    landCostPsf: overrides.landCostPsf,
    constructionPsf: overrides.constructionPsf,
    buaMultiplier: overrides.buaMultiplier,
  }), [dscInput, activeMix, overrides.efficiency, overrides.landCostPsf, overrides.constructionPsf, overrides.buaMultiplier]);

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

  return (
    <div className="h-full flex flex-col overflow-hidden glass-card glow-border">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Decision Confidence
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Plot {plot.id} · {dscInput.zone} · {dscInput.height}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs">
              <input type="checkbox" checked={editMode} onChange={() => setEditMode(!editMode)}
                className="w-3.5 h-3.5 rounded border-border accent-primary" />
              Override
            </label>
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
          </div>
        )}

        {/* KPI Strip */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <KpiCard label="Total GDV" value={fmtM(fs.grossSales)} sub={`Sellable ${fmt(Math.round(fs.sellableArea))} sqft × AED ${fmt(Math.round(fs.avgPsf))}/sqft`} accent />
          <KpiCard label="Total Cost" value={fmtM(fs.totalCost)} sub={`${pct(fs.totalCost / fs.grossSales)} of GDV`} />
          <KpiCard label="Net Profit" value={fmtM(fs.grossProfit)} sub={`Margin: ${pct(fs.grossMargin)}`} positive={fs.grossMargin > 0.2} negative={fs.grossMargin < 0} />
          <KpiCard label="ROI" value={pct(fs.roi)} sub="Return on cost" positive={fs.roi > 0.2} negative={fs.roi < 0} />
          <KpiCard label="Units" value={fmt(fs.units.total)} sub={`${fmt(Math.round(fs.bua))} sqft BUA`} />
          <KpiCard label="Break-Even" value={`AED ${fmt(Math.round(fs.breakEvenPsf))}`} sub="vs AED 1,565 mkt avg" />
          <KpiCard label="Yield" value={pct(fs.grossYield)} sub="Annual rent / GDV" positive={fs.grossYield > 0.055} />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-3 bg-muted/40 p-0.5 rounded-lg">
          {([['feasibility', '📊 Feasibility'], ['comparison', '📐 Benchmarks'], ['sensitivity', '🎯 Sensitivity']] as const).map(([k, l]) => (
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
              <Section title="1 · Development Configuration">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead className="text-[10px]">Parameter</TableHead><TableHead className="text-[10px] text-right">Value</TableHead><TableHead className="text-[10px] text-right">Notes</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ['Plot Area', `${fmt(dscInput.area)} sqft`, `${(dscInput.area / 43560).toFixed(2)} acres`],
                        ['Plot Ratio', `× ${dscInput.ratio.toFixed(2)}`, 'Authority-approved FAR'],
                        ['GFA', `${fmt(Math.round(fs.gfa))} sqft`, 'Plot Area × Ratio'],
                        ['Sellable Area', `${fmt(Math.round(fs.sellableArea))} sqft`, `GFA × ${((overrides.efficiency || 0.95) * 100).toFixed(0)}% Efficiency`],
                        ['BUA', `${fmt(Math.round(fs.bua))} sqft`, `GFA × ${overrides.buaMultiplier || 1.45}`],
                        ['Approved Height', dscInput.height, 'From affection plan'],
                        ['Est. Floors', `${fs.residentialFloors}`, `GFA ÷ (Plot × ${((overrides.efficiency || 0.95) * 100).toFixed(0)}%)`],
                        ['Floor Plate Efficiency', `${((overrides.efficiency || 0.95) * 100).toFixed(0)}%`, 'Overridable'],
                        ['Avg PSF', `AED ${fmt(Math.round(fs.avgPsf))}`, 'Weighted from unit mix'],
                        ['Total GDV', fmtA(fs.grossSales), 'Sellable Area × Avg PSF'],
                        ['Units/1,000 sqft', `${(fs.units.total / (fs.sellableArea / 1000)).toFixed(2)}`, MIX_TEMPLATES[activeMix].tag],
                      ].map(([param, val, note]) => (
                        <TableRow key={param}>
                          <TableCell className="text-xs font-medium py-1.5">{param}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{val}</TableCell>
                          <TableCell className="text-[10px] text-right text-muted-foreground py-1.5">{note}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Section>

              {/* 2. Unit Breakdown */}
              <Section title="2 · Unit Breakdown">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Type', 'Count', 'Mix %', 'Size (sqft)', 'Floor Space', 'Price (AED)', 'Rent PSF/yr', 'Yield'].map(h => (
                          <TableHead key={h} className="text-[10px] text-right first:text-left">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { type: 'Studio', u: fs.units.studio, sz: UNIT_SIZES.studio, pr: fs.prices.studio, rent: RENT_PSF_YR.studio },
                        { type: '1 Bedroom', u: fs.units.br1, sz: UNIT_SIZES.br1, pr: fs.prices.br1, rent: RENT_PSF_YR.br1 },
                        { type: '2 Bedroom', u: fs.units.br2, sz: UNIT_SIZES.br2, pr: fs.prices.br2, rent: RENT_PSF_YR.br2 },
                        { type: '3 Bedroom', u: fs.units.br3, sz: UNIT_SIZES.br3, pr: fs.prices.br3, rent: RENT_PSF_YR.br3 },
                      ].map(r => (
                        <TableRow key={r.type}>
                          <TableCell className="text-xs font-medium py-1.5">{r.type}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{fmt(r.u)}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{pct(r.u / fs.units.total)}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{fmt(r.sz)}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{fmt(r.u * r.sz)}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{fmtA(r.pr)}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">AED {r.rent}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{pct((r.sz * r.rent) / r.pr)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="text-xs font-bold py-1.5">TOTAL</TableCell>
                        <TableCell className="text-xs text-right font-bold py-1.5">{fmt(fs.units.total)}</TableCell>
                        <TableCell className="text-xs text-right font-bold py-1.5">100%</TableCell>
                        <TableCell className="text-xs text-right py-1.5">{fmt(Math.round(fs.bua / fs.units.total))} avg</TableCell>
                        <TableCell className="text-xs text-right font-bold py-1.5">{fmt(Math.round(fs.bua))}</TableCell>
                        <TableCell className="text-xs text-right py-1.5">—</TableCell>
                        <TableCell className="text-xs text-right py-1.5">—</TableCell>
                        <TableCell className="text-xs text-right font-bold py-1.5">{pct(fs.grossYield)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </Section>

              {/* 3. Value View */}
              <Section title="3 · Unit Breakdown — Value View">
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

              {/* 4. Cost Breakdown */}
              <Section title="4 · Cost Breakdown">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {['Cost Item', 'Basis', 'Rate', 'Amount (AED)', '% of GDV'].map(h => (
                          <TableHead key={h} className="text-[10px] text-right first:text-left">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ['Land Cost', 'GFA × Land PSF', `AED ${fmt(Math.round(fs.landCost / fs.gfa))}/sqft × GFA`, fs.landCost, fs.landCost / fs.grossSales],
                        ['Construction', 'BUA × AED 420/sqft', 'AED 420/sqft BUA', fs.constructionCost, fs.constructionCost / fs.grossSales],
                        ['Authority Fees', 'DLD + NOC + RERA', '4% of land', fs.authorityFees, fs.authorityFees / fs.grossSales],
                        ['Consultant Fees', 'Architecture, PM', '3% of construction', fs.consultantFees, fs.consultantFees / fs.grossSales],
                        ['Marketing & Sales', 'Broker + campaign', '10% of GDV', fs.marketing, fs.marketing / fs.grossSales],
                        ['Contingency', 'Risk buffer', '5% of construction', fs.contingency, fs.contingency / fs.grossSales],
                        ['Financing', 'Construction carry', '4% of construction', fs.financing, fs.financing / fs.grossSales],
                      ].map(([item, basis, rate, amount, gdvPct]) => (
                        <TableRow key={item as string}>
                          <TableCell className="text-xs font-medium py-1.5">{item}</TableCell>
                          <TableCell className="text-[10px] text-right text-muted-foreground py-1.5">{basis}</TableCell>
                          <TableCell className="text-[10px] text-right text-muted-foreground py-1.5">{rate}</TableCell>
                          <TableCell className="text-xs text-right font-mono py-1.5">{fmtA(amount as number)}</TableCell>
                          <TableCell className="text-xs text-right py-1.5">{pct(gdvPct as number)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="text-xs font-bold py-1.5" colSpan={3}>TOTAL DEVELOPMENT COST</TableCell>
                        <TableCell className="text-xs text-right font-bold py-1.5">{fmtA(fs.totalCost)}</TableCell>
                        <TableCell className="text-xs text-right font-bold py-1.5">{pct(fs.totalCost / fs.grossSales)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </Section>

              {/* 5. Financial Feasibility */}
              <Section title="5 · Financial Feasibility">
                {/* 5.1 Revenue */}
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-2">5.1 Revenue Projection</div>
                <div className="flex gap-2 flex-wrap mb-4">
                  <KpiCard label="GDV" value={fmtM(fs.grossSales)} sub={`Sellable ${fmt(Math.round(fs.sellableArea))} × AED ${fmt(Math.round(fs.avgPsf))}/sqft`} accent />
                  <KpiCard label="Annual Rental" value={fmtM(fs.annualRent)} sub={`AED ${fmt(Math.round(fs.annualRent / fs.units.total))}/unit/yr`} />
                  <KpiCard label="Rental Yield" value={pct(fs.grossYield)} sub="vs 5.5–6.5% DSC avg" positive={fs.grossYield > 0.055} />
                  <KpiCard label="Your ASP" value={`AED ${fmt(Math.round(fs.avgPsf))}`} sub={fs.avgPsf > 1508 ? 'Above DSC median' : 'Below DSC median'} positive={fs.avgPsf > 1508} />
                </div>

                {/* 5.3 Profit Summary */}
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-2">5.2 Profit & Return Summary</div>
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
              <Section title="6 · Payment Plan Structure">
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
            <Section title="7 · Price Sensitivity Analysis" badge="±10% range">
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
    </div>
  );
}
