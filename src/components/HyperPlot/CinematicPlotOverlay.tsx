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
  const selectionCountRef = useRef(0);

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
      selectionCountRef.current = 0;
      return;
    }

    if (prevPlotIdRef.current === plot.id) return;
    prevPlotIdRef.current = plot.id;
    selectionCountRef.current++;
    const isSecondSelection = selectionCountRef.current === 2;
    cleanup();

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

    // ─── Smooth 30-frame easeInOutQuad pan (keep current zoom) ───
    setPhase('boundary');
    const currentZoom = map.getZoom();
    const startCenter = map.getCenter();
    const totalFrames = 30;
    let frame = 0;

    function easeInOutQuad(t: number) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function animateZoom() {
      frame++;
      const t = easeInOutQuad(frame / totalFrames);
      const lat = startCenter.lat + (center.lat - startCenter.lat) * t;
      const lng = startCenter.lng + (center.lng - startCenter.lng) * t;
      map.setView([lat, lng], currentZoom, { animate: false });
      if (frame < totalFrames) {
        requestAnimationFrame(animateZoom);
      }
    }
    requestAnimationFrame(animateZoom);
    const cornerDist = center.distanceTo(latLngs[0]);
    const initialRadius = cornerDist * 1.2;

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

    let startTime = performance.now();
    const circleDuration = 800;
    function animateCircle(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / circleDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      circle.setRadius(initialRadius * eased);
      if (progress < 1) {
        requestAnimationFrame(animateCircle);
      }
    }
    requestAnimationFrame(animateCircle);

    const boundaryDelay = setTimeout(() => {
      const circleEl = circle.getElement() as HTMLElement | null;
      if (circleEl) {
        circleEl.style.transition = 'opacity 0.6s ease-out';
        circleEl.style.opacity = '0';
      }

      const glowPoly = L.polygon(latLngs, {
        color: 'transparent',
        weight: 0,
        fillColor: isSecondSelection ? '#00ffaa' : '#00e5ff',
        fillOpacity: 0,
        interactive: false,
        className: 'cinematic-glow-fill'
      });
      glowPoly.addTo(map);
      layersRef.current.push(glowPoly);

      if (isSecondSelection) {
        // 4-layer neon glow (reduced intensity) — only on 2nd selection
        const baseStroke = L.polygon(latLngs, {
          color: '#00ffaa',
          weight: 3,
          opacity: 0.9,
          fillColor: '#00ffaa',
          fillOpacity: 0,
          interactive: false,
          className: 'cinematic-boundary-trace cinematic-neon-pulse'
        });
        baseStroke.addTo(map);
        layersRef.current.push(baseStroke);

        const glow1 = L.polygon(latLngs, {
          color: '#00ffaa',
          weight: 6,
          opacity: 0.35,
          fillColor: 'transparent',
          fillOpacity: 0,
          interactive: false,
          className: 'cinematic-neon-glow-1 cinematic-neon-pulse'
        });
        glow1.addTo(map);
        layersRef.current.push(glow1);

        const glow2 = L.polygon(latLngs, {
          color: '#00ffaa',
          weight: 9,
          opacity: 0.2,
          fillColor: 'transparent',
          fillOpacity: 0,
          interactive: false,
          className: 'cinematic-neon-glow-2 cinematic-neon-pulse'
        });
        glow2.addTo(map);
        layersRef.current.push(glow2);

        const glow3 = L.polygon(latLngs, {
          color: '#00ffaa',
          weight: 12,
          opacity: 0.1,
          fillColor: 'transparent',
          fillOpacity: 0,
          interactive: false,
          className: 'cinematic-neon-glow-3 cinematic-neon-pulse'
        });
        glow3.addTo(map);
        layersRef.current.push(glow3);
      } else {
        // Standard boundary — 1st and 3rd+ selections
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
      }

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
    }, circleDuration + 200);

    return () => {
      clearTimeout(boundaryDelay);
      cleanup();
    };
  }, [map, plot?.id]);

  useEffect(() => {
    return () => cleanup();
  }, []);

  return null;
}
