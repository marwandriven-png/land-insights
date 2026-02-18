// Manual Land Entry – LocalStorage CRUD service
import { PlotData, VerificationSource } from './DDAGISService';

const STORAGE_KEY = 'hyperplot_manual_lands';

export interface ManualLandEntry {
  id: string;
  plotNumber: string;
  areaName: string;
  status: 'Available' | 'Off-Market' | 'Listed';
  // Location
  latitude: number;
  longitude: number;
  polygonCoords?: [number, number][]; // lat/lng pairs
  // Planning
  plotAreaSqm: number;
  gfaSqm: number;
  floors: string;
  zoning: string;
  landUseMain: string;
  landUseSub: string;
  landUseCategory: string;
  plotCoverage?: number;
  heightCategory?: string;
  // Affection plan
  buildingSetbacks: { side1: string; side2: string; side3: string; side4: string };
  podiumSetbacks: { side1: string; side2: string; side3: string; side4: string };
  parkingRules: string;
  notes: string;
  // Meta
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_SETBACKS = { side1: '', side2: '', side3: '', side4: '' };

export function createDefaultManualLand(): ManualLandEntry {
  return {
    id: `ML_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    plotNumber: '',
    areaName: '',
    status: 'Available',
    latitude: 25.2048,
    longitude: 55.2708,
    plotAreaSqm: 0,
    gfaSqm: 0,
    floors: '',
    zoning: '',
    landUseMain: '',
    landUseSub: '',
    landUseCategory: '',
    buildingSetbacks: { ...DEFAULT_SETBACKS },
    podiumSetbacks: { ...DEFAULT_SETBACKS },
    parkingRules: '',
    notes: '',
    isDraft: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function loadManualLands(): ManualLandEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveManualLand(entry: ManualLandEntry): ManualLandEntry[] {
  const lands = loadManualLands();
  const idx = lands.findIndex(l => l.id === entry.id);
  entry.updatedAt = new Date().toISOString();
  if (idx >= 0) {
    lands[idx] = entry;
  } else {
    lands.push(entry);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lands));
  return lands;
}

export function deleteManualLand(id: string): ManualLandEntry[] {
  const lands = loadManualLands().filter(l => l.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lands));
  return lands;
}

/**
 * Convert a ManualLandEntry to a PlotData object so it integrates
 * seamlessly with the rest of the application (matching, feasibility,
 * map rendering, CRM export, etc.).
 */
export function manualLandToPlotData(entry: ManualLandEntry): PlotData {
  // Build geometry rings from polygon or single point
  let geometry: { rings?: number[][][]; x?: number; y?: number } | undefined;

  if (entry.polygonCoords && entry.polygonCoords.length >= 3) {
    // Convert lat/lng to pseudo EPSG:3997 for rendering consistency
    // The map will detect the `_isManualLatLng` flag and use lat/lng directly
    geometry = {
      rings: [entry.polygonCoords.map(([lat, lng]) => [lng, lat])], // store as [lng, lat] in rings
    };
  }

  const gfaSqft = entry.gfaSqm * 10.764;
  const areaSqft = entry.plotAreaSqm * 10.764;

  return {
    id: entry.plotNumber || entry.id,
    area: entry.plotAreaSqm,
    gfa: entry.gfaSqm,
    floors: entry.floors || 'N/A',
    zoning: entry.zoning || 'Mixed Use',
    location: entry.areaName,
    x: entry.longitude, // store raw lng
    y: entry.latitude,  // store raw lat
    color: '#8b5cf6',
    status: entry.status,
    constructionCost: 800,
    salePrice: 1500,
    project: entry.areaName,
    entity: entry.areaName,
    landUseDetails: [entry.landUseMain, entry.landUseSub, entry.landUseCategory].filter(Boolean).join(' / '),
    maxHeight: undefined,
    plotCoverage: entry.plotCoverage,
    isFrozen: false,
    rawAttributes: {
      geometry,
      _isManualEntry: true,
      _isManualLatLng: true,
      _manualId: entry.id,
      _affectionPlan: {
        buildingSetbacks: entry.buildingSetbacks,
        podiumSetbacks: entry.podiumSetbacks,
        parkingRules: entry.parkingRules,
        notes: entry.notes,
        landUseMain: entry.landUseMain,
        landUseSub: entry.landUseSub,
        landUseCategory: entry.landUseCategory,
        heightCategory: entry.heightCategory,
        plotCoverage: entry.plotCoverage,
      },
    },
    verificationSource: 'Manual' as VerificationSource,
    verificationDate: entry.createdAt,
    isApproximateLocation: !entry.polygonCoords || entry.polygonCoords.length < 3,
  };
}
