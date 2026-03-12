// ═══════════════════════════════════════════════════════════════════════════
// SimilarityPanel — Plot Similarity Analysis UI
// Shows comparable plots within ±6% size range
// ═══════════════════════════════════════════════════════════════════════════

import { cn } from '@/lib/utils';
import { RefreshCw, TrendingUp, BarChart2, Layers } from 'lucide-react';
import type { SimilarityResult, ComparablePlot } from '@/types/landos';

function SimBadge({ score }: { score: number }) {
  const tier =
    score >= 90 ? { bg: 'bg-emerald-950', text: 'text-emerald-300', ring: 'ring-emerald-500/30', label: 'Excellent' } :
    score >= 75 ? { bg: 'bg-amber-950',   text: 'text-amber-300',   ring: 'ring-amber-500/30',   label: 'Good'      } :
    score >= 60 ? { bg: 'bg-blue-950',    text: 'text-blue-300',    ring: 'ring-blue-500/30',    label: 'Fair'      } :
                  { bg: 'bg-zinc-900',    text: 'text-zinc-400',    ring: 'ring-white/10',       label: 'Weak'      };
  return (
    <div className={cn('flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 ring-1', tier.bg, tier.ring)}>
      <span className={cn('text-sm font-black tabular-nums', tier.text)}>{score}</span>
      <span className={cn('text-[8px] font-bold uppercase tracking-wider', tier.text, 'opacity-70')}>{tier.label}</span>
    </div>
  );
}

function DiffBadge({ diff }: { diff: number }) {
  const abs = Math.abs(diff);
  const isClose = abs <= 3;
  return (
    <span className={cn(
      'rounded-full px-2 py-0.5 text-[10px] font-bold',
      isClose ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400',
    )}>
      {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
    </span>
  );
}

function SourceBadge({ source }: { source: ComparablePlot['source'] }) {
  const map = {
    TX:       { label: 'PM Tx',   bg: 'bg-zinc-800',    text: 'text-zinc-400' },
    LAND_OS:  { label: 'Land OS', bg: 'bg-purple-950',  text: 'text-purple-400' },
    INTERNAL: { label: 'Internal',bg: 'bg-blue-950',    text: 'text-blue-400' },
  };
  const s = map[source];
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider', s.bg, s.text)}>
      {s.label}
    </span>
  );
}

