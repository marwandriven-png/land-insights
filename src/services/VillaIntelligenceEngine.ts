// ─────────────────────────────────────────────────────────────────────────────
// VillaIntelligenceEngine.ts
// GIS Property Intelligence — classifies villa/townhouse plots by:
//   Layout Type  : SingleRow | BackToBack
//   Position     : Corner | EndUnit | MidBlock
//   Back Facing  : Park | Road | OpenLand | ResidentialPlot | CommunityEdge
//   Vastu        : direction + Excellent/Good/Neutral/Less Preferred rating
//   Amenities    : distance-ranked, tiered proximity labels
//   Smart Tags   : auto-generated combined labels for display + search
// ─────────────────────────────────────────────────────────────────────────────

import { PlotData } from './DDAGISService';

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

export type LayoutType    = 'SingleRow' | 'BackToBack' | 'Unknown';
export type PositionType  = 'Corner' | 'EndUnit' | 'MidBlock';
export type BackFacing    = 'Park' | 'Road' | 'OpenLand' | 'ResidentialPlot' | 'CommunityEdge';
export type VastuRating   = 'Excellent' | 'Good' | 'Neutral' | 'Less Preferred';
export type ProximityLabel = 'Very Close' | 'Near' | 'Walkable' | 'Not Nearby';
export type CardinalDir   = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export type AmenityType =
  | 'pool' | 'park' | 'playground' | 'mosque'
  | 'school' | 'clubhouse' | 'mall' | 'gym' | 'spa' | 'retail' | 'golf' | 'clinic';

export interface AmenityResult {
  id:         string;
  name:       string;
  type:       AmenityType;
  distanceM:  number;
  proximity:  ProximityLabel;
  icon:       string;
}

export interface VastuResult {
  direction: CardinalDir;
  label:     string;
  rating:    VastuRating;
  score:     number;           // 1–4, used for ranking
}

export interface VillaIntelTags {
  plotId:         string;
  layoutType:     LayoutType;
  position:       PositionType;
  backFacing:     BackFacing;
  vastu:          VastuResult;
  vastuCompliant: boolean;     // true when Excellent or Good
  amenities:      AmenityResult[];
  smartTags:      string[];
  score:          number;
}

// Input for a single plot fed into the engine
export interface VillaPlotInput {
  id:           string;
  lat:          number;        // y in PlotData
  lng:          number;        // x in PlotData
  /** Entrance cardinal direction — most reliable classification signal */
  entranceDir?: CardinalDir;
  /** Bounding box corners [[lng,lat], ...] — improves edge-based detection */
  polygon?:     [number, number][];
  plotType?:    'residential' | 'road' | 'park' | 'open' | 'community' | 'mosque';
}

// A community amenity point used for proximity scoring
export interface AmenityDef {
  id:   string;
  type: AmenityType;
  name: string;
  lat:  number;
  lng:  number;
}

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

/** Proximity tiers — distance in metres */
const PROXIMITY_TIERS: { label: ProximityLabel; maxM: number }[] = [
  { label: 'Very Close', maxM: 50  },
  { label: 'Near',       maxM: 120 },
  { label: 'Walkable',   maxM: 250 },
  { label: 'Not Nearby', maxM: Infinity },
];

/** Vastu ratings by entrance direction */
const VASTU_MAP: Record<string, VastuResult> = {
  E:  { direction:'E',  label:'East Facing',  rating:'Excellent',       score:4 },
  N:  { direction:'N',  label:'North Facing', rating:'Good',            score:3 },
  NE: { direction:'NE', label:'NE Facing',    rating:'Good',            score:3 },
  W:  { direction:'W',  label:'West Facing',  rating:'Neutral',         score:2 },
  SE: { direction:'SE', label:'SE Facing',    rating:'Neutral',         score:2 },
  NW: { direction:'NW', label:'NW Facing',    rating:'Neutral',         score:2 },
  S:  { direction:'S',  label:'South Facing', rating:'Less Preferred',  score:1 },
  SW: { direction:'SW', label:'SW Facing',    rating:'Less Preferred',  score:1 },
};

