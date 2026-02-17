import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
}

export function FeasibilitySettings({ open, onClose, onSettingsChange }: FeasibilitySettingsProps) {
  const [settings, setSettings] = useState<FeasibilitySettingsData>(loadFeasibilitySettings);

  useEffect(() => {
    if (open) setSettings(loadFeasibilitySettings());
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    saveFeasibilitySettings(settings);
    onSettingsChange?.(settings);
    toast.success('Feasibility prompt saved');
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
            <h2 className="text-lg font-bold text-foreground">Feasibility Prompt</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
              className="min-h-[360px] font-mono text-xs leading-relaxed"
              placeholder="Enter your feasibility analysis prompt in Markdown..."
            />
          </div>
        </div>

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
              Save Prompt
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
