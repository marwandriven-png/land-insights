/**
 * HyperPlot AI — Cross-Area Master Market Data
 * Single source of truth for Decision Confidence module.
 *
 * Source: Cross-Area Master Market Comparison Report
 * Study Period: 26 Nov 2025 – 26 Feb 2026 (unless noted per area)
 * Note: Dubai Residence Complex is designated DLRC throughout.
 *
 * DO NOT edit individual area files; update this file only.
 * Feasibility Calculator reads from FEASIBILITY_DEFAULTS — do not modify those keys.
 */

// ─────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────

export type MarketTier = "PREMIUM" | "MID-PREMIUM" | "MID-HIGH" | "MID" | "AFFORDABLE";
export type AreaCode = "AL_SATWA" | "MEYDAN_HORIZON" | "DLRC" | "DSC" | "DIC" | "BUKADRA" | "MAJAN";
export type UnitType = "studio" | "1br" | "2br" | "3br" | "4br";
export type ViabilityRating = "★" | "✓" | "~" | "✗";

export interface PSFRange {
  min: number;
  max: number;
  avg: number;
  median?: number;
}

export interface UnitSalesData {
  transactions: number;
  oqoodCount?: number;
  oqoodPct?: number;
  titleDeedCount?: number;
  titleDeedPct?: number;
  avgPrice?: number;
  medianPrice?: number;
  avgPSF: number;
  medianPSF?: number;
  avgSizeSqft?: number;
  psfRange?: PSFRange;
}

export interface UnitRentalData {
  contracts: number;
  newLeases?: number;
  renewals?: number;
  avgAnnualRent?: number;
  medianAnnualRent?: number;
  avgPSFPerYear: number;
  medianPSFPerYear?: number;
  avgSizeSqft?: number;
  grossYield: number;
  medianYield?: number;
  yieldAssessment?: string;
}

export interface UnitMixTemplateEntry {
  unitType: UnitType;
  rangeMin: number;
  rangeMax: number;
  recommended: number;
  rationale: string;
  viability: ViabilityRating;
}

export interface UnitMixTemplate {
  name: string;
  description: string;
  units: UnitMixTemplateEntry[];
}

export interface CompetitorProject {
  name: string;
  developer: string;
  dldNumber?: number | string;
  totalUnits: number;
  plotSqm?: number;
  floors?: string;
  completion?: string;
  priceFrom?: number;
  studioUnits?: number;
  studioPct?: number;
  oneBRUnits?: number;
  oneBRPct?: number;
  twoBRUnits?: number;
  twoBRPct?: number;
  threeBRUnits?: number;
  threeBRPct?: number;
  fourBRUnits?: number;
  fourBRPct?: number;
  studioMixStrategy?: string;
  studioPSFRange?: PSFRange;
  oneBRPSFRange?: PSFRange;
  twoBRPSFRange?: PSFRange;
  threeBRPSFRange?: PSFRange;
  fourBRPSFRange?: PSFRange;
  serviceChargePerSqft?: { min: number; max: number };
  paymentPlan?: string;
  postHandover?: string;
  notes?: string;
}

export interface DevelopmentFramework {
  marketTier: MarketTier;
  farDefault: number | string;
  buaMultiplier?: number;
  constructionPSF: number;
  serviceChargeRange: { min: number; max: number };
  serviceChargeBudget: number;
  grossYieldRange: { min: number; max: number };
  rentalRenewalRate?: number;
  keyAdvantage?: string;
  keyRisk?: string;
  notes?: string;
}

export interface MasterSummary {
  salesTransactions: string;
  offPlanPct: string;
  studioPSF?: number;
  oneBRPSF?: string;
  twoBRPSF?: number;
  avgRentPSF?: string;
  grossYieldRange: string;
  rentalContracts?: number;
  renewalRate?: string;
  farDefault: string;
  constructionPSF?: number;
  keyDifferentiator?: string;
}

export interface AreaMarketData {
  areaCode: AreaCode;
  displayName: string;
  subLocation?: string;
  marketTier: MarketTier;
  studyPeriod: string;
  masterSummary: MasterSummary;
  salesByUnit: Partial<Record<UnitType, UnitSalesData>>;
  rentalByUnit: Partial<Record<UnitType, UnitRentalData>>;
  competitors: CompetitorProject[];
  unitMixTemplates: UnitMixTemplate[];
  developmentFramework: DevelopmentFramework;
}

// ─────────────────────────────────────────────────────────────────────
// 1. MAJAN
// ─────────────────────────────────────────────────────────────────────

