import { useState, useEffect, useRef } from 'react';
import { Settings, Save, RotateCcw, FileText, Plus, Link2, Upload, X, File, CheckCircle2, Loader2, Key, Eye, EyeOff } from 'lucide-react';
import mammoth from 'mammoth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const STORAGE_KEY = 'hyperplot_feasibility_settings';
const AREA_FILES_KEY = 'hyperplot_area_research_files';
const OPENAI_KEY_STORAGE = 'hyperplot_openai_api_key';

interface AreaFile {
  id: string;
  name: string;
  size: number;
  areaName: string;
  uploadedAt: string;
  textContent?: string;
  aiParsed?: boolean;
  aiStatus?: string;
  aiError?: string;
  marketData?: Record<string, unknown>;
}

function loadAreaFiles(): AreaFile[] {
  try {
    const stored = localStorage.getItem(AREA_FILES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveAreaFiles(files: AreaFile[]) {
  localStorage.setItem(AREA_FILES_KEY, JSON.stringify(files));
}

function AreaResearchUpload() {
  const [files, setFiles] = useState<AreaFile[]>(loadAreaFiles);
  const [dragOver, setDragOver] = useState(false);
  const [areaNameInput, setAreaNameInput] = useState('');
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem(OPENAI_KEY_STORAGE) || '');
  const [showKey, setShowKey] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist OpenAI key on change
  const handleKeyChange = (val: string) => {
    setOpenaiKey(val);
    localStorage.setItem(OPENAI_KEY_STORAGE, val);
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    if (!areaNameInput.trim()) {
      toast.error('Please enter an area name before uploading');
      return;
    }
    const newFiles: AreaFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const isWord = f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || f.type === 'application/msword' || f.name.endsWith('.docx') || f.name.endsWith('.doc');
      if (!isWord) {
        toast.error(`Only Word files (.doc, .docx) are supported: ${f.name}`);
        continue;
      }
      // Extract text from .docx using mammoth.js for proper parsing
      let textContent = '';
      try {
        const arrayBuffer = await f.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        textContent = result.value || '';
        console.log(`Mammoth extracted ${textContent.length} chars from ${f.name}`);
      } catch (err) {
        console.error('Mammoth extraction failed:', err);
        textContent = '';
      }
      newFiles.push({
        id: `AF_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: f.name,
        size: f.size,
        areaName: areaNameInput.trim(),
        uploadedAt: new Date().toISOString(),
        textContent: textContent.slice(0, 50000), // Cap at 50k chars
        aiStatus: 'parsing',
      });
    }
    if (newFiles.length) {
      const updated = [...files, ...newFiles];
      setFiles(updated);
      saveAreaFiles(updated);
      setAreaNameInput('');
      toast.success(`${newFiles.length} file(s) added — sending to AI for analysis...`);
      // Trigger AI parsing for each new file
      await Promise.all(newFiles.map((nf) => parseWithAI(nf, openaiKey)));
    }
  };

  const parseWithAI = async (file: AreaFile, apiKey?: string) => {
    const keyToUse = (apiKey || localStorage.getItem(OPENAI_KEY_STORAGE) || '').trim();

    if (!keyToUse) {
      const failed = files.map(f => f.id === file.id ? { ...f, aiStatus: 'error', aiError: 'OpenAI key required', aiParsed: false } : f);
      setFiles(failed);
      saveAreaFiles(failed);
      toast.error('OpenAI API key is required to parse research files');
      return;
    }

    if (!file.textContent) {
      const failed = files.map(f => f.id === file.id ? { ...f, aiStatus: 'error', aiError: 'No readable text content', aiParsed: false } : f);
      setFiles(failed);
      saveAreaFiles(failed);
      toast.error(`No readable content in ${file.name}`);
      return;
    }

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-area-research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          fileContent: file.textContent,
          areaName: file.areaName,
          openaiApiKey: keyToUse,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'AI parsing failed' }));
        const failed = loadAreaFiles().map(f => f.id === file.id ? { ...f, aiStatus: 'error', aiError: err.error || 'AI parsing failed', aiParsed: false } : f);
        setFiles(failed);
        saveAreaFiles(failed);
        toast.error(err.error || 'AI parsing failed');
        return;
      }

      const data = await resp.json();
      if (data.success && data.marketData) {
        const updated = loadAreaFiles().map(f =>
          f.id === file.id ? { ...f, aiParsed: true, aiStatus: 'parsed', aiError: undefined, marketData: data.marketData } : f
        );
        setFiles(updated);
        saveAreaFiles(updated);
        toast.success(`AI extracted market data for ${file.areaName}`);
      }
    } catch (e) {
      console.error('AI parse error:', e);
      const failed = loadAreaFiles().map(f => f.id === file.id ? { ...f, aiStatus: 'error', aiError: 'Network or parser error', aiParsed: false } : f);
      setFiles(failed);
      saveAreaFiles(failed);
      toast.error(`Failed to parse ${file.name} with OpenAI`);
    }
  };

  const removeFile = (id: string) => {
    const updated = files.filter(f => f.id !== id);
    setFiles(updated);
    saveAreaFiles(updated);
  };

  const updateAreaName = (id: string, name: string) => {
    const updated = files.map(f => f.id === id ? { ...f, areaName: name } : f);
    setFiles(updated);
    saveAreaFiles(updated);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
          <Upload className="w-4 h-4 text-primary" />
          Area Research Files
        </h3>
        <p className="text-[11px] text-muted-foreground mb-3">
          Upload Word research files (.doc, .docx) for each area. AI will extract market data used in feasibility analysis.
        </p>
      </div>

      {/* OpenAI API Key input */}
      <div className="p-3 rounded-xl bg-muted/20 border border-border/50 space-y-2">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Key className="w-3.5 h-3.5 text-primary" />
          OpenAI API Key
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">Saved locally · never sent to our servers</span>
        </label>
        <div className="relative">
          <Input
            type={showKey ? 'text' : 'password'}
            value={openaiKey}
            onChange={e => handleKeyChange(e.target.value)}
            placeholder="sk-..."
            className="text-sm pr-9 font-mono"
          />
          <button
            type="button"
            onClick={() => setShowKey(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Used to parse uploaded Word documents via OpenAI.
          This key is required for parsing in this environment.
          Get a key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-primary underline">platform.openai.com</a>.
        </p>
      </div>

      {/* Area name input */}
      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">Area Name <span className="text-destructive">*</span></label>
        <Input
          value={areaNameInput}
          onChange={e => setAreaNameInput(e.target.value)}
          placeholder="e.g. Jumeirah Garden City, Al Satwa..."
          className="text-sm"
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${!areaNameInput.trim() ? 'border-border/30 bg-muted/10 opacity-60 cursor-not-allowed' :
            dragOver ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/50 hover:bg-muted/20'
          }`}
      >
        <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground font-medium">
          {areaNameInput.trim() ? 'Drop Word files here or click to browse' : 'Enter area name above first'}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">Supports .doc and .docx files only</p>
        <input
          ref={inputRef}
          type="file"
          accept=".doc,.docx"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">
            {files.length} file{files.length > 1 ? 's' : ''} uploaded
          </div>
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 group">
              <File className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                  {f.aiParsed || f.aiStatus === 'parsed' ? (
                    <span className="flex items-center gap-1 text-[10px] text-success font-medium">
                      <CheckCircle2 className="w-3 h-3" /> AI Parsed
                    </span>
                  ) : f.aiStatus === 'error' ? (
                    <span className="flex items-center gap-1 text-[10px] text-destructive font-medium" title={f.aiError || 'Parsing failed'}>
                      <X className="w-3 h-3" /> Parse failed
                    </span>
                  ) : f.aiStatus === 'parsing' ? (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                      <Loader2 className="w-3 h-3 animate-spin" /> Parsing...
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={f.areaName}
                    onChange={e => updateAreaName(f.id, e.target.value)}
                    className="h-6 text-[10px] px-2 py-0 w-32"
                    placeholder="Area name..."
                  />
                  <span className="text-[10px] text-muted-foreground">{formatSize(f.size)}</span>
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); removeFile(f.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export interface FeasibilitySettingsData {
  prompt: string;
  constructionPSF: number;
  landCostPSF: number;
  authorityFeePct: number;
  consultantFeePct: number;
  buaMultiplier: number;
  salePricePSF: number;
}

const DEFAULT_SETTINGS: FeasibilitySettingsData = {
  prompt: `# Feasibility Analysis Prompt

Analyze the following land plot for real estate development feasibility in Dubai.

## Parameters
- Construction Cost: {{constructionPSF}} AED per sqft on BUA
- Land Cost: {{landCostPSF}} AED per sqft
- Authority Fees: {{authorityFeePct}}%
- Consultant Fees: {{consultantFeePct}}%
- BUA Multiplier: {{buaMultiplier}}x GFA
- Target Sale Price: {{salePricePSF}} AED per sqft

## Instructions
1. Calculate total BUA from GFA using the multiplier
2. Estimate construction cost based on BUA
3. Add land acquisition cost
4. Include authority and consultant fees
5. Project revenue based on sale price PSF
6. Determine ROI, profit margin, and payback period
7. Assess risk level based on location, zoning, and market conditions

## Area Data Integration
- Use transaction sales summary for the matched area
- Include rental transaction trends
- Factor in upcoming developments and supply pipeline
- Apply area-specific market assumptions to valuation`,
  constructionPSF: 420,
  landCostPSF: 725,
  authorityFeePct: 4,
  consultantFeePct: 3,
  buaMultiplier: 1.45,
  salePricePSF: 1500,
};

export function loadFeasibilitySettings(): FeasibilitySettingsData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch { }
  return DEFAULT_SETTINGS;
}

function saveFeasibilitySettings(settings: FeasibilitySettingsData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface FeasibilitySettingsProps {
  open: boolean;
  onClose: () => void;
  onSettingsChange?: (settings: FeasibilitySettingsData) => void;
  onOpenAddLand?: () => void;
}

export function FeasibilitySettings({ open, onClose, onSettingsChange, onOpenAddLand }: FeasibilitySettingsProps) {
  const [settings, setSettings] = useState<FeasibilitySettingsData>(loadFeasibilitySettings);
  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem('hyperplot_sheet_url') || '');
  const [activeWizardTab, setActiveWizardTab] = useState('prompt');

  useEffect(() => {
    if (open) {
      setSettings(loadFeasibilitySettings());
      setSheetUrl(localStorage.getItem('hyperplot_sheet_url') || '');
    }
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    saveFeasibilitySettings(settings);
    localStorage.setItem('hyperplot_sheet_url', sheetUrl);
    onSettingsChange?.(settings);
    toast.success('Settings saved');
    onClose();
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    toast.info('Reset to defaults (not saved yet)');
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Settings Wizard</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
        </div>

        {/* Tabs */}
        <Tabs value={activeWizardTab} onValueChange={setActiveWizardTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-5 pt-3">
            <TabsList className="w-full">
              <TabsTrigger value="prompt" className="flex-1 gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Area Research
              </TabsTrigger>
               <TabsTrigger value="addland" className="flex-1 gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Add Plot
              </TabsTrigger>
              <TabsTrigger value="sheet" className="flex-1 gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                Google Sheet
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Area Research Tab */}
          <TabsContent value="prompt" className="flex-1 overflow-y-auto px-5 pb-3 mt-3">
            <AreaResearchUpload />
          </TabsContent>

          {/* Add Land Tab */}
          <TabsContent value="addland" className="flex-1 overflow-y-auto px-5 pb-3 mt-3">
            <div className="text-center py-12">
              <Plus className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-2">Add New Plot</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Manually add a plot with Google Maps location, planning data, and affection plan details.
              </p>
              <Button
                onClick={() => {
                  onClose();
                  onOpenAddLand?.();
                }}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Open Add Plot Form
              </Button>
            </div>
          </TabsContent>

          {/* Google Sheet Tab */}
          <TabsContent value="sheet" className="flex-1 overflow-y-auto px-5 pb-3 mt-3">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-primary" />
                  Google Sheet URL
                </h3>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Link a Google Sheet to sync listing data. The sheet must be shared as "Anyone with the link can view".
                  Columns should include: Land Number, Owner, Location, Area (sqft), GFA (sqft), Zoning, Status, Contact.
                </p>
                <Input
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="text-sm"
                />
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs text-muted-foreground">
                  <strong>Required columns:</strong> Land Number, Owner, Location, Area (sqft), GFA (sqft), Zoning, Status, Contact
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  The sheet will be used to enrich listing data and sync updates.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-border/50">
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-muted-foreground">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} className="gap-1.5">
              <Save className="w-3.5 h-3.5" />
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