const AMENITY_ICONS: Record<AmenityType, string> = {
  pool:'🏊', park:'🌳', playground:'🛝', mosque:'🕌',
  school:'🏫', clubhouse:'🏛️', mall:'🛍️', gym:'🏋️',
  spa:'💆', retail:'🛒', golf:'⛳', clinic:'🏥',
};

// ════════════════════════════════════════════════════════════════════════════
// GEOMETRY UTILITIES
// ════════════════════════════════════════════════════════════════════════════

/** Haversine distance in metres between two lat/lng points */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Polygon centroid [lng, lat] */
function centroid(poly: [number, number][]): [number, number] {
  let lng = 0, lat = 0;
  for (const [x, y] of poly) { lng += x; lat += y; }
  return [lng / poly.length, lat / poly.length];
}

/** Degrees → 8-point cardinal string */
function bearingToCardinal(deg: number): CardinalDir {
  const dirs: CardinalDir[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

/** Classify a distance into a proximity tier */
function classifyProximity(metres: number): ProximityLabel {
  return PROXIMITY_TIERS.find(t => metres <= t.maxM)?.label ?? 'Not Nearby';
}

/**
 * Build edge-midpoint list from a polygon.
 * Returns [[lng, lat], ...] one entry per edge.
 */
function edgeMidpoints(poly: [number, number][]): [number, number][] {
  return poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  });
}

/**
 * True if any edge-midpoint of polyA is within toleranceM metres of
 * any edge-midpoint of polyB.
 */
function polygonsShareBoundary(
  polyA: [number, number][],
  polyB: [number, number][],
  toleranceM: number
): boolean {
  const midsA = edgeMidpoints(polyA);
  const midsB = edgeMidpoints(polyB);
  for (const [aLng, aLat] of midsA)
    for (const [bLng, bLat] of midsB)
      if (haversineM(aLat, aLng, bLat, bLng) < toleranceM) return true;
  return false;
}

/**
 * Get the edge midpoints on the BACK side of the plot
 * (opposite to entranceBearing ± 70°).
 */
function backEdgeMidpoints(
  poly: [number, number][],
  entranceBearing: number
): [number, number][] {
  const [cLng, cLat] = centroid(poly);
  const backBearing = (entranceBearing + 180) % 360;
  const result: [number, number][] = [];

  const mids = edgeMidpoints(poly);
  for (const [mLng, mLat] of mids) {
    const edgeBear = (Math.atan2(mLng - cLng, mLat - cLat) * 180 / Math.PI + 360) % 360;
    const diff = Math.abs(((edgeBear - backBearing + 540) % 360) - 180);
    if (diff < 70) result.push([mLng, mLat]);
  }

  // Fallback: return all midpoints if none qualify
  return result.length > 0 ? result : mids;
}

/**
 * Infer entrance direction when entranceDir is not explicitly provided.
 * Finds the nearest road centroid and returns the cardinal direction toward it.
 */
function inferEntranceDirection(
  plot: VillaPlotInput,
  roadPlots: VillaPlotInput[]
): CardinalDir {
  if (roadPlots.length === 0) return 'N';

  const pLat = plot.lat, pLng = plot.lng;
  let bestDist = Infinity, bestBearing = 0;

  for (const road of roadPlots) {
    const [rLng, rLat] = road.polygon ? centroid(road.polygon) : [road.lng, road.lat];
    const d = haversineM(pLat, pLng, rLat, rLng);
    if (d < bestDist) {
      bestDist = d;
      bestBearing = (Math.atan2(rLng - pLng, rLat - pLat) * 180 / Math.PI + 360) % 360;
    }
  }

  return bearingToCardinal(bestBearing);
}

// ════════════════════════════════════════════════════════════════════════════
// ENGINE
// ════════════════════════════════════════════════════════════════════════════

export class VillaIntelligenceEngine {
  private resPlots:  VillaPlotInput[];
  private roadPlots: VillaPlotInput[];
  private parkPlots: VillaPlotInput[];
  private openPlots: VillaPlotInput[];
  private amenityDefs: AmenityDef[];
  private cache = new Map<string, VillaIntelTags>();
  private tolM: number;

