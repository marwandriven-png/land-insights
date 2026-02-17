import { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import { PlotData } from '@/services/DDAGISService';
import buildingRender from '@/assets/building-render.png';

interface CinematicBuildEffectProps {
  map: L.Map | null;
  plot: PlotData | null;
  boundaryReady: boolean; // true after Phase 2 boundary trace is done
}

/**
 * Phase 3: Massing grow animation inside plot boundary
 * Phase 4: Building render reveal
 */
export function CinematicBuildEffect({ map, plot, boundaryReady }: CinematicBuildEffectProps) {
  const [buildProgress, setBuildProgress] = useState(0);
  const [showBuilding, setShowBuilding] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const buildingOverlayRef = useRef<HTMLDivElement | null>(null);
  const prevPlotId = useRef<string | null>(null);
  const animFrameRef = useRef<number>(0);

  const cleanup = () => {
    if (overlayRef.current) { overlayRef.current.remove(); overlayRef.current = null; }
    if (buildingOverlayRef.current) { buildingOverlayRef.current.remove(); buildingOverlayRef.current = null; }
    cancelAnimationFrame(animFrameRef.current);
    setBuildProgress(0);
    setShowBuilding(false);
  };

  useEffect(() => {
    if (!map || !plot || !boundaryReady) {
      cleanup();
      prevPlotId.current = null;
      return;
    }

    if (prevPlotId.current === plot.id) return;
    prevPlotId.current = plot.id;
    cleanup();

    // Parse max floors from plot data
    const floorsStr = plot.floors || 'G+1';
    const floorMatch = floorsStr.match(/\d+/g);
    const totalFloors = floorMatch ? floorMatch.reduce((sum: number, n: string) => sum + parseInt(n, 10), 0) + 1 : 3;

    // Compute center point on screen
    const rawAttrs = plot.rawAttributes;
    let center: L.LatLng;
    if (rawAttrs && (rawAttrs as Record<string, unknown>).geometry) {
      const geom = (rawAttrs as Record<string, unknown>).geometry as { rings?: number[][][] };
      if (geom.rings && geom.rings[0]) {
        const ring = geom.rings[0];
        const avgX = ring.reduce((s, c) => s + c[0], 0) / ring.length;
        const avgY = ring.reduce((s, c) => s + c[1], 0) / ring.length;
        // proj4 conversion is done by parent, just use map center
        const bounds = map.getBounds();
        center = bounds.getCenter();
      } else {
        center = map.getCenter();
      }
    } else {
      center = map.getCenter();
    }

    const container = map.getContainer();

    // Create massing overlay
    const massingDiv = document.createElement('div');
    massingDiv.className = 'cinematic-massing-container';
    const point = map.latLngToContainerPoint(center);
    massingDiv.style.left = `${point.x}px`;
    massingDiv.style.top = `${point.y}px`;

    // Generate floor layers
    const maxVisualHeight = Math.min(totalFloors * 6, 160);
    for (let i = 0; i < totalFloors; i++) {
      const floor = document.createElement('div');
      floor.className = 'cinematic-massing-floor';
      const floorHeight = maxVisualHeight / totalFloors;
      floor.style.height = `${floorHeight}px`;
      floor.style.width = `${60 + (totalFloors - i) * 1.5}px`;
      floor.style.bottom = `${i * floorHeight}px`;
      floor.style.opacity = `${0.7 - (i / totalFloors) * 0.4}`;
      floor.style.animationDelay = `${i * (1500 / totalFloors)}ms`;
      massingDiv.appendChild(floor);
    }

    // Core pulse indicator
    const core = document.createElement('div');
    core.className = 'cinematic-massing-core';
    core.style.bottom = `${maxVisualHeight * 0.5}px`;
    massingDiv.appendChild(core);

    container.appendChild(massingDiv);
    overlayRef.current = massingDiv;

    // Animate build progress
    const buildDuration = 1500;
    const startTime = performance.now();

    function animateBuild(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / buildDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setBuildProgress(Math.round(eased * 100));

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animateBuild);
      } else {
        // Phase 4: show building with parallax
        setTimeout(() => {
          setShowBuilding(true);

          const buildingDiv = document.createElement('div');
          buildingDiv.className = 'cinematic-building-reveal';
          buildingDiv.innerHTML = `<img src="${buildingRender}" alt="Building Render" class="cinematic-building-image" />`;
          container.appendChild(buildingDiv);
          buildingOverlayRef.current = buildingDiv;

          // Fade out massing
          if (overlayRef.current) {
            overlayRef.current.style.transition = 'opacity 0.6s ease-out';
            overlayRef.current.style.opacity = '0';
          }

          // Parallax: shift building render subtly on map pan
          const parallaxHandler = () => {
            if (!buildingOverlayRef.current) return;
            const mapCenter = map.getCenter();
            const dx = (mapCenter.lng - center.lng) * 800;
            const dy = (mapCenter.lat - center.lat) * -800;
            buildingOverlayRef.current.style.transform = `translate(${dx * 0.15}px, ${dy * 0.15}px)`;
          };
          map.on('move', parallaxHandler);
        }, 200);
      }
    }

    animFrameRef.current = requestAnimationFrame(animateBuild);

    // Update position on map move
    const updatePos = () => {
      if (!overlayRef.current) return;
      const p = map.latLngToContainerPoint(center);
      overlayRef.current.style.left = `${p.x}px`;
      overlayRef.current.style.top = `${p.y}px`;
    };
    map.on('move zoom', updatePos);

    return () => {
      map.off('move zoom', updatePos);
      cleanup();
    };
  }, [map, plot?.id, boundaryReady]);

  useEffect(() => {
    return () => cleanup();
  }, []);

  return null;
}

// Export progress for parent to use
export function useBuildProgress() {
  const [progress, setProgress] = useState(0);
  return { progress, setProgress };
}
