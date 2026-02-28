type AnyRecord = Record<string, any>;

type CanonicalArea = 'Majan' | 'DLRC' | 'Al Satwa' | 'Dubai Sports City' | 'Dubai Industrial City' | 'Bukadra' | 'Meydan';

const AREA_ALIASES: Record<CanonicalArea, string[]> = {
  Majan: ['majan'],
  DLRC: ['dlrc', 'dubai land residential complex', 'dubailand residential complex', 'dubai residence complex'],
  'Al Satwa': ['al satwa', 'jumeirah garden city', 'alsatwa', 'jgc'],
  'Dubai Sports City': ['dubai sports city', 'dsc', 'sports city'],
  'Dubai Industrial City': ['dubai industrial city', 'dic', 'saih shuaib 2', 'saih shuaib2'],
  Bukadra: ['bukadra', 'ras al khor industrial'],
  Meydan: ['meydan', 'meydan horizon'],
};

const normalizeAreaName = (value: string): CanonicalArea | null => {
  const text = value.toLowerCase();
  for (const [canonical, aliases] of Object.entries(AREA_ALIASES) as [CanonicalArea, string[]][]) {
    if (aliases.some((alias) => text.includes(alias))) return canonical;
  }
  return null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const matches = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/g);
  if (!matches?.length) return null;
  const nums = matches.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  if (nums.length === 1) return nums[0];
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
};

const ensureTxnShape = (obj: AnyRecord = {}): AnyRecord => ({
  ...obj,
  unitPsf: obj.unitPsf && typeof obj.unitPsf === 'object' ? obj.unitPsf : {},
  unitSizes: obj.unitSizes && typeof obj.unitSizes === 'object' ? obj.unitSizes : {},
  medianPsf: obj.medianPsf && typeof obj.medianPsf === 'object' ? obj.medianPsf : {},
  avgPrices: obj.avgPrices && typeof obj.avgPrices === 'object' ? obj.avgPrices : {},
  txnCount: obj.txnCount && typeof obj.txnCount === 'object' ? obj.txnCount : {},
});

const parseSummaryTableAreaTransactions = (fileContent: string): Record<string, AnyRecord> => {
  const result: Record<string, AnyRecord> = {};
  const lines = fileContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i += 1) {
    const canonical = normalizeAreaName(lines[i]);
    if (!canonical) continue;

    const nextLines: string[] = [];
    for (let j = i + 1; j < Math.min(lines.length, i + 12); j += 1) {
      if (normalizeAreaName(lines[j])) break;
      nextLines.push(lines[j]);
    }

    if (!nextLines.length) continue;

    const txnToken = nextLines.find((line) => /\d/.test(line));
    const totalTxns = toNumber(txnToken);

    const txnIndex = txnToken ? nextLines.indexOf(txnToken) : -1;
    const psfSource = txnIndex >= 0 ? nextLines.slice(txnIndex + 1) : nextLines;
    const psfValues = psfSource
      .map((line) => toNumber(line))
      .filter((n): n is number => n != null && n >= 500 && n <= 6000)
      .slice(0, 3);

    const rentLine = nextLines.find((line) => /AED/i.test(line));
    const rentPsf = toNumber(rentLine);

    if (!totalTxns && !psfValues.length && !rentPsf) continue;

    result[canonical] = ensureTxnShape({
      unitPsf: {
        ...(psfValues[0] ? { studio: psfValues[0] } : {}),
        ...(psfValues[1] ? { br1: psfValues[1] } : {}),
        ...(psfValues[2] ? { br2: psfValues[2] } : {}),
      },
      unitRents: rentPsf
        ? { studio: rentPsf, br1: rentPsf, br2: Math.max(0, Math.round(rentPsf * 0.95)), br3: Math.max(0, Math.round(rentPsf * 0.9)) }
        : undefined,
      txnCount: totalTxns ? { total: totalTxns } : {},
      marketFloorPsf: psfValues.length ? Math.min(...psfValues) : undefined,
      marketAvgPsf: psfValues.length ? Math.round(psfValues.reduce((s, n) => s + n, 0) / psfValues.length) : undefined,
      marketCeilingPsf: psfValues.length ? Math.max(...psfValues) : undefined,
    });
  }

  return result;
};

