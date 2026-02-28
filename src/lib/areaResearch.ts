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

export function extractSingleAreaCode(input?: string | null): string | null {
  const codes = extractAreaCodes(input || '');
  return codes.length === 1 ? codes[0] : null;
}

export function matchesAreaCode(input: string | null | undefined, targetCode: string | null | undefined): boolean {
  if (!input || !targetCode) return false;
  return extractAreaCodes(input).includes(targetCode);
}

export function resolvePlotAreaCode(location?: string | null, planLandName?: string | null, fallbackCode?: string | null): string | null {
  const planCode = extractSingleAreaCode(planLandName || '');
  if (planCode) return planCode;

  const locCode = extractSingleAreaCode(location || '');
  if (locCode) return locCode;

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

  const comparableCodes = new Set<string>();

  // STRICT: Filter comparables by a single resolved area code only
  const filteredComparables = comparables.filter((comp: AnyRecord) => {
    const resolvedComparableCode =
      extractSingleAreaCode(comp?.area) ||
      extractSingleAreaCode(comp?.community) ||
      extractSingleAreaCode(comp?.location) ||
      extractSingleAreaCode(comp?.project) ||
      extractSingleAreaCode(comp?.name) ||
      extractSingleAreaCode(comp?.areaName);

    if (resolvedComparableCode) comparableCodes.add(resolvedComparableCode);

    return !!resolvedComparableCode && resolvedComparableCode === plotCode;
  });

  // Look up per-area transaction data (single-area keys only)
  let areaTxn: AnyRecord | null = null;
  if (areaTransactions) {
    for (const [key, value] of Object.entries(areaTransactions)) {
      const keyCode = extractSingleAreaCode(key);
      if (keyCode === plotCode) {
        areaTxn = value as AnyRecord;
        break;
      }
    }
  }

  const hasMultiAreaTxn = !!areaTransactions && Object.keys(areaTransactions).length > 1;
  const hasAmbiguousAreaTxnKeys = !!areaTransactions && Object.keys(areaTransactions).some((key) => extractAreaCodes(key).length !== 1);
  const hasMultiAreaComparables = comparableCodes.size > 1;
  const hasComparableRows = comparables.length > 0;
  const hasConfirmedSingleAreaComparables = comparableCodes.size === 1 && comparableCodes.has(plotCode);
  const topLevelCode = extractSingleAreaCode(aiData.areaName || aiData.areaCode || '');
  const topLevelLooksScoped = topLevelCode === plotCode;

  // STRICT: top-level fallback allowed only if source is clearly single-area
  const canUseTopLevel =
    !hasMultiAreaTxn &&
    !hasAmbiguousAreaTxnKeys &&
    !hasMultiAreaComparables &&
    topLevelLooksScoped &&
    (!hasComparableRows || hasConfirmedSingleAreaComparables || !!areaTxn);

  // For multi-area docs: ONLY per-area transaction data survives, no top-level fallback
  return {
    comparables: filteredComparables,
    areaTxn,
    unitPsf: areaTxn?.unitPsf ?? (canUseTopLevel ? aiData.unitPsf : null),
    unitSizes: areaTxn?.unitSizes ?? (canUseTopLevel ? aiData.unitSizes : null),
    unitRents: areaTxn?.unitRents ?? (canUseTopLevel ? aiData.unitRents : null),
    avgPrices: areaTxn?.avgPrices ?? (canUseTopLevel ? aiData.avgPrices : null),
    medianPsf: areaTxn?.medianPsf ?? (canUseTopLevel ? aiData.medianPsf : null),
    txnCount: areaTxn?.txnCount ?? (canUseTopLevel ? aiData.txnCount : null),
    marketFloorPsf: areaTxn?.marketFloorPsf ?? (canUseTopLevel ? aiData.marketFloorPsf : null),
    marketAvgPsf: areaTxn?.marketAvgPsf ?? (canUseTopLevel ? aiData.marketAvgPsf : null),
    marketCeilingPsf: areaTxn?.marketCeilingPsf ?? (canUseTopLevel ? aiData.marketCeilingPsf : null),
    isMultiArea: hasMultiAreaTxn,
    isStrictlyScoped: !!areaTxn || canUseTopLevel,
  };
}
