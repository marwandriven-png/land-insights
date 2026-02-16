import { useState, useMemo } from 'react';
import { X, Send, Phone, Ban, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { MatchResult } from '@/services/LandMatchingService';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

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

  const handleExportToColdCalls = async () => {
    if (selectedCount === 0) return;
    setIsExporting(true);

    const prospects = selectedMatches.map(m => ({
      name: `Plot ${m.matchedPlotId}`,
      plotNumber: m.matchedPlotId,
      location: m.matchedLocation || 'Dubai',
      budget: Math.round(m.matchedPlotArea * SQM_TO_SQFT * 2150), // PSF estimate
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
    }));

    // Store in sessionStorage for the cold calls page
    sessionStorage.setItem('coldCallsData', JSON.stringify(prospects));

    setIsExporting(false);
    onClose();
    navigate('/cold-calls');
  };

  const handleRejectSelected = () => {
    if (selectedCount === 0) return;
    // Remove selected from the view
    setSelectedIds(new Set());
    toast({
      title: 'Rejected',
      description: `${selectedCount} land(s) rejected`,
      variant: 'destructive',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[900px] max-w-[95vw] max-h-[85vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div>
            <h2 className="text-lg font-bold">Review Land Matches</h2>
            <p className="text-sm text-muted-foreground">
              {totalCount} lands · {selectedCount} selected
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
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
            onClick={handleExportToColdCalls}
            disabled={selectedCount === 0 || isExporting}
          >
            <Phone className="w-4 h-4" />
            Export to Call Page ({selectedCount})
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === matches.length && matches.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="text-xs font-semibold">Plot Number</TableHead>
                <TableHead className="text-xs font-semibold">Location</TableHead>
                <TableHead className="text-xs font-semibold">Area (sqft)</TableHead>
                <TableHead className="text-xs font-semibold">Est. Price</TableHead>
                <TableHead className="text-xs font-semibold">Source</TableHead>
                <TableHead className="text-xs font-semibold">Match</TableHead>
                <TableHead className="text-xs font-semibold">Report</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((m) => {
                const areaSqft = Math.round(m.matchedPlotArea * SQM_TO_SQFT);
                const estPrice = Math.round(areaSqft * 2150);
                const areaSlug = (m.matchedLocation || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

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
                    <TableCell className="font-semibold text-sm">{m.matchedPlotId}</TableCell>
                    <TableCell className="text-sm">{m.matchedLocation || '—'}</TableCell>
                    <TableCell className="text-sm font-mono">{areaSqft.toLocaleString()} sf</TableCell>
                    <TableCell className="text-sm font-mono">
                      AED {(estPrice / 1000).toFixed(0)}K
                    </TableCell>
                    <TableCell className="text-sm">DDA</TableCell>
                    <TableCell>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-bold"
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
                      <a
                        href={`/reports/stamn-one-report.pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}
