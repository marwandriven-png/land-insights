import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { PlotData, calculateFeasibility } from '@/services/DDAGISService';

interface PlotsListProps {
  plots: PlotData[];
  selectedPlot: PlotData | null;
  onPlotSelect: (plot: PlotData) => void;
}

export function PlotsList({ plots, selectedPlot, onPlotSelect }: PlotsListProps) {
  const [sortBy, setSortBy] = useState('roi');
  const [filterStatus, setFilterStatus] = useState('all');

  const sortedAndFilteredPlots = plots
    .filter(plot => filterStatus === 'all' || plot.status === filterStatus)
    .sort((a, b) => {
      const feasibilityA = calculateFeasibility(a);
      const feasibilityB = calculateFeasibility(b);

      switch (sortBy) {
        case 'roi': return feasibilityB.roi - feasibilityA.roi;
        case 'area': return b.area - a.area;
        case 'price': return feasibilityB.revenue - feasibilityA.revenue;
        default: return 0;
      }
    });

  return (
    <div className="space-y-4">
      {/* Filters and Sort */}
      <div className="flex gap-2">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="flex-1 bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="roi">Sort by ROI</option>
          <option value="area">Sort by Area</option>
          <option value="price">Sort by Revenue</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="flex-1 bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">All Status</option>
          <option value="Available">Available</option>
          <option value="Under Construction">Under Construction</option>
          <option value="Completed">Completed</option>
          <option value="Frozen">Frozen</option>
        </select>
      </div>

      {/* Plot Cards */}
      <div className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto scrollbar-thin pr-1">
        {sortedAndFilteredPlots.map((plot) => {
          const feasibility = calculateFeasibility(plot);
          const isSelected = selectedPlot?.id === plot.id;

          return (
            <div
              key={plot.id}
              onClick={() => onPlotSelect(plot)}
              className={`glass-card p-3 cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
                isSelected ? 'ring-2 ring-primary shadow-lg' : ''
              }`}
              style={{
                boxShadow: isSelected ? 'var(--shadow-glow-cyan)' : undefined
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${plot.color}40`, border: `2px solid ${plot.color}` }}
                >
                  <MapPin className="w-6 h-6" style={{ color: plot.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-foreground font-bold text-sm truncate">{plot.id}</div>
                  <div className="text-xs text-muted-foreground truncate">{plot.zoning}</div>
                  {plot.developer && (
                    <div className="text-xs text-primary truncate">{plot.developer}</div>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="px-2 py-1 bg-success/20 rounded-lg text-sm font-bold text-success">
                    {feasibility.roi}%
                  </div>
                  <div className={`text-xs mt-1 ${
                    plot.status === 'Frozen' ? 'text-destructive' :
                    plot.status === 'Available' ? 'text-success' : 'text-warning'
                  }`}>
                    {plot.status}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 text-xs mb-2">
                <div className="data-card py-1.5">
                  <div className="text-muted-foreground">Area</div>
                  <div className="text-foreground font-semibold">{plot.area.toFixed(0)}m²</div>
                </div>
                <div className="data-card py-1.5">
                  <div className="text-muted-foreground">GFA</div>
                  <div className="text-foreground font-semibold">{plot.gfa.toFixed(0)}m²</div>
                </div>
                <div className="data-card py-1.5">
                  <div className="text-muted-foreground">Floors</div>
                  <div className="text-foreground font-semibold">{plot.floors}</div>
                </div>
              </div>

              {/* Score Bar */}
              <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${feasibility.score}%`,
                    background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)))'
                  }}
                />
              </div>
            </div>
          );
        })}

        {sortedAndFilteredPlots.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No plots match your criteria
          </div>
        )}
      </div>
    </div>
  );
}
