// ═══════════════════════════════════════════════════════════════════════════
// FEASIBILITY ENGINE
// Inputs: LandOS data + transaction data
// Outputs: GDV, Construction Cost, Land Cost, Development Cost,
//          Net Profit, ROI, Break-Even Price, Unit Mix, Sensitivity
// ═══════════════════════════════════════════════════════════════════════════

import type {
  FeasibilityInputs,
  FeasibilityResult,
  LandUseCategory,
  UnitMixItem,
  SensitivityScenario,
} from '@/types/landos';

// ── Construction cost benchmarks (AED/sqft) ───────────────────────────────────

const CONSTRUCTION_PSF: Record<LandUseCategory, number> = {
  residential: 380,
  villa:       420,
  mixed:       400,
  commercial:  350,
  retail:      320,
};

// ── Sellable ratio by land use ───────────────────────────────────────────────

const SELLABLE_RATIO: Record<LandUseCategory, number> = {
  residential: 0.82,
  villa:       0.88,
  mixed:       0.80,
  commercial:  0.85,
  retail:      0.90,
};

// ── Default sale PSF benchmarks by land use (AED/sqft) ───────────────────────

const DEFAULT_SALE_PSF: Record<LandUseCategory, number> = {
  residential: 1_450,
  villa:       1_800,
  mixed:       1_550,
  commercial:  1_200,
  retail:      1_100,
};

// ── Unit mix templates ─────────────────────────────────────────────────────────

interface UnitTemplate { type: string; avgSqft: number; pct: number }

