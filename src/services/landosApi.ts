// ═══════════════════════════════════════════════════════════════════════════
// LAND OS API SERVICE
// Queries: plot number | municipality number | coordinates
// Returns: Plot Area, GFA, Land Use, Height Limit, Floors, Max Built Area
// ═══════════════════════════════════════════════════════════════════════════

import type {
  LandOSConfig,
  LandOSQuery,
  LandOSPlotData,
  LandOSResponse,
} from '@/types/landos';

// ── Constants ────────────────────────────────────────────────────────────────

export const LAND_OS_ENDPOINT =
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/land-os-api`;

const DEFAULT_CONFIG: LandOSConfig = {
  apiKey: '',
  endpoint: LAND_OS_ENDPOINT,
  timeout: 10_000,
  retries: 2,
};

// ── Singleton config ─────────────────────────────────────────────────────────

let _config: LandOSConfig = { ...DEFAULT_CONFIG };

export function configureLandOS(config: Partial<LandOSConfig>): void {
  _config = { ..._config, ...config };
}

export function getLandOSConfig(): Readonly<LandOSConfig> {
  return _config;
}

// ── Raw API call with retry ───────────────────────────────────────────────────

async function landOSCall<T = unknown>(
  payload: Record<string, unknown>,
  config = _config,
): Promise<T> {
  const { apiKey, endpoint, timeout, retries } = config;

  if (!apiKey) {
    throw new Error('No Land OS API key configured. Add it in Settings → API Keys.');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-land-os-api-key': apiKey,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || apiKey,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      clearTimeout(timer);

      const text = await response.text();
      let data: unknown;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `HTTP ${response.status} — non-JSON response: ${text.slice(0, 120)}`,
        );
      }

      if (!response.ok) {
        const d = data as Record<string, unknown>;
        const msg =
          (d?.error as string) ||
          (d?.message as string) ||
          (d?.detail as string) ||
          JSON.stringify(d).slice(0, 200);
        throw new Error(`HTTP ${response.status}: ${msg}`);
      }

      return data as T;
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));

      const isAbort =
        lastError.name === 'AbortError' ||
        lastError.message.includes('aborted');
      const isNetwork =
        lastError.message.includes('Failed to fetch') ||
        lastError.message.includes('NetworkError') ||
        lastError.message.includes('Load failed');

      if (isNetwork) {
        const blockedErr = new Error('NETWORK_BLOCKED: ' + lastError.message);
        blockedErr.name = 'NetworkBlockedError';
        throw blockedErr;
      }

      if (isAbort) {
        throw new Error(`Land OS request timed out after ${timeout}ms`);
      }

      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1_000 * (attempt + 1)));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new Error('Land OS call failed');
}

// ── Normalise raw API response → LandOSPlotData ───────────────────────────────

function normalisePlot(
  raw: Record<string, unknown>,
  query: LandOSQuery,
): LandOSPlotData {
  const p =
    (raw?.plot as Record<string, unknown>) ??
    ((raw?.data as Record<string, unknown>)?.plot as Record<string, unknown>) ??
    (raw?.result as Record<string, unknown>) ??
    raw;

  const toFloat = (v: unknown): number => parseFloat(String(v ?? 0)) || 0;
  const toInt   = (v: unknown): number => parseInt(String(v ?? 0), 10)  || 0;
  const toStr   = (v: unknown): string => String(v ?? '').trim();

  const plotSqm  = toFloat(p.plot_area_sqm  ?? p.plot_size_sqm  ?? p.area_sqm  ?? 0);
  const plotSqft = toFloat(p.plot_area_sqft ?? 0) || Math.round(plotSqm * 10.7639);
  const gfaSqm   = toFloat(p.gfa_sqm        ?? p.gross_floor_area_sqm          ?? 0);
  const gfaSqft  = toFloat(p.gfa_sqft       ?? 0) || Math.round(gfaSqm * 10.7639);
  const floors   = toInt(p.floors ?? p.max_floors ?? p.num_floors ?? 0);

  return {
    plotNumber:       toStr(p.plot_number   ?? p.plotNumber   ?? query.plotNumber  ?? ''),
    municipalityNumber: toStr(p.municipality_number ?? p.mun_no ?? query.municipalityNumber ?? ''),
    area:             toStr(p.area_name     ?? p.area         ?? query.area        ?? ''),
    plotAreaSqm:      plotSqm,
    plotAreaSqft:     plotSqft,
    gfaSqm,
    gfaSqft,
    far:              toFloat(p.far ?? p.floor_area_ratio ?? 0) || null,
    maxBuiltArea:     toFloat(p.max_built_area ?? p.maximum_built_area ?? 0),
    landUse:          toStr(p.land_use ?? p.landuse ?? p.usage ?? ''),
    heightLimit:      toFloat(p.height_limit ?? p.height ?? p.max_height ?? 0) || null,
    floors:           floors || null,
    zoneCode:         toStr(p.zone_code  ?? p.zone         ?? ''),
    permitClass:      toStr(p.permit_class                 ?? ''),
    coordinates:
      p.lat && p.lng
        ? { lat: toFloat(p.lat), lng: toFloat(p.lng) }
        : p.latitude && p.longitude
        ? { lat: toFloat(p.latitude), lng: toFloat(p.longitude) }
        : (query.coordinates ?? undefined),
    source: 'LAND_OS',
    fetchedAt: new Date().toISOString(),
    raw: p,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function lookupPlot(query: LandOSQuery): Promise<LandOSResponse> {
  const start = Date.now();

  const payload: Record<string, unknown> = {
    action:               'plots',
    query_type:           query.type,
    plot_number:          query.plotNumber          ?? null,
    municipality_number:  query.municipalityNumber  ?? null,
    municipalityNumber:   query.municipalityNumber  ?? null,
    coordinates:          query.coordinates         ?? null,
    area:                 query.area                ?? null,
  };

  try {
    const raw = await landOSCall<Record<string, unknown>>(payload);

    // Handle array response from the API
    const plots = raw?.plots as Record<string, unknown>[] | undefined;
    const plotData = plots?.[0] ?? raw?.plot ?? (raw?.data as Record<string, unknown>)?.plot ?? raw?.result ?? raw;

    if (!plotData || typeof plotData !== 'object') {
      return { success: false, error: 'No plot data returned' };
    }

    const plot = normalisePlot(plotData as Record<string, unknown>, query);

    if (!plot.plotNumber && !plot.gfaSqm && !plot.plotAreaSqm) {
      return { success: false, error: 'Plot not found in Land OS database' };
    }

    return { success: true, plot, latencyMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message, latencyMs: Date.now() - start };
  }
}

export async function healthCheck(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  const start = Date.now();
  try {
    await landOSCall({ action: 'health' });
    return { ok: true, latencyMs: Date.now() - start, message: 'Connected' };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function lookupByPlotNumber(
  plotNumber: string,
  area?: string,
): Promise<LandOSResponse> {
  return lookupPlot({ type: 'plot_number', plotNumber, area });
}

export async function lookupByCoordinates(
  lat: number,
  lng: number,
): Promise<LandOSResponse> {
  return lookupPlot({ type: 'coordinates', coordinates: { lat, lng } });
}

export async function lookupByMunicipality(
  municipalityNumber: string,
): Promise<LandOSResponse> {
  return lookupPlot({ type: 'municipality_number', municipalityNumber });
}
