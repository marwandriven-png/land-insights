import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MapPin, Save, Plus, Trash2, ChevronDown, ChevronUp, Eye, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import L from 'leaflet';
import {
  ManualLandEntry,
  createDefaultManualLand,
  saveManualLand,
  loadManualLands,
  deleteManualLand,
  manualLandToPlotData,
} from '@/services/ManualLandService';
import { PlotData } from '@/services/DDAGISService';

interface ManualLandFormProps {
  open: boolean;
  onClose: () => void;
  onLandSaved: (plots: PlotData[]) => void;
  editEntry?: ManualLandEntry | null;
}

type Section = 'id' | 'location' | 'planning' | 'affection';

export function ManualLandForm({ open, onClose, onLandSaved, editEntry }: ManualLandFormProps) {
  const [entry, setEntry] = useState<ManualLandEntry>(createDefaultManualLand);
  const [expandedSections, setExpandedSections] = useState<Set<Section>>(new Set(['id', 'location', 'planning']));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const miniMapRef = useRef<HTMLDivElement>(null);
  const miniMapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const [drawingPolygon, setDrawingPolygon] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [locationSearch, setLocationSearch] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  useEffect(() => {
    if (open) {
      const initial = editEntry || createDefaultManualLand();
      setEntry(initial);
      setErrors({});
      setPolygonPoints(editEntry?.polygonCoords || []);
      setLocationSearch('');
    }
  }, [open, editEntry]);

  // Mini map
  useEffect(() => {
    if (!open || !miniMapRef.current) return;

    // Small delay to let the DOM render
    const timer = setTimeout(() => {
      if (miniMapInstanceRef.current) {
        miniMapInstanceRef.current.remove();
        miniMapInstanceRef.current = null;
      }

      if (!miniMapRef.current) return;

      const lat = entry.latitude || 25.2048;
      const lng = entry.longitude || 55.2708;

      const map = L.map(miniMapRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
      }).addTo(map);

      // Marker for point location
      const marker = L.marker([lat, lng], {
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        const newLat = parseFloat(pos.lat.toFixed(6));
        const newLng = parseFloat(pos.lng.toFixed(6));
        setEntry(prev => ({ ...prev, latitude: newLat, longitude: newLng }));
      });

      markerRef.current = marker;
      miniMapInstanceRef.current = map;

      // Render existing polygon
      if (entry.polygonCoords && entry.polygonCoords.length >= 3) {
        const poly = L.polygon(entry.polygonCoords as L.LatLngExpression[], {
          color: '#00e5ff',
          weight: 2,
          fillColor: '#00e5ff',
          fillOpacity: 0.2,
        }).addTo(map);
        polygonRef.current = poly;
        map.fitBounds(poly.getBounds(), { padding: [20, 20] });
      }

      // Click to add polygon points
      map.on('click', (e: L.LeafletMouseEvent) => {
        // Only handle in polygon drawing mode
        setDrawingPolygon(prev => {
          if (!prev) return false;
          const newPoint: [number, number] = [parseFloat(e.latlng.lat.toFixed(6)), parseFloat(e.latlng.lng.toFixed(6))];
          setPolygonPoints(pts => {
            const updated = [...pts, newPoint];
            // Update polygon on map
            if (polygonRef.current) {
              map.removeLayer(polygonRef.current);
            }
            if (updated.length >= 2) {
              const poly = L.polygon(updated as L.LatLngExpression[], {
                color: '#00e5ff',
                weight: 2,
                fillColor: '#00e5ff',
                fillOpacity: 0.2,
              }).addTo(map);
              polygonRef.current = poly;
            }
            return updated;
          });
          return true;
        });
      });

      // Invalidate size after render
      setTimeout(() => map.invalidateSize(), 100);
    }, 300);

    return () => {
      clearTimeout(timer);
      if (miniMapInstanceRef.current) {
        miniMapInstanceRef.current.remove();
        miniMapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Update marker when lat/lng changes
  useEffect(() => {
    if (markerRef.current && entry.latitude && entry.longitude) {
      markerRef.current.setLatLng([entry.latitude, entry.longitude]);
      miniMapInstanceRef.current?.setView([entry.latitude, entry.longitude], miniMapInstanceRef.current.getZoom());
    }
  }, [entry.latitude, entry.longitude]);

  const toggleSection = (s: Section) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const updateField = useCallback(<K extends keyof ManualLandEntry>(key: K, value: ManualLandEntry[K]) => {
    setEntry(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }, []);

  const updateSetback = useCallback((type: 'buildingSetbacks' | 'podiumSetbacks', side: string, value: string) => {
    setEntry(prev => ({
      ...prev,
      [type]: { ...prev[type], [side]: value },
    }));
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!entry.latitude || !entry.longitude) errs.latitude = 'Coordinates are required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = (asDraft: boolean) => {
    if (!asDraft && !validate()) {
      toast.error('Please fix validation errors');
      return;
    }
    const toSave = {
      ...entry,
      isDraft: asDraft,
      plotNumber: entry.plotNumber || entry.id,
      polygonCoords: polygonPoints.length >= 3 ? polygonPoints : undefined,
    };
    saveManualLand(toSave);
    const allManual = loadManualLands().filter(l => !l.isDraft || l.id === toSave.id);
    const plotDataList = allManual.map(manualLandToPlotData);
    onLandSaved(plotDataList);
    toast.success(asDraft ? 'Saved as draft' : 'Land published successfully');
    onClose();
  };

  const handleStartDrawing = () => {
    setDrawingPolygon(true);
    setPolygonPoints([]);
    if (polygonRef.current && miniMapInstanceRef.current) {
      miniMapInstanceRef.current.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }
    toast.info('Click on the map to draw polygon corners. Click "Finish Drawing" when done.');
  };

  const handleFinishDrawing = () => {
    setDrawingPolygon(false);
    if (polygonPoints.length < 3) {
      toast.error('Need at least 3 points for a polygon');
      return;
    }
    const avgLat = polygonPoints.reduce((s, p) => s + p[0], 0) / polygonPoints.length;
    const avgLng = polygonPoints.reduce((s, p) => s + p[1], 0) / polygonPoints.length;
    setEntry(prev => ({ ...prev, latitude: parseFloat(avgLat.toFixed(6)), longitude: parseFloat(avgLng.toFixed(6)) }));
    toast.success(`Polygon drawn with ${polygonPoints.length} points`);
  };

  const handleGeocode = async () => {
    const query = locationSearch.trim() || entry.areaName.trim();
    if (!query) {
      toast.error('Enter a location or area name first');
      return;
    }
    setIsGeocoding(true);
    try {
      const searchQuery = query.toLowerCase().includes('uae') || query.toLowerCase().includes('dubai') || query.toLowerCase().includes('abu dhabi') || query.toLowerCase().includes('sharjah') ? query : `${query}, UAE`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&countrycodes=ae`);
      const data = await res.json();
      if (data.length > 0) {
        const lat = parseFloat(parseFloat(data[0].lat).toFixed(6));
        const lng = parseFloat(parseFloat(data[0].lon).toFixed(6));
        setEntry(prev => ({ ...prev, latitude: lat, longitude: lng }));
        miniMapInstanceRef.current?.setView([lat, lng], 16);
        markerRef.current?.setLatLng([lat, lng]);
        toast.success(`Found: ${data[0].display_name.split(',').slice(0, 3).join(',')}`);
      } else {
        toast.error('Location not found. Try a different name or enter coordinates manually.');
      }
    } catch {
      toast.error('Geocoding failed. Check your connection.');
    } finally {
      setIsGeocoding(false);
    }
  };

  if (!open) return null;

  const SectionHeader = ({ id, label, icon }: { id: Section; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {label}
      </div>
      {expandedSections.has(id) ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
    </button>
  );

  const FieldError = ({ field }: { field: string }) => (
    errors[field] ? <p className="text-xs text-destructive mt-0.5">{errors[field]}</p> : null
  );

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">{editEntry ? 'Edit Plot' : 'Add Plot'}</h2>
            <Badge className="bg-warning/20 text-warning border-warning/30 text-xs">Manual Entry</Badge>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-5 space-y-3">
            {/* Section A: Identification */}
            <SectionHeader id="id" label="Identification" icon={<MapPin className="w-4 h-4 text-primary" />} />
            {expandedSections.has('id') && (
              <div className="grid grid-cols-2 gap-3 px-1">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Land / Plot Number</label>
                  <Input value={entry.plotNumber} onChange={e => updateField('plotNumber', e.target.value)} placeholder="Auto-generated if blank" className="h-9 text-sm mt-0.5" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Leave blank to auto-generate</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Area / Community Name *</label>
                  <Input value={entry.areaName} onChange={e => updateField('areaName', e.target.value)} placeholder="e.g. Dubai Sports City" className="h-9 text-sm mt-0.5" />
                  <FieldError field="areaName" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground font-medium">Status</label>
                  <div className="flex gap-2 mt-1">
                    {(['Available', 'Off-Market', 'Listed'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => updateField('status', s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          entry.status === s
                            ? s === 'Available' ? 'bg-success/20 text-success border-success/30'
                              : s === 'Listed' ? 'bg-primary/20 text-primary border-primary/30'
                              : 'bg-warning/20 text-warning border-warning/30'
                            : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Section B: Location & Coordinates */}
            <SectionHeader id="location" label="Location & Coordinates" icon={<MapPin className="w-4 h-4 text-secondary" />} />
            {expandedSections.has('location') && (
              <div className="space-y-3 px-1">
                {/* Location Search */}
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Search Location</label>
                  <div className="flex gap-2 mt-0.5">
                    <Input
                      value={locationSearch}
                      onChange={e => setLocationSearch(e.target.value)}
                      placeholder="e.g. Jumeirah Garden City, Business Bay..."
                      className="h-9 text-sm flex-1"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleGeocode())}
                    />
                    <Button variant="outline" size="sm" onClick={handleGeocode} disabled={isGeocoding} className="gap-1.5 h-9 shrink-0">
                      {isGeocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      {isGeocoding ? 'Searching...' : 'Find'}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Type a location name and click Find to auto-fill coordinates</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-medium">Latitude *</label>
                    <Input type="number" step="0.000001" value={entry.latitude} onChange={e => updateField('latitude', parseFloat(e.target.value) || 0)} className="h-9 text-sm mt-0.5" />
                    <FieldError field="latitude" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium">Longitude *</label>
                    <Input type="number" step="0.000001" value={entry.longitude} onChange={e => updateField('longitude', parseFloat(e.target.value) || 0)} className="h-9 text-sm mt-0.5" />
                  </div>
                </div>

                {/* Mini Map */}
                <div className="rounded-xl overflow-hidden border border-border/50" style={{ height: 220 }}>
                  <div ref={miniMapRef} className="w-full h-full" />
                </div>
                <div className="flex items-center gap-2">
                  {!drawingPolygon ? (
                    <Button variant="outline" size="sm" onClick={handleStartDrawing} className="gap-1.5 text-xs">
                      <Plus className="w-3.5 h-3.5" />
                      Draw Polygon
                    </Button>
                  ) : (
                    <Button size="sm" onClick={handleFinishDrawing} className="gap-1.5 text-xs">
                      Finish Drawing ({polygonPoints.length} pts)
                    </Button>
                  )}
                  {polygonPoints.length > 0 && !drawingPolygon && (
                    <Badge variant="secondary" className="text-xs">{polygonPoints.length} polygon points</Badge>
                  )}
                  <p className="text-[10px] text-muted-foreground ml-auto">Drag marker or draw polygon boundary</p>
                </div>
              </div>
            )}

            {/* Section C: Planning Data */}
            <SectionHeader id="planning" label="Plot & Planning Data" icon={<Eye className="w-4 h-4 text-primary" />} />
            {expandedSections.has('planning') && (
              <div className="grid grid-cols-2 gap-3 px-1">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Plot Size (sqm) *</label>
                  <Input type="number" value={entry.plotAreaSqm || ''} onChange={e => updateField('plotAreaSqm', parseFloat(e.target.value) || 0)} className="h-9 text-sm mt-0.5" />
                  <FieldError field="plotAreaSqm" />
                  {entry.plotAreaSqm > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{Math.round(entry.plotAreaSqm * 10.764).toLocaleString()} sqft</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">GFA (sqm) *</label>
                  <Input type="number" value={entry.gfaSqm || ''} onChange={e => updateField('gfaSqm', parseFloat(e.target.value) || 0)} className="h-9 text-sm mt-0.5" />
                  <FieldError field="gfaSqm" />
                  {entry.gfaSqm > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{Math.round(entry.gfaSqm * 10.764).toLocaleString()} sqft</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Floors / Height</label>
                  <Input value={entry.floors} onChange={e => updateField('floors', e.target.value)} placeholder="e.g. G+5P+24" className="h-9 text-sm mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Zoning</label>
                  <Input value={entry.zoning} onChange={e => updateField('zoning', e.target.value)} placeholder="e.g. Residential Apartments" className="h-9 text-sm mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Main Land Use</label>
                  <Input value={entry.landUseMain} onChange={e => updateField('landUseMain', e.target.value)} placeholder="e.g. Residential" className="h-9 text-sm mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Sub Land Use</label>
                  <Input value={entry.landUseSub} onChange={e => updateField('landUseSub', e.target.value)} placeholder="e.g. Apartments" className="h-9 text-sm mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Land Use Category</label>
                  <Input value={entry.landUseCategory} onChange={e => updateField('landUseCategory', e.target.value)} className="h-9 text-sm mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Plot Coverage (%)</label>
                  <Input type="number" value={entry.plotCoverage || ''} onChange={e => updateField('plotCoverage', parseFloat(e.target.value) || undefined)} className="h-9 text-sm mt-0.5" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground font-medium">Height Category</label>
                  <Input value={entry.heightCategory || ''} onChange={e => updateField('heightCategory', e.target.value)} placeholder="Optional" className="h-9 text-sm mt-0.5" />
                </div>
              </div>
            )}

            {/* Section D: Affection Plan */}
            <SectionHeader id="affection" label="Affection Plan Parameters" icon={<Eye className="w-4 h-4 text-warning" />} />
            {expandedSections.has('affection') && (
              <div className="space-y-3 px-1">
                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Building Setbacks</label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {(['side1', 'side2', 'side3', 'side4'] as const).map(side => (
                      <div key={side}>
                        <label className="text-[10px] text-muted-foreground">{side.replace('side', 'Side ')}</label>
                        <Input value={entry.buildingSetbacks[side]} onChange={e => updateSetback('buildingSetbacks', side, e.target.value)} className="h-8 text-xs mt-0.5" placeholder="e.g. 6m" />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Podium Setbacks</label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {(['side1', 'side2', 'side3', 'side4'] as const).map(side => (
                      <div key={side}>
                        <label className="text-[10px] text-muted-foreground">{side.replace('side', 'Side ')}</label>
                        <Input value={entry.podiumSetbacks[side]} onChange={e => updateSetback('podiumSetbacks', side, e.target.value)} className="h-8 text-xs mt-0.5" placeholder="e.g. 3m" />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Parking Rules</label>
                  <Textarea value={entry.parkingRules} onChange={e => updateField('parkingRules', e.target.value)} placeholder="Parking requirements..." className="min-h-[60px] text-xs mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Notes</label>
                  <Textarea value={entry.notes} onChange={e => updateField('notes', e.target.value)} placeholder="Additional notes..." className="min-h-[60px] text-xs mt-0.5" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-border/50 shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">Cancel</Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleSave(true)} className="gap-1.5">
              <Save className="w-3.5 h-3.5" />
              Save Draft
            </Button>
            <Button size="sm" onClick={() => handleSave(false)} className="gap-1.5">
              <Save className="w-3.5 h-3.5" />
              Publish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
