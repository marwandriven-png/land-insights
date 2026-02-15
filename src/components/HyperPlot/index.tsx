import { useState, useEffect, useCallback, useMemo } from 'react';
import { Map, Home, BarChart3, Brain, AlertCircle, X, RefreshCw, Wifi, WifiOff, Target, Clock } from 'lucide-react';
import { addLastSeen, getLastSeen, LastSeenEntry } from '@/services/LastSeenService';
import { gisService, PlotData, generateDemoPlots } from '@/services/DDAGISService';
import { Header } from './Header';
import { LeafletMap } from './LeafletMap';
import { FeasibilityPanel } from './FeasibilityPanel';
import { AIAssistant } from './AIAssistant';
import { PlotDetailPanel } from './PlotDetailPanel';
import { SearchFilters, FilterState } from './SearchFilters';
import { PlotListItem } from './PlotListItem';
import { LandMatchingWizard } from './LandMatchingWizard';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const TABS = [
  { id: 'map', icon: Map, label: 'Map' },
  { id: 'feasibility', icon: BarChart3, label: 'Analysis' },
  { id: 'properties', icon: Home, label: 'List' },
  { id: 'ai', icon: Brain, label: 'AI' },
];

export function HyperPlotAI() {
  const [activeTab, setActiveTab] = useState('map');
  const [selectedPlot, setSelectedPlot] = useState<PlotData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedPlots, setHighlightedPlots] = useState<string[]>([]);
  const [plots, setPlots] = useState<PlotData[]>([]);
  const [isLoadingGIS, setIsLoadingGIS] = useState(false);
  const [gisConnected, setGisConnected] = useState(false);
  const [gisError, setGisError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [lastSeen, setLastSeen] = useState<LastSeenEntry[]>(getLastSeen());
  const [filters, setFilters] = useState<FilterState>({
    status: [],
    zoning: [],
    minArea: null,
    maxArea: null,
    minGFA: null,
    maxGFA: null
  });

  useEffect(() => {
    loadGISData();
  }, []);

  async function loadGISData() {
    setIsLoadingGIS(true);
    setGisError(null);
    setLoadProgress(0);

    try {
      const isConnected = await gisService.testConnection();
      setGisConnected(isConnected);

      if (!isConnected) {
        throw new Error('Unable to connect to DDA GIS services');
      }

      const progressInterval = setInterval(() => {
        setLoadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // Fetch more plots for better coverage
      const gisPlots = await gisService.fetchPlots(500);

      clearInterval(progressInterval);
      setLoadProgress(100);

      if (gisPlots && gisPlots.length > 0) {
        setPlots(gisPlots);
      } else {
        throw new Error('No plot data received from GIS service');
      }

      setTimeout(() => setLoadProgress(0), 500);
    } catch (error) {
      console.error('Failed to load GIS data:', error);
      setGisError(error instanceof Error ? error.message : 'Unknown error');
      setGisConnected(false);

      const demoPlots = generateDemoPlots();
      setPlots(demoPlots);
    } finally {
      setIsLoadingGIS(false);
    }
  }

  // Filter plots based on search and filters
  const filteredPlots = useMemo(() => {
    return plots.filter(plot => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          plot.id.toLowerCase().includes(query) ||
          plot.zoning.toLowerCase().includes(query) ||
          (plot.developer && plot.developer.toLowerCase().includes(query)) ||
          (plot.project && plot.project.toLowerCase().includes(query)) ||
          (plot.location && plot.location.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(plot.status)) {
        return false;
      }

      // Zoning filter
      if (filters.zoning.length > 0 && !filters.zoning.includes(plot.zoning)) {
        return false;
      }

      // Area filters (with 2% tolerance)
      if (filters.minArea !== null) {
        const minWithTolerance = filters.minArea * 0.98;
        if (plot.area < minWithTolerance) return false;
      }
      if (filters.maxArea !== null) {
        const maxWithTolerance = filters.maxArea * 1.02;
        if (plot.area > maxWithTolerance) return false;
      }

      // GFA filters
      if (filters.minGFA !== null && plot.gfa < filters.minGFA) return false;
      if (filters.maxGFA !== null && plot.gfa > filters.maxGFA) return false;

      return true;
    });
  }, [plots, searchQuery, filters]);

  // Update highlighted plots when search/filter changes
  useEffect(() => {
    if (searchQuery || filters.status.length > 0 || filters.zoning.length > 0) {
      setHighlightedPlots(filteredPlots.map(p => p.id));
    } else {
      setHighlightedPlots([]);
    }
  }, [searchQuery, filters, filteredPlots]);

  const saveLastSeen = useCallback((plot: PlotData) => {
    // Only save if coordinates are valid (non-zero)
    if (plot.x === 0 && plot.y === 0) return;
    addLastSeen({
      plotId: plot.id,
      plotName: plot.project || plot.id,
      location: plot.location || '',
      coordinates: { x: plot.x, y: plot.y },
      area: plot.area,
      gfa: plot.gfa,
      zoning: plot.zoning,
      status: plot.status,
    });
    setLastSeen(getLastSeen());
  }, []);

  const handlePlotClick = useCallback((plot: PlotData) => {
    setSelectedPlot(plot);
    setShowDetailPanel(true);
    saveLastSeen(plot);
  }, [saveLastSeen]);

  const handlePlotFound = useCallback((plot: PlotData) => {
    setSelectedPlot(plot);
    setShowDetailPanel(true);
    setActiveTab('map');
    saveLastSeen(plot);
  }, [saveLastSeen]);

  const handleCloseDetailPanel = useCallback(() => {
    setShowDetailPanel(false);
  }, []);

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl shrink-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Map className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold gradient-text">HyperPlot AI</h1>
                <p className="text-xs text-muted-foreground">DDA GIS Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Connection Status */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                gisConnected 
                  ? 'bg-success/20 text-success border border-success/30' 
                  : 'bg-warning/20 text-warning border border-warning/30'
              }`}>
                {gisConnected ? (
                  <>
                    <Wifi className="w-3.5 h-3.5" />
                    Live Data
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5" />
                    Demo Mode
                  </>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWizard(true)}
                className="gap-2"
              >
                <Target className="w-4 h-4" />
                Matching Wizard
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={loadGISData}
                disabled={isLoadingGIS}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingGIS ? 'animate-spin' : ''}`} />
                {isLoadingGIS ? 'Loading...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      {isLoadingGIS && loadProgress > 0 && (
        <div className="bg-card/50 border-b border-border/50">
          <div className="container mx-auto px-6 py-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted/50 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${loadProgress}%`,
                    background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)))'
                  }}
                />
              </div>
              <span className="text-xs text-primary font-mono">{loadProgress}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {gisError && (
        <div className="bg-warning/10 border-b border-warning/30">
          <div className="container mx-auto px-6 py-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-warning" />
              <span className="text-warning">{gisError} - Using demo data</span>
            </div>
            <button onClick={() => setGisError(null)} className="text-warning hover:text-warning/80">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-4 flex-1 min-h-0 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 h-full overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="col-span-1 space-y-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full p-3 rounded-xl flex flex-col items-center gap-1.5 transition-all ${
                  activeTab === tab.id
                    ? 'shadow-lg'
                    : 'bg-muted/30 hover:bg-muted/50'
                }`}
                style={activeTab === tab.id ? {
                  background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))'
                } : undefined}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Main Panel */}
          <div className="col-span-7 relative h-full overflow-hidden">
            {activeTab === 'map' && (
              <div className="h-full glass-card glow-border overflow-hidden">
                <LeafletMap
                  plots={filteredPlots}
                  selectedPlot={selectedPlot}
                  onPlotClick={handlePlotClick}
                  highlightedPlots={highlightedPlots}
                />
              </div>
            )}
            {activeTab === 'feasibility' && selectedPlot ? (
              <FeasibilityPanel plot={selectedPlot} />
            ) : activeTab === 'feasibility' ? (
              <div className="h-full flex items-center justify-center glass-card glow-border">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <h3 className="text-lg font-bold mb-1">Select a Plot</h3>
                  <p className="text-sm text-muted-foreground">Choose from the list to view analysis</p>
                </div>
              </div>
            ) : null}
            {activeTab === 'properties' && (
              <div className="h-full glass-card glow-border p-4">
                <h2 className="text-lg font-bold mb-4">All Properties ({filteredPlots.length})</h2>
                <ScrollArea className="h-[calc(100%-3rem)]">
                  <div className="space-y-2 pr-2">
                    {filteredPlots.map(plot => (
                      <PlotListItem
                        key={plot.id}
                        plot={plot}
                        isSelected={selectedPlot?.id === plot.id}
                        isHighlighted={highlightedPlots.includes(plot.id)}
                        onClick={() => handlePlotClick(plot)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            {activeTab === 'ai' && (
              <AIAssistant plots={filteredPlots} selectedPlot={selectedPlot} onSelectPlot={handlePlotClick} />
            )}

            {/* Floating Detail Panel */}
            {showDetailPanel && selectedPlot && (
              <PlotDetailPanel
                plot={selectedPlot}
                onClose={handleCloseDetailPanel}
              />
            )}
          </div>

          {/* Right Sidebar - Search & Plots List */}
          <div className="col-span-4 glass-card glow-border p-4 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm">Available Plots</h3>
                <p className="text-xs text-muted-foreground">
                  {gisConnected ? 'Live DDA GIS Data' : 'Demo Mode'} • {filteredPlots.length} plots
                </p>
              </div>
              <div className="px-2 py-1 bg-primary/20 rounded text-xs font-bold text-primary">
                {filteredPlots.length}
              </div>
            </div>

            {/* Search & Filters */}
            <SearchFilters
              plots={plots}
              onSearch={setSearchQuery}
              onFilterChange={setFilters}
              onPlotFound={handlePlotFound}
            />

            {/* Plots List */}
            <ScrollArea className="flex-1 mt-4">
              <div className="space-y-2 pr-2">
                {/* Last Seen Section */}
                {lastSeen.length > 0 && !searchQuery && filters.status.length === 0 && filters.zoning.length === 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Last Seen</span>
                    </div>
                    {lastSeen.slice(0, 5).map(entry => {
                      const matchedPlot = plots.find(p => p.id === entry.plotId);
                      return (
                        <button
                          key={entry.plotId}
                          onClick={() => matchedPlot && handlePlotClick(matchedPlot)}
                          className={`w-full text-left mb-1.5 px-3 py-2 rounded-lg border transition-all text-xs ${
                            matchedPlot ? 'border-border/50 bg-muted/20 hover:bg-muted/40 cursor-pointer' : 'border-border/30 bg-muted/10 opacity-60 cursor-default'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">{entry.plotId}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-muted-foreground mt-0.5">
                            {entry.location} • {entry.area.toLocaleString()} m²
                          </div>
                        </button>
                      );
                    })}
                    <div className="border-b border-border/30 mt-2 mb-1" />
                  </div>
                )}

                {filteredPlots.slice(0, 50).map(plot => (
                  <PlotListItem
                    key={plot.id}
                    plot={plot}
                    isSelected={selectedPlot?.id === plot.id}
                    isHighlighted={highlightedPlots.includes(plot.id)}
                    onClick={() => handlePlotClick(plot)}
                  />
                ))}
                {filteredPlots.length > 50 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Showing 50 of {filteredPlots.length} plots. Use filters to narrow down.
                  </div>
                )}
                {filteredPlots.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Map className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No plots match your criteria</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Land Matching Wizard */}
      <LandMatchingWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        plots={plots}
        onHighlightPlots={setHighlightedPlots}
        onSelectPlot={(plot) => {
          setSelectedPlot(plot);
          setShowDetailPanel(true);
          setActiveTab('map');
        }}
      />
    </div>
  );
}