  constructor(
    allPlots: VillaPlotInput[],
    amenities: AmenityDef[],
    toleranceM = 15
  ) {
    this.resPlots   = allPlots.filter(p => !p.plotType || p.plotType === 'residential');
    this.roadPlots  = allPlots.filter(p => p.plotType === 'road');
    this.parkPlots  = allPlots.filter(p => p.plotType === 'park');
    this.openPlots  = allPlots.filter(p => p.plotType === 'open');
    this.amenityDefs = amenities;
    this.tolM = toleranceM;
  }

  /** Analyze a single plot. Results are cached. */
  analyze(plot: VillaPlotInput): VillaIntelTags {
    if (this.cache.has(plot.id)) return this.cache.get(plot.id)!;

    // ── Entrance direction ────────────────────────────────────────────────
    const entranceDir: CardinalDir =
      plot.entranceDir ?? inferEntranceDirection(plot, this.roadPlots);
    const entranceBearing = { N:0, NE:45, E:90, SE:135, S:180, SW:225, W:270, NW:315 }[entranceDir] ?? 0;

    const poly = plot.polygon;

    // ── 1. Layout Type: SingleRow vs BackToBack ───────────────────────────
    //  Back-to-Back = another residential plot touches the BACK boundary
    //  Single Row   = back boundary does NOT touch another residential plot
    let layoutType: LayoutType = 'SingleRow';

    if (poly) {
      const backMids = backEdgeMidpoints(poly, entranceBearing);
      outerLoop:
      for (const other of this.resPlots) {
        if (other.id === plot.id || !other.polygon) continue;
        const otherMids = edgeMidpoints(other.polygon);
        for (const [bLng, bLat] of backMids) {
          for (const [oLng, oLat] of otherMids) {
            if (haversineM(bLat, bLng, oLat, oLng) < this.tolM) {
              layoutType = 'BackToBack';
              break outerLoop;
            }
          }
        }
      }
    } else {
      // No polygon: distance-based heuristic
      // If ≥2 other residential plots are within ~20 m, assume back-to-back cluster
      const close = this.resPlots.filter(
        r => r.id !== plot.id && haversineM(plot.lat, plot.lng, r.lat, r.lng) < 20
      );
      if (close.length >= 2) layoutType = 'BackToBack';
    }

    // ── 2. Position: Corner | EndUnit | MidBlock ─────────────────────────
    //  Corner  = 2+ sides of the plot touch road polygons
    //  EndUnit = only 1 residential neighbor on ALL sides
    //  MidBlock = middle of a row
    let position: PositionType = 'MidBlock';

    if (poly) {
      const allMids  = edgeMidpoints(poly);
      const [cLng, cLat] = centroid(poly);
      const roadSides = new Set<string>();

      for (const road of this.roadPlots) {
        if (!road.polygon) continue;
        const roadMids = edgeMidpoints(road.polygon);
        for (const [eLng, eLat] of allMids) {
          for (const [rLng, rLat] of roadMids) {
            if (haversineM(eLat, eLng, rLat, rLng) < this.tolM) {
              // Which cardinal side of the plot does this edge lie on?
              const bear = (Math.atan2(eLng - cLng, eLat - cLat) * 180 / Math.PI + 360) % 360;
              roadSides.add(bearingToCardinal(bear));
            }
          }
        }
      }

      if (roadSides.size >= 2) {
        position = 'Corner';
      } else {
        const neighbourCount = this.resPlots.filter(
          r => r.id !== plot.id && r.polygon && polygonsShareBoundary(poly, r.polygon, this.tolM)
        ).length;
        position = neighbourCount <= 1 ? 'EndUnit' : 'MidBlock';
      }
    } else {
      // Distance heuristic
      const neighbours = this.resPlots.filter(
        r => r.id !== plot.id && haversineM(plot.lat, plot.lng, r.lat, r.lng) < 20
      ).length;
      position = neighbours <= 1 ? 'EndUnit' : 'MidBlock';
    }

    // ── 3. Back Facing ────────────────────────────────────────────────────
    //  Priority: Road > Park > ResidentialPlot > OpenLand > CommunityEdge
    let backFacing: BackFacing = 'CommunityEdge';

    if (poly) {
      const backMids = backEdgeMidpoints(poly, entranceBearing);

      const touchesLayer = (candidates: VillaPlotInput[]): boolean =>
        candidates.some(c => {
          if (!c.polygon) return false;
          const cMids = edgeMidpoints(c.polygon);
          return backMids.some(([bLng, bLat]) =>
            cMids.some(([cLng, cLat]) => haversineM(bLat, bLng, cLat, cLng) < this.tolM)
          );
        });

      if      (touchesLayer(this.roadPlots)) backFacing = 'Road';
      else if (touchesLayer(this.parkPlots)) backFacing = 'Park';
      else if (touchesLayer(this.resPlots.filter(r => r.id !== plot.id))) backFacing = 'ResidentialPlot';
      else if (touchesLayer(this.openPlots)) backFacing = 'OpenLand';
    } else {
      // Distance heuristic: find the closest non-self plot in the back direction
      const backBearing = (entranceBearing + 180) % 360;
      let closestDist = Infinity;
      let closestType: string | undefined;

      const checkLayer = (layer: VillaPlotInput[], type: string) => {
        for (const p of layer) {
          const d = haversineM(plot.lat, plot.lng, p.lat, p.lng);
          const bear = (Math.atan2(p.lng - plot.lng, p.lat - plot.lat) * 180 / Math.PI + 360) % 360;
          const angDiff = Math.abs(((bear - backBearing + 540) % 360) - 180);
          if (angDiff < 60 && d < closestDist) { closestDist = d; closestType = type; }
        }
      };

      checkLayer(this.roadPlots.map(r => ({ ...r, plotType: 'road' as const })), 'road');
      checkLayer(this.parkPlots.map(r => ({ ...r, plotType: 'park' as const })), 'park');
      checkLayer(this.resPlots.filter(r => r.id !== plot.id), 'res');
      checkLayer(this.openPlots, 'open');

      if      (closestType === 'road') backFacing = 'Road';
      else if (closestType === 'park') backFacing = 'Park';
      else if (closestType === 'res')  backFacing = 'ResidentialPlot';
      else if (closestType === 'open') backFacing = 'OpenLand';
    }

    // ── 4. Vastu Orientation ──────────────────────────────────────────────
    const vastu: VastuResult = VASTU_MAP[entranceDir] ?? VASTU_MAP['N'];
    const vastuCompliant = vastu.rating === 'Excellent' || vastu.rating === 'Good';

    // ── 5. Amenities ──────────────────────────────────────────────────────
    const amenities: AmenityResult[] = this.amenityDefs
      .map(a => {
        const d = Math.round(haversineM(plot.lat, plot.lng, a.lat, a.lng));
        return {
          id:         a.id,
          name:       a.name,
          type:       a.type,
          distanceM:  d,
          proximity:  classifyProximity(d),
          icon:       AMENITY_ICONS[a.type] ?? '📍',
        };
      })
      .filter(a => a.distanceM <= 600)
      .sort((a, b) => a.distanceM - b.distanceM);

    // ── 6. Smart Tags ─────────────────────────────────────────────────────
    const smartTags: string[] = [];
    if (layoutType === 'SingleRow')  smartTags.push('Single Row');
    if (layoutType === 'BackToBack') smartTags.push('Back-to-Back');
    if (position === 'Corner')       smartTags.push('Corner');
    if (position === 'EndUnit')      smartTags.push('End Unit');
    if (backFacing === 'Park')       smartTags.push('Backs Park');
    if (backFacing === 'Road')       smartTags.push('Backs Road');
    if (backFacing === 'OpenLand')   smartTags.push('Backs Open Land');
    smartTags.push(vastu.label);
    if (vastuCompliant)              smartTags.push('Vastu ✓');
    for (const a of amenities) {
      if (a.proximity !== 'Not Nearby')
        smartTags.push(`${a.name} (${a.distanceM}m)`);
    }

    // ── 7. Score ──────────────────────────────────────────────────────────
    let score = 0;
    if (layoutType === 'SingleRow')  score += 18;
    if (position === 'Corner')       score += 14;
    if (position === 'EndUnit')      score +=  7;
    if (backFacing === 'Park')       score += 12;
    if (backFacing === 'Road')       score +=  5;
    if (backFacing === 'OpenLand')   score +=  3;
    score += vastu.score * 4;
    score += amenities.reduce((s, a) => {
      const bonus = ({ 'Very Close':10, 'Near':6, 'Walkable':3, 'Not Nearby':0 } as Record<ProximityLabel, number>)[a.proximity];
      return s + (bonus ?? 0);
    }, 0);

    const tags: VillaIntelTags = {
      plotId: plot.id,
      layoutType,
      position,
      backFacing,
      vastu,
      vastuCompliant,
      amenities,
      smartTags,
      score,
    };

    this.cache.set(plot.id, tags);
    return tags;
  }