const UNIT_MIX_TEMPLATES: Record<LandUseCategory, UnitTemplate[]> = {
  residential: [
    { type: 'Studio', avgSqft: 450,   pct: 0.20 },
    { type: '1 BR',   avgSqft: 780,   pct: 0.40 },
    { type: '2 BR',   avgSqft: 1_150, pct: 0.30 },
    { type: '3 BR',   avgSqft: 1_500, pct: 0.10 },
  ],
  villa: [
    { type: '4 BR Villa', avgSqft: 3_800, pct: 0.50 },
    { type: '5 BR Villa', avgSqft: 5_200, pct: 0.30 },
    { type: '6 BR Villa', avgSqft: 7_000, pct: 0.20 },
  ],
  mixed: [
    { type: 'Studio',   avgSqft: 450,   pct: 0.15 },
    { type: '1 BR',     avgSqft: 750,   pct: 0.30 },
    { type: '2 BR',     avgSqft: 1_100, pct: 0.35 },
    { type: '3 BR',     avgSqft: 1_500, pct: 0.10 },
    { type: 'Retail',   avgSqft: 800,   pct: 0.10 },
  ],
  commercial: [
    { type: 'Office (Small)',  avgSqft: 800,   pct: 0.40 },
    { type: 'Office (Medium)', avgSqft: 2_000, pct: 0.40 },
    { type: 'Office (Large)',  avgSqft: 5_000, pct: 0.20 },
  ],
  retail: [
    { type: 'Shop (Small)',  avgSqft: 400,   pct: 0.50 },
    { type: 'Shop (Medium)', avgSqft: 900,   pct: 0.30 },
    { type: 'Anchor Unit',   avgSqft: 3_000, pct: 0.20 },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectLandUseCategory(landUse: string): LandUseCategory {
  const u = (landUse || '').toLowerCase();
  if (u.includes('villa'))       return 'villa';
  if (u.includes('retail'))      return 'retail';
  if (u.includes('commercial') || u.includes('office')) return 'commercial';
  if (u.includes('mixed'))       return 'mixed';
  return 'residential';
}

function buildUnitMix(
  sellableSqft: number,
  category: LandUseCategory,
  salePSF: number,
): UnitMixItem[] {
  const template = UNIT_MIX_TEMPLATES[category];
  return template
    .map((t) => {
      const areaSqft = sellableSqft * t.pct;
      const units    = Math.max(1, Math.round(areaSqft / t.avgSqft));
      const unitGDV  = units * t.avgSqft * salePSF;
      return {
        type:         t.type,
        units,
        avgSizeSqft:  t.avgSqft,
        totalAreaSqft: Math.round(areaSqft),
        pctGfa:        Math.round(t.pct * 100),
        avgSalePSF:   salePSF,
        unitGDV,
      };
    })
    .filter((u) => u.units > 0);
}

function buildSensitivity(
  sellableSqft: number,
  baseSalePSF: number,
  totalDevCost: number,
): SensitivityScenario[] {
  return [-15, -10, 0, 10, 15].map((pct) => {
    const adjPSF    = baseSalePSF * (1 + pct / 100);
    const adjGDV    = sellableSqft * adjPSF;
    const profit    = adjGDV - totalDevCost;
    const roi       = totalDevCost > 0 ? (profit / totalDevCost) * 100 : 0;
    const margin    = adjGDV > 0 ? (profit / adjGDV) * 100 : 0;
    return {
      label:         pct === 0 ? 'Base Case' : pct > 0 ? `+${pct}% Upside` : `${pct}% Downside`,
      salePSF:       Math.round(adjPSF),
      gdv:           Math.round(adjGDV),
      netProfit:     Math.round(profit),
      roi:           parseFloat(roi.toFixed(1)),
      profitMargin:  parseFloat(margin.toFixed(1)),
      viable:        roi >= 12,
    };
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export function runFeasibility(
  inputs: FeasibilityInputs,
  marketPSF = 0,
): FeasibilityResult {
  const plotSqft = inputs.plotSizeSqft || 0;
  const plotSqm  = Math.round(plotSqft / 10.7639);

  const landUseCategory = detectLandUseCategory(inputs.landUse ?? '');

  const defaultFAR: Record<LandUseCategory, number> = {
    residential: 3.5, villa: 1.2, mixed: 4.0, commercial: 5.0, retail: 2.0,
  };
  const far = inputs.far ?? defaultFAR[landUseCategory];

  const gfaSqft = inputs.gfaSqft ?? Math.round(plotSqft * far);
  const gfaSqm  = Math.round(gfaSqft / 10.7639);

  const floors      = inputs.floors ?? Math.max(1, Math.round(gfaSqft / Math.max(plotSqft, 1)));
  const heightLimit = inputs.heightLimit ?? Math.round(floors * 3.5);

  const sellRatio   = inputs.sellableRatio ?? SELLABLE_RATIO[landUseCategory];
  const sellableSqft = Math.round(gfaSqft * sellRatio);
  const sellableSqm  = Math.round(sellableSqft / 10.7639);

  const landCost         = inputs.landCost ?? Math.round(plotSqft * 220);
  const constrPSF        = inputs.constructionPSF ?? CONSTRUCTION_PSF[landUseCategory];
  const constructionCost = Math.round(gfaSqft * constrPSF);

  const profFeePct    = inputs.profFeesPct    ?? 0.07;
  const finCostPct    = inputs.finCostPct     ?? 0.04;
  const marketingPct  = inputs.marketingPct   ?? 0.03;
  const contingPct    = inputs.contingencyPct ?? 0.05;

  const profFeesCost   = Math.round((constructionCost + landCost) * profFeePct);
  const finCostVal     = Math.round((constructionCost + landCost) * finCostPct);
  const contingencyCost = Math.round(constructionCost * contingPct);

  const salePSF = inputs.salePSF
    ?? (marketPSF > 0 ? marketPSF : DEFAULT_SALE_PSF[landUseCategory]);

  const marketingCost = Math.round(sellableSqft * salePSF * marketingPct);
  const gdv           = Math.round(sellableSqft * salePSF);

  const totalDevCost = landCost + constructionCost + profFeesCost + finCostVal + marketingCost + contingencyCost;

  const netProfit    = gdv - totalDevCost;
  const roi          = totalDevCost > 0 ? (netProfit / totalDevCost) * 100 : 0;
  const irr          = roi * 0.68;
  const profitMargin = gdv > 0 ? (netProfit / gdv) * 100 : 0;
  const breakEvenPSF = sellableSqft > 0 ? totalDevCost / sellableSqft : 0;

  const unitMix   = buildUnitMix(sellableSqft, landUseCategory, salePSF);
  const totalUnits = unitMix.reduce((s, u) => s + u.units, 0);

  const sensitivity = buildSensitivity(sellableSqft, salePSF, totalDevCost);

  return {
    plotSqm, plotSqft,
    gfaSqm,  gfaSqft,
    sellableSqft, sellableSqm,
    far, floors, heightLimit,
    landUse:          inputs.landUse ?? '',
    landUseCategory,
    gdv, salePSF,
    landCost, constructionCost, profFeesCost,
    finCostVal, marketingCost, contingencyCost, totalDevCost,
    netProfit,
    roi:           parseFloat(roi.toFixed(1)),
    irr:           parseFloat(irr.toFixed(1)),
    profitMargin:  parseFloat(profitMargin.toFixed(1)),
    breakEvenPSF:  Math.round(breakEvenPSF),
    unitMix, totalUnits,
    sensitivity,
    landOSUsed:       !!inputs.gfaSqft && !!inputs.far,
    gisUsed:          false,
    marketPSFSource:  marketPSF > 0 ? 'transactions' : 'default',
    computedAt:       new Date().toISOString(),
  };
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export const fmt = {
  aed:    (n: number, dp = 1) => `AED ${(n / 1_000_000).toFixed(dp)}M`,
  aedK:   (n: number)         => `AED ${Math.round(n / 1_000).toLocaleString()}K`,
  pct:    (n: number, dp = 1) => `${n.toFixed(dp)}%`,
  psf:    (n: number)         => `AED ${Math.round(n).toLocaleString()}/sqft`,
  sqm:    (n: number)         => `${Math.round(n).toLocaleString()} m²`,
  sqft:   (n: number)         => `${Math.round(n).toLocaleString()} sqft`,
  number: (n: number)         => Math.round(n).toLocaleString(),
} as const;
