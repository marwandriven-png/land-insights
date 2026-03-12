// ═══════════════════════════════════════════════════════════════════════════
// LandOSPage — Drop-in page with 3 tabs and "Analyse All" button
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useLandOS } from '@/hooks/useLandOS';
import { LandOSPanel, SimilarityPanel, FeasibilityPanel } from '@/components/landos';
import type { PlotRecord, FeasibilityInputs } from '@/types/landos';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ── Tab navigation ────────────────────────────────────────────────────────────

type Tab = 'lookup' | 'similarity' | 'feasibility';

function TabButton({ tab, active, label, badge, onClick }: {
  tab: Tab; active: Tab; label: string; badge?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all',
        tab === active
          ? 'bg-gradient-to-br from-cyan-600/30 to-purple-600/20 text-white ring-1 ring-white/20'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5',
      )}
    >
      {label}
      {badge && (
        <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-black text-cyan-400">
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Empty feasibility state ───────────────────────────────────────────────────

function EmptyFeasibility({ onRun, isLoading }: { onRun: () => void; isLoading: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-900/40 to-purple-900/40 ring-1 ring-white/10">
        <span className="text-3xl">🏗️</span>
      </div>
      <div>
        <h3 className="text-base font-bold text-white">Run Feasibility Analysis</h3>
        <p className="mt-1 text-sm text-zinc-500 max-w-sm">
          Calculate GDV, cost stack, ROI, unit mix, and sensitivity scenarios using Land OS data + market transactions.
        </p>
      </div>
      <button
        onClick={onRun}
        disabled={isLoading}
        className="flex items-center gap-2 rounded-xl bg-cyan-600 px-8 py-3 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors"
      >
        {isLoading
          ? <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          : '⚡'}
        Run Feasibility
      </button>
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────

// Demo plot for standalone usage — in production, pass via props or route params
const DEMO_PLOT: PlotRecord = {
  id: 'demo-1',
  plotNumber: '6457941',
  area: 'Al Barari',
  plotSize: 23323,
  landUse: 'Residential',
};

export default function LandOSPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('lookup');
  const [apiKey, setApiKey] = useState('');
  const [plot] = useState<PlotRecord>(DEMO_PLOT);

  const landos = useLandOS({ apiKey, transactions: [], allPlots: [] });

  function handleRunAnalysis() {
    landos.runSimilarity(plot);
    landos.runFeasibilityAnalysis(plot);
    setActiveTab('feasibility');
  }

  const simCount = landos.similarityResult?.stats.count;
  const hasResult = !!landos.feasibilityResult;

  return (
    <div className="min-h-screen bg-zinc-950 p-6 font-sans">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-zinc-400" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-purple-500/30 ring-1 ring-white/10">
              <span className="text-lg">⚡</span>
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">
                Land OS · Feasibility Suite
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Plot {plot.plotNumber} · {plot.area}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* API Key input */}
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Land OS API Key"
            type="password"
            className="w-48 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-cyan-500/50"
          />

          <button
            onClick={() => { landos.analyseAll(plot); setActiveTab('feasibility'); }}
            disabled={landos.isLoading || !apiKey}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 px-6 py-2.5 text-sm font-bold text-white hover:from-cyan-500 hover:to-purple-500 disabled:opacity-40 transition-all"
          >
            {landos.isLoading
              ? <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : '⚡'}
            Analyse All
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-5 flex items-center gap-1 rounded-xl bg-zinc-900/60 p-1 ring-1 ring-white/8 w-fit">
        <TabButton tab="lookup"      active={activeTab} label="Land OS Lookup"     onClick={() => setActiveTab('lookup')} />
        <TabButton tab="similarity"  active={activeTab} label="Comparable Plots"   badge={simCount ? String(simCount) : undefined} onClick={() => setActiveTab('similarity')} />
        <TabButton tab="feasibility" active={activeTab} label="Feasibility"        badge={hasResult ? '✓' : undefined} onClick={() => setActiveTab('feasibility')} />
      </div>

      {/* Tab content */}
      <div className="rounded-2xl border border-white/8 bg-zinc-900/40 p-6 backdrop-blur-sm">
        {activeTab === 'lookup' && (
          <LandOSPanel
            apiKey={apiKey}
            status={landos.status}
            connectionStatus={landos.connectionStatus}
            connectionLatency={landos.connectionLatency}
            plotData={landos.plotData}
            error={landos.error}
            onLookupByNumber={(num, area) => landos.lookupByNumber(num, area)}
            onLookupByMun={(mun)          => landos.lookupByMun(mun)}
            onLookupByCoords={(lat, lng)  => landos.lookupByCoords(lat, lng)}
            onCheckConnection={landos.checkConnection}
            onRunAnalysis={landos.plotData ? handleRunAnalysis : undefined}
          />
        )}

        {activeTab === 'similarity' && (
          <SimilarityPanel
            result={landos.similarityResult}
            isLoading={landos.similarityStatus === 'loading'}
            onRefresh={() => landos.runSimilarity(plot)}
          />
        )}

        {activeTab === 'feasibility' && (
          landos.feasibilityResult ? (
            <FeasibilityPanel
              result={landos.feasibilityResult}
              plotNumber={plot.plotNumber}
              area={plot.area}
            />
          ) : (
            <EmptyFeasibility
              onRun={() => landos.runFeasibilityAnalysis(plot)}
              isLoading={landos.feasibilityStatus === 'loading'}
            />
          )
        )}
      </div>
    </div>
  );
}
