import { useState } from 'react';
import { Search, Loader2, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { markPlotListed } from '@/services/LandMatchingService';
import { gisService, PlotData } from '@/services/DDAGISService';

interface SheetMatch {
  ownerName: string;
  mobile: string;
  rawData: Record<string, string>;
}

interface QuickAddLandModalProps {
  open: boolean;
  onClose: () => void;
  onLandAdded: (plotId: string, ownerName?: string, mobile?: string, plot?: PlotData) => void;
}

export function QuickAddLandModal({ open, onClose, onLandAdded }: QuickAddLandModalProps) {
  const [plotNumber, setPlotNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [sheetMatch, setSheetMatch] = useState<SheetMatch | null>(null);
  const [gisPlot, setGisPlot] = useState<PlotData | null>(null);
  const [gisError, setGisError] = useState<string | null>(null);
  const [editedOwner, setEditedOwner] = useState('');
  const [editedMobile, setEditedMobile] = useState('');
  const [step, setStep] = useState<'input' | 'confirm'>('input');

  if (!open) return null;

  const handleReset = () => {
    setPlotNumber('');
    setSheetMatch(null);
    setGisPlot(null);
    setGisError(null);
    setEditedOwner('');
    setEditedMobile('');
    setStep('input');
    setIsSearching(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSearch = async () => {
    if (!plotNumber.trim()) {
      toast({ title: 'Required', description: 'Plot / Land Number is required.' });
      return;
    }

    setIsSearching(true);
    setGisError(null);

    try {
      // 1. Fetch plot data from GIS/DDA
      let fetchedPlot: PlotData | null = null;
      try {
        fetchedPlot = await gisService.fetchPlotById(plotNumber.trim());
        setGisPlot(fetchedPlot);
      } catch (err) {
        console.error('GIS fetch error:', err);
        setGisError('Could not fetch plot from DDA GIS.');
      }

      // 2. Cross-check Google Sheet (optional)
      // Try both storage keys: wizard uses hp_sheetId, settings uses hyperplot_sheet_url
      const sheetUrl = localStorage.getItem('hp_sheetId') || localStorage.getItem('hyperplot_sheet_url') || '';
      const sheetName = localStorage.getItem('hp_sheetName') || '';
      if (sheetUrl) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-proxy?action=lookup`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                spreadsheetId: sheetUrl,
                sheetName: sheetName || undefined,
                plotNumbers: [plotNumber.trim()],
              }),
            }
          );

          const data = await response.json();
          if (!data.error) {
            const match = data.matches?.[plotNumber.trim()];
            if (match) {
              const ownerKeys = ['owner', 'owner name', 'name', 'owner_reference', 'owner reference', 'owner ref'];
              const mobileKeys = ['mobile', 'phone', 'contact', 'phone number', 'contact number', 'mobile number'];

              let ownerName = '';
              let mobile = '';
              for (const key of ownerKeys) {
                if (match[key]) { ownerName = match[key]; break; }
              }
              for (const key of mobileKeys) {
                if (match[key]) { mobile = match[key]; break; }
              }

              setSheetMatch({ ownerName, mobile, rawData: match });
              setEditedOwner(ownerName);
              setEditedMobile(mobile);
            }
          }
        } catch (err) {
          console.error('Sheet lookup error:', err);
        }
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

    // Save override data
    try {
      const stored = localStorage.getItem('hyperplot_listing_overrides');
      const overrides = stored ? JSON.parse(stored) : {};
      overrides[pid] = {
        ...(overrides[pid] || {}),
        owner: editedOwner || undefined,
        contact: editedMobile || undefined,
      };
      localStorage.setItem('hyperplot_listing_overrides', JSON.stringify(overrides));
    } catch {}

    onLandAdded(pid, editedOwner, editedMobile, gisPlot || undefined);
    toast({ title: 'Listing Created', description: `${pid} has been added to your listings.` });
    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Create Listing</h2>
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
                  Will auto-fetch plot data from DDA GIS &amp; cross-check Google Sheet
                </p>
              </div>
              <Button onClick={handleSearch} disabled={isSearching} className="w-full gap-2">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {isSearching ? 'Fetching Data...' : 'Search & Create'}
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

              {/* Sheet Match */}
              {sheetMatch ? (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">Google Sheet Match</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Owner and contact auto-filled from sheet.</p>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <span className="text-xs text-muted-foreground">No Google Sheet match. Enter details manually.</span>
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
                <Button variant="outline" onClick={() => { setStep('input'); setGisPlot(null); setSheetMatch(null); setGisError(null); }} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleConfirm} className="flex-1 gap-2">
                  <Check className="w-4 h-4" />
                  Confirm & Create
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