function StatsStrip({ stats }: { stats: SimilarityResult['stats'] }) {
  return (
    <div className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-4">
      {[
        { icon: <BarChart2 className="h-3.5 w-3.5" />, label: 'Comps Found',   value: String(stats.count),                                  accent: false },
        { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Avg PSF GFA',  value: stats.avgPSF     ? `AED ${stats.avgPSF.toLocaleString()}`     : '—', accent: true },
        { icon: <Layers className="h-3.5 w-3.5" />,     label: 'Avg GFA',      value: stats.avgGfaSqm  ? `${stats.avgGfaSqm.toLocaleString()} m²`  : '—', accent: true },
        { icon: <BarChart2 className="h-3.5 w-3.5" />,  label: 'Median PSF',   value: stats.medianPSF  ? `AED ${stats.medianPSF.toLocaleString()}` : '—', accent: false },
      ].map((s) => (
        <div key={s.label} className="flex flex-col gap-1 bg-zinc-950 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">
            <span className="text-zinc-600">{s.icon}</span>
            {s.label}
          </div>
          <span className={cn('text-base font-black tabular-nums', s.accent ? 'text-cyan-400' : 'text-white')}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function CompRow({ comp, isTarget = false }: { comp: ComparablePlot; isTarget?: boolean }) {
  return (
    <tr className={cn('transition-colors', isTarget ? 'bg-cyan-950/30' : 'hover:bg-white/3')}>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            {isTarget && (
              <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-400">Target</span>
            )}
            <span className={cn('text-xs font-bold', isTarget ? 'text-cyan-300' : 'text-white')}>{comp.plotNumber}</span>
          </div>
          {!isTarget && <SourceBadge source={comp.source} />}
        </div>
      </td>
      <td className="px-4 py-3"><span className="text-xs text-zinc-400 max-w-[120px] line-clamp-1">{comp.area}</span></td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white tabular-nums">{comp.plotSizeSqm.toLocaleString()} m²</span>
          {!isTarget && <DiffBadge diff={comp.sizeDiff} />}
        </div>
        <div className="text-[10px] text-zinc-600 tabular-nums">{comp.plotSizeSqft.toLocaleString()} sqft</div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {comp.gfaSqm > 0 ? (
          <>
            <span className="text-xs font-semibold text-cyan-400 tabular-nums">{comp.gfaSqm.toLocaleString()} m²</span>
            {!isTarget && comp.gfaDiff !== null && <div className="text-[10px] text-zinc-600">Δ {comp.gfaDiff.toFixed(1)}%</div>}
          </>
        ) : <span className="text-xs text-zinc-600">—</span>}
      </td>
      <td className="px-4 py-3"><span className="text-xs text-zinc-300">{comp.far ?? '—'}</span></td>
      <td className="px-4 py-3"><span className="text-xs text-zinc-400">{comp.heightLimit}</span></td>
      <td className="px-4 py-3"><span className="text-xs text-zinc-300 max-w-[100px] line-clamp-1">{comp.landUse}</span></td>
      <td className="px-4 py-3 whitespace-nowrap">
        {comp.price ? <span className="text-xs font-bold text-emerald-400">AED {(comp.price / 1_000_000).toFixed(1)}M</span> : <span className="text-xs text-zinc-600">—</span>}
        {comp.psf && <div className="text-[10px] text-zinc-600">AED {Math.round(comp.psf).toLocaleString()}/sqft</div>}
      </td>
      <td className="px-4 py-3">
        {isTarget ? <span className="text-xs text-zinc-600">—</span> : <SimBadge score={comp.simScore} />}
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface SimilarityPanelProps {
  result: SimilarityResult | null;
  isLoading: boolean;
  onRefresh?: () => void;
  onSyncPipeline?: () => void;
}

const HEADERS = ['Plot No.', 'Area', 'Plot Size', 'GFA', 'FAR', 'Height', 'Land Use', 'Price', 'Sim %'];

export function SimilarityPanel({ result, isLoading, onRefresh, onSyncPipeline }: SimilarityPanelProps) {
  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-white/8 bg-zinc-900/50">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Searching for comparable plots…
        </div>
      </div>
    );
  }

  if (!result) return null;

  const target = result.targetPlot;
  const targetComp: ComparablePlot = {
    source: 'INTERNAL', plotNumber: target.plotNumber, area: target.area,
    plotSizeSqm: target.plotSizeSqm, plotSizeSqft: Math.round(target.plotSizeSqm * 10.7639),
    gfaSqm: target.gfaSqm, gfaSqft: Math.round(target.gfaSqm * 10.7639),
    far: null, landUse: target.landUse, heightLimit: '—',
    sizeDiff: 0, gfaDiff: null, simScore: 100, sameArea: true,
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-white/8 bg-gradient-to-r from-zinc-900 to-zinc-950 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">🔍 Plot Similarity Analysis</span>
            <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">±6% range</span>
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">
            Target: Plot {target.plotNumber} · {target.area} · {target.plotSizeSqm.toLocaleString()} m²
          </div>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} className="flex items-center gap-1.5 rounded-lg bg-white/6 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 transition-colors">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        )}
      </div>

      {result.comparable.length > 0 && <StatsStrip stats={result.stats} />}

      {result.comparable.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="text-zinc-600 text-sm">{result.message ?? 'No comparable plots found.'}</div>
          {onSyncPipeline && (
            <button onClick={onSyncPipeline} className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500 transition-colors">
              <RefreshCw className="h-3.5 w-3.5" /> Sync Pipeline Data
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-zinc-900/50">
                {HEADERS.map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              <CompRow comp={targetComp} isTarget />
              {result.comparable.map((comp, i) => (
                <CompRow key={`${comp.plotNumber}-${i}`} comp={comp} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
