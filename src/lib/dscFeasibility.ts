// ─── DSC Market Data (from Framework + Excel) ────────────────────────────────
export const COMPS = [
  { name: "Golf Place", developer: "Prestige One", plotSqft: 93590, units: 198, bua: 219173, floors: "G+P+14", handover: "Q2 2026", priceFrom: 1050000, psf: 1387, studioP: 38, br1P: 44, br2P: 17, br3P: 1, payPlan: "20/40/40", svc: 15, density: 0.90 },
  
  { name: "Vega", developer: "Acube", plotSqft: 109501, units: 129, bua: 109500, floors: "G+3P+20", handover: "Q2 2027", priceFrom: 892476, psf: 1400, studioP: 25, br1P: 31, br2P: 40, br3P: 5, payPlan: "20/40/40", svc: 14.5, density: 1.18 },
  { name: "Azizi Grand", developer: "Azizi", plotSqft: 252193, units: 411, bua: 252190, floors: "14 Floors", handover: "Q4 2024", priceFrom: 1605000, psf: 1450, studioP: 56, br1P: 33, br2P: 11, br3P: 0, payPlan: "40/60", svc: 14, density: 1.63 },
  { name: "Hadley Heights 2", developer: "Leos", plotSqft: 227917, units: 230, bua: 227915, floors: "G+3P+21", handover: "Q2 2027", priceFrom: 1200640, psf: 1355, studioP: 25, br1P: 30, br2P: 40, br3P: 5, payPlan: "5/45/50", svc: 13.5, density: 1.01 },
  { name: "Fairway Res.", developer: "Prescott", plotSqft: 158269, units: 156, bua: 158268, floors: "G+P+14+R", handover: "Q3 2026", priceFrom: 1200000, psf: 1387, studioP: 27, br1P: 27, br2P: 42, br3P: 4, payPlan: "20/20/60", svc: 14, density: 0.99 },
];

// ─── DSC Sales Transactions (809 total) — Real market data ───────────────────
export const TXN_AVG_PSF = { studio: 1796, br1: 1531, br2: 1368, br3: 1449 };
export const TXN_AVG_SIZE = { studio: 426, br1: 771, br2: 1208, br3: 1680 };
export const TXN_AVG_PRICE = { studio: 757028, br1: 1155437, br2: 1643427, br3: 2390616 };
export const TXN_MEDIAN_PSF = { studio: 1765, br1: 1511, br2: 1424, br3: 1325 };
export const TXN_COUNT = { studio: 257, br1: 292, br2: 237, br3: 23, total: 809 };

export const UNIT_SIZES = { studio: 426, br1: 771, br2: 1208, br3: 1680 };
export const UNIT_PRICES = { studio: 757028, br1: 1155437, br2: 1643427, br3: 2390616 };
export const RENT_PSF_YR = { studio: 90, br1: 86, br2: 83, br3: 78 };

export type MixKey = 'investor' | 'balanced' | 'family';

export interface MixTemplate {
  label: string;
  icon: string;
  desc: string;
  mix: { studio: number; br1: number; br2: number; br3: number };
  payPlan: { booking: number; construction: number; handover: number };
  tag: string;
}

export const MIX_TEMPLATES: Record<MixKey, MixTemplate> = {
  investor: {
    label: "Investor-Focused", icon: "📈", desc: "High Rental Yield — Studio / 1BR heavy",
    mix: { studio: 0.50, br1: 0.30, br2: 0.15, br3: 0.05 },
    payPlan: { booking: 5, construction: 45, handover: 50 },
    tag: "Best yield, fastest absorption"
  },
  balanced: {
    label: "Balanced Mix", icon: "⚖️", desc: "Market Standard — Dual investor + end-user appeal",
    mix: { studio: 0.35, br1: 0.35, br2: 0.25, br3: 0.05 },
    payPlan: { booking: 10, construction: 40, handover: 50 },
    tag: "Lowest market risk, broad appeal"
  },
  family: {
    label: "Family-Oriented", icon: "🏡", desc: "End-User Focus — 2BR / 3BR dominant",
    mix: { studio: 0.15, br1: 0.30, br2: 0.40, br3: 0.15 },
    payPlan: { booking: 20, construction: 40, handover: 40 },
    tag: "Premium pricing, longer absorption"
  },
};

