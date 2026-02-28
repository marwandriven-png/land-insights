// src/services/__tests__/LandMatchingService.test.ts
import { describe, expect, test, bench } from 'vitest';
import { parseTextFile } from '../LandMatchingService';

const sampleContent = `---
Area: Test Area
PlotArea: 1,200 sqm
GFA: 3,500 sqm
Zoning: Residential
Use: Residential
HeightFloors: 5
Far: 2.5
---
Area: Second Area
PlotArea: 800 sqft
GFA: 2,200 sqft
Zoning: Commercial
Use: Commercial
HeightFloors: 3
Far: 1.8`;

const largeContent = (() => {
    const block = `---\nArea: Large Area\nPlotArea: 1,000 sqm\nGFA: 2,500 sqm\nZoning: Residential\nUse: Residential\nHeightFloors: 4\nFar: 2.0`;
    // repeat 200 times to create ~10KB input
    return Array.from({ length: 200 }, () => block).join('\n');
})();

describe('parseTextFile', () => {
    test('parses multiple blocks correctly', () => {
        const result = parseTextFile(sampleContent);
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
            area: 'Test Area',
            plotArea: 1200,
            plotAreaUnit: 'sqm',
            gfa: 3500,
            gfaUnit: 'sqm',
            zoning: 'Residential',
            use: 'Residential',
            heightFloors: 5,
            far: 2.5,
        });
        expect(result[1]).toMatchObject({
            area: 'Second Area',
            plotArea: 800,
            plotAreaUnit: 'sqft',
            gfa: 2200,
            gfaUnit: 'sqft',
            zoning: 'Commercial',
            use: 'Commercial',
            heightFloors: 3,
            far: 1.8,
        });
    });

    test('handles missing optional fields gracefully', () => {
        const minimal = `---\nArea: Minimal\nPlotArea: 500 sqm`;
        const result = parseTextFile(minimal);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            area: 'Minimal',
            plotArea: 500,
            plotAreaUnit: 'sqm',
            gfa: 0,
            gfaUnit: 'unknown',
            zoning: '',
            use: '',
            heightFloors: 0,
            far: 0,
        });
    });
});

bench('parseTextFile performance on large input', () => {
    parseTextFile(largeContent);
});
