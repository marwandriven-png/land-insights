import { useState, useEffect } from 'react';
import { Loader2, BarChart3, Building2, AlertCircle, DollarSign, TrendingUp, Square, Layers, Download, Share2 } from 'lucide-react';
import { PlotData, calculateFeasibility } from '@/services/DDAGISService';

interface FeasibilityPanelProps {
  plot: PlotData;
}

const sections = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'details', label: 'Details', icon: Building2 },
  { id: 'risk', label: 'Risk', icon: AlertCircle }
];

export function FeasibilityPanel({ plot }: FeasibilityPanelProps) {
  const [isGenerating, setIsGenerating] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    setIsGenerating(true);
    const timer = setTimeout(() => setIsGenerating(false), 1200);
    return () => clearTimeout(timer);
  }, [plot]);

  if (isGenerating) {
    return (
      <div className="h-full flex items-center justify-center glass-card glow-border">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <div className="text-foreground font-bold text-lg">Analyzing Plot Data...</div>
          <div className="text-sm text-muted-foreground mt-2">Connecting to DDA GIS</div>
        </div>
      </div>
    );
  }

  const feasibility = calculateFeasibility(plot);

  return (
    <div className="h-full overflow-y-auto space-y-4 scrollbar-thin pr-2">
      {/* Section Navigation */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
              activeSection === section.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <section.icon className="w-4 h-4" />
            <span className="text-sm font-semibold">{section.label}</span>
          </button>
        ))}
      </div>

      {activeSection === 'overview' && (
        <>
          {/* Plot Header */}
          <div className="glass-card glow-border p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-2">Plot {plot.id}</h2>
                <div className="flex gap-2 flex-wrap">
                  <span className="px-2 py-1 bg-primary/20 rounded-lg text-xs text-primary">{plot.zoning}</span>
                  <span className={`px-2 py-1 rounded-lg text-xs ${
                    plot.status === 'Frozen' ? 'bg-destructive/20 text-destructive' :
                    plot.status === 'Available' ? 'bg-success/20 text-success' :
                    'bg-warning/20 text-warning'
                  }`}>{plot.status}</span>
                  {plot.developer && (
                    <span className="px-2 py-1 bg-secondary/20 rounded-lg text-xs text-secondary">{plot.developer}</span>
                  )}
                </div>
              </div>
              <div className="px-4 py-2 bg-gradient-to-r from-success to-emerald-400 rounded-xl font-bold text-background">
                {feasibility.roi}% ROI
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Area', value: `${plot.area.toFixed(0)}m²`, icon: Square },
                { label: 'GFA', value: `${plot.gfa.toFixed(0)}m²`, icon: Building2 },
                { label: 'Floors', value: plot.floors, icon: Layers },
                { label: 'Margin', value: `${feasibility.profitMargin}%`, icon: TrendingUp }
              ].map((stat) => (
                <div key={stat.label} className="data-card">
                  <div className="flex items-center gap-1 mb-1">
                    <stat.icon className="w-3 h-3 text-primary" />
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                  <div className="text-foreground font-bold text-sm">{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Cards */}
          <div className="space-y-3">
            {[
              { label: 'Total Revenue', value: feasibility.revenue, icon: DollarSign, colorClass: 'success' },
              { label: 'Construction Cost', value: feasibility.cost, icon: Building2, colorClass: 'warning' },
              { label: 'Net Profit', value: feasibility.profit, icon: TrendingUp, colorClass: 'primary' }
            ].map((item) => (
              <div 
                key={item.label} 
                className={`glass-card border-${item.colorClass}/30 p-4`}
                style={{ borderColor: `hsl(var(--${item.colorClass}) / 0.3)` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center`}
                    style={{ backgroundColor: `hsl(var(--${item.colorClass}) / 0.2)` }}>
                    <item.icon className="w-4 h-4 text-foreground" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground">AED {(item.value / 1000000).toFixed(2)}M</div>
                <div className="text-xs text-muted-foreground">≈ ${((item.value / 1000000) / 3.67).toFixed(2)}M USD</div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeSection === 'details' && (
        <div className="space-y-4">
          <div className="glass-card glow-border p-5">
            <h3 className="text-lg font-bold text-foreground mb-4">Plot Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Developer', value: plot.developer },
                { label: 'Project', value: plot.project },
                { label: 'Entity', value: plot.entity },
                { label: 'Max Height', value: plot.maxHeight ? `${plot.maxHeight}m` : plot.floors },
                { label: 'Plot Coverage', value: plot.plotCoverage ? `${plot.plotCoverage}%` : 'N/A' },
                { label: 'Land Use', value: plot.landUseDetails || plot.zoning }
              ].map((item) => (
                <div key={item.label}>
                  <span className="text-muted-foreground">{item.label}:</span>
                  <span className="text-foreground ml-2">{item.value || 'N/A'}</span>
                </div>
              ))}
            </div>
          </div>

          {plot.constructionStatus && (
            <div className="glass-card glow-border p-5">
              <h3 className="text-lg font-bold text-foreground mb-2">Construction Status</h3>
              <div className="text-foreground">{plot.constructionStatus}</div>
            </div>
          )}
        </div>
      )}

      {activeSection === 'risk' && (
        <div className="space-y-4">
          <div className="glass-card p-4" style={{ 
            backgroundColor: 'hsl(var(--secondary) / 0.1)',
            borderColor: 'hsl(var(--secondary) / 0.3)'
          }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-secondary">Investment Score</div>
                <div className="text-3xl font-bold text-foreground">{Math.round(feasibility.score)}/100</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-secondary">Risk Level</div>
                <div className={`text-2xl font-bold ${
                  feasibility.riskLevel === 'Low' ? 'text-success' :
                  feasibility.riskLevel === 'Medium' ? 'text-warning' : 'text-destructive'
                }`}>{feasibility.riskLevel}</div>
              </div>
            </div>

            <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-secondary to-accent transition-all duration-1000"
                style={{ width: `${Math.min(100, feasibility.score)}%` }}
              />
            </div>
          </div>

          <div className="glass-card glow-border p-5">
            <h3 className="text-lg font-bold text-foreground mb-3">Risk Assessment</h3>
            <div className="space-y-3">
              {[
                { label: 'Payback Period', value: `${feasibility.paybackPeriod} months` },
                { label: 'Profit Margin', value: `${feasibility.profitMargin}%` },
                { label: 'Plot Status', value: plot.status, highlight: true }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{item.label}:</span>
                  <span className={`font-semibold ${
                    item.highlight 
                      ? (plot.status === 'Frozen' ? 'text-destructive' :
                         plot.status === 'Available' ? 'text-success' : 'text-warning')
                      : 'text-foreground'
                  }`}>{item.value}</span>
                </div>
              ))}
              
              {plot.isFrozen && (
                <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <div className="text-destructive font-semibold mb-1">⚠️ Plot Frozen</div>
                  <div className="text-sm text-destructive/80">{plot.freezeReason || 'Reason not specified'}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button className="btn-primary flex items-center justify-center gap-2">
          <Download className="w-4 h-4" />
          Export
        </button>
        <button className="btn-secondary flex items-center justify-center gap-2">
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>
    </div>
  );
}
