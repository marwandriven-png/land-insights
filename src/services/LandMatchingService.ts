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
    
    const plotAreaParsed = parseUnit(fields['plotarea'] || fields['area_sqm'] || '0');
    const gfaParsed = parseUnit(fields['gfa'] || fields['gfa_sqm'] || '0');
    
    const plotAreaSqm = toSqm(plotAreaParsed.num, plotAreaParsed.unit);
    const gfaSqm = toSqm(gfaParsed.num, gfaParsed.unit);
    
    return {
      area: fields['area'] || '',
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

function normalizeZoning(z: string): string {
  return z.toLowerCase().replace(/[\s_-]+/g, '').replace(/apartments?|villa?s?/gi, '');
}

function normalizeUse(u: string): string {
  return u.toLowerCase().replace(/[\s_-]+/g, '');
}

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
    // Skip inputs with unknown units
    if (input.plotAreaUnit === 'unknown' || input.gfaUnit === 'unknown') {
      continue;
    }
    
    for (const plot of plots) {
      // 1. Area filter - match location/area name
      if (input.area) {
        const inputArea = input.area.toLowerCase();
        const plotLocation = (plot.location || '').toLowerCase();
        if (!plotLocation.includes(inputArea) && !inputArea.includes(plotLocation)) {
          // Don't skip if area is empty or generic
          if (inputArea.length > 3) continue;
        }
      }
      
      // 2. Building config filter (strict) - zoning must match
      if (input.zoning) {
        const inputZoning = normalizeZoning(input.zoning);
        const plotZoning = normalizeZoning(plot.zoning);
        if (!plotZoning.includes(inputZoning) && !inputZoning.includes(plotZoning)) {
          continue;
        }
      }
      
      // 3. Height/floors check
      if (input.heightFloors > 0) {
        const plotFloors = parseInt(plot.floors.replace(/[^0-9]/g, ''), 10) || 0;
        // Allow +1 floor tolerance
        if (Math.abs(plotFloors - input.heightFloors) > 1) continue;
      }
      
      // 4. Tolerance matching: ±6% for Plot Area & GFA
      const areaDev = Math.abs(plot.area - input.plotAreaSqm) / input.plotAreaSqm;
      const gfaDev = Math.abs(plot.gfa - input.gfaSqm) / input.gfaSqm;
      
      if (areaDev > TOLERANCE || gfaDev > TOLERANCE) continue;
      
      // Calculate confidence score
      const areaScore = Math.max(0, 1 - areaDev / TOLERANCE) * 50;
      const gfaScore = Math.max(0, 1 - gfaDev / TOLERANCE) * 50;
      const confidenceScore = Math.round(areaScore + gfaScore);
      
      results.push({
        input,
        matchedPlotId: plot.id,
        matchedPlotArea: plot.area,
        matchedGfa: plot.gfa,
        matchedZoning: plot.zoning,
        matchedStatus: plot.status,
        matchedLocation: plot.location,
        areaDeviation: parseFloat((areaDev * 100).toFixed(2)),
        gfaDeviation: parseFloat((gfaDev * 100).toFixed(2)),
        confidenceScore
      });
    }
  }
  
  // Sort by confidence score descending
  return results.sort((a, b) => b.confidenceScore - a.confidenceScore);
}