export interface DSCPlotInput {
  area: number; // sqft
  ratio: number;
  height: string;
  zone: string;
  constraints: string;
  name: string;
  id: string;
}

export interface DSCFeasibilityResult {
  plot: DSCPlotInput;
  mixKey: MixKey;
  mix: { studio: number; br1: number; br2: number; br3: number };
  gfa: number;
  sellableArea: number;
  bua: number;
  landCost: number;
  units: { studio: number; br1: number; br2: number; br3: number; total: number };
  prices: { studio: number; br1: number; br2: number; br3: number };
  revBreak: { studio: number; br1: number; br2: number; br3: number };
  grossSales: number;
  avgPsf: number;
  constructionCost: number;
  authorityFees: number;
  consultantFees: number;
  marketing: number;
  contingency: number;
  financing: number;
  totalCost: number;
  grossProfit: number;
  grossMargin: number;
  roi: number;
  breakEvenPsf: number;
  annualRent: number;
  grossYield: number;
  residentialFloors: number;
  floorPlate: number;
  sens: Array<{ delta: number; revenue: number; profit: number; margin: number; roi: number }>;
  payPlan: { booking: number; construction: number; handover: number };
}

// Average PSF from 6 benchmarks (for reference)
export const BENCHMARK_AVG_PSF = Math.round(COMPS.reduce((s, c) => s + c.psf, 0) / COMPS.length);
// Weighted avg PSF from real transactions
export const TXN_WEIGHTED_AVG_PSF = Math.round(
  (TXN_AVG_PSF.studio * TXN_COUNT.studio + TXN_AVG_PSF.br1 * TXN_COUNT.br1 + TXN_AVG_PSF.br2 * TXN_COUNT.br2 + TXN_AVG_PSF.br3 * TXN_COUNT.br3) / TXN_COUNT.total
);

