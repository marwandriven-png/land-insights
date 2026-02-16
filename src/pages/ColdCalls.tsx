import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, MessageSquare, ArrowUpRight, ArrowLeft, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface ColdCallProspect {
  name: string;
  plotNumber: string;
  location: string;
  budget: number;
  currency: string;
  areaSqft: number;
  gfaSqft: number;
  zoning: string;
  source: string;
  status: 'new' | 'called' | 'interested' | 'not_interested';
  phone: string;
  email: string;
  lastCall: string;
  confidenceScore: number;
}

const statusColors: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  called: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  interested: 'bg-green-500/20 text-green-400 border-green-500/30',
  not_interested: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const statusLabels: Record<string, string> = {
  new: 'New',
  called: 'Called',
  interested: 'Interested',
  not_interested: 'Not Interested',
};

export default function ColdCalls() {
  const [prospects, setProspects] = useState<ColdCallProspect[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    // Load from sessionStorage
    const stored = sessionStorage.getItem('coldCallsData');
    if (stored) {
      try {
        setProspects(JSON.parse(stored));
      } catch { /* ignore */ }
    }
  }, []);

  const filteredProspects = prospects.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.location.toLowerCase().includes(q) && !p.plotNumber.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  const updateStatus = (plotNumber: string, status: ColdCallProspect['status']) => {
    setProspects(prev => {
      const updated = prev.map(p =>
        p.plotNumber === plotNumber
          ? { ...p, status, lastCall: status === 'called' ? new Date().toLocaleDateString() : p.lastCall }
          : p
      );
      sessionStorage.setItem('coldCallsData', JSON.stringify(updated));
      return updated;
    });
  };

  const handleCall = (prospect: ColdCallProspect) => {
    updateStatus(prospect.plotNumber, 'called');
    toast({
      title: 'Call Logged',
      description: `Call to ${prospect.name} recorded`,
    });
  };

  const handleConvert = (prospect: ColdCallProspect) => {
    updateStatus(prospect.plotNumber, 'interested');
    toast({
      title: 'Converted!',
      description: `${prospect.name} marked as Interested`,
    });
  };

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl shrink-0">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">Cold Calls — CRM</h1>
                <p className="text-sm text-muted-foreground">
                  {prospects.length} prospects · {prospects.filter(p => p.status === 'new').length} new
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search prospects..."
                  className="pl-9 w-64 text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 text-sm">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="called">Called</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="not_interested">Not Interested</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      {/* Table */}
      <div className="flex-1 container mx-auto px-6 py-4 min-h-0">
        <div className="h-full glass-card glow-border rounded-xl overflow-hidden">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold">Name</TableHead>
                  <TableHead className="text-xs font-semibold">Phone</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Location</TableHead>
                  <TableHead className="text-xs font-semibold">Budget (AED)</TableHead>
                  <TableHead className="text-xs font-semibold">Agent</TableHead>
                  <TableHead className="text-xs font-semibold">Last Call</TableHead>
                  <TableHead className="text-xs font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProspects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      {prospects.length === 0
                        ? 'No prospects yet. Export from Land Matching Wizard.'
                        : 'No prospects match your filters.'
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProspects.map((p) => (
                    <TableRow key={p.plotNumber}>
                      <TableCell className="font-semibold">{p.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.phone || '—'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={p.status}
                          onValueChange={(v) => updateStatus(p.plotNumber, v as ColdCallProspect['status'])}
                        >
                          <SelectTrigger className={`w-32 text-xs border ${statusColors[p.status]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="called">Called</SelectItem>
                            <SelectItem value="interested">Interested</SelectItem>
                            <SelectItem value="not_interested">Not Interested</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm">{p.location}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {p.budget.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">{p.source}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.lastCall}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-8 h-8"
                            onClick={() => handleCall(p)}
                            title="Log Call"
                          >
                            <Phone className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-8 h-8"
                            title="Send Message"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-8 h-8"
                            onClick={() => handleConvert(p)}
                            title="Convert"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
