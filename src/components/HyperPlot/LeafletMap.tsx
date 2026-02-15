import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import proj4 from 'proj4';
import { PlotData } from '@/services/DDAGISService';
import { Loader2, Home, Search, Layers, Printer, Mail, Share2, MapPin } from 'lucide-react';

// Define Dubai Local Transverse Mercator (EPSG:3997)
proj4.defs('EPSG:3997', '+proj=tmerc +lat_0=0 +lon_0=55.33333333333334 +k=1 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

interface LeafletMapProps {
  plots: PlotData[];
  selectedPlot: PlotData | null;
  onPlotClick: (plot: PlotData) => void;
  highlightedPlots: string[];
  onMapReady?: (map: L.Map) => void;
}

// Dubai Bounds - strictly lock to Dubai
const DUBAI_BOUNDS = L.latLngBounds(
  [24.7000, 54.8000], // Southwest
  [25.4000, 55.6000]  // Northeast
);

// Convert EPSG:3997 coordinates to WGS84 (lat/lng)
function convertToLatLng(x: number, y: number): [number, number] {
  try {
    const result = proj4('EPSG:3997', 'EPSG:4326', [x, y]);
    return [result[1], result[0]]; // [lat, lng]
  } catch (e) {
    console.error('Coordinate conversion error:', e);
    return [25.0657, 55.1713]; // Default Dubai coordinates
  }
}

// DDA Blue Color
const DDA_BLUE = '#2b5a9e';
const DDA_BLUE_LIGHT = '#3d79cc';

export function LeafletMap({
  plots,
  selectedPlot,
  onPlotClick,
  highlightedPlots,
  onMapReady
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const plotLayersRef = useRef<Map<string, L.Layer>>(new Map());
  const selectedLayerRef = useRef<L.Layer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map centered on Dubai
    const map = L.map(mapContainerRef.current, {
      center: [25.075, 55.20],
      zoom: 13,
      minZoom: 11,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: false,
      maxBounds: DUBAI_BOUNDS,
      maxBoundsViscosity: 1.0, // Strict bounce back
      bounceAtZoomLimits: true,
      worldCopyJump: false
    });

    // Satellite Imagery Layer - MATCHING DDA VIBE
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      noWrap: true // Fix infinite scrolling
    }).addTo(map);

    // Zoom and Custom Controls in top-left as per DDA
    const zoomControl = L.control.zoom({ position: 'topleft' });
    zoomControl.addTo(map);

    mapRef.current = map;
    setIsLoading(false);

    if (onMapReady) {
      onMapReady(map);
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onMapReady]);

  // Add plots to map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || plots.length === 0) return;

    // Clear existing layers
    plotLayersRef.current.forEach(layer => map.removeLayer(layer));
    plotLayersRef.current.clear();

    function isSelectedOrHighlighted(id: string) {
      return selectedPlot?.id === id || highlightedPlots.includes(id);
    }

    plots.forEach(plot => {
      const rawAttrs = plot.rawAttributes;
      let polygon: L.Polygon | L.CircleMarker;

      if (rawAttrs && (rawAttrs as Record<string, unknown>).geometry) {
        const geom = (rawAttrs as Record<string, unknown>).geometry as { rings?: number[][][] };
        if (geom.rings && geom.rings.length > 0) {
          const latLngs = geom.rings[0].map(coord => {
            const [lat, lng] = convertToLatLng(coord[0], coord[1]);
            return L.latLng(lat, lng);
          });

          polygon = L.polygon(latLngs, {
            color: selectedPlot?.id === plot.id ? '#ffffff' : DDA_BLUE,
            weight: selectedPlot?.id === plot.id ? 2 : 1,
            opacity: 1,
            fillColor: DDA_BLUE,
            fillOpacity: isSelectedOrHighlighted(plot.id) ? 0.7 : 0.4
          });
        } else {
          const [lat, lng] = convertToLatLng(plot.x * 10 + 495000, plot.y * 10 + 2766000);
          polygon = L.circleMarker([lat, lng], {
            radius: 8,
            color: selectedPlot?.id === plot.id ? '#ffffff' : DDA_BLUE,
            weight: 2,
            fillColor: DDA_BLUE,
            fillOpacity: 0.6
          });
        }
      } else {
        const [lat, lng] = convertToLatLng(plot.x * 10 + 495000, plot.y * 10 + 2766000);
        polygon = L.circleMarker([lat, lng], {
          radius: 8,
          color: selectedPlot?.id === plot.id ? '#ffffff' : DDA_BLUE,
          weight: 2,
          fillColor: DDA_BLUE,
          fillOpacity: 0.6
        });
      }

      polygon.on('click', () => onPlotClick(plot));
      polygon.addTo(map);
      plotLayersRef.current.set(plot.id, polygon);
    });

    // Auto-zoom if specific plot number was found (from wizard)
    if (selectedPlot && plotLayersRef.current.has(selectedPlot.id)) {
      const layer = plotLayersRef.current.get(selectedPlot.id);
      if (layer) {
        if ('getBounds' in layer) {
          map.fitBounds((layer as L.Polygon).getBounds(), { padding: [100, 100], maxZoom: 17 });
        } else {
          map.setView((layer as L.CircleMarker).getLatLng(), 17);
        }
      }
    }
  }, [plots, selectedPlot, highlightedPlots, onPlotClick]);

  const resetView = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.setView([25.075, 55.20], 13);
    }
  }, []);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur z-50">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />

      {/* DDA Style Floating Controls top-left */}
      <div className="absolute top-20 left-2 z-[1000] flex flex-col gap-1">
        <button
          onClick={resetView}
          className="dda-map-btn"
          title="Reset View"
        >
          <Home className="w-4 h-4" />
        </button>
      </div>

      {/* DDA Style Toolbar top-right */}
      <div className="absolute top-2 right-2 z-[1000]">
        <div className="flex flex-col gap-1">
          <button className="dda-map-btn" title="Search"><Search className="w-4 h-4" /></button>
          <button className="dda-map-btn" title="Layers"><Layers className="w-4 h-4" /></button>
          <button className="dda-map-btn" title="Print"><Printer className="w-4 h-4" /></button>
          <button className="dda-map-btn" title="Email"><Mail className="w-4 h-4" /></button>
          <button className="dda-map-btn" title="Share"><Share2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* DDA Style Scale Bar bottom-left */}
      <div className="absolute bottom-3 left-3 z-[1000]">
        <div className="flex items-end gap-1.5 text-[10px] font-mono text-white/80">
          <div className="flex flex-col items-start">
            <div
              className="h-[2px] bg-white/70"
              style={{ width: '60px' }}
            />
          </div>
          500 m
        </div>
      </div>

      {/* Map control styles */}
      <style>{`
        .dda-map-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: hsl(222 47% 8% / 0.85);
          border: 1px solid hsl(217 33% 25%);
          border-radius: 6px;
          color: hsl(210 40% 85%);
          cursor: pointer;
          transition: all 0.15s;
        }
        .dda-map-btn:hover {
          background: hsl(217 33% 17%);
          color: hsl(187 94% 43%);
          border-color: hsl(187 94% 43% / 0.4);
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: none !important;
        }
        .leaflet-control-zoom a {
          width: 32px !important;
          height: 32px !important;
          line-height: 32px !important;
          background: hsl(222 47% 8% / 0.85) !important;
          color: hsl(210 40% 85%) !important;
          border: 1px solid hsl(217 33% 25%) !important;
          border-radius: 6px !important;
          margin-bottom: 2px !important;
          font-size: 16px !important;
        }
        .leaflet-control-zoom a:hover {
          background: hsl(217 33% 17%) !important;
          color: hsl(187 94% 43%) !important;
          border-color: hsl(187 94% 43% / 0.4) !important;
        }
      `}</style>
    </div>
  );
}