const majanData: AreaMarketData = {
  areaCode: "MAJAN",
  displayName: "Majan",
  subLocation: "Dubailand",
  marketTier: "AFFORDABLE",
  studyPeriod: "26 Nov 2025 – 26 Feb 2026",
  masterSummary: {
    salesTransactions: "~2,559 (DLD verified: 2,465)",
    offPlanPct: "85–91.2%",
    studioPSF: 880,
    oneBRPSF: "1,256–1,767",
    twoBRPSF: 1260,
    avgRentPSF: "65–75 (DLD verified avg: 79)",
    grossYieldRange: "6.5–7.2%",
    rentalContracts: 1444,
    renewalRate: "34.4%",
    farDefault: "5.0",
    constructionPSF: 420,
    keyDifferentiator: "Highest yield; lowest entry price; studio-dominant investor market",
  },
  salesByUnit: {
    studio: { transactions: 1553, oqoodCount: 1505, oqoodPct: 96.9, titleDeedCount: 48, titleDeedPct: 3.1, avgPrice: 699854, medianPrice: 700999, avgPSF: 1812, medianPSF: 1867, avgSizeSqft: 391, psfRange: { min: 850, max: 2278, avg: 1812, median: 1867 } },
    "1br": { transactions: 675, oqoodCount: 563, oqoodPct: 83.4, titleDeedCount: 112, titleDeedPct: 16.6, avgPrice: 1067855, medianPrice: 1115999, avgPSF: 1322, medianPSF: 1356, avgSizeSqft: 819, psfRange: { min: 711, max: 1952, avg: 1322, median: 1356 } },
    "2br": { transactions: 203, oqoodCount: 150, oqoodPct: 73.9, titleDeedCount: 53, titleDeedPct: 26.1, avgPrice: 1464678, medianPrice: 1540000, avgPSF: 1147, medianPSF: 1219, avgSizeSqft: 1291, psfRange: { min: 665, max: 1681, avg: 1147, median: 1219 } },
    "3br": { transactions: 30, oqoodCount: 25, oqoodPct: 83.3, titleDeedCount: 5, titleDeedPct: 16.7, avgPrice: 2150907, medianPrice: 2122452, avgPSF: 1125, medianPSF: 1148, avgSizeSqft: 1916, psfRange: { min: 735, max: 1425, avg: 1125, median: 1148 } },
    "4br": { transactions: 4, oqoodCount: 4, oqoodPct: 100, titleDeedCount: 0, titleDeedPct: 0, avgPrice: 2614125, medianPrice: 2766600, avgPSF: 1264, medianPSF: 1368, avgSizeSqft: 2075 },
  },
  rentalByUnit: {
    studio: { contracts: 213, newLeases: 157, renewals: 98, avgAnnualRent: 58455, medianAnnualRent: 50000, avgPSFPerYear: 95.8, medianPSFPerYear: 91, avgSizeSqft: 620, grossYield: 0.0835, medianYield: 0.0714, yieldAssessment: "EXCEPTIONAL — highest in 6-area study" },
    "1br": { contracts: 758, newLeases: 447, renewals: 292, avgAnnualRent: 62992, medianAnnualRent: 67000, avgPSFPerYear: 77.3, medianPSFPerYear: 75, grossYield: 0.059, medianYield: 0.0601, yieldAssessment: "STRONG — investor grade" },
    "2br": { contracts: 439, newLeases: 215, renewals: 105, avgAnnualRent: 86890, medianAnnualRent: 85000, avgPSFPerYear: 67.8, medianPSFPerYear: 65, avgSizeSqft: 1297, grossYield: 0.0593, medianYield: 0.0552, yieldAssessment: "VIABLE — solid yield profile" },
    "3br": { contracts: 33, newLeases: 11, renewals: 2, avgAnnualRent: 127768, medianAnnualRent: 120000, avgPSFPerYear: 73.3, medianPSFPerYear: 73, avgSizeSqft: 1744, grossYield: 0.0594, medianYield: 0.0565, yieldAssessment: "VIABLE — limited supply" },
  },
  competitors: [
    { name: "Samana Barari Heights", developer: "Samana International", dldNumber: 3871, totalUnits: 737, plotSqm: 46716.17, floors: "4B+G+2P+27F", completion: "Q3 2028", priceFrom: 965555, studioUnits: 427, studioPct: 62, oneBRUnits: 150, oneBRPct: 22, twoBRUnits: 68, twoBRPct: 9, threeBRUnits: 8, threeBRPct: 1, studioMixStrategy: "Studio-heavy affordable" },
    { name: "Rabdan Gates", developer: "Rabdan Developments", dldNumber: 3587, totalUnits: 445, plotSqm: 27813.05, floors: "3B+G+3P+22F", completion: "Q2 2028", priceFrom: 1086919, studioUnits: 248, studioPct: 57, oneBRUnits: 125, oneBRPct: 29, twoBRUnits: 61, twoBRPct: 14, threeBRUnits: 3, threeBRPct: 1, studioMixStrategy: "Studio-heavy affordable", studioPSFRange: { min: 880, max: 1000, avg: 940 }, oneBRPSFRange: { min: 1256, max: 1294, avg: 1275 }, twoBRPSFRange: { min: 1260, max: 1310, avg: 1285 }, serviceChargePerSqft: { min: 15, max: 15 }, paymentPlan: "10/50/40%", postHandover: "None" },
    { name: "Divine Al Barari", developer: "Takmeel Real Estate", dldNumber: 3759, totalUnits: 291, plotSqm: 23955.78, floors: "G+2P+17F+R", completion: "Q2 2028", priceFrom: 767600, studioUnits: 104, studioPct: 36, oneBRUnits: 116, oneBRPct: 40, twoBRUnits: 61, twoBRPct: 21, threeBRUnits: 10, threeBRPct: 3 },
    { name: "Barari Palace", developer: "Ary & Maz Developments", dldNumber: 4164, totalUnits: 225, plotSqm: 20531.21, floors: "G+2P+13F+R", completion: "Q4 2028", priceFrom: 847371, studioUnits: 58, studioPct: 26, oneBRUnits: 99, oneBRPct: 45, twoBRUnits: 59, twoBRPct: 27, threeBRUnits: 5, threeBRPct: 2, studioPSFRange: { min: 1754, max: 2266, avg: 2010 }, oneBRPSFRange: { min: 1489, max: 1767, avg: 1628 }, twoBRPSFRange: { min: 1504, max: 1650, avg: 1577 }, threeBRPSFRange: { min: 1400, max: 1400, avg: 1400 }, serviceChargePerSqft: { min: 14, max: 14 }, paymentPlan: "15/44/1/40% post-handover", postHandover: "40% over post-handover period" },
  ],
  unitMixTemplates: [
    { name: "Investor-Focused: Studio-Heavy", description: "Samana Barari-style maximum yield play", units: [
      { unitType: "studio", rangeMin: 55, rangeMax: 65, recommended: 62, rationale: "Highest yield ~6.8–8.35%; lowest entry price; max investor affordability", viability: "★" },
      { unitType: "1br", rangeMin: 20, rangeMax: 30, recommended: 22, rationale: "Secondary yield driver; rental demand from DU/Media City workers", viability: "✓" },
      { unitType: "2br", rangeMin: 5, rangeMax: 15, recommended: 10, rationale: "Broader appeal; limited to 10–15% to preserve yields", viability: "~" },
      { unitType: "3br", rangeMin: 0, rangeMax: 8, recommended: 5, rationale: "Optional; ultra-luxury tier", viability: "~" },
    ]},
    { name: "Balanced Mix", description: "Rabdan Gates / Divine Al Barari style", units: [
      { unitType: "studio", rangeMin: 35, rangeMax: 50, recommended: 46, rationale: "Strong yield base; affordable entry point for investors", viability: "✓" },
      { unitType: "1br", rangeMin: 28, rangeMax: 40, recommended: 36, rationale: "Core demand driver; 1BR most sought-after rental in Dubailand", viability: "★" },
      { unitType: "2br", rangeMin: 14, rangeMax: 22, recommended: 16, rationale: "Family segment; Divine Al Barari at 21% confirms demand", viability: "✓" },
      { unitType: "3br", rangeMin: 0, rangeMax: 5, recommended: 2, rationale: "Minimal; only if plot size justifies larger units", viability: "~" },
    ]},
    { name: "End-User / Family Mix", description: "Barari Palace style", units: [
      { unitType: "studio", rangeMin: 20, rangeMax: 30, recommended: 26, rationale: "Investor anchor; keep below 30% for family positioning", viability: "~" },
      { unitType: "1br", rangeMin: 40, rangeMax: 50, recommended: 45, rationale: "Core product; Barari Palace 45% confirms end-user 1BR demand", viability: "★" },
      { unitType: "2br", rangeMin: 22, rangeMax: 30, recommended: 27, rationale: "Family priority; Al Barari adjacency attracts 2BR tenants", viability: "✓" },
      { unitType: "3br", rangeMin: 2, rangeMax: 5, recommended: 2, rationale: "Premium tier; higher margin, longer sell cycle", viability: "~" },
    ]},
  ],
  developmentFramework: {
    marketTier: "AFFORDABLE",
    farDefault: 5.0,
    buaMultiplier: 1.0,
    constructionPSF: 420,
    serviceChargeRange: { min: 14, max: 17 },
    serviceChargeBudget: 15,
    grossYieldRange: { min: 0.065, max: 0.072 },
    rentalRenewalRate: 0.344,
    keyAdvantage: "Highest yield; lowest entry price; studio-dominant investor market",
    keyRisk: "Low entry barrier may attract oversupply; maintain differentiation",
  },
};

// ─────────────────────────────────────────────────────────────────────
// 2. DLRC
// ─────────────────────────────────────────────────────────────────────

