// ═══════════════════════════════════════════════════════════════════════════
// PLOT SIMILARITY ENGINE
// Detects comparable plots within ±6% size range
// Comparison: Plot Size · GFA · Land Use · Height Limit · Location
// ═══════════════════════════════════════════════════════════════════════════

import type {
  PlotRecord,
  TransactionRecord,
  ComparablePlot,
  SimilarityResult,
} from '@/types/landos';

// ── Scoring weights ───────────────────────────────────────────────────────────

const WEIGHTS = {
  plotSizeCloseness: 40,
  sameArea:          20,
  gfaMatch:          15,
  landUseMatch:      10,
  heightMatch:        8,
  hasTransaction:     7,
} as const;

// ── Utility helpers ───────────────────────────────────────────────────────────

const sqftToSqm = (sqft: number): number => Math.round(sqft / 10.7639);

function pctDiff(a: number, b: number): number {
  if (!a || !b) return 0;
  return ((a - b) / b) * 100;
}

function normaliseArea(area: string): string {
  return (area || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseLandUse(use: string): string {
  return (use || '')
    .toLowerCase()
    .split(/[/,\s]/)[0]
    .trim();
}

function parseHeightMetres(h: string | number | undefined): number | null {
  if (h === undefined || h === null || h === '') return null;
  const n = parseFloat(String(h));
  return isNaN(n) ? null : n;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// ── Core scoring function ─────────────────────────────────────────────────────

function scoreComparable(
  comp: Omit<ComparablePlot, 'simScore'>,
  target: { plotSizeSqft: number; gfaSqft: number; area: string; landUse: string; heightM: number | null },
  tolerance: number,
): number {
  const absSizeDiff = Math.abs(comp.sizeDiff);
  if (absSizeDiff > tolerance * 100) return 0;

  const sizeScore = WEIGHTS.plotSizeCloseness * (1 - absSizeDiff / (tolerance * 100));

  const targetArea = normaliseArea(target.area);
  const compArea   = normaliseArea(comp.area);
  const sameArea   = targetArea && compArea && compArea.includes(targetArea);
  const areaScore  = sameArea ? WEIGHTS.sameArea : 0;

  let gfaScore = 0;
  if (target.gfaSqft > 0 && comp.gfaSqft > 0) {
    const gfaDiffPct = Math.abs(pctDiff(comp.gfaSqft, target.gfaSqft));
    if (gfaDiffPct <= tolerance * 100) {
      gfaScore = WEIGHTS.gfaMatch * (1 - gfaDiffPct / (tolerance * 100));
    }
  } else {
    gfaScore = WEIGHTS.gfaMatch * 0.3;
  }

  const targetUse = normaliseLandUse(target.landUse);
  const compUse   = normaliseLandUse(comp.landUse);
  const landUseScore = targetUse && compUse && compUse === targetUse
    ? WEIGHTS.landUseMatch
    : (targetUse && compUse && (compUse.includes(targetUse) || targetUse.includes(compUse)))
    ? WEIGHTS.landUseMatch * 0.5
    : 0;

  const targetH = target.heightM;
  const compH   = parseHeightMetres(comp.heightLimit);
  let heightScore = 0;
  if (targetH && compH) {
    const hDiff = Math.abs(pctDiff(compH, targetH));
    heightScore = hDiff <= 15 ? WEIGHTS.heightMatch * (1 - hDiff / 15) : 0;
  } else {
    heightScore = WEIGHTS.heightMatch * 0.2;
  }

  const txScore = comp.source === 'TX' && comp.price ? WEIGHTS.hasTransaction : 0;

  const total = sizeScore + areaScore + gfaScore + landUseScore + heightScore + txScore;
  return Math.min(Math.round(total), 100);
}

// ── Map transaction record → ComparablePlot (unscored) ───────────────────────

function txToComp(
  t: TransactionRecord,
  targetSqft: number,
): Omit<ComparablePlot, 'simScore'> | null {
  const plotSqft = t.plot_size_sqft ?? 0;
  if (!plotSqft) return null;

  const sizeDiff = pctDiff(plotSqft, targetSqft);
  const gfaSqft  = t.gfa_sqft ?? 0;

  return {
    source:       'TX',
    plotNumber:   t.land_number   ?? 'N/A',
    area:         t.development   ?? '—',
    plotSizeSqft: Math.round(plotSqft),
    plotSizeSqm:  sqftToSqm(plotSqft),
    gfaSqft:      Math.round(gfaSqft),
    gfaSqm:       sqftToSqm(gfaSqft),
    far:          t.far           ?? null,
    landUse:      t.landuse       ?? '—',
    heightLimit:  t.height        ?? '—',
    price:        t.price_aed,
    psf:          t.psf_gfa_aed,
    date:         t.evidence_date,
    sizeDiff:     parseFloat(sizeDiff.toFixed(1)),
    gfaDiff:      null,
    sameArea:     false,
  };
}

// ── Map internal PlotRecord → ComparablePlot (unscored) ──────────────────────

function plotToComp(
  l: PlotRecord,
  targetSqft: number,
): Omit<ComparablePlot, 'simScore'> | null {
  const plotSqft = l.plotSize ?? 0;
  if (!plotSqft) return null;

  const sizeDiff = pctDiff(plotSqft, targetSqft);
  const gfaSqft  = l.gfaSqft ?? 0;

  return {
    source:       'LAND_OS',
    plotNumber:   l.plotNumber,
    area:         l.area,
    plotSizeSqft: Math.round(plotSqft),
    plotSizeSqm:  sqftToSqm(plotSqft),
    gfaSqft:      Math.round(gfaSqft),
    gfaSqm:       sqftToSqm(gfaSqft),
    far:          null,
    landUse:      l.landUse ?? '—',
    heightLimit:  typeof l.floors === 'number' ? `${l.floors} floors` : (l.floors ?? '—'),
    price:        l.askingPrice,
    psf:          l.askingPrice && plotSqft ? Math.round(l.askingPrice / plotSqft) : undefined,
    date:         l.createdAt,
    sizeDiff:     parseFloat(sizeDiff.toFixed(1)),
    gfaDiff:      null,
    sameArea:     false,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function findSimilarPlots(
  target: PlotRecord,
  transactions: TransactionRecord[],
  allPlots: PlotRecord[],
  options: {
    tolerance?: number;
    maxResults?: number;
  } = {},
): SimilarityResult {
  const { tolerance = 0.06, maxResults = 8 } = options;
  const targetSqft = target.plotSize ?? 0;
  const targetGfaSqft = target.gfaSqft ?? 0;
  const targetHeightM = target.floors
    ? typeof target.floors === 'number' ? target.floors * 3.5 : null
    : null;

  if (!targetSqft) {
    return {
      comparable: [],
      stats: { count: 0, avgPSF: 0, avgPlotSqm: 0, avgGfaSqm: 0, medianPSF: 0 },
      targetPlot: {
        plotNumber: target.plotNumber,
        area:       target.area,
        plotSizeSqm: 0,
        gfaSqm:      0,
        landUse:     target.landUse ?? '',
      },
      message: 'Plot size required for similarity analysis.',
    };
  }

  const scoreTarget = {
    plotSizeSqft: targetSqft,
    gfaSqft:      targetGfaSqft,
    area:         target.area,
    landUse:      target.landUse ?? '',
    heightM:      targetHeightM,
  };

  const candidates: ComparablePlot[] = [];

  for (const t of transactions) {
    const plotSqft = t.plot_size_sqft ?? 0;
    if (!plotSqft) continue;
    if (t.land_number === target.plotNumber) continue;
    if (Math.abs(pctDiff(plotSqft, targetSqft)) > tolerance * 100) continue;

    const base = txToComp(t, targetSqft);
    if (!base) continue;

    base.sameArea = normaliseArea(base.area).includes(normaliseArea(target.area));
    if (targetGfaSqft && base.gfaSqft) {
      base.gfaDiff = parseFloat(Math.abs(pctDiff(base.gfaSqft, targetGfaSqft)).toFixed(1));
    }

    const score = scoreComparable(base, scoreTarget, tolerance);
    candidates.push({ ...base, simScore: score });
  }

  for (const l of allPlots) {
    if (l.id === target.id) continue;
    const plotSqft = l.plotSize ?? 0;
    if (!plotSqft) continue;
    if (Math.abs(pctDiff(plotSqft, targetSqft)) > tolerance * 100) continue;

    const base = plotToComp(l, targetSqft);
    if (!base) continue;

    base.sameArea = normaliseArea(base.area).includes(normaliseArea(target.area));
    if (targetGfaSqft && base.gfaSqft) {
      base.gfaDiff = parseFloat(Math.abs(pctDiff(base.gfaSqft, targetGfaSqft)).toFixed(1));
    }

    const score = scoreComparable(base, scoreTarget, tolerance);
    candidates.push({ ...base, simScore: score });
  }

  const sorted = candidates
    .sort((a, b) => b.simScore - a.simScore)
    .slice(0, maxResults);

  const withPSF  = sorted.filter((c) => (c.psf ?? 0) > 0).map((c) => c.psf!);
  const withGFA  = sorted.filter((c) => c.gfaSqm > 0);
  const avgPSF   = withPSF.length ? Math.round(withPSF.reduce((s, v) => s + v, 0) / withPSF.length) : 0;
  const avgPlot  = sorted.length  ? Math.round(sorted.reduce((s, c) => s + c.plotSizeSqm, 0) / sorted.length) : 0;
  const avgGFA   = withGFA.length ? Math.round(withGFA.reduce((s, c) => s + c.gfaSqm, 0) / withGFA.length) : 0;

  return {
    comparable: sorted,
    stats: {
      count:        sorted.length,
      avgPSF,
      avgPlotSqm:   avgPlot,
      avgGfaSqm:    avgGFA,
      medianPSF:    Math.round(median(withPSF)),
    },
    targetPlot: {
      plotNumber:   target.plotNumber,
      area:         target.area,
      plotSizeSqm:  sqftToSqm(targetSqft),
      gfaSqm:       sqftToSqm(targetGfaSqft),
      landUse:      target.landUse ?? '',
    },
    message: sorted.length
      ? null
      : 'No comparable plots found within ±6%. Sync pipeline data for better results.',
  };
}

export function getAreaAvgPSF(area: string, transactions: TransactionRecord[]): number {
  const norm  = normaliseArea(area);
  const valid = transactions.filter(
    (t) =>
      t.psf_gfa_aed &&
      t.psf_gfa_aed > 0 &&
      normaliseArea(t.development ?? '').includes(norm),
  );
  if (!valid.length) return 0;
  return Math.round(valid.reduce((s, t) => s + (t.psf_gfa_aed ?? 0), 0) / valid.length);
}
