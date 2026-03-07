import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, X, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface FallbackUploadModalProps {
  open: boolean;
  onClose: () => void;
}

export function FallbackUploadModal({ open, onClose }: FallbackUploadModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{ total_parsed: number; valid_mapped: number; upserted: number; errors: number } | null>(null);
  const [stats, setStats] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const fetchStats = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fallback-plots?action=stats`,
        { headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` } }
      );
      const data = await resp.json();
      if (data.success) setStats(data.total_plots);
    } catch { /* ignore */ }
  };

  // Fetch stats on open
  if (stats === null) fetchStats();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      toast({ title: 'Format Not Supported', description: 'Please convert your Excel file to CSV first, then upload.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      const csvText = await file.text();
        }
      );

      const data = await resp.json();

      if (data.success) {
        setResult(data.summary);
        toast({ title: 'Import Complete', description: `${data.summary.upserted} plots imported successfully.` });
        fetchStats();
      } else {
        toast({ title: 'Import Failed', description: data.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Upload Error', description: 'Failed to process file.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg mx-4 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-foreground font-bold text-lg">Fallback Plot Database</h3>
              <p className="text-muted-foreground text-sm">Bulk import plots for areas without GIS coverage</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        {stats !== null && (
          <div className="data-card flex items-center gap-3">
            <Database className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Current database:</span>
            <span className="text-foreground font-bold">{stats.toLocaleString()} plots</span>
          </div>
        )}

        {/* Upload area */}
        <div className="border-2 border-dashed border-muted rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={handleFile}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-muted-foreground text-sm">Processing & uploading plots...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <p className="text-foreground font-medium">Drop CSV file or click to browse</p>
              <p className="text-muted-foreground text-xs max-w-sm">
                Required columns: Municipality Number, Latitude, Longitude.
                Optional: Area Name, Area Code, Common Name, Plot Area Sqm, Zoning, Floors, Developer, Project Name, Status
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="mt-2"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Select CSV File
              </Button>
            </div>
          )}
        </div>

        {/* Result summary */}
        {result && (
          <div className="data-card space-y-2">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-bold text-sm">Import Complete</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Rows Parsed:</span>
                <span className="text-foreground ml-1 font-bold">{result.total_parsed}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Valid Mapped:</span>
                <span className="text-foreground ml-1 font-bold">{result.valid_mapped}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Upserted:</span>
                <span className="text-success ml-1 font-bold">{result.upserted}</span>
              </div>
              {result.errors > 0 && (
                <div>
                  <span className="text-muted-foreground">Errors:</span>
                  <span className="text-destructive ml-1 font-bold">{result.errors}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Flow diagram */}
        <div className="data-card text-xs text-muted-foreground space-y-1">
          <p className="font-bold text-foreground text-sm mb-2">How it works:</p>
          <p>1. User requests a plot → Check GIS/DDA API first</p>
          <p>2. If GIS returns no data → Query fallback database</p>
          <p>3. Fallback plots render with <span className="text-primary font-bold">neon cyan border</span></p>
          <p>4. PostGIS spatial queries enable nearby plot search</p>
        </div>
      </div>
    </div>
  );
}