const dlrcData: AreaMarketData = {
  areaCode: "DLRC",
  displayName: "DLRC",
  subLocation: "Dubai Land Residential Complex",
  marketTier: "MID-HIGH",
  studyPeriod: "26 Nov 2025 – 26 Feb 2026",
  masterSummary: {
    salesTransactions: "2,018",
    offPlanPct: "87.5%",
    studioPSF: 1560,
    oneBRPSF: "1,248",
    twoBRPSF: 1130,
    avgRentPSF: "66",
    grossYieldRange: "5.3–6.3%",
    rentalContracts: 2360,
    renewalRate: "48.2% ★ (highest in study)",
    farDefault: "4.5",
    constructionPSF: 420,
    keyDifferentiator: "Volume leader; highest resale share (12.5%); lowest vacancy risk",
  },
  salesByUnit: {
    studio: { transactions: 928, avgPrice: 669697, medianPrice: 696856, avgPSF: 1560, avgSizeSqft: 450 },
    "1br": { transactions: 751, avgPrice: 995959, medianPrice: 1022583, avgPSF: 1248, avgSizeSqft: 810 },
    "2br": { transactions: 203, avgPrice: 1300000, avgPSF: 1130, avgSizeSqft: 1150 },
    "3br": { transactions: 78, avgPrice: 1800000, avgPSF: 1100, avgSizeSqft: 1636 },
  },
  rentalByUnit: {
    studio: { contracts: 558, avgAnnualRent: 42351, medianAnnualRent: 41000, avgPSFPerYear: 94, grossYield: 0.0632, yieldAssessment: "STRONG — second highest in study after Majan" },
    "1br": { contracts: 1088, avgAnnualRent: 53572, medianAnnualRent: 53000, avgPSFPerYear: 66, grossYield: 0.0538, yieldAssessment: "STRONG — investor grade" },
    "2br": { contracts: 636, avgAnnualRent: 73039, avgPSFPerYear: 60, grossYield: 0.0526, yieldAssessment: "VIABLE" },
    "3br": { contracts: 78, avgAnnualRent: 99190, avgPSFPerYear: 68, grossYield: 0.0573, yieldAssessment: "VIABLE" },
  },
  competitors: [
    { name: "Bond Living", developer: "Pearlshire DLRC", dldNumber: 4073, totalUnits: 94, plotSqm: 9827.38, floors: "B+G+11F+R", completion: "Q4 2027", priceFrom: 1434777, studioUnits: 11, studioPct: 12, oneBRUnits: 19, oneBRPct: 20, twoBRUnits: 32, twoBRPct: 34, threeBRUnits: 32, threeBRPct: 34, studioMixStrategy: "Family / 3BR-heavy boutique", oneBRPSFRange: { min: 1729, max: 1917, avg: 1823 }, twoBRPSFRange: { min: 1440, max: 1483, avg: 1462 }, threeBRPSFRange: { min: 1449, max: 1485, avg: 1467 }, serviceChargePerSqft: { min: 12, max: 15 }, paymentPlan: "50/50", postHandover: "None" },
    { name: "Marquis Vista", developer: "Marquis Home", dldNumber: 3632, totalUnits: 129, plotSqm: 9278.59, floors: "G+10F+R", completion: "Q4 2027", priceFrom: 782328, studioUnits: 48, studioPct: 37, oneBRUnits: 60, oneBRPct: 47, twoBRUnits: 21, twoBRPct: 16, studioMixStrategy: "Studio+1BR balanced", oneBRPSFRange: { min: 1719, max: 1744, avg: 1732 }, twoBRPSFRange: { min: 1246, max: 1308, avg: 1277 } },
    { name: "Weybridge Gardens 4", developer: "Leos Developments", dldNumber: 3564, totalUnits: 361, plotSqm: 26847.28, floors: "G+3P+17F+R", completion: "Q1 2027", priceFrom: 805264, studioUnits: 124, studioPct: 34, oneBRUnits: 186, oneBRPct: 52, twoBRUnits: 45, twoBRPct: 12, threeBRUnits: 3, threeBRPct: 1, fourBRUnits: 3, fourBRPct: 1, studioMixStrategy: "1BR-dominant", studioPSFRange: { min: 1473, max: 1473, avg: 1473 }, twoBRPSFRange: { min: 1252, max: 1329, avg: 1291 }, serviceChargePerSqft: { min: 10, max: 14 }, paymentPlan: "20/30/50", postHandover: "None" },
    { name: "Floarea Oasis", developer: "Mashriq Elite", dldNumber: 3603, totalUnits: 257, plotSqm: 16008.9, floors: "G+13F", completion: "Q1 2028", priceFrom: 759000, studioUnits: 129, studioPct: 50, oneBRUnits: 102, oneBRPct: 40, twoBRUnits: 26, twoBRPct: 10, studioMixStrategy: "Studio-heavy investor", studioPSFRange: { min: 1681, max: 1929, avg: 1805 }, twoBRPSFRange: { min: 1165, max: 1449, avg: 1307 } },
    { name: "Samana Blvd Heights", developer: "Samana International", dldNumber: 3205, totalUnits: 541, plotSqm: 31839.95, completion: "Q4 2028", priceFrom: 800000, studioUnits: 289, studioPct: 53, oneBRUnits: 218, oneBRPct: 40, twoBRUnits: 34, twoBRPct: 6, studioMixStrategy: "Studio-heavy investor", studioPSFRange: { min: 1400, max: 1600, avg: 1500 }, oneBRPSFRange: { min: 1200, max: 1350, avg: 1275 }, twoBRPSFRange: { min: 1100, max: 1200, avg: 1150 }, serviceChargePerSqft: { min: 12, max: 15 }, paymentPlan: "65/35 post-handover (35% over 36 months)", postHandover: "35% over 36 months" },
  ],
  unitMixTemplates: [
    { name: "Investor-Focused: Studio-Heavy", description: "Samana/Floarea style — maximise yield and sales velocity", units: [
      { unitType: "studio", rangeMin: 45, rangeMax: 55, recommended: 53, rationale: "Highest yield (6.32%); fastest investor sales", viability: "★" },
      { unitType: "1br", rangeMin: 30, rangeMax: 40, recommended: 37, rationale: "Volume driver; 1,088 rental contracts confirm demand", viability: "✓" },
      { unitType: "2br", rangeMin: 5, rangeMax: 15, recommended: 10, rationale: "Lower yield (5.26%); include for completeness", viability: "~" },
      { unitType: "3br", rangeMin: 0, rangeMax: 5, recommended: 0, rationale: "Avoid; low velocity in DLRC investor market", viability: "✗" },
    ]},
    { name: "Balanced Mix (DLRC Market Standard)", description: "Proven Weybridge/Marquis configuration", units: [
      { unitType: "studio", rangeMin: 30, rangeMax: 35, recommended: 34, rationale: "Strong investor appetite; proven at Weybridge/Marquis", viability: "✓" },
      { unitType: "1br", rangeMin: 45, rangeMax: 55, recommended: 50, rationale: "Core DLRC driver; highest volume rental type", viability: "★" },
      { unitType: "2br", rangeMin: 10, rangeMax: 18, recommended: 14, rationale: "End-user demand; 636 rental contracts confirm need", viability: "✓" },
      { unitType: "3br", rangeMin: 0, rangeMax: 5, recommended: 2, rationale: "Limited; only if targeting family/end-user segment", viability: "~" },
    ]},
    { name: "Family / Premium Mix", description: "Bond Living boutique style", units: [
      { unitType: "studio", rangeMin: 10, rangeMax: 15, recommended: 12, rationale: "Minimal; boutique positioning requires restraint", viability: "~" },
      { unitType: "1br", rangeMin: 15, rangeMax: 25, recommended: 20, rationale: "Supporting mix for broad appeal", viability: "~" },
      { unitType: "2br", rangeMin: 30, rangeMax: 40, recommended: 34, rationale: "Family primary driver; larger sizes, higher margins", viability: "✓" },
      { unitType: "3br", rangeMin: 30, rangeMax: 40, recommended: 34, rationale: "Premium segment; Bond Living unique DLRC positioning", viability: "★" },
    ]},
  ],
  developmentFramework: {
    marketTier: "MID-HIGH",
    farDefault: 4.5,
    buaMultiplier: 1.45,
    constructionPSF: 420,
    serviceChargeRange: { min: 10, max: 17 },
    serviceChargeBudget: 14,
    grossYieldRange: { min: 0.053, max: 0.063 },
    rentalRenewalRate: 0.482,
    keyAdvantage: "Volume leader (2,018 txns); highest renewal rate (48.2%); easiest exit market",
    keyRisk: "Land cost high relative to exit pricing; margin sensitivity. Ensure AED 1,300+ PSF exit.",
    notes: "Correct area code: DLRC (not DRC). Resale share 12.5% — unique in study.",
  },
};

// ─────────────────────────────────────────────────────────────────────
// 3. AL SATWA (Jumeirah Garden City)
// ─────────────────────────────────────────────────────────────────────

