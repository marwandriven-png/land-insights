const TXN_AVG_PSF = { studio: 1796, br1: 1531, br2: 1368, br3: 1449 };
const UNIT_SIZES = { studio: 426, br1: 771, br2: 1208, br3: 1680 };
const RENT_PSF_YR = { studio: 90, br1: 86, br2: 83, br3: 78 };

const MIX_TEMPLATES: Record<string, { mix: Record<string, number>; payPlan: Record<string, number> }> = {
  investor: {
    mix: { studio: 0.50, br1: 0.30, br2: 0.15, br3: 0.05 },
    payPlan: { booking: 5, construction: 45, handover: 50 },
  },
  balanced: {
    mix: { studio: 0.35, br1: 0.35, br2: 0.25, br3: 0.05 },
    payPlan: { booking: 10, construction: 40, handover: 50 },
  },
  family: {
    mix: { studio: 0.15, br1: 0.30, br2: 0.40, br3: 0.15 },
    payPlan: { booking: 20, construction: 40, handover: 40 },
  },
};

export interface PlotParams {
  plotId: string;
  plotName?: string;
  areaSqft: number;
  gfaSqft?: number;
  far?: number;
  zoning?: string;
  area?: string;
  floors?: string;
  mixStrategy?: string;
  overrides?: {
    landCostPsf?: number;
    landCost?: number;
    constructionPsf?: number;
    efficiency?: number;
    buaMultiplier?: number;
    contingencyPct?: number;
    financePct?: number;
    unitPsf?: { studio?: number; br1?: number; br2?: number; br3?: number };
    unitSizes?: { studio?: number; br1?: number; br2?: number; br3?: number };
    unitRents?: { studio?: number; br1?: number; br2?: number; br3?: number };
    mix?: { studio?: number; br1?: number; br2?: number; br3?: number };
  };
}

