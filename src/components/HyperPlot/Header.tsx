import { Search, Zap, Loader2, Wifi, WifiOff } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoadingGIS: boolean;
  gisConnected: boolean;
  onRefresh: () => void;
}

export function Header({ searchQuery, onSearchChange, isLoadingGIS, gisConnected, onRefresh }: HeaderProps) {
  return (
    <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-glow"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))' }}>
              <Zap className="w-5 h-5 text-background" />
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">
                HyperPlot AI
              </h1>
              <p className="text-[10px] text-muted-foreground">DDA GIS Integrated Platform</p>
            </div>
          </div>

          {/* Search and Status */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search plots, developers, projects..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-4 py-2 bg-muted/50 border border-border/50 rounded-xl text-sm text-foreground w-72 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <button
              onClick={onRefresh}
              disabled={isLoadingGIS}
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
                gisConnected
                  ? 'bg-success/20 text-success hover:bg-success/30'
                  : 'btn-primary'
              }`}
            >
              {isLoadingGIS ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading</span>
                </>
              ) : gisConnected ? (
                <>
                  <Wifi className="w-4 h-4" />
                  <span>Live GIS</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4" />
                  <span>Connect GIS</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