const alSatwaData: AreaMarketData = {
  areaCode: "AL_SATWA",
  displayName: "Al Satwa",
  subLocation: "Jumeirah Garden City (99% of transactions)",
  marketTier: "PREMIUM",
  studyPeriod: "Nov 2025 – Feb 2026",
  masterSummary: {
    salesTransactions: "327–341",
    offPlanPct: "92–96.5%",
    studioPSF: 2408,
    oneBRPSF: "2,151–2,179",
    twoBRPSF: 2073,
    avgRentPSF: "106",
    grossYieldRange: "4.5–5.1%",
    rentalContracts: 3307,
    renewalRate: "70.4% ★ (highest in study)",
    farDefault: "3.0–4.0",
    constructionPSF: 450,
    keyDifferentiator: "Highest PSF in study; JGC 99% of txns; ultra-low vacancy",
  },
  salesByUnit: {
    studio: { transactions: 128, oqoodPct: 92, avgPSF: 2408, avgPrice: 1025808, medianPrice: 1039753, medianPSF: 2416, avgSizeSqft: 426, psfRange: { min: 2000, max: 3310, avg: 2408, median: 2416 } },
    "1br": { transactions: 157, oqoodPct: 92, avgPSF: 2151, avgPrice: 1658421, medianPrice: 1581000, medianPSF: 2151, avgSizeSqft: 771, psfRange: { min: 1894, max: 3501, avg: 2151, median: 2151 } },
    "2br": { transactions: 37, avgPSF: 2073, avgPrice: 2504184, medianPrice: 1800000, avgSizeSqft: 1208, psfRange: { min: 1800, max: 2400, avg: 2073 } },
  },
  rentalByUnit: {
    studio: { contracts: 118, medianAnnualRent: 50000, avgPSFPerYear: 161, grossYield: 0.048, yieldAssessment: "STRONG — premium market yield floor" },
    "1br": { contracts: 2600, medianAnnualRent: 80000, avgPSFPerYear: 106, grossYield: 0.051, yieldAssessment: "STRONG — 70.4% renewal confirms demand" },
  },
  competitors: [
    { name: "Olivia Gardens", developer: "Segrex Development", totalUnits: 78, plotSqm: 5005, floors: "G+2P+8+R", completion: "Q1 2027", studioUnits: 23, studioPct: 29, oneBRUnits: 46, oneBRPct: 59, twoBRUnits: 9, twoBRPct: 12, studioMixStrategy: "1BR-dominant premium", oneBRPSFRange: { min: 1894, max: 1982, avg: 1938 }, twoBRPSFRange: { min: 2090, max: 2180, avg: 2135 }, serviceChargePerSqft: { min: 18, max: 18 }, paymentPlan: "50/50", postHandover: "None", notes: "1BR: AED 1,596K–1,851K" },
    { name: "EVERGR1N House 4", developer: "Object 1", totalUnits: 219, plotSqm: 10682, floors: "G+2P+8+R", completion: "Q2 2026", studioUnits: 175, studioPct: 80, studioMixStrategy: "Studio-heavy investor (80%)" },
    { name: "Mayfair Gardens", developer: "Majid Developments", totalUnits: 64, plotSqm: 4545, floors: "G+2P+8+R", completion: "Q2 2026", studioUnits: 24, studioPct: 38, oneBRUnits: 40, oneBRPct: 63, studioMixStrategy: "Pure S+1BR; 100% covered", studioPSFRange: { min: 2000, max: 2000, avg: 2000 }, oneBRPSFRange: { min: 2000, max: 2200, avg: 2100 }, paymentPlan: "10/40/50", postHandover: "None", notes: "Construction progress: 30.46%" },
    { name: "Amber by Enso", developer: "Enso Development", totalUnits: 71, plotSqm: 5251, floors: "G+2P+8+R", completion: "Q4 2026", studioUnits: 15, studioPct: 21, oneBRUnits: 54, oneBRPct: 76, twoBRUnits: 1, twoBRPct: 1, threeBRUnits: 1, threeBRPct: 1, studioMixStrategy: "1BR-heavy standard", studioPSFRange: { min: 2000, max: 2000, avg: 2000 }, oneBRPSFRange: { min: 2100, max: 2300, avg: 2200 }, paymentPlan: "Standard 50/50" },
    { name: "Chelsea Gardens", developer: "Alaia Developments", totalUnits: 59, plotSqm: 4954, floors: "G+8+R", completion: "Q1 2027", studioUnits: 10, studioPct: 18, oneBRUnits: 40, oneBRPct: 71, twoBRUnits: 6, twoBRPct: 11, studioMixStrategy: "1BR-dominant", serviceChargePerSqft: { min: 18, max: 20 }, paymentPlan: "Standard", notes: "Construction progress: 2.05%" },
    { name: "Rabdan Gardens", developer: "Rabdan Developments", totalUnits: 90, plotSqm: 5880, floors: "G+2P+8+R", completion: "Q4 2027", studioUnits: 45, studioPct: 50, oneBRUnits: 29, oneBRPct: 32, twoBRUnits: 13, twoBRPct: 14, threeBRUnits: 1, threeBRPct: 1, studioMixStrategy: "Balanced studio+1BR", serviceChargePerSqft: { min: 18, max: 20 }, paymentPlan: "Standard" },
  ],
  unitMixTemplates: [
    { name: "Premium Studio+1BR Dominant (Market Standard)", description: "92% of JGC volume; proven in 6 of 6 competitor projects", units: [
      { unitType: "studio", rangeMin: 30, rangeMax: 40, recommended: 35, rationale: "87% of txns are S+1BR at highest PSF in study", viability: "✓" },
      { unitType: "1br", rangeMin: 50, rangeMax: 60, recommended: 52, rationale: "Core JGC product; AED 1,894–2,542/sqft; 5.1% yield; 70.4% renewal", viability: "★" },
      { unitType: "2br", rangeMin: 5, rangeMax: 10, recommended: 8, rationale: "Limited demand; include for revenue diversification", viability: "~" },
      { unitType: "3br", rangeMin: 0, rangeMax: 5, recommended: 5, rationale: "Premium boutique; Olivia Gardens 2BR+ included", viability: "~" },
    ]},
    { name: "Studio-Heavy Investor Play (EVERGR1N Style)", description: "80% studio — maximum affordability + yield", units: [
      { unitType: "studio", rangeMin: 70, rangeMax: 80, recommended: 75, rationale: "EVERGR1N 80% studio — max affordability + yield", viability: "★" },
      { unitType: "1br", rangeMin: 15, rangeMax: 25, recommended: 20, rationale: "Volume secondary driver; supports investor sell-down", viability: "✓" },
      { unitType: "2br", rangeMin: 0, rangeMax: 5, recommended: 5, rationale: "Minimal; preserve studio yield positioning", viability: "~" },
      { unitType: "3br", rangeMin: 0, rangeMax: 0, recommended: 0, rationale: "Not applicable for studio-heavy play", viability: "✗" },
    ]},
  ],
  developmentFramework: {
    marketTier: "PREMIUM",
    farDefault: "3.0–4.0",
    buaMultiplier: 1.45,
    constructionPSF: 450,
    serviceChargeRange: { min: 18, max: 20 },
    serviceChargeBudget: 19,
    grossYieldRange: { min: 0.045, max: 0.051 },
    rentalRenewalRate: 0.704,
    keyAdvantage: "Highest PSF in study (AED 2,266 avg); 70.4% rental renewal (lowest vacancy risk)",
    keyRisk: "24 active developers; timing differentiation essential; first-mover window Q1–Q2 2026",
    notes: "Sub-location: Jumeirah Garden City only. FAR G+2P+8+R standard. Land cost benchmark ~AED 3,500/sqft.",
  },
};

// ─────────────────────────────────────────────────────────────────────
// 4. DUBAI SPORTS CITY
// ─────────────────────────────────────────────────────────────────────

const dscData: AreaMarketData = {
  areaCode: "DSC",
  displayName: "Dubai Sports City",
  marketTier: "MID",
  studyPeriod: "Nov 2025 – Feb 2026",
  masterSummary: {
    salesTransactions: "809",
    offPlanPct: "—",
    studioPSF: 1227,
    oneBRPSF: "1,200",
    twoBRPSF: 1095,
    avgRentPSF: "84–86",
    grossYieldRange: "5.5–6.5%",
    rentalContracts: 3191,
    farDefault: "4.0–5.0",
    constructionPSF: 420,
    keyDifferentiator: "3:1 rental-to-sales ratio; sports/lifestyle amenity premium; golf frontage",
  },
  salesByUnit: {
    studio: { transactions: 257, avgPSF: 1796, medianPSF: 1765, avgPrice: 757028, medianPrice: 740000, avgSizeSqft: 426, psfRange: { min: 1200, max: 2400, avg: 1796, median: 1765 } },
    "1br": { transactions: 292, avgPSF: 1531, medianPSF: 1511, avgPrice: 1155437, medianPrice: 1120000, avgSizeSqft: 771, psfRange: { min: 1000, max: 2100, avg: 1531, median: 1511 } },
    "2br": { transactions: 237, avgPSF: 1368, medianPSF: 1424, avgPrice: 1643427, medianPrice: 1600000, avgSizeSqft: 1208, psfRange: { min: 900, max: 1900, avg: 1368, median: 1424 } },
    "3br": { transactions: 23, avgPSF: 1449, medianPSF: 1325, avgPrice: 2390616, medianPrice: 2300000, avgSizeSqft: 1680, psfRange: { min: 1000, max: 1800, avg: 1449, median: 1325 } },
  },
  rentalByUnit: {
    studio: { contracts: 800, avgPSFPerYear: 90, grossYield: 0.06, avgAnnualRent: 38340, yieldAssessment: "STRONG — sports amenity premium" },
    "1br": { contracts: 1200, avgPSFPerYear: 86, grossYield: 0.057, avgAnnualRent: 66306, yieldAssessment: "STRONG — broad tenant demand" },
    "2br": { contracts: 900, avgPSFPerYear: 83, grossYield: 0.055, avgAnnualRent: 100264, yieldAssessment: "VIABLE — family/end-user segment" },
    "3br": { contracts: 291, avgPSFPerYear: 78, grossYield: 0.05, avgAnnualRent: 131040, yieldAssessment: "VIABLE — limited demand" },
  },
  competitors: [
    { name: "Golf Place", developer: "Prestige One", totalUnits: 198, plotSqm: 8690.4, floors: "G+P+14", completion: "Q2 2026", priceFrom: 1050000, studioUnits: 75, studioPct: 38, oneBRUnits: 87, oneBRPct: 44, twoBRUnits: 34, twoBRPct: 17, studioMixStrategy: "Balanced; 1BR-lean", serviceChargePerSqft: { min: 15, max: 15 }, paymentPlan: "20/40/40", notes: "Plot 93,590 sqft; BUA 219,173 sqft" },
    { name: "Antalya", developer: "Karma", totalUnits: 208, floors: "G+3P+19", completion: "Q2 2027", priceFrom: 699999, studioUnits: 104, studioPct: 50, oneBRUnits: 52, oneBRPct: 25, twoBRUnits: 52, twoBRPct: 25, studioMixStrategy: "Studio-heavy investor; best value entry", serviceChargePerSqft: { min: 12, max: 15 }, paymentPlan: "5/45/50", notes: "Plot 85,023 sqft; BUA 211,266 sqft" },
    { name: "Vega", developer: "Acube", totalUnits: 129, floors: "G+3P+20", completion: "Q2 2027" },
    { name: "Azizi Grand", developer: "Azizi", totalUnits: 411, floors: "14 Floors", completion: "Q4 2024", priceFrom: 1605000, studioUnits: 230, studioPct: 56, oneBRUnits: 119, oneBRPct: 29, twoBRUnits: 62, twoBRPct: 15, studioMixStrategy: "Studio-heavy investor", serviceChargePerSqft: { min: 14, max: 14 }, paymentPlan: "40/60", notes: "Plot 252,193 sqft; already delivered" },
    { name: "Hadley Heights 2", developer: "Leos", totalUnits: 230, floors: "G+3P+21", completion: "Q2 2027", priceFrom: 1200640, studioUnits: 58, studioPct: 25, oneBRUnits: 69, oneBRPct: 30, twoBRUnits: 92, twoBRPct: 40, threeBRUnits: 12, threeBRPct: 5, studioMixStrategy: "2BR-dominant family" },
    { name: "Fairway Residences", developer: "Prescott", totalUnits: 156, floors: "G+P+14+R", completion: "Q3 2026", priceFrom: 1200000, studioUnits: 42, studioPct: 27, oneBRUnits: 42, oneBRPct: 27, twoBRUnits: 66, twoBRPct: 42, threeBRUnits: 6, threeBRPct: 4, studioMixStrategy: "2BR-dominant family", serviceChargePerSqft: { min: 14, max: 14 }, paymentPlan: "20/20/60", notes: "Plot 158,269 sqft" },
  ],
  unitMixTemplates: [
    { name: "Investor-Focused (High Rental Yield)", description: "Studio-dominant; maximise 3:1 rental demand", units: [
      { unitType: "studio", rangeMin: 50, rangeMax: 55, recommended: 50, rationale: "Highest rental yield; strong absorption vs 3,191 rental contracts", viability: "✓" },
      { unitType: "1br", rangeMin: 25, rangeMax: 30, recommended: 30, rationale: "Fast sales velocity", viability: "✓" },
      { unitType: "2br", rangeMin: 15, rangeMax: 20, recommended: 15, rationale: "Balanced demand", viability: "✓" },
      { unitType: "3br", rangeMin: 0, rangeMax: 5, recommended: 5, rationale: "Limited demand; include for margin", viability: "~" },
    ]},
    { name: "Balanced Mix (DSC Market Standard)", description: "Broad investor and end-user appeal", units: [
      { unitType: "studio", rangeMin: 30, rangeMax: 35, recommended: 35, rationale: "Appeals to investors", viability: "✓" },
      { unitType: "1br", rangeMin: 30, rangeMax: 35, recommended: 35, rationale: "Broad market appeal", viability: "★" },
      { unitType: "2br", rangeMin: 25, rangeMax: 30, recommended: 25, rationale: "End-user demand", viability: "✓" },
      { unitType: "3br", rangeMin: 5, rangeMax: 10, recommended: 5, rationale: "Family segment", viability: "~" },
    ]},
  ],
  developmentFramework: {
    marketTier: "MID",
    farDefault: "4.0–5.0",
    buaMultiplier: 1.45,
    constructionPSF: 420,
    serviceChargeRange: { min: 12, max: 15 },
    serviceChargeBudget: 14,
    grossYieldRange: { min: 0.055, max: 0.065 },
    keyAdvantage: "Sports/lifestyle amenity premium; golf frontage; 3:1 rental-to-sales ratio",
    keyRisk: "Mid-market pricing cap; margin compression at high land values",
    notes: "BUA formula: GFA × Plot Ratio (4.0–5.0) × 1.45. Payment plans: 20/40/40 std; 5/45/50 extended; 40/60 premium.",
  },
};

