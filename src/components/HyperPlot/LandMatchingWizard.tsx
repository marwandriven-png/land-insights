import { useState, useCallback, useRef } from 'react';
import {
  X, Upload, Search, FileText, CheckCircle, AlertTriangle,
  Target, Loader2, MapPin, Building2, Sparkles, ArrowRight,
  Link2, LayoutGrid, ClipboardList
} from 'lucide-react';
import { ReviewDataModal } from './ReviewDataModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlotData } from '@/services/DDAGISService';
import {
  parseTextFile,
  parseFreeFormText,
  matchParcels,
  buildParcelFromForm,
  ParcelInput,
  MatchResult,
  isPlotListed,
  getExportedPlotIds
} from '@/services/LandMatchingService';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

// Calculate confidence from deviation percentages
function calcConfidence(areaDev: number, gfaDev: number, hasArea: boolean, hasGfa: boolean): number {
  // Exact match on all provided dimensions = 100%
  if (hasArea && hasGfa && areaDev === 0 && gfaDev === 0) return 100;
  if (hasArea && !hasGfa && areaDev === 0) return 100;
  if (!hasArea && hasGfa && gfaDev === 0) return 100;

  let score = 0;
  if (hasArea) {
    // ≤6% = high confidence, 6-10% = medium
    const pts = areaDev <= 6 ? Math.max(35, 50 - areaDev * 2.5) : Math.max(20, 50 - areaDev * 3);
    score += pts * (hasGfa ? 1 : 2);
  }
  if (hasGfa) {
    const pts = gfaDev <= 6 ? Math.max(35, 50 - gfaDev * 2.5) : Math.max(20, 50 - gfaDev * 3);
    score += pts * (hasArea ? 1 : 2);
  }
  return Math.min(99, Math.max(10, Math.round(score)));
}

// Build match results from API plots, filtering by ±6% tolerance
function buildApiResults(apiPlots: PlotData[], input: ParcelInput): MatchResult[] {
  const TOLERANCE = 6; // ±6%
  const hasArea = input.plotAreaSqm > 0;
  const hasGfa = input.gfaSqm > 0;

  return apiPlots
    .map(ap => {
      const areaDev = hasArea ? parseFloat((Math.abs(ap.area - input.plotAreaSqm) / input.plotAreaSqm * 100).toFixed(2)) : 0;
      const gfaDev = hasGfa ? parseFloat((Math.abs(ap.gfa - input.gfaSqm) / input.gfaSqm * 100).toFixed(2)) : 0;
      return {
        input,
        matchedPlotId: ap.id,
        matchedPlotArea: ap.area,
        matchedGfa: ap.gfa,
        matchedZoning: ap.zoning,
        matchedStatus: ap.status,
        matchedLocation: ap.location,
        areaDeviation: areaDev,
        gfaDeviation: gfaDev,
        confidenceScore: calcConfidence(areaDev, gfaDev, hasArea, hasGfa),
      };
    })
    .filter(r => {
      // Strict ±6% filter: every provided dimension must be within tolerance
      if (hasArea && r.areaDeviation > TOLERANCE) return false;
      if (hasGfa && r.gfaDeviation > TOLERANCE) return false;
      return true;
    })
    .sort((a, b) => b.confidenceScore - a.confidenceScore);
}

interface LandMatchingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  plots: PlotData[];
  onHighlightPlots: (plotIds: string[]) => void;
  onSelectPlot: (plot: PlotData) => void;
}

type WizardStep = 'upload' | 'parsing' | 'matching' | 'results';
type InputMode = 'form' | 'text' | 'location';

