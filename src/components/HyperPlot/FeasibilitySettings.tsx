import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, FileText, Plus, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const STORAGE_KEY = 'hyperplot_feasibility_settings';

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
  } catch {}
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
                <FileText className="w-3.5 h-3.5" />
                AI Prompt
              </TabsTrigger>
              <TabsTrigger value="addland" className="flex-1 gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Add Land
              </TabsTrigger>
              <TabsTrigger value="sheet" className="flex-1 gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                Google Sheet
              </TabsTrigger>
            </TabsList>
          </div>

          {/* AI Prompt Tab */}
          <TabsContent value="prompt" className="flex-1 overflow-y-auto px-5 pb-3 mt-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" />
                Analysis Prompt (Markdown)
              </h3>
              <p className="text-[11px] text-muted-foreground mb-2">
                Use {"{{paramName}}"} placeholders. Parameters are configured per land in the detail panel.
              </p>
              <Textarea
                value={settings.prompt}
                onChange={(e) => setSettings(prev => ({ ...prev, prompt: e.target.value }))}
                className="min-h-[320px] font-mono text-xs leading-relaxed"
                placeholder="Enter your feasibility analysis prompt in Markdown..."
              />
            </div>
          </TabsContent>

          {/* Add Land Tab */}
          <TabsContent value="addland" className="flex-1 overflow-y-auto px-5 pb-3 mt-3">
            <div className="text-center py-12">
              <Plus className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-2">Add New Land</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Manually add a land with coordinates, planning data, and affection plan details.
              </p>
              <Button
                onClick={() => {
                  onClose();
                  onOpenAddLand?.();
                }}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Open Add Land Form
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
