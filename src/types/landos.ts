// ═══════════════════════════════════════════════════════════════════════════
// LAND OS — Core TypeScript Types
// Dubai Real Estate Feasibility Platform
// ═══════════════════════════════════════════════════════════════════════════

// ── API Request ─────────────────────────────────────────────────────────────

export type LandOSQueryType = 'plot_number' | 'municipality_number' | 'coordinates';

export interface LandOSQuery {
  type: LandOSQueryType;
  plotNumber?: string;
  municipalityNumber?: string;
  coordinates?: { lat: number; lng: number };
  area?: string;
}

// ── API Response — Official Plot Data ────────────────────────────────────────

export interface LandOSPlotData {
  plotNumber: string;
  municipalityNumber?: string;
  area: string;

  // Size
  plotAreaSqm: number;
  plotAreaSqft: number;

  // GFA & Zoning
  gfaSqm: number;
  gfaSqft: number;
  far: number | null;
  maxBuiltArea: number;

  // Planning rules
  landUse: string;
  heightLimit: number | null;
  floors: number | null;
  zoneCode?: string;
  permitClass?: string;
  zoning?: string;

  // Project info
  developer?: string;
  projectName?: string;
  commonName?: string;

  // Location
  coordinates?: { lat: number; lng: number };

  // Data quality
  dataQuality?: 'complete' | 'partial' | 'fallback';
  gfaSource?: string;
  sources?: { fallback: boolean; dld: boolean; gis: boolean };

  // Meta
  source: 'LAND_OS' | 'GIS_DLD' | 'DLD_OPENDATA';
  fetchedAt: string;
  raw?: Record<string, unknown>;
}

export interface LandOSResponse {
  success: boolean;
  plot?: LandOSPlotData;
  error?: string;
  latencyMs?: number;
}

// ── Plot record (from XEstate / internal DB) ─────────────────────────────────

export interface PlotRecord {
  id: string;
  plotNumber: string;
  area: string;
  plotSize: number;
  gfaSqft?: number;
  landUse?: string;
  floors?: number | string;
  askingPrice?: number;
  estimatedGDV?: number;
  targetIRR?: number;
  notes?: string;
  createdAt?: string;
  landosData?: LandOSPlotData;
  gisData?: {
    zoning?: string;
    far?: number;
    plotSizeSqft?: number;
    coordinates?: { lat: number; lng: number };
  };
}

// ── Transaction record (from Property Monitor scraper) ───────────────────────

export interface TransactionRecord {
  land_number?: string;
  development?: string;
  plot_size_sqft?: number;
  gfa_sqft?: number;
  far?: number;
  landuse?: string;
  height?: string | number;
  price_aed?: number;
  psf_gfa_aed?: number;
  evidence_date?: string;
}

// ── Similarity Engine ────────────────────────────────────────────────────────

export type ComparableSource = 'TX' | 'LAND_OS' | 'INTERNAL';

export interface ComparablePlot {
  source: ComparableSource;
  plotNumber: string;
  area: string;
  plotSizeSqm: number;
  plotSizeSqft: number;
  gfaSqm: number;
  gfaSqft: number;
  far: number | null;
  landUse: string;
  heightLimit: string | number;
  price?: number;
  psf?: number;
  date?: string;
  sizeDiff: number;
  gfaDiff: number | null;
  simScore: number;
  sameArea: boolean;
}

export interface SimilarityResult {
  comparable: ComparablePlot[];
  stats: {
    count: number;
    avgPSF: number;
    avgPlotSqm: number;
    avgGfaSqm: number;
    medianPSF: number;
  };
  targetPlot: {
    plotNumber: string;
    area: string;
    plotSizeSqm: number;
    gfaSqm: number;
    landUse: string;
  };
  message: string | null;
}

// ── Feasibility Engine ────────────────────────────────────────────────────────

export type LandUseCategory = 'residential' | 'villa' | 'mixed' | 'commercial' | 'retail';

export interface FeasibilityInputs {
  plotSizeSqft: number;
  gfaSqft?: number;
  far?: number;
  floors?: number;
  heightLimit?: number;
  landUse?: string;
  landCost?: number;
  constructionPSF?: number;
  salePSF?: number;
  sellableRatio?: number;
  profFeesPct?: number;
  finCostPct?: number;
  marketingPct?: number;
  contingencyPct?: number;
}

export interface UnitMixItem {
  type: string;
  units: number;
  avgSizeSqft: number;
  totalAreaSqft: number;
  pctGfa: number;
  avgSalePSF: number;
  unitGDV: number;
}

export interface SensitivityScenario {
  label: string;
  salePSF: number;
  gdv: number;
  netProfit: number;
  roi: number;
  profitMargin: number;
  viable: boolean;
}

export interface FeasibilityResult {
  plotSqm: number;
  plotSqft: number;
  gfaSqm: number;
  gfaSqft: number;
  sellableSqft: number;
  sellableSqm: number;
  far: number;
  floors: number;
  heightLimit: number;
  landUse: string;
  landUseCategory: LandUseCategory;
  gdv: number;
  salePSF: number;
  landCost: number;
  constructionCost: number;
  profFeesCost: number;
  finCostVal: number;
  marketingCost: number;
  contingencyCost: number;
  totalDevCost: number;
  netProfit: number;
  roi: number;
  irr: number;
  profitMargin: number;
  breakEvenPSF: number;
  unitMix: UnitMixItem[];
  totalUnits: number;
  sensitivity: SensitivityScenario[];
  landOSUsed: boolean;
  gisUsed: boolean;
  marketPSFSource: 'transactions' | 'default';
  computedAt: string;
}

// ── Config ───────────────────────────────────────────────────────────────────

export interface LandOSConfig {
  apiKey: string;
  endpoint: string;
  timeout: number;
  retries: number;
}
