// ═══════════════════════════════════════════════════════════════════════════
// FeasibilityPanel — Full Development Feasibility Output
// Shows: GDV · Cost Stack · Net Profit · ROI · Unit Mix · Sensitivity
// ═══════════════════════════════════════════════════════════════════════════

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, Building, BarChart2, Layers, AlertTriangle } from 'lucide-react';
import type { FeasibilityResult, UnitMixItem, SensitivityScenario } from '@/types/landos';
import { fmt } from '@/services/feasibilityEngine';

// ── KPI card ──────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  variant: 'positive' | 'negative' | 'neutral' | 'highlight';
}

function KPICard({ label, value, sub, icon, variant }: KPICardProps) {
  const styles: Record<KPICardProps['variant'], { card: string; value: string; icon: string }> = {
    positive:  { card: 'bg-emerald-950/60 ring-emerald-500/20',   value: 'text-emerald-300', icon: 'text-emerald-500' },
    negative:  { card: 'bg-red-950/60     ring-red-500/20',       value: 'text-red-300',     icon: 'text-red-500'     },
    neutral:   { card: 'bg-zinc-900/80    ring-white/8',          value: 'text-white',       icon: 'text-zinc-500'    },
    highlight: { card: 'bg-cyan-950/60    ring-cyan-500/20',      value: 'text-cyan-300',    icon: 'text-cyan-500'    },
  };
  const s = styles[variant];
  return (
    <div className={cn('rounded-xl ring-1 p-4 flex flex-col gap-2', s.card)}>
      <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest font-bold text-zinc-500">
        {icon && <span className={s.icon}>{icon}</span>}
        {label}
      </div>
      <span className={cn('text-2xl font-black tabular-nums leading-none', s.value)}>{value}</span>
      {sub && <span className="text-[10px] text-zinc-500">{sub}</span>}
    </div>
  );
}

// ── Cost bar row ──────────────────────────────────────────────────────────────

