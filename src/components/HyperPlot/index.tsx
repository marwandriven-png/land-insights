import { useState, useEffect } from 'react';
import { Map, Home, BarChart3, Brain, Target, AlertCircle, X } from 'lucide-react';
import { gisService, PlotData, generateDemoPlots } from '@/services/DDAGISService';
import { Header } from './Header';
import { GISMap } from './GISMap';
import { FeasibilityPanel } from './FeasibilityPanel';
import { PlotsList } from './PlotsList';
import { AIAssistant } from './AIAssistant';

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

      const gisPlots = await gisService.fetchPlots(null, 100);

      clearInterval(progressInterval);
      setLoadProgress(100);

      if (gisPlots && gisPlots.length > 0) {
        setPlots(gisPlots);
        setSelectedPlot(gisPlots[0]);
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
      setSelectedPlot(demoPlots[0]);
    } finally {
      setIsLoadingGIS(false);
    }
  }

  useEffect(() => {
    if (searchQuery) {
      const filtered = plots
        .filter(p =>
          p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.zoning.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.developer && p.developer.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (p.project && p.project.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .map(p => p.id);
      setHighlightedPlots(filtered);
    } else {
      setHighlightedPlots([]);
    }
  }, [searchQuery, plots]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isLoadingGIS={isLoadingGIS}
        gisConnected={gisConnected}
        onRefresh={loadGISData}
      />

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
      <div className="container mx-auto px-6 py-4">
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-140px)]">
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
          <div className="col-span-7">
            {activeTab === 'map' && (
              <GISMap
                plots={plots}
                selectedPlot={selectedPlot}
                onPlotClick={setSelectedPlot}
                highlightedPlots={highlightedPlots}
              />
            )}
            {activeTab === 'feasibility' && selectedPlot ? (
              <FeasibilityPanel plot={selectedPlot} />
            ) : activeTab === 'feasibility' ? (
              <div className="h-full flex items-center justify-center glass-card glow-border">
                <div className="text-center">
                  <Target className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <h3 className="text-lg font-bold mb-1">Select a Plot</h3>
                  <p className="text-sm text-muted-foreground">Choose from the list to view analysis</p>
                </div>
              </div>
            ) : null}
            {activeTab === 'properties' && (
              <div className="h-full glass-card glow-border p-4">
                <h2 className="text-lg font-bold mb-4">All Properties</h2>
                <PlotsList plots={plots} selectedPlot={selectedPlot} onPlotSelect={setSelectedPlot} />
              </div>
            )}
            {activeTab === 'ai' && (
              <AIAssistant plots={plots} selectedPlot={selectedPlot} onSelectPlot={setSelectedPlot} />
            )}
          </div>

          {/* Right Sidebar - Plot List */}
          <div className="col-span-4 glass-card glow-border p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm">Available Plots</h3>
                <p className="text-xs text-muted-foreground">
                  {gisConnected ? 'Live DDA GIS Data' : 'Demo Mode'}
                </p>
              </div>
              <div className="px-2 py-1 bg-primary/20 rounded text-xs font-bold text-primary">
                {plots.length}
              </div>
            </div>

            <PlotsList plots={plots} selectedPlot={selectedPlot} onPlotSelect={setSelectedPlot} />
          </div>
        </div>
      </div>
    </div>
  );
}
