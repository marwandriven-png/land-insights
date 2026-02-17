import { useEffect, useState, useRef, useCallback } from 'react';
import L from 'leaflet';
import { PlotData } from '@/services/DDAGISService';
import proj4 from 'proj4';
import { CinematicBuildEffect } from './CinematicBuildEffect';

proj4.defs('EPSG:3997', '+proj=tmerc +lat_0=0 +lon_0=55.33333333333334 +k=1 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

function convertToLatLng(x: number, y: number): [number, number] {
  try {
    const result = proj4('EPSG:3997', 'EPSG:4326', [x, y]);
    return [result[1], result[0]];
  } catch {
    return [25.0657, 55.1713];
  }
}

// Neon color for the 4-layer glow border
const NEON_COLOR = '#00ffaa';

interface CinematicPlotOverlayProps {
  map: L.Map | null;
  plot: PlotData | null;
  onZoomLevel?: (level: number) => void;
  onBuildProgress?: (progress: number) => void;
}

export function CinematicPlotOverlay({ map, plot, onZoomLevel, onBuildProgress }: CinematicPlotOverlayProps) {
  const [phase, setPhase] = useState<'idle' | 'boundary' | 'text'>('idle');
  const [boundaryReady, setBoundaryReady] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const layersRef = useRef<L.Layer[]>([]);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const prevPlotIdRef = useRef<string | null>(null);
  const zoomAnimRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (map) {
      layersRef.current.forEach(l => map.removeLayer(l));
    }
    layersRef.current = [];
    if (overlayRef.current) {
      overlayRef.current.remove();
      overlayRef.current = null;
    }
    cancelAnimationFrame(zoomAnimRef.current);
    setPhase('idle');
    setBoundaryReady(false);
    setBuildProgress(0);
  }, [map]);

  // Report build progress to parent
  useEffect(() => {
    onBuildProgress?.(buildProgress);
  }, [buildProgress, onBuildProgress]);

  useEffect(() => {
    if (!map || !plot) {
      cleanup();
      prevPlotIdRef.current = null;
      return;
    }

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
      const offset = 0.0005;
      latLngs = [
        L.latLng(lat - offset, lng - offset),
        L.latLng(lat - offset, lng + offset),
        L.latLng(lat + offset, lng + offset),
        L.latLng(lat + offset, lng - offset),
      ];
    }

    const bounds = L.latLngBounds(latLngs);
    const center = bounds.getCenter();

    // ─── PHASE 1: Smooth animated zoom (easeInOutQuad, 30 frames) ───
    setPhase('boundary');
    const startZoom = map.getZoom();
    const targetZoom = Math.min(startZoom + Math.log2(2.5), 19);
    const startCenter = map.getCenter();
    const zoomFrames = 30;
    let frame = 0;

    function easeInOutQuad(t: number) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function animateZoom() {
      frame++;
      const t = easeInOutQuad(frame / zoomFrames);
      const lat = startCenter.lat + (center.lat - startCenter.lat) * t;
      const lng = startCenter.lng + (center.lng - startCenter.lng) * t;
      const zoom = startZoom + (targetZoom - startZoom) * t;
      map.setView([lat, lng], zoom, { animate: false });
      onZoomLevel?.(parseFloat((1 + (2.5 - 1) * t).toFixed(1)));

      if (frame < zoomFrames) {
        zoomAnimRef.current = requestAnimationFrame(animateZoom);
      }
    }
    zoomAnimRef.current = requestAnimationFrame(animateZoom);

    // ─── PHASE 2: 4-layer neon glowing border with pulsing ───
    const cornerDist = center.distanceTo(latLngs[0]);
    const initialRadius = cornerDist * 1.2;

    // Expanding circle
    const circle = L.circle(center, {
      radius: 0,
      color: NEON_COLOR,
      weight: 2.5,
      opacity: 1,
      fillColor: NEON_COLOR,
      fillOpacity: 0.08,
      interactive: false,
      className: 'cinematic-circle-expand'
    });
    circle.addTo(map);
    layersRef.current.push(circle);

    let startTime = performance.now();
    const circleDuration = 800;
    function animateCircle(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / circleDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      circle.setRadius(initialRadius * eased);
      if (progress < 1) requestAnimationFrame(animateCircle);
    }
    requestAnimationFrame(animateCircle);

    // After circle, create 4-layer neon border
    const boundaryDelay = setTimeout(() => {
      const circleEl = circle.getElement() as HTMLElement | null;
      if (circleEl) {
        circleEl.style.transition = 'opacity 0.6s ease-out';
        circleEl.style.opacity = '0';
      }

      // Layer 1: Base stroke (4px solid)
      const baseStroke = L.polygon(latLngs, {
        color: NEON_COLOR,
        weight: 4,
        opacity: 1,
        fillColor: NEON_COLOR,
        fillOpacity: 0,
        interactive: false,
        className: 'cinematic-boundary-trace cinematic-neon-pulse'
      });
      baseStroke.addTo(map);
      layersRef.current.push(baseStroke);

      // Layer 2: 8px blur, 60% opacity
      const glow1 = L.polygon(latLngs, {
        color: NEON_COLOR,
        weight: 8,
        opacity: 0.6,
        fillColor: 'transparent',
        fillOpacity: 0,
        interactive: false,
        className: 'cinematic-neon-glow-1 cinematic-neon-pulse'
      });
      glow1.addTo(map);
      layersRef.current.push(glow1);

      // Layer 3: 12px blur, 40% opacity
      const glow2 = L.polygon(latLngs, {
        color: NEON_COLOR,
        weight: 12,
        opacity: 0.4,
        fillColor: 'transparent',
        fillOpacity: 0,
        interactive: false,
        className: 'cinematic-neon-glow-2 cinematic-neon-pulse'
      });
      glow2.addTo(map);
      layersRef.current.push(glow2);

      // Layer 4: 16px blur, 20% opacity
      const glow3 = L.polygon(latLngs, {
        color: NEON_COLOR,
        weight: 16,
        opacity: 0.2,
        fillColor: 'transparent',
        fillOpacity: 0,
        interactive: false,
        className: 'cinematic-neon-glow-3 cinematic-neon-pulse'
      });
      glow3.addTo(map);
      layersRef.current.push(glow3);

      // Fill reveal
      const fillPoly = L.polygon(latLngs, {
        color: 'transparent',
        weight: 0,
        fillColor: NEON_COLOR,
        fillOpacity: 0,
        interactive: false,
        className: 'cinematic-glow-fill'
      });
      fillPoly.addTo(map);
      layersRef.current.push(fillPoly);

      // Text + metric overlay after boundary trace completes
      const textTimer = setTimeout(() => {
        if (fillPoly.getElement()) {
          fillPoly.getElement()!.classList.add('cinematic-fill-reveal');
        }
        setPhase('text');
        setBoundaryReady(true);

        const point = map.latLngToContainerPoint(center);
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
          const p = map.latLngToContainerPoint(center);
          overlayRef.current.style.left = `${p.x}px`;
          overlayRef.current.style.top = `${p.y}px`;
        };
        map.on('move zoom', updatePos);

        // Start build progress animation for Phase 3/4
        const buildDuration = 1500;
        const buildStart = performance.now();
        function animateBuild(now: number) {
          const elapsed = now - buildStart;
          const progress = Math.min(elapsed / buildDuration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setBuildProgress(Math.round(eased * 100));
          if (progress < 1) requestAnimationFrame(animateBuild);
        }
        requestAnimationFrame(animateBuild);
      }, 1800);

      return () => clearTimeout(textTimer);
    }, circleDuration + 200);

    return () => {
      clearTimeout(boundaryDelay);
      cleanup();
    };
  }, [map, plot?.id, cleanup, onZoomLevel, onBuildProgress]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return (
    <CinematicBuildEffect map={map} plot={plot} boundaryReady={boundaryReady} />
  );
}
