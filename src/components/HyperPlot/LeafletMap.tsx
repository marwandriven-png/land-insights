import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import proj4 from 'proj4';
import { PlotData } from '@/services/DDAGISService';
import { Loader2, Home, Search, Layers, Printer, Mail, Share2, Crosshair } from 'lucide-react';
import { CinematicPlotOverlay } from './CinematicPlotOverlay';

// Define Dubai Local Transverse Mercator (EPSG:3997)
proj4.defs('EPSG:3997', '+proj=tmerc +lat_0=0 +lon_0=55.33333333333334 +k=1 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

interface LeafletMapProps {
  plots: PlotData[];
  selectedPlot: PlotData | null;
  onPlotClick: (plot: PlotData) => void;
  highlightedPlots: string[];
  onMapReady?: (map: L.Map) => void;
  onFocusPlot?: (plotId: string) => void;
}

// Dubai Bounds
const DUBAI_BOUNDS = L.latLngBounds([24.7000, 54.8000], [25.4000, 55.6000]);

function convertToLatLng(x: number, y: number): [number, number] {
  try {
    const result = proj4('EPSG:3997', 'EPSG:4326', [x, y]);
    return [result[1], result[0]];
  } catch (e) {
    console.error('Coordinate conversion error:', e);
    return [25.0657, 55.1713];
  }
}

const DDA_BLUE = '#2b5a9e';

export function LeafletMap({ plots, selectedPlot, onPlotClick, highlightedPlots, onMapReady, onFocusPlot }: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const plotLayersRef = useRef<Map<string, L.Layer>>(new Map());
  const glowLayersRef = useRef<Map<string, L.Layer>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [buildProgress, setBuildProgress] = useState(0);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [25.075, 55.20],
      zoom: 13,
      minZoom: 11,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: false,
      maxBounds: DUBAI_BOUNDS,
      maxBoundsViscosity: 1.0,
      bounceAtZoomLimits: true,
      worldCopyJump: false
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      noWrap: true
    }).addTo(map);

    L.control.zoom({ position: 'topleft' }).addTo(map);

    mapRef.current = map;
    setMapInstance(map);
    setIsLoading(false);

    if (onMapReady) onMapReady(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onMapReady]);

  // Add plots to map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || plots.length === 0) return;

    plotLayersRef.current.forEach(layer => map.removeLayer(layer));
    plotLayersRef.current.clear();
    glowLayersRef.current.forEach(layer => map.removeLayer(layer));
    glowLayersRef.current.clear();

    function isSelectedOrHighlighted(id: string) {
      return selectedPlot?.id === id || highlightedPlots.includes(id);
    }

    plots.forEach(plot => {
      const rawAttrs = plot.rawAttributes;
      let polygon: L.Polygon | L.CircleMarker;
      let glowLayer: L.Polygon | L.CircleMarker | null = null;
      const active = isSelectedOrHighlighted(plot.id);
      const isSelected = selectedPlot?.id === plot.id;

      if (rawAttrs && (rawAttrs as Record<string, unknown>).geometry) {
        const geom = (rawAttrs as Record<string, unknown>).geometry as { rings?: number[][][] };
        if (geom.rings && geom.rings.length > 0) {
          const latLngs = geom.rings[0].map(coord => {
            const [lat, lng] = convertToLatLng(coord[0], coord[1]);
            return L.latLng(lat, lng);
          });

          if (active) {
            glowLayer = L.polygon(latLngs, {
              color: '#00e5ff',
              weight: 8,
              opacity: 0.4,
              fillColor: 'transparent',
              fillOpacity: 0,
              interactive: false,
              className: 'plot-glow-layer'
            });
          }

          polygon = L.polygon(latLngs, {
            color: isSelected ? '#ffffff' : active ? '#00e5ff' : DDA_BLUE,
            weight: isSelected ? 2.5 : active ? 2 : 1,
            opacity: 1,
            fillColor: DDA_BLUE,
            fillOpacity: active ? 0.65 : 0.35
          });
        } else {
          const [lat, lng] = convertToLatLng(plot.x * 10 + 495000, plot.y * 10 + 2766000);
          polygon = L.circleMarker([lat, lng], {
            radius: 8,
            color: isSelected ? '#ffffff' : active ? '#00e5ff' : DDA_BLUE,
            weight: 2,
            fillColor: DDA_BLUE,
            fillOpacity: 0.6,
            className: active ? 'plot-glow-circle' : ''
          });
        }
      } else {
        const [lat, lng] = convertToLatLng(plot.x * 10 + 495000, plot.y * 10 + 2766000);
        polygon = L.circleMarker([lat, lng], {
          radius: 8,
          color: isSelected ? '#ffffff' : active ? '#00e5ff' : DDA_BLUE,
          weight: 2,
          fillColor: DDA_BLUE,
          fillOpacity: 0.6,
          className: active ? 'plot-glow-circle' : ''
        });
      }

      polygon.bindTooltip(`
        <div class="p-2 min-w-[180px]">
          <div class="font-bold text-sm">${plot.id}</div>
          <div class="text-xs text-gray-400">${plot.location || plot.project || 'Dubai'}</div>
          <hr class="my-1 border-gray-600" />
          <div class="grid grid-cols-2 gap-1 text-xs">
            <span class="text-gray-400">Area:</span>
            <span>${plot.area.toLocaleString()} m²</span>
            <span class="text-gray-400">GFA:</span>
            <span>${plot.gfa.toLocaleString()} m²</span>
            <span class="text-gray-400">Status:</span>
            <span>${plot.status}</span>
          </div>
        </div>
      `, { permanent: false, className: 'plot-tooltip' });

      polygon.on('click', () => onPlotClick(plot));

      if (glowLayer) {
        glowLayer.addTo(map);
        glowLayersRef.current.set(plot.id, glowLayer);
      }
      polygon.addTo(map);
      plotLayersRef.current.set(plot.id, polygon);
    });

    // Auto-zoom to selected plot
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
      setZoomLevel(1.0);
    }
  }, []);

  return (
    <div className={`relative w-full h-full rounded-2xl overflow-hidden ${selectedPlot ? 'cinematic-desaturate' : ''}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur z-50">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '400px' }} />

      {/* DDA Style Home Control */}
      <div className="absolute top-20 left-2 z-[1000] flex flex-col gap-1">
        <button onClick={resetView} className="dda-map-btn" title="Reset View">
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

      {/* ─── Cinematic UI Indicators ─── */}
      {selectedPlot && (
        <>
          {/* Zoom Level Indicator */}
          <div className="absolute top-2 left-2 z-[1000] cinematic-zoom-badge">
            <span className="font-mono text-xs font-bold">{zoomLevel.toFixed(1)}×</span>
          </div>

          {/* Build Progress */}
          {buildProgress > 0 && buildProgress < 100 && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1000] cinematic-progress-bar">
              <div className="flex items-center gap-2">
                <div className="w-32 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-100"
                    style={{
                      width: `${buildProgress}%`,
                      background: 'linear-gradient(90deg, #00ffaa, #00e5ff)'
                    }}
                  />
                </div>
                <span className="font-mono text-[10px] text-[#00ffaa] font-bold">{buildProgress}%</span>
              </div>
            </div>
          )}

          {/* Info overlay with land metrics */}
          <div className="absolute bottom-3 right-3 z-[1000] cinematic-info-overlay">
            <div className="text-[10px] font-mono space-y-0.5">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">ID</span>
                <span className="text-foreground font-bold">{selectedPlot.id}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Area</span>
                <span className="text-foreground">{selectedPlot.area.toLocaleString()} m²</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">GFA</span>
                <span className="text-foreground">{selectedPlot.gfa.toLocaleString()} m²</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Height</span>
                <span className="text-foreground">{selectedPlot.floors}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Zone</span>
                <span className="text-foreground">{selectedPlot.zoning}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Focus Button */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000]">
        {!selectedPlot && (
          <button
            onClick={() => onFocusPlot?.('6820133')}
            className="cinematic-focus-btn"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="font-mono text-xs font-bold">🎯 FOCUS: LAND 6820133</span>
          </button>
        )}
      </div>

      {/* DDA Style Scale Bar */}
      <div className="absolute bottom-3 left-3 z-[1000]">
        <div className="flex items-end gap-1.5 text-[10px] font-mono text-white/80">
          <div className="flex flex-col items-start">
            <div className="h-[2px] bg-white/70" style={{ width: '60px' }} />
          </div>
          500 m
        </div>
      </div>

      {/* Cinematic Plot Overlay */}
      <CinematicPlotOverlay
        map={mapInstance}
        plot={selectedPlot}
        onZoomLevel={setZoomLevel}
        onBuildProgress={setBuildProgress}
      />

      {/* Styles */}
      <style>{`
        .dda-map-btn {
          width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          background: hsl(222 47% 8% / 0.85);
          border: 1px solid hsl(217 33% 25%);
          border-radius: 6px;
          color: hsl(210 40% 85%);
          cursor: pointer; transition: all 0.15s;
        }
        .dda-map-btn:hover {
          background: hsl(217 33% 17%);
          color: hsl(187 94% 43%);
          border-color: hsl(187 94% 43% / 0.4);
        }
        .leaflet-control-zoom { border: none !important; box-shadow: none !important; }
        .leaflet-control-zoom a {
          width: 32px !important; height: 32px !important; line-height: 32px !important;
          background: hsl(222 47% 8% / 0.85) !important;
          color: hsl(210 40% 85%) !important;
          border: 1px solid hsl(217 33% 25%) !important;
          border-radius: 6px !important; margin-bottom: 2px !important; font-size: 16px !important;
        }
        .leaflet-control-zoom a:hover {
          background: hsl(217 33% 17%) !important;
          color: hsl(187 94% 43%) !important;
          border-color: hsl(187 94% 43% / 0.4) !important;
        }
        .plot-tooltip {
          background: hsl(222 47% 8% / 0.95) !important;
          border: 1px solid hsl(187 94% 43% / 0.3) !important;
          border-radius: 0.75rem !important;
          box-shadow: 0 4px 20px hsla(222, 47%, 5%, 0.5) !important;
          color: hsl(210 40% 98%) !important; padding: 0 !important;
        }
        .plot-tooltip::before { border-top-color: hsl(187 94% 43% / 0.3) !important; }
        .plot-glow-layer { filter: drop-shadow(0 0 6px rgba(0, 229, 255, 0.7)) drop-shadow(0 0 14px rgba(0, 229, 255, 0.35)); }
        .plot-glow-circle { filter: drop-shadow(0 0 6px rgba(0, 229, 255, 0.7)) drop-shadow(0 0 12px rgba(0, 229, 255, 0.4)); }
        .cinematic-zoom-badge {
          background: hsl(222 47% 8% / 0.9);
          border: 1px solid hsl(160 100% 50% / 0.4);
          color: #00ffaa;
          padding: 3px 8px;
          border-radius: 6px;
        }
        .cinematic-progress-bar {
          background: hsl(222 47% 8% / 0.85);
          border: 1px solid hsl(160 100% 50% / 0.3);
          border-radius: 8px;
          padding: 4px 10px;
        }
        .cinematic-info-overlay {
          background: hsl(222 47% 8% / 0.9);
          border: 1px solid hsl(217 33% 25%);
          border-radius: 8px;
          padding: 6px 10px;
          min-width: 130px;
        }
        .cinematic-focus-btn {
          display: flex; align-items: center; gap: 6px;
          background: linear-gradient(135deg, hsl(160 100% 50% / 0.15), hsl(187 94% 43% / 0.15));
          border: 1px solid hsl(160 100% 50% / 0.5);
          color: #00ffaa;
          padding: 6px 14px;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.2s;
          animation: cinematic-neon-btn-pulse 2s ease-in-out infinite;
        }
        .cinematic-focus-btn:hover {
          background: linear-gradient(135deg, hsl(160 100% 50% / 0.25), hsl(187 94% 43% / 0.25));
          box-shadow: 0 0 20px hsl(160 100% 50% / 0.3);
        }
        @keyframes cinematic-neon-btn-pulse {
          0%, 100% { box-shadow: 0 0 8px hsl(160 100% 50% / 0.2); }
          50% { box-shadow: 0 0 16px hsl(160 100% 50% / 0.4); }
        }
      `}</style>
    </div>
  );
}
