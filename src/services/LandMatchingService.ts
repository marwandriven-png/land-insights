// Land Matching Wizard - Text file parsing and matching logic

export interface ParcelInput {
  area: string;
  plotArea: number;
  plotAreaUnit: 'sqm' | 'sqft' | 'unknown';
  gfa: number;
  gfaUnit: 'sqm' | 'sqft' | 'unknown';
  zoning: string;
  use: string;
  heightFloors: number;
  far: number;
  plotNumber?: string;
  // Normalized values (in sqm)
  plotAreaSqm: number;
  gfaSqm: number;
}

export interface MatchResult {
  input: ParcelInput;
  matchedPlotId: string;
  matchedPlotArea: number;
  matchedGfa: number;
  matchedZoning: string;
  matchedStatus: string;
  matchedLocation: string;
  areaDeviation: number; // percentage
  gfaDeviation: number;  // percentage
  ownerReference?: string;
  sheetMetadata?: Record<string, string>;
  confidenceScore: number;
}

const SQFT_TO_SQM = 0.092903;
const TOLERANCE = 0.06; // ±6%
const RELAXED_TOLERANCE = 0.10; // ±10% for broader matches

function parseUnit(value: string): { num: number; unit: 'sqm' | 'sqft' | 'unknown' } {
  const cleaned = value.trim().toLowerCase();
  const numMatch = cleaned.match(/[\d,.]+/);
  if (!numMatch) return { num: 0, unit: 'unknown' };
  
  const num = parseFloat(numMatch[0].replace(/,/g, ''));
  
  if (cleaned.includes('sqm') || cleaned.includes('m²') || cleaned.includes('sq m')) {
    return { num, unit: 'sqm' };
  }
  if (cleaned.includes('sqft') || cleaned.includes('ft²') || cleaned.includes('sq ft')) {
    return { num, unit: 'sqft' };
  }
  return { num, unit: 'unknown' };
}

function toSqm(value: number, unit: 'sqm' | 'sqft' | 'unknown'): number {
  if (unit === 'sqft') return value * SQFT_TO_SQM;
  return value; // sqm or unknown (treat as sqm)
}

export function parseTextFile(content: string): ParcelInput[] {
  const blocks = content.split('---').map(b => b.trim()).filter(Boolean);
  
  return blocks.map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const fields: Record<string, string> = {};
    
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.substring(0, colonIdx).trim().toLowerCase().replace(/\s+/g, '');
      const value = line.substring(colonIdx + 1).trim();
      fields[key] = value;
    }
    
    const plotAreaParsed = parseUnit(fields['plotarea'] || fields['area_sqm'] || fields['landarea'] || '0');
    const gfaParsed = parseUnit(fields['gfa'] || fields['gfa_sqm'] || '0');
    
    const plotAreaSqm = toSqm(plotAreaParsed.num, plotAreaParsed.unit);
    const gfaSqm = toSqm(gfaParsed.num, gfaParsed.unit);
    
    return {
      area: fields['area'] || fields['areaname'] || '',
      plotArea: plotAreaParsed.num,
      plotAreaUnit: plotAreaParsed.unit,
      gfa: gfaParsed.num,
      gfaUnit: gfaParsed.unit,
      zoning: fields['zoning'] || '',
      use: fields['use'] || '',
      heightFloors: parseInt(fields['heightfloors'] || fields['floors'] || '0', 10),
      far: parseFloat(fields['far'] || '0'),
      plotNumber: fields['plotnumber'] || fields['plot_number'] || undefined,
      plotAreaSqm,
      gfaSqm,
    };
  });
}

/**
 * Smart free-form text parser. Handles input like:
 * "dubai sport city. plot area 4,838 sqm gfa 21,771 sqm floors 9"
 */
