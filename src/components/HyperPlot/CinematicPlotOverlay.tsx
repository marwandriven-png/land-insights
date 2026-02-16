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

    // Phase 1: Circle expand then boundary trace
    setPhase('boundary');

    // Calculate center and radius for initial circle
    const bounds = L.latLngBounds(latLngs);
    const center = bounds.getCenter();
    // Approximate radius to encompass the plot
    const cornerDist = center.distanceTo(latLngs[0]);
    const initialRadius = cornerDist * 1.2;

    // Expanding circle that appears first
    const circle = L.circle(center, {
      radius: 0,
      color: '#00e5ff',
      weight: 2.5,
      opacity: 1,
      fillColor: '#00e5ff',
      fillOpacity: 0.08,
      interactive: false,
      className: 'cinematic-circle-expand'
    });
    circle.addTo(map);
    layersRef.current.push(circle);

    // Animate circle expansion
    let startTime = performance.now();
    const circleDuration = 800;
    function animateCircle(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / circleDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      circle.setRadius(initialRadius * eased);
      if (progress < 1) {
        requestAnimationFrame(animateCircle);
      }
    }
    requestAnimationFrame(animateCircle);

    // After circle expands, fade it and trace boundary
    const boundaryDelay = setTimeout(() => {
      // Fade out circle
      const circleEl = circle.getElement() as HTMLElement | null;
      if (circleEl) {
        circleEl.style.transition = 'opacity 0.6s ease-out';
        circleEl.style.opacity = '0';
      }

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

      // Animated boundary stroke
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

      // Inner glow
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

      // After boundary trace completes, show fill + text
      const textTimer = setTimeout(() => {
        if (glowPoly.getElement()) {
          glowPoly.getElement()!.classList.add('cinematic-fill-reveal');
        }

        setPhase('text');

        const bCenter = bounds.getCenter();
        const point = map.latLngToContainerPoint(bCenter);
        const sqft = Math.round(plot.area * 10.7639);
        const sideFt = Math.round(Math.sqrt(plot.area) * 3.28084);

        const container = map.getContainer();
        const textDiv = document.createElement('div');
        textDiv.className = 'cinematic-text-overlay';
        textDiv.innerHTML = `
          <div class="cinematic-text-content">
            <div class="cinematic-plot-area">${sqft.toLocaleString()} sqft</div>
            <div class="cinematic-plot-dims">${sideFt} × ${Math.round(sqft / sideFt)} ft</div>
            <div class="cinematic-plot-id">${plot.id}</div>
          </div>
        `;
        textDiv.style.left = `${point.x}px`;
        textDiv.style.top = `${point.y}px`;
        container.appendChild(textDiv);
        overlayRef.current = textDiv;

        const updatePos = () => {
          if (!overlayRef.current) return;
          const p = map.latLngToContainerPoint(bCenter);
          overlayRef.current.style.left = `${p.x}px`;
          overlayRef.current.style.top = `${p.y}px`;
        };
        map.on('move zoom', updatePos);
      }, 1800);

      return () => clearTimeout(textTimer);
    }, circleDuration + 200); // Start boundary after circle completes

    return () => {
      clearTimeout(boundaryDelay);
      cleanup();
    };
  }, [map, plot?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, []);

  return null; // This component renders via Leaflet DOM manipulation
}