// ─────────────────────────────────────────────────────────────────────
// 5. DUBAI INDUSTRIAL CITY
// ─────────────────────────────────────────────────────────────────────

const dicData: AreaMarketData = {
  areaCode: "DIC",
  displayName: "Dubai Industrial City",
  subLocation: "Saih Shuaib 2",
  marketTier: "MID",
  studyPeriod: "Nov 2025 – Feb 2026",
  masterSummary: {
    salesTransactions: "285",
    offPlanPct: "94.7%",
    studioPSF: 1498,
    oneBRPSF: "1,521",
    twoBRPSF: 1366,
    avgRentPSF: "79",
    grossYieldRange: "5.2–6.6%",
    rentalContracts: 2034,
    renewalRate: "21%",
    farDefault: "4.5",
    constructionPSF: 420,
    keyDifferentiator: "Only area with significant office rental income (51% of all rentals); 7:1 rental-to-sales ratio",
  },
  salesByUnit: {
    studio: { transactions: 146, avgPrice: 579285, medianPrice: 583690, avgPSF: 1498, avgSizeSqft: 395 },
    "1br": { transactions: 74, avgPrice: 904474, medianPrice: 902226, avgPSF: 1521, avgSizeSqft: 810 },
    "2br": { transactions: 18, avgPrice: 1283333, medianPrice: 1291746, avgPSF: 1366, avgSizeSqft: 940 },
  },
  rentalByUnit: {
    studio: { contracts: 144, avgAnnualRent: 37956, avgPSFPerYear: 102, grossYield: 0.0655, yieldAssessment: "Best yield in DIC — highest in area" },
    "1br": { contracts: 158, avgAnnualRent: 46893, avgPSFPerYear: 79, grossYield: 0.0518, yieldAssessment: "STRONG — corporate tenant driven" },
    "2br": { contracts: 50, avgAnnualRent: 74374, avgPSFPerYear: 79, grossYield: 0.058, yieldAssessment: "VIABLE — management/professional segment" },
  },
  competitors: [
    { name: "Coventry Centro", developer: "GFS Wonders Developments", dldNumber: 3678, totalUnits: 64, plotSqm: 5000.62, floors: "2B+G+9F+R", completion: "Q2 2027", priceFrom: 884520, studioUnits: 24, studioPct: 37.5, oneBRUnits: 8, oneBRPct: 12.5, twoBRUnits: 32, twoBRPct: 50, studioMixStrategy: "2BR-heavy; unique DIC positioning", studioPSFRange: { min: 1250, max: 1380, avg: 1315 }, oneBRPSFRange: { min: 1256, max: 1275, avg: 1266 }, twoBRPSFRange: { min: 1200, max: 1450, avg: 1325 }, serviceChargePerSqft: { min: 12, max: 14 }, paymentPlan: "5/33/26/36% (36 months @ 1%/month post-handover)", postHandover: "36% over 36 months", notes: "30 units resale restriction. No furnishing." },
    { name: "Samana Hills South 3", developer: "Samana Signature", dldNumber: 4074, totalUnits: 147, plotSqm: 8791.25, floors: "G+5F+R", completion: "Q3 2028", priceFrom: 1070000, studioUnits: 25, studioPct: 17, oneBRUnits: 93, oneBRPct: 63.3, twoBRUnits: 29, twoBRPct: 19.7, studioMixStrategy: "1BR-dominant corporate focus (Samana-style)", studioPSFRange: { min: 1450, max: 1650, avg: 1550 }, oneBRPSFRange: { min: 1610, max: 1730, avg: 1670 }, twoBRPSFRange: { min: 1680, max: 1710, avg: 1695 }, serviceChargePerSqft: { min: 15, max: 15 }, paymentPlan: "20/45/35% post-handover (up to 3 years)", postHandover: "35% over up to 3 years", notes: "30 units resale restriction. Optional furnishing." },
  ],
  unitMixTemplates: [
    { name: "Investor-Focused: Studio-Heavy", description: "High yield play; maximise studio (6.55% yield)", units: [
      { unitType: "studio", rangeMin: 45, rangeMax: 55, recommended: 50, rationale: "Highest yield in DIC (6.55%+)", viability: "✓" },
      { unitType: "1br", rangeMin: 25, rangeMax: 30, recommended: 30, rationale: "Fast sales + strong corporate tenant demand", viability: "✓" },
      { unitType: "2br", rangeMin: 15, rangeMax: 20, recommended: 15, rationale: "Balanced investor/end-user demand", viability: "✓" },
      { unitType: "3br", rangeMin: 0, rangeMax: 5, recommended: 5, rationale: "Limited demand in DIC context", viability: "~" },
    ]},
    { name: "Balanced Mix (DIC Market Standard)", description: "Broad appeal; includes transient workforce", units: [
      { unitType: "studio", rangeMin: 30, rangeMax: 35, recommended: 35, rationale: "Appeals to investors + transient workforce", viability: "✓" },
      { unitType: "1br", rangeMin: 35, rangeMax: 40, recommended: 35, rationale: "Broad market appeal; #1 rental unit type", viability: "★" },
      { unitType: "2br", rangeMin: 20, rangeMax: 25, recommended: 25, rationale: "End-user & family demand", viability: "✓" },
      { unitType: "3br", rangeMin: 5, rangeMax: 10, recommended: 5, rationale: "Premium family/management staff segment", viability: "~" },
    ]},
    { name: "Corporate Focus: 1BR-Heavy (Samana-Style)", description: "Maximise corporate rental income", units: [
      { unitType: "studio", rangeMin: 15, rangeMax: 20, recommended: 17, rationale: "Limited; preserve focus on 1BR", viability: "~" },
      { unitType: "1br", rangeMin: 60, rangeMax: 65, recommended: 63, rationale: "Corporate tenant primary driver in DIC", viability: "★" },
      { unitType: "2br", rangeMin: 15, rangeMax: 20, recommended: 20, rationale: "Management/senior professional segment", viability: "✓" },
      { unitType: "3br", rangeMin: 0, rangeMax: 5, recommended: 0, rationale: "Omit for pure corporate focus", viability: "✗" },
    ]},
  ],
  developmentFramework: {
    marketTier: "MID",
    farDefault: 4.5,
    buaMultiplier: 1.6,
    constructionPSF: 420,
    serviceChargeRange: { min: 12, max: 15 },
    serviceChargeBudget: 13,
    grossYieldRange: { min: 0.052, max: 0.066 },
    rentalRenewalRate: 0.21,
    keyAdvantage: "51% of rentals are office units — unique commercial diversification; 7:1 rental-to-sales ratio",
    keyRisk: "Limited resale liquidity vs DLRC; exit at cost PSF critical — ensure AED 1,500+ PSF",
    notes: "Top developers: Samana (42.5%), Dugasta (34.4%), GFS Wonders emerging. BUA multiplier 1.6 — higher than other areas (industrial zone spec).",
  },
};

