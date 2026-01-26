import { X, MapPin, Building2, Layers, TrendingUp, FileText, Download, AlertCircle, CheckCircle, Shield, Clock, Hash } from 'lucide-react';
import { PlotData, calculateFeasibility, VerificationSource } from '@/services/DDAGISService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generatePlotPDF } from '@/utils/pdfGenerator';
import { forwardRef } from 'react';

interface PlotDetailPanelProps {
  plot: PlotData;
  onClose: () => void;
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
  };
  return styles[source] || styles['Demo'];
}

export function PlotDetailPanel({ plot, onClose }: PlotDetailPanelProps) {
  const feasibility = calculateFeasibility(plot);

  const handleExportPDF = async () => {
    await generatePlotPDF(plot, feasibility);
  };

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 w-96 z-[1001] animate-in slide-in-from-right duration-300">
      <div className="glass-card glow-border p-5 shadow-2xl">
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

        {/* Status Badge */}
        <div className="mb-4">
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
          {plot.isFrozen && plot.freezeReason && (
            <p className="text-xs text-destructive mt-2">⚠️ {plot.freezeReason}</p>
          )}
        </div>

        {/* Plot Details Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="data-card">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Layers className="w-3.5 h-3.5" />
              Plot Size
            </div>
            <div className="text-lg font-bold text-foreground">
              {plot.area.toLocaleString()} <span className="text-xs font-normal">m²</span>
            </div>
          </div>

          <div className="data-card">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Building2 className="w-3.5 h-3.5" />
              GFA
            </div>
            <div className="text-lg font-bold text-foreground">
              {plot.gfa.toLocaleString()} <span className="text-xs font-normal">m²</span>
            </div>
          </div>

          <div className="data-card">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Floors
            </div>
            <div className="text-lg font-bold text-foreground">{plot.floors}</div>
          </div>

          <div className="data-card">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <FileText className="w-3.5 h-3.5" />
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

        {/* Verification Source */}
        <div className="border-t border-border/50 pt-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Data Verification</h3>
          </div>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${getVerificationBadge(plot.verificationSource).bg} ${getVerificationBadge(plot.verificationSource).text} border border-border/30`}>
            <CheckCircle className="w-3.5 h-3.5" />
            {getVerificationBadge(plot.verificationSource).label}
          </div>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
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

        {/* Feasibility Summary */}
        <div className="border-t border-border/50 pt-4 mb-4">
          <h3 className="text-sm font-bold text-primary mb-3">Feasibility Analysis</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="data-card py-2">
              <div className="text-xs text-muted-foreground">ROI</div>
              <div className="text-lg font-bold text-success">{feasibility.roi}%</div>
            </div>
            <div className="data-card py-2">
              <div className="text-xs text-muted-foreground">Profit</div>
              <div className="text-sm font-bold text-foreground">
                {(feasibility.profit / 1000000).toFixed(1)}M
              </div>
            </div>
            <div className="data-card py-2">
              <div className="text-xs text-muted-foreground">Risk</div>
              <div className={`text-sm font-bold ${
                feasibility.riskLevel === 'Low' ? 'text-success' :
                feasibility.riskLevel === 'Medium' ? 'text-warning' : 'text-destructive'
              }`}>
                {feasibility.riskLevel}
              </div>
            </div>
          </div>
        </div>

        {/* Export Button */}
        <Button
          onClick={handleExportPDF}
          className="w-full gap-2"
          variant="default"
        >
          <Download className="w-4 h-4" />
          Export Plot Report (PDF)
        </Button>
      </div>
    </div>
  );
}