export function runFeasibility(params: PlotParams) {
  const mixKey = params.mixStrategy || "balanced";
  const tmpl = MIX_TEMPLATES[mixKey] || MIX_TEMPLATES.balanced;
  const ov = params.overrides || {};

  const areaSqft = params.areaSqft;
  const far = params.far || (params.gfaSqft ? params.gfaSqft / areaSqft : 4.5);
  const gfa = params.gfaSqft || areaSqft * far;
  const efficiency = ov.efficiency || 0.95;
  const sellableArea = gfa * efficiency;
  const buaMultiplier = ov.buaMultiplier || 1.45;
  const bua = gfa * buaMultiplier;

  const mix = { ...tmpl.mix, ...ov.mix };

  const sizes = {
    studio: ov.unitSizes?.studio || UNIT_SIZES.studio,
    br1: ov.unitSizes?.br1 || UNIT_SIZES.br1,
    br2: ov.unitSizes?.br2 || UNIT_SIZES.br2,
    br3: ov.unitSizes?.br3 || UNIT_SIZES.br3,
  };
  const psf = {
    studio: ov.unitPsf?.studio || TXN_AVG_PSF.studio,
    br1: ov.unitPsf?.br1 || TXN_AVG_PSF.br1,
    br2: ov.unitPsf?.br2 || TXN_AVG_PSF.br2,
    br3: ov.unitPsf?.br3 || TXN_AVG_PSF.br3,
  };
  const rents = {
    studio: ov.unitRents?.studio || RENT_PSF_YR.studio,
    br1: ov.unitRents?.br1 || RENT_PSF_YR.br1,
    br2: ov.unitRents?.br2 || RENT_PSF_YR.br2,
    br3: ov.unitRents?.br3 || RENT_PSF_YR.br3,
  };

  const avgUnitSize = mix.studio * sizes.studio + mix.br1 * sizes.br1 + mix.br2 * sizes.br2 + mix.br3 * sizes.br3;
  const totalUnits = Math.round(sellableArea / avgUnitSize);
  const units = {
    studio: Math.round(totalUnits * mix.studio),
    br1: Math.round(totalUnits * mix.br1),
    br2: Math.round(totalUnits * mix.br2),
    br3: Math.round(totalUnits * mix.br3),
    total: 0,
  };
  units.total = units.studio + units.br1 + units.br2 + units.br3;

  const prices = {
    studio: sizes.studio * psf.studio,
    br1: sizes.br1 * psf.br1,
    br2: sizes.br2 * psf.br2,
    br3: sizes.br3 * psf.br3,
  };

  const grossSales =
    units.studio * prices.studio +
    units.br1 * prices.br1 +
    units.br2 * prices.br2 +
    units.br3 * prices.br3;

  const avgPsfDerived = sellableArea > 0 ? grossSales / sellableArea : 0;

  const landCostPsf = ov.landCostPsf || 148.23;
  const landCost = ov.landCost || gfa * landCostPsf;
  const constructionPsf = ov.constructionPsf || 420;
  const constructionCost = bua * constructionPsf;
  const authorityFees = landCost * 0.04;
  const consultantFees = constructionCost * 0.03;
  const marketing = grossSales * 0.02;
  const contingencyPct = ov.contingencyPct ?? 0.05;
  const financePct = ov.financePct ?? 0.03;
  const contingency = constructionCost * contingencyPct;
  const financing = grossSales * financePct;
  const totalCost = landCost + constructionCost + authorityFees + consultantFees + marketing + contingency + financing;

  const grossProfit = grossSales - totalCost;
  const grossMargin = grossSales > 0 ? grossProfit / grossSales : 0;
  const roi = totalCost > 0 ? grossProfit / totalCost : 0;
  const breakEvenPsf = sellableArea > 0 ? totalCost / sellableArea : 0;

  const annualRent =
    units.studio * (sizes.studio * rents.studio) +
    units.br1 * (sizes.br1 * rents.br1) +
    units.br2 * (sizes.br2 * rents.br2) +
    units.br3 * (sizes.br3 * rents.br3);
  const grossYield = grossSales > 0 ? annualRent / grossSales : 0;

  const sensitivity = [-0.10, -0.05, 0, 0.05, 0.10].map(delta => {
    const rev = grossSales * (1 + delta);
    const prof = rev - totalCost;
    return {
      psfChange: `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(0)}%`,
      revenue: Math.round(rev),
      profit: Math.round(prof),
      margin: +(prof / rev * 100).toFixed(1),
      roi: +(prof / totalCost * 100).toFixed(1),
    };
  });

  return {
    plot: {
      id: params.plotId,
      name: params.plotName || params.plotId,
      areaSqft,
      zoning: params.zoning || "N/A",
      area: params.area || "N/A",
      floors: params.floors || "N/A",
    },
    mixStrategy: mixKey,
    mix,
    paymentPlan: tmpl.payPlan,
    buildMetrics: {
      gfaSqft: Math.round(gfa),
      sellableAreaSqft: Math.round(sellableArea),
      buaSqft: Math.round(bua),
      far: +far.toFixed(2),
      efficiency,
      buaMultiplier,
      floorPlateSqft: Math.round(areaSqft * efficiency),
      residentialFloors: Math.ceil(gfa / (areaSqft * efficiency)),
    },
    units,
    unitPricing: {
      avgSellingPrices: prices,
      psfUsed: psf,
      unitSizesUsed: sizes,
    },
    revenue: {
      grossDevelopmentValue: Math.round(grossSales),
      avgPsf: Math.round(avgPsfDerived),
      revenueByType: {
        studio: Math.round(units.studio * prices.studio),
        br1: Math.round(units.br1 * prices.br1),
        br2: Math.round(units.br2 * prices.br2),
        br3: Math.round(units.br3 * prices.br3),
      },
    },
    costs: {
      landCost: Math.round(landCost),
      landCostPsf: +landCostPsf.toFixed(2),
      constructionCost: Math.round(constructionCost),
      constructionPsf,
      authorityFees: Math.round(authorityFees),
      consultantFees: Math.round(consultantFees),
      marketing: Math.round(marketing),
      contingency: Math.round(contingency),
      financing: Math.round(financing),
      totalDevelopmentCost: Math.round(totalCost),
    },
    profitability: {
      grossProfit: Math.round(grossProfit),
      grossMarginPct: +(grossMargin * 100).toFixed(1),
      roiPct: +(roi * 100).toFixed(1),
      breakEvenPsf: Math.round(breakEvenPsf),
    },
    rentalAnalysis: {
      annualRentalIncome: Math.round(annualRent),
      grossYieldPct: +(grossYield * 100).toFixed(2),
      rentPsfUsed: rents,
    },
    sensitivity,
    generatedAt: new Date().toISOString(),
  };
}
