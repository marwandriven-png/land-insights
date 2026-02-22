import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Ruler, Trash2, X } from 'lucide-react';

type MeasureMode = 'none' | 'distance' | 'area';
type MeasureUnit = 'metric' | 'imperial' | 'feet' | 'yards';

const UNIT_OPTIONS: { value: MeasureUnit; label: string }[] = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
  { value: 'feet', label: 'Feet' },
  { value: 'yards', label: 'Yards' },
];

function formatDistance(meters: number, unit: MeasureUnit): string {
  switch (unit) {
    case 'imperial': return (meters * 3.28084 / 5280).toFixed(2) + ' mi';
    case 'feet': return (meters * 3.28084).toFixed(2) + ' ft';
    case 'yards': return (meters * 1.09361).toFixed(2) + ' yd';
    default: return meters >= 1000 ? (meters / 1000).toFixed(2) + ' km' : meters.toFixed(2) + ' m';
  }
}

function formatArea(sqMeters: number, unit: MeasureUnit): string {
  switch (unit) {
    case 'imperial': return (sqMeters * 10.7639).toFixed(2) + ' ft²';
    case 'feet': return (sqMeters * 10.7639).toFixed(2) + ' ft²';
    case 'yards': return (sqMeters * 1.19599).toFixed(2) + ' yd²';
    default: return sqMeters >= 10000 ? (sqMeters / 10000).toFixed(2) + ' ha' : sqMeters.toFixed(2) + ' m²';
  }
}

function computeDistance(latlngs: L.LatLng[]): number {
  let d = 0;
  for (let i = 1; i < latlngs.length; i++) {
    d += latlngs[i - 1].distanceTo(latlngs[i]);
  }
  return d;
}