export function parseFreeFormText(content: string): ParcelInput[] {
  const blocks = content.split(/---|\n\n+/).map(b => b.trim()).filter(Boolean);
  const results: ParcelInput[] = [];

  for (const block of blocks) {
    const text = block.replace(/\./g, ' ').replace(/,/g, '');

    const plotAreaMatch = text.match(/(?:plot|land)\s*area\s*([\d.]+)\s*(sqm|sqft|sq\s*m|sq\s*ft|m²|ft²)?/i);
    const gfaMatch = text.match(/gfa\s*([\d.]+)\s*(sqm|sqft|sq\s*m|sq\s*ft|m²|ft²)?/i);
    const floorsMatch = text.match(/(?:floors?|height\s*floors?|stories?)\s*(\d+)/i);
    const zoningMatch = text.match(/(?:zoning|zone|use)\s*[:\s]*([a-zA-Z\s]+?)(?=\s+(?:plot|land|gfa|floors?|height|$))/i);

    let areaName = text
      .replace(/(?:plot|land)\s*area\s*[\d.]+\s*(?:sqm|sqft|sq\s*m|sq\s*ft|m²|ft²)?/gi, '')
      .replace(/gfa\s*[\d.]+\s*(?:sqm|sqft|sq\s*m|sq\s*ft|m²|ft²)?/gi, '')
      .replace(/(?:floors?|height\s*floors?|stories?)\s*\d+/gi, '')
      .replace(/(?:zoning|zone|use)\s*[:\s]*[a-zA-Z\s]+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!areaName && text.length > 0) {
      const words = text.split(/\s+/);
      const firstNumIdx = words.findIndex(w => /^\d/.test(w));
      areaName = words.slice(0, firstNumIdx > 0 ? firstNumIdx : 3).join(' ');
    }

    const plotNum = plotAreaMatch ? parseFloat(plotAreaMatch[1]) : 0;
    const plotUnit = plotAreaMatch?.[2]?.toLowerCase().includes('ft') ? 'sqft' as const : 'sqm' as const;
    const gfaNum = gfaMatch ? parseFloat(gfaMatch[1]) : 0;
    const gfaUnit = gfaMatch?.[2]?.toLowerCase().includes('ft') ? 'sqft' as const : 'sqm' as const;

    if (!areaName && plotNum === 0 && gfaNum === 0) continue;

    results.push({
      area: areaName,
      plotArea: plotNum,
      plotAreaUnit: plotNum > 0 ? plotUnit : 'unknown',
      gfa: gfaNum,
      gfaUnit: gfaNum > 0 ? gfaUnit : 'unknown',
      zoning: zoningMatch?.[1]?.trim() || '',
      use: '',
      heightFloors: floorsMatch ? parseInt(floorsMatch[1], 10) : 0,
      far: 0,
      plotAreaSqm: toSqm(plotNum, plotUnit),
      gfaSqm: toSqm(gfaNum, gfaUnit),
    });
  }

  return results;
}

/**
 * Build a ParcelInput from quick-search form fields.
 */
export function buildParcelFromForm(params: {
  areaName: string;
  plotArea?: number;
  plotAreaUnit?: 'sqm' | 'sqft';
  gfa?: number;
  gfaUnit?: 'sqm' | 'sqft';
  zoning?: string;
  floors?: number;
}): ParcelInput {
  const paUnit = params.plotAreaUnit || 'sqm';
  const gUnit = params.gfaUnit || 'sqm';
  return {
    area: params.areaName,
    plotArea: params.plotArea || 0,
    plotAreaUnit: params.plotArea ? paUnit : 'unknown',
    gfa: params.gfa || 0,
    gfaUnit: params.gfa ? gUnit : 'unknown',
    zoning: params.zoning || '',
    use: '',
    heightFloors: params.floors || 0,
    far: 0,
    plotAreaSqm: params.plotArea ? toSqm(params.plotArea, paUnit) : 0,
    gfaSqm: params.gfa ? toSqm(params.gfa, gUnit) : 0,
  };
}

function normalizeZoning(z: string): string {
  return z.toLowerCase().replace(/[\s_-]+/g, '').replace(/apartments?|villa?s?/gi, '');
}

/**
 * Normalize a location/area name for fuzzy comparison.
 * Strips non-alphanumeric, lowercases, removes common filler words.
 */
function normalizeLocationName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

