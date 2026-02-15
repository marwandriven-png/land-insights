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
 * or "ubai sport city plot area 4838 sqm gfa 21771 sqm"
 */
export function parseFreeFormText(content: string): ParcelInput[] {
  const blocks = content.split(/---|\n\n+/).map(b => b.trim()).filter(Boolean);
  const results: ParcelInput[] = [];

  for (const block of blocks) {
    const text = block.replace(/\./g, ' ').replace(/,/g, '');

    // Extract plot area: "plot area 4838 sqm" or "land area 52080 sqft"
    const plotAreaMatch = text.match(/(?:plot|land)\s*area\s*([\d.]+)\s*(sqm|sqft|sq\s*m|sq\s*ft|m²|ft²)?/i);
    // Extract GFA: "gfa 21771 sqm"
    const gfaMatch = text.match(/gfa\s*([\d.]+)\s*(sqm|sqft|sq\s*m|sq\s*ft|m²|ft²)?/i);
    // Extract floors: "floors 9" or "height 9"
    const floorsMatch = text.match(/(?:floors?|height\s*floors?|stories?)\s*(\d+)/i);
    // Extract zoning
    const zoningMatch = text.match(/(?:zoning|zone|use)\s*[:\s]*([a-zA-Z\s]+?)(?=\s+(?:plot|land|gfa|floors?|height|$))/i);

    // Area name: everything before the first numeric field keyword
    let areaName = text
      .replace(/(?:plot|land)\s*area\s*[\d.]+\s*(?:sqm|sqft|sq\s*m|sq\s*ft|m²|ft²)?/gi, '')
      .replace(/gfa\s*[\d.]+\s*(?:sqm|sqft|sq\s*m|sq\s*ft|m²|ft²)?/gi, '')
      .replace(/(?:floors?|height\s*floors?|stories?)\s*\d+/gi, '')
      .replace(/(?:zoning|zone|use)\s*[:\s]*[a-zA-Z\s]+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // If no structured area name found, use first few words
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
 * Area name is mandatory. At least one of plotArea or GFA must be provided.
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
 * Relaxed matching:
 * - Area name (mandatory) must match location
 * - Plot Area OR GFA must be within ±6% (only one is required)
 * - Zoning, floors, FAR are optional enhancers (boost confidence but don't block)
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
  }>
): MatchResult[] {
  const results: MatchResult[] = [];
  
  for (const input of inputs) {
    // Must have area name
    if (!input.area || input.area.trim().length === 0) continue;

    // Must have at least one of plotArea or GFA with known/assumed unit
    const hasPlotArea = input.plotAreaSqm > 0;
    const hasGfa = input.gfaSqm > 0;
    if (!hasPlotArea && !hasGfa) continue;
    
    for (const plot of plots) {
      // 1. Area name filter (mandatory) — fuzzy match location
      const inputArea = input.area.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
      const plotLocation = (plot.location || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
      
      // Tokenize and check if most input words appear in plot location (handles "sport" vs "sports")
      const inputWords = inputArea.split(/\s+/).filter(w => w.length > 2);
      const locationMatches = inputWords.length > 0 && inputWords.filter(word => 
        plotLocation.includes(word) || plotLocation.includes(word + 's') || plotLocation.includes(word.replace(/s$/, ''))
      ).length >= Math.ceil(inputWords.length * 0.6);
      
      if (!plotLocation.includes(inputArea) && !inputArea.includes(plotLocation) && !locationMatches) {
        if (inputArea.length > 3) continue;
      }
      
      // 2. Tolerance matching: ±6% for Plot Area AND/OR GFA
      let areaDev = 0;
      let gfaDev = 0;
      let areaMatch = true;
      let gfaMatch = true;

      if (hasPlotArea) {
        areaDev = Math.abs(plot.area - input.plotAreaSqm) / input.plotAreaSqm;
        areaMatch = areaDev <= TOLERANCE;
      }
      if (hasGfa) {
        gfaDev = Math.abs(plot.gfa - input.gfaSqm) / input.gfaSqm;
        gfaMatch = gfaDev <= TOLERANCE;
      }

      // At least one metric must match within tolerance
      if (hasPlotArea && hasGfa) {
        // If both provided, both must match
        if (!areaMatch || !gfaMatch) continue;
      } else if (hasPlotArea) {
        if (!areaMatch) continue;
      } else if (hasGfa) {
        if (!gfaMatch) continue;
      }
      
      // 3. Calculate confidence score — base from area/GFA match
      let confidenceScore = 0;

      if (hasPlotArea) {
        confidenceScore += Math.max(0, 1 - areaDev / TOLERANCE) * (hasGfa ? 35 : 60);
      }
      if (hasGfa) {
        confidenceScore += Math.max(0, 1 - gfaDev / TOLERANCE) * (hasPlotArea ? 35 : 60);
      }

      // 4. Optional enhancers — boost confidence, never block
      // Zoning match bonus (+20)
      if (input.zoning) {
        const inputZoning = normalizeZoning(input.zoning);
        const plotZoning = normalizeZoning(plot.zoning);
        if (plotZoning.includes(inputZoning) || inputZoning.includes(plotZoning)) {
          confidenceScore += 20;
        }
      }

      // Floors match bonus (+10)
      if (input.heightFloors > 0) {
        const plotFloors = parseInt(plot.floors.replace(/[^0-9]/g, ''), 10) || 0;
        if (Math.abs(plotFloors - input.heightFloors) <= 1) {
          confidenceScore += 10;
        }
      }

  // Area name exact/fuzzy match bonus (+10)
      if (locationMatches || plotLocation === inputArea) {
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
        areaDeviation: hasPlotArea ? parseFloat((areaDev * 100).toFixed(2)) : 0,
        gfaDeviation: hasGfa ? parseFloat((gfaDev * 100).toFixed(2)) : 0,
        confidenceScore
      });
    }
  }
  
  // Sort by confidence score descending
  return results.sort((a, b) => b.confidenceScore - a.confidenceScore);
}
