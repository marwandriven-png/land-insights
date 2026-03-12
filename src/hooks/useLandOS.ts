// ═══════════════════════════════════════════════════════════════════════════
// useLandOS — React hook
// Orchestrates: API lookup → similarity → feasibility → UI state
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react';
import {
  lookupPlot,
  healthCheck,
  configureLandOS,
} from '@/services/landosApi';
import { findSimilarPlots, getAreaAvgPSF } from '@/services/similarityEngine';
import { runFeasibility }                   from '@/services/feasibilityEngine';

import type {
  LandOSQuery,
  LandOSPlotData,
  PlotRecord,
  TransactionRecord,
  SimilarityResult,
  FeasibilityResult,
  FeasibilityInputs,
} from '@/types/landos';

// ── State shape ───────────────────────────────────────────────────────────────

export type LandOSStatus = 'idle' | 'loading' | 'success' | 'error';
export type ConnectionStatus = 'unchecked' | 'checking' | 'connected' | 'failed';

export interface LandOSState {
  status:          LandOSStatus;
  error:           string | null;
  plotData:        LandOSPlotData | null;
  lastQuery:       LandOSQuery | null;
  connectionStatus: ConnectionStatus;
  connectionLatency: number | null;
  similarityStatus:  LandOSStatus;
  similarityResult:  SimilarityResult | null;
  feasibilityStatus: LandOSStatus;
  feasibilityResult: FeasibilityResult | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLandOS(options: {
  apiKey: string;
  transactions?: TransactionRecord[];
  allPlots?: PlotRecord[];
}) {
  const { apiKey, transactions = [], allPlots = [] } = options;

  configureLandOS({ apiKey });

  const [state, setState] = useState<LandOSState>({
    status:             'idle',
    error:              null,
    plotData:           null,
    lastQuery:          null,
    connectionStatus:   'unchecked',
    connectionLatency:  null,
    similarityStatus:   'idle',
    similarityResult:   null,
    feasibilityStatus:  'idle',
    feasibilityResult:  null,
  });

  const cache = useRef<Map<string, LandOSPlotData>>(new Map());

  const setPartial = (partial: Partial<LandOSState>) =>
    setState((prev) => ({ ...prev, ...partial }));

  // ── API Lookup ─────────────────────────────────────────────────────────────

  const lookup = useCallback(async (query: LandOSQuery): Promise<LandOSPlotData | null> => {
    const cacheKey = JSON.stringify(query);
    if (cache.current.has(cacheKey)) {
      const cached = cache.current.get(cacheKey)!;
      setPartial({ status: 'success', plotData: cached, lastQuery: query, error: null });
      return cached;
    }

    setPartial({ status: 'loading', error: null, lastQuery: query });

    const result = await lookupPlot(query);

    if (result.success && result.plot) {
      cache.current.set(cacheKey, result.plot);
      setPartial({ status: 'success', plotData: result.plot, error: null });
      return result.plot;
    } else {
      setPartial({ status: 'error', error: result.error ?? 'Lookup failed', plotData: null });
      return null;
    }
  }, []);

  const lookupByNumber = useCallback(
    (plotNumber: string, area?: string) =>
      lookup({ type: 'plot_number', plotNumber, area }),
    [lookup],
  );

  const lookupByCoords = useCallback(
    (lat: number, lng: number) =>
      lookup({ type: 'coordinates', coordinates: { lat, lng } }),
    [lookup],
  );

  const lookupByMun = useCallback(
    (municipalityNumber: string) =>
      lookup({ type: 'municipality_number', municipalityNumber }),
    [lookup],
  );

  // ── Health Check ───────────────────────────────────────────────────────────

  const checkConnection = useCallback(async () => {
    setPartial({ connectionStatus: 'checking' });
    const result = await healthCheck();
    setPartial({
      connectionStatus: result.ok ? 'connected' : 'failed',
      connectionLatency: result.latencyMs,
      error: result.ok ? null : result.message,
    });
    return result.ok;
  }, []);

  // ── Similarity Analysis ────────────────────────────────────────────────────

  const runSimilarity = useCallback(
    (target: PlotRecord, opts?: { tolerance?: number; maxResults?: number }) => {
      setPartial({ similarityStatus: 'loading' });
      try {
        const result = findSimilarPlots(target, transactions, allPlots, opts);
        setPartial({ similarityStatus: 'success', similarityResult: result });
        return result;
      } catch (e) {
        setPartial({
          similarityStatus: 'error',
          error: e instanceof Error ? e.message : 'Similarity analysis failed',
        });
        return null;
      }
    },
    [transactions, allPlots],
  );

  // ── Feasibility Analysis ───────────────────────────────────────────────────

  const runFeasibilityAnalysis = useCallback(
    (
      plotRecord: PlotRecord,
      overrides?: Partial<FeasibilityInputs>,
    ): FeasibilityResult => {
      setPartial({ feasibilityStatus: 'loading' });

      const landosData = state.plotData ?? plotRecord.landosData;
      const marketPSF  = getAreaAvgPSF(plotRecord.area, transactions);

      const inputs: FeasibilityInputs = {
        plotSizeSqft:     plotRecord.plotSize,
        gfaSqft:          landosData?.gfaSqft  ?? plotRecord.gfaSqft,
        far:              landosData?.far       ?? plotRecord.gisData?.far,
        floors:           landosData?.floors    ?? (typeof plotRecord.floors === 'number' ? plotRecord.floors : undefined),
        heightLimit:      typeof landosData?.heightLimit === 'number' ? landosData.heightLimit : undefined,
        landUse:          landosData?.landUse   ?? plotRecord.landUse,
        landCost:         plotRecord.askingPrice,
        ...overrides,
      };

      const result = runFeasibility(inputs, marketPSF);
      (result as FeasibilityResult).landOSUsed = !!landosData;

      setPartial({ feasibilityStatus: 'success', feasibilityResult: result });
      return result;
    },
    [state.plotData, transactions],
  );

  // ── Full workflow: lookup → similarity → feasibility ──────────────────────

  const analyseAll = useCallback(
    async (plotRecord: PlotRecord) => {
      const landosData = await lookupByNumber(plotRecord.plotNumber, plotRecord.area);

      const enriched: PlotRecord = {
        ...plotRecord,
        gfaSqft:  landosData?.gfaSqft  ?? plotRecord.gfaSqft,
        landUse:  landosData?.landUse   ?? plotRecord.landUse,
        floors:   landosData?.floors    ?? plotRecord.floors,
        landosData: landosData ?? undefined,
      };

      runSimilarity(enriched);
      runFeasibilityAnalysis(enriched);
    },
    [lookupByNumber, runSimilarity, runFeasibilityAnalysis],
  );

  // ── Reset ──────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setState({
      status:             'idle',
      error:              null,
      plotData:           null,
      lastQuery:          null,
      connectionStatus:   state.connectionStatus,
      connectionLatency:  state.connectionLatency,
      similarityStatus:   'idle',
      similarityResult:   null,
      feasibilityStatus:  'idle',
      feasibilityResult:  null,
    });
  }, [state.connectionStatus, state.connectionLatency]);

  return {
    ...state,
    lookup,
    lookupByNumber,
    lookupByCoords,
    lookupByMun,
    checkConnection,
    runSimilarity,
    runFeasibilityAnalysis,
    analyseAll,
    reset,
    isLoading:   state.status === 'loading' || state.similarityStatus === 'loading' || state.feasibilityStatus === 'loading',
    hasPlotData: !!state.plotData,
  };
}
