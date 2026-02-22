import { useState, useMemo, useCallback } from 'react';
import { Search, Plus, Link2, Pencil, Trash2, Check, X } from 'lucide-react';
import { PlotData } from '@/services/DDAGISService';
import { isPlotListed, isNewListing, getListedPlotIds, unlistPlot } from '@/services/LandMatchingService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';

interface ListingsPageProps {
  plots: PlotData[];
  onSelectPlot?: (plot: PlotData) => void;
  onAddLand?: () => void;
  onSyncSheet?: () => void;
}

const SQM_TO_SQFT = 10.7639;

const STATUS_OPTIONS = ['Available', 'Under Offer', 'Sold', 'Rented', 'Reserved', 'Frozen', 'Under Construction'];

function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case 'available': return 'bg-success/20 text-success border-success/30';
    case 'sold':
    case 'rented': return 'bg-muted/50 text-muted-foreground border-border/50';
    case 'under offer':
    case 'reserved':
    case 'under construction': return 'bg-warning/20 text-warning border-warning/30';
    case 'frozen': return 'bg-destructive/20 text-destructive border-destructive/30';
    default: return 'bg-muted/50 text-muted-foreground border-border/50';
  }
}

interface EditingState {
  plotId: string;
  owner: string;
  contact: string;
  status: string;
}

export function ListingsPage({ plots, onSelectPlot, onAddLand, onSyncSheet }: ListingsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Record<string, { owner?: string; contact?: string; status?: string }>>(() => {
    try {
      const stored = localStorage.getItem('hyperplot_listing_overrides');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [, forceUpdate] = useState(0);

  const saveOverrides = useCallback((overrides: typeof localOverrides) => {
    setLocalOverrides(overrides);
    localStorage.setItem('hyperplot_listing_overrides', JSON.stringify(overrides));
  }, []);

  const listedPlotIds = useMemo(() => getListedPlotIds(), []);

  const listedPlots = useMemo(() => {
    return plots.filter(p => listedPlotIds.has(p.id));
  }, [plots, listedPlotIds]);

  const filteredPlots = useMemo(() => {
    return listedPlots.filter(plot => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const override = localOverrides[plot.id];
        const matches =
          plot.id.toLowerCase().includes(q) ||
          (plot.location || '').toLowerCase().includes(q) ||
          (override?.owner || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      const effectiveStatus = localOverrides[plot.id]?.status || plot.status;
      if (statusFilter !== 'all' && effectiveStatus.toLowerCase() !== statusFilter.toLowerCase()) return false;
      return true;
    });
  }, [listedPlots, searchQuery, statusFilter, localOverrides]);

  const statuses = useMemo(() => [...new Set(listedPlots.map(p => localOverrides[p.id]?.status || p.status))], [listedPlots, localOverrides]);

  function getOwner(plot: PlotData) {
    if (localOverrides[plot.id]?.owner) return localOverrides[plot.id].owner;
    const raw = plot.rawAttributes as Record<string, any> | undefined;
    const affection = raw?._affectionPlan;
    const sheetMeta = raw?._sheetMetadata;
    return affection?.ownerName || raw?.ownerName || sheetMeta?.['name'] || sheetMeta?.['owner'] || sheetMeta?.['owner name'] || '—';
  }

  function getContact(plot: PlotData) {
    if (localOverrides[plot.id]?.contact) return localOverrides[plot.id].contact;
    const raw = plot.rawAttributes as Record<string, any> | undefined;
    const sheetMeta = raw?._sheetMetadata;
    return sheetMeta?.['mobile'] || sheetMeta?.['phone'] || sheetMeta?.['contact'] || sheetMeta?.['phone number'] || sheetMeta?.['contact number'] || '—';
  }

  function getStatus(plot: PlotData) {
    return localOverrides[plot.id]?.status || plot.status;
  }

  function startEdit(plot: PlotData) {
    setEditing({
      plotId: plot.id,
      owner: getOwner(plot) === '—' ? '' : getOwner(plot)!,
      contact: getContact(plot) === '—' ? '' : getContact(plot)!,
      status: getStatus(plot),
    });
  }

  function saveEdit() {
    if (!editing) return;
    const newOverrides = {
      ...localOverrides,
      [editing.plotId]: {
        owner: editing.owner || undefined,
        contact: editing.contact || undefined,
        status: editing.status,
      },
    };
    saveOverrides(newOverrides);
    setEditing(null);
    toast({ title: 'Updated', description: `Listing ${editing.plotId} updated.` });
  }

  function handleDelete(plotId: string) {
    if (!window.confirm(`Remove ${plotId} from listings?`)) return;
    unlistPlot(plotId);
    const newOverrides = { ...localOverrides };
    delete newOverrides[plotId];
    saveOverrides(newOverrides);
    forceUpdate(n => n + 1);
    toast({ title: 'Removed', description: `${plotId} removed from listings.` });
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Listings</h2>
          <p className="text-sm text-muted-foreground">{listedPlots.length} total listings</p>
        </div>
        <div className="flex items-center gap-2">
          {onSyncSheet && (
            <Button variant="outline" size="sm" onClick={onSyncSheet} className="gap-2">
              <Link2 className="w-4 h-4" />
              Sync Sheet
            </Button>
          )}
          {onAddLand && (
            <Button size="sm" onClick={onAddLand} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Land
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by number, area, or owner..."
            className="pl-10 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statuses.map(s => (
              <SelectItem key={s} value={s.toLowerCase()}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredPlots.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No listings yet</p>
            <p className="text-xs text-muted-foreground mt-1">Use "Quick Add to Listing" on any plot to add it here</p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="min-w-[800px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Land Number</TableHead>
                  <TableHead className="font-bold">Owner</TableHead>
                  <TableHead className="font-bold">Location</TableHead>
                  <TableHead className="font-bold">Area (sqft)</TableHead>
                  <TableHead className="font-bold">GFA (sqft)</TableHead>
                  <TableHead className="font-bold">Zoning</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold">Contact</TableHead>
                  <TableHead className="font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlots.map(plot => {
                  const isNew = isNewListing(plot.id);
                  const isEditing = editing?.plotId === plot.id;
                  const owner = getOwner(plot);
                  const contact = getContact(plot);
                  const status = getStatus(plot);

                  return (
                    <TableRow
                      key={plot.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => !isEditing && onSelectPlot?.(plot)}
                    >
                      <TableCell className="font-bold text-base">
                        {plot.id}
                        {isNew && (
                          <Badge className="ml-2 bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0">New</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editing.owner}
                            onChange={e => setEditing({ ...editing, owner: e.target.value })}
                            className="h-8 w-32"
                            onClick={e => e.stopPropagation()}
                          />
                        ) : owner}
                      </TableCell>
                      <TableCell>{plot.location || plot.project || '—'}</TableCell>
                      <TableCell className="font-mono">{Math.round(plot.area * SQM_TO_SQFT).toLocaleString()}</TableCell>
                      <TableCell className="font-mono">{Math.round(plot.gfa * SQM_TO_SQFT).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{plot.zoning}</Badge>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        {isEditing ? (
                          <Select value={editing.status} onValueChange={val => setEditing({ ...editing, status: val })}>
                            <SelectTrigger className="h-8 w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={`text-xs ${getStatusColor(status)}`}>{status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editing.contact}
                            onChange={e => setEditing({ ...editing, contact: e.target.value })}
                            className="h-8 w-32"
                            onClick={e => e.stopPropagation()}
                          />
                        ) : contact}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit}>
                                <Check className="w-4 h-4 text-success" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(null)}>
                                <X className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(plot)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(plot.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