function CostRow({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="w-36 shrink-0 text-xs text-zinc-400">{label}</div>
      <div className="w-24 shrink-0 text-xs font-bold text-white tabular-nums text-right">{fmt.aed(amount)}</div>
      <div className="flex-1 flex items-center gap-2">
        <div className="relative h-1.5 flex-1 rounded-full bg-white/8">
          <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-500" style={{ width: `${pct.toFixed(1)}%`, backgroundColor: color }} />
        </div>
        <span className="w-10 text-right text-[10px] text-zinc-600 tabular-nums">{pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ── Unit mix table ────────────────────────────────────────────────────────────

function UnitMixTable({ units }: { units: UnitMixItem[] }) {
  const total = units.reduce((s, u) => s + u.units, 0);
  const colors = ['#06B6D4', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];
  return (
    <div className="overflow-hidden rounded-xl border border-white/8">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-900/80 border-b border-white/5">
            {['Unit Type', 'Units', 'Avg Size', 'Total Area', '% Mix', 'Unit GDV'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-zinc-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/4">
          {units.map((u, i) => (
            <tr key={u.type} className="hover:bg-white/3 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                  <span className="font-semibold text-white">{u.type}</span>
                </div>
              </td>
              <td className="px-4 py-3 font-black text-white tabular-nums">{u.units}</td>
              <td className="px-4 py-3 text-zinc-400 tabular-nums">{fmt.sqft(u.avgSizeSqft)}</td>
              <td className="px-4 py-3 text-zinc-400 tabular-nums">{fmt.sqft(u.totalAreaSqft)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-16 rounded-full bg-white/8">
                    <div className="h-full rounded-full" style={{ width: `${u.pctGfa}%`, backgroundColor: colors[i % colors.length] }} />
                  </div>
                  <span className="text-zinc-500 tabular-nums">{u.pctGfa}%</span>
                </div>
              </td>
              <td className="px-4 py-3 font-bold text-emerald-400 tabular-nums">{fmt.aed(u.unitGDV)}</td>
            </tr>
          ))}
          <tr className="bg-zinc-900/60 font-bold">
            <td className="px-4 py-2.5 text-white">Total</td>
            <td className="px-4 py-2.5 text-white tabular-nums">{total}</td>
            <td className="px-4 py-2.5 text-zinc-600">—</td>
            <td className="px-4 py-2.5 text-zinc-400 tabular-nums">{fmt.sqft(units.reduce((s, u) => s + u.totalAreaSqft, 0))}</td>
            <td className="px-4 py-2.5 text-zinc-400">100%</td>
            <td className="px-4 py-2.5 text-emerald-400 tabular-nums">{fmt.aed(units.reduce((s, u) => s + u.unitGDV, 0))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Sensitivity table ─────────────────────────────────────────────────────────

function SensitivityTable({ scenarios }: { scenarios: SensitivityScenario[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/8">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-900/80 border-b border-white/5">
            {['Scenario', 'Sale PSF', 'GDV', 'Net Profit', 'ROI', 'Viable'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-zinc-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/4">
          {scenarios.map((s) => {
            const isBase = s.label === 'Base Case';
            const rowBg = isBase ? 'bg-cyan-950/20' : s.viable ? '' : 'bg-red-950/10';
            const roiColor = s.roi >= 20 ? 'text-emerald-400' : s.roi >= 12 ? 'text-amber-400' : 'text-red-400';
            return (
              <tr key={s.label} className={cn('hover:bg-white/3 transition-colors', rowBg)}>
                <td className="px-4 py-3">
                  <span className={cn('font-bold', isBase ? 'text-cyan-300' : s.viable ? 'text-white' : 'text-red-400')}>{s.label}</span>
                </td>
                <td className="px-4 py-3 text-zinc-300 tabular-nums">{fmt.psf(s.salePSF)}</td>
                <td className="px-4 py-3 font-semibold text-white tabular-nums">{fmt.aed(s.gdv)}</td>
                <td className={cn('px-4 py-3 font-bold tabular-nums', s.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400')}>{fmt.aed(s.netProfit)}</td>
                <td className={cn('px-4 py-3 font-black tabular-nums', roiColor)}>{fmt.pct(s.roi)}</td>
                <td className="px-4 py-3">
                  {s.viable
                    ? <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[9px] font-bold text-emerald-400">✓ Yes</span>
                    : <span className="rounded-full bg-red-950 px-2 py-0.5 text-[9px] font-bold text-red-400">✗ No</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface FeasibilityPanelProps {
  result: FeasibilityResult;
  plotNumber?: string;
  area?: string;
}

export function FeasibilityPanel({ result: f, plotNumber, area }: FeasibilityPanelProps) {
  const isViable = f.roi >= 12;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-black text-white">
            🏗️ Feasibility Analysis
            {plotNumber && <span className="text-zinc-500 font-normal"> — Plot {plotNumber}</span>}
            {area && <span className="text-zinc-600 font-normal text-sm"> · {area}</span>}
          </h3>
          <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-zinc-500">
            <span>Plot: {fmt.sqm(f.plotSqm)}</span>
            <span className="text-zinc-700">·</span>
            <span>GFA: {fmt.sqm(f.gfaSqm)}</span>
            <span className="text-zinc-700">·</span>
            <span>FAR: {f.far}</span>
            <span className="text-zinc-700">·</span>
            <span>{f.floors} Floors</span>
            {f.landOSUsed && <span className="rounded bg-purple-900/50 px-1.5 py-0.5 text-purple-400 font-semibold">⚡ Land OS</span>}
            {f.marketPSFSource === 'transactions' && <span className="rounded bg-emerald-900/50 px-1.5 py-0.5 text-emerald-400 font-semibold">📊 Market PSF</span>}
          </div>
        </div>
        {!isViable && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-950/60 px-4 py-2 ring-1 ring-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold text-amber-300">Below 12% ROI threshold</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard label="Total GDV" value={fmt.aed(f.gdv)} sub="Gross Dev. Value" icon={<DollarSign className="h-3.5 w-3.5" />} variant="positive" />
        <KPICard label="Dev Cost" value={fmt.aed(f.totalDevCost)} sub="All-in cost" icon={<Building className="h-3.5 w-3.5" />} variant="neutral" />
        <KPICard label="Net Profit" value={fmt.aed(f.netProfit)} sub={`${fmt.pct(f.profitMargin)} margin`} icon={f.netProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />} variant={f.netProfit >= 0 ? 'positive' : 'negative'} />
        <KPICard label="ROI" value={fmt.pct(f.roi)} sub={`~${fmt.pct(f.irr)} IRR est.`} icon={<TrendingUp className="h-3.5 w-3.5" />} variant={f.roi >= 20 ? 'positive' : f.roi >= 12 ? 'highlight' : 'negative'} />
        <KPICard label="Break-Even PSF" value={fmt.psf(f.breakEvenPSF)} sub="Min sale price" icon={<BarChart2 className="h-3.5 w-3.5" />} variant="highlight" />
        <KPICard label="Total Units" value={String(f.totalUnits)} sub={f.landUseCategory} icon={<Layers className="h-3.5 w-3.5" />} variant="neutral" />
      </div>

      <div className="rounded-xl border border-white/8 bg-zinc-900/50 p-5">
        <h4 className="mb-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Cost Breakdown</h4>
        {[
          { label: 'Land Cost',           amount: f.landCost,         color: '#EF4444' },
          { label: 'Construction Cost',   amount: f.constructionCost, color: '#F59E0B' },
          { label: 'Professional Fees',   amount: f.profFeesCost,     color: '#8B5CF6' },
          { label: 'Finance Cost',        amount: f.finCostVal,       color: '#3B82F6' },
          { label: 'Marketing',           amount: f.marketingCost,    color: '#06B6D4' },
          { label: 'Contingency (5%)',    amount: f.contingencyCost,  color: '#6B7280' },
        ].map((row) => (
          <CostRow key={row.label} {...row} total={f.totalDevCost} />
        ))}
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
          <span className="text-xs font-bold text-zinc-300">Total Development Cost</span>
          <span className="text-sm font-black text-white">{fmt.aed(f.totalDevCost)}</span>
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Unit Mix — {f.landUse || f.landUseCategory}</h4>
        <UnitMixTable units={f.unitMix} />
      </div>

      <div>
        <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sensitivity Analysis — Sale Price Scenarios</h4>
        <SensitivityTable scenarios={f.sensitivity} />
      </div>

      <div className="text-[10px] text-zinc-600 text-right">
        Computed {new Date(f.computedAt).toLocaleString()} · PSF source: {f.marketPSFSource}
      </div>
    </div>
  );
}
