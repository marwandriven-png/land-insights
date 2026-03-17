// src/components/HyperPlot/SearchFilters.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Drop-in replacement — adds Villa Intelligence filter panel (layout, position,
// back facing, amenity proximity, vastu) below the existing status/zoning bar.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback } from 'react';
import {
  Search, Filter, X, ChevronDown, Loader2, MapPin,
  Home, Navigation, TreePine, Compass
} from 'lucide-react';
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
import type { AmenityType } from '@/services/VillaIntelligenceEngine';

// ── Props ──────────────────────────────────────────────────────────────────────
interface SearchFiltersProps {
  plots: PlotData[];
  onSearch: (query: string) => void;
  onFilterChange: (filters: FilterState) => void;
  onPlotFound: (plot: PlotData) => void;
}

// ── FilterState — exported, consumed by index.tsx ──────────────────────────────
export interface FilterState {
  status:          string[];
  zoning:          string[];
  minArea:         number | null;
  maxArea:         number | null;
  minGFA:          number | null;
  maxGFA:          number | null;
  // ── Villa Intelligence ──────────────────────────────────────────────────────
  layoutType?:     'SingleRow' | 'BackToBack';
  position?:       'Corner' | 'EndUnit';
  backFacing?:     'Park' | 'Road' | 'OpenLand';
  vastuCompliant?: boolean;
  vastuDirection?: 'E' | 'N' | 'W' | 'S';
  nearAmenity?:    AmenityType[];
  maxAmenityDist?: number;
}

// ── Static lists ───────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ['Available', 'Reserved', 'Under Construction', 'Completed', 'Frozen'];
const ZONING_OPTIONS = ['Residential Villa', 'Residential Apartments', 'Commercial', 'Industrial', 'Mixed Use'];

const LAYOUT_PILLS = [
  { val: 'SingleRow'  as const, label: 'Single Row',   color: '#2ECC71', icon: '🏡' },
  { val: 'BackToBack' as const, label: 'Back-to-Back', color: '#FF5555', icon: '🏘️' },
];
const POSITION_PILLS = [
  { val: 'Corner'  as const, label: 'Corner',   color: '#FFB347', icon: '📐' },
  { val: 'EndUnit' as const, label: 'End Unit', color: '#BD93F9', icon: '↔️' },
];
const BACKFACING_PILLS = [
  { val: 'Park'     as const, label: 'Backs Park',      color: '#26E8C8', icon: '🌳' },
  { val: 'Road'     as const, label: 'Backs Road',      color: '#F1FA8C', icon: '🛣️' },
  { val: 'OpenLand' as const, label: 'Backs Open Land', color: '#FFB347', icon: '🏜️' },
];
const AMENITY_PILLS: { val: AmenityType; label: string }[] = [
  { val: 'park',       label: '🌳 Park'   },
  { val: 'pool',       label: '🏊 Pool'   },
  { val: 'school',     label: '🏫 School' },
  { val: 'mosque',     label: '🕌 Mosque' },
  { val: 'playground', label: '🛝 Play'   },
  { val: 'mall',       label: '🛍️ Mall'   },
  { val: 'golf',       label: '⛳ Golf'   },
  { val: 'gym',        label: '🏋️ Gym'    },
];
const VASTU_DIR_PILLS: { val: 'E'|'N'|'W'|'S'; label: string; rating: string; color: string }[] = [
  { val:'E', label:'East',  rating:'Excellent',  color:'#2ECC71' },
  { val:'N', label:'North', rating:'Good',       color:'#4F8EF7' },
  { val:'W', label:'West',  rating:'Neutral',    color:'#FFB347' },
  { val:'S', label:'South', rating:'Less Pref.', color:'#FF5555' },
];

