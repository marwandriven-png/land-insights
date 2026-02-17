// ─── DSC Market Data (from Framework + Excel) ────────────────────────────────
export const COMPS = [
  { name: "Golf Place", developer: "Prestige One", plotSqft: 93590, units: 198, bua: 219173, floors: "G+P+14", handover: "Q2 2026", priceFrom: 1050000, psf: 1387, studioP: 38, br1P: 44, br2P: 17, br3P: 1, payPlan: "20/40/40", svc: 15, density: 0.90 },
  { name: "Antalya", developer: "Karma", plotSqft: 85023, units: 208, bua: 211266, floors: "G+3P+19", handover: "Q2 2027", priceFrom: 699999, psf: 1250, studioP: 50, br1P: 25, br2P: 25, br3P: 0, payPlan: "5/45/50", svc: 13.5, density: 0.98 },
  { name: "Vega", developer: "Acube", plotSqft: 109501, units: 129, bua: 109500, floors: "G+3P+20", handover: "Q2 2027", priceFrom: 892476, psf: 1400, studioP: 25, br1P: 31, br2P: 40, br3P: 5, payPlan: "20/40/40", svc: 14.5, density: 1.18 },
  { name: "Azizi Grand", developer: "Azizi", plotSqft: 252193, units: 411, bua: 252190, floors: "14 Floors", handover: "Q4 2024", priceFrom: 1605000, psf: 1450, studioP: 56, br1P: 33, br2P: 11, br3P: 0, payPlan: "40/60", svc: 14, density: 1.63 },
  { name: "Hadley Heights 2", developer: "Leos", plotSqft: 227917, units: 230, bua: 227915, floors: "G+3P+21", handover: "Q2 2027", priceFrom: 1200640, psf: 1355, studioP: 25, br1P: 30, br2P: 40, br3P: 5, payPlan: "5/45/50", svc: 13.5, density: 1.01 },
  { name: "Fairway Res.", developer: "Prescott", plotSqft: 158269, units: 156, bua: 158268, floors: "G+P+14+R", handover: "Q3 2026", priceFrom: 1200000, psf: 1387, studioP: 27, br1P: 27, br2P: 42, br3P: 4, payPlan: "20/20/60", svc: 14, density: 0.99 },
];

export const UNIT_SIZES = { studio: 485, br1: 750, br2: 1100, br3: 1650 };
export const UNIT_PRICES = { studio: 850000, br1: 1200000, br2: 1650000, br3: 2250000 };
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

export function calcDSCFeasibility(plot: DSCPlotInput, mixKey: MixKey, overrides: { gfa?: number; landCost?: number; landCostPsf?: number; efficiency?: number; buaMultiplier?: number; constructionPsf?: number; mix?: Partial<{ studio: number; br1: number; br2: number; br3: number }> } = {}): DSCFeasibilityResult {
  const tmpl = MIX_TEMPLATES[mixKey];
  const mix = { ...tmpl.mix, ...overrides.mix };
  const gfa = overrides.gfa || (plot.area * plot.ratio);
  const buaMultiplier = overrides.buaMultiplier || 1.45;
  const bua = gfa * buaMultiplier;
  const landCostPsf = overrides.landCostPsf || 148.23;
  const landCost = overrides.landCost || (gfa * landCostPsf);

  const densityFactor = mixKey === "investor" ? 1.15 : mixKey === "balanced" ? 1.0 : 0.85;
  const totalUnits = Math.round((bua / 1000) * densityFactor);

  const units = {
    studio: Math.round(totalUnits * mix.studio),
    br1: Math.round(totalUnits * mix.br1),
    br2: Math.round(totalUnits * mix.br2),
    br3: Math.round(totalUnits * mix.br3),
    total: 0,
  };
  units.total = units.studio + units.br1 + units.br2 + units.br3;

  const psfAdj = mixKey === "investor" ? 0.97 : mixKey === "family" ? 1.04 : 1.0;
  const prices = {
    studio: UNIT_PRICES.studio * psfAdj,
    br1: UNIT_PRICES.br1 * psfAdj,
    br2: UNIT_PRICES.br2 * psfAdj,
    br3: UNIT_PRICES.br3 * (psfAdj * 1.02),
  };

  const revBreak = {
    studio: units.studio * prices.studio,
    br1: units.br1 * prices.br1,
    br2: units.br2 * prices.br2,
    br3: units.br3 * prices.br3,
  };
  const grossSales = revBreak.studio + revBreak.br1 + revBreak.br2 + revBreak.br3;
  const avgPsf = grossSales / bua;

  const constructionPsf = overrides.constructionPsf || 420;
  const constructionCost = bua * constructionPsf;
  const authorityFees = landCost * 0.04;
  const consultantFees = constructionCost * 0.03;
  const marketing = grossSales * 0.10;
  const contingency = constructionCost * 0.05;
  const financing = constructionCost * 0.04;
  const totalCost = landCost + constructionCost + authorityFees + consultantFees + marketing + contingency + financing;

  const grossProfit = grossSales - totalCost;
  const grossMargin = grossProfit / grossSales;
  const roi = grossProfit / totalCost;
  const breakEvenPsf = totalCost / bua;

  const annualRent =
    units.studio * (UNIT_SIZES.studio * RENT_PSF_YR.studio) +
    units.br1 * (UNIT_SIZES.br1 * RENT_PSF_YR.br1) +
    units.br2 * (UNIT_SIZES.br2 * RENT_PSF_YR.br2) +
    units.br3 * (UNIT_SIZES.br3 * RENT_PSF_YR.br3);
  const grossYield = annualRent / grossSales;

  const efficiency = overrides.efficiency || 0.95;
  const floorPlate = plot.area * efficiency;
  const residentialFloors = Math.ceil(gfa / floorPlate);

  const sens = [-0.10, -0.05, 0, 0.05, 0.10].map(delta => {
    const rev = grossSales * (1 + delta);
    const prof = rev - totalCost;
    return { delta, revenue: rev, profit: prof, margin: prof / rev, roi: prof / totalCost };
  });

  return {
    plot, mixKey, mix, gfa, bua, landCost, units,
    prices, revBreak, grossSales, avgPsf,
    constructionCost, authorityFees, consultantFees, marketing, contingency, financing, totalCost,
    grossProfit, grossMargin, roi, breakEvenPsf,
    annualRent, grossYield,
    residentialFloors, floorPlate,
    sens,
    payPlan: tmpl.payPlan,
  };
}

// Formatting helpers
export const fmt = (n: number, dec = 0) => n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fmtM = (n: number) => `AED ${(n / 1000000).toFixed(2)}M`;
export const fmtA = (n: number) => `AED ${fmt(Math.round(n))}`;
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