const normalizeComparables = (comparables: AnyRecord[]): AnyRecord[] => {
  return comparables.map((comp) => {
    const areaText = [comp?.area, comp?.community, comp?.location, comp?.areaName].filter(Boolean).join(' ');
    const canonicalArea = normalizeAreaName(areaText);
    return {
      ...comp,
      ...(canonicalArea ? { area: canonicalArea } : {}),
    };
  });
};

const buildComparableFallbackTransactions = (comparables: AnyRecord[]): Record<string, AnyRecord> => {
  const grouped: Record<string, number[]> = {};

  for (const comp of comparables) {
    const canonical = normalizeAreaName([comp?.area, comp?.community, comp?.location].filter(Boolean).join(' '));
    if (!canonical) continue;

    const values = [comp?.psf, comp?.studioP, comp?.br1P, comp?.br2P, comp?.br3P]
      .map(toNumber)
      .filter((n): n is number => n != null && n > 100);

    if (!values.length) continue;
    grouped[canonical] = [...(grouped[canonical] || []), ...values];
  }

  const out: Record<string, AnyRecord> = {};
  for (const [area, values] of Object.entries(grouped)) {
    const avg = Math.round(values.reduce((s, n) => s + n, 0) / values.length);
    out[area] = ensureTxnShape({
      unitPsf: { studio: avg, br1: avg, br2: avg },
      marketFloorPsf: Math.min(...values),
      marketAvgPsf: avg,
      marketCeilingPsf: Math.max(...values),
    });
  }
  return out;
};

const mergeTransactions = (base: Record<string, AnyRecord>, addition: Record<string, AnyRecord>) => {
  for (const [area, incoming] of Object.entries(addition)) {
    const prev = ensureTxnShape(base[area] || {});
    const next = ensureTxnShape(incoming || {});

    base[area] = {
      ...prev,
      ...next,
      unitPsf: { ...prev.unitPsf, ...next.unitPsf },
      unitSizes: { ...prev.unitSizes, ...next.unitSizes },
      medianPsf: { ...prev.medianPsf, ...next.medianPsf },
      avgPrices: { ...prev.avgPrices, ...next.avgPrices },
      txnCount: { ...prev.txnCount, ...next.txnCount },
      unitRents: { ...(prev.unitRents || {}), ...(next.unitRents || {}) },
      marketFloorPsf: next.marketFloorPsf ?? prev.marketFloorPsf,
      marketAvgPsf: next.marketAvgPsf ?? prev.marketAvgPsf,
      marketCeilingPsf: next.marketCeilingPsf ?? prev.marketCeilingPsf,
    };
  }
};

export const postProcessMarketData = (marketData: AnyRecord, fileContent: string): AnyRecord => {
  const output: AnyRecord = { ...(marketData || {}) };

  const comparables = Array.isArray(output.comparables) ? normalizeComparables(output.comparables as AnyRecord[]) : [];
  output.comparables = comparables;

  const baseAreaTransactions: Record<string, AnyRecord> = {};
  if (output.areaTransactions && typeof output.areaTransactions === 'object') {
    for (const [rawKey, value] of Object.entries(output.areaTransactions as Record<string, AnyRecord>)) {
      const canonical = normalizeAreaName(rawKey);
      if (!canonical) continue;
      baseAreaTransactions[canonical] = ensureTxnShape(value);
    }
  }

  const summaryExtracted = parseSummaryTableAreaTransactions(fileContent || '');
  const fromComparables = buildComparableFallbackTransactions(comparables);

  mergeTransactions(baseAreaTransactions, fromComparables);
  mergeTransactions(baseAreaTransactions, summaryExtracted);

  output.areaTransactions = baseAreaTransactions;
  return output;
};