/**
 * Check if two area/location names match using fuzzy logic.
 * Supports: project name, community name, normalized names,
 * minor spelling variations, case-insensitive.
 */
function locationMatches(inputArea: string, plotLocation: string): boolean {
  const normInput = normalizeLocationName(inputArea);
  const normPlot = normalizeLocationName(plotLocation);

  if (!normInput || !normPlot) return false;

  // Direct substring match
  if (normPlot.includes(normInput) || normInput.includes(normPlot)) return true;

  // Tokenized word matching with fuzzy (handles "sport" vs "sports", "city" vs "cities")
  const inputWords = normInput.split(/\s+/).filter(w => w.length > 2);
  if (inputWords.length === 0) return false;

  const matchedWords = inputWords.filter(word => {
    // Exact word match
    if (normPlot.includes(word)) return true;
    // Plural/singular variations
    if (normPlot.includes(word + 's')) return true;
    if (word.endsWith('s') && normPlot.includes(word.slice(0, -1))) return true;
    // Check if any plot word starts with the same prefix (min 4 chars for safety)
    if (word.length >= 4) {
      const prefix = word.slice(0, Math.max(4, Math.floor(word.length * 0.7)));
      const plotWords = normPlot.split(/\s+/);
      if (plotWords.some(pw => pw.startsWith(prefix))) return true;
    }
    return false;
  });

  // At least 60% of input words must match
  return matchedWords.length >= Math.ceil(inputWords.length * 0.6);
}

/**
 * Check if a value is within ±tolerance of the target.
 * Handles exact matches (deviation = 0) explicitly.
 */
function isWithinTolerance(actual: number, target: number, tolerance: number): { match: boolean; deviation: number } {
  if (target === 0) return { match: true, deviation: 0 };
  const deviation = Math.abs(actual - target) / target;
  return { match: deviation <= tolerance, deviation };
}

/**
 * Relaxed matching:
 * - If area name provided, must match location (project OR community)
 * - Plot Area AND/OR GFA must be within ±6% tolerance
 * - Exact values always match (deviation = 0%)
 * - Zoning, floors, FAR are optional enhancers
 */
