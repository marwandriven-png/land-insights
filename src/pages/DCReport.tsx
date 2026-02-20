import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Lock, Eye, Calendar, Printer, Building2, TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import xEstateLogo from '@/assets/X-Estate_Logo.svg';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { calcDSCFeasibility, DSCPlotInput, DSCFeasibilityResult, MixKey, MIX_TEMPLATES, COMPS, UNIT_SIZES, RENT_PSF_YR, TXN_AVG_PSF, TXN_COUNT, fmt, fmtM, fmtA, pct } from '@/lib/dscFeasibility';
import { DCShareLink, loadShareLinks, saveShareLinks } from '@/components/HyperPlot/DCShareModal';

// ─── Animated counter hook ───
function useCountUp(target: number, duration = 1200, enabled = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled) { setValue(target); return; }
    let start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setValue(Math.round(target * p));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, enabled]);
  return value;
}

// ─── KPI Card with animation ───
function KpiCard({ label, value, sub, accent, delay = 0 }: { label: string; value: string; sub?: string; accent?: boolean; delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div className={`rounded-xl border p-5 transition-all duration-500 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${accent ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-card'}`}>
      <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-extrabold font-mono tracking-tight ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

// ─── Section with numbered badge + fade-in ───
function Section({ num, title, badge, children, delay = 0 }: { num?: number; title: string; badge?: string; children: React.ReactNode; delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div className={`mb-8 transition-all duration-700 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border/50">
        {num != null && (
          <span className="w-8 h-8 flex items-center justify-center rounded-md bg-gradient-to-br from-primary to-cyan-500 text-primary-foreground font-extrabold text-xs shrink-0">{num}</span>
        )}
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{title}</h3>
        {badge && <Badge variant="outline" className="text-xs border-primary/40 text-primary ml-auto">{badge}</Badge>}
      </div>
      {children}
    </div>
  );
}

// ─── Progress bar ───
function MetricBar({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1.5 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-500 transition-all duration-1000" style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

export default function DCReport() {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const [link, setLink] = useState<DCShareLink | null>(null);
  const [status, setStatus] = useState<'loading' | 'valid' | 'expired' | 'revoked' | 'not_found'>('loading');
  const [activeTab, setActiveTab] = useState<'feasibility' | 'benchmarks' | 'sensitivity'>('feasibility');
  const [showRequestForm, setShowRequestForm] = useState(false);

  useEffect(() => {
    const links = loadShareLinks();
    const found = links.find(l => l.id === linkId);

    if (!found) { setStatus('not_found'); return; }
    if (!found.isActive) { setLink(found); setStatus('revoked'); return; }
    if (found.expiresAt && new Date(found.expiresAt) < new Date()) { setLink(found); setStatus('expired'); return; }

    // Track view
    found.views += 1;
    saveShareLinks(links.map(l => l.id === found.id ? found : l));
    setLink(found);
    setStatus('valid');
  }, [linkId]);

  // Build feasibility from stored link data
  const fs = useMemo(() => {
    if (!link) return null;
    const input: DSCPlotInput = link.plotInput || {
      id: link.plotId, name: `Plot ${link.plotId}`,
      area: 55284, ratio: 5.87, height: '0m',
      zone: 'Commercial-Residential', constraints: 'Standard guidelines',
    };
    return calcDSCFeasibility(input, link.mixStrategy, link.overrides as any || {});
  }, [link]);

  // Status screens
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
            Expired on {link?.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : 'N/A'}.
          </p>
          <Button onClick={() => navigate('/')} variant="outline">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (!link || !fs) return null;

  const mixTemplate = MIX_TEMPLATES[link.mixStrategy];
  const equityAmt = fs.totalCost * 0.4;
  const debtAmt = fs.totalCost * 0.6;

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Nav Header ─── */}
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

      {/* ─── Hero ─── */}
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
            {fs.plot.zone} development analysis with strategic recommendations and financial projections
          </p>
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Generated: {new Date(link.createdAt).toLocaleDateString()}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {link.expiresAt ? `Valid until: ${new Date(link.expiresAt).toLocaleDateString()}` : 'No expiry'}</span>
            <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {link.views} views</span>
          </div>
        </div>
      </div>

      {/* ─── KPI Strip ─── */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 py-6">
          <KpiCard label="Total GDV" value={fmtM(fs.grossSales)} sub={`Avg PSF AED ${fmt(Math.round(fs.avgPsf))}`} accent delay={100} />
          <KpiCard label="Total Cost" value={fmtM(fs.totalCost)} sub={`${pct(fs.totalCost / fs.grossSales)} of GDV`} delay={200} />
          <KpiCard label="Net Profit" value={fmtM(fs.grossProfit)} sub={`Margin: ${pct(fs.grossMargin)}`} delay={300} />
          <KpiCard label="ROI" value={pct(fs.roi)} sub="Return on cost" accent delay={400} />
          <KpiCard label="Units" value={fmt(fs.units.total)} sub={`${fmt(Math.round(fs.bua))} sqft BUA`} delay={500} />
          <KpiCard label="Yield" value={pct(fs.grossYield)} sub="Annual rent / GDV" delay={600} />
        </div>
      </div>

      {/* ─── Tab Navigation ─── */}
      <div className="sticky top-[57px] z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 no-print">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-0">
            {([
              ['feasibility', 'Feasibility'],
              ['benchmarks', 'Benchmarks'],
              ['sensitivity', 'Sensitivity'],
            ] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setActiveTab(k)}
                className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === k
                    ? 'text-primary border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="max-w-6xl mx-auto px-6 py-8">

        {activeTab === 'feasibility' && (
          <>
            {/* Strategy Badge */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 mb-6 flex items-center gap-3 animate-fade-in">
              <span className="text-2xl">{mixTemplate.icon}</span>
              <div>
                <div className="text-sm font-bold text-foreground">Selected Strategy: {mixTemplate.label}</div>
                <div className="text-xs text-muted-foreground">{mixTemplate.desc}</div>
              </div>
            </div>

            {/* 1. Development Configuration */}
            <Section num={1} title="Development Configuration" delay={200}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/50 bg-card p-5">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Plot Details</h4>
                  <div className="space-y-2">
                    {[
                      ['Plot Area', `${fmt(Math.round(fs.plot.area))} sqft`],
                      ['Plot Ratio', `× ${fs.plot.ratio.toFixed(2)}`],
                      ['GFA', `${fmt(Math.round(fs.gfa))} sqft`],
                      ['BUA', `${fmt(Math.round(fs.bua))} sqft`],
                      ['Approved Height', fs.plot.height],
                    ].map(([param, val]) => (
                      <div key={param as string} className="flex justify-between py-1.5 border-b border-border/30 last:border-0">
                        <span className="text-sm text-muted-foreground">{param}</span>
                        <span className="text-sm font-semibold font-mono text-foreground">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border/50 bg-card p-5">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Efficiency Metrics</h4>
                  <MetricBar label="Sellable Area" value={`${fmt(Math.round(fs.sellableArea))} sqft (95%)`} percent={95} />
                  <MetricBar label="GFA Utilization" value="100%" percent={100} />
                  <MetricBar label="Construction Progress" value="0%" percent={0} />
                </div>
              </div>
            </Section>

            {/* 2. Unit Mix */}
            <Section num={2} title="Recommended Unit Mix" delay={400}>
              <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['Unit Type', 'Count', 'Avg Size (sqft)', 'Selling PSF (AED)', 'Total Value'].map(h => (
                        <TableHead key={h} className="text-xs text-right first:text-left">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { type: 'Studio', u: fs.units.studio, sz: UNIT_SIZES.studio, psf: TXN_AVG_PSF.studio, rev: fs.revBreak.studio },
                      { type: '1 Bedroom', u: fs.units.br1, sz: UNIT_SIZES.br1, psf: TXN_AVG_PSF.br1, rev: fs.revBreak.br1 },
                      { type: '2 Bedroom', u: fs.units.br2, sz: UNIT_SIZES.br2, psf: TXN_AVG_PSF.br2, rev: fs.revBreak.br2 },
                      { type: '3 Bedroom', u: fs.units.br3, sz: UNIT_SIZES.br3, psf: TXN_AVG_PSF.br3, rev: fs.revBreak.br3 },
                    ].map(r => (
                      <TableRow key={r.type}>
                        <TableCell className="text-sm font-medium py-2">{r.type}</TableCell>
                        <TableCell className="text-sm text-right font-mono py-2">{fmt(r.u)}</TableCell>
                        <TableCell className="text-sm text-right py-2">{fmt(r.sz)}</TableCell>
                        <TableCell className="text-sm text-right font-mono py-2">{fmt(r.psf)}</TableCell>
                        <TableCell className="text-sm text-right font-mono py-2">{fmtM(r.rev)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="text-sm font-bold py-2">Total</TableCell>
                      <TableCell className="text-sm text-right font-bold py-2">{fmt(fs.units.total)}</TableCell>
                      <TableCell className="text-sm text-right py-2">-</TableCell>
                      <TableCell className="text-sm text-right py-2">-</TableCell>
                      <TableCell className="text-sm text-right font-bold font-mono py-2">{fmtM(fs.grossSales)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </Section>

            {/* 3. Financial Feasibility */}
            <Section num={3} title="Financial Feasibility" delay={600}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Cost Breakdown */}
                <div className="rounded-xl border border-border/50 bg-card p-5">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cost Breakdown</h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Land Cost', sub: 'Including transfer fees', val: fs.landCost, pctGdv: fs.landCost / fs.grossSales },
                      { label: 'Construction', sub: `AED ${overrideOr(link.overrides, 'constructionPsf', 420)}/sqft BUA`, val: fs.constructionCost, pctGdv: fs.constructionCost / fs.grossSales },
                      { label: 'Soft Costs', sub: 'Design, permits, legal', val: fs.authorityFees + fs.consultantFees + fs.marketing, pctGdv: (fs.authorityFees + fs.consultantFees + fs.marketing) / fs.grossSales },
                      { label: 'Contingency', sub: '5% buffer', val: fs.contingency, pctGdv: fs.contingency / fs.grossSales },
                    ].map(c => (
                      <div key={c.label} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                        <div>
                          <div className="text-sm font-medium text-foreground">{c.label}</div>
                          <div className="text-xs text-muted-foreground">{c.sub}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold font-mono text-foreground">{fmtM(c.val)}</div>
                          <div className="text-xs text-muted-foreground">{pct(c.pctGdv)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Return Metrics */}
                <div className="rounded-xl border border-border/50 bg-card p-5">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Return Metrics</h4>

                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Project IRR</span>
                      <span className="text-2xl font-extrabold text-primary font-mono">{pct(fs.roi)}</span>
                    </div>
                    <Progress value={Math.min(fs.roi * 100, 100)} className="h-2" />
                    <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                      <span>Industry avg: 20%</span>
                      <span className="text-success font-bold">{fs.roi > 0.2 ? 'Excellent' : fs.roi > 0.1 ? 'Good' : 'Below avg'}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Profit Margin</span>
                      <span className="text-lg font-bold font-mono text-foreground">{pct(fs.grossMargin)}</span>
                    </div>
                    <Progress value={Math.min(fs.grossMargin * 100, 100)} className="h-2" />
                  </div>

                  {/* Finance Structure */}
                  <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-bold text-muted-foreground uppercase">Finance Structure</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 rounded-lg bg-primary/10 border border-primary/20">
                        <div className="text-xs text-muted-foreground">Equity (40%)</div>
                        <div className="text-sm font-bold font-mono text-primary">{fmtM(equityAmt)}</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/50 border border-border/30">
                        <div className="text-xs text-muted-foreground">Debt (60%)</div>
                        <div className="text-sm font-bold font-mono text-foreground">{fmtM(debtAmt)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* 4. Payment Plan */}
            <Section num={4} title="Recommended Payment Plan" delay={800}>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(fs.payPlan).map(([stage, pctVal]) => (
                  <div key={stage} className="rounded-xl border border-border/50 bg-card p-5 text-center">
                    <div className="text-4xl font-extrabold text-primary font-mono mb-2">{pctVal}%</div>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      {stage === 'booking' ? 'On Booking' : stage === 'construction' ? 'During Construction' : 'Upon Handover'}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{fmtA(fs.grossSales * pctVal / 100)}</div>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {activeTab === 'benchmarks' && (
          <>
            {/* DSC Market Benchmarks */}
            <Section title="DSC Market Benchmarks" badge={`${COMPS.length} projects`} delay={200}>
              <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['Project', 'Developer', 'Units', 'BUA', 'PSF', 'Handover', 'Payment', 'Studio%', '1BR%', '2BR%'].map(h => (
                        <TableHead key={h} className="text-xs text-right first:text-left whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COMPS.map(c => (
                      <TableRow key={c.name}>
                        <TableCell className="text-sm font-medium py-2">{c.name}</TableCell>
                        <TableCell className="text-sm text-right text-muted-foreground py-2">{c.developer}</TableCell>
                        <TableCell className="text-sm text-right font-mono py-2">{c.units}</TableCell>
                        <TableCell className="text-sm text-right font-mono py-2">{fmt(c.bua)}</TableCell>
                        <TableCell className="text-sm text-right font-mono py-2">AED {fmt(c.psf)}</TableCell>
                        <TableCell className="text-sm text-right text-muted-foreground py-2">{c.handover}</TableCell>
                        <TableCell className="text-sm text-right text-muted-foreground py-2">{c.payPlan}</TableCell>
                        <TableCell className="text-sm text-right py-2">{c.studioP}%</TableCell>
                        <TableCell className="text-sm text-right py-2">{c.br1P}%</TableCell>
                        <TableCell className="text-sm text-right py-2">{c.br2P}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Comparison vs Your Plot */}
              <div className="mt-4 overflow-x-auto rounded-xl border border-border/50 bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['Project', 'Density', 'GFA Diff', 'Unit Count', 'PSF vs Yours'].map(h => (
                        <TableHead key={h} className="text-xs text-right first:text-left">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COMPS.map(c => {
                      const diff = fs.avgPsf - c.psf;
                      return (
                        <TableRow key={c.name}>
                          <TableCell className="text-sm font-medium py-2">{c.name}</TableCell>
                          <TableCell className="text-sm text-right py-2">{c.density.toFixed(2)}</TableCell>
                          <TableCell className="text-sm text-right py-2">{fmt(Math.round(fs.gfa - c.bua))} sqft</TableCell>
                          <TableCell className="text-sm text-right py-2">{fs.units.total} vs {c.units}</TableCell>
                          <TableCell className={`text-sm text-right font-bold py-2 ${diff >= 0 ? 'text-success' : 'text-warning'}`}>
                            {diff >= 0 ? '+' : ''}AED {fmt(Math.round(diff))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/30 text-xs text-muted-foreground">
                <strong className="text-foreground">Market Intelligence:</strong> DSC sales avg AED 1,565/sqft ({TXN_COUNT.total} txns) · Rental avg AED 86/sqft/yr · Avg service charge AED 13–15/sqft
              </div>
            </Section>

            {/* Strategy Mix Classification */}
            <Section title="Strategy Classification" badge="Active DSC Projects" delay={400}>
              <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['Project', 'Units', 'Studio%', '1BR%', '2BR%', '3BR%', 'Classification'].map(h => (
                        <TableHead key={h} className="text-xs text-right first:text-left">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COMPS.map(c => {
                      const cat = c.studioP > 40 ? 'Investor' : c.br2P > 35 ? 'Family' : 'Balanced';
                      return (
                        <TableRow key={c.name}>
                          <TableCell className="text-sm font-medium py-2">{c.name}</TableCell>
                          <TableCell className="text-sm text-right font-mono py-2">{c.units}</TableCell>
                          <TableCell className="text-sm text-right py-2">{c.studioP}%</TableCell>
                          <TableCell className="text-sm text-right py-2">{c.br1P}%</TableCell>
                          <TableCell className="text-sm text-right py-2">{c.br2P}%</TableCell>
                          <TableCell className="text-sm text-right py-2">{c.br3P}%</TableCell>
                          <TableCell className="text-right py-2">
                            <Badge className={`text-[10px] ${cat === 'Investor' ? 'bg-primary/20 text-primary' : cat === 'Family' ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
                              {cat}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-primary/5 border-t-2 border-primary/30">
                      <TableCell className="text-sm font-bold text-primary py-2">Your Plot</TableCell>
                      <TableCell className="text-sm text-right font-mono font-bold py-2">{fs.units.total}</TableCell>
                      <TableCell className="text-sm text-right font-bold py-2">{pct(fs.mix.studio)}</TableCell>
                      <TableCell className="text-sm text-right font-bold py-2">{pct(fs.mix.br1)}</TableCell>
                      <TableCell className="text-sm text-right font-bold py-2">{pct(fs.mix.br2)}</TableCell>
                      <TableCell className="text-sm text-right font-bold py-2">{pct(fs.mix.br3)}</TableCell>
                      <TableCell className="text-right py-2">
                        <Badge className="bg-primary/20 text-primary text-[10px]">{mixTemplate.label}</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Section>
          </>
        )}

        {activeTab === 'sensitivity' && (
          <>
            {/* Price Sensitivity */}
            <Section num={7} title="Price Sensitivity Analysis" badge="±10% range" delay={200}>
              <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['Scenario', 'PSF', 'Revenue', 'Profit', 'Margin', 'ROI', 'Viability'].map(h => (
                        <TableHead key={h} className="text-xs text-right first:text-left">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fs.sens.map((s, i) => {
                      const psf = Math.round(fs.avgPsf * (1 + s.delta));
                      const isBase = s.delta === 0;
                      return (
                        <TableRow key={i} className={isBase ? 'bg-primary/5' : ''}>
                          <TableCell className={`text-xs font-bold py-2 ${isBase ? 'text-primary' : s.delta > 0 ? 'text-success' : 'text-warning'}`}>
                            {isBase ? '► BASE' : s.delta > 0 ? `▲ +${Math.abs(s.delta * 100)}%` : `▼ -${Math.abs(s.delta * 100)}%`}
                          </TableCell>
                          <TableCell className="text-sm text-right font-mono py-2">AED {fmt(psf)}</TableCell>
                          <TableCell className="text-sm text-right font-mono py-2">{fmtA(s.revenue)}</TableCell>
                          <TableCell className={`text-sm text-right font-mono py-2 ${s.profit > 0 ? 'text-success' : 'text-destructive'}`}>{fmtA(s.profit)}</TableCell>
                          <TableCell className={`text-sm text-right py-2 ${s.margin > 0.2 ? 'text-success' : 'text-warning'}`}>{pct(s.margin)}</TableCell>
                          <TableCell className={`text-sm text-right py-2 ${s.roi > 0.15 ? 'text-success' : 'text-warning'}`}>{pct(s.roi)}</TableCell>
                          <TableCell className="text-right py-2">
                            <span className={`text-xs font-bold ${s.margin >= 0.25 ? 'text-success' : s.margin >= 0.15 ? 'text-warning' : 'text-destructive'}`}>
                              {s.margin >= 0.25 ? '✓ VIABLE' : s.margin >= 0.15 ? '⚠ MARGINAL' : '✗ LOSS'}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                <KpiCard label="Break-Even PSF" value={`AED ${fmt(Math.round(fs.breakEvenPsf))}`} sub="Min to cover costs" delay={400} />
                <KpiCard label="Market Floor" value="AED 1,452" sub="DSC historical" delay={500} />
                <KpiCard label="Market Avg" value="AED 1,565" sub={`${TXN_COUNT.total}-txn avg`} accent delay={600} />
                <KpiCard label="Market Ceiling" value="AED 1,800" sub="Premium" delay={700} />
                <KpiCard label="Buffer" value={`+AED ${fmt(Math.round(1565 - fs.breakEvenPsf))}`} sub="vs break-even" delay={800} />
              </div>
            </Section>

            {/* Developer Benchmark Sensitivity */}
            <Section num={8} title="Developer Benchmark Sensitivity" badge={`${COMPS.length} projects`} delay={400}>
              <p className="text-xs text-muted-foreground mb-3">
                Impact on your plot's feasibility if sold at each DSC developer's average PSF
              </p>
              <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['Developer', 'Project', 'Benchmark PSF', 'Your Revenue', 'Your Profit', 'Margin', 'ROI', 'vs Base'].map(h => (
                        <TableHead key={h} className="text-xs text-right first:text-left whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COMPS.map(c => {
                      const devRevenue = fs.sellableArea * c.psf;
                      const devProfit = devRevenue - fs.totalCost;
                      const devMargin = devProfit / devRevenue;
                      const devRoi = devProfit / fs.totalCost;
                      const deltaVsBase = devRevenue - fs.grossSales;
                      return (
                        <TableRow key={c.name}>
                          <TableCell className="text-sm font-bold py-2">{c.developer}</TableCell>
                          <TableCell className="text-sm text-right text-muted-foreground py-2">{c.name}</TableCell>
                          <TableCell className="text-sm text-right font-mono py-2">AED {fmt(c.psf)}</TableCell>
                          <TableCell className="text-sm text-right font-mono py-2">{fmtM(devRevenue)}</TableCell>
                          <TableCell className={`text-sm text-right font-mono py-2 ${devProfit > 0 ? 'text-success' : 'text-destructive'}`}>{fmtM(devProfit)}</TableCell>
                          <TableCell className={`text-sm text-right py-2 ${devMargin > 0.2 ? 'text-success' : devMargin > 0 ? 'text-warning' : 'text-destructive'}`}>{pct(devMargin)}</TableCell>
                          <TableCell className={`text-sm text-right py-2 ${devRoi > 0.15 ? 'text-success' : devRoi > 0 ? 'text-warning' : 'text-destructive'}`}>{pct(devRoi)}</TableCell>
                          <TableCell className={`text-sm text-right font-mono py-2 ${deltaVsBase >= 0 ? 'text-success' : 'text-warning'}`}>
                            {deltaVsBase >= 0 ? '+' : ''}{fmtM(deltaVsBase)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-primary/5 border-t-2 border-primary/30">
                      <TableCell className="text-sm font-bold text-primary py-2">Your Plot</TableCell>
                      <TableCell className="text-sm text-right text-primary py-2">{link.plotId}</TableCell>
                      <TableCell className="text-sm text-right font-mono font-bold text-primary py-2">AED {fmt(Math.round(fs.avgPsf))}</TableCell>
                      <TableCell className="text-sm text-right font-mono font-bold py-2">{fmtM(fs.grossSales)}</TableCell>
                      <TableCell className="text-sm text-right font-mono font-bold text-success py-2">{fmtM(fs.grossProfit)}</TableCell>
                      <TableCell className="text-sm text-right font-bold py-2">{pct(fs.grossMargin)}</TableCell>
                      <TableCell className="text-sm text-right font-bold py-2">{pct(fs.roi)}</TableCell>
                      <TableCell className="text-sm text-right text-primary font-bold py-2">BASE</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Section>
          </>
        )}

        {/* CTA - Request Full Access */}
        <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-card p-8 text-center mt-8 mb-16 animate-fade-in">
          <Lock className="w-10 h-10 text-primary mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground mb-2">Full Feasibility Report Available</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Access detailed cost breakdowns, unit mix analysis, payment plan recommendations, and developer benchmarking in the full interactive dashboard.
          </p>
          {!showRequestForm ? (
            <Button size="lg" className="gap-2" onClick={() => setShowRequestForm(true)}>
              <Shield className="w-4 h-4" />
              Request Full Access
            </Button>
          ) : (
            <div className="max-w-sm mx-auto space-y-3">
              <input type="text" placeholder="Your name" className="w-full px-4 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-foreground text-sm" />
              <input type="email" placeholder="Your email" className="w-full px-4 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-foreground text-sm" />
              <Button className="w-full gap-2" onClick={() => { setShowRequestForm(false); alert('Request submitted! The report owner will contact you.'); }}>
                Submit Request
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Unit Mix Bottom Bar ─── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 no-print">
        <div className="max-w-3xl mx-auto">
          <div className="bg-card/95 backdrop-blur-xl border border-border/50 border-b-0 rounded-t-xl px-4 py-3 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider whitespace-nowrap mr-2">Unit Mix:</span>
            {(Object.entries(MIX_TEMPLATES) as [MixKey, typeof MIX_TEMPLATES.investor][]).map(([k, v]) => (
              <div
                key={k}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-2 rounded-lg border ${
                  link.mixStrategy === k
                    ? 'bg-primary/20 border-primary/50 text-foreground'
                    : 'bg-muted/20 border-border/30 text-muted-foreground'
                }`}
              >
                <span className="text-sm">{v.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">{v.label}</span>
                <span className="text-[8px] text-muted-foreground">{v.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50 pb-20">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={xEstateLogo} alt="X-Estate" className="w-8 h-8 opacity-50" />
            <span className="text-xs text-muted-foreground">HyperPlot AI</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Confidential Feasibility Analysis • Generated {new Date(link.createdAt).toLocaleDateString()}
          </div>
        </div>
      </footer>
    </div>
  );
}

function overrideOr(overrides: any, key: string, fallback: number): number {
  return overrides?.[key] ?? fallback;
}