// ── Pill component ─────────────────────────────────────────────────────────────
function Pill({
  active, color, onClick, children,
}: { active: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all duration-150 whitespace-nowrap"
      style={{
        background:  active ? `${color ?? '#4F8EF7'}28` : 'transparent',
        borderColor: active ? (color ?? '#4F8EF7') : 'rgba(255,255,255,0.10)',
        color:       active ? (color ?? '#4F8EF7') : 'hsl(var(--muted-foreground))',
      }}
    >
      {children}
    </button>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export function SearchFilters({ plots, onSearch, onFilterChange, onPlotFound }: SearchFiltersProps) {
  const [searchQuery, setSearchQuery]           = useState('');
  const [showAdvanced, setShowAdvanced]         = useState(false);
  const [showVilla, setShowVilla]               = useState(false);
  const [isSearchingLive, setIsSearchingLive]   = useState(false);
  const [liveResult, setLiveResult]             = useState<string | null>(null);
  const [filters, setFilters]                   = useState<FilterState>({
    status: [], zoning: [], minArea: null, maxArea: null, minGFA: null, maxGFA: null,
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const updateFilters = useCallback((patch: Partial<FilterState>) => {
    const next = { ...filters, ...patch };
    // Remove explicit undefineds so they don't shadow inherited defaults
    (Object.keys(patch) as (keyof FilterState)[]).forEach(k => {
      if ((patch as Record<string, unknown>)[k] === undefined) delete (next as Record<string, unknown>)[k];
    });
    setFilters(next as FilterState);
    onFilterChange(next as FilterState);
  }, [filters, onFilterChange]);

  function toggle<K extends keyof FilterState>(key: K, val: FilterState[K]) {
    updateFilters({ [key]: filters[key] === val ? undefined : val } as Partial<FilterState>);
  }

  const toggleAmenity = (val: AmenityType) => {
    const cur = filters.nearAmenity ?? [];
    updateFilters({ nearAmenity: cur.includes(val) ? cur.filter(a => a !== val) : [...cur, val] });
  };

  const toggleStatus = (s: string) =>
    updateFilters({ status: filters.status.includes(s) ? filters.status.filter(x => x !== s) : [...filters.status, s] });

  const toggleZoning = (z: string) =>
    updateFilters({ zoning: filters.zoning.includes(z) ? filters.zoning.filter(x => x !== z) : [...filters.zoning, z] });

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    onSearch(query);
    setLiveResult(null);
    if (query.trim()) {
      const exact = plots.find(p => p.id.toLowerCase() === query.toLowerCase().trim());
      if (exact) onPlotFound(exact);
    }
  }, [plots, onSearch, onPlotFound]);

  const handleLiveLookup = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    const local = plots.find(p => p.id.toLowerCase() === q.toLowerCase());
    if (local) { onPlotFound(local); setLiveResult('found'); return; }
    setIsSearchingLive(true);
    setLiveResult(null);
    try {
      const plot = await gisService.fetchPlotById(q);
      if (plot) { onPlotFound(plot); setLiveResult('found'); }
      else setLiveResult('not_found');
    } catch { setLiveResult('error'); }
    finally   { setIsSearchingLive(false); }
  }, [searchQuery, plots, onPlotFound]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const clearFilters = () => {
    const c: FilterState = { status:[], zoning:[], minArea:null, maxArea:null, minGFA:null, maxGFA:null };
    setFilters(c);
    onFilterChange(c);
    setSearchQuery('');
    onSearch('');
    setLiveResult(null);
  };

  const hasBaseFilters =
    filters.status.length > 0 || filters.zoning.length > 0 ||
    filters.minArea !== null   || filters.maxArea !== null  ||
    filters.minGFA  !== null   || filters.maxGFA  !== null;

  const hasVillaFilters =
    !!filters.layoutType || !!filters.position || !!filters.backFacing ||
    !!filters.vastuCompliant || !!filters.vastuDirection ||
    (filters.nearAmenity?.length ?? 0) > 0;

  const villaCount = [filters.layoutType, filters.position, filters.backFacing,
    filters.vastuCompliant, filters.vastuDirection].filter(Boolean).length
    + (filters.nearAmenity?.length ?? 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder='Plot number · "corner near park" · "single row vastu E"'
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLiveLookup()}
          className="w-full pl-10 pr-20 py-2.5 bg-muted/50 border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searchQuery && !isSearchingLive && (
            <button onClick={() => handleSearch('')} className="p-1 hover:bg-muted rounded">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          {isSearchingLive && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          {searchQuery && !isSearchingLive && (
            <button onClick={handleLiveLookup} className="p-1 hover:bg-primary/20 rounded text-primary" title="Search DDA GIS live">
              <MapPin className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {liveResult === 'found'     && <div className="text-xs text-success flex items-center gap-1.5 px-1"><MapPin className="w-3 h-3" /> Plot found — zooming to location</div>}
      {liveResult === 'not_found' && <div className="text-xs text-warning flex items-center gap-1.5 px-1"><MapPin className="w-3 h-3" /> Plot not found in DDA GIS</div>}
      {liveResult === 'error'     && <div className="text-xs text-destructive flex items-center gap-1.5 px-1"><MapPin className="w-3 h-3" /> GIS connection error — try again</div>}

      {/* Quick filter row */}
      <div className="flex flex-wrap gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-8">
              Status
              {filters.status.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded">{filters.status.length}</span>}
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STATUS_OPTIONS.map(s => (
              <DropdownMenuCheckboxItem key={s} checked={filters.status.includes(s)} onCheckedChange={() => toggleStatus(s)}>{s}</DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-8">
              Zoning
              {filters.zoning.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded">{filters.zoning.length}</span>}
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Filter by Zoning</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ZONING_OPTIONS.map(z => (
              <DropdownMenuCheckboxItem key={z} checked={filters.zoning.includes(z)} onCheckedChange={() => toggleZoning(z)}>{z}</DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" onClick={() => setShowAdvanced(v => !v)} className="gap-1.5 h-8">
          <Filter className="w-3.5 h-3.5" /> Advanced
        </Button>

        <Button
          variant="ghost" size="sm"
          onClick={() => setShowVilla(v => !v)}
          className={`gap-1.5 h-8 transition-colors ${showVilla || hasVillaFilters ? 'text-primary border border-primary/30 bg-primary/10' : ''}`}
        >
          <Home className="w-3.5 h-3.5" />
          Villa Intel
          {villaCount > 0 && <span className="ml-1 px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded font-bold">{villaCount}</span>}
        </Button>

        {(hasBaseFilters || hasVillaFilters) && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-destructive hover:text-destructive h-8">
            <X className="w-3.5 h-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Advanced area/GFA filters */}
      {showAdvanced && (
        <div className="glass-card p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Area & GFA</p>
          <div className="grid grid-cols-2 gap-3">
            {(['minArea','maxArea','minGFA','maxGFA'] as const).map(key => (
              <div key={key}>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {key === 'minArea' ? 'Min Area (m²)' : key === 'maxArea' ? 'Max Area (m²)' : key === 'minGFA' ? 'Min GFA (m²)' : 'Max GFA (m²)'}
                </label>
                <input
                  type="number"
                  placeholder={key.startsWith('min') ? '0' : '—'}
                  value={filters[key] ?? ''}
                  onChange={e => updateFilters({ [key]: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 bg-muted/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Villa Intelligence Panel */}
      {showVilla && (
        <div className="glass-card p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 border border-primary/20">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center">
                <Home className="w-3 h-3 text-primary" />
              </div>
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">Villa Intelligence</span>
            </div>
            {hasVillaFilters && (
              <button
                onClick={() => updateFilters({
                  layoutType: undefined, position: undefined, backFacing: undefined,
                  vastuCompliant: undefined, vastuDirection: undefined, nearAmenity: undefined,
                })}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear intel filters
              </button>
            )}
          </div>

          {/* Layout Type */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Home className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Layout Type</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {LAYOUT_PILLS.map(({ val, label, color, icon }) => (
                <Pill key={val} active={filters.layoutType === val} color={color} onClick={() => toggle('layoutType', val)}>
                  {icon} {label}
                </Pill>
              ))}
            </div>
            {filters.layoutType && (
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                {filters.layoutType === 'SingleRow'
                  ? '↳ Back does NOT face another villa — park / road / open land behind'
                  : '↳ Rear wall directly shared with another villa — no gap, no view behind'}
              </p>
            )}
          </div>

          <div className="border-t border-border/30" />

          {/* Position */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Navigation className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Position in Block</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {POSITION_PILLS.map(({ val, label, color, icon }) => (
                <Pill key={val} active={filters.position === val} color={color} onClick={() => toggle('position', val)}>
                  {icon} {label}
                </Pill>
              ))}
            </div>
            {filters.position && (
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                {filters.position === 'Corner'
                  ? '↳ 2+ sides face roads — extra garden space, wider exposure'
                  : '↳ End of a row — only 1 neighbour side, more windows'}
              </p>
            )}
          </div>

          <div className="border-t border-border/30" />

          {/* Back Facing */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TreePine className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Back Facing</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {BACKFACING_PILLS.map(({ val, label, color, icon }) => (
                <Pill key={val} active={filters.backFacing === val} color={color} onClick={() => toggle('backFacing', val)}>
                  {icon} {label}
                </Pill>
              ))}
            </div>
          </div>

          <div className="border-t border-border/30" />

          {/* Near Amenities */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Near Amenities</span>
              {(filters.nearAmenity?.length ?? 0) > 0 && (
                <span className="ml-auto text-[10px] text-primary font-semibold">within {filters.maxAmenityDist ?? 300}m</span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap mb-2">
              {AMENITY_PILLS.map(({ val, label }) => (
                <Pill key={val} active={filters.nearAmenity?.includes(val) ?? false} color="#4F8EF7" onClick={() => toggleAmenity(val)}>
                  {label}
                </Pill>
              ))}
            </div>
            {(filters.nearAmenity?.length ?? 0) > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Max distance from plot centroid</span>
                  <span className="text-[10px] font-bold text-primary">{filters.maxAmenityDist ?? 300}m</span>
                </div>
                <input
                  type="range" min={50} max={600} step={25}
                  value={filters.maxAmenityDist ?? 300}
                  onChange={e => updateFilters({ maxAmenityDist: Number(e.target.value) })}
                  className="w-full accent-primary h-1.5 rounded-full cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground/50">
                  <span>50m · Very Close</span><span>120m · Near</span><span>250m · Walkable</span><span>600m</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border/30" />

          {/* Vastu */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Compass className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Vastu Orientation</span>
            </div>
            <div className="flex gap-2 flex-wrap mb-2">
              <Pill
                active={!!filters.vastuCompliant}
                color="#FF79C6"
                onClick={() => updateFilters({ vastuCompliant: filters.vastuCompliant ? undefined : true, vastuDirection: undefined })}
              >
                ✅ Vastu Compliant (E + N)
              </Pill>
            </div>
            <div className="flex gap-2 flex-wrap">
              {VASTU_DIR_PILLS.map(({ val, label, rating, color }) => (
                <Pill
                  key={val}
                  active={filters.vastuDirection === val}
                  color={color}
                  onClick={() => updateFilters({
                    vastuDirection: filters.vastuDirection === val ? undefined : val,
                    vastuCompliant: undefined,
                  })}
                >
                  🧭 {label} <span style={{ opacity:0.55 }}>· {rating}</span>
                </Pill>
              ))}
            </div>
          </div>

          {/* Active filter summary chips */}
          {hasVillaFilters && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5">
              <p className="text-[10px] font-bold text-primary uppercase tracking-wide mb-1.5">Active Intel Filters</p>
              <div className="flex flex-wrap gap-1">
                {filters.layoutType && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {filters.layoutType === 'SingleRow' ? '🏡 Single Row' : '🏘️ Back-to-Back'}
                    <button onClick={() => toggle('layoutType', filters.layoutType!)}><X className="w-2.5 h-2.5" /></button>
                  </span>
                )}
                {filters.position && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    {filters.position === 'Corner' ? '📐 Corner' : '↔️ End Unit'}
                    <button onClick={() => toggle('position', filters.position!)}><X className="w-2.5 h-2.5" /></button>
                  </span>
                )}
                {filters.backFacing && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    {filters.backFacing === 'Park' ? '🌳 Backs Park' : filters.backFacing === 'Road' ? '🛣️ Backs Road' : '🏜️ Open Land'}
                    <button onClick={() => toggle('backFacing', filters.backFacing!)}><X className="w-2.5 h-2.5" /></button>
                  </span>
                )}
                {filters.vastuCompliant && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                    ✅ Vastu
                    <button onClick={() => updateFilters({ vastuCompliant: undefined })}><X className="w-2.5 h-2.5" /></button>
                  </span>
                )}
                {filters.vastuDirection && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                    🧭 {({ E:'East', N:'North', W:'West', S:'South' } as Record<string,string>)[filters.vastuDirection]} Facing
                    <button onClick={() => updateFilters({ vastuDirection: undefined })}><X className="w-2.5 h-2.5" /></button>
                  </span>
                )}
                {(filters.nearAmenity ?? []).map(a => (
                  <span key={a} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Near {a}
                    <button onClick={() => toggleAmenity(a)}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