  /** Analyze all residential plots in one pass. Returns id → tags map. */
  analyzeAll(plots: VillaPlotInput[]): Map<string, VillaIntelTags> {
    const result = new Map<string, VillaIntelTags>();
    for (const p of plots.filter(p => !p.plotType || p.plotType === 'residential')) {
      result.set(p.id, this.analyze(p));
    }
    return result;
  }

  /** Clear analysis cache (call after community data changes) */
  clearCache() {
    this.cache.clear();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SEARCH & FILTER
// ════════════════════════════════════════════════════════════════════════════

export interface VillaSearchFilters {
  layoutType?:     'SingleRow' | 'BackToBack';
  position?:       'Corner' | 'EndUnit' | 'MidBlock';
  backFacing?:     BackFacing;
  vastuCompliant?: boolean;
  vastuDirection?: string;          // 'E' | 'N' | 'W' | 'S' | ...
  nearAmenity?:    AmenityType[];
  maxAmenityDist?: number;
  naturalQuery?:   string;
}

/** Parse a natural-language query string into structured filters */
export function parseNLQuery(q: string): VillaSearchFilters {
  const s = q.toLowerCase().trim();
  const f: VillaSearchFilters = {};

  // Layout
  if (/single[\s-]?row/i.test(s))    f.layoutType = 'SingleRow';
  if (/back[\s-]?to[\s-]?back/i.test(s)) f.layoutType = 'BackToBack';
  // Position
  if (/\bcorner\b/i.test(s))         f.position = 'Corner';
  if (/end[\s-]?unit/i.test(s))      f.position = 'EndUnit';
  // Vastu
  if (/vastu/i.test(s))              f.vastuCompliant = true;
  if (/east[\s-]?fac/i.test(s))      f.vastuDirection = 'E';
  if (/north[\s-]?fac/i.test(s))     f.vastuDirection = 'N';
  if (/west[\s-]?fac/i.test(s))      f.vastuDirection = 'W';
  if (/south[\s-]?fac/i.test(s))     f.vastuDirection = 'S';
  // Back facing
  if (/back[s]?[\s-]?park|park[\s-]?view/i.test(s)) f.backFacing = 'Park';
  if (/back[s]?[\s-]?road/i.test(s)) f.backFacing = 'Road';
  if (/back[s]?[\s-]?open|open[\s-]?land/i.test(s)) f.backFacing = 'OpenLand';
  // Amenities
  const amenityKw: Record<string, AmenityType> = {
    'pool': 'pool', 'swimming': 'pool',
    'park': 'park', 'garden': 'park', 'green': 'park',
    'play': 'playground', 'kids': 'playground', 'playground': 'playground',
    'mall': 'mall', 'shop': 'mall', 'retail': 'retail',
    'school': 'school', 'mosque': 'mosque',
    'club': 'clubhouse', 'clubhouse': 'clubhouse',
    'golf': 'golf', 'spa': 'spa', 'gym': 'gym', 'clinic': 'clinic',
  };
  const found: AmenityType[] = [];
  for (const [kw, type] of Object.entries(amenityKw)) {
    if (s.includes(kw) && !found.includes(type)) found.push(type);
  }
  if (found.length) f.nearAmenity = found;
  // Distance override
  const dm = s.match(/(?:within|under|<)\s*(\d+)\s*m/);
  if (dm) f.maxAmenityDist = parseInt(dm[1]);

  return f;
}

/** Apply villa intelligence filters to a pre-filtered PlotData list */
export function applyVillaFilters(
  tagsMap: Map<string, VillaIntelTags>,
  plots: PlotData[],
  filters: VillaSearchFilters
): { plot: PlotData; intel: VillaIntelTags; score: number }[] {
  // Merge NL parse into structured filters (explicit keys win over NL)
  const resolved: VillaSearchFilters = filters.naturalQuery
    ? { ...parseNLQuery(filters.naturalQuery), ...filters }
    : { ...filters };

  const maxDist = resolved.maxAmenityDist ?? 300;
  const results: { plot: PlotData; intel: VillaIntelTags; score: number }[] = [];

  for (const plot of plots) {
    const intel = tagsMap.get(plot.id);
    if (!intel) continue;

    let match = true;
    let score = intel.score;

    // Hard filters
    if (resolved.layoutType && intel.layoutType !== resolved.layoutType)              match = false;
    if (resolved.position    && intel.position   !== resolved.position)               match = false;
    if (resolved.backFacing  && intel.backFacing  !== resolved.backFacing)             match = false;
    if (resolved.vastuCompliant && !intel.vastuCompliant)                              match = false;
    if (resolved.vastuDirection && intel.vastu.direction !== resolved.vastuDirection)  match = false;

    // Amenity proximity filters
    if (match && resolved.nearAmenity?.length) {
      for (const amenType of resolved.nearAmenity) {
        const found = intel.amenities.find(
          a => a.type === amenType && a.distanceM <= maxDist
        );
        if (!found) { match = false; break; }
        // Boost score based on how close the amenity is
        score += Math.max(0, Math.round(70 - found.distanceM / 4));
      }
    }

    if (!match) continue;
    results.push({ plot, intel, score });
  }

  // Sort by score desc, then by closest amenity as tiebreaker
  return results.sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : (a.intel.amenities[0]?.distanceM ?? 9999) - (b.intel.amenities[0]?.distanceM ?? 9999)
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMMUNITY AMENITY REGISTRY
// Extend this with actual GPS coordinates from each community you support.
// ════════════════════════════════════════════════════════════════════════════

export const COMMUNITY_AMENITIES: Record<string, AmenityDef[]> = {
  // Arabian Ranches III (Emaar) — approx 25.062°N, 55.248°E
  arabian_ranches_3: [
    { id:'ar3-pool-main',   type:'pool',      name:'Main Pool',        lat:25.0635, lng:55.2498 },
    { id:'ar3-park-c',      type:'park',      name:'Central Park',     lat:25.0628, lng:55.2502 },
    { id:'ar3-park-n',      type:'park',      name:'North Garden',     lat:25.0648, lng:55.2488 },
    { id:'ar3-school',      type:'school',    name:'Ranches Primary',  lat:25.0645, lng:55.2512 },
    { id:'ar3-mosque',      type:'mosque',    name:'AR3 Mosque',       lat:25.0618, lng:55.2505 },
    { id:'ar3-play-a',      type:'playground',name:'Kids Zone A',      lat:25.0622, lng:55.2494 },
    { id:'ar3-play-b',      type:'playground',name:'Kids Zone B',      lat:25.0632, lng:55.2478 },
    { id:'ar3-club',        type:'clubhouse', name:'Club House',       lat:25.0620, lng:55.2470 },
  ],

  // The Meadows (Emaar Emirates Living) — approx 25.069°N, 55.155°E
  meadows: [
    { id:'med-pool',        type:'pool',      name:'Village Pool',     lat:25.0698, lng:55.1572 },
    { id:'med-park-a',      type:'park',      name:'Meadows Park A',   lat:25.0688, lng:55.1565 },
    { id:'med-park-b',      type:'park',      name:'Meadows Lake',     lat:25.0682, lng:55.1588 },
    { id:'med-school',      type:'school',    name:'Meadows School',   lat:25.0705, lng:55.1595 },
    { id:'med-mosque',      type:'mosque',    name:'Meadows Mosque',   lat:25.0700, lng:55.1578 },
    { id:'med-club',        type:'clubhouse', name:'Meadows Club',     lat:25.0695, lng:55.1600 },
    { id:'med-play',        type:'playground',name:'Play Area',        lat:25.0690, lng:55.1558 },
  ],

  // Mudon (Dubai Properties) — approx 25.026°N, 55.265°E
  mudon: [
    { id:'mud-pool-a',      type:'pool',      name:'Mudon Pool A',     lat:25.0268, lng:55.2672 },
    { id:'mud-pool-b',      type:'pool',      name:'Mudon Pool B',     lat:25.0245, lng:55.2640 },
    { id:'mud-park-c',      type:'park',      name:'Al Rafeef Park',   lat:25.0258, lng:55.2658 },
    { id:'mud-school',      type:'school',    name:'Mudon School',     lat:25.0278, lng:55.2690 },
    { id:'mud-mosque',      type:'mosque',    name:'Mudon Mosque',     lat:25.0262, lng:55.2678 },
    { id:'mud-club',        type:'clubhouse', name:'Mudon Clubhouse',  lat:25.0272, lng:55.2685 },
    { id:'mud-retail',      type:'retail',    name:'Mudon Retail',     lat:25.0282, lng:55.2695 },
    { id:'mud-play',        type:'playground',name:'Play Zone A',      lat:25.0252, lng:55.2650 },
  ],

  // DAMAC Hills — approx 25.037°N, 55.231°E
  damac_hills: [
    { id:'dh-golf',         type:'golf',      name:'Trump Golf Club',  lat:25.0340, lng:55.2290 },
    { id:'dh-pool',         type:'pool',      name:'Club Pool',        lat:25.0378, lng:55.2328 },
    { id:'dh-spa',          type:'spa',       name:'Wellness Spa',     lat:25.0380, lng:55.2332 },
    { id:'dh-gym',          type:'gym',       name:'Fitness Centre',   lat:25.0376, lng:55.2325 },
    { id:'dh-park',         type:'park',      name:'Central Gardens',  lat:25.0372, lng:55.2318 },
    { id:'dh-school',       type:'school',    name:'GEMS School',      lat:25.0392, lng:55.2345 },
    { id:'dh-mosque',       type:'mosque',    name:'DAMAC Hills Mosque',lat:25.0358, lng:55.2340 },
    { id:'dh-club',         type:'clubhouse', name:'The Clubhouse',    lat:25.0374, lng:55.2320 },
    { id:'dh-play',         type:'playground',name:'Kids Academy',     lat:25.0368, lng:55.2310 },
  ],

  // Generic fallback — used when community cannot be identified
  default: [
    { id:'def-pool',        type:'pool',      name:'Community Pool',   lat:25.0635, lng:55.2498 },
    { id:'def-park',        type:'park',      name:'Community Park',   lat:25.0628, lng:55.2502 },
    { id:'def-mosque',      type:'mosque',    name:'Community Mosque', lat:25.0618, lng:55.2505 },
    { id:'def-school',      type:'school',    name:'Community School', lat:25.0645, lng:55.2512 },
    { id:'def-play',        type:'playground',name:'Kids Play Area',   lat:25.0622, lng:55.2494 },
  ],
};

/**
 * Pick the best amenity set for a given location by comparing
 * the plot's centroid to each community's first amenity.
 */
export function resolveAmenities(lat: number, lng: number): AmenityDef[] {
  let best: AmenityDef[] = COMMUNITY_AMENITIES.default;
  let bestDist = Infinity;

  for (const amenities of Object.values(COMMUNITY_AMENITIES)) {
    if (!amenities.length) continue;
    const d = haversineM(lat, lng, amenities[0].lat, amenities[0].lng);
    if (d < bestDist) { bestDist = d; best = amenities; }
  }

  return best;
}

/** Convert PlotData[] to VillaPlotInput[] for engine ingestion */
export function plotsToVillaInputs(plots: PlotData[]): VillaPlotInput[] {
  return plots.map(p => ({
    id:          p.id,
    lat:         p.y,
    lng:         p.x,
    entranceDir: (p.rawAttributes?.entranceDir as CardinalDir | undefined),
    // Use rawAttributes polygon if a GIS source already attached one
    polygon:     (p.rawAttributes?.polygon as [number,number][] | undefined),
    plotType:
      p.zoning?.toLowerCase().includes('villa') ||
      p.zoning?.toLowerCase().includes('residential')
        ? 'residential'
        : undefined,
  }));
}
