import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Lock, Eye, Download, Calendar, BarChart3, TrendingUp, Building2, DollarSign, Printer } from 'lucide-react';
import xEstateLogo from '@/assets/X-Estate_Logo.svg';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { calcDSCFeasibility, DSCPlotInput, MixKey, MIX_TEMPLATES, COMPS, fmt, fmtM, fmtA, pct, TXN_COUNT } from '@/lib/dscFeasibility';

const STORAGE_KEY = 'hyperplot_dc_share_links';

interface DCShareLink {
  id: string;
  plotId: string;
  mixStrategy: MixKey;
  createdAt: string;
  expiresAt: string | null;
  views: number;
  downloads: number;
  isActive: boolean;
  url: string;
}

function loadShareLinks(): DCShareLink[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveShareLinks(links: DCShareLink[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-card'}`}>
      <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export default function DCReport() {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const [link, setLink] = useState<DCShareLink | null>(null);
  const [status, setStatus] = useState<'loading' | 'valid' | 'expired' | 'revoked' | 'not_found'>('loading');
  const [showRequestForm, setShowRequestForm] = useState(false);

  useEffect(() => {
    const links = loadShareLinks();
    const found = links.find(l => l.id === linkId);
    
    if (!found) {
      setStatus('not_found');
      return;
    }

    if (!found.isActive) {
      setLink(found);
      setStatus('revoked');
      return;
    }

    if (found.expiresAt && new Date(found.expiresAt) < new Date()) {
      setLink(found);
      setStatus('expired');
      return;
    }

    // Track view
    found.views += 1;
    const updated = links.map(l => l.id === found.id ? found : l);
    saveShareLinks(updated);
    
    setLink(found);
    setStatus('valid');
  }, [linkId]);

  // Build feasibility from link data
  const fs = useMemo(() => {
    if (!link) return null;
    // Build a DSC input from stored plot ID — use default DSC assumptions
    const input: DSCPlotInput = {
      id: link.plotId,
      name: `Plot ${link.plotId}`,
      area: 55284, // Default DSC plot - would be stored with link in production
      ratio: 5.87,
      height: '0m',
      zone: 'Commercial-Residential',
      constraints: 'Standard guidelines',
    };
    return calcDSCFeasibility(input, link.mixStrategy);
  }, [link]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <Shield className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Link Not Found</h1>
          <p className="text-muted-foreground mb-6">This feasibility link does not exist or has been removed.</p>
          <Button onClick={() => navigate('/')} variant="outline">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (status === 'revoked') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <Lock className="w-16 h-16 text-destructive/50 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Revoked</h1>
          <p className="text-muted-foreground mb-6">This feasibility link has been revoked by the owner.</p>
          <Button onClick={() => navigate('/')} variant="outline">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <Calendar className="w-16 h-16 text-warning/50 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Link Expired</h1>
          <p className="text-muted-foreground mb-6">
            This feasibility link expired on {link?.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : 'N/A'}.
          </p>
          <Button onClick={() => navigate('/')} variant="outline">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (!link || !fs) return null;

  const mixTemplate = MIX_TEMPLATES[link.mixStrategy];

  return (
    <div className="min-h-screen bg-background">
      {/* Nav Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50 no-print">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={xEstateLogo} alt="X-Estate" className="w-10 h-10" />
            <div>
              <h1 className="text-lg font-bold text-foreground">HyperPlot AI</h1>
              <p className="text-xs text-muted-foreground">DDA GIS Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            <Badge variant="outline" className="text-xs border-success/40 text-success">
              <Lock className="w-3 h-3 mr-1" /> Secure Link
            </Badge>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-card to-background border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="text-sm font-bold text-primary uppercase tracking-wider">Decision Confidence</span>
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Feasibility Analysis: Plot {link.plotId}
          </h2>
          <p className="text-muted-foreground max-w-2xl">
            Commercial-residential development analysis with strategic recommendations and financial projections
          </p>
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Generated: {new Date(link.createdAt).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {link.expiresAt ? `Valid until: ${new Date(link.expiresAt).toLocaleDateString()}` : 'No expiry'}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {link.views} views
            </span>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="max-w-6xl mx-auto px-6 -mt-1">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 py-6">
          <KpiCard label="Total GDV" value={fmtM(fs.grossSales)} sub={`Avg PSF AED ${fmt(Math.round(fs.avgPsf))}`} accent />
          <KpiCard label="Total Cost" value={fmtM(fs.totalCost)} sub={`${pct(fs.totalCost / fs.grossSales)} of GDV`} />
          <KpiCard label="Net Profit" value={fmtM(fs.grossProfit)} sub={`Margin: ${pct(fs.grossMargin)}`} />
          <KpiCard label="ROI" value={pct(fs.roi)} sub="Return on cost" accent />
          <KpiCard label="Units" value={fmt(fs.units.total)} sub={`${fmt(Math.round(fs.bua))} sqft BUA`} />
          <KpiCard label="Yield" value={pct(fs.grossYield)} sub="Annual rent / GDV" />
        </div>
      </div>

      {/* Teaser Content */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        {/* Strategy Badge */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">{mixTemplate.icon}</span>
          <div>
            <div className="text-sm font-bold text-foreground">Selected Strategy: {mixTemplate.label}</div>
            <div className="text-xs text-muted-foreground">{mixTemplate.desc}</div>
          </div>
        </div>

        {/* Summary Table */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-border/50 bg-muted/20">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Development Summary</h3>
          </div>
          <div className="divide-y divide-border/30">
            {[
              ['Plot Area', `${fmt(Math.round(fs.plot.area))} sqft`],
              ['GFA', `${fmt(Math.round(fs.gfa))} sqft`],
              ['BUA', `${fmt(Math.round(fs.bua))} sqft`],
              ['Total Units', fmt(fs.units.total)],
              ['Sellable Area', `${fmt(Math.round(fs.sellableArea))} sqft (95%)`],
              ['Avg Selling PSF', `AED ${fmt(Math.round(fs.avgPsf))}`],
              ['Break-Even PSF', `AED ${fmt(Math.round(fs.breakEvenPsf))}`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between px-5 py-3">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-semibold font-mono text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Benchmark Preview */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-border/50 bg-muted/20">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">DSC Market Benchmarks</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {['Project', 'Developer', 'Units', 'PSF', 'Handover'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-muted-foreground font-semibold uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPS.map(c => (
                  <tr key={c.name} className="border-b border-border/20">
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.developer}</td>
                    <td className="px-4 py-2.5 font-mono">{c.units}</td>
                    <td className="px-4 py-2.5 font-mono">AED {fmt(c.psf)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.handover}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA - Request Full Access */}
        <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-card p-8 text-center">
          <Lock className="w-10 h-10 text-primary mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground mb-2">Full Feasibility Report Available</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            This teaser shows key metrics. The full report includes detailed cost breakdowns, unit mix analysis,
            sensitivity tables, payment plan recommendations, and developer benchmarking.
          </p>
          {!showRequestForm ? (
            <Button size="lg" className="gap-2" onClick={() => setShowRequestForm(true)}>
              <Shield className="w-4 h-4" />
              Request Full Access
            </Button>
          ) : (
            <div className="max-w-sm mx-auto space-y-3">
              <input
                type="text"
                placeholder="Your name"
                className="w-full px-4 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-foreground text-sm"
              />
              <input
                type="email"
                placeholder="Your email"
                className="w-full px-4 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-foreground text-sm"
              />
              <Button className="w-full gap-2" onClick={() => {
                setShowRequestForm(false);
                // In production, this would send to backend
                alert('Request submitted! The report owner will contact you.');
              }}>
                Submit Request
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={xEstateLogo} alt="X-Estate" className="w-8 h-8 opacity-50" />
            <span className="text-xs text-muted-foreground">HyperPlot AI</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Confidential Feasibility Analysis • For decision-making purposes only
          </div>
        </div>
      </footer>
    </div>
  );
}
