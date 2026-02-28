import { AREA_ALIAS_MAP, normalizeAreaCode } from '@/lib/clffAreaDefaults';

type AnyRecord = Record<string, any>;

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function extractAreaCodes(input?: string | null): string[] {
  if (!input) return [];

  const direct = normalizeAreaCode(input);
  const normalizedInput = ` ${normalizeText(input)} `;
  const found = new Set<string>(direct ? [direct] : []);

  Object.entries(AREA_ALIAS_MAP).forEach(([alias, code]) => {
    const normalizedAlias = ` ${normalizeText(alias)} `;
    if (normalizedAlias.trim() && normalizedInput.includes(normalizedAlias)) {
      found.add(code);
    }
  });

  return Array.from(found);
}

export function matchesAreaCode(input: string | null | undefined, targetCode: string | null | undefined): boolean {
  if (!input || !targetCode) return false;
  return extractAreaCodes(input).includes(targetCode);
}

export function resolvePlotAreaCode(location?: string | null, planLandName?: string | null, fallbackCode?: string | null): string | null {
  const planCodes = extractAreaCodes(planLandName || '');
  if (planCodes.length > 0) return planCodes[0];

  const locCodes = extractAreaCodes(location || '');
  if (locCodes.length > 0) return locCodes[0];

  return fallbackCode || null;
}

export function getAreaScopedMarketData(aiData: AnyRecord | null | undefined, plotCode: string | null): AnyRecord | null {
  if (!aiData) return null;

  const comparables = Array.isArray(aiData.comparables) ? aiData.comparables : [];
  const areaTransactions = aiData.areaTransactions && typeof aiData.areaTransactions === 'object'
    ? (aiData.areaTransactions as AnyRecord)
    : null;

  if (!plotCode) {
    return {
      comparables: [],
      areaTxn: null,
      unitPsf: null,
      unitSizes: null,
      unitRents: null,
      avgPrices: null,
      medianPsf: null,
      txnCount: null,
      marketFloorPsf: null,
      marketAvgPsf: null,
      marketCeilingPsf: null,
    };
  }

  const filteredComparables = comparables.filter((comp: AnyRecord) => {
    const scope = [comp?.area, comp?.location, comp?.name].filter(Boolean).join(' ');
    return matchesAreaCode(scope, plotCode);
  });

  let areaTxn: AnyRecord | null = null;
  if (areaTransactions) {
    for (const [key, value] of Object.entries(areaTransactions)) {
      if (matchesAreaCode(key, plotCode)) {
        areaTxn = value as AnyRecord;
        break;
      }
    }
  }

  const hasMultiAreaTxn = !!areaTransactions && Object.keys(areaTransactions).length > 1;
  const topLevelLooksScoped = matchesAreaCode(aiData.areaName || aiData.areaCode || '', plotCode);

  const canUseTopLevel = !hasMultiAreaTxn && topLevelLooksScoped;

  return {
    comparables: filteredComparables,
    areaTxn,
    unitPsf: areaTxn?.unitPsf || (canUseTopLevel ? aiData.unitPsf : null),
    unitSizes: areaTxn?.unitSizes || (canUseTopLevel ? aiData.unitSizes : null),
    unitRents: canUseTopLevel ? aiData.unitRents : null,
    avgPrices: areaTxn?.avgPrices || (canUseTopLevel ? aiData.avgPrices : null),
    medianPsf: areaTxn?.medianPsf || (canUseTopLevel ? aiData.medianPsf : null),
    txnCount: areaTxn?.txnCount || (canUseTopLevel ? aiData.txnCount : null),
    marketFloorPsf: areaTxn?.marketFloorPsf || (canUseTopLevel ? aiData.marketFloorPsf : null),
    marketAvgPsf: areaTxn?.marketAvgPsf || (canUseTopLevel ? aiData.marketAvgPsf : null),
    marketCeilingPsf: areaTxn?.marketCeilingPsf || (canUseTopLevel ? aiData.marketCeilingPsf : null),
  };
}
