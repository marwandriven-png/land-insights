// ═══════════════════════════════════════════════════════════════════════
// CONSOLIDATED LAND & FEASIBILITY FRAMEWORK (CLFF) v1.0
// Area-Specific Defaults · Market Data · Bukadra-Approved Reference Model
// ═══════════════════════════════════════════════════════════════════════

export interface CLFFAreaProfile {
  code: string;
  name: string;
  zoneType: 'RESIDENTIAL' | 'MIXED_USE' | 'INDUSTRIAL' | 'COMMERCIAL';
  subZone: string;
  marketTier: 'PREMIUM' | 'MID_HIGH' | 'MID' | 'AFFORDABLE';
  /** Default Floor Area Ratio */
  far: number;
  /** BUA multiplier */
  buaMultiplier: number;
  /** Construction PSF (AED) */
  constructionPsf: number;
  /** Sellable area % of GFA */
  sellablePct: number;
  /** Service charge range PSF */
  serviceCharge: string;
  /** Recommended unit mix */
  recommendedMix: { studio: number; br1: number; br2: number; br3: number };
  /** Key note */
  keyNote: string;
}

export interface CLFFMarketData {
  areaCode: string;
  period: string;
  salesTransactions: number;
  offPlanPct: number | null;
  studioPsfAvg: number | null;
  oneBrPsfAvg: number | null;
  twoBrPsfAvg: number | null;
  threeBrPsfAvg?: number | null;
  avgRentPsfYr: number | null;
  rentalContracts: number;
  grossYieldEst: number;
  dataSource: string;
}

// ─── Section 6: Area Profiles — Seed Data Reference ───────────────────────

export const CLFF_AREAS: Record<string, CLFFAreaProfile> = {
  MAJAN: {
    code: 'MAJAN', name: 'Majan', zoneType: 'RESIDENTIAL', subZone: 'Dubailand',
    marketTier: 'MID', far: 5.0, buaMultiplier: 1.0, constructionPsf: 420,
    sellablePct: 95, serviceCharge: 'AED 14–17',
    recommendedMix: { studio: 0.62, br1: 0.22, br2: 0.10, br3: 0.05 },
    keyNote: 'Most affordable entry; highest yield in 6-area study; strong studio investor demand',
  },
  DLRC: {
    code: 'DLRC', name: 'Dubai Land Residential Complex', zoneType: 'RESIDENTIAL', subZone: 'Dubailand',
    marketTier: 'MID_HIGH', far: 4.5, buaMultiplier: 1.45, constructionPsf: 420,
    sellablePct: 95, serviceCharge: 'AED 10–17',
    recommendedMix: { studio: 0.50, br1: 0.37, br2: 0.10, br3: 0.03 },
    keyNote: 'Volume leader; 48.2% renewal rate; easiest sales velocity',
  },
  ALSATWA: {
    code: 'ALSATWA', name: 'Al Satwa (Jumeirah Garden City)', zoneType: 'MIXED_USE', subZone: 'Jumeirah Garden City',
    marketTier: 'PREMIUM', far: 3.5, buaMultiplier: 1.0, constructionPsf: 450,
    sellablePct: 95, serviceCharge: 'AED 18–20',
    recommendedMix: { studio: 0.39, br1: 0.48, br2: 0.10, br3: 0.03 },
    keyNote: '70.4% rental renewal; 6 active competitors; JGC = 99% of Al Satwa transactions',
  },
  DSC: {
    code: 'DSC', name: 'Dubai Sports City', zoneType: 'RESIDENTIAL', subZone: 'Dubai Sports City',
    marketTier: 'MID', far: 4.5, buaMultiplier: 1.45, constructionPsf: 420,
    sellablePct: 95, serviceCharge: 'AED 12–15',
    recommendedMix: { studio: 0.35, br1: 0.35, br2: 0.25, br3: 0.05 },
    keyNote: 'Lower transaction velocity; golf/sports amenity premium; end-user + investor split',
  },
  MEYDAN: {
    code: 'MEYDAN', name: 'Meydan Horizon', zoneType: 'MIXED_USE', subZone: 'Meydan',
    marketTier: 'PREMIUM', far: 4.75, buaMultiplier: 1.0, constructionPsf: 450,
    sellablePct: 95, serviceCharge: 'AED 18–22',
    recommendedMix: { studio: 0, br1: 0.45, br2: 0.40, br3: 0.15 },
    keyNote: 'Racecourse/Canal proximity drives premium; 94.9% off-plan rate',
  },
  DIC: {
    code: 'DIC', name: 'Dubai Industrial City', zoneType: 'MIXED_USE', subZone: 'Dubai Industrial City',
    marketTier: 'MID', far: 4.5, buaMultiplier: 1.6, constructionPsf: 420,
    sellablePct: 95, serviceCharge: 'AED 12–15',
    recommendedMix: { studio: 0.35, br1: 0.35, br2: 0.25, br3: 0.05 },
    keyNote: 'Only area with significant commercial/office rental income; corporate tenant demand',
  },
};

