import { supabase } from "@/integrations/supabase/client";

export interface PlotData {
  id: string;
  area: number;
  gfa: number;
  floors: string;
  zoning: string;
  location: string;
  x: number;
  y: number;
  color: string;
  status: string;
  constructionCost: number;
  salePrice: number;
  developer?: string;
  project?: string;
  entity?: string;
  landUseDetails?: string;
  maxHeight?: number;
  plotCoverage?: number;
  isFrozen: boolean;
  freezeReason?: string;
  constructionStatus?: string;
  siteStatus?: string;
  rawAttributes?: Record<string, unknown>;
}

export interface FeasibilityResult {
  revenue: number;
  cost: number;
  profit: number;
  roi: number;
  score: number;
  paybackPeriod: string;
  profitMargin: string;
  riskLevel: 'Low' | 'Medium' | 'High';
}

class DDAGISService {
  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing GIS connection via edge function...');
      
      const { data, error } = await supabase.functions.invoke('dda-gis-proxy', {
        body: null,
        headers: { 'Content-Type': 'application/json' }
      });

      // Construct the URL with query params
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dda-gis-proxy?action=test`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.error('GIS test failed:', response.status);
        return false;
      }

      const result = await response.json();
      console.log('GIS test result:', result);
      return result.connected === true;
    } catch (error) {
      console.error('GIS connection test failed:', error);
      return false;
    }
  }

  async fetchPlots(limit: number = 100): Promise<PlotData[]> {
    try {
      console.log(`Fetching plots via edge function (limit: ${limit})...`);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dda-gis-proxy?action=fetch&limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Edge function returned ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.features || !Array.isArray(data.features)) {
        throw new Error('Invalid response format from GIS service');
      }

      console.log(`Received ${data.features.length} features from GIS`);
      return this.transformGISData(data.features);
    } catch (error) {
      console.error('DDA GIS API Error:', error);
      throw error;
    }
  }

  async fetchPlotById(plotId: string): Promise<PlotData | null> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dda-gis-proxy?action=plot&plotId=${encodeURIComponent(plotId)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Edge function returned ${response.status}`);
      }

      const data = await response.json();

      if (data.features && data.features.length > 0) {
        return this.transformGISData(data.features)[0];
      }
      return null;
    } catch (error) {
      console.error('Error fetching plot by ID:', error);
      return null;
    }
  }

  private transformGISData(features: Array<{ attributes: Record<string, unknown>; geometry?: { x?: number; y?: number } }>): PlotData[] {
    return features.map((feature, index) => {
      const attrs = feature.attributes;
      const geometry = feature.geometry;

      const mainLanduse = attrs.MAIN_LANDUSE as string | undefined;
      const subLanduse = attrs.SUB_LANDUSE as string | undefined;
      const areaSqm = attrs.AREA_SQM as number | undefined;
      const areaSqft = attrs.AREA_SQFT as number | undefined;
      const gfaSqm = attrs.GFA_SQM as number | undefined;
      const gfaSqft = attrs.GFA_SQFT as number | undefined;

      return {
        id: (attrs.PLOT_NUMBER as string) || `PLOT_${index}`,
        area: areaSqm || (areaSqft ? areaSqft / 10.764 : 850),
        gfa: gfaSqm || (gfaSqft ? gfaSqft / 10.764 : 1275),
        floors: (attrs.MAX_HEIGHT_FLOORS as string) || 'G+1',
        zoning: this.getZoningCategory(mainLanduse, subLanduse),
        location: (attrs.PROJECT_NAME as string) || (attrs.ENTITY_NAME as string) || 'Dubai South',
        x: this.normalizeCoordinate(geometry?.x || (495261 + (index % 10) * 80), 'x'),
        y: this.normalizeCoordinate(geometry?.y || (2766577 + Math.floor(index / 10) * 60), 'y'),
        color: this.getZoningColor(mainLanduse, subLanduse),
        status: this.getPlotStatus(
          attrs.CONSTRUCTION_STATUS as string | undefined,
          attrs.IS_FROZEN as number | undefined,
          attrs.SITE_STATUS as string | undefined
        ),
        constructionCost: this.getConstructionCost(mainLanduse),
        salePrice: this.getSalePrice(mainLanduse, areaSqm || 850),
        developer: attrs.DEVELOPER_NAME as string | undefined,
        project: attrs.PROJECT_NAME as string | undefined,
        entity: attrs.ENTITY_NAME as string | undefined,
        landUseDetails: attrs.LANDUSE_DETAILS as string | undefined,
        maxHeight: attrs.MAX_HEIGHT_METERS as number | undefined,
        plotCoverage: attrs.MAX_PLOT_COVERAGE as number | undefined,
        isFrozen: (attrs.IS_FROZEN as number) === 1,
        freezeReason: attrs.FREEZE_REASON as string | undefined,
        constructionStatus: attrs.CONSTRUCTION_STATUS as string | undefined,
        siteStatus: attrs.SITE_STATUS as string | undefined,
        rawAttributes: attrs
      };
    });
  }

  private normalizeCoordinate(coord: number, axis: 'x' | 'y'): number {
    const minX = 495261;
    const maxX = 496080;
    const minY = 2766577;
    const maxY = 2767203;

    if (axis === 'x') {
      const normalized = ((coord - minX) / (maxX - minX)) * 80 + 10;
      return Math.max(5, Math.min(95, normalized));
    } else {
      const normalized = ((coord - minY) / (maxY - minY)) * 80 + 10;
      return Math.max(5, Math.min(95, normalized));
    }
  }

  private getZoningCategory(mainLanduse?: string, subLanduse?: string): string {
    if (!mainLanduse) return 'Mixed Use';

    const landuse = mainLanduse.toLowerCase();
    if (landuse.includes('residential')) {
      return subLanduse?.toLowerCase().includes('villa') ? 'Residential Villa' : 'Residential Apartments';
    }
    if (landuse.includes('commercial')) return 'Commercial';
    if (landuse.includes('industrial')) return 'Industrial';
    if (landuse.includes('mixed')) return 'Mixed Use';
    return mainLanduse;
  }

  private getZoningColor(mainLanduse?: string, subLanduse?: string): string {
    if (!mainLanduse) return '#10b981';

    const landuse = mainLanduse.toLowerCase();
    if (landuse.includes('residential')) {
      return subLanduse?.toLowerCase().includes('villa') ? '#10b981' : '#ef4444';
    }
    if (landuse.includes('commercial')) return '#3b82f6';
    if (landuse.includes('industrial')) return '#f59e0b';
    if (landuse.includes('mixed')) return '#8b5cf6';
    return '#10b981';
  }

  private getPlotStatus(constructionStatus?: string, isFrozen?: number, siteStatus?: string): string {
    if (isFrozen) return 'Frozen';
    if (siteStatus?.toLowerCase().includes('available')) return 'Available';
    if (constructionStatus?.toLowerCase().includes('complete')) return 'Completed';
    if (constructionStatus?.toLowerCase().includes('progress')) return 'Under Construction';
    return 'Available';
  }

  private getConstructionCost(landuse?: string): number {
    const costs: Record<string, number> = {
      'residential': 800,
      'commercial': 1200,
      'industrial': 600,
      'mixed': 1000
    };

    if (!landuse) return 800;
    const key = landuse.toLowerCase();
    const matchingKey = Object.keys(costs).find(k => key.includes(k));
    return matchingKey ? costs[matchingKey] : 800;
  }

  private getSalePrice(landuse?: string, area?: number): number {
    const basePrices: Record<string, number> = {
      'residential': 1500,
      'commercial': 2500,
      'industrial': 1000,
      'mixed': 2000
    };

    if (!landuse) return 1500;
    const key = landuse.toLowerCase();
    const matchingKey = Object.keys(basePrices).find(k => key.includes(k));
    const basePrice = matchingKey ? basePrices[matchingKey] : 1500;

    const areaFactor = (area || 850) > 2000 ? 1.2 : (area || 850) > 1000 ? 1.1 : 1.0;
    return basePrice * areaFactor;
  }
}