// ─────────────────────────────────────────────────────────────────────
// 6. BUKADRA
// ─────────────────────────────────────────────────────────────────────

const bukadraData: AreaMarketData = {
  areaCode: "BUKADRA",
  displayName: "Bukadra",
  subLocation: "Nad Al Sheba / Ras Al Khor Corridor",
  marketTier: "MID-PREMIUM",
  studyPeriod: "Feb 2026",
  masterSummary: {
    salesTransactions: "~911 units (pipeline)",
    offPlanPct: "—",
    oneBRPSF: "2,050–2,585",
    twoBRPSF: 2150,
    grossYieldRange: "5.5–6.5%",
    farDefault: "5.5",
    keyDifferentiator: "10–15 min to DIFC/Downtown; Meydan proximity; no studios confirmed across all 5 active projects",
  },
  salesByUnit: {
    "1br": { transactions: 0, avgPSF: 2283, avgPrice: 1827000 },
    "2br": { transactions: 0, avgPSF: 2150, avgPrice: 0 },
    "3br": { transactions: 0, avgPSF: 2125, avgPrice: 0 },
    "4br": { transactions: 0, avgPSF: 2000, avgPrice: 0 },
  },
  rentalByUnit: {},
  competitors: [
    { name: "The Caden by Prescott", developer: "Prescott Real Estate", dldNumber: 4215, totalUnits: 229, plotSqm: 25041.93, floors: "Multi-block", completion: "Q2 2028", priceFrom: 1827000, studioUnits: 0, studioPct: 0, oneBRUnits: 145, oneBRPct: 66, twoBRUnits: 38, twoBRPct: 17, threeBRUnits: 35, threeBRPct: 16, fourBRUnits: 3, fourBRPct: 1, oneBRPSFRange: { min: 2231, max: 2334, avg: 2283 }, twoBRPSFRange: { min: 2100, max: 2200, avg: 2150 }, threeBRPSFRange: { min: 2050, max: 2200, avg: 2125 }, fourBRPSFRange: { min: 2000, max: 2000, avg: 2000 }, serviceChargePerSqft: { min: 18, max: 18 }, paymentPlan: "20/40/40", postHandover: "None" },
    { name: "Wynwood Horizon", developer: "Imtiaz Gi Developments", dldNumber: 4133, totalUnits: 165, plotSqm: 17763.06, floors: "G+4P+18F+R", completion: "Q4 2028", priceFrom: 1800209, studioUnits: 0, studioPct: 0, oneBRUnits: 101, oneBRPct: 64, twoBRUnits: 51, twoBRPct: 32, threeBRUnits: 6, threeBRPct: 4, oneBRPSFRange: { min: 2396, max: 2585, avg: 2491 }, twoBRPSFRange: { min: 2200, max: 2400, avg: 2300 }, threeBRPSFRange: { min: 2100, max: 2100, avg: 2100 } },
    { name: "Parkway by Prestige One", developer: "Prestige One Developments", dldNumber: 3272, totalUnits: 274, plotSqm: 25691.68, floors: "G+P+32F+R", completion: "Q1 2028", priceFrom: 1760000, studioUnits: 0, studioPct: 0, oneBRUnits: 158, oneBRPct: 58, twoBRUnits: 88, twoBRPct: 32, threeBRUnits: 28, threeBRPct: 10, studioMixStrategy: "Balanced 1BR/2BR — no studios", oneBRPSFRange: { min: 2049, max: 2060, avg: 2055 }, twoBRPSFRange: { min: 2050, max: 2240, avg: 2145 }, threeBRPSFRange: { min: 2015, max: 2255, avg: 2135 }, serviceChargePerSqft: { min: 15, max: 16 }, paymentPlan: "20/45/35", notes: "Tallest project (32F); entry PSF lowest in market" },
    { name: "Future Residence", developer: "True Future", dldNumber: 4030, totalUnits: 152, plotSqm: 12171.47, floors: "G+2P+17F+R", completion: "Q4 2027", priceFrom: 1853851, studioUnits: 0, studioPct: 0, oneBRUnits: 117, oneBRPct: 78, twoBRUnits: 33, twoBRPct: 22, paymentPlan: "20/40/40", notes: "Highest 1BR PSF in Bukadra (AED 2,585 ceiling)" },
    { name: "Helvetia Verde", developer: "Helvetia Developments", totalUnits: 109, studioUnits: 0, studioPct: 0, oneBRUnits: 63, oneBRPct: 58, twoBRUnits: 39, twoBRPct: 36, threeBRUnits: 6, threeBRPct: 6, studioMixStrategy: "Balanced — no studios", serviceChargePerSqft: { min: 15, max: 18 } },
  ],
  unitMixTemplates: [
    { name: "Investor-Focused: 1BR-Heavy (Future Residence / Wynwood Style)", description: "75% 1BR — maximise yield velocity; no studios", units: [
      { unitType: "studio", rangeMin: 0, rangeMax: 0, recommended: 0, rationale: "No studio product in Bukadra; segment above affordable tier", viability: "✗" },
      { unitType: "1br", rangeMin: 65, rangeMax: 78, recommended: 75, rationale: "Core Bukadra product; AED 2,050–2,585/sqft; 5–6% yield drive", viability: "★" },
      { unitType: "2br", rangeMin: 18, rangeMax: 30, recommended: 22, rationale: "Essential secondary product; family/upgrade demand", viability: "✓" },
      { unitType: "3br", rangeMin: 3, rangeMax: 8, recommended: 3, rationale: "Limited; higher ticket revenue contribution", viability: "~" },
    ]},
    { name: "Balanced Mix (Parkway / Caden Style)", description: "Balanced family and investor; broader appeal", units: [
      { unitType: "studio", rangeMin: 0, rangeMax: 0, recommended: 0, rationale: "No studio product; maintain Bukadra segment positioning", viability: "✗" },
      { unitType: "1br", rangeMin: 55, rangeMax: 65, recommended: 60, rationale: "Dominant product; drives sales velocity and yield", viability: "★" },
      { unitType: "2br", rangeMin: 25, rangeMax: 35, recommended: 30, rationale: "Strong family segment; Parkway at 32% confirms demand", viability: "✓" },
      { unitType: "3br", rangeMin: 8, rangeMax: 12, recommended: 10, rationale: "Premium tier; higher margin per unit, slower sell cycle", viability: "~" },
    ]},
  ],
  developmentFramework: {
    marketTier: "MID-PREMIUM",
    farDefault: 5.5,
    constructionPSF: 420,
    serviceChargeRange: { min: 15, max: 18 },
    serviceChargeBudget: 16,
    grossYieldRange: { min: 0.055, max: 0.065 },
    keyAdvantage: "10–15 min to DIFC/Downtown; Meydan proximity; RTA Green Metro; first post-handover plan = competitive advantage",
    keyRisk: "Higher capital values compress yields vs Majan; studio absence limits investor pool breadth",
    notes: "Sellable area: 95% × GFA. GFA = Plot × FAR 5.5. FF&E: AED 25,000–35,000/unit. NO STUDIOS confirmed across all 5 active projects.",
  },
};

// ─────────────────────────────────────────────────────────────────────
// 7. MEYDAN HORIZON (reference entry — master table only)
// ─────────────────────────────────────────────────────────────────────

const meydanHorizonData: AreaMarketData = {
  areaCode: "MEYDAN_HORIZON",
  displayName: "Meydan Horizon",
  marketTier: "PREMIUM",
  studyPeriod: "Nov 2025 – Feb 2026",
  masterSummary: {
    salesTransactions: "742",
    offPlanPct: "94.9%",
    oneBRPSF: "2,250",
    twoBRPSF: 2148,
    avgRentPSF: "—",
    grossYieldRange: "—",
    farDefault: "—",
  },
  salesByUnit: {
    "1br": { transactions: 0, avgPSF: 2250, avgPrice: 0 },
    "2br": { transactions: 0, avgPSF: 2148, avgPrice: 0 },
  },
  rentalByUnit: {},
  competitors: [],
  unitMixTemplates: [],
  developmentFramework: {
    marketTier: "PREMIUM",
    farDefault: 4.0,
    constructionPSF: 420,
    serviceChargeRange: { min: 18, max: 22 },
    serviceChargeBudget: 20,
    grossYieldRange: { min: 0, max: 0 },
    keyAdvantage: "Premium location; Meydan brand; close to Downtown",
    keyRisk: "Limited data in study; benchmark against Al Satwa for PSF assumption",
    notes: "Detailed granular data not included in 6-area study dataset. Use master summary figures only.",
  },
};

