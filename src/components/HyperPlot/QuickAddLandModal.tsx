import { useState } from 'react';
import { Search, Loader2, Check, Plus, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { markPlotListed } from '@/services/LandMatchingService';
import { gisService, PlotData } from '@/services/DDAGISService';
import { syncListingToSheet } from '@/services/SheetSyncService';
import { saveManualLand, createDefaultManualLand } from '@/services/ManualLandService';

interface QuickAddLandModalProps {
  open: boolean;
  onClose: () => void;
  onLandAdded: (plotId: string, ownerName?: string, mobile?: string, plot?: PlotData) => void;
}

/** Try to extract lat/lng from a Google Maps URL client-side */
function extractCoordsFromUrl(input: string): { lat: number; lng: number } | null {
  const atMatch = input.match(/@([-\d.]+),([-\d.]+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  const dataMatch = input.match(/!3d([-\d.]+)!4d([-\d.]+)/);
  if (dataMatch) return { lat: parseFloat(dataMatch[1]), lng: parseFloat(dataMatch[2]) };
  const qMatch = input.match(/[?&](?:q|ll|center)=([-\d.]+)(?:%2C|,)([-\d.]+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  const placeMatch = input.match(/\/place\/([-\d.]+),([-\d.]+)/);
  if (placeMatch) return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };
  return null;
}

export function QuickAddLandModal({ open, onClose, onLandAdded }: QuickAddLandModalProps) {
  const [plotNumber, setPlotNumber] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [gisPlot, setGisPlot] = useState<PlotData | null>(null);
  const [gisError, setGisError] = useState<string | null>(null);
  const [editedOwner, setEditedOwner] = useState('');
  const [editedMobile, setEditedMobile] = useState('');
  const [step, setStep] = useState<'input' | 'confirm'>('input');

  if (!open) return null;

  const handleReset = () => {
    setPlotNumber('');
    setLocationUrl('');
    setResolvedCoords(null);
    setGisPlot(null);
    setGisError(null);
    setEditedOwner('');
    setEditedMobile('');
    setStep('input');
    setIsSearching(false);
    setIsResolvingLocation(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const resolveLocation = async (): Promise<{ lat: number; lng: number } | null> => {
    const url = locationUrl.trim();
    if (!url) return null;

    // Try client-side first
    const clientCoords = extractCoordsFromUrl(url);
    if (clientCoords) {
      setResolvedCoords(clientCoords);
      return clientCoords;
    }

    // Fallback to edge function for short links
    setIsResolvingLocation(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ url }),
      });
      const data = await resp.json();
      if (data.lat && data.lng) {
        const coords = { lat: data.lat, lng: data.lng };
        setResolvedCoords(coords);
        return coords;
      }
      toast({ title: 'Location Error', description: data.error || 'Could not resolve location. Use a full Google Maps URL with coordinates visible.' });
      return null;
    } catch {
      toast({ title: 'Error', description: 'Failed to resolve location URL.' });
      return null;
    } finally {
      setIsResolvingLocation(false);
    }
  };

  const handleSearch = async () => {
    if (!plotNumber.trim()) {
      toast({ title: 'Required', description: 'Plot / Land Number is required.' });
      return;
    }

    setIsSearching(true);
    setGisError(null);

    try {
      let fetchedPlot: PlotData | null = null;
      try {
        fetchedPlot = await gisService.fetchPlotById(plotNumber.trim());
        setGisPlot(fetchedPlot);
      } catch (err) {
        console.error('GIS fetch error:', err);
        setGisError('Could not fetch plot from DDA GIS.');
      }

      // If we have a location URL but no resolved coords yet, resolve now
      if (locationUrl.trim() && !resolvedCoords) {
        await resolveLocation();
      }

      setStep('confirm');
    } catch (err) {
      console.error('Search error:', err);
      toast({ title: 'Error', description: 'Search failed. Please try again.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    const pid = plotNumber.trim();
    markPlotListed(pid);

    try {
      const stored = localStorage.getItem('hyperplot_listing_overrides');
      const overrides = stored ? JSON.parse(stored) : {};
      overrides[pid] = {
        ...(overrides[pid] || {}),
        owner: editedOwner || undefined,
        contact: editedMobile || undefined,
        ...(resolvedCoords ? { lat: resolvedCoords.lat, lng: resolvedCoords.lng } : {}),
      };
      localStorage.setItem('hyperplot_listing_overrides', JSON.stringify(overrides));
    } catch { }

    const plotToPass: PlotData = gisPlot || {
      id: pid,
      area: 0,
      gfa: 0,
      floors: 'N/A',
      zoning: 'N/A',
      location: '',
      x: resolvedCoords?.lng || 0,
      y: resolvedCoords?.lat || 0,
      color: '#8b5cf6',
      status: 'Available',
      constructionCost: 800,
      salePrice: 1500,
      project: '',
      entity: '',
      isFrozen: false,
      verificationSource: 'Manual' as const,
      verificationDate: new Date().toISOString(),
    };

    const manualEntry = createDefaultManualLand();
    manualEntry.plotNumber = pid;
    manualEntry.isDraft = false;
    if (gisPlot) {
      manualEntry.plotAreaSqm = gisPlot.area;
      manualEntry.gfaSqm = gisPlot.gfa;
      manualEntry.floors = gisPlot.floors;
      manualEntry.zoning = gisPlot.zoning;
      manualEntry.areaName = gisPlot.project || gisPlot.location || '';
    }
    if (resolvedCoords) {
      manualEntry.latitude = resolvedCoords.lat;
      manualEntry.longitude = resolvedCoords.lng;
    }
    saveManualLand(manualEntry);

    onLandAdded(pid, editedOwner, editedMobile, plotToPass);
    toast({ title: 'Plot Added', description: `${pid} has been added to your listings.` });

    syncListingToSheet(pid, {
      owner: editedOwner,
      contact: editedMobile,
      area: gisPlot ? Math.round(gisPlot.area * 10.7639).toString() : undefined,
      location: gisPlot?.project || gisPlot?.location || undefined,
      gfa: gisPlot ? Math.round(gisPlot.gfa * 10.7639).toString() : undefined,
      zoning: gisPlot?.zoning || undefined,
      status: 'Available',
    }).then(ok => {
      if (ok) toast({ title: 'Sheet Synced', description: `${pid} synced to Google Sheet.` });
    }).catch(() => { });

    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Add Plot</h2>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'input' && (
            <>
              <div>
                <Label className="text-sm font-medium">Plot / Land Number *</Label>
                <Input
                  value={plotNumber}
                  onChange={e => setPlotNumber(e.target.value)}
                  placeholder="e.g. 3730206"
                  className="mt-1"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Will auto-fetch plot data from DDA GIS
                </p>
              </div>

              {/* Google Maps Location */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  Google Maps Location
                </Label>
                <Input
                  value={locationUrl}
                  onChange={e => {
                    setLocationUrl(e.target.value);
                    setResolvedCoords(null);
                    // Try instant client-side extraction
                    const coords = extractCoordsFromUrl(e.target.value);
                    if (coords) setResolvedCoords(coords);
                  }}
                  placeholder="Paste Google Maps URL..."
                  className="mt-1 text-sm"
                />
                {resolvedCoords && (
                  <p className="text-[10px] text-success mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Location resolved: {resolvedCoords.lat.toFixed(6)}, {resolvedCoords.lng.toFixed(6)}
                  </p>
                )}
                {!resolvedCoords && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Open Google Maps → right-click the plot → copy the URL from your browser bar
                  </p>
                )}
              </div>

              <Button onClick={handleSearch} disabled={isSearching || isResolvingLocation} className="w-full gap-2">
                {isSearching || isResolvingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {isSearching ? 'Fetching Data...' : isResolvingLocation ? 'Resolving Location...' : 'Search & Add'}
              </Button>
            </>
          )}

          {step === 'confirm' && (
            <>
              {/* GIS Data */}
              {gisPlot ? (
                <div className="p-3 rounded-lg bg-success/10 border border-success/30">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Check className="w-4 h-4 text-success" />
                    <span className="text-sm font-semibold text-success">DDA GIS Data Found</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <div>Area: <span className="text-foreground font-medium">{gisPlot.area.toLocaleString()} m²</span></div>
                    <div>GFA: <span className="text-foreground font-medium">{gisPlot.gfa.toLocaleString()} m²</span></div>
                    <div>Zoning: <span className="text-foreground font-medium">{gisPlot.zoning}</span></div>
                    <div>Floors: <span className="text-foreground font-medium">{gisPlot.floors}</span></div>
                    {gisPlot.project && <div className="col-span-2">Project: <span className="text-foreground font-medium">{gisPlot.project}</span></div>}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <span className="text-xs text-warning">{gisError || 'No GIS data found for this plot number.'}</span>
                </div>
              )}

              {/* Resolved Location */}
              {resolvedCoords && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-primary">Location Set</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {resolvedCoords.lat.toFixed(6)}, {resolvedCoords.lng.toFixed(6)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">Owner Name</Label>
                <Input
                  value={editedOwner}
                  onChange={e => setEditedOwner(e.target.value)}
                  placeholder="Owner name..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Mobile Number</Label>
                <Input
                  value={editedMobile}
                  onChange={e => setEditedMobile(e.target.value)}
                  placeholder="Mobile number..."
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep('input'); setGisPlot(null); setGisError(null); }} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleConfirm} className="flex-1 gap-2">
                  <Check className="w-4 h-4" />
                  Confirm & Add
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}