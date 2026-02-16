import { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import { PlotData } from '@/services/DDAGISService';
import proj4 from 'proj4';

proj4.defs('EPSG:3997', '+proj=tmerc +lat_0=0 +lon_0=55.33333333333334 +k=1 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

function convertToLatLng(x: number, y: number): [number, number] {
  try {
    const result = proj4('EPSG:3997', 'EPSG:4326', [x, y]);
    return [result[1], result[0]];
  } catch {
    return [25.0657, 55.1713];
  }
}

interface CinematicPlotOverlayProps {
  map: L.Map | null;
  plot: PlotData | null;
}

export function CinematicPlotOverlay({ map, plot }: CinematicPlotOverlayProps) {
  const [phase, setPhase] = useState<'idle' | 'boundary' | 'text'>('idle');
  const layersRef = useRef<L.Layer[]>([]);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const prevPlotIdRef = useRef<string | null>(null);

  // Clean up layers
  const cleanup = () => {
    if (map) {
      layersRef.current.forEach(l => map.removeLayer(l));
    }
    layersRef.current = [];
    if (overlayRef.current) {
      overlayRef.current.remove();
      overlayRef.current = null;
    }
    setPhase('idle');
  };

  useEffect(() => {
    if (!map || !plot) {
      cleanup();
      prevPlotIdRef.current = null;
      return;
    }

    // Don't re-trigger if same plot
    if (prevPlotIdRef.current === plot.id) return;
    prevPlotIdRef.current = plot.id;

    cleanup();

    // Determine polygon coordinates
    const rawAttrs = plot.rawAttributes;
    let latLngs: L.LatLng[] = [];

    if (rawAttrs && (rawAttrs as Record<string, unknown>).geometry) {
      const geom = (rawAttrs as Record<string, unknown>).geometry as { rings?: number[][][] };
      if (geom.rings && geom.rings.length > 0) {
        latLngs = geom.rings[0].map(coord => {
          const [lat, lng] = convertToLatLng(coord[0], coord[1]);
          return L.latLng(lat, lng);
        });
      }
    }

    if (latLngs.length === 0) {
      const [lat, lng] = convertToLatLng(plot.x * 10 + 495000, plot.y * 10 + 2766000);
      // Create a small square for fallback
      const offset = 0.0005;
      latLngs = [
        L.latLng(lat - offset, lng - offset),
        L.latLng(lat - offset, lng + offset),
        L.latLng(lat + offset, lng + offset),
        L.latLng(lat + offset, lng - offset),
      ];
    }

    // Phase 1: Boundary trace animation
    setPhase('boundary');

    // Outer glow layer
    const glowPoly = L.polygon(latLngs, {
      color: 'transparent',
      weight: 0,
      fillColor: '#00e5ff',
      fillOpacity: 0,
      interactive: false,
      className: 'cinematic-glow-fill'
    });
    glowPoly.addTo(map);
    layersRef.current.push(glowPoly);

    // Animated boundary stroke using SVG path
    const boundaryPoly = L.polygon(latLngs, {
      color: '#00e5ff',
      weight: 3,
      opacity: 1,
      fillColor: '#00e5ff',
      fillOpacity: 0,
      interactive: false,
      className: 'cinematic-boundary-trace'
    });
    boundaryPoly.addTo(map);
    layersRef.current.push(boundaryPoly);

    // Secondary inner glow
    const innerGlow = L.polygon(latLngs, {
      color: '#00e5ff',
      weight: 10,
      opacity: 0.15,
      fillColor: 'transparent',
      fillOpacity: 0,
      interactive: false,
      className: 'cinematic-inner-glow'
    });
    innerGlow.addTo(map);
    layersRef.current.push(innerGlow);

    // After boundary animation completes, show fill + text
    const boundaryTimer = setTimeout(() => {
      // Fill reveal
      if (glowPoly.getElement()) {
        glowPoly.getElement()!.classList.add('cinematic-fill-reveal');
      }

      setPhase('text');

      // Create text overlay
      const bounds = boundaryPoly.getBounds();
      const center = bounds.getCenter();
      const point = map.latLngToContainerPoint(center);

      const container = map.getContainer();
      const textDiv = document.createElement('div');
      textDiv.className = 'cinematic-text-overlay';
      textDiv.innerHTML = `
        <div class="cinematic-text-content">
          <div class="cinematic-plot-area">${plot.area.toLocaleString()} m²</div>
          <div class="cinematic-plot-dims">${Math.round(Math.sqrt(plot.area))} × ${Math.round(plot.area / Math.sqrt(plot.area))} m</div>
          <div class="cinematic-plot-id">${plot.id}</div>
        </div>
      `;
      textDiv.style.left = `${point.x}px`;
      textDiv.style.top = `${point.y}px`;
      container.appendChild(textDiv);
      overlayRef.current = textDiv;

      // Update text position on map move
      const updatePos = () => {
        if (!overlayRef.current) return;
        const p = map.latLngToContainerPoint(center);
        overlayRef.current.style.left = `${p.x}px`;
        overlayRef.current.style.top = `${p.y}px`;
      };
      map.on('move zoom', updatePos);

    }, 1800); // Wait for boundary trace to complete

    return () => {
      clearTimeout(boundaryTimer);
      cleanup();
    };
  }, [map, plot?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, []);

  return null; // This component renders via Leaflet DOM manipulation
}