// ─────────────────────────────────────────────────────────────────────
// MASTER EXPORT — ALL AREAS
// ─────────────────────────────────────────────────────────────────────

export const ALL_AREAS: Record<AreaCode, AreaMarketData> = {
  MAJAN: majanData,
  DLRC: dlrcData,
  AL_SATWA: alSatwaData,
  DSC: dscData,
  DIC: dicData,
  BUKADRA: bukadraData,
  MEYDAN_HORIZON: meydanHorizonData,
};

// ─────────────────────────────────────────────────────────────────────
// FEASIBILITY DEFAULTS
// Read-only by Feasibility Calculator. Do NOT rename keys.
// ─────────────────────────────────────────────────────────────────────

export const FEASIBILITY_DEFAULTS: Record<AreaCode, {
  constructionPSF: number;
  farDefault: number;
  serviceChargeBudget: number;
  buaMultiplier: number;
  grossYieldMidpoint: number;
  avgSalePSF: number;
}> = {
  AL_SATWA:       { constructionPSF: 450, farDefault: 3.5, serviceChargeBudget: 19, buaMultiplier: 1.45, grossYieldMidpoint: 0.048, avgSalePSF: 2266 },
  MEYDAN_HORIZON: { constructionPSF: 420, farDefault: 4.0, serviceChargeBudget: 20, buaMultiplier: 1.45, grossYieldMidpoint: 0.05,  avgSalePSF: 2200 },
  DLRC:           { constructionPSF: 420, farDefault: 4.5, serviceChargeBudget: 14, buaMultiplier: 1.45, grossYieldMidpoint: 0.058, avgSalePSF: 1280 },
  DSC:            { constructionPSF: 420, farDefault: 4.5, serviceChargeBudget: 14, buaMultiplier: 1.45, grossYieldMidpoint: 0.06,  avgSalePSF: 1565 },
  DIC:            { constructionPSF: 420, farDefault: 4.5, serviceChargeBudget: 13, buaMultiplier: 1.60, grossYieldMidpoint: 0.059, avgSalePSF: 1490 },
  BUKADRA:        { constructionPSF: 420, farDefault: 5.5, serviceChargeBudget: 16, buaMultiplier: 1.45, grossYieldMidpoint: 0.06,  avgSalePSF: 2200 },
  MAJAN:          { constructionPSF: 420, farDefault: 5.0, serviceChargeBudget: 15, buaMultiplier: 1.00, grossYieldMidpoint: 0.068, avgSalePSF: 1280 },
};

// ─────────────────────────────────────────────────────────────────────
// HELPER UTILITIES
// ─────────────────────────────────────────────────────────────────────

/** Map from CLFF area codes to master data area codes */
const CLFF_TO_MASTER: Record<string, AreaCode> = {
  MAJAN: "MAJAN",
  DLRC: "DLRC",
  ALSATWA: "AL_SATWA",
  DSC: "DSC",
  DIC: "DIC",
  BUKADRA: "BUKADRA",
  MEYDAN: "MEYDAN_HORIZON",
};

/** Get a single area's full data object by CLFF code or master code */
export function getAreaData(code: string): AreaMarketData | null {
  const masterCode = CLFF_TO_MASTER[code] || code;
  return (ALL_AREAS as Record<string, AreaMarketData>)[masterCode] || null;
}

/** Get all areas sorted by gross yield midpoint (highest first) */
export function getAreasByYield(): AreaMarketData[] {
  return Object.values(ALL_AREAS).sort((a, b) => {
    const aY = FEASIBILITY_DEFAULTS[a.areaCode]?.grossYieldMidpoint ?? 0;
    const bY = FEASIBILITY_DEFAULTS[b.areaCode]?.grossYieldMidpoint ?? 0;
    return bY - aY;
  });
}

/** Get all areas sorted by avg sale PSF (highest first) */
export function getAreasByPSF(): AreaMarketData[] {
  return Object.values(ALL_AREAS).sort((a, b) => {
    const aP = FEASIBILITY_DEFAULTS[a.areaCode]?.avgSalePSF ?? 0;
    const bP = FEASIBILITY_DEFAULTS[b.areaCode]?.avgSalePSF ?? 0;
    return bP - aP;
  });
}

/** Format a decimal yield as percentage string e.g. 0.0835 → "8.35%" */
export function formatYield(yieldDecimal: number): string {
  return `${(yieldDecimal * 100).toFixed(2)}%`;
}

/** Format AED number with commas e.g. 1234567 → "AED 1,234,567" */
export function formatAED(amount: number): string {
  return `AED ${amount.toLocaleString("en-AE")}`;
}

/** Get competitor projects as normalized comparables for DC benchmarks */
export function getCompetitorsAsComparables(clffAreaCode: string) {
  const areaData = getAreaData(clffAreaCode);
  if (!areaData) return [];

  return areaData.competitors.map(c => {
    const sizeByType = {
      studio: areaData.salesByUnit.studio?.avgSizeSqft || 426,
      br1: areaData.salesByUnit["1br"]?.avgSizeSqft || 771,
      br2: areaData.salesByUnit["2br"]?.avgSizeSqft || 1208,
      br3: areaData.salesByUnit["3br"]?.avgSizeSqft || 1680,
    };

    // Normalize unit mix percentages so they sum to exactly 100%
    const rawS = c.studioPct || 0;
    const raw1 = c.oneBRPct || 0;
    const raw2 = c.twoBRPct || 0;
    const raw3 = c.threeBRPct || 0;
    const raw = [rawS, raw1, raw2, raw3];
    const rawTotal = raw.reduce((a, b) => a + b, 0);

    let [studioP, br1P, br2P, br3P] = [rawS, raw1, raw2, raw3];
    if (rawTotal > 0) {
      const exact = raw.map(v => (v / rawTotal) * 100);
      const floorVals = exact.map(v => Math.floor(v));
      let remainder = 100 - floorVals.reduce((a, b) => a + b, 0);
      const order = exact
        .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
        .sort((a, b) => b.frac - a.frac);
      for (let i = 0; i < remainder; i++) {
        floorVals[order[i % order.length].idx] += 1;
      }
      [studioP, br1P, br2P, br3P] = floorVals;
    }

    // Derive project priceFrom when missing using PSF range mins × unit avg sizes
    const derivedCandidates: number[] = [];
    if (typeof c.priceFrom === 'number' && c.priceFrom > 0) derivedCandidates.push(c.priceFrom);
    if (c.studioPSFRange?.min) derivedCandidates.push(Math.round(c.studioPSFRange.min * sizeByType.studio));
    if (c.oneBRPSFRange?.min) derivedCandidates.push(Math.round(c.oneBRPSFRange.min * sizeByType.br1));
    if (c.twoBRPSFRange?.min) derivedCandidates.push(Math.round(c.twoBRPSFRange.min * sizeByType.br2));
    if (c.threeBRPSFRange?.min) derivedCandidates.push(Math.round(c.threeBRPSFRange.min * sizeByType.br3));
    const derivedPriceFrom = derivedCandidates.length ? Math.min(...derivedCandidates) : null;

    const psfCandidates = [
      c.studioPSFRange?.avg,
      c.oneBRPSFRange?.avg,
      c.twoBRPSFRange?.avg,
      c.threeBRPSFRange?.avg,
    ].filter((v): v is number => typeof v === 'number' && v > 0);
    const derivedPsf = psfCandidates.length ? Math.round(psfCandidates.reduce((a, b) => a + b, 0) / psfCandidates.length) : null;

    return {
      name: c.name,
      developer: c.developer,
      area: areaData.displayName,
      areaCode: clffAreaCode,
      plotSqft: c.plotSqm ? Math.round(c.plotSqm * 10.764) : null,
      units: c.totalUnits,
      floors: c.floors || null,
      handover: c.completion || null,
      priceFrom: derivedPriceFrom,
      studioP,
      br1P,
      br2P,
      br3P,
      svc: c.serviceChargePerSqft ? c.serviceChargePerSqft.min : null,
      payPlan: c.paymentPlan || null,
      psf: derivedPsf,
      studioMixStrategy: c.studioMixStrategy || null,
      studioPSFRange: c.studioPSFRange || null,
      oneBRPSFRange: c.oneBRPSFRange || null,
      twoBRPSFRange: c.twoBRPSFRange || null,
      threeBRPSFRange: c.threeBRPSFRange || null,
      notes: c.notes || null,
    };
  });
}

/** Minimum reliable transaction count for median calculation */
const MIN_RELIABLE_TXNS = 10;

