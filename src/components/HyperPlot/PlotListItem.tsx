import { MapPin, Building2, Layers, Pencil, Trash2, Plus } from 'lucide-react';
import { PlotData, calculateFeasibility } from '@/services/DDAGISService';
import { Badge } from '@/components/ui/badge';
import type { VillaIntelTags } from '@/services/VillaIntelligenceEngine';

interface PlotListItemProps {
  plot: PlotData;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
  onEdit?: (plot: PlotData) => void;
  onDelete?: (plot: PlotData) => void;
  onQuickAdd?: () => void;
  villaIntel?: VillaIntelTags;
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'available':      return 'text-success';
    case 'reserved':
    case 'under construction': return 'text-warning';
    case 'completed':      return 'text-muted-foreground';
    case 'frozen':         return 'text-destructive';
    default:               return 'text-success';
  }
}

function getZoningColor(zoning: string): string {
  const z = zoning.toLowerCase();
  if (z.includes('residential') && z.includes('villa')) return '#10b981';
  if (z.includes('residential'))  return '#ef4444';
  if (z.includes('commercial'))   return '#3b82f6';
  if (z.includes('industrial'))   return '#f59e0b';
  return '#8b5cf6';
}

// Villa intel tag colours
const TAG_COLORS: Record<string, string> = {
  'Single Row':       '#2ECC71',
  'Back-to-Back':     '#FF5555',
  'Corner':           '#FFB347',
  'End Unit':         '#BD93F9',
  'Backs Park':       '#26E8C8',
  'Backs Road':       '#F1FA8C',
  'Backs Open Land':  '#FFB347',
  'Vastu ✓':         '#FF79C6',
};
function tagColor(tag: string): string {
  if (TAG_COLORS[tag]) return TAG_COLORS[tag];
  if (tag.includes('Facing'))  return '#FF79C6';
  if (tag.includes('m)'))      return '#26E8C8';   // amenity distance tag
  return '#4F8EF7';
}

export function PlotListItem({
  plot, isSelected, isHighlighted, onClick,
  onEdit, onDelete, onQuickAdd, villaIntel,
}: PlotListItemProps) {
  const isManual   = plot.verificationSource === 'Manual';
  const feasibility = calculateFeasibility(plot);
  // Show max 4 smart tags in the list card
  const displayTags = villaIntel?.smartTags.slice(0, 4) ?? [];

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
      {/* Header row */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getZoningColor(plot.zoning) }} />
          <span className="font-bold text-base text-foreground leading-none">{plot.id}</span>
        </div>
        <span className={`text-sm font-medium ${getStatusColor(plot.status)}`}>{plot.status}</span>
      </div>

      {/* Location */}
      <div className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{plot.location || plot.project || 'Dubai'}</span>
      </div>

      {/* Area / GFA / ROI row */}
      <div className="grid grid-cols-3 gap-2 text-sm mb-2">
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

      {/* Villa Intelligence smart tags */}
      {displayTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {displayTags.map(tag => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[10px] font-bold border"
              style={{
                background:  `${tagColor(tag)}18`,
                color:        tagColor(tag),
                borderColor: `${tagColor(tag)}35`,
              }}
            >
              {tag}
            </span>
          ))}
          {(villaIntel?.smartTags.length ?? 0) > 4 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-border/40 text-muted-foreground">
              +{(villaIntel?.smartTags.length ?? 0) - 4}
            </span>
          )}
        </div>
      )}

      {/* Footer: zoning + actions */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground truncate">{plot.zoning}</span>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {isManual && (
            <>
              <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Manual</Badge>
              {onEdit && (
                <button
                  onClick={e => { e.stopPropagation(); onEdit(plot); }}
                  className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={e => { e.stopPropagation(); onDelete(plot); }}
                  className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
          {onQuickAdd && (
            <button
              onClick={e => { e.stopPropagation(); onQuickAdd(); }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold hover:bg-primary/25 transition-colors"
              title="Quick Add to Listing"
            >
              <Plus className="w-3 h-3" />
              List
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