function computeArea(latlngs: L.LatLng[]): number {
  // Shoelace on projected coords (approximate)
  if (latlngs.length < 3) return 0;
  const R = 6371000;
  const toRad = Math.PI / 180;
  const points = latlngs.map(ll => ({
    x: ll.lng * toRad * R * Math.cos(ll.lat * toRad),
    y: ll.lat * toRad * R,
  }));
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

interface MapMeasureToolProps {
  map: L.Map | null;
}

export function MapMeasureTool({ map }: MapMeasureToolProps) {
  const [mode, setMode] = useState<MeasureMode>('none');
  const [unit, setUnit] = useState<MeasureUnit>('metric');
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [distance, setDistance] = useState(0);
  const [area, setArea] = useState(0);
  const [perimeter, setPerimeter] = useState(0);

  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const labelsRef = useRef<L.Marker[]>([]);

  // Initialize layer group
  useEffect(() => {
    if (!map) return;
    const lg = L.layerGroup().addTo(map);
    layerGroupRef.current = lg;
    return () => { lg.remove(); };
  }, [map]);

  const clearMeasurement = useCallback(() => {
    const lg = layerGroupRef.current;
    if (lg) lg.clearLayers();
    polylineRef.current = null;
    polygonRef.current = null;
    labelsRef.current = [];
    setPoints([]);
    setDistance(0);
    setArea(0);
    setPerimeter(0);
  }, []);

  const stopMeasure = useCallback(() => {
    clearMeasurement();
    setMode('none');
  }, [clearMeasurement]);

  // Draw measurement shapes
  const redraw = useCallback((pts: L.LatLng[], currentMode: MeasureMode) => {
    const lg = layerGroupRef.current;
    if (!lg || !map) return;
    lg.clearLayers();
    polylineRef.current = null;
    polygonRef.current = null;
    labelsRef.current = [];

    if (pts.length === 0) return;

    // Markers for each point
    pts.forEach((p, i) => {
      const isFirst = i === 0;
      const marker = L.circleMarker(p, {
        radius: isFirst ? 6 : 5,
        color: '#ff8c00',
        fillColor: '#ff8c00',
        fillOpacity: 1,
        weight: 2,
        interactive: false,
      });
      lg.addLayer(marker);
    });

    if (currentMode === 'distance' && pts.length >= 2) {
      const line = L.polyline(pts, {
        color: '#ff8c00',
        weight: 3,
        dashArray: '10, 8',
        interactive: false,
      });
      lg.addLayer(line);
      polylineRef.current = line;

      // Segment labels
      for (let i = 1; i < pts.length; i++) {
        const segDist = pts[i - 1].distanceTo(pts[i]);
        const midLat = (pts[i - 1].lat + pts[i].lat) / 2;
        const midLng = (pts[i - 1].lng + pts[i].lng) / 2;
        const label = L.marker([midLat, midLng], {
          icon: L.divIcon({
            className: 'measure-label',
            html: `<div class="measure-label-inner">${formatDistance(segDist, unit)}</div>`,
            iconSize: [100, 24],
            iconAnchor: [50, 12],
          }),
          interactive: false,
        });
        lg.addLayer(label);
        labelsRef.current.push(label);
      }

      const totalDist = computeDistance(pts);
      setDistance(totalDist);
    }

    if (currentMode === 'area' && pts.length >= 2) {
      if (pts.length >= 3) {
        const poly = L.polygon(pts, {
          color: '#ff8c00',
          weight: 3,
          dashArray: '10, 8',
          fillColor: '#ff8c00',
          fillOpacity: 0.25,
          interactive: false,
        });
        lg.addLayer(poly);
        polygonRef.current = poly;

        const a = computeArea(pts);
        const p = computeDistance([...pts, pts[0]]);
        setArea(a);
        setPerimeter(p);

        // Area label at centroid
        const centLat = pts.reduce((s, pt) => s + pt.lat, 0) / pts.length;
        const centLng = pts.reduce((s, pt) => s + pt.lng, 0) / pts.length;
        const areaLabel = L.marker([centLat, centLng], {
          icon: L.divIcon({
            className: 'measure-label',
            html: `<div class="measure-label-inner">${formatArea(a, unit)}</div>`,
            iconSize: [120, 24],
            iconAnchor: [60, 12],
          }),
          interactive: false,
        });
        lg.addLayer(areaLabel);
      } else {
        const line = L.polyline(pts, {
          color: '#ff8c00',
          weight: 3,
          dashArray: '10, 8',
          interactive: false,
        });
        lg.addLayer(line);
      }
    }
  }, [map, unit]);

  // Map click handler
  useEffect(() => {
    if (!map || mode === 'none') return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      setPoints(prev => {
        const next = [...prev, e.latlng];
        redraw(next, mode);
        return next;
      });
    };

    map.on('click', handleClick);
    map.getContainer().style.cursor = 'crosshair';

    return () => {
      map.off('click', handleClick);
      map.getContainer().style.cursor = '';
    };
  }, [map, mode, redraw]);

  // Redraw when unit changes
  useEffect(() => {
    if (points.length > 0 && mode !== 'none') {
      redraw(points, mode);
    }
  }, [unit]);

  const startMode = (m: MeasureMode) => {
    clearMeasurement();
    setMode(m);
  };

  const isActive = mode !== 'none';
  const hasResult = (mode === 'distance' && points.length >= 2) || (mode === 'area' && points.length >= 3);

  return (
    <>
      {/* Toolbar buttons */}
      <div className="absolute top-2 right-2 z-[1000]">
        <div className="flex flex-col gap-1">
          <button
            className={`dda-map-btn ${mode === 'distance' ? 'dda-map-btn-active' : ''}`}
            title="Measure distance"
            onClick={() => mode === 'distance' ? stopMeasure() : startMode('distance')}
          >
            <Ruler className="w-4 h-4" />
          </button>
          <button
            className={`dda-map-btn ${mode === 'area' ? 'dda-map-btn-active' : ''}`}
            title="Measure area"
            onClick={() => mode === 'area' ? stopMeasure() : startMode('area')}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6l9-4 9 4v12l-9 4-9-4z" />
            </svg>
          </button>
          {isActive && (
            <button className="dda-map-btn" title="Clear measurement" onClick={stopMeasure}>
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results panel */}
      {isActive && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-4 min-w-[200px] text-gray-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {mode === 'distance' ? 'Distance' : 'Area'} Measurement
            </span>
            <button onClick={stopMeasure} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Unit selector */}
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-1">Unit</label>
            <select
              value={unit}
              onChange={e => setUnit(e.target.value as MeasureUnit)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {UNIT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {mode === 'distance' && (
            <div className="mb-3">
              <label className="text-xs text-gray-500 block mb-0.5">Distance</label>
              <span className="text-lg font-bold">{hasResult ? formatDistance(distance, unit) : '—'}</span>
            </div>
          )}

          {mode === 'area' && (
            <>
              <div className="mb-2">
                <label className="text-xs text-gray-500 block mb-0.5">Area</label>
                <span className="text-lg font-bold">{hasResult ? formatArea(area, unit) : '—'}</span>
              </div>
              <div className="mb-3">
                <label className="text-xs text-gray-500 block mb-0.5">Perimeter</label>
                <span className="text-sm font-semibold">{hasResult ? formatDistance(perimeter, unit) : '—'}</span>
              </div>
            </>
          )}

          {!hasResult && (
            <p className="text-[11px] text-gray-400">
              {mode === 'distance'
                ? 'Click on the map to place points'
                : 'Click to draw a polygon (min 3 points)'}
            </p>
          )}

          <button
            onClick={clearMeasurement}
            className="w-full mt-1 px-3 py-2 bg-[#2b5a9e] text-white text-sm font-medium rounded hover:bg-[#1e4a8e] transition-colors"
          >
            New measurement
          </button>
        </div>
      )}

      <style>{`
        .dda-map-btn-active {
          background: hsl(217 33% 17%) !important;
          color: hsl(187 94% 43%) !important;
          border-color: hsl(187 94% 43% / 0.5) !important;
          box-shadow: 0 0 8px hsl(187 94% 43% / 0.3);
        }
        .measure-label { background: transparent !important; border: none !important; }
        .measure-label-inner {
          background: hsl(222 47% 8% / 0.85);
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          text-align: center;
          border: 1px solid hsl(30 100% 50% / 0.5);
        }
      `}</style>
    </>
  );
}