/** Get sales transaction data for an area — enriched with share %, median price, insufficiency flags */
export function getAreaSalesData(clffAreaCode: string) {
  const areaData = getAreaData(clffAreaCode);
  if (!areaData) return null;

  const sales = areaData.salesByUnit;
  const total = Object.values(sales).reduce((sum, s) => sum + (s?.transactions || 0), 0);

  const buildUnit = (s: UnitSalesData | undefined) => {
    const avgPSF = s?.avgPSF || 0;
    const avgSize = s?.avgSizeSqft || 0;
    // Derive avgPrice from PSF × size if not explicitly provided
    const avgPrice = s?.avgPrice || (avgPSF > 0 && avgSize > 0 ? Math.round(avgPSF * avgSize) : 0);
    const medianPrice = s?.medianPrice || 0;
    return {
      transactions: s?.transactions || 0,
      sharePct: total > 0 && s?.transactions ? Math.round((s.transactions / total) * 1000) / 10 : 0,
      avgPSF,
      medianPSF: s?.medianPSF || 0,
      avgPrice,
      medianPrice,
      avgSize,
      insufficient: (s?.transactions || 0) > 0 && (s?.transactions || 0) < MIN_RELIABLE_TXNS,
      noData: !s || (s.transactions || 0) === 0,
    };
  };

  const studio = buildUnit(sales.studio);
  const br1 = buildUnit(sales["1br"]);
  const br2 = buildUnit(sales["2br"]);
  const br3 = buildUnit(sales["3br"]);
  const br4 = buildUnit(sales["4br"]);

  return {
    avgPsf: { studio: studio.avgPSF, br1: br1.avgPSF, br2: br2.avgPSF, br3: br3.avgPSF },
    medianPsf: { studio: studio.medianPSF, br1: br1.medianPSF, br2: br2.medianPSF, br3: br3.medianPSF },
    avgSize: { studio: studio.avgSize, br1: br1.avgSize, br2: br2.avgSize, br3: br3.avgSize },
    avgPrice: { studio: studio.avgPrice, br1: br1.avgPrice, br2: br2.avgPrice, br3: br3.avgPrice },
    medianPrice: { studio: studio.medianPrice, br1: br1.medianPrice, br2: br2.medianPrice, br3: br3.medianPrice },
    count: { studio: studio.transactions, br1: br1.transactions, br2: br2.transactions, br3: br3.transactions, total },
    sharePct: { studio: studio.sharePct, br1: br1.sharePct, br2: br2.sharePct, br3: br3.sharePct },
    insufficient: { studio: studio.insufficient, br1: br1.insufficient, br2: br2.insufficient, br3: br3.insufficient },
    noData: { studio: studio.noData, br1: br1.noData, br2: br2.noData, br3: br3.noData },
    unitDetails: { studio, br1, br2, br3, br4 },
  };
}

/** Get rental data for an area */
export function getAreaRentalData(clffAreaCode: string) {
  const areaData = getAreaData(clffAreaCode);
  if (!areaData) return null;

  const rentals = areaData.rentalByUnit;
  return {
    studio: rentals.studio || null,
    br1: rentals["1br"] || null,
    br2: rentals["2br"] || null,
    br3: rentals["3br"] || null,
  };
}

/** Generate data-derived area insights */
export function generateAreaInsights(clffAreaCode: string): string[] {
  const areaData = getAreaData(clffAreaCode);
  if (!areaData) return [];

  const insights: string[] = [];
  const sales = getAreaSalesData(clffAreaCode);
  if (!sales || sales.count.total === 0) {
    insights.push("Insufficient sales transaction data to generate area insights.");
    return insights;
  }

  // 1. Demand concentration
  const types = [
    { label: 'Studios', pct: sales.sharePct.studio },
    { label: '1BR', pct: sales.sharePct.br1 },
    { label: '2BR', pct: sales.sharePct.br2 },
    { label: '3BR', pct: sales.sharePct.br3 },
  ].filter(t => t.pct > 0).sort((a, b) => b.pct - a.pct);

  if (types.length >= 2) {
    const topTwo = types.slice(0, 2);
    const combinedPct = topTwo.reduce((s, t) => s + t.pct, 0);
    if (combinedPct > 60) {
      insights.push(`Demand is concentrated in ${topTwo.map(t => t.label).join(' and ')} (${combinedPct.toFixed(0)}% of transactions).`);
    }
  }

  // 2. Weak unit types
  const weakTypes = types.filter(t => t.pct > 0 && t.pct < 5);
  for (const wt of weakTypes) {
    insights.push(`${wt.label} units show weak absorption (${wt.pct.toFixed(1)}% of txns) and should be minimized or avoided.`);
  }

  // 3. No-data unit types
  const noDataTypes = [
    { label: 'Studio', noData: sales.noData.studio },
    { label: '3BR', noData: sales.noData.br3 },
  ].filter(t => t.noData);
  for (const nd of noDataTypes) {
    insights.push(`${nd.label} units have zero recorded transactions — exclude or flag as speculative.`);
  }

  // 4. PSF stability
  if (sales.medianPsf.studio > 0 && sales.avgPsf.studio > 0) {
    const diff = Math.abs(sales.avgPsf.studio - sales.medianPsf.studio) / sales.avgPsf.studio;
    if (diff < 0.05) {
      insights.push("Median PSF is stable relative to average, suggesting uniform pricing — healthy market signal.");
    } else if (diff > 0.15) {
      insights.push("Significant gap between average and median PSF suggests investor-led pricing or outlier transactions.");
    }
  }

  // 5. Rental yield context
  const rentals = getAreaRentalData(clffAreaCode);
  if (rentals) {
    const yieldData = [
      { label: 'Studio', yield: rentals.studio?.grossYield },
      { label: '1BR', yield: rentals.br1?.grossYield },
    ].filter(y => y.yield && y.yield > 0);

    const highYield = yieldData.filter(y => (y.yield || 0) > 0.06);
    if (highYield.length > 0) {
      insights.push(`${highYield.map(y => y.label).join(' and ')} offer exceptional rental yield (>6%), supporting investor-focused strategies.`);
    }
  }

  // 6. Competitor supply skew
  const comps = areaData.competitors;
  if (comps.length >= 2) {
    const avgStudioPct = comps.reduce((s, c) => s + (c.studioPct || 0), 0) / comps.length;
    const avg1BRPct = comps.reduce((s, c) => s + (c.oneBRPct || 0), 0) / comps.length;
    if (avgStudioPct > 40) {
      insights.push(`Competitor supply is skewed toward studios (avg ${Math.round(avgStudioPct)}%), confirming investor-focused market positioning.`);
    } else if (avg1BRPct > 45) {
      insights.push(`Competitor supply favors 1BR units (avg ${Math.round(avg1BRPct)}%), indicating strong end-user/rental demand.`);
    }
  }

  // 7. Renewal rate
  if (areaData.developmentFramework.rentalRenewalRate && areaData.developmentFramework.rentalRenewalRate > 0.4) {
    insights.push(`High rental renewal rate (${(areaData.developmentFramework.rentalRenewalRate * 100).toFixed(0)}%) indicates low vacancy risk and tenant retention.`);
  }

  return insights;
}

/** Evaluate whether a unit mix template should be shown based on demand data */
export function evaluateTemplateViability(clffAreaCode: string, template: UnitMixTemplate): {
  show: boolean;
  warnings: string[];
  supportData: string[];
} {
  const sales = getAreaSalesData(clffAreaCode);
  const warnings: string[] = [];
  const supportData: string[] = [];

  if (!sales || sales.count.total === 0) {
    return { show: true, warnings: ["No transaction data to validate template"], supportData: [] };
  }

  const studioRec = template.units.find(u => u.unitType === 'studio');
  const studioThreshold = 45;
  const minTxnVolume = 20;

  // Check if studio-heavy template is justified
  if (studioRec && studioRec.recommended >= studioThreshold) {
    if (sales.sharePct.studio < 30 && sales.count.studio < minTxnVolume) {
      warnings.push(`Studio share is only ${sales.sharePct.studio.toFixed(1)}% of transactions (${sales.count.studio} txns) — insufficient demand to support a studio-heavy template.`);
      return { show: false, warnings, supportData };
    }
    if (sales.sharePct.studio >= 30) {
      supportData.push(`Studio demand confirmed: ${sales.sharePct.studio.toFixed(1)}% of transactions (${sales.count.studio} txns).`);
    }
  }

  // Check for weak unit types in template
  for (const entry of template.units) {
    if (entry.recommended === 0) continue;
    const key = entry.unitType === 'studio' ? 'studio' : entry.unitType === '1br' ? 'br1' : entry.unitType === '2br' ? 'br2' : entry.unitType === '3br' ? 'br3' : null;
    if (!key) continue;
    const txns = sales.count[key as keyof typeof sales.count] || 0;
    const share = sales.sharePct[key as keyof typeof sales.sharePct] || 0;
    if (txns === 0 && entry.recommended > 5) {
      warnings.push(`${entry.unitType.toUpperCase()} has zero transactions but template recommends ${entry.recommended}% — reduce or eliminate.`);
    } else if (share < 3 && entry.recommended > 10) {
      warnings.push(`${entry.unitType.toUpperCase()} shows weak demand (${share.toFixed(1)}%) but template allocates ${entry.recommended}%.`);
    }
  }

  return { show: true, warnings, supportData };
}
