// ═══════════════════════════════════════════════════════════════════════════
// LandOSPanel — Plot lookup UI
// Query by: plot number · municipality number · coordinates
// Shows: official plot data returned from Land OS API
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Search, Wifi, WifiOff, Loader2, MapPin, Building2, Layers, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LandOSPlotData } from '@/types/landos';
import type { ConnectionStatus, LandOSStatus } from '@/hooks/useLandOS';

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status, latency }: { status: ConnectionStatus; latency: number | null }) {
  const map: Record<ConnectionStatus, { label: string; dot: string; bg: string; text: string }> = {
    unchecked: { label: 'Not tested',  dot: 'bg-zinc-400',   bg: 'bg-zinc-900',  text: 'text-zinc-400' },
    checking:  { label: 'Checking…',   dot: 'bg-amber-400 animate-pulse', bg: 'bg-amber-950', text: 'text-amber-300' },
    connected: { label: 'Connected',   dot: 'bg-emerald-400', bg: 'bg-emerald-950', text: 'text-emerald-300' },
    failed:    { label: 'Failed',      dot: 'bg-red-400',    bg: 'bg-red-950',   text: 'text-red-300' },
  };
  const s = map[status];
  return (
    <div className={cn('flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold', s.bg, s.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
      {status === 'connected' && latency !== null && (
        <span className="opacity-50 font-normal">{latency}ms</span>
      )}
    </div>
  );
}

function DataField({ label, value, accent }: { label: string; value: string | number | null | undefined; accent?: boolean }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">{label}</span>
      <span className={cn('text-sm font-bold', accent ? 'text-cyan-400' : 'text-white')}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

type QueryMode = 'plot_number' | 'municipality_number' | 'coordinates';

function QueryTab({ mode, active, label, icon, onClick }: {
  mode: QueryMode; active: QueryMode; label: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all',
        mode === active
          ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function PlotResultCard({ data }: { data: LandOSPlotData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-gradient-to-r from-cyan-950/40 to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20">
            <Building2 className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Plot {data.plotNumber || '—'}</div>
            <div className="text-xs text-zinc-500">{data.area || 'Land OS Official Data'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400 ring-1 ring-cyan-500/30">
            ⚡ Land OS
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-4">
        {[
          { label: 'Plot Area', value: data.plotAreaSqm ? `${data.plotAreaSqm.toLocaleString()} m²` : null, accent: true },
          { label: 'GFA',       value: data.gfaSqm      ? `${data.gfaSqm.toLocaleString()} m²`      : null, accent: true },
          { label: 'FAR',       value: data.far          ? String(data.far)                           : null, accent: false },
          { label: 'Floors',    value: data.floors       ? `${data.floors} floors`                    : null, accent: false },
        ].map((f) => f.value ? (
          <div key={f.label} className="flex flex-col gap-1 bg-zinc-950 px-4 py-3">
            <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">{f.label}</span>
            <span className={cn('text-lg font-black tabular-nums', f.accent ? 'text-cyan-400' : 'text-white')}>
              {f.value}
            </span>
          </div>
        ) : null)}
      </div>

      <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <DataField label="Land Use"       value={data.landUse}     accent />
        <DataField label="Height Limit"   value={data.heightLimit ? `${data.heightLimit}m` : null} />
        <DataField label="Max Built Area" value={data.maxBuiltArea ? `${data.maxBuiltArea.toLocaleString()} m²` : null} />
        <DataField label="Zone Code"      value={data.zoneCode} />
        <DataField label="Permit Class"   value={data.permitClass} />
        <DataField label="Municipality"   value={data.municipalityNumber} />
      </div>

      {(data.coordinates || data.raw) && (
        <div className="border-t border-white/5">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex w-full items-center justify-between px-5 py-2.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <span>More details</span>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {expanded && (
            <div className="px-5 pb-4 space-y-2">
              {data.coordinates && (
                <div className="flex items-center gap-2 rounded-lg bg-white/4 px-3 py-2">
                  <MapPin className="h-3 w-3 text-zinc-500 flex-shrink-0" />
                  <span className="text-xs text-zinc-400 font-mono">
                    {data.coordinates.lat.toFixed(6)}, {data.coordinates.lng.toFixed(6)}
                  </span>
                  <a
                    href={`https://maps.google.com/?q=${data.coordinates.lat},${data.coordinates.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs text-cyan-500 hover:text-cyan-400"
                  >
                    Open in Maps ↗
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface LandOSPanelProps {
  apiKey: string;
  status: LandOSStatus;
  connectionStatus: ConnectionStatus;
  connectionLatency: number | null;
  plotData: LandOSPlotData | null;
  error: string | null;
  onLookupByNumber:    (plotNumber: string, area?: string) => void;
  onLookupByMun:       (mun: string) => void;
  onLookupByCoords:    (lat: number, lng: number) => void;
  onCheckConnection:   () => void;
  onRunAnalysis?:      () => void;
}

export function LandOSPanel({
  status,
  connectionStatus,
  connectionLatency,
  plotData,
  error,
  onLookupByNumber,
  onLookupByMun,
  onLookupByCoords,
  onCheckConnection,
  onRunAnalysis,
}: LandOSPanelProps) {
  const [queryMode, setQueryMode]   = useState<QueryMode>('plot_number');
  const [plotNumber, setPlotNumber] = useState('');
  const [munNumber,  setMunNumber]  = useState('');
  const [lat, setLat]               = useState('');
  const [lng, setLng]               = useState('');

  const isLoading = status === 'loading';

  function handleSubmit() {
    if (queryMode === 'plot_number'        && plotNumber.trim()) onLookupByNumber(plotNumber.trim());
    if (queryMode === 'municipality_number' && munNumber.trim())  onLookupByMun(munNumber.trim());
    if (queryMode === 'coordinates'        && lat && lng)         onLookupByCoords(parseFloat(lat), parseFloat(lng));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-xl border border-white/8 bg-gradient-to-r from-zinc-900 to-zinc-950 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-purple-500/30 ring-1 ring-white/10">
            <Layers className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Land OS API</div>
            <div className="text-xs text-zinc-500">Official Dubai plot data</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={connectionStatus} latency={connectionLatency} />
          <button
            onClick={onCheckConnection}
            className="flex items-center gap-1.5 rounded-lg bg-white/6 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 transition-colors"
          >
            {connectionStatus === 'checking'
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : connectionStatus === 'connected'
              ? <Wifi className="h-3 w-3 text-emerald-400" />
              : <WifiOff className="h-3 w-3" />}
            Test
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/8 bg-zinc-900/60 p-5">
        <div className="mb-4 flex items-center gap-1 flex-wrap">
          <QueryTab mode="plot_number"         active={queryMode} label="Plot Number"         icon={<Search className="h-3 w-3" />}  onClick={() => setQueryMode('plot_number')} />
          <QueryTab mode="municipality_number" active={queryMode} label="Municipality No."    icon={<Building2 className="h-3 w-3" />} onClick={() => setQueryMode('municipality_number')} />
          <QueryTab mode="coordinates"         active={queryMode} label="Coordinates"         icon={<MapPin className="h-3 w-3" />}  onClick={() => setQueryMode('coordinates')} />
        </div>

        <div className="flex gap-3 flex-wrap">
          {queryMode === 'plot_number' && (
            <input
              value={plotNumber}
              onChange={(e) => setPlotNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. 6457922"
              className="flex-1 min-w-[200px] rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
            />
          )}
          {queryMode === 'municipality_number' && (
            <input
              value={munNumber}
              onChange={(e) => setMunNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. 6457941"
              className="flex-1 min-w-[200px] rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
            />
          )}
          {queryMode === 'coordinates' && (
            <>
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="Latitude (e.g. 25.2048)"
                className="flex-1 min-w-[160px] rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
              />
              <input
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="Longitude (e.g. 55.2708)"
                className="flex-1 min-w-[160px] rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
              />
            </>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors"
          >
            {isLoading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Search className="h-4 w-4" />}
            Look Up
          </button>
        </div>
      </div>

      {error && status === 'error' && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-5 py-4">
          <div className="flex items-start gap-3">
            <WifiOff className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-bold text-red-300">Lookup Failed</div>
              <div className="text-xs text-red-400/70 mt-1">{error}</div>
              {error.includes('NETWORK_BLOCKED') && (
                <div className="mt-2 text-xs text-amber-400/80 rounded bg-amber-900/30 px-3 py-2">
                  ⚠️ External API calls are blocked in this preview environment.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {plotData && status === 'success' && (
        <div className="space-y-3">
          <PlotResultCard data={plotData} />
          {onRunAnalysis && (
            <button
              onClick={onRunAnalysis}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 py-3 text-sm font-bold text-white hover:from-cyan-500 hover:to-purple-500 transition-all"
            >
              Run Feasibility Analysis
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
