import { useState, useCallback, useRef } from 'react';
import {
  X, Upload, Search, FileText, CheckCircle, AlertTriangle,
  Target, Loader2, MapPin, Building2, Sparkles, ArrowRight,
  Link2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlotData } from '@/services/DDAGISService';
import {
  parseTextFile,
  matchParcels,
  ParcelInput,
  MatchResult
} from '@/services/LandMatchingService';

interface LandMatchingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  plots: PlotData[];
  onHighlightPlots: (plotIds: string[]) => void;
  onSelectPlot: (plot: PlotData) => void;
}

type WizardStep = 'upload' | 'parsing' | 'matching' | 'results';

export function LandMatchingWizard({
  isOpen,
  onClose,
  plots,
  onHighlightPlots,
  onSelectPlot
}: LandMatchingWizardProps) {
  const [step, setStep] = useState<WizardStep>('upload');
  const [textContent, setTextContent] = useState('');
  const [parsedInputs, setParsedInputs] = useState<ParcelInput[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [sheetConnected, setSheetConnected] = useState(false);
  const [isConnectingSheet, setIsConnectingSheet] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleParse = useCallback(() => {
    if (!textContent.trim()) {
      setError('Please upload or paste a text file first');
      return;
    }

    setIsProcessing(true);
    setStep('parsing');
    setError(null);

    try {
      const inputs = parseTextFile(textContent);
      if (inputs.length === 0) {
        setError('No valid parcels found in the input');
        setStep('upload');
        setIsProcessing(false);
        return;
      }

      // Flag unknown units
      const unknownUnits = inputs.filter(
        i => i.plotAreaUnit === 'unknown' || i.gfaUnit === 'unknown'
      );
      if (unknownUnits.length > 0) {
        setError(`${unknownUnits.length} parcel(s) have unknown units and will be excluded`);
      }

      setParsedInputs(inputs);
      setIsProcessing(false);
      setStep('matching');
    } catch (err) {
      setError('Failed to parse input file');
      setStep('upload');
      setIsProcessing(false);
    }
  }, [textContent]);

  const handleMatch = useCallback(async () => {
    setIsProcessing(true);
    setStep('matching');

    try {
      const results = matchParcels(parsedInputs, plots);

      // Cross-check with Google Sheet if connected
      if (sheetConnected && sheetId) {
        try {
          const plotNumbers = results.map(r => r.matchedPlotId);
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-sheets-proxy?action=lookup`,
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

          if (response.ok) {
            const sheetData = await response.json();
            if (sheetData.matches) {
              for (const result of results) {
                const sheetMatch = sheetData.matches[result.matchedPlotId];
                if (sheetMatch) {
                  result.ownerReference = sheetMatch.owner_reference || sheetMatch['owner ref'] || undefined;
                  result.sheetMetadata = sheetMatch;
                }
              }
            }
          }
        } catch (sheetErr) {
          console.warn('Google Sheet cross-check failed:', sheetErr);
        }
      }

      setMatchResults(results);
      setStep('results');

      // Highlight matched plots on map
      const matchedIds = results.map(r => r.matchedPlotId);
      onHighlightPlots(matchedIds);
    } catch (err) {
      setError('Matching failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [parsedInputs, plots, sheetConnected, sheetId, sheetName, onHighlightPlots]);

  const handleConnectSheet = useCallback(async () => {
    if (!sheetId.trim()) return;
    setIsConnectingSheet(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-sheets-proxy?action=test`,
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
          setError(null);
        } else {
          setError('Could not connect to the spreadsheet');
        }
      } else {
        setError('Failed to verify spreadsheet access');
      }
    } catch (err) {
      setError('Connection test failed');
    } finally {
      setIsConnectingSheet(false);
    }
  }, [sheetId]);

  const handlePlotClick = useCallback((plotId: string) => {
    const plot = plots.find(p => p.id === plotId);
    if (plot) onSelectPlot(plot);
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
      {/* Backdrop */}
      <div className="fixed inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
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
              <p className="text-xs text-muted-foreground">±6% tolerance • Strict config</p>
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
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                i <= ['upload', 'parsing', 'matching', 'results'].indexOf(step)
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

              {/* Text input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Or Paste Input
                </label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder={`Area: Wadi Al Safa 4\nPlotArea: 1200 sqm\nGFA: 1000 sqm\nZoning: Residential\nUse: Mixed\nHeightFloors: 3\nFAR: 1.2\nPlotNumber: 3347629\n---`}
                  className="w-full h-40 bg-muted/30 border border-border/50 rounded-xl p-3 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                />
              </div>

              {/* Google Sheet connector */}
              <div className="space-y-2">
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
                  {parsedInputs.filter(i => i.plotAreaUnit !== 'unknown').length} valid for matching
                </p>
              </div>

              {/* Parsed summary */}
              <div className="space-y-2">
                {parsedInputs.map((input, idx) => (
                  <div key={idx} className="data-card text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-foreground">
                        {input.plotNumber || `Parcel ${idx + 1}`}
                      </span>
                      {input.plotAreaUnit === 'unknown' ? (
                        <span className="text-destructive text-[10px] px-1.5 py-0.5 bg-destructive/10 rounded">
                          Unknown unit
                        </span>
                      ) : (
                        <span className="text-success text-[10px] px-1.5 py-0.5 bg-success/10 rounded">
                          Valid
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                      <span>Area: {input.plotAreaSqm.toFixed(0)} m²</span>
                      <span>GFA: {input.gfaSqm.toFixed(0)} m²</span>
                      <span>Floors: {input.heightFloors}</span>
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
                Run Matching (±6% Tolerance)
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
                    ? 'Plots within ±6% tolerance with matching configuration'
                    : 'No matching land found within ±6% tolerance and identical building configuration'}
                </p>
              </div>

              {matchResults.map((result, idx) => (
                <div
                  key={idx}
                  className="data-card hover:border-primary/50 cursor-pointer transition-all"
                  onClick={() => handlePlotClick(result.matchedPlotId)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span className="font-bold text-sm">{result.matchedPlotId}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
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

                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div>
                      <span className="text-muted-foreground">Plot Area:</span>
                      <span className="ml-1 font-medium">{result.matchedPlotArea.toLocaleString()} m²</span>
                      <span className="text-muted-foreground ml-1">(Δ {result.areaDeviation}%)</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">GFA:</span>
                      <span className="ml-1 font-medium">{result.matchedGfa.toLocaleString()} m²</span>
                      <span className="text-muted-foreground ml-1">(Δ {result.gfaDeviation}%)</span>
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
                    }}
                    className="mt-2 w-full text-xs flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <ArrowRight className="w-3 h-3" />
                    Zoom to Plot on Map
                  </button>
                </div>
              ))}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2 text-xs" onClick={handleReset}>
                  New Search
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
