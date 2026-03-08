import { PlotData, gisService } from '@/services/DDAGISService';
import proj4 from 'proj4';

proj4.defs('EPSG:3997', '+proj=tmerc +lat_0=0 +lon_0=55.33333333333334 +k=1 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

export const SQM_TO_SQFT = 10.7639;

/** Convert EPSG:3997 projected coords to WGS84 [lat, lng] */
export function toWGS84(x: number, y: number): [number, number] {
  try {
    const result = proj4('EPSG:3997', 'EPSG:4326', [x, y]);
    return [result[1], result[0]]; // [lat, lng]
  } catch {
    return [0, 0];
  }
}

/** Resolve plot coordinates to WGS84 [lat, lng] */
export function resolveCoordinates(plot: PlotData): [number, number] {
  if (plot.x > 1000 && plot.y > 1000) {
    return toWGS84(plot.x, plot.y);
  }
  return [plot.y, plot.x];
}

/** Check if a land-use string represents important infrastructure */
export function isImportantLandUse(landUse: string): boolean {
  const lu = landUse.toUpperCase();
  return /COMMERCIAL|SHOPPING|RETAIL|PARK|GARDEN|FACILITIES|MASJID|MOSQUE|SCHOOL|HOSPITAL|COMMUNITY|OPEN SPACE|SUPERMARKET/.test(lu);
}

/** Get the area name string from a plot */
export function getPlotAreaName(plot: PlotData): string {
  return plot.location || plot.project || plot.entity || '';
}

export interface NearbySearchOptions {
  /** Spatial search radius in meters (default 5000) */
  radiusMeters?: number;
  /** Max plots to return from spatial search (default 200) */
  spatialLimit?: number;
  /** Max plots to send to AI after sorting (default 100) */
  outputLimit?: number;
  /** Include area-name supplementary search (default true) */
  includeAreaSearch?: boolean;
}

export interface NearbySearchResult {
  plots: PlotData[];
  lat: number;
  lng: number;
  totalFound: number;
}

/**
 * Normalized nearby-plot discovery used by all intelligence modules.
 * 1. Converts coordinates (EPSG:3997 → WGS84)
 * 2. Spatial search within radius
 * 3. Supplementary area-name search
 * 4. Smart sort: same-area first, then important infrastructure
 * 5. Deduplicates and caps output
 */
export async function fetchNearbyPlots(
  plot: PlotData,
  options: NearbySearchOptions = {}
): Promise<NearbySearchResult> {
  const {
    radiusMeters = 5000,
    spatialLimit = 200,
    outputLimit = 100,
    includeAreaSearch = true,
  } = options;

  const [lat, lng] = resolveCoordinates(plot);
  let nearbyPlots: PlotData[] = [];

  // Step 1: Spatial search
  if (lat && lng && lat !== 0 && lng !== 0) {
    nearbyPlots = await gisService.searchByLocation(lat, lng, radiusMeters, spatialLimit);
    nearbyPlots = nearbyPlots.filter(p => p.id !== plot.id);
  }

  // Step 2: Supplementary area-name search
  const areaName = getPlotAreaName(plot);
  if (includeAreaSearch && areaName && areaName !== 'Dubai') {
    try {
      const areaPlots = await gisService.searchByArea(undefined, undefined, areaName);
      const existingIds = new Set(nearbyPlots.map(p => p.id));
      existingIds.add(plot.id);
      const uniqueAreaPlots = areaPlots.filter(p => !existingIds.has(p.id));
      nearbyPlots = [...nearbyPlots, ...uniqueAreaPlots];
    } catch (e) {
      console.log('Area search supplementary failed:', e);
    }
  }

  // Step 3: Smart sort — prioritize same-area + important infrastructure
  const selectedArea = areaName.toUpperCase();
  nearbyPlots.sort((a, b) => {
    const aArea = getPlotAreaName(a).toUpperCase();
    const bArea = getPlotAreaName(b).toUpperCase();
    const aScore = (aArea === selectedArea ? 2 : 0) + (isImportantLandUse(a.landUseDetails || '') ? 1 : 0);
    const bScore = (bArea === selectedArea ? 2 : 0) + (isImportantLandUse(b.landUseDetails || '') ? 1 : 0);
    return bScore - aScore;
  });

  const totalFound = nearbyPlots.length;

  return {
    plots: nearbyPlots.slice(0, outputLimit),
    lat,
    lng,
    totalFound,
  };
}

/** Map a PlotData to the standard payload shape sent to edge functions */
export function toEdgeFunctionPlot(p: PlotData, includeCoords = false) {
  const base: Record<string, any> = {
    id: p.id,
    location: getPlotAreaName(p),
    areaSqft: Math.round(p.area * SQM_TO_SQFT),
    gfaSqft: Math.round(p.gfa * SQM_TO_SQFT),
    zoning: p.zoning,
    status: p.status,
    floors: p.floors,
    developer: p.developer || '',
    constructionStatus: p.constructionStatus || '',
    landUseDetails: p.landUseDetails || '',
  };
  if (includeCoords) {
    const [lat, lng] = resolveCoordinates(p);
    base.lat = lat;
    base.lng = lng;
  }
  return base;
}