export function LandMatchingWizard({
  isOpen,
  onClose,
  plots,
  onHighlightPlots,
  onSelectPlot
}: LandMatchingWizardProps) {
  const [step, setStep] = useState<WizardStep>('upload');
  const [inputMode, setInputMode] = useState<InputMode>('form');
  const [textContent, setTextContent] = useState('');
  const [parsedInputs, setParsedInputs] = useState<ParcelInput[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState(() => localStorage.getItem('hp_sheetId') || '');
  const [sheetName, setSheetName] = useState(() => localStorage.getItem('hp_sheetName') || '');
  const [sheetConnected, setSheetConnected] = useState(() => localStorage.getItem('hp_sheetConnected') === 'true');
  const [isConnectingSheet, setIsConnectingSheet] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick search form fields
  const [formArea, setFormArea] = useState('');
  const [formPlotArea, setFormPlotArea] = useState('');
  const [formPlotUnit, setFormPlotUnit] = useState<'sqm' | 'sqft'>('sqm');
  const [formGfa, setFormGfa] = useState('');
  const [formGfaUnit, setFormGfaUnit] = useState<'sqm' | 'sqft'>('sqm');
  const [formZoning, setFormZoning] = useState('');
  const [formFloors, setFormFloors] = useState('');

  // Location search state
  const [locationUrl, setLocationUrl] = useState('');
  const [locationRadius, setLocationRadius] = useState<number>(1000);

  const canQuickSearch = (
    (formPlotArea.trim().length > 0 && parseFloat(formPlotArea) > 0) ||
    (formGfa.trim().length > 0 && parseFloat(formGfa) > 0)
  );

  // Shared: cross-reference matched results with Google Sheet
  // Enriches results with owner data from sheet; keeps all GIS results
  const crossCheckWithSheet = useCallback(async (results: MatchResult[]): Promise<MatchResult[]> => {
    console.log(`[SheetCrossCheck] sheetConnected=${sheetConnected}, sheetId=${sheetId}, results=${results.length}`);
    if (!sheetConnected || !sheetId || results.length === 0) return results;
    try {
      const plotNumbers = results.map(r => r.matchedPlotId);
      console.log(`[SheetCrossCheck] Looking up plot numbers:`, plotNumbers);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-proxy?action=lookup`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            spreadsheetId: sheetId,
            sheetName: sheetName || undefined,
            plotNumbers
          })
        }
      );
      console.log(`[SheetCrossCheck] Response status: ${response.status}`);
      if (response.ok) {
        const sheetData = await response.json();
        console.log(`[SheetCrossCheck] Sheet response:`, JSON.stringify(sheetData).slice(0, 500));
        if (sheetData.matches) {
          for (const result of results) {
            const sheetMatch = sheetData.matches[result.matchedPlotId];
            if (sheetMatch) {
              result.ownerReference = sheetMatch.owner_reference || sheetMatch['owner ref'] || sheetMatch['owner'] || sheetMatch['owner name'] || sheetMatch['name'] || undefined;
              result.sheetMetadata = sheetMatch;
            }
          }
          const matched = results.filter(r => r.sheetMetadata).length;
          console.log(`[SheetCrossCheck] ${results.length} GIS matches, ${matched} found in sheet`);
        }
      } else {
        const errText = await response.text();
        console.error(`[SheetCrossCheck] Error response: ${errText}`);
      }
    } catch (sheetErr) {
      console.warn('[SheetCrossCheck] Failed:', sheetErr);
    }
    return results;
  }, [sheetConnected, sheetId, sheetName]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setTextContent(content);
      setError(null);
    };
    reader.readAsText(file);
  }, []);

  const handleQuickSearch = useCallback(async () => {
    if (!canQuickSearch) return;
    setIsProcessing(true);
    setError(null);
    setStep('matching');

    try {
      const parcel = buildParcelFromForm({
        areaName: formArea.trim(),
        plotArea: formPlotArea ? parseFloat(formPlotArea) : undefined,
        plotAreaUnit: formPlotUnit,
        gfa: formGfa ? parseFloat(formGfa) : undefined,
        gfaUnit: formGfaUnit,
        zoning: formZoning || undefined,
        floors: formFloors ? parseInt(formFloors, 10) : undefined,
      });

      setParsedInputs([parcel]);

      // Auto-run matching immediately
      const hasAreaName = parcel.area.trim().length > 0;
      let results = matchParcels([parcel], plots);

      // If no local matches, try live GIS API
      if (results.length === 0) {
        const { gisService } = await import('@/services/DDAGISService');
        const tolerance = hasAreaName ? 0.06 : 0.10; // Strict ±6% when area specified
        const minArea = parcel.plotAreaSqm > 0 ? parcel.plotAreaSqm * (1 - tolerance) : undefined;
        const maxArea = parcel.plotAreaSqm > 0 ? parcel.plotAreaSqm * (1 + tolerance) : undefined;
        try {
          if (hasAreaName) {
            // Area name specified: ONLY search with project name, no fallback
            const apiPlots = await gisService.searchByArea(minArea, maxArea, parcel.area);
            if (apiPlots.length > 0) {
              results = buildApiResults(apiPlots, parcel);
            }
          } else {
            // No area name: show all matches by area range
            const apiPlots = await gisService.searchByArea(minArea, maxArea);
            if (apiPlots.length > 0) {
              results = buildApiResults(apiPlots, parcel);
            }
          }
        } catch { /* continue */ }
      }

      // Cross-check with Google Sheet if connected
      results = await crossCheckWithSheet(results);

      setMatchResults(results);
      setSelectedMatchIds(new Set(results.map(r => r.matchedPlotId)));
      setStep('results');
      onHighlightPlots(results.map(r => r.matchedPlotId));
    } catch {
      setError('Invalid input values');
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  }, [canQuickSearch, formArea, formPlotArea, formPlotUnit, formGfa, formGfaUnit, formZoning, formFloors, plots, onHighlightPlots]);

  const handleParse = useCallback(async () => {
    if (!textContent.trim()) {
      setError('Please upload or paste a text file first');
      return;
    }

    setIsProcessing(true);
    setStep('parsing');
    setError(null);

    try {
      // Try structured parsing first
      let inputs = parseTextFile(textContent);

      // If structured parsing fails, try smart free-form parsing
      if (inputs.length === 0 || inputs.every(i => i.plotAreaSqm === 0 && i.gfaSqm === 0)) {
        inputs = parseFreeFormText(textContent);
      }

      if (inputs.length === 0) {
        setError('No valid parcels found in the input');
        setStep('upload');
        setIsProcessing(false);
        return;
      }

      // Flag parcels missing both area and GFA
      const incomplete = inputs.filter(i => i.plotAreaSqm === 0 && i.gfaSqm === 0);
      if (incomplete.length > 0) {
        setError(`${incomplete.length} parcel(s) missing both Area and GFA — will be excluded`);
      }

      setParsedInputs(inputs);

      // Auto-run matching immediately instead of showing intermediate step
      setStep('matching');

      try {
        let results = matchParcels(inputs, plots);

        // If no local matches, try live GIS API
        if (results.length === 0) {
          const { gisService } = await import('@/services/DDAGISService');
          for (const input of inputs) {
            if (!input.area) continue;
            const isPlotNumber = /^\d+$/.test(input.area.trim());
            if (isPlotNumber) {
              try {
                const plot = await gisService.fetchPlotById(input.area.trim());
                if (plot) {
                  results = [{
                    input,
                    matchedPlotId: plot.id,
                    matchedPlotArea: plot.area,
                    matchedGfa: plot.gfa,
                    matchedZoning: plot.zoning,
                    matchedStatus: plot.status,
                    matchedLocation: plot.location,
                    areaDeviation: input.plotAreaSqm > 0 ? parseFloat((Math.abs(plot.area - input.plotAreaSqm) / input.plotAreaSqm * 100).toFixed(2)) : 0,
                    gfaDeviation: input.gfaSqm > 0 ? parseFloat((Math.abs(plot.gfa - input.gfaSqm) / input.gfaSqm * 100).toFixed(2)) : 0,
                    confidenceScore: 100,
                  }];
                  break;
                }
              } catch { /* continue */ }
            }
            const hasAreaName = input.area.trim().length > 0;
            const tolerance = hasAreaName ? 0.06 : 0.10;
            const minArea = input.plotAreaSqm > 0 ? input.plotAreaSqm * (1 - tolerance) : undefined;
            const maxArea = input.plotAreaSqm > 0 ? input.plotAreaSqm * (1 + tolerance) : undefined;
            try {
              const hasAreaName = input.area.trim().length > 0;
              if (hasAreaName) {
                // Area name specified: strict search only
                const apiPlots = await gisService.searchByArea(minArea, maxArea, input.area);
                if (apiPlots.length > 0) {
                  results = buildApiResults(apiPlots, input);
                  break;
                }
              } else {
                // No area name: show all matches
                const apiPlots = await gisService.searchByArea(minArea, maxArea);
                if (apiPlots.length > 0) {
                  results = buildApiResults(apiPlots, input);
                  break;
                }
              }
            } catch { /* continue */ }
          }
        }

        // Cross-check with Google Sheet if connected
        results = await crossCheckWithSheet(results);

        setMatchResults(results);
        setSelectedMatchIds(new Set(results.map(r => r.matchedPlotId)));
        setStep('results');
        onHighlightPlots(results.map(r => r.matchedPlotId));
      } catch (err) {
        console.warn('Matching error:', err);
        setMatchResults([]);
        setStep('results');
      }
    } catch (err) {
      console.warn('Parse error:', err);
      setError('Failed to parse input');
      setMatchResults([]);
      setStep('results');
    } finally {
      setIsProcessing(false);
    }
  }, [textContent, plots, onHighlightPlots]);

  const handleMatch = useCallback(async () => {
    setIsProcessing(true);
    setStep('matching');

    try {
      // First try matching against loaded plots
      let results = matchParcels(parsedInputs, plots);

      // If no local matches, try live GIS API search by area name
      if (results.length === 0 && parsedInputs.length > 0) {
        const { gisService } = await import('@/services/DDAGISService');
        for (const input of parsedInputs) {
          if (!input.area) continue;

          // Check if area looks like a plot number (all digits)
          const isPlotNumber = /^\d+$/.test(input.area.trim());

          if (isPlotNumber) {
            // Direct plot ID lookup
            try {
              const plot = await gisService.fetchPlotById(input.area.trim());
              if (plot) {
                const allPlots = [...plots, plot].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
                results = matchParcels(parsedInputs, allPlots);
                if (results.length === 0) {
                  // If tolerance doesn't match, still show the plot as a direct result
                  results = [{
                    input,
                    matchedPlotId: plot.id,
                    matchedPlotArea: plot.area,
                    matchedGfa: plot.gfa,
                    matchedZoning: plot.zoning,
                    matchedStatus: plot.status,
                    matchedLocation: plot.location,
                    areaDeviation: input.plotAreaSqm > 0 ? parseFloat((Math.abs(plot.area - input.plotAreaSqm) / input.plotAreaSqm * 100).toFixed(2)) : 0,
                    gfaDeviation: input.gfaSqm > 0 ? parseFloat((Math.abs(plot.gfa - input.gfaSqm) / input.gfaSqm * 100).toFixed(2)) : 0,
                    confidenceScore: 100,
                  }];
                }
                break;
              }
            } catch { /* continue */ }
          }

          const hasAreaName = input.area.trim().length > 0;
          const tolerance = hasAreaName ? 0.06 : 0.10;
          const minArea = input.plotAreaSqm > 0 ? input.plotAreaSqm * (1 - tolerance) : undefined;
          const maxArea = input.plotAreaSqm > 0 ? input.plotAreaSqm * (1 + tolerance) : undefined;
          try {
            const hasAreaName = input.area.trim().length > 0;
            if (hasAreaName) {
              const apiPlots = await gisService.searchByArea(minArea, maxArea, input.area);
              if (apiPlots.length > 0) {
                results = buildApiResults(apiPlots, input);
                break;
              }
            } else {
              const apiPlots = await gisService.searchByArea(minArea, maxArea);
              if (apiPlots.length > 0) {
                results = buildApiResults(apiPlots, input);
                break;
              }
            }
          } catch { /* continue */ }
        }
      }

      // Cross-check with Google Sheet if connected
      results = await crossCheckWithSheet(results);

      setMatchResults(results);
      setStep('results');
      const matchedIds = results.map(r => r.matchedPlotId);
      onHighlightPlots(matchedIds);
    } catch {
      setError('Matching failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [parsedInputs, plots, crossCheckWithSheet, onHighlightPlots]);

  const handleConnectSheet = useCallback(async () => {
    if (!sheetId.trim()) return;
    setIsConnectingSheet(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-proxy?action=test`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ spreadsheetId: sheetId })
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.connected) {
          setSheetConnected(true);
          localStorage.setItem('hp_sheetConnected', 'true');
          localStorage.setItem('hp_sheetId', sheetId);
          localStorage.setItem('hp_sheetName', sheetName);
          setError(null);
        } else {
          setError('Could not connect to the spreadsheet');
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        const msg = errData?.error || 'Failed to verify spreadsheet access';
        if (msg.includes('API key not valid')) {
          setError('Google Sheets API key is invalid. Please update the API key in backend secrets.');
        } else if (msg.includes('404')) {
          setError('Spreadsheet not found. Ensure it is shared as "Anyone with the link can view".');
        } else {
          setError(`Spreadsheet error: ${msg}`);
        }
      }
    } catch {
      setError('Connection test failed');
    } finally {
      setIsConnectingSheet(false);
    }
  }, [sheetId]);

  const handlePlotClick = useCallback(async (plotId: string) => {
    let plot = plots.find(p => p.id === plotId);
    if (plot) {
      onSelectPlot(plot);
      return;
    }
    // If not in local plots, fetch from API
    try {
      const { gisService } = await import('@/services/DDAGISService');
      const fetched = await gisService.fetchPlotById(plotId);
      if (fetched) onSelectPlot(fetched);
    } catch { /* silent */ }
  }, [plots, onSelectPlot]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setTextContent('');
    setParsedInputs([]);
    setMatchResults([]);
    setError(null);
    onHighlightPlots([]);
  }, [onHighlightPlots]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] z-[60] flex">
      <div className="fixed inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative ml-auto w-full h-full glass-card border-l border-border/50 animate-in slide-in-from-right duration-300 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))'
            }}>
              <Target className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-bold text-sm">Land Matching Wizard</h2>
              <p className="text-xs text-muted-foreground">Area + Land Size or GFA</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-4 py-3 border-b border-border/30 flex gap-2">
          {(['upload', 'parsing', 'matching', 'results'] as WizardStep[]).map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${i <= ['upload', 'parsing', 'matching', 'results'].indexOf(step)
                ? 'bg-primary'
                : 'bg-muted/50'
                }`}
            />
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-3 px-3 py-2 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-2 text-xs text-warning">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Input mode toggle */}
              <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
                <button
                  onClick={() => setInputMode('form')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${inputMode === 'form' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Quick Search
                </button>
                <button
                  onClick={() => setInputMode('text')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${inputMode === 'text' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Text / File
                </button>
                <button
                  onClick={() => setInputMode('location')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${inputMode === 'location' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Location
                </button>
              </div>

              {inputMode === 'location' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Google Maps Location Link <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={locationUrl}
                      onChange={(e) => setLocationUrl(e.target.value)}
                      placeholder="Paste full Google Maps URL here"
                      className="text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && locationUrl.trim()) {
                          e.preventDefault();
                          document.getElementById('location-search-btn')?.click();
                        }
                      }}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      💡 Open location in Google Maps → copy the <strong>full URL</strong> from the address bar (must contain coordinates like <code>@25.xxx,55.xxx</code>)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Search Radius
                      </Label>
                      <span className="text-xs font-mono text-primary">{locationRadius}m</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5000"
                      step="1"
                      value={locationRadius}
                      onChange={(e) => setLocationRadius(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-muted/50 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>100m</span>
                      <span>5km</span>
                    </div>
                  </div>

                  <Button
                    id="location-search-btn"
                    className="w-full gap-2"
                    onClick={async () => {
                      const input = locationUrl.trim();
                      if (!input) return;

                      if (!input.startsWith('http')) {
                        setError('Please paste a Google Maps URL (starting with https://)');
                        return;
                      }

                      setIsProcessing(true);
                      setError(null);
                      setStep('matching');

                      try {
                        let lat: number | null = null;
                        let lng: number | null = null;

                        // Client-side coord extraction from full Google Maps URLs
                        // /@lat,lng pattern
                        const atMatch = input.match(/@([-\d.]+),([-\d.]+)/);
                        if (atMatch) {
                          lat = parseFloat(atMatch[1]);
                          lng = parseFloat(atMatch[2]);
                        }

                        // !3dlat!4dlng pattern
                        if (!lat) {
                          const dataMatch = input.match(/!3d([-\d.]+)!4d([-\d.]+)/);
                          if (dataMatch) {
                            lat = parseFloat(dataMatch[1]);
                            lng = parseFloat(dataMatch[2]);
                          }
                        }

                        // ?q=lat,lng or ?ll=lat,lng
                        if (!lat) {
                          const qMatch = input.match(/[?&](?:q|ll|center)=([-\d.]+)(?:%2C|,)([-\d.]+)/);
                          if (qMatch) {
                            lat = parseFloat(qMatch[1]);
                            lng = parseFloat(qMatch[2]);
                          }
                        }

                        // /place/lat,lng
                        if (!lat) {
                          const placeMatch = input.match(/\/place\/([-\d.]+),([-\d.]+)/);
                          if (placeMatch) {
                            lat = parseFloat(placeMatch[1]);
                            lng = parseFloat(placeMatch[2]);
                          }
                        }

                        // For short URLs, try edge function as fallback
                        if (!lat) {
                          try {
                            const resolveRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-url`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({ url: input })
                            });

                            if (resolveRes.ok) {
                              const resData = await resolveRes.json();
                              if (resData.lat && resData.lng) {
                                lat = resData.lat;
                                lng = resData.lng;
                              }
                            } else {
                              const errData = await resolveRes.json().catch(() => ({}));
                              if (errData.error === 'short_url') {
                                throw new Error('Short Google Maps URLs (goo.gl) cannot be resolved automatically.\n\nPlease:\n1. Open the short link in your browser\n2. Wait for Google Maps to load\n3. Copy the full URL from the address bar\n4. Paste it here\n\nThe URL should contain @25.xxx,55.xxx');
                              }
                            }
                          } catch (fetchErr: any) {
                            if (fetchErr.message?.includes('Short Google Maps')) throw fetchErr;
                            console.warn('Resolve URL fallback failed:', fetchErr);
                          }
                        }

                        if (!lat || !lng) {
                          throw new Error('Could not find coordinates in this URL.\n\nMake sure the URL contains coordinates (e.g. @25.2048,55.2708).\n\nTip: Open the location in Google Maps, then copy the full URL from your browser\'s address bar.');
                        }

                        // Query spatial search
                        const { gisService } = await import('@/services/DDAGISService');
                        const apiPlots = await gisService.searchByLocation(lat, lng, locationRadius);

                        if (apiPlots.length === 0) {
                          // Check if the coordinates are outside Dubai's approximate bounding box
                          const isDubai = lat >= 24.7 && lat <= 25.4 && lng >= 54.8 && lng <= 55.7;
                          setError(
                            isDubai
                              ? `No plots found within ${locationRadius}m of this location. Try increasing the search radius.`
                              : `No plots found — the DDA GIS database only covers Dubai emirate. This location (${lat.toFixed(4)}, ${lng.toFixed(4)}) appears to be outside Dubai.`
                          );
                          setMatchResults([]);
                          setStep('results');
                          return;
                        }

                        const inputs: ParcelInput[] = apiPlots.map(plot => ({
                          area: plot.location || plot.id,
                          plotArea: plot.area || 0,
                          plotAreaUnit: 'sqm' as const,
                          plotAreaSqm: plot.area || 0,
                          gfa: plot.gfa || 0,
                          gfaUnit: 'sqm' as const,
                          gfaSqm: plot.gfa || 0,
                          heightFloors: plot.floors ? parseInt(plot.floors.replace(/[^0-9]/g, ''), 10) || 0 : 0,
                          zoning: plot.zoning || '',
                          use: '',
                          far: 0,
                          plotNumber: plot.id
                        }));

                        setParsedInputs(inputs);

                        let results: MatchResult[] = inputs.map((inp, i) => ({
                          input: inp,
                          matchedPlotId: apiPlots[i].id,
                          matchedPlotArea: apiPlots[i].area,
                          matchedGfa: apiPlots[i].gfa,
                          matchedZoning: apiPlots[i].zoning,
                          matchedStatus: apiPlots[i].status,
                          matchedLocation: apiPlots[i].location,
                          areaDeviation: 0,
                          gfaDeviation: 0,
                          confidenceScore: 100
                        }));

                        results = await crossCheckWithSheet(results);

                        setMatchResults(results);
                        setSelectedMatchIds(new Set(results.map(r => r.matchedPlotId)));
                        setStep('results');
                        onHighlightPlots(results.map(r => r.matchedPlotId));
                      } catch (e: any) {
                        setError(e.message || 'Location search failed');
                        setStep('upload');
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    disabled={!locationUrl.trim() || isProcessing}
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                    {isProcessing ? 'Resolving Location...' : 'Search Nearby Plots'}
                  </Button>
                </div>
              )}

              {inputMode === 'form' && (
                <div className="space-y-3">
                  {/* Area Name - mandatory */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Community Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={formArea}
                      onChange={(e) => setFormArea(e.target.value)}
                      placeholder="e.g. Dubai South, Wadi Al Safa 4"
                      className="text-sm"
                    />
                  </div>

                  {/* Land Area */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Land Size {!formGfa && <span className="text-destructive">*</span>}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={formPlotArea}
                        onChange={(e) => setFormPlotArea(e.target.value)}
                        placeholder="e.g. 1200"
                        className="text-sm flex-1"
                      />
                      <Select value={formPlotUnit} onValueChange={(v) => setFormPlotUnit(v as 'sqm' | 'sqft')}>
                        <SelectTrigger className="w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[100]">
                          <SelectItem value="sqm">SQM</SelectItem>
                          <SelectItem value="sqft">SQFT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* GFA */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      GFA {!formPlotArea && <span className="text-destructive">*</span>}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={formGfa}
                        onChange={(e) => setFormGfa(e.target.value)}
                        placeholder="e.g. 1000"
                        className="text-sm flex-1"
                      />
                      <Select value={formGfaUnit} onValueChange={(v) => setFormGfaUnit(v as 'sqm' | 'sqft')}>
                        <SelectTrigger className="w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[100]">
                          <SelectItem value="sqm">SQM</SelectItem>
                          <SelectItem value="sqft">SQFT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Optional fields */}
                  <div className="pt-2 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Optional — improves accuracy</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Zoning</Label>
                        <Input
                          value={formZoning}
                          onChange={(e) => setFormZoning(e.target.value)}
                          placeholder="e.g. Residential"
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Floors</Label>
                        <Input
                          type="number"
                          value={formFloors}
                          onChange={(e) => setFormFloors(e.target.value)}
                          placeholder="e.g. 3"
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full gap-2"
                    onClick={handleQuickSearch}
                    disabled={!canQuickSearch}
                  >
                    <Search className="w-4 h-4" />
                    Search & Match
                  </Button>

                  <p className="text-[10px] text-center text-muted-foreground">
                    Minimum: Area name + Land Size or GFA
                  </p>
                </div>
              )}

              {inputMode === 'text' && (
                <div className="space-y-4">
                  {/* File upload */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Input File
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                    >
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">Drop text file or click to upload</p>
                      <p className="text-xs text-muted-foreground mt-1">Structured .txt format</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.text"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Or Paste Input
                    </label>
                    <textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder={`Area: Wadi Al Safa 4\nPlotArea: 1200 sqm\nGFA: 1000 sqm\nZoning: Residential\nFloors: 3\n---`}
                      className="w-full h-40 bg-muted/30 border border-border/50 rounded-xl p-3 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                    />
                  </div>

                  <Button
                    className="w-full gap-2"
                    onClick={handleParse}
                    disabled={!textContent.trim()}
                  >
                    <FileText className="w-4 h-4" />
                    Parse & Validate Input
                  </Button>
                </div>
              )}

              {/* Google Sheet connector */}
              {inputMode !== 'location' && (
                <div className="space-y-2 pt-2 border-t border-border/30">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" />
                    Google Sheet Cross-Check (Optional)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={sheetId}
                      onChange={(e) => setSheetId(e.target.value)}
                      placeholder="Spreadsheet ID"
                      className="text-xs"
                    />
                    <Button
                      size="sm"
                      variant={sheetConnected ? 'outline' : 'default'}
                      onClick={handleConnectSheet}
                      disabled={isConnectingSheet || !sheetId.trim()}
                      className="shrink-0 gap-1.5"
                    >
                      {isConnectingSheet ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : sheetConnected ? (
                        <CheckCircle className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <Link2 className="w-3.5 h-3.5" />
                      )}
                      {sheetConnected ? 'Linked' : 'Connect'}
                    </Button>
                  </div>
                  {sheetConnected && (
                    <Input
                      value={sheetName}
                      onChange={(e) => setSheetName(e.target.value)}
                      placeholder="Sheet name (default: Sheet1)"
                      className="text-xs"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'parsing' && isProcessing && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium">Parsing input file...</p>
              <p className="text-xs text-muted-foreground">Normalizing units & validating fields</p>
            </div>
          )}

          {step === 'matching' && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <Sparkles className="w-6 h-6 text-primary mx-auto mb-2" />
                <h3 className="font-bold text-sm">Parsed {parsedInputs.length} Parcel(s)</h3>
                <p className="text-xs text-muted-foreground">
                  {parsedInputs.filter(i => i.plotAreaSqm > 0 || i.gfaSqm > 0).length} valid for matching
                </p>
              </div>

              <div className="space-y-2">
                {parsedInputs.map((input, idx) => (
                  <div key={idx} className="data-card text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-foreground">
                        {input.plotNumber || input.area || `Parcel ${idx + 1}`}
                      </span>
                      {(input.plotAreaSqm > 0 || input.gfaSqm > 0) ? (
                        <span className="text-success text-[10px] px-1.5 py-0.5 bg-success/10 rounded">
                          Valid
                        </span>
                      ) : (
                        <span className="text-destructive text-[10px] px-1.5 py-0.5 bg-destructive/10 rounded">
                          Missing data
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                      <span>Area: {input.plotAreaSqm > 0 ? `${input.plotAreaSqm.toFixed(0)} m²` : '—'}</span>
                      <span>GFA: {input.gfaSqm > 0 ? `${input.gfaSqm.toFixed(0)} m²` : '—'}</span>
                      <span>Floors: {input.heightFloors || '—'}</span>
                    </div>
                    {input.area && (
                      <div className="text-muted-foreground">
                        <MapPin className="w-3 h-3 inline mr-1" />
                        {input.area}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleMatch}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Run Matching
              </Button>
            </div>
          )}

          {step === 'results' && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <h3 className="font-bold text-sm">
                  {matchResults.length > 0 ? (
                    <span className="text-success">{matchResults.length} Match(es) Found</span>
                  ) : (
                    <span className="text-warning">No Matches Found</span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {matchResults.length > 0
                    ? `${matchResults.length} lands · ${selectedMatchIds.size} selected`
                    : inputMode === 'location' ? 'No plots found within the search radius' : 'No matching land found within tolerance'}
                </p>
              </div>

              {/* Action Buttons Row */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2 text-xs" onClick={handleReset}>
                  New Search
                </Button>
                {matchResults.length > 0 && (
                  <Button
                    className="flex-1 gap-2"
                    variant="secondary"
                    onClick={() => setShowReviewModal(true)}
                  >
                    <ClipboardList className="w-4 h-4" />
                    Review Data ({selectedMatchIds.size > 0 ? selectedMatchIds.size : matchResults.length})
                  </Button>
                )}
              </div>

              {matchResults.map((result, idx) => (
                <div
                  key={idx}
                  className={`data-card hover:border-primary/50 cursor-pointer transition-all ${selectedMatchIds.has(result.matchedPlotId) ? 'border-primary/60 bg-primary/5' : ''
                    }`}
                  onClick={() => handlePlotClick(result.matchedPlotId)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedMatchIds.has(result.matchedPlotId)}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectedMatchIds(prev => {
                            const next = new Set(prev);
                            if (next.has(result.matchedPlotId)) next.delete(result.matchedPlotId);
                            else next.add(result.matchedPlotId);
                            return next;
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-primary accent-primary"
                      />
                      <Building2 className="w-4 h-4 text-primary" />
                      <div>
                        <span className="font-bold text-lg">Plot {result.matchedPlotId}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-muted-foreground">{result.matchedLocation}</span>
                          {isPlotListed(result.matchedPlotId) && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success">Listed</span>
                          )}
                          {!isPlotListed(result.matchedPlotId) && getExportedPlotIds().has(result.matchedPlotId) && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground">Exported</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="px-3 py-1.5 rounded-full text-sm font-bold" style={{
                        background: result.confidenceScore > 80
                          ? 'hsl(var(--success) / 0.2)'
                          : result.confidenceScore > 50
                            ? 'hsl(var(--warning) / 0.2)'
                            : 'hsl(var(--destructive) / 0.2)',
                        color: result.confidenceScore > 80
                          ? 'hsl(var(--success))'
                          : result.confidenceScore > 50
                            ? 'hsl(var(--warning))'
                            : 'hsl(var(--destructive))'
                      }}>
                        {result.confidenceScore}% match
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-base mb-2">
                    <div>
                      <span className="text-muted-foreground">Land Size:</span>
                      <span className="ml-1 font-semibold">{result.matchedPlotArea.toLocaleString()} m²</span>
                      {result.areaDeviation > 0 && (
                        <span className="text-muted-foreground ml-1">(Δ {result.areaDeviation}%)</span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">GFA:</span>
                      <span className="ml-1 font-medium">{result.matchedGfa.toLocaleString()} m²</span>
                      {result.gfaDeviation > 0 && (
                        <span className="text-muted-foreground ml-1">(Δ {result.gfaDeviation}%)</span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Zoning:</span>
                      <span className="ml-1 font-medium">{result.matchedZoning}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <span className="ml-1 font-medium">{result.matchedStatus}</span>
                    </div>
                  </div>

                  {result.matchedLocation && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <MapPin className="w-3 h-3" />
                      {result.matchedLocation}
                    </div>
                  )}

                  {result.ownerReference && (
                    <div className="text-xs flex items-center gap-1.5 mt-2 px-2 py-1 bg-primary/10 rounded-lg">
                      <CheckCircle className="w-3 h-3 text-primary" />
                      <span className="text-primary font-medium">Owner Ref: {result.ownerReference}</span>
                    </div>
                  )}

                  {result.sheetMetadata && !result.ownerReference && (
                    <div className="text-xs flex items-center gap-1.5 mt-2 px-2 py-1 bg-muted/50 rounded-lg">
                      <Link2 className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Sheet data available</span>
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlotClick(result.matchedPlotId);
                      onClose();
                    }}
                    className="mt-2 w-full text-xs flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Go to Location on Map
                  </button>
                </div>
              ))}


              {/* Review Data Modal */}
              <ReviewDataModal
                isOpen={showReviewModal}
                onClose={() => setShowReviewModal(false)}
                matches={matchResults}
              />
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