// ─── Canonical Area Alias Map ─────────────────────────────────────────────────
// Maps any raw input name (DLD official names, acronyms, shorthand) → CLFF code
// Usage: normalizeAreaCode(input) → 'DIC' | 'DLRC' | 'ALSATWA' | ... | null
export const AREA_ALIAS_MAP: Record<string, string> = {
  // DIC – Dubai Industrial City
  'dubai industrial city': 'DIC',
  'dic': 'DIC',
  'saih shuaib 2': 'DIC',
  'saih shuaib2': 'DIC',

  // DLRC – Dubai Land Residential Complex
  'dlrc': 'DLRC',
  'dubai land residential complex': 'DLRC',
  'dubai land residential': 'DLRC',
  'dubailand residential complex': 'DLRC',
  'dubailand residential': 'DLRC',

  // ALSATWA – Al Satwa / Jumeirah Garden City
  'al satwa': 'ALSATWA',
  'alsatwa': 'ALSATWA',
  'jumeirah garden city': 'ALSATWA',
  'jgc': 'ALSATWA',

  // MAJAN
  'majan': 'MAJAN',
  'wadi al safa 3': 'MAJAN',
  'wadi al safa3': 'MAJAN',
  'wadi alsafa 3': 'MAJAN',

  // DSC – Dubai Sports City
  'dubai sports city': 'DSC',
  'dsc': 'DSC',
  'sports city': 'DSC',

  // MEYDAN
  'meydan': 'MEYDAN',
  'meydan horizon': 'MEYDAN',
};

/**
 * Normalize any raw area name (case-insensitive) to its CLFF area code.
 * Returns the CLFF code string (e.g. 'DIC', 'DLRC') or null if not matched.
 * This is the SINGLE SOURCE OF TRUTH for area name resolution.
 */
export function normalizeAreaCode(input: string): string | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  return AREA_ALIAS_MAP[key] ?? null;
}

// ─── Market Data Seed (Feb 2026) ──────────────────────────────────────────

export const CLFF_MARKET_DATA: Record<string, CLFFMarketData> = {
  MAJAN: {
    areaCode: 'MAJAN', period: 'FEB_2026',
    salesTransactions: 2559, offPlanPct: 85.0,
    studioPsfAvg: 1200, oneBrPsfAvg: 1315, twoBrPsfAvg: 1263, threeBrPsfAvg: null,
    avgRentPsfYr: 65, rentalContracts: 2890, grossYieldEst: 6.8,
    dataSource: 'DLD + Reelly',
  },
  DLRC: {
    areaCode: 'DLRC', period: 'FEB_2026',
    salesTransactions: 2018, offPlanPct: 87.5,
    studioPsfAvg: 1560, oneBrPsfAvg: 1248, twoBrPsfAvg: 1130, threeBrPsfAvg: null,
    avgRentPsfYr: 66, rentalContracts: 3200, grossYieldEst: 5.8,
    dataSource: 'DLD + Ejari',
  },
  ALSATWA: {
    areaCode: 'ALSATWA', period: 'FEB_2026',
    salesTransactions: 327, offPlanPct: 92.0,
    studioPsfAvg: 2408, oneBrPsfAvg: 2151, twoBrPsfAvg: 2073, threeBrPsfAvg: null,
    avgRentPsfYr: 106, rentalContracts: 3307, grossYieldEst: 5.1,
    dataSource: 'DLD + Reelly',
  },
  DSC: {
    areaCode: 'DSC', period: 'FEB_2026',
    salesTransactions: 25, offPlanPct: null,
    studioPsfAvg: 1227, oneBrPsfAvg: 1200, twoBrPsfAvg: 1095, threeBrPsfAvg: null,
    avgRentPsfYr: 84, rentalContracts: 800, grossYieldEst: 6.2,
    dataSource: 'DLD',
  },
  MEYDAN: {
    areaCode: 'MEYDAN', period: 'FEB_2026',
    salesTransactions: 742, offPlanPct: 94.9,
    studioPsfAvg: null, oneBrPsfAvg: 2250, twoBrPsfAvg: 2148, threeBrPsfAvg: null,
    avgRentPsfYr: null, rentalContracts: 600, grossYieldEst: 4.8,
    dataSource: 'DLD + Reelly',
  },
  DIC: {
    areaCode: 'DIC', period: 'FEB_2026',
    salesTransactions: 285, offPlanPct: 94.7,
    studioPsfAvg: 1498, oneBrPsfAvg: 1521, twoBrPsfAvg: 1366, threeBrPsfAvg: null,
    avgRentPsfYr: 79, rentalContracts: 2034, grossYieldEst: 6.5,
    dataSource: 'DLD + Ejari',
  },
};