export function matchParcels(
  inputs: ParcelInput[],
  plots: Array<{
    id: string;
    area: number;
    gfa: number;
    zoning: string;
    floors: string;
    status: string;
    location: string;
    entity?: string;
    project?: string;
  }>
): MatchResult[] {
  const results: MatchResult[] = [];
  
  for (const input of inputs) {
    const hasAreaName = input.area && input.area.trim().length > 0;
    const hasPlotArea = input.plotAreaSqm > 0;
    const hasGfa = input.gfaSqm > 0;
    if (!hasPlotArea && !hasGfa) continue;
    
    for (const plot of plots) {
      // 1. Area/location filter — if area name specified, must match
      if (hasAreaName) {
        const plotLocationStr = plot.location || '';
        const plotEntityStr = (plot as Record<string, unknown>).entity as string || '';
        const plotProjectStr = (plot as Record<string, unknown>).project as string || '';
        
        // Match against location, entity, OR project name
        const locMatch = locationMatches(input.area, plotLocationStr) ||
                         locationMatches(input.area, plotEntityStr) ||
                         locationMatches(input.area, plotProjectStr);
        
        if (!locMatch) continue;
      }
      
      // 2. Tolerance matching: ±6% for Plot Area AND/OR GFA
      // Use both strict (6%) and relaxed (10%) — strict gets higher confidence
      let areaCheck = { match: true, deviation: 0 };
      let gfaCheck = { match: true, deviation: 0 };

      if (hasPlotArea) {
        areaCheck = isWithinTolerance(plot.area, input.plotAreaSqm, RELAXED_TOLERANCE);
      }
      if (hasGfa) {
        gfaCheck = isWithinTolerance(plot.gfa, input.gfaSqm, RELAXED_TOLERANCE);
      }

      // Both provided → at least one must match within relaxed tolerance
      // Only one provided → that one must match
      if (hasPlotArea && hasGfa) {
        if (!areaCheck.match && !gfaCheck.match) continue;
      } else if (hasPlotArea) {
        if (!areaCheck.match) continue;
      } else if (hasGfa) {
        if (!gfaCheck.match) continue;
      }
      
      // 3. Calculate confidence score
      // Exact match on all provided dimensions = 100%
      let confidenceScore = 0;
      const exactArea = hasPlotArea && areaCheck.deviation === 0;
      const exactGfa = hasGfa && gfaCheck.deviation === 0;
      if ((!hasPlotArea || exactArea) && (!hasGfa || exactGfa)) {
        confidenceScore = 80; // base 80 for exact, enhancers can add up to 100
      } else {
        if (hasPlotArea) {
          const areaPts = areaCheck.deviation <= TOLERANCE ? Math.max(0.5, 1 - areaCheck.deviation / TOLERANCE) : Math.max(0.2, 1 - areaCheck.deviation / RELAXED_TOLERANCE) * 0.5;
          confidenceScore += areaPts * (hasGfa ? 35 : 60);
        }
        if (hasGfa) {
          const gfaPts = gfaCheck.deviation <= TOLERANCE ? Math.max(0.5, 1 - gfaCheck.deviation / TOLERANCE) : Math.max(0.2, 1 - gfaCheck.deviation / RELAXED_TOLERANCE) * 0.5;
          confidenceScore += gfaPts * (hasPlotArea ? 35 : 60);
        }
      }

      // 4. Optional enhancers
      if (input.zoning) {
        const inputZoning = normalizeZoning(input.zoning);
        const plotZoning = normalizeZoning(plot.zoning);
        if (plotZoning.includes(inputZoning) || inputZoning.includes(plotZoning)) {
          confidenceScore += 20;
        }
      }

      if (input.heightFloors > 0) {
        const plotFloors = parseInt(plot.floors.replace(/[^0-9]/g, ''), 10) || 0;
        if (Math.abs(plotFloors - input.heightFloors) <= 1) {
          confidenceScore += 10;
        }
      }

      // Area name match bonus
      if (hasAreaName) {
        confidenceScore += 10;
      }

      confidenceScore = Math.min(100, Math.round(confidenceScore));
      
      results.push({
        input,
        matchedPlotId: plot.id,
        matchedPlotArea: plot.area,
        matchedGfa: plot.gfa,
        matchedZoning: plot.zoning,
        matchedStatus: plot.status,
        matchedLocation: plot.location,
        areaDeviation: hasPlotArea ? parseFloat((areaCheck.deviation * 100).toFixed(2)) : 0,
        gfaDeviation: hasGfa ? parseFloat((gfaCheck.deviation * 100).toFixed(2)) : 0,
        confidenceScore
      });
    }
  }
  
  // Deduplicate by plot ID (keep highest confidence)
  const seen = new Map<string, MatchResult>();
  for (const r of results) {
    const existing = seen.get(r.matchedPlotId);
    if (!existing || r.confidenceScore > existing.confidenceScore) {
      seen.set(r.matchedPlotId, r);
    }
  }
  
  return Array.from(seen.values()).sort((a, b) => b.confidenceScore - a.confidenceScore);
}

// CRM Export tracking
const CRM_EXPORT_KEY = 'hyperplot_crm_exports';
const CRM_LISTED_KEY = 'hyperplot_crm_listed';

export function getExportedPlotIds(): Set<string> {
  try {
    const stored = localStorage.getItem(CRM_EXPORT_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
}

export function markPlotsExported(plotIds: string[]) {
  const existing = getExportedPlotIds();
  plotIds.forEach(id => existing.add(id));
  localStorage.setItem(CRM_EXPORT_KEY, JSON.stringify([...existing]));
}

export function getListedPlotIds(): Set<string> {
  try {
    const stored = localStorage.getItem(CRM_LISTED_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
}

export function markPlotListed(plotId: string) {
  const existing = getListedPlotIds();
  existing.add(plotId);
  localStorage.setItem(CRM_LISTED_KEY, JSON.stringify([...existing]));
}

export function isPlotListed(plotId: string): boolean {
  return getListedPlotIds().has(plotId);
}
