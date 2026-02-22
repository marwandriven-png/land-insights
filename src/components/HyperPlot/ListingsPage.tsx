import { useState, useMemo } from 'react';
import { Search, Plus, RefreshCw, Link2 } from 'lucide-react';
import { PlotData } from '@/services/DDAGISService';
import { isPlotListed, isNewListing, markPlotListed, getListedPlotIds } from '@/services/LandMatchingService';
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

export function ListingsPage({ plots, onSelectPlot, onAddLand, onSyncSheet }: ListingsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [zoningFilter, setZoningFilter] = useState('all');

  // Get all listed plots
  const listedPlotIds = useMemo(() => getListedPlotIds(), []);

  // Filter plots that are listed
  const listedPlots = useMemo(() => {
    return plots.filter(p => listedPlotIds.has(p.id));
  }, [plots, listedPlotIds]);

  // Apply search and filters
  const filteredPlots = useMemo(() => {
    return listedPlots.filter(plot => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          plot.id.toLowerCase().includes(q) ||
          (plot.location || '').toLowerCase().includes(q) ||
          (plot.project || '').toLowerCase().includes(q) ||
          plot.zoning.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (statusFilter !== 'all' && plot.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (zoningFilter !== 'all' && !plot.zoning.toLowerCase().includes(zoningFilter.toLowerCase())) return false;
      return true;
    });
  }, [listedPlots, searchQuery, statusFilter, zoningFilter]);

  // Get unique statuses and zonings
  const statuses = useMemo(() => [...new Set(listedPlots.map(p => p.status))], [listedPlots]);
  const zonings = useMemo(() => [...new Set(listedPlots.map(p => p.zoning))], [listedPlots]);

  function getStatusColor(status: string) {
    switch (status.toLowerCase()) {
      case 'available': return 'bg-success/20 text-success border-success/30';
      case 'reserved':
      case 'under construction': return 'bg-warning/20 text-warning border-warning/30';
      case 'frozen': return 'bg-destructive/20 text-destructive border-destructive/30';
      default: return 'bg-muted/50 text-muted-foreground border-border/50';
    }
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
            placeholder="Search by land number, owner, location..."
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
        <Select value={zoningFilter} onValueChange={setZoningFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="All Zoning" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zoning</SelectItem>
            {zonings.map(z => (
              <SelectItem key={z} value={z.toLowerCase()}>{z}</SelectItem>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlots.map(plot => {
                  const isNew = isNewListing(plot.id);
                  const raw = plot.rawAttributes as Record<string, any> | undefined;
                  const affection = raw?._affectionPlan;
                  const sheetMeta = raw?._sheetMetadata;
                  const owner = affection?.ownerName
                    || raw?.ownerName
                    || sheetMeta?.['name']
                    || sheetMeta?.['owner']
                    || sheetMeta?.['owner name']
                    || '—';
                  const contact = sheetMeta?.['mobile']
                    || sheetMeta?.['phone']
                    || sheetMeta?.['contact']
                    || sheetMeta?.['phone number']
                    || sheetMeta?.['contact number']
                    || '—';

                  return (
                    <TableRow
                      key={plot.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => onSelectPlot?.(plot)}
                    >
                      <TableCell className="font-bold text-base">
                        {plot.id}
                        {isNew && (
                          <Badge className="ml-2 bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0">New</Badge>
                        )}
                      </TableCell>
                      <TableCell>{owner}</TableCell>
                      <TableCell>{plot.location || plot.project || '—'}</TableCell>
                      <TableCell className="font-mono">{Math.round(plot.area * SQM_TO_SQFT).toLocaleString()}</TableCell>
                      <TableCell className="font-mono">{Math.round(plot.gfa * SQM_TO_SQFT).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{plot.zoning}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${getStatusColor(plot.status)}`}>{plot.status}</Badge>
                      </TableCell>
                      <TableCell>{contact}</TableCell>
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