// ─── Cost Categories (Bukadra Reference Model) ───────────────────────────

export const CLFF_COST_CATEGORIES = [
  { code: 'LAND', name: 'Land Acquisition Cost', basis: 'PSF_GFA', defaultRate: null },
  { code: 'CONSTRUCTION', name: 'Construction Cost', basis: 'PSF_BUA', defaultRate: 420 },
  { code: 'AUTHORITY', name: 'Authority / DLD Fees', basis: 'PCT_LAND', defaultRate: 4.0 },
  { code: 'CONSULTANT', name: 'Consultant & Design Fees', basis: 'PCT_CONSTRUCTION', defaultRate: 3.0 },
  { code: 'CONTINGENCY', name: 'Contingency Reserve', basis: 'PCT_CONSTRUCTION', defaultRate: 5.0 },
  { code: 'MARKETING', name: 'Sales & Marketing', basis: 'PCT_GDV', defaultRate: 2.0 },
  { code: 'FINANCE', name: 'Finance / Interest Cost', basis: 'PCT_GDV', defaultRate: 3.0 },
] as const;

// ─── Bukadra Canonical Formulas (Section 1.1) ─────────────────────────────
// GFA = Plot Area × FAR
// Sellable Area = 95% × GFA
// GDV = Sellable Area × Blended Avg PSF
// Blended Avg PSF = Σ(Unit Count × Avg Price) ÷ Σ(Unit Count × Avg Size)
// Total Land Cost = Land PSF × GFA
// Construction Cost = Construction PSF × Total BUA
// BUA = GFA × BUA Multiplier
// Net Margin = (GDV − Total Costs) ÷ GDV × 100
// Gross Yield = Annual Rental Income ÷ Purchase Price × 100
// Marketing = 2% × GDV
// Finance = 3% × GDV

/**
 * Match a plot location string to a CLFF area code.
 * Returns the area profile + market data if found.
 */
export function matchCLFFArea(location: string): { area: CLFFAreaProfile; market: CLFFMarketData } | null {
  if (!location) return null;

  // 1. Try exact alias map first (catches DLD official names & acronyms)
  const normalizedCode = normalizeAreaCode(location);
  if (normalizedCode && CLFF_AREAS[normalizedCode]) {
    return { area: CLFF_AREAS[normalizedCode], market: CLFF_MARKET_DATA[normalizedCode] };
  }

  // 2. Substring keyword scan as secondary fallback
  const loc = location.toLowerCase();
  const matchers: [string[], string][] = [
    [['majan', 'wadi al safa'], 'MAJAN'],
    [['dlrc', 'dubai land residential', 'dubailand residential'], 'DLRC'],
    [['al satwa', 'satwa', 'jgc', 'jumeirah garden'], 'ALSATWA'],
    [['sports city', 'dsc'], 'DSC'],
    [['meydan'], 'MEYDAN'],
    [['industrial city', 'saih shuaib', 'dic'], 'DIC'],
  ];

  for (const [keywords, code] of matchers) {
    if (keywords.some(k => loc.includes(k))) {
      return { area: CLFF_AREAS[code], market: CLFF_MARKET_DATA[code] };
    }
  }
  return null;
}

