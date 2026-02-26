import { useState, useCallback } from 'react';
import { Search, Filter, X, ChevronDown, Loader2, MapPin } from 'lucide-react';
import { PlotData, gisService } from '@/services/DDAGISService';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SearchFiltersProps {
  plots: PlotData[];
  onSearch: (query: string) => void;
  onFilterChange: (filters: FilterState) => void;
  onPlotFound: (plot: PlotData) => void;
}

export interface FilterState {
  status: string[];
  zoning: string[];
  minArea: number | null;
  maxArea: number | null;
  minGFA: number | null;
  maxGFA: number | null;
}

const STATUS_OPTIONS = ['Available', 'Reserved', 'Under Construction', 'Completed', 'Frozen'];
const ZONING_OPTIONS = ['Residential Villa', 'Residential Apartments', 'Commercial', 'Industrial', 'Mixed Use'];

export function SearchFilters({ plots, onSearch, onFilterChange, onPlotFound }: SearchFiltersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    status: [],
    zoning: [],
    minArea: null,
    maxArea: null,
    minGFA: null,
    maxGFA: null
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSearchingLive, setIsSearchingLive] = useState(false);
  const [liveSearchResult, setLiveSearchResult] = useState<string | null>(null);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    onSearch(query);
    setLiveSearchResult(null);

    // Check for exact plot number match in loaded data
    if (query.trim()) {
      const exactMatch = plots.find(p =>
        p.id.toLowerCase() === query.toLowerCase().trim()
      );
      if (exactMatch) {
        onPlotFound(exactMatch);
      }
    }
  }, [plots, onSearch, onPlotFound]);

  // Live GIS lookup for plot number not in loaded data
  const handleLiveLookup = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) return;

    // First check loaded data
    const localMatch = plots.find(p =>
      p.id.toLowerCase() === query.toLowerCase()
    );
    if (localMatch) {
      onPlotFound(localMatch);
      setLiveSearchResult('found');
      return;
    }

    // Query DDA GIS API directly for this plot number
    setIsSearchingLive(true);
    setLiveSearchResult(null);
    try {
      const plot = await gisService.fetchPlotById(query);
      if (plot) {
        onPlotFound(plot);
        setLiveSearchResult('found');
      } else {
        setLiveSearchResult('not_found');
      }
    } catch {
      setLiveSearchResult('error');
    } finally {
      setIsSearchingLive(false);
    }
  }, [searchQuery, plots, onPlotFound]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLiveLookup();
    }
  }, [handleLiveLookup]);

  const updateFilters = useCallback((newFilters: Partial<FilterState>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    onFilterChange(updated);
  }, [filters, onFilterChange]);

  const toggleStatus = (status: string) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    updateFilters({ status: newStatus });
  };

  const toggleZoning = (zoning: string) => {
    const newZoning = filters.zoning.includes(zoning)
      ? filters.zoning.filter(z => z !== zoning)
      : [...filters.zoning, zoning];
    updateFilters({ zoning: newZoning });
  };

  const clearFilters = () => {
    const cleared: FilterState = {
      status: [],
      zoning: [],
      minArea: null,
      maxArea: null,
      minGFA: null,
      maxGFA: null
    };
    setFilters(cleared);
    onFilterChange(cleared);
    setSearchQuery('');
    onSearch('');
    setLiveSearchResult(null);
  };

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.zoning.length > 0 ||
    filters.minArea !== null ||
    filters.maxArea !== null ||
    filters.minGFA !== null ||
    filters.maxGFA !== null;

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by plot number, area name..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full pl-10 pr-20 py-2.5 bg-muted/50 border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searchQuery && !isSearchingLive && (
            <button
              onClick={() => handleSearch('')}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          {isSearchingLive && (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          )}
          {searchQuery && !isSearchingLive && (
            <button
              onClick={handleLiveLookup}
              className="p-1 hover:bg-primary/20 rounded text-primary"
              title="Search DDA GIS live"
            >
              <MapPin className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Live search result feedback */}
      {liveSearchResult === 'found' && (
        <div className="text-xs text-success flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3" />
            Plot found — zooming to location
          </div>
        </div>
      )}
      {liveSearchResult === 'not_found' && (
        <div className="text-xs text-warning flex items-center gap-1.5 px-1">
          <MapPin className="w-3 h-3" />
          Plot not found in DDA GIS database
        </div>
      )}
      {liveSearchResult === 'error' && (
        <div className="text-xs text-destructive flex items-center gap-1.5 px-1">
          <MapPin className="w-3 h-3" />
          Error connecting to GIS — try again
        </div>
      )}

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Status Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              Status
              {filters.status.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded">
                  {filters.status.length}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STATUS_OPTIONS.map((status) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={filters.status.includes(status)}
                onCheckedChange={() => toggleStatus(status)}
              >
                {status}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Zoning Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              Zoning
              {filters.zoning.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded">
                  {filters.zoning.length}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Filter by Zoning</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ZONING_OPTIONS.map((zoning) => (
              <DropdownMenuCheckboxItem
                key={zoning}
                checked={filters.zoning.includes(zoning)}
                onCheckedChange={() => toggleZoning(zoning)}
              >
                {zoning}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Advanced Filters Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="gap-1.5"
        >
          <Filter className="w-3.5 h-3.5" />
          Advanced
        </Button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-destructive hover:text-destructive"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="glass-card p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Min Area (m²)</label>
              <input
                type="number"
                placeholder="0"
                value={filters.minArea || ''}
                onChange={(e) => updateFilters({ minArea: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max Area (m²)</label>
              <input
                type="number"
                placeholder="10000"
                value={filters.maxArea || ''}
                onChange={(e) => updateFilters({ maxArea: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Min GFA (m²)</label>
              <input
                type="number"
                placeholder="0"
                value={filters.minGFA || ''}
                onChange={(e) => updateFilters({ minGFA: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max GFA (m²)</label>
              <input
                type="number"
                placeholder="20000"
                value={filters.maxGFA || ''}
                onChange={(e) => updateFilters({ maxGFA: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