export const gisService = new DDAGISService();

export function calculateFeasibility(plot: PlotData): FeasibilityResult {
  const gfaSqft = plot.gfa * 10.764;
  const cost = gfaSqft * plot.constructionCost;
  const revenue = gfaSqft * plot.salePrice;
  const profit = revenue - cost;
  const roi = (profit / cost) * 100;

  let score = roi * 1.5;

  if (plot.status === 'Frozen') score *= 0.3;
  if (plot.status === 'Under Construction') score *= 0.8;
  if (plot.status === 'Completed') score *= 1.2;

  if (plot.area > 2000) score *= 1.1;
  if (plot.zoning.includes('Commercial')) score *= 1.15;
  if (plot.zoning.includes('Mixed')) score *= 1.2;

  return {
    revenue,
    cost,
    profit,
    roi: parseFloat(roi.toFixed(1)),
    score: Math.min(100, Math.max(0, score)),
    paybackPeriod: (cost / (profit / 12)).toFixed(1),
    profitMargin: ((profit / revenue) * 100).toFixed(1),
    riskLevel: plot.status === 'Frozen' ? 'High' : plot.status === 'Under Construction' ? 'Medium' : 'Low'
  };
}

export function generateDemoPlots(): PlotData[] {
  return [
    {
      id: 'PA1_001', area: 850, gfa: 1275, floors: 'G+1', zoning: 'Residential Villa',
      location: 'Dubai South', x: 15, y: 12, color: '#10b981', status: 'Available',
      constructionCost: 800, salePrice: 1500, developer: 'Dubai South',
      project: 'Phase 1', entity: 'Dubai South Entity', maxHeight: 12,
      constructionStatus: 'Not Started', siteStatus: 'Available for Development', isFrozen: false
    },
    {
      id: 'PA2_015', area: 920, gfa: 1380, floors: 'G+1', zoning: 'Residential Villa',
      location: 'Dubai South', x: 28, y: 20, color: '#10b981', status: 'Available',
      constructionCost: 800, salePrice: 1550, developer: 'Emaar Properties',
      project: 'Phase 2', entity: 'Emaar South', maxHeight: 12,
      constructionStatus: 'Not Started', siteStatus: 'Available for Development', isFrozen: false
    },
    {
      id: 'PA4_042', area: 780, gfa: 1170, floors: 'G+1', zoning: 'Residential Villa',
      location: 'Dubai South', x: 42, y: 28, color: '#10b981', status: 'Available',
      constructionCost: 850, salePrice: 1600, developer: 'Nakheel',
      project: 'Phase 4', entity: 'Nakheel Communities', maxHeight: 12,
      constructionStatus: 'Not Started', siteStatus: 'Available for Development', isFrozen: false
    },
    {
      id: 'PA5_089', area: 1200, gfa: 3600, floors: 'G+2', zoning: 'Residential Apartments',
      location: 'Dubai South', x: 20, y: 45, color: '#ef4444', status: 'Under Construction',
      constructionCost: 900, salePrice: 1800, developer: 'Damac Properties',
      project: 'Phase 5', entity: 'Damac Towers', maxHeight: 24,
      constructionStatus: '50% Complete', siteStatus: 'Under Development', isFrozen: false
    },
    {
      id: 'PA8_301', area: 2500, gfa: 7500, floors: 'G+2', zoning: 'Residential Apartments',
      location: 'Dubai South', x: 65, y: 42, color: '#ef4444', status: 'Premium',
      constructionCost: 950, salePrice: 1900, developer: 'Sobha Realty',
      project: 'Phase 8', entity: 'Sobha Hartland', maxHeight: 24,
      constructionStatus: 'Not Started', siteStatus: 'Premium Location', isFrozen: false
    },
    {
      id: 'PA11_082', area: 1850, gfa: 5550, floors: 'G+2', zoning: 'Mixed Use',
      location: 'Dubai South', x: 48, y: 72, color: '#8b5cf6', status: 'Hot',
      constructionCost: 1000, salePrice: 2100, developer: 'Meraas Development',
      project: 'Phase 11', entity: 'City Walk Expansion', maxHeight: 32,
      constructionStatus: 'Approved', siteStatus: 'High Demand Area', isFrozen: false
    },
    {
      id: 'PA3_017', area: 1100, gfa: 2200, floors: 'G+1', zoning: 'Commercial',
      location: 'Dubai South', x: 75, y: 25, color: '#3b82f6', status: 'Available',
      constructionCost: 1200, salePrice: 2500, developer: 'Dubai Properties',
      project: 'Business Bay', entity: 'DPG', maxHeight: 18,
      constructionStatus: 'Not Started', siteStatus: 'Prime Commercial', isFrozen: false
    },
    {
      id: 'PA6_055', area: 3200, gfa: 6400, floors: 'G+1', zoning: 'Industrial',
      location: 'Dubai South', x: 85, y: 60, color: '#f59e0b', status: 'Available',
      constructionCost: 600, salePrice: 1000, developer: 'Jafza',
      project: 'Industrial Zone', entity: 'Jafza FZE', maxHeight: 15,
      constructionStatus: 'Not Started', siteStatus: 'Industrial Zone', isFrozen: false
    },
    {
      id: 'PA7_033', area: 1450, gfa: 4350, floors: 'G+2', zoning: 'Mixed Use',
      location: 'Dubai South', x: 35, y: 85, color: '#8b5cf6', status: 'Frozen',
      constructionCost: 1000, salePrice: 2000, developer: 'TBD',
      project: 'Phase 7', entity: 'Reserved', maxHeight: 28,
      constructionStatus: 'On Hold', siteStatus: 'Frozen', isFrozen: true, freezeReason: 'Pending regulatory approval'
    },
    {
      id: 'PA9_121', area: 680, gfa: 1020, floors: 'G+1', zoning: 'Residential Villa',
      location: 'Dubai South', x: 55, y: 55, color: '#10b981', status: 'Completed',
      constructionCost: 800, salePrice: 1650, developer: 'Azizi Developments',
      project: 'Phase 9', entity: 'Azizi Riviera', maxHeight: 12,
      constructionStatus: 'Completed', siteStatus: 'Ready for Handover', isFrozen: false
    },
  ];
}
