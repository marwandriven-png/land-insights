import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { PlotData, calculateFeasibility } from '@/services/DDAGISService';

interface GISMapProps {
  plots: PlotData[];
  selectedPlot: PlotData | null;
  onPlotClick: (plot: PlotData) => void;
  highlightedPlots: string[];
}

const LEGEND_ITEMS = [
  { color: '#10b981', label: 'Residential Villa' },
  { color: '#ef4444', label: 'Residential Apartments' },
  { color: '#3b82f6', label: 'Commercial' },
  { color: '#8b5cf6', label: 'Mixed Use' },
  { color: '#f59e0b', label: 'Industrial' }
];

export function GISMap({ plots, selectedPlot, onPlotClick, highlightedPlots }: GISMapProps) {
  const [hoveredPlot, setHoveredPlot] = useState<PlotData | null>(null);

  return (
    <div className="relative w-full h-full glass-card glow-border overflow-hidden">
      {/* Grid Background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(hsl(var(--primary) / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Header Info */}
      <div className="absolute top-4 left-4 glass-card px-4 py-3 z-20">
        <div className="text-xs text-primary font-mono">DDA Coordinate System</div>
        <div className="text-primary text-sm font-bold">Dubai South Development</div>
      </div>

      {/* Plot Grid */}
      <div className="relative w-full h-full p-12">
        {plots.map((plot) => {
          const isSelected = selectedPlot?.id === plot.id;
          const isHighlighted = highlightedPlots.includes(plot.id);
          const isHovered = hoveredPlot?.id === plot.id;
          const feasibility = calculateFeasibility(plot);
          const size = Math.sqrt(plot.area) / 3.5;

          return (
            <div
              key={plot.id}
              onClick={() => onPlotClick(plot)}
              onMouseEnter={() => setHoveredPlot(plot)}
              onMouseLeave={() => setHoveredPlot(null)}
              className="absolute cursor-pointer transition-all duration-300"
              style={{
                left: `${plot.x}%`,
                top: `${plot.y}%`,
                width: `${size}px`,
                height: `${size}px`,
                transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                zIndex: isSelected ? 50 : isHovered ? 40 : 10
              }}
            >
              <div
                className="w-full h-full rounded-lg border-2 transition-all duration-300"
                style={{
                  backgroundColor: `${plot.color}${isHighlighted ? '60' : '40'}`,
                  borderColor: isSelected ? 'hsl(var(--warning))' : isHighlighted ? 'hsl(var(--primary))' : plot.color,
                  boxShadow: isSelected 
                    ? '0 0 30px hsla(38, 92%, 50%, 0.5)' 
                    : isHighlighted 
                      ? '0 0 20px hsla(187, 94%, 43%, 0.4)' 
                      : 'none'
                }}
              />

              {/* Hover Tooltip */}
              {isHovered && !isSelected && (
                <div className="absolute left-full ml-4 top-0 glass-card p-3 shadow-xl min-w-[220px] z-50">
                  <div className="text-foreground font-bold mb-1">{plot.id}</div>
                  <div className="text-xs text-muted-foreground mb-1">{plot.zoning}</div>
                  {plot.developer && (
                    <div className="text-xs text-primary mb-2">{plot.developer}</div>
                  )}
                  <div className="flex gap-2 text-xs">
                    <div className="data-card flex-1">
                      <div className="text-muted-foreground">Area</div>
                      <div className="text-foreground font-semibold">{plot.area.toFixed(0)}m²</div>
                    </div>
                    <div className="data-card flex-1">
                      <div className="text-muted-foreground">ROI</div>
                      <div className="text-success font-semibold">{feasibility.roi}%</div>
                    </div>
                  </div>
                  {plot.status === 'Frozen' && (
                    <div className="mt-2 px-2 py-1 bg-destructive/20 rounded text-xs text-destructive">
                      ⚠️ {plot.freezeReason || 'Plot is frozen'}
                    </div>
                  )}
                </div>
              )}

              {/* Selected Label */}
              {isSelected && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gradient-to-r from-warning to-orange-500 px-3 py-1 rounded-lg whitespace-nowrap">
                  <div className="text-background font-bold text-sm">{plot.id}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 glass-card p-3 z-20">
        <div className="text-xs text-primary font-bold mb-2">Legend</div>
        <div className="space-y-1.5 text-xs">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
              <span className="text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Statistics */}
      <div className="absolute bottom-4 right-4 glass-card p-3 z-20">
        <div className="text-xs text-primary font-bold mb-2">Statistics</div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Total</div>
            <div className="text-foreground font-bold text-lg">{plots.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Available</div>
            <div className="text-success font-bold text-lg">
              {plots.filter(p => p.status === 'Available').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
