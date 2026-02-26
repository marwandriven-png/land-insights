// Area-specific feasibility report templates
// Each area maps to a pre-attached report file

export interface AreaReport {
  areaName: string;
  slug: string;
  reportFile: string;
  projectName: string;
  totalUnits: number;
  sellableSqft: string;
  configuration: string;
  completionDate: string;
  marketValuation: string;
  psfRange: string;
  unitMix: Array<{
    type: string;
    count: number;
    sizeSf: number;
    marketPsf: number;
    unitPrice: number;
    totalValue: number;
  }>;
  rentalYield: string;
  investmentGrade: string;
}

export const areaReports: Record<string, AreaReport> = {
  'al satwa': {
    areaName: 'Al Satwa',
    slug: 'al-satwa',
    reportFile: '/reports/stamn-one-report.pdf',
    projectName: 'STAMN ONE',
    totalUnits: 77,
    sellableSqft: '47K',
    configuration: 'G+2P+7+R',
    completionDate: 'Q4 2026',
    marketValuation: 'AED 168,450,000',
    psfRange: 'AED 2,150 - 2,350 PSF',
    unitMix: [
      { type: 'Studio Std', count: 30, sizeSf: 450, marketPsf: 2150, unitPrice: 967500, totalValue: 29025000 },
      { type: 'Studio Prem', count: 12, sizeSf: 485, marketPsf: 2450, unitPrice: 1188250, totalValue: 14259000 },
      { type: '1BR Std', count: 20, sizeSf: 780, marketPsf: 2100, unitPrice: 1638000, totalValue: 32760000 },
      { type: '1BR Prem', count: 8, sizeSf: 850, marketPsf: 2350, unitPrice: 1997500, totalValue: 15980000 },
      { type: '2BR Std', count: 5, sizeSf: 1200, marketPsf: 2200, unitPrice: 2640000, totalValue: 13200000 },
      { type: '2BR Prem', count: 2, sizeSf: 1350, marketPsf: 2450, unitPrice: 3307500, totalValue: 6615000 },
    ],
    rentalYield: '5.4%',
    investmentGrade: 'ACQUIRE',
  },
  'business bay': {
    areaName: 'Business Bay',
    slug: 'business-bay',
    reportFile: '',
    projectName: 'Business Bay Development',
    totalUnits: 120,
    sellableSqft: '85K',
    configuration: 'G+3P+20+R',
    completionDate: 'Q2 2027',
    marketValuation: 'AED 340,000,000',
    psfRange: 'AED 2,800 - 3,200 PSF',
    unitMix: [
      { type: 'Studio', count: 40, sizeSf: 400, marketPsf: 2800, unitPrice: 1120000, totalValue: 44800000 },
      { type: '1BR', count: 50, sizeSf: 750, marketPsf: 3000, unitPrice: 2250000, totalValue: 112500000 },
      { type: '2BR', count: 25, sizeSf: 1100, marketPsf: 3100, unitPrice: 3410000, totalValue: 85250000 },
      { type: '3BR', count: 5, sizeSf: 1800, marketPsf: 3200, unitPrice: 5760000, totalValue: 28800000 },
    ],
    rentalYield: '6.2%',
    investmentGrade: 'ACQUIRE',
  },
  'downtown': {
    areaName: 'Downtown Dubai',
    slug: 'downtown',
    reportFile: '',
    projectName: 'Downtown Tower',
    totalUnits: 95,
    sellableSqft: '72K',
    configuration: 'G+5P+30+R',
    completionDate: 'Q1 2028',
    marketValuation: 'AED 520,000,000',
    psfRange: 'AED 3,500 - 4,200 PSF',
    unitMix: [
      { type: '1BR', count: 35, sizeSf: 800, marketPsf: 3500, unitPrice: 2800000, totalValue: 98000000 },
      { type: '2BR', count: 40, sizeSf: 1200, marketPsf: 3800, unitPrice: 4560000, totalValue: 182400000 },
      { type: '3BR', count: 15, sizeSf: 1600, marketPsf: 4000, unitPrice: 6400000, totalValue: 96000000 },
      { type: 'Penthouse', count: 5, sizeSf: 2500, marketPsf: 4200, unitPrice: 10500000, totalValue: 52500000 },
    ],
    rentalYield: '5.0%',
    investmentGrade: 'HOLD',
  },
};

/**
 * Find an area report by matching location text
 */
export function findReportForLocation(location: string): AreaReport | null {
  const loc = location.toLowerCase();
  for (const [key, report] of Object.entries(areaReports)) {
    if (loc.includes(key) || key.includes(loc)) {
      return report;
    }
  }
  return null;
}