export function calcDSCFeasibility(plot: DSCPlotInput, mixKey: MixKey, overrides: { gfa?: number; landCost?: number; landCostPsf?: number; efficiency?: number; buaMultiplier?: number; constructionPsf?: number; avgPsfOverride?: number; contingencyPct?: number; financePct?: number; mix?: Partial<{ studio: number; br1: number; br2: number; br3: number }>; unitPsf?: { studio?: number; br1?: number; br2?: number; br3?: number }; unitSizes?: { studio?: number; br1?: number; br2?: number; br3?: number }; unitRents?: { studio?: number; br1?: number; br2?: number; br3?: number } } = {}): DSCFeasibilityResult {
  const tmpl = MIX_TEMPLATES[mixKey];
  const mix = { ...tmpl.mix, ...overrides.mix };
  const gfa = overrides.gfa || (plot.area * plot.ratio);
  const efficiency = overrides.efficiency || 0.95;
  const sellableArea = gfa * efficiency;
  const buaMultiplier = overrides.buaMultiplier || 1.45;
  const bua = gfa * buaMultiplier;
  const landCostPsf = overrides.landCostPsf || 148.23;
  const landCost = overrides.landCost || (gfa * landCostPsf);

  // Use area-specific market data if provided, otherwise DSC defaults
  const usedSizes = {
    studio: overrides.unitSizes?.studio || UNIT_SIZES.studio,
    br1: overrides.unitSizes?.br1 || UNIT_SIZES.br1,
    br2: overrides.unitSizes?.br2 || UNIT_SIZES.br2,
    br3: overrides.unitSizes?.br3 || UNIT_SIZES.br3,
  };
  const usedPsf = {
    studio: overrides.unitPsf?.studio || TXN_AVG_PSF.studio,
    br1: overrides.unitPsf?.br1 || TXN_AVG_PSF.br1,
    br2: overrides.unitPsf?.br2 || TXN_AVG_PSF.br2,
    br3: overrides.unitPsf?.br3 || TXN_AVG_PSF.br3,
  };
  const usedRents = {
    studio: overrides.unitRents?.studio || RENT_PSF_YR.studio,
    br1: overrides.unitRents?.br1 || RENT_PSF_YR.br1,
    br2: overrides.unitRents?.br2 || RENT_PSF_YR.br2,
    br3: overrides.unitRents?.br3 || RENT_PSF_YR.br3,
  };

  // Unit count derived from sellable area (100% allocation)
  const avgUnitSize =
    mix.studio * usedSizes.studio +
    mix.br1 * usedSizes.br1 +
    mix.br2 * usedSizes.br2 +
    mix.br3 * usedSizes.br3;
  const totalUnits = Math.round(sellableArea / avgUnitSize);

  const units = {
    studio: Math.round(totalUnits * mix.studio),
    br1: Math.round(totalUnits * mix.br1),
    br2: Math.round(totalUnits * mix.br2),
    br3: Math.round(totalUnits * mix.br3),
    total: 0,
  };
  units.total = units.studio + units.br1 + units.br2 + units.br3;

  // Per-unit-type prices from market data (area-specific or DSC default)
  const prices = {
    studio: usedSizes.studio * usedPsf.studio,
    br1: usedSizes.br1 * usedPsf.br1,
    br2: usedSizes.br2 * usedPsf.br2,
    br3: usedSizes.br3 * usedPsf.br3,
  };

  // GDV = Sum of (units per type × avg selling price per type)
  const grossSales =
    units.studio * prices.studio +
    units.br1 * prices.br1 +
    units.br2 * prices.br2 +
    units.br3 * prices.br3;

  // Derived weighted average PSF (for display)
  const avgPsf = sellableArea > 0 ? grossSales / sellableArea : TXN_WEIGHTED_AVG_PSF;

  const revBreak = {
    studio: units.studio * prices.studio,
    br1: units.br1 * prices.br1,
    br2: units.br2 * prices.br2,
    br3: units.br3 * prices.br3,
  };

  const constructionPsf = overrides.constructionPsf || 420;
  const constructionCost = bua * constructionPsf;
  const authorityFees = landCost * 0.04;          // 4% of Land Cost (CLFF)
  const consultantFees = constructionCost * 0.03;  // 3% of Construction (CLFF)
  const marketing = grossSales * 0.02;             // 2% of GDV (Bukadra model)
  const contingencyPct = overrides.contingencyPct ?? 0.05;
  const financePct = overrides.financePct ?? 0.03;
  const contingency = constructionCost * contingencyPct; // 5% of Construction (CLFF)
  const financing = grossSales * financePct;             // 3% of GDV (Bukadra model)
  const totalCost = landCost + constructionCost + authorityFees + consultantFees + marketing + contingency + financing;

  const grossProfit = grossSales - totalCost;
  const grossMargin = grossProfit / grossSales;
  const roi = grossProfit / totalCost;
  const breakEvenPsf = totalCost / sellableArea;

  const annualRent =
    units.studio * (usedSizes.studio * usedRents.studio) +
    units.br1 * (usedSizes.br1 * usedRents.br1) +
    units.br2 * (usedSizes.br2 * usedRents.br2) +
    units.br3 * (usedSizes.br3 * usedRents.br3);
  const grossYield = annualRent / grossSales;

  const floorPlate = plot.area * efficiency;
  const residentialFloors = Math.ceil(gfa / floorPlate);

  const sens = [-0.10, -0.05, 0, 0.05, 0.10].map(delta => {
    const rev = grossSales * (1 + delta);
    const prof = rev - totalCost;
    return { delta, revenue: rev, profit: prof, margin: prof / rev, roi: prof / totalCost };
  });

  return {
    plot, mixKey, mix, gfa, sellableArea, bua, landCost, units,
    prices, revBreak, grossSales, avgPsf,
    constructionCost, authorityFees, consultantFees, marketing, contingency, financing, totalCost,
    grossProfit, grossMargin, roi, breakEvenPsf,
    annualRent, grossYield,
    residentialFloors, floorPlate,
    sens,
    payPlan: tmpl.payPlan,
  };
}

// Formatting helpers — safe against undefined/NaN
export const fmt = (n: number, dec = 0) => {
  if (n == null || isNaN(n)) return '0';
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
};
export const fmtM = (n: number) => `AED ${(n == null || isNaN(n) ? 0 : n / 1000000).toFixed(2)}M`;
export const fmtA = (n: number) => `AED ${fmt(Math.round(n || 0))}`;
export const pct = (n: number) => `${((n == null || isNaN(n) ? 0 : n) * 100).toFixed(1)}%`;