/**
 * Find the nearest anchor area when exact CLFF match is not available.
 * Uses market tier similarity and zone type matching.
 * Returns the best-fit CLFF area as a fallback.
 */
export function findAnchorArea(location: string): { area: CLFFAreaProfile; market: CLFFMarketData; confidence: number } | null {
  if (!location) return null;

  // First try exact match
  const exact = matchCLFFArea(location);
  if (exact) return { ...exact, confidence: 1.0 };

  // Check uploaded area research files for any consolidated matches
  try {
    const stored = localStorage.getItem('hyperplot_area_research_files');
    if (stored) {
      const files = JSON.parse(stored) as Array<{ areaName: string; aiParsed?: boolean; marketData?: Record<string, unknown> }>;
      const loc = location.toLowerCase();
      const match = files.find(f => {
        if (!f.aiParsed || !f.marketData) return false;
        const area = f.areaName.toLowerCase();
        return loc.includes(area) || area.includes(loc);
      });
      if (match) return null; // AI upload exists, let that take priority
    }
  } catch { }

  // Heuristic: Pick closest anchor area by keywords and zone type
  const loc = location.toLowerCase();

  // Proximity/context keywords map to anchor areas
  const contextMatchers: [string[], string, number][] = [
    // Dubai central areas → Al Satwa (premium, mixed-use)
    [['downtown', 'business bay', 'difc', 'burj', 'sheikh zayed', 'bur dubai', 'deira', 'creek', 'jumeirah', 'marina', 'palm', 'jlt', 'jbr', 'tecom', 'barsha'], 'ALSATWA', 0.7],
    // Sports/leisure areas → DSC
    [['motor city', 'falcon city', 'global village', 'studio city', 'arjan'], 'DSC', 0.65],
    // Dubailand corridor → Majan or DLRC
    [['dubailand', 'liwan', 'wadi al safa', 'villanova', 'remraam', 'al barari'], 'MAJAN', 0.6],
    // Southern/industrial corridor → DIC
    [['south', 'jafza', 'dip', 'techno', 'impz', 'al quoz'], 'DIC', 0.6],
    // Premium new corridors → Meydan
    [['mbr city', 'ras al khor', 'nad al sheba', 'al khail', 'sobha'], 'MEYDAN', 0.65],
    // Outer residential → DLRC
    [['silicon oasis', 'academic city', 'international city', 'warsan', 'muhaisnah'], 'DLRC', 0.55],
  ];

  for (const [keywords, code, confidence] of contextMatchers) {
    if (keywords.some(k => loc.includes(k))) {
      return { area: CLFF_AREAS[code], market: CLFF_MARKET_DATA[code], confidence };
    }
  }

  // Ultimate fallback: Use DLRC as the most balanced mid-market anchor
  return { area: CLFF_AREAS['DLRC'], market: CLFF_MARKET_DATA['DLRC'], confidence: 0.4 };
}

/**
 * Get CLFF market overrides for use in calcDSCFeasibility.
 */
export function getCLFFOverrides(areaCode: string): Record<string, unknown> {
  const area = CLFF_AREAS[areaCode];
  const market = CLFF_MARKET_DATA[areaCode];
  if (!area || !market) return {};

  return {
    constructionPsf: area.constructionPsf,
    buaMultiplier: area.buaMultiplier,
    efficiency: area.sellablePct / 100,
    unitPsf: {
      studio: market.studioPsfAvg || 0,
      br1: market.oneBrPsfAvg || 0,
      br2: market.twoBrPsfAvg || 0,
      br3: market.threeBrPsfAvg || 0,
    },
    unitRents: {
      studio: market.avgRentPsfYr || 0,
      br1: market.avgRentPsfYr || 0,
      br2: market.avgRentPsfYr ? market.avgRentPsfYr * 0.95 : 0,
      br3: market.avgRentPsfYr ? market.avgRentPsfYr * 0.88 : 0,
    },
  };
}
