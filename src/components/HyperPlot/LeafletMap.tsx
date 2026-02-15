import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import proj4 from 'proj4';
import { PlotData } from '@/services/DDAGISService';
import { Loader2 } from 'lucide-react';

// Define Dubai Local Transverse Mercator (EPSG:3997)
proj4.defs('EPSG:3997', '+proj=tmerc +lat_0=0 +lon_0=55.33333333333334 +k=1 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

interface LeafletMapProps {
  plots: PlotData[];
  selectedPlot: PlotData | null;
  onPlotClick: (plot: PlotData) => void;
  highlightedPlots: string[];
  onMapReady?: (map: L.Map) => void;
}

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

// Get status color
function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'available':
      return '#22c55e';
    case 'reserved':
    case 'under construction':
      return '#f97316';
    case 'completed':
      return '#6b7280';
    case 'frozen':
      return '#ef4444';
    default:
      return '#22c55e';
  }
}

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
      center: [25.0657, 55.1713],
      zoom: 12,
      zoomControl: false,
      attributionControl: true
    });

    // Add Esri World Imagery basemap (satellite)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 19
    }).addTo(map);

    // Add zoom control to top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Add scale bar
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

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

    const bounds: L.LatLngBounds[] = [];

    plots.forEach(plot => {
      // Check if plot has raw geometry data
      const rawAttrs = plot.rawAttributes;
      let polygon: L.Polygon | L.CircleMarker;

      if (rawAttrs && (rawAttrs as Record<string, unknown>).geometry) {
        // Use actual polygon geometry if available
        const geom = (rawAttrs as Record<string, unknown>).geometry as { rings?: number[][][] };
        if (geom.rings && geom.rings.length > 0) {
          const latLngs = geom.rings[0].map(coord => {
            const [lat, lng] = convertToLatLng(coord[0], coord[1]);
            return L.latLng(lat, lng);
          });

          const isSelected = selectedPlot?.id === plot.id;
          const isHighlighted = highlightedPlots.includes(plot.id);
          const glowActive = isSelected || isHighlighted;

          polygon = L.polygon(latLngs, {
            color: glowActive ? '#00e5ff' : getStatusColor(plot.status),
            weight: isSelected ? 3 : 2,
            opacity: 1,
            fillColor: getStatusColor(plot.status),
            fillOpacity: isHighlighted ? 0.6 : 0.4,
            className: glowActive ? 'plot-glow' : ''
          });

          bounds.push(polygon.getBounds());
        } else {
          // Fallback to circle marker
          const [lat2, lng2] = convertToLatLng(plot.x * 10 + 495000, plot.y * 10 + 2766000);
          const isFallbackSel = selectedPlot?.id === plot.id;
          const isFallbackHL = highlightedPlots.includes(plot.id);
          polygon = L.circleMarker([lat2, lng2], {
            radius: Math.sqrt(plot.area) / 5,
            color: (isFallbackSel || isFallbackHL) ? '#00e5ff' : getStatusColor(plot.status),
            weight: 2,
            fillColor: getStatusColor(plot.status),
            fillOpacity: 0.4,
            className: (isFallbackSel || isFallbackHL) ? 'plot-glow' : ''
          });
        }
      } else {
        // Create marker from normalized coordinates (demo mode)
        const [lat, lng] = convertToLatLng(plot.x * 10 + 495000, plot.y * 10 + 2766000);
        const isSel = selectedPlot?.id === plot.id;
        const isHL = highlightedPlots.includes(plot.id);
        polygon = L.circleMarker([lat, lng], {
          radius: Math.sqrt(plot.area) / 5,
          color: (isSel || isHL) ? '#00e5ff' : getStatusColor(plot.status),
          weight: 2,
          fillColor: getStatusColor(plot.status),
          fillOpacity: 0.4,
          className: (isSel || isHL) ? 'plot-glow' : ''
        });
      }

      // Add tooltip
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
            <span style="color: ${getStatusColor(plot.status)}">${plot.status}</span>
          </div>
        </div>
      `, {
        permanent: false,
        className: 'plot-tooltip'
      });

      // Add click handler
      polygon.on('click', () => {
        onPlotClick(plot);
      });

      polygon.addTo(map);
      plotLayersRef.current.set(plot.id, polygon);
    });

    // Fit map to show all plots
    if (bounds.length > 0) {
      let combinedBounds = L.latLngBounds(bounds[0].getSouthWest(), bounds[0].getNorthEast());
      bounds.forEach(b => {
        combinedBounds = combinedBounds.extend(b);
      });
      map.fitBounds(combinedBounds, { padding: [50, 50] });
    }
  }, [plots, selectedPlot, highlightedPlots, onPlotClick]);

  // Handle selected plot highlighting and zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlot) return;

    const layer = plotLayersRef.current.get(selectedPlot.id);
    if (layer) {
      // Reset previous selection
      if (selectedLayerRef.current && selectedLayerRef.current !== layer) {
        const prevPlot = plots.find(p => plotLayersRef.current.get(p.id) === selectedLayerRef.current);
        if (prevPlot) {
          (selectedLayerRef.current as L.Path).setStyle({
            color: getStatusColor(prevPlot.status),
            weight: 2
          });
        }
      }

      // Highlight selected with cyan glow
      (layer as L.Path).setStyle({
        color: '#00e5ff',
        weight: 3,
        className: 'plot-glow'
      });
      selectedLayerRef.current = layer;

      // Zoom to selected
      if ('getBounds' in layer) {
        map.fitBounds((layer as L.Polygon).getBounds(), { padding: [100, 100], maxZoom: 17 });
      } else if ('getLatLng' in layer) {
        map.setView((layer as L.CircleMarker).getLatLng(), 16);
      }
    }
  }, [selectedPlot, plots]);

  // Function to zoom to specific plot (for external use)
  const zoomToPlot = useCallback((plotId: string) => {
    const map = mapRef.current;
    const layer = plotLayersRef.current.get(plotId);
    if (map && layer) {
      if ('getBounds' in layer) {
        map.fitBounds((layer as L.Polygon).getBounds(), { padding: [100, 100], maxZoom: 17 });
      } else if ('getLatLng' in layer) {
        map.setView((layer as L.CircleMarker).getLatLng(), 16);
      }
    }
  }, []);

  // Reset view function
  const resetView = useCallback(() => {
    const map = mapRef.current;
    if (map && plots.length > 0) {
      const boundsArr: L.LatLngBounds[] = [];
      plotLayersRef.current.forEach(layer => {
        if ('getBounds' in layer) {
          boundsArr.push((layer as L.Polygon).getBounds());
        }
      });
      if (boundsArr.length > 0) {
        let combinedBounds = L.latLngBounds(boundsArr[0].getSouthWest(), boundsArr[0].getNorthEast());
        boundsArr.forEach(b => {
          combinedBounds = combinedBounds.extend(b);
        });
        map.fitBounds(combinedBounds, { padding: [50, 50] });
      }
    }
  }, [plots]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur z-50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading map...</span>
          </div>
        </div>
      )}
      
      <div 
        ref={mapContainerRef} 
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />

      {/* Custom Map Controls */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={resetView}
          className="glass-card p-2 hover:bg-muted/50 transition-colors"
          title="Reset View"
        >
          <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[1000] glass-card p-3">
        <div className="text-xs font-bold text-primary mb-2">Status Legend</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }} />
            <span className="text-muted-foreground">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f97316' }} />
            <span className="text-muted-foreground">Reserved/In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#6b7280' }} />
            <span className="text-muted-foreground">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }} />
            <span className="text-muted-foreground">Frozen</span>
          </div>
        </div>
      </div>

      {/* Tooltip Styles */}
      <style>{`
        .plot-tooltip {
          background: hsl(222 47% 8% / 0.95) !important;
          border: 1px solid hsl(187 94% 43% / 0.3) !important;
          border-radius: 0.75rem !important;
          box-shadow: 0 4px 20px hsla(222, 47%, 5%, 0.5) !important;
          color: hsl(210 40% 98%) !important;
          padding: 0 !important;
        }
        .plot-tooltip::before {
          border-top-color: hsl(187 94% 43% / 0.3) !important;
        }
        .leaflet-control-zoom a {
          background: hsl(222 47% 8% / 0.9) !important;
          color: hsl(210 40% 98%) !important;
          border: 1px solid hsl(217 33% 20%) !important;
        }
        .leaflet-control-zoom a:hover {
          background: hsl(217 33% 17%) !important;
        }
        .leaflet-control-scale-line {
          background: hsl(222 47% 8% / 0.9) !important;
          border-color: hsl(187 94% 43% / 0.5) !important;
          color: hsl(210 40% 98%) !important;
        }
        .plot-glow {
          filter: drop-shadow(0 0 6px rgba(0, 229, 255, 0.7)) drop-shadow(0 0 12px rgba(0, 229, 255, 0.4));
        }
      `}</style>
    </div>
  );
}
