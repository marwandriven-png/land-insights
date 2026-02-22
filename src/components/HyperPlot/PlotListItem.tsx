import { MapPin, Building2, Layers, Pencil, Trash2, Plus } from 'lucide-react';
import { PlotData, calculateFeasibility } from '@/services/DDAGISService';
import { Badge } from '@/components/ui/badge';
import { isPlotListed, isNewListing, markPlotListed } from '@/services/LandMatchingService';
import { toast } from '@/hooks/use-toast';

interface PlotListItemProps {
  plot: PlotData;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
  onEdit?: (plot: PlotData) => void;
  onDelete?: (plot: PlotData) => void;
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

export function PlotListItem({ plot, isSelected, isHighlighted, onClick, onEdit, onDelete }: PlotListItemProps) {
  const isManual = plot.verificationSource === 'Manual';
  const feasibility = calculateFeasibility(plot);
  const listed = isPlotListed(plot.id);
  const newListing = isNewListing(plot.id);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    markPlotListed(plot.id);
    toast({
      title: 'Added to Listing',
      description: `Plot ${plot.id} has been added to your listings.`,
    });
  };

  return (
    <div
      onClick={onClick}
      data-plot-id={plot.id}
      className={`p-3 rounded-xl cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'ring-2 ring-[hsl(217,91%,60%)] border border-[hsl(217,91%,60%)]/50 bg-[hsl(217,91%,60%)]/15 shadow-lg shadow-[hsl(217,91%,60%)]/10' 
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
          {listed && (
            <Badge className="bg-success/20 text-success border-success/30 text-[10px] px-1.5 py-0">
              Listing
            </Badge>
          )}
          {newListing && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0">
              New
            </Badge>
          )}
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

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{plot.zoning}</span>
        {isManual && (
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-400">Manual</Badge>
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(plot); }}
                className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(plot); }}
                className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Add to Listing */}
      {!listed && (
        <button
          onClick={handleQuickAdd}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Quick Add to Listing
        </button>
      )}
    </div>
  );
}