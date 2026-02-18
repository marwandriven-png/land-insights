import { X, MapPin, Building2, Layers, TrendingUp, FileText, AlertCircle, CheckCircle, Shield, Clock, Hash, Loader2, FileWarning, LayoutGrid, Navigation } from 'lucide-react';
import { PlotData, calculateFeasibility, VerificationSource, AffectionPlanData, gisService } from '@/services/DDAGISService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isPlotListed, getExportedPlotIds } from '@/services/LandMatchingService';
import { useState, useEffect } from 'react';
import { SimilarLandPanel } from './SimilarLandPanel';
import { FeasibilityCalculator } from './FeasibilityCalculator';

interface PlotDetailPanelProps {
  plot: PlotData;
  onClose: () => void;
  onSelectPlot?: (plot: PlotData) => void;
  onGoToLocation?: (plot: PlotData) => void;
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    'Available': 'bg-success/20 text-success border-success/30',
    'Reserved': 'bg-warning/20 text-warning border-warning/30',
    'Under Construction': 'bg-warning/20 text-warning border-warning/30',
    'Completed': 'bg-muted text-muted-foreground border-border',
    'Frozen': 'bg-destructive/20 text-destructive border-destructive/30',
  };
  return styles[status] || styles['Available'];
}

function getVerificationBadge(source: VerificationSource) {
  const styles: Record<VerificationSource, { bg: string; text: string; label: string }> = {
    'DDA': { bg: 'bg-primary/20', text: 'text-primary', label: 'Verified via DDA' },
    'DLD': { bg: 'bg-secondary/20', text: 'text-secondary', label: 'Verified via Dubai Land Department' },
    'Demo': { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Demo Data' },
    'Manual': { bg: 'bg-warning/20', text: 'text-warning', label: 'Manual Entry' },
  };
  return styles[source] || styles['Demo'];
}

function SetbackRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

function AffectionPlanSection({ plotId }: { plotId: string }) {
  const [plan, setPlan] = useState<AffectionPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setPlan(null);

    gisService.fetchAffectionPlan(plotId).then(data => {
      if (cancelled) return;
      setPlan(data);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError(true);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [plotId]);

  if (loading) {
    return (
      <div className="border-t border-border/50 pt-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <LayoutGrid className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Affection Plan</h3>
        </div>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-xs text-muted-foreground">Loading plan...</span>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="border-t border-border/50 pt-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <LayoutGrid className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Affection Plan</h3>
        </div>
        <div className="flex items-center gap-2 py-3 px-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
          <FileWarning className="w-4 h-4 shrink-0" />
          Affection Plan not available for this plot
        </div>
      </div>
    );
  }

  const hasSetbacks = plan.buildingSetbacks.side1 || plan.buildingSetbacks.side2 || plan.buildingSetbacks.side3 || plan.buildingSetbacks.side4;
  const hasPodiumSetbacks = plan.podiumSetbacks.side1 || plan.podiumSetbacks.side2 || plan.podiumSetbacks.side3 || plan.podiumSetbacks.side4;

  return (
    <div className="border-t border-border/50 pt-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <LayoutGrid className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Affection Plan</h3>
      </div>

      <div className="space-y-3">
        {(plan.mainLanduse || plan.landuseCategory) && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Land Use</span>
            {plan.mainLanduse && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Main</span>
                <span className="text-foreground font-medium">{plan.mainLanduse}</span>
              </div>
            )}
            {plan.subLanduse && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sub</span>
                <span className="text-foreground font-medium">{plan.subLanduse}</span>
              </div>
            )}
            {plan.landuseCategory && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Category</span>
                <span className="text-foreground font-medium">{plan.landuseCategory}</span>
              </div>
            )}
            {plan.landuseDetails && (
              <div className="text-sm text-muted-foreground mt-1">{plan.landuseDetails}</div>
            )}
          </div>
        )}

        <div className="space-y-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Height & Coverage</span>
          {plan.maxHeight && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Max Height</span>
              <span className="text-foreground font-medium">{plan.maxHeight}</span>
            </div>
          )}
          {plan.heightCategory && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Height Category</span>
              <span className="text-foreground font-medium">{plan.heightCategory}</span>
            </div>
          )}
          {plan.maxPlotCoverage != null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Max Coverage</span>
              <span className="text-foreground font-medium">{plan.maxPlotCoverage}%</span>
            </div>
          )}
          {plan.minPlotCoverage != null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Min Coverage</span>
              <span className="text-foreground font-medium">{plan.minPlotCoverage}%</span>
            </div>
          )}
          {plan.plotCoverage && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Plot Coverage</span>
              <span className="text-foreground font-medium">{plan.plotCoverage}</span>
            </div>
          )}
          {plan.gfaType && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GFA Type</span>
              <span className="text-foreground font-medium">{plan.gfaType}</span>
            </div>
          )}
        </div>

        {hasSetbacks && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Building Setbacks</span>
            <SetbackRow label="Side 1" value={plan.buildingSetbacks.side1} />
            <SetbackRow label="Side 2" value={plan.buildingSetbacks.side2} />
            <SetbackRow label="Side 3" value={plan.buildingSetbacks.side3} />
            <SetbackRow label="Side 4" value={plan.buildingSetbacks.side4} />
          </div>
        )}

        {hasPodiumSetbacks && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Podium Setbacks</span>
            <SetbackRow label="Side 1" value={plan.podiumSetbacks.side1} />
            <SetbackRow label="Side 2" value={plan.podiumSetbacks.side2} />
            <SetbackRow label="Side 3" value={plan.podiumSetbacks.side3} />
            <SetbackRow label="Side 4" value={plan.podiumSetbacks.side4} />
          </div>
        )}

        {(plan.siteplanIssueDate || plan.siteplanExpiryDate) && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Site Plan</span>
            {plan.siteplanIssueDate && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Issue Date</span>
                <span className="text-foreground font-medium">{new Date(plan.siteplanIssueDate).toLocaleDateString()}</span>
              </div>
            )}
            {plan.siteplanExpiryDate && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expiry Date</span>
                <span className="text-foreground font-medium">{new Date(plan.siteplanExpiryDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        )}

        {plan.generalNotes && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</span>
            <p className="text-sm text-muted-foreground leading-relaxed">{plan.generalNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function PlotDetailPanel({ plot, onClose, onSelectPlot, onGoToLocation }: PlotDetailPanelProps) {
  const listed = isPlotListed(plot.id);
  const exported = getExportedPlotIds().has(plot.id);
  const isManual = plot.verificationSource === 'Manual';

  return (
    <div className="fixed right-4 top-4 bottom-4 w-96 z-[1001] animate-in slide-in-from-right duration-300">
      <div className="glass-card glow-border shadow-2xl flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Plot {plot.id}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {plot.location || plot.project || plot.entity || 'Dubai'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Status Badge, Listed Badge & Go to Location */}
          <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusBadge(plot.status)}`}>
                {plot.status === 'Available' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : plot.status === 'Frozen' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <Building2 className="w-4 h-4" />
                )}
                {plot.status}
              </span>
              {listed && (
                <Badge className="bg-success/20 text-success border-success/30">Listed</Badge>
              )}
              {!listed && exported && (
                <Badge variant="secondary">Exported</Badge>
              )}
              {isManual && (
                <Badge className="bg-warning/20 text-warning border-warning/30">Manual Entry</Badge>
              )}
            </div>
            {onGoToLocation && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onGoToLocation(plot)}
                className="gap-1.5 text-xs h-8"
              >
                <Navigation className="w-3.5 h-3.5" />
                Go to Land
              </Button>
            )}
          </div>
          {plot.isFrozen && plot.freezeReason && (
            <p className="text-xs text-destructive mb-4">⚠️ {plot.freezeReason}</p>
          )}

          {/* Plot Details Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="data-card">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Layers className="w-4 h-4" />
                Plot Size
              </div>
              <div className="text-lg font-bold text-foreground">
                {plot.area.toLocaleString()} <span className="text-xs font-normal">m²</span>
              </div>
            </div>

            <div className="data-card">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Building2 className="w-4 h-4" />
                GFA
              </div>
              <div className="text-lg font-bold text-foreground">
                {plot.gfa.toLocaleString()} <span className="text-xs font-normal">m²</span>
              </div>
            </div>

            <div className="data-card">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="w-4 h-4" />
                Floors
              </div>
              <div className="text-lg font-bold text-foreground">{plot.floors}</div>
            </div>

            <div className="data-card">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <FileText className="w-4 h-4" />
                Zoning
              </div>
              <div className="text-sm font-bold text-foreground">{plot.zoning}</div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="space-y-2 mb-4 text-sm">
            {plot.developer && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Developer</span>
                <span className="text-foreground font-medium">{plot.developer}</span>
              </div>
            )}
            {plot.project && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Project</span>
                <span className="text-foreground font-medium">{plot.project}</span>
              </div>
            )}
            {plot.maxHeight && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Height</span>
                <span className="text-foreground font-medium">{plot.maxHeight}m</span>
              </div>
            )}
            {plot.plotCoverage && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plot Coverage</span>
                <span className="text-foreground font-medium">{plot.plotCoverage}%</span>
              </div>
            )}
          </div>

          {/* Affection Plan - fetched on demand */}
          <AffectionPlanSection plotId={plot.id} />

          {/* Verification Source */}
          <div className="border-t border-border/50 pt-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Data Verification</h3>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${getVerificationBadge(plot.verificationSource).bg} ${getVerificationBadge(plot.verificationSource).text} border border-border/30`}>
              <CheckCircle className="w-3.5 h-3.5" />
              {getVerificationBadge(plot.verificationSource).label}
            </div>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {plot.verificationDate && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Verified: {new Date(plot.verificationDate).toLocaleDateString()}
                </div>
              )}
              {plot.municipalityNumber && (
                <div className="flex items-center gap-2">
                  <Hash className="w-3 h-3" />
                  Municipality: {plot.municipalityNumber} / Sub: {plot.subNumber}
                </div>
              )}
              {plot.isApproximateLocation && (
                <div className="flex items-center gap-2 text-warning">
                  <AlertCircle className="w-3 h-3" />
                  Approximate Location
                </div>
              )}
            </div>
          </div>

          {/* Feasibility Calculator - Editable */}
          <FeasibilityCalculator plot={plot} />

          {/* Similar Land */}
          {onSelectPlot && (
            <SimilarLandPanel plot={plot} onSelectPlot={onSelectPlot} />
          )}

          {/* Bottom spacer for scroll */}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}
