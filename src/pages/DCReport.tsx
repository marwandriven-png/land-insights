import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Lock, Eye, Calendar, Printer, Building2, TrendingUp, DollarSign, BarChart3, MapPin, Share2, ChevronRight, Check, FileText, Phone, Mail, User } from 'lucide-react';
import xEstateLogo from '@/assets/X-Estate_Logo.svg';
import teaserBg from '@/assets/teaser-bg.jpg';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
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

// ─── KPI Card ───
function KpiCard({ label, value, sub, accent, delay = 0 }: { label: string; value: string; sub?: string; accent?: boolean; delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div className={`rounded-xl border p-5 transition-all duration-700 shadow-sm ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${accent ? 'border-amber-300/30 bg-gradient-to-br from-amber-50 to-white' : 'border-slate-200 bg-white'}`}>
      <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-extrabold font-mono tracking-tight ${accent ? 'text-amber-600' : 'text-slate-800'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

// ─── Section with numbered badge ───
function Section({ num, title, badge, children, delay = 0 }: { num?: number; title: string; badge?: string; children: React.ReactNode; delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div className={`mb-8 transition-all duration-700 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-200">
        {num != null && (
          <span className="w-8 h-8 flex items-center justify-center rounded-md bg-gradient-to-br from-amber-500 to-amber-600 text-white font-extrabold text-xs shrink-0">{num}</span>
        )}
        <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest">{title}</h3>
        {badge && <Badge variant="outline" className="text-xs border-amber-300 text-amber-600 ml-auto">{badge}</Badge>}
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
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-800">{value}</span>
      </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-1000" style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

// ─── Registration Step (Email + Mobile) ───
function RegistrationStep({ onComplete }: { onComplete: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; mobile?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = 'Full name is required';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Valid email is required';
    if (!mobile.trim() || mobile.replace(/\D/g, '').length < 8) e.mobile = 'Valid mobile number is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    localStorage.setItem('dc_registered_user', JSON.stringify({ name, email, mobile, registeredAt: new Date().toISOString() }));
    onComplete();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <img src={teaserBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center gap-0 mb-8">
          {[1, 2, 3].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                s <= 2 ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/40'
              }`}>{s}</div>
              {i < 2 && <div className={`w-16 h-0.5 ${s < 2 ? 'bg-amber-500' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>
        <div className="text-center mb-2">
          <span className="text-xs text-white/50 uppercase tracking-widest">Step 2 of 3</span>
        </div>
        <h1 className="text-2xl font-bold text-center text-white mb-2">Investor Registration</h1>
        <p className="text-center text-white/50 text-sm mb-6">Complete your details to access the full feasibility report</p>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 space-y-4">
          <div>
            <label className="text-xs text-white/60 font-semibold uppercase tracking-wider mb-1.5 block">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your full name"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white text-sm placeholder:text-white/25 focus:border-amber-500/50 focus:outline-none transition-colors" />
            </div>
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="text-xs text-white/60 font-semibold uppercase tracking-wider mb-1.5 block">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white text-sm placeholder:text-white/25 focus:border-amber-500/50 focus:outline-none transition-colors" />
            </div>
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="text-xs text-white/60 font-semibold uppercase tracking-wider mb-1.5 block">Mobile Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+971 XX XXX XXXX"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white text-sm placeholder:text-white/25 focus:border-amber-500/50 focus:outline-none transition-colors" />
            </div>
            {errors.mobile && <p className="text-xs text-red-400 mt-1">{errors.mobile}</p>}
          </div>
          <Button onClick={handleSubmit} className="w-full h-12 gap-2 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-black rounded-xl mt-2">
            Continue to NDA <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-white/30 text-center mt-4">Your information is encrypted and kept confidential</p>
      </div>
    </div>
  );
}

// ─── NDA Step ───
function NDAStep({ onAccept }: { onAccept: () => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <img src={teaserBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-2xl animate-fade-in">
        <div className="flex items-center justify-center gap-0 mb-8">
          {[1, 2, 3].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-amber-500 text-black">{s}</div>
              {i < 2 && <div className="w-16 h-0.5 bg-amber-500" />}
            </div>
          ))}
        </div>
        <div className="text-center mb-2">
          <span className="text-xs text-white/50 uppercase tracking-widest">Step 3 of 3</span>
        </div>
        <h1 className="text-2xl font-bold text-center text-white mb-6">Non-Disclosure Agreement</h1>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-white">Confidentiality Agreement</span>
          </div>
          <div className="rounded-lg p-4 text-sm font-mono text-white/60 max-h-48 overflow-y-auto space-y-3 border border-white/10 bg-black/20">
            <p>CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT</p>
            <p>This Confidentiality and Non-Disclosure Agreement ("Agreement") is entered into as of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
            <p>PARTIES:<br/>Disclosing Party: The Investment Sponsor ("Sponsor")<br/>Receiving Party: Company ("Recipient")</p>
            <p>PROJECT: Confidential Real Estate Investment Opportunity<br/>ASSET LOCATION: Dubai Sports City, Dubai, United Arab Emirates</p>
            <p>1. CONFIDENTIAL INFORMATION: All financial projections, feasibility analyses, development parameters, unit mix strategies, pricing models, and related data shared through this platform.</p>
            <p>2. OBLIGATIONS: The Recipient agrees to maintain strict confidentiality and not disclose, reproduce, or distribute any information without prior written consent.</p>
            <p>3. TERM: This Agreement shall remain in effect for a period of two (2) years from the date of execution.</p>
          </div>
        </div>
        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-1 w-4 h-4 rounded border-white/30 accent-amber-500" />
          <span className="text-sm text-white/60">
            I have read and agree to the terms of this Non-Disclosure Agreement. I understand that all information shared is confidential and proprietary.
          </span>
        </label>
        <Button disabled={!agreed} onClick={onAccept} className={`w-full h-12 gap-2 text-sm font-bold rounded-xl ${agreed ? 'bg-amber-500 hover:bg-amber-600 text-black' : 'bg-white/10 text-white/30'}`}>
          Accept & View Report <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Teaser Landing Page ───
function TeaserPage({ link, fs, onRequestAccess }: { link: DCShareLink; fs: DSCFeasibilityResult; onRequestAccess: () => void }) {
  const gdv = useCountUp(Math.round(fs.grossSales / 1000000), 1500);
  const roi = useCountUp(Math.round(fs.roi * 100), 1200);
  const units = useCountUp(fs.units.total, 1000);

  return (
    <div className="min-h-screen text-white flex flex-col relative">
      <img src={teaserBg} alt="" className="absolute inset-0 w-full h-full object-cover z-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/80 z-0" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 relative z-10">
        <div className="text-center max-w-2xl">
          <img src={xEstateLogo} alt="X-Estate" className="w-16 h-16 mx-auto mb-8 opacity-80" />
          <h1 className="text-5xl md:text-6xl font-black mb-3 tracking-tight leading-none animate-fade-in uppercase">
            Confidential
          </h1>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-2 animate-fade-in tracking-tight" style={{ animationDelay: '200ms' }}>
            Residential Investment
          </h2>
          <div className="w-24 h-0.5 bg-amber-500 mx-auto my-6 animate-fade-in" style={{ animationDelay: '300ms' }} />
          <p className="text-lg text-white/60 uppercase tracking-[0.3em] mb-2 animate-fade-in" style={{ animationDelay: '400ms' }}>
            Comparative Performance & Growth Indicators
          </p>
          <div className="flex items-center justify-center gap-2 text-white/50 mb-10 animate-fade-in" style={{ animationDelay: '500ms' }}>
            <MapPin className="w-4 h-4" />
            <span className="text-sm">Dubai Sports City, Dubai • UAE</span>
          </div>
          <div className="flex items-center justify-center gap-12 mb-12">
            {[
              { val: `AED ${gdv}M`, label: 'GROSS DEVELOPMENT VALUE' },
              { val: `${roi}%`, label: 'RETURN ON INVESTMENT' },
              { val: `${fmt(units)}`, label: 'TOTAL UNITS' },
            ].map((kpi, i) => (
              <div key={kpi.label} className="text-center animate-fade-in" style={{ animationDelay: `${700 + i * 150}ms` }}>
                <div className="text-3xl md:text-4xl font-black font-mono tracking-tight text-amber-400">{kpi.val}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-widest mt-2 max-w-[120px] mx-auto leading-tight">{kpi.label}</div>
              </div>
            ))}
          </div>
          <Button onClick={onRequestAccess} className="h-14 px-12 text-lg font-bold gap-2 bg-amber-500 hover:bg-amber-600 text-black rounded-xl shadow-2xl shadow-amber-500/20 animate-fade-in" style={{ animationDelay: '1100ms' }}>
            <Lock className="w-5 h-5" /> Request Full Details
          </Button>
          <p className="text-xs text-white/30 mt-4 animate-fade-in" style={{ animationDelay: '1300ms' }}>
            Registration & NDA acceptance required to view full investment details
          </p>
        </div>
      </div>

      <footer className="relative z-10 border-t border-white/10 px-6 py-4 flex items-center justify-center gap-8 text-xs text-white/25 uppercase tracking-widest">
        <span>Off-Market</span>
        <span>•</span>
        <span>Direct Mandate</span>
        <span>•</span>
        <span>Confidential</span>
        <span className="ml-auto">© {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}

export default function DCReport() {
  const { linkId } = useParams<{ linkId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [link, setLink] = useState<DCShareLink | null>(null);
  const [status, setStatus] = useState<'loading' | 'valid' | 'expired' | 'revoked' | 'not_found'>('loading');
  const [activeTab, setActiveTab] = useState<'feasibility' | 'benchmarks' | 'sensitivity'>('feasibility');
  const [accessPhase, setAccessPhase] = useState<'teaser' | 'register' | 'nda' | 'full'>('teaser');

  useEffect(() => {
    // First try URL-encoded payload (works cross-browser)
    const encoded = searchParams.get('d');
    if (encoded) {
      try {
        const payload = JSON.parse(decodeURIComponent(atob(encoded)));
        const linkData: DCShareLink = {
          id: payload.id,
          plotId: payload.plotId,
          mixStrategy: payload.mix as MixKey,
          plotInput: payload.input,
          overrides: payload.overrides || {},
          createdAt: payload.createdAt,
          expiresAt: payload.expiresAt,
          views: 0, downloads: 0, isActive: true,
          url: window.location.href,
        };
        if (linkData.expiresAt && new Date(linkData.expiresAt) < new Date()) {
          setLink(linkData);
          setStatus('expired');
          return;
        }
        setLink(linkData);
        setStatus('valid');
        return;
      } catch (e) {
        console.error('Failed to decode share link payload:', e);
      }
    }

    // Fallback: check localStorage (same-browser only)
    const links = loadShareLinks();
    const found = links.find(l => l.id === linkId);
    if (!found) { setStatus('not_found'); return; }
    if (!found.isActive) { setLink(found); setStatus('revoked'); return; }
    if (found.expiresAt && new Date(found.expiresAt) < new Date()) { setLink(found); setStatus('expired'); return; }
    found.views += 1;
    saveShareLinks(links.map(l => l.id === found.id ? found : l));
    setLink(found);
    setStatus('valid');
  }, [linkId, searchParams]);

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
          <Calendar className="w-16 h-16 text-amber-500/50 mx-auto mb-4" />
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

  // Access flow: Teaser → Register → NDA → Full Report
  if (accessPhase === 'teaser') {
    return <TeaserPage link={link} fs={fs} onRequestAccess={() => setAccessPhase('register')} />;
  }

  if (accessPhase === 'register') {
    return <RegistrationStep onComplete={() => setAccessPhase('nda')} />;
  }

  if (accessPhase === 'nda') {
    return <NDAStep onAccept={() => setAccessPhase('full')} />;
  }

  const mixTemplate = MIX_TEMPLATES[link.mixStrategy];
  const equityAmt = fs.totalCost * 0.4;
  const debtAmt = fs.totalCost * 0.6;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Nav Header */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-xl sticky top-0 z-50 no-print shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={xEstateLogo} alt="X-Estate" className="w-10 h-10" />
            <div>
              <h1 className="text-lg font-bold text-slate-800">HyperPlot AI</h1>
              <p className="text-xs text-slate-400">Dubai Real Estate Feasibility</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <Badge variant="outline" className="text-xs border-amber-300 text-amber-600 bg-amber-50 gap-1">
              <Check className="w-3 h-3" /> LIVE DATA
            </Badge>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-300 text-slate-600 hover:bg-slate-50" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            <Button size="sm" className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-black font-bold">
              <Share2 className="w-3.5 h-3.5" /> Share Link
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-white to-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-10">
           <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold text-amber-600 uppercase tracking-wider">🏆 Decision Confidence</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">
            Feasibility Analysis: <span className="text-amber-600">Plot {link.plotId}</span>
          </h2>
          <p className="text-slate-500 max-w-2xl">
            Residential development opportunity analysis with strategic recommendations and financial projections
          </p>
          <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">📅 Generated: {new Date(link.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            <span className="flex items-center gap-1">📍 Dubai Sports City (DSC)</span>
            <span className="flex items-center gap-1 text-amber-500">🔒 Secure Link</span>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 py-6">
          <KpiCard label="Total GDV" value={fmtM(fs.grossSales)} sub={`Avg PSF: AED ${fmt(Math.round(fs.avgPsf))}`} accent delay={100} />
          <KpiCard label="Total Cost" value={fmtM(fs.totalCost)} sub={`${pct(fs.totalCost / fs.grossSales)} of GDV`} delay={200} />
          <KpiCard label="Net Profit" value={fmtM(fs.grossProfit)} sub={`Margin: ${pct(fs.grossMargin)}`} delay={300} />
          <KpiCard label="ROI" value={pct(fs.roi)} sub="Return on cost" accent delay={400} />
          <KpiCard label="Units" value={fmt(fs.units.total)} sub={`${fmt(Math.round(fs.sellableArea))} sqft sellable`} delay={500} />
          <KpiCard label="Yield" value={pct(fs.grossYield)} sub="Annual rent / GDV" delay={600} />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-[57px] z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200 no-print shadow-sm">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-0">
            {([
              ['feasibility', '📊', 'Feasibility'],
              ['benchmarks', '📐', 'Benchmarks'],
              ['sensitivity', '📈', 'Sensitivity'],
            ] as const).map(([k, icon, l]) => (
              <button
                key={k}
                onClick={() => setActiveTab(k)}
                className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === k
                    ? 'text-amber-600 border-amber-500'
                    : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}
              >
                <span>{icon}</span> {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">

        {activeTab === 'feasibility' && (
          <>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6 flex items-center gap-3 animate-fade-in">
              <span className="text-2xl">{mixTemplate.icon}</span>
              <div>
                <div className="text-sm font-bold text-slate-800">Selected Strategy: {mixTemplate.label}</div>
                <div className="text-xs text-slate-500">{mixTemplate.desc}</div>
              </div>
            </div>

            <Section num={1} title="Development Configuration" delay={200}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Plot Details</h4>
                  <div className="space-y-2">
                    {[
                      ['Plot Area', `${fmt(Math.round(fs.plot.area))} sqft`],
                      ['Plot Ratio', `× ${fs.plot.ratio.toFixed(2)}`],
                      ['GFA', `${fmt(Math.round(fs.gfa))} sqft`],
                      ['BUA', `${fmt(Math.round(fs.bua))} sqft`],
                      ['Approved Height', fs.plot.height],
                    ].map(([param, val]) => (
                      <div key={param as string} className="flex justify-between py-1.5 border-b border-slate-100 last:border-0">
                        <span className="text-sm text-slate-500">{param}</span>
                        <span className="text-sm font-semibold font-mono text-slate-800">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Efficiency Metrics</h4>
                  <MetricBar label="Sellable Area" value={`${fmt(Math.round(fs.sellableArea))} sqft (95%)`} percent={95} />
                  <MetricBar label="GFA Utilization" value="100%" percent={100} />
                  <MetricBar label="Avg Selling PSF" value={`AED ${fmt(Math.round(fs.avgPsf))}`} percent={Math.min((fs.avgPsf / 2000) * 100, 100)} />
                </div>
              </div>
            </Section>

            <Section num={2} title="Recommended Unit Mix" delay={400}>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
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

            <Section num={3} title="Financial Feasibility" delay={600}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Cost Breakdown</h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Land Cost', sub: 'Including transfer fees', val: fs.landCost, pctGdv: fs.landCost / fs.grossSales },
                      { label: 'Construction', sub: `AED 420/sqft BUA`, val: fs.constructionCost, pctGdv: fs.constructionCost / fs.grossSales },
                      { label: 'Soft Costs', sub: 'Design, permits, legal', val: fs.authorityFees + fs.consultantFees + fs.marketing, pctGdv: (fs.authorityFees + fs.consultantFees + fs.marketing) / fs.grossSales },
                      { label: 'Contingency', sub: '5% buffer', val: fs.contingency, pctGdv: fs.contingency / fs.grossSales },
                    ].map(c => (
                      <div key={c.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                        <div>
                          <div className="text-sm font-medium text-slate-800">{c.label}</div>
                          <div className="text-xs text-slate-400">{c.sub}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold font-mono text-slate-800">{fmtM(c.val)}</div>
                          <div className="text-xs text-slate-400">{pct(c.pctGdv)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Return Metrics</h4>
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-slate-500">Project ROI</span>
                      <span className="text-2xl font-extrabold text-amber-600 font-mono">{pct(fs.roi)}</span>
                    </div>
                    <Progress value={Math.min(fs.roi * 100, 100)} className="h-2" />
                    <div className="flex justify-between mt-1 text-xs text-slate-400">
                      <span>Industry avg: 20%</span>
                      <span className="text-emerald-500 font-bold">{fs.roi > 0.2 ? 'Excellent' : fs.roi > 0.1 ? 'Good' : 'Below avg'}</span>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-slate-500">Profit Margin</span>
                      <span className="text-lg font-bold font-mono text-slate-800">{pct(fs.grossMargin)}</span>
                    </div>
                    <Progress value={Math.min(fs.grossMargin * 100, 100)} className="h-2" />
                  </div>
                  <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-bold text-slate-500 uppercase">Finance Structure</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="text-center p-2 rounded-lg bg-amber-50 border border-amber-200">
                        <div className="text-xs text-slate-500">Equity (40%)</div>
                        <div className="text-sm font-bold font-mono text-amber-600">{fmtM(equityAmt)}</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                        <div className="text-xs text-slate-500">Debt (60%)</div>
                        <div className="text-sm font-bold font-mono text-slate-800">{fmtM(debtAmt)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section num={4} title="Recommended Payment Plan" delay={800}>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(fs.payPlan).map(([stage, pctVal]) => (
                  <div key={stage} className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                    <div className="text-4xl font-extrabold text-amber-600 font-mono mb-2">{pctVal}%</div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {stage === 'booking' ? 'On Booking' : stage === 'construction' ? 'During Construction' : 'Upon Handover'}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">{fmtA(fs.grossSales * pctVal / 100)}</div>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {activeTab === 'benchmarks' && (
          <Section title="DSC Market Benchmarks" badge={`${COMPS.length} projects`} delay={200}>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
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
            <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
              <strong className="text-slate-800">Market Intelligence:</strong> DSC sales avg AED 1,565/sqft ({TXN_COUNT.total} txns) · Rental avg AED 86/sqft/yr
            </div>
          </Section>
        )}

        {activeTab === 'sensitivity' && (
          <>
            <Section num={5} title="Price Sensitivity Analysis" badge="±10% Range" delay={200}>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
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
                        <TableRow key={i} className={isBase ? 'bg-amber-50' : ''}>
                          <TableCell className={`text-xs font-bold py-2 ${isBase ? 'text-amber-600' : s.delta > 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
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
            </Section>

            <Section num={6} title="Developer Benchmark Sensitivity" badge={`${COMPS.length} projects`} delay={400}>
              <p className="text-xs text-slate-500 mb-3">
                Impact on your plot's feasibility if sold at each DSC developer's average PSF
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {['Developer', 'Project', 'PSF', 'Revenue', 'Profit', 'Margin', 'ROI'].map(h => (
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
                      return (
                        <TableRow key={c.name}>
                          <TableCell className="text-sm font-bold py-2">{c.developer}</TableCell>
                          <TableCell className="text-sm text-right text-muted-foreground py-2">{c.name}</TableCell>
                          <TableCell className="text-sm text-right font-mono py-2">AED {fmt(c.psf)}</TableCell>
                          <TableCell className="text-sm text-right font-mono py-2">{fmtM(devRevenue)}</TableCell>
                          <TableCell className={`text-sm text-right font-mono py-2 ${devProfit > 0 ? 'text-success' : 'text-destructive'}`}>{fmtM(devProfit)}</TableCell>
                          <TableCell className={`text-sm text-right py-2 ${devMargin > 0.2 ? 'text-success' : 'text-warning'}`}>{pct(devMargin)}</TableCell>
                          <TableCell className={`text-sm text-right py-2 ${devRoi > 0.15 ? 'text-success' : 'text-warning'}`}>{pct(devRoi)}</TableCell>
                        </TableRow>
                      );
                    })}
                     <TableRow className="bg-amber-50 border-t-2 border-amber-400">
                      <TableCell className="text-sm font-bold text-amber-600 py-2">Your Plot</TableCell>
                      <TableCell className="text-sm text-right text-amber-600 py-2">{link.plotId}</TableCell>
                      <TableCell className="text-sm text-right font-mono font-bold text-amber-600 py-2">AED {fmt(Math.round(fs.avgPsf))}</TableCell>
                      <TableCell className="text-sm text-right font-mono font-bold py-2">{fmtM(fs.grossSales)}</TableCell>
                      <TableCell className="text-sm text-right font-mono font-bold text-emerald-500 py-2">{fmtM(fs.grossProfit)}</TableCell>
                      <TableCell className="text-sm text-right font-bold py-2">{pct(fs.grossMargin)}</TableCell>
                      <TableCell className="text-sm text-right font-bold py-2">{pct(fs.roi)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Section>
          </>
        )}
      </div>

      {/* Unit Mix Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 no-print">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-slate-900/95 backdrop-blur-xl border border-amber-500/20 border-b-0 rounded-t-xl px-4 py-3 shadow-2xl shadow-black/30">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-amber-400/60 font-bold uppercase tracking-wider whitespace-nowrap shrink-0">Strategy:</span>
              {(Object.entries(MIX_TEMPLATES) as [MixKey, typeof MIX_TEMPLATES.investor][]).map(([k, v]) => {
                const isActive = link.mixStrategy === k;
                return (
                  <div
                    key={k}
                    className={`flex items-center gap-2 py-2 px-3 rounded-lg border transition-all shrink-0 ${
                      isActive
                        ? 'bg-amber-500/15 border-amber-500/40 text-white'
                        : 'bg-white/5 border-white/10 text-white/40'
                    }`}
                  >
                    <span className="text-base">{v.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{v.label}</div>
                      <div className={`text-[10px] ${isActive ? 'text-amber-400/70' : 'text-white/25'} truncate`}>{v.tag}</div>
                    </div>
                  </div>
                );
              })}
              {/* Stats shown separately to avoid overflow */}
              <div className="ml-auto text-[10px] font-mono text-amber-400/70 whitespace-nowrap shrink-0">
                Units: {fmt(fs.units.total)} · ROI: {pct(fs.roi)} · PSF: {fmt(Math.round(fs.avgPsf))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white pb-24">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={xEstateLogo} alt="X-Estate" className="w-8 h-8 opacity-50" />
            <span className="text-xs text-slate-400">HyperPlot AI · Decision Confidence</span>
          </div>
          <div className="text-xs text-slate-400">
            Confidential Feasibility Analysis • Generated {new Date(link.createdAt).toLocaleDateString()}
          </div>
        </div>
      </footer>
    </div>
  );
}
