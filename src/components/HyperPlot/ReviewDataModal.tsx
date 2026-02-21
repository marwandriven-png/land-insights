import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Phone, Ban, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { MatchResult, markPlotsExported, getExportedPlotIds, isPlotListed } from '@/services/LandMatchingService';
import { toast } from '@/hooks/use-toast';

interface ReviewDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: MatchResult[];
}

const SQM_TO_SQFT = 10.7639;

export function ReviewDataModal({ isOpen, onClose, matches }: ReviewDataModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(matches.map(m => m.matchedPlotId))
  );
  const [campaign, setCampaign] = useState('default');
  const [isExporting, setIsExporting] = useState(false);
  const [isMaximized, setIsMaximized] = useState(true);
  const exportedIds = useMemo(() => getExportedPlotIds(), []);

  const selectedCount = selectedIds.size;
  const totalCount = matches.length;

  const toggleSelect = (plotId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(plotId)) next.delete(plotId);
      else next.add(plotId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === matches.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(matches.map(m => m.matchedPlotId)));
    }
  };

  const selectedMatches = useMemo(
    () => matches.filter(m => selectedIds.has(m.matchedPlotId)),
    [matches, selectedIds]
  );

  const handleSendOutreach = () => {
    if (selectedCount === 0) return;
    toast({
      title: 'Outreach Initiated',
      description: `${selectedCount} land(s) sent for outreach campaign "${campaign}"`,
    });
    onClose();
  };

  const handleExportToCRM = async () => {
    if (selectedCount === 0) return;
    setIsExporting(true);

    // Filter out already-listed plots
    const exportable = selectedMatches.filter(m => !isPlotListed(m.matchedPlotId));
    
    if (exportable.length === 0) {
      toast({
        title: 'Already Listed',
        description: 'All selected lands are already listed in CRM.',
        variant: 'destructive',
      });
      setIsExporting(false);
      return;
    }

    // Mark as exported
    markPlotsExported(exportable.map(m => m.matchedPlotId));

    // Build export URL with data
    const exportData = exportable.map(m => ({
      plotNumber: m.matchedPlotId,
      location: m.matchedLocation || 'Dubai',
      areaSqm: Math.round(m.matchedPlotArea),
      areaSqft: Math.round(m.matchedPlotArea * SQM_TO_SQFT),
      gfaSqm: Math.round(m.matchedGfa),
      gfaSqft: Math.round(m.matchedGfa * SQM_TO_SQFT),
      zoning: m.matchedZoning,
      status: m.matchedStatus,
      confidenceScore: m.confidenceScore,
      feasibilityStatus: 'pending',
    }));

    // Store for CRM page and open external CRM
    sessionStorage.setItem('coldCallsData', JSON.stringify(
      exportable.map(m => ({
        name: `Plot ${m.matchedPlotId}`,
        plotNumber: m.matchedPlotId,
        location: m.matchedLocation || 'Dubai',
        budget: Math.round(m.matchedPlotArea * SQM_TO_SQFT * 2150),
        currency: 'AED',
        areaSqft: Math.round(m.matchedPlotArea * SQM_TO_SQFT),
        gfaSqft: Math.round(m.matchedGfa * SQM_TO_SQFT),
        zoning: m.matchedZoning,
        source: 'DDA API',
        status: 'new' as const,
        phone: '',
        email: '',
        lastCall: 'Never',
        confidenceScore: m.confidenceScore,
      }))
    ));

    // Open external CRM in new tab
    try {
      const url = new URL('https://agent-harmony-sync.lovable.app/lead-generation');
      url.searchParams.set('source', 'hyperplot');
      url.searchParams.set('count', String(exportData.length));
      window.open(url.toString(), '_blank');
    } catch { /* fallback */ }

    setIsExporting(false);
    toast({
      title: 'Exported to CRM',
      description: `${exportable.length} land(s) exported to CRM call page`,
    });
    onClose();
  };

  const handleRejectSelected = () => {
    if (selectedCount === 0) return;
    setSelectedIds(new Set());
    toast({
      title: 'Rejected',
      description: `${selectedCount} land(s) rejected`,
      variant: 'destructive',
    });
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-card flex flex-col animate-in fade-in duration-200 z-[10000] ${
        isMaximized ? 'fixed inset-0' : 'w-[90vw] h-[85vh] rounded-xl shadow-2xl'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div>
            <h2 className="text-lg font-bold">Review Land Matches</h2>
            <p className="text-sm text-muted-foreground">
              {totalCount} lands · {selectedCount} selected
              {matches.some(m => m.sheetMetadata) && (
                <span className="ml-2 text-primary">· Sheet linked</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
              title={isMaximized ? 'Minimize' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Campaign + Actions */}
        <div className="px-5 py-3 border-b border-border/30 flex items-center gap-3 flex-wrap">
          <Select value={campaign} onValueChange={setCampaign}>
            <SelectTrigger className="w-48 text-sm">
              <SelectValue placeholder="Campaign" />
            </SelectTrigger>
            <SelectContent className="z-[110]">
              <SelectItem value="default">Default Campaign</SelectItem>
              <SelectItem value="al-satwa">Al Satwa Outreach</SelectItem>
              <SelectItem value="business-bay">Business Bay</SelectItem>
              <SelectItem value="downtown">Downtown Dubai</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Button
            size="sm"
            className="gap-2"
            onClick={handleSendOutreach}
            disabled={selectedCount === 0}
          >
            <Send className="w-4 h-4" />
            Send for Outreach ({selectedCount})
          </Button>

          <Button
            size="sm"
            variant="secondary"
            className="gap-2"
            onClick={handleExportToCRM}
            disabled={selectedCount === 0 || isExporting}
          >
            <ExternalLink className="w-4 h-4" />
            Export to CRM ({selectedCount})
          </Button>

          <Button
            size="sm"
            variant="destructive"
            className="gap-2"
            onClick={handleRejectSelected}
            disabled={selectedCount === 0}
          >
            <Ban className="w-4 h-4" />
            Reject Selected
          </Button>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="min-w-[900px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === matches.length && matches.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="text-base font-bold">Land Number</TableHead>
                <TableHead className="text-base font-bold">Owner</TableHead>
                <TableHead className="text-base font-bold">Location</TableHead>
                <TableHead className="text-base font-bold">Area (sqft)</TableHead>
                <TableHead className="text-base font-bold">GFA (sqft)</TableHead>
                <TableHead className="text-base font-bold">Zoning</TableHead>
                <TableHead className="text-base font-bold">Status</TableHead>
                <TableHead className="text-base font-bold">Match %</TableHead>
                <TableHead className="text-base font-bold">CRM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((m) => {
                const listed = isPlotListed(m.matchedPlotId);
                const exported = exportedIds.has(m.matchedPlotId);

                return (
                  <TableRow
                    key={m.matchedPlotId}
                    className={selectedIds.has(m.matchedPlotId) ? 'bg-primary/5' : ''}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(m.matchedPlotId)}
                        onCheckedChange={() => toggleSelect(m.matchedPlotId)}
                      />
                    </TableCell>
                    <TableCell className="font-bold text-lg">{m.matchedPlotId}</TableCell>
                    <TableCell className="text-base">
                      {m.ownerReference || m.sheetMetadata?.['name'] || m.sheetMetadata?.['owner'] || m.sheetMetadata?.['owner name'] || m.sheetMetadata?.['owner_reference'] || (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {m.sheetMetadata && (
                        <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                          Sheet
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-base">{m.matchedLocation || '—'}</TableCell>
                    <TableCell className="text-base font-mono">
                      {Math.round(m.matchedPlotArea * SQM_TO_SQFT).toLocaleString()}
                      {m.areaDeviation > 0 && (
                        <span className="text-muted-foreground text-sm ml-1">Δ{m.areaDeviation}%</span>
                      )}
                    </TableCell>
                    <TableCell className="text-base font-mono">
                      {Math.round(m.matchedGfa * SQM_TO_SQFT).toLocaleString()}
                      {m.gfaDeviation > 0 && (
                        <span className="text-muted-foreground text-sm ml-1">Δ{m.gfaDeviation}%</span>
                      )}
                    </TableCell>
                    <TableCell className="text-base">{m.matchedZoning}</TableCell>
                    <TableCell className="text-base">{m.matchedStatus}</TableCell>
                    <TableCell>
                      <span
                        className="px-3 py-1.5 rounded-full text-base font-bold"
                        style={{
                          background: m.confidenceScore > 80
                            ? 'hsl(var(--success) / 0.2)'
                            : 'hsl(var(--warning) / 0.2)',
                          color: m.confidenceScore > 80
                            ? 'hsl(var(--success))'
                            : 'hsl(var(--warning))'
                        }}
                      >
                        {m.confidenceScore}%
                      </span>
                    </TableCell>
                    <TableCell>
                      {listed ? (
                        <Badge className="bg-success/20 text-success border-success/30 text-xs">
                          Listed
                        </Badge>
                      ) : exported ? (
                        <Badge variant="secondary" className="text-xs">
                          Exported
                        </Badge>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
