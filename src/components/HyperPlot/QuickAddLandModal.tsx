import { useState } from 'react';
import { X, Search, Loader2, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { markPlotListed } from '@/services/LandMatchingService';

interface SheetMatch {
  ownerName: string;
  mobile: string;
  rawData: Record<string, string>;
}

interface QuickAddLandModalProps {
  open: boolean;
  onClose: () => void;
  onLandAdded: (plotId: string, ownerName?: string, mobile?: string) => void;
}

export function QuickAddLandModal({ open, onClose, onLandAdded }: QuickAddLandModalProps) {
  const [plotNumber, setPlotNumber] = useState('');
  const [area, setArea] = useState('');
  const [location, setLocation] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [sheetMatch, setSheetMatch] = useState<SheetMatch | null>(null);
  const [editedOwner, setEditedOwner] = useState('');
  const [editedMobile, setEditedMobile] = useState('');
  const [step, setStep] = useState<'input' | 'confirm'>('input');

  if (!open) return null;

  const handleReset = () => {
    setPlotNumber('');
    setArea('');
    setLocation('');
    setSheetMatch(null);
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
    try {
      const sheetUrl = localStorage.getItem('hyperplot_sheet_url') || '';
      if (!sheetUrl) {
        // No sheet configured, skip to confirm
        setStep('confirm');
        setEditedOwner('');
        setEditedMobile('');
        setIsSearching(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-sheets-proxy?action=lookup`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            spreadsheetId: sheetUrl,
            plotNumbers: [plotNumber.trim()],
          }),
        }
      );

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const match = data.matches?.[plotNumber.trim()];
      if (match) {
        // Extract owner and mobile from sheet data
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
      } else {
        setSheetMatch(null);
        setEditedOwner('');
        setEditedMobile('');
      }
      setStep('confirm');
    } catch (err) {
      console.error('Sheet lookup error:', err);
      toast({ title: 'Sheet Lookup Failed', description: 'Could not search Google Sheet. Proceeding without match.' });
      setStep('confirm');
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

    onLandAdded(pid, editedOwner, editedMobile);
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
            <h2 className="text-lg font-bold text-foreground">Quick Add Land</h2>
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
              </div>
              <div>
                <Label className="text-sm font-medium">Area (optional)</Label>
                <Input
                  value={area}
                  onChange={e => setArea(e.target.value)}
                  placeholder="e.g. 4838 sqm"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Location (optional)</Label>
                <Input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Dubai Sports City"
                  className="mt-1"
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching} className="w-full gap-2">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {isSearching ? 'Searching Sheet...' : 'Search & Create'}
              </Button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="text-sm font-bold text-foreground mb-1">{plotNumber}</div>
                {area && <div className="text-xs text-muted-foreground">Area: {area}</div>}
                {location && <div className="text-xs text-muted-foreground">Location: {location}</div>}
              </div>

              {sheetMatch ? (
                <div className="p-3 rounded-lg bg-success/10 border border-success/30">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Check className="w-4 h-4 text-success" />
                    <span className="text-sm font-semibold text-success">Google Sheet Match Found</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Owner and contact info auto-filled. Edit below if needed.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <span className="text-xs text-warning">No match found in Google Sheet. Enter details manually.</span>
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
                <Button variant="outline" onClick={() => setStep('input')} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleConfirm} className="flex-1 gap-2">
                  <Check className="w-4 h-4" />
                  Confirm & Create Listing
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
