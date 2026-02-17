import { MapPin, Building2, Layers } from 'lucide-react';
import { PlotData, calculateFeasibility } from '@/services/DDAGISService';

interface PlotListItemProps {
  plot: PlotData;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'available':
      return 'text-success';
    case 'reserved':
    case 'under construction':
      return 'text-warning';
    case 'completed':
      return 'text-muted-foreground';
    case 'frozen':
      return 'text-destructive';
    default:
      return 'text-success';
  }
}

function getZoningColor(zoning: string): string {
  if (zoning.toLowerCase().includes('residential') && zoning.toLowerCase().includes('villa')) {
    return '#10b981';
  }
  if (zoning.toLowerCase().includes('residential')) {
    return '#ef4444';
  }
  if (zoning.toLowerCase().includes('commercial')) {
    return '#3b82f6';
  }
  if (zoning.toLowerCase().includes('industrial')) {
    return '#f59e0b';
  }
  return '#8b5cf6';
}

export function PlotListItem({ plot, isSelected, isHighlighted, onClick }: PlotListItemProps) {
  const feasibility = calculateFeasibility(plot);

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'bg-primary/20 border border-primary/50 shadow-lg' 
          : isHighlighted
            ? 'bg-muted/70 border border-primary/30'
            : 'bg-muted/30 border border-transparent hover:bg-muted/50 hover:border-border/50'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getZoningColor(plot.zoning) }}
          />
          <span className="font-bold text-base text-foreground">{plot.id}</span>
        </div>
        <span className={`text-sm font-medium ${getStatusColor(plot.status)}`}>
          {plot.status}
        </span>
      </div>

      <div className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
        <MapPin className="w-3.5 h-3.5" />
        <span className="truncate">{plot.location || plot.project || 'Dubai'}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-foreground">{plot.area.toLocaleString()}m²</span>
        </div>
        <div className="flex items-center gap-1">
          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-foreground">{plot.gfa.toLocaleString()}m²</span>
        </div>
        <div className="text-right">
          <span className="text-success font-medium">{feasibility.roi}% ROI</span>
        </div>
      </div>

      <div className="mt-2 text-sm">
        <span className="text-muted-foreground">{plot.zoning}</span>
      </div>
    </div>
  );
}
