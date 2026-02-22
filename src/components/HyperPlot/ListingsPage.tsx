import { useState, useMemo, useCallback } from 'react';
import { Search, Plus, Link2, Pencil, Trash2, Check, X, DollarSign, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { PlotData, calculateFeasibility } from '@/services/DDAGISService';
import { isPlotListed, isNewListing, getListedPlotIds, unlistPlot } from '@/services/LandMatchingService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
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
  onCreateListing?: () => void;
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

interface ListingOverride {
  owner?: string;
  contact?: string;
  status?: string;
  price?: string;
  notes?: string;
}

interface EditingState {
  plotId: string;
  owner: string;
  contact: string;
  status: string;
  price: string;
  notes: string;
}

export function ListingsPage({ plots, onSelectPlot, onCreateListing, onSyncSheet }: ListingsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [expandedPlotId, setExpandedPlotId] = useState<string | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Record<string, ListingOverride>>(() => {
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

  function getPrice(plot: PlotData) {
    return localOverrides[plot.id]?.price || '';
  }

  function getNotes(plot: PlotData) {
    return localOverrides[plot.id]?.notes || '';
  }

  function startEdit(plot: PlotData) {
    setEditing({
      plotId: plot.id,
      owner: getOwner(plot) === '—' ? '' : getOwner(plot)!,
      contact: getContact(plot) === '—' ? '' : getContact(plot)!,
      status: getStatus(plot),
      price: getPrice(plot),
      notes: getNotes(plot),
    });
  }

  function saveEdit() {
    if (!editing) return;
    const newOverrides = {
      ...localOverrides,
      [editing.plotId]: {
        ...(localOverrides[editing.plotId] || {}),
        owner: editing.owner || undefined,
        contact: editing.contact || undefined,
        status: editing.status,
        price: editing.price || undefined,
        notes: editing.notes || undefined,
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

  function getAffectionData(plot: PlotData) {
    const raw = plot.rawAttributes as Record<string, any> | undefined;
    const ap = raw?._affectionPlan;
    if (!ap) return null;
    return {
      landUse: ap.mainLanduse || ap.landuseDetails || plot.zoning,
      far: ap.gfaSqm && ap.areaSqm ? (ap.gfaSqm / ap.areaSqm).toFixed(2) : null,
      maxHeight: ap.maxHeightFloors || ap.maxHeight || plot.floors,
      plotCoverage: ap.maxPlotCoverage ? `${ap.maxPlotCoverage}%` : null,
      gfaType: ap.gfaType,
      generalNotes: ap.generalNotes,
    };
  }

  function getFeasibilityData(plot: PlotData) {
    const f = calculateFeasibility(plot);
    return f;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Listings</h2>
          <p className="text-xs text-muted-foreground">{listedPlots.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          {onSyncSheet && (
            <Button variant="outline" size="sm" onClick={onSyncSheet} className="gap-1.5 h-8 text-xs">
              <Link2 className="w-3.5 h-3.5" />
              Sync
            </Button>
          )}
          {onCreateListing && (
            <Button size="sm" onClick={onCreateListing} className="gap-1.5 h-8 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Create Listing
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search listings..."
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28 h-8 text-xs">
            <SelectValue placeholder="All" />
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
            <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs font-medium text-muted-foreground">No listings yet</p>
            <p className="text-[10px] text-muted-foreground mt-1">Use "Create Listing" or "Quick Add" on any plot</p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="min-w-[700px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold text-xs">Land Number</TableHead>
                  <TableHead className="font-bold text-xs">Owner</TableHead>
                  <TableHead className="font-bold text-xs">Location</TableHead>
                  <TableHead className="font-bold text-xs">Area (sqft)</TableHead>
                  <TableHead className="font-bold text-xs">GFA (sqft)</TableHead>
                  <TableHead className="font-bold text-xs">Zoning</TableHead>
                  <TableHead className="font-bold text-xs">Status</TableHead>
                  <TableHead className="font-bold text-xs">Contact</TableHead>
                  <TableHead className="font-bold text-xs">Price</TableHead>
                  <TableHead className="font-bold text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlots.map(plot => {
                  const isNew = isNewListing(plot.id);
                  const isEditing = editing?.plotId === plot.id;
                  const owner = getOwner(plot);
                  const contact = getContact(plot);
                  const status = getStatus(plot);
                  const price = getPrice(plot);
                  const notes = getNotes(plot);
                  const isExpanded = expandedPlotId === plot.id;
                  const affection = getAffectionData(plot);
                  const feasibility = getFeasibilityData(plot);

                  return (
                    <>
                      <TableRow
                        key={plot.id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => !isEditing && onSelectPlot?.(plot)}
                      >
                        <TableCell className="font-bold text-sm">
                          <div className="flex items-center gap-1.5">
                            {plot.id}
                            {isNew && (
                              <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0">New</Badge>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedPlotId(isExpanded ? null : plot.id); }}
                              className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {isEditing ? (
                            <Input
                              value={editing.owner}
                              onChange={e => setEditing({ ...editing, owner: e.target.value })}
                              className="h-7 w-28 text-xs"
                              onClick={e => e.stopPropagation()}
                            />
                          ) : owner}
                        </TableCell>
                        <TableCell className="text-xs">{plot.location || plot.project || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{Math.round(plot.area * SQM_TO_SQFT).toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-xs">{Math.round(plot.gfa * SQM_TO_SQFT).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{plot.zoning}</Badge>
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          {isEditing ? (
                            <Select value={editing.status} onValueChange={val => setEditing({ ...editing, status: val })}>
                              <SelectTrigger className="h-7 w-32 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map(s => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={`text-[10px] ${getStatusColor(status)}`}>{status}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {isEditing ? (
                            <Input
                              value={editing.contact}
                              onChange={e => setEditing({ ...editing, contact: e.target.value })}
                              className="h-7 w-28 text-xs"
                              onClick={e => e.stopPropagation()}
                            />
                          ) : contact}
                        </TableCell>
                        <TableCell className="text-xs" onClick={e => e.stopPropagation()}>
                          {isEditing ? (
                            <Input
                              value={editing.price}
                              onChange={e => setEditing({ ...editing, price: e.target.value })}
                              className="h-7 w-24 text-xs"
                              placeholder="AED..."
                            />
                          ) : (
                            price ? <span className="text-success font-medium">{price}</span> : <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5">
                            {isEditing ? (
                              <>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveEdit}>
                                  <Check className="w-3.5 h-3.5 text-success" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(null)}>
                                  <X className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(plot)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(plot.id)}>
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded details row */}
                      {isExpanded && (
                        <TableRow key={`${plot.id}-details`} className="bg-muted/10">
                          <TableCell colSpan={10} className="p-3">
                            <div className="grid grid-cols-2 gap-4">
                              {/* Notes */}
                              <div>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <FileText className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-xs font-semibold text-foreground">Notes</span>
                                </div>
                                {isEditing ? (
                                  <Textarea
                                    value={editing.notes}
                                    onChange={e => setEditing({ ...editing, notes: e.target.value })}
                                    className="text-xs min-h-[60px]"
                                    placeholder="Add notes..."
                                    onClick={e => e.stopPropagation()}
                                  />
                                ) : (
                                  <p className="text-xs text-muted-foreground">{notes || 'No notes'}</p>
                                )}
                              </div>

                              {/* Feasibility Summary */}
                              <div>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <DollarSign className="w-3.5 h-3.5 text-success" />
                                  <span className="text-xs font-semibold text-foreground">Feasibility</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">ROI:</span>{' '}
                                    <span className="font-medium text-success">{feasibility.roi}%</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Margin:</span>{' '}
                                    <span className="font-medium">{feasibility.profitMargin}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Risk:</span>{' '}
                                    <span className={`font-medium ${feasibility.riskLevel === 'Low' ? 'text-success' : feasibility.riskLevel === 'High' ? 'text-destructive' : 'text-warning'}`}>
                                      {feasibility.riskLevel}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Affection Plan Data */}
                              {affection && (
                                <div className="col-span-2">
                                  <span className="text-xs font-semibold text-foreground mb-1 block">Affection Plan</span>
                                  <div className="grid grid-cols-4 gap-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">Land Use:</span>{' '}
                                      <span className="font-medium">{affection.landUse || '—'}</span>
                                    </div>
                                    {affection.far && (
                                      <div>
                                        <span className="text-muted-foreground">FAR:</span>{' '}
                                        <span className="font-medium">{affection.far}</span>
                                      </div>
                                    )}
                                    <div>
                                      <span className="text-muted-foreground">Height:</span>{' '}
                                      <span className="font-medium">{affection.maxHeight || '—'}</span>
                                    </div>
                                    {affection.plotCoverage && (
                                      <div>
                                        <span className="text-muted-foreground">Coverage:</span>{' '}
                                        <span className="font-medium">{affection.plotCoverage}</span>
                                      </div>
                                    )}
                                  </div>
                                  {affection.generalNotes && (
                                    <p className="text-[10px] text-muted-foreground mt-1 italic">{affection.generalNotes}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
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
