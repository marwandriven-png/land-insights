import { useState, useMemo, useEffect, useRef } from 'react';
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
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, enabled]);
  return value;
}

// ─── KPI Card – dark theme with glow ───
function KpiCard({ label, rawValue, formatter, sub, color = 'cyan', delay = 0 }: { label: string; rawValue: number; formatter: (v: number) => string; sub?: string; color?: 'cyan' | 'teal' | 'green' | 'white' | 'purple'; delay?: number }) {
  const [show, setShow] = useState(false);
  const animVal = useCountUp(rawValue, 1500, show);
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t); }, [delay]);

  const colorMap = {
    cyan: 'text-cyan-400',
    teal: 'text-teal-400',
    green: 'text-green-400',
    white: 'text-white',
    purple: 'text-purple-400',
  };
  const glowMap = {
    cyan: '0 0 20px rgba(6, 182, 212, 0.5)',
    teal: '0 0 20px rgba(20, 184, 166, 0.5)',
    green: '0 0 20px rgba(16, 185, 129, 0.5)',
    white: 'none',
    purple: '0 0 20px rgba(139, 92, 246, 0.5)',
  };

  return (
    <div className={`rounded-xl p-4 transition-all duration-700 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.9), rgba(17, 24, 39, 0.6))', border: '1px solid #1f2937', backdropFilter: 'blur(10px)' }}>
      <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-extrabold font-mono tracking-tight ${colorMap[color]}`} style={{ textShadow: glowMap[color] }}>{formatter(animVal)}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

// ─── Section with numbered badge ───
function Section({ num, title, badge, children, delay = 0 }: { num?: number; title: string; badge?: string; children: React.ReactNode; delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div className={`mb-8 transition-all duration-700 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-gray-700/50">
        {num != null && (
          <span className="w-8 h-8 flex items-center justify-center rounded-md bg-gradient-to-br from-cyan-500 to-teal-600 text-white font-extrabold text-xs shrink-0">{num}</span>
        )}
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">{title}</h3>
        {badge && <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400 ml-auto">{badge}</Badge>}
      </div>
      {children}
    </div>
  );
}

// ─── Progress bar – dark theme ───
function MetricBar({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1.5 text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="font-semibold text-gray-200">{value}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1f2937' }}>
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(percent, 100)}%`, background: 'linear-gradient(90deg, #06b6d4, #14b8a6)' }} />
      </div>
    </div>
  );
}

// ─── Animated Grid Background ───
function AnimatedBackground() {
  return (
    <>
      <div className="fixed inset-0 z-0 opacity-30 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        animation: 'gridMove 20s linear infinite',
      }} />
      <div className="fixed top-1/4 left-1/4 w-[500px] h-[500px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(6, 182, 212, 0.12), transparent 70%)', filter: 'blur(80px)', animation: 'float 10s ease-in-out infinite' }} />
      <div className="fixed bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.08), transparent 70%)', filter: 'blur(80px)', animation: 'float 12s ease-in-out infinite reverse' }} />
    </>
  );
}

// ─── Registration Step ───
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
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: '#0a0e1a' }}>
      <AnimatedBackground />
      <div className="absolute inset-0 z-[1]" style={{ background: 'linear-gradient(to bottom, rgba(10,14,26,0.9), rgba(10,14,26,0.8), rgba(10,14,26,0.95))' }} />
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center gap-0 mb-8">
          {[1, 2, 3].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                s <= 2 ? 'bg-gradient-to-br from-cyan-400 to-teal-500 text-black shadow-lg' : 'text-white/30 border border-white/10'
              }`} style={s <= 2 ? { boxShadow: '0 0 15px rgba(6,182,212,0.3)' } : { background: 'rgba(255,255,255,0.05)' }}>{s}</div>
              {i < 2 && <div className={`w-16 h-0.5 ${s < 2 ? 'bg-gradient-to-r from-cyan-400 to-teal-500' : ''}`} style={s >= 2 ? { background: 'rgba(255,255,255,0.1)' } : {}} />}
            </div>
          ))}
        </div>
        <div className="text-center mb-2">
          <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(6,182,212,0.6)' }}>Step 2 of 3</span>
        </div>
        <h1 className="text-2xl font-bold text-center text-white mb-2">Investor Registration</h1>
        <p className="text-center text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>Complete your details to access the full feasibility report</p>

        <div className="rounded-2xl p-6 space-y-4 shadow-2xl" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)' }}>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(6,182,212,0.6)' }}>Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.2)' }} />
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your full name"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-white text-sm transition-all focus:outline-none" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f3f4f6' }}
                onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.5)'; e.target.style.boxShadow = '0 0 15px rgba(6,182,212,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
            </div>
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(6,182,212,0.6)' }}>Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.2)' }} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all focus:outline-none" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f3f4f6' }}
                onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.5)'; e.target.style.boxShadow = '0 0 15px rgba(6,182,212,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
            </div>
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(6,182,212,0.6)' }}>Mobile Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.2)' }} />
              <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+971 XX XXX XXXX"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all focus:outline-none" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f3f4f6' }}
                onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.5)'; e.target.style.boxShadow = '0 0 15px rgba(6,182,212,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
            </div>
            {errors.mobile && <p className="text-xs text-red-400 mt-1">{errors.mobile}</p>}
          </div>
          <Button onClick={handleSubmit} className="w-full h-12 gap-2 text-sm font-bold rounded-xl mt-2 text-black" style={{ background: 'linear-gradient(to right, #06b6d4, #14b8a6)', boxShadow: '0 10px 30px rgba(6,182,212,0.2)' }}>
            Continue to NDA <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-center mt-4" style={{ color: 'rgba(255,255,255,0.2)' }}>Your information is encrypted and kept confidential</p>
      </div>
    </div>
  );
}

// ─── NDA Step ───
function NDAStep({ onAccept }: { onAccept: () => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: '#0a0e1a' }}>
      <AnimatedBackground />
      <div className="absolute inset-0 z-[1]" style={{ background: 'linear-gradient(to bottom, rgba(10,14,26,0.9), rgba(10,14,26,0.8), rgba(10,14,26,0.95))' }} />
      <div className="relative z-10 w-full max-w-2xl animate-fade-in">
        <div className="flex items-center justify-center gap-0 mb-8">
          {[1, 2, 3].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br from-cyan-400 to-teal-500 text-black" style={{ boxShadow: '0 0 15px rgba(6,182,212,0.3)' }}>{s}</div>
              {i < 2 && <div className="w-16 h-0.5 bg-gradient-to-r from-cyan-400 to-teal-500" />}
            </div>
          ))}
        </div>
        <div className="text-center mb-2">
          <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(6,182,212,0.6)' }}>Step 3 of 3</span>
        </div>
        <h1 className="text-2xl font-bold text-center text-white mb-6">Non-Disclosure Agreement</h1>
        <div className="rounded-2xl p-6 mb-6 shadow-2xl" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span className="font-bold text-white">Confidentiality Agreement</span>
          </div>
          <div className="rounded-lg p-4 text-sm font-mono max-h-48 overflow-y-auto space-y-3" style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}>
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
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-1 w-4 h-4 rounded accent-cyan-500" style={{ borderColor: 'rgba(255,255,255,0.3)' }} />
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            I have read and agree to the terms of this Non-Disclosure Agreement. I understand that all information shared is confidential and proprietary.
          </span>
        </label>
        <Button disabled={!agreed} onClick={onAccept} className={`w-full h-12 gap-2 text-sm font-bold rounded-xl transition-all ${agreed ? 'text-black' : ''}`}
          style={agreed ? { background: 'linear-gradient(to right, #06b6d4, #14b8a6)', boxShadow: '0 10px 30px rgba(6,182,212,0.2)' } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}>
          Accept & View Report <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Teaser Landing Page ───
function TeaserPage({ link, fs, onRequestAccess }: { link: DCShareLink; fs: DSCFeasibilityResult; onRequestAccess: () => void }) {
  const gdv = useCountUp(Math.round(fs.grossSales / 1000000), 1800);
  const roi = useCountUp(Math.round(fs.roi * 100), 1400);
  const units = useCountUp(fs.units.total, 1200);

  return (
    <div className="min-h-screen text-white flex flex-col relative overflow-hidden" style={{ background: '#0a0e1a' }}>
      <AnimatedBackground />

      <header className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <img src={xEstateLogo} alt="X-Estate" className="w-10 h-10 opacity-70" />
          <div>
            <h1 className="text-lg font-bold text-white">HyperPlot <span className="text-cyan-400">AI</span></h1>
            <p className="text-xs" style={{ color: 'rgba(6,182,212,0.5)' }}>Dubai Sports City Feasibility Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
            <span className="w-2 h-2 rounded-full inline-block animate-pulse" style={{ background: '#4ade80' }} /> Live Data
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        <div className="text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 animate-fade-in" style={{ border: '1px solid rgba(6,182,212,0.3)', background: 'rgba(6,182,212,0.1)' }}>
            <span className="text-xs text-cyan-400 font-semibold uppercase tracking-widest">🏆 Decision Confidence</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black mb-3 tracking-tight leading-none animate-fade-in uppercase bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            Confidential
          </h1>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-2 animate-fade-in tracking-tight" style={{ color: 'rgba(255,255,255,0.8)', animationDelay: '200ms' }}>
            Residential Investment
          </h2>
          <div className="w-32 h-0.5 mx-auto my-8 animate-fade-in" style={{ background: 'linear-gradient(to right, transparent, #06b6d4, transparent)', animationDelay: '300ms' }} />
          <p className="text-sm uppercase tracking-[0.3em] mb-2 animate-fade-in" style={{ color: 'rgba(6,182,212,0.4)', animationDelay: '400ms' }}>
            Comparative Performance & Growth Indicators
          </p>
          <div className="flex items-center justify-center gap-2 mb-12 animate-fade-in" style={{ color: 'rgba(255,255,255,0.3)', animationDelay: '500ms' }}>
            <MapPin className="w-4 h-4" style={{ color: 'rgba(6,182,212,0.4)' }} />
            <span className="text-sm">Dubai Sports City, Dubai • UAE</span>
          </div>

          <div className="flex items-center justify-center gap-6 md:gap-10 mb-14">
            {[
              { val: `AED ${Math.round(gdv)}M`, label: 'GROSS DEVELOPMENT VALUE' },
              { val: `${Math.round(roi)}%`, label: 'RETURN ON INVESTMENT' },
              { val: `${fmt(Math.round(units))}`, label: 'TOTAL UNITS' },
            ].map((kpi, i) => (
              <div key={kpi.label} className="text-center animate-fade-in group" style={{ animationDelay: `${700 + i * 150}ms` }}>
                <div className="rounded-xl p-5 mb-2 transition-all duration-300 group-hover:shadow-lg" style={{ border: '1px solid rgba(6,182,212,0.2)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(4px)' }}>
                  <div className="text-3xl md:text-4xl font-black font-mono tracking-tight text-cyan-400" style={{ textShadow: '0 0 30px rgba(6, 182, 212, 0.3)' }}>{kpi.val}</div>
                </div>
                <div className="text-[10px] uppercase tracking-widest mt-2 max-w-[120px] mx-auto leading-tight" style={{ color: 'rgba(255,255,255,0.3)' }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          <Button onClick={onRequestAccess} className="h-14 px-12 text-lg font-bold gap-2 text-black rounded-xl animate-fade-in transition-all hover:scale-[1.02]" style={{ background: 'linear-gradient(to right, #06b6d4, #14b8a6)', boxShadow: '0 10px 40px rgba(6,182,212,0.2)', animationDelay: '1100ms' }}>
            <Lock className="w-5 h-5" /> Request Full Details
          </Button>
          <p className="text-xs mt-4 animate-fade-in" style={{ color: 'rgba(255,255,255,0.2)', animationDelay: '1300ms' }}>
            Registration & NDA acceptance required to view full investment details
          </p>
        </div>
      </div>

      <footer className="relative z-10 px-6 py-4 flex items-center justify-center gap-8 text-xs uppercase tracking-widest" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.15)' }}>
        <span>Off-Market</span>
        <span style={{ color: 'rgba(6,182,212,0.2)' }}>•</span>
        <span>Direct Mandate</span>
        <span style={{ color: 'rgba(6,182,212,0.2)' }}>•</span>
        <span>Confidential</span>
        <span className="ml-auto" style={{ color: 'rgba(255,255,255,0.1)' }}>© {new Date().getFullYear()}</span>
      </footer>

      <style>{`
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
      `}</style>
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
  const [activeMix, setActiveMix] = useState<MixKey>('balanced');

  useEffect(() => {
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
        setActiveMix(linkData.mixStrategy);
        setStatus('valid');
        return;
      } catch (e) {
        console.error('Failed to decode share link payload:', e);
      }
    }

    const links = loadShareLinks();
    const found = links.find(l => l.id === linkId);
    if (!found) { setStatus('not_found'); return; }
    if (!found.isActive) { setLink(found); setStatus('revoked'); return; }
    if (found.expiresAt && new Date(found.expiresAt) < new Date()) { setLink(found); setStatus('expired'); return; }
    found.views += 1;
    saveShareLinks(links.map(l => l.id === found.id ? found : l));
    setLink(found);
    setActiveMix(found.mixStrategy);
    setStatus('valid');
  }, [linkId, searchParams]);

  const fs = useMemo(() => {
    if (!link) return null;
    const input: DSCPlotInput = link.plotInput || {
      id: link.plotId, name: `Plot ${link.plotId}`,
      area: 55284, ratio: 5.87, height: '0m',
      zone: 'Commercial-Residential', constraints: 'Standard guidelines',
    };
    return calcDSCFeasibility(input, activeMix, link.overrides as any || {});
  }, [link, activeMix]);

  // Status screens
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0e1a' }}>
        <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0e1a' }}>
        <AnimatedBackground />
        <div className="text-center max-w-md mx-auto p-8 relative z-10">
          <Shield className="w-16 h-16 mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.1)' }} />
          <h1 className="text-2xl font-bold text-white mb-2">Link Not Found</h1>
          <p className="mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>This feasibility link does not exist or has been removed.</p>
          <Button onClick={() => navigate('/')} variant="outline" className="text-white/60 hover:bg-white/5" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (status === 'revoked') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0e1a' }}>
        <AnimatedBackground />
        <div className="text-center max-w-md mx-auto p-8 relative z-10">
          <Lock className="w-16 h-16 mx-auto mb-4" style={{ color: 'rgba(239,68,68,0.3)' }} />
          <h1 className="text-2xl font-bold text-white mb-2">Access Revoked</h1>
          <p className="mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>This feasibility link has been revoked by the owner.</p>
          <Button onClick={() => navigate('/')} variant="outline" className="text-white/60 hover:bg-white/5" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0e1a' }}>
        <AnimatedBackground />
        <div className="text-center max-w-md mx-auto p-8 relative z-10">
          <Calendar className="w-16 h-16 mx-auto mb-4" style={{ color: 'rgba(245,158,11,0.3)' }} />
          <h1 className="text-2xl font-bold text-white mb-2">Link Expired</h1>
          <p className="mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Expired on {link?.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : 'N/A'}.
          </p>
          <Button onClick={() => navigate('/')} variant="outline" className="text-white/60 hover:bg-white/5" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (!link || !fs) return null;

  if (accessPhase === 'teaser') {
    return <TeaserPage link={link} fs={fs} onRequestAccess={() => setAccessPhase('register')} />;
  }
  if (accessPhase === 'register') {
    return <RegistrationStep onComplete={() => setAccessPhase('nda')} />;
  }
  if (accessPhase === 'nda') {
    return <NDAStep onAccept={() => setAccessPhase('full')} />;
  }

  const mixTemplate = MIX_TEMPLATES[activeMix];
  const equityAmt = fs.totalCost * 0.4;
  const debtAmt = fs.totalCost * 0.6;

  // Card & table shared styles
  const cardStyle = { background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.9), rgba(17, 24, 39, 0.6))', border: '1px solid #1f2937', backdropFilter: 'blur(10px)' };
  const tableWrapStyle = { ...cardStyle, overflow: 'hidden' };

  return (
    <div className="min-h-screen relative" style={{ background: '#0a0e1a', color: '#f3f4f6' }}>
      <AnimatedBackground />

      {/* Nav Header */}
      <header className="sticky top-0 z-50 no-print" style={{ background: 'rgba(17,24,39,0.95)', borderBottom: '1px solid #1f2937', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg" style={{ background: 'linear-gradient(to bottom right, #06b6d4, #0d9488)', boxShadow: '0 0 15px rgba(6,182,212,0.3)' }}>
              <img src={xEstateLogo} alt="X-Estate" className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">HyperPlot <span className="text-cyan-400">AI</span></h1>
              <p className="text-xs" style={{ color: '#9ca3af' }}>Dubai Sports City Feasibility Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mr-3" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
              <span className="w-2 h-2 rounded-full inline-block animate-pulse" style={{ background: '#4ade80' }} /> Live Data
            </div>
            <button onClick={() => window.print()} className="p-2.5 rounded-lg transition-colors" style={{ color: '#9ca3af' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(17,24,39,0.8)'; e.currentTarget.style.color = '#06b6d4'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}>
              <Printer className="w-4 h-4" />
            </button>
            <button className="p-2.5 rounded-lg transition-colors" style={{ color: '#9ca3af' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(17,24,39,0.8)'; e.currentTarget.style.color = '#a855f7'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}>
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative z-10" style={{ borderBottom: '1px solid #1f2937' }}>
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)' }}>
            <span className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">🏆 Decision Confidence</span>
          </div>
          <h2 className="text-5xl font-bold mb-2 bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
            Dubai Sports City
          </h2>
          <p className="text-xl mb-4" style={{ color: '#9ca3af' }}>
            Plot {link.plotId} • Residential Development
          </p>
          <div className="flex items-center gap-4 text-sm" style={{ color: '#6b7280' }}>
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> Dubai Sports City (DSC)</span>
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(link.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 py-6">
          <KpiCard label="Total GDV" rawValue={fs.grossSales} formatter={v => fmtM(v)} sub={`Avg PSF: ${fmt(Math.round(fs.avgPsf))}`} color="cyan" delay={100} />
          <KpiCard label="Total Cost" rawValue={fs.totalCost} formatter={v => fmtM(v)} sub={`${pct(fs.totalCost / fs.grossSales)} of GDV`} color="white" delay={200} />
          <KpiCard label="Net Profit" rawValue={fs.grossProfit} formatter={v => fmtM(v)} sub={`Margin: ${pct(fs.grossMargin)}`} color="teal" delay={300} />
          <KpiCard label="ROI" rawValue={fs.roi * 100} formatter={v => `${v.toFixed(1)}%`} sub="Return on cost" color="green" delay={400} />
          <KpiCard label="Units" rawValue={fs.units.total} formatter={v => fmt(Math.round(v))} sub={`${fmt(Math.round(fs.bua))} sqft BUA`} color="white" delay={500} />
          <KpiCard label="Break-even" rawValue={fs.totalCost / fs.sellableArea} formatter={v => fmt(Math.round(v))} sub={`vs ${fmt(Math.round(fs.avgPsf))} mkt avg`} color="cyan" delay={600} />
          <KpiCard label="Yield" rawValue={fs.grossYield * 100} formatter={v => `${v.toFixed(1)}%`} sub="rent / GDV" color="purple" delay={700} />
        </div>
      </div>

      {/* Strategy Selection Cards */}
      <div className="max-w-7xl mx-auto px-6 pb-4 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.entries(MIX_TEMPLATES) as [MixKey, typeof MIX_TEMPLATES.investor][]).map(([k, v]) => {
            const isActive = activeMix === k;
            return (
              <button
                key={k}
                onClick={() => setActiveMix(k)}
                className={`rounded-xl p-5 text-left transition-all duration-300 cursor-pointer ${isActive ? '' : 'opacity-60 hover:opacity-80'}`}
                style={isActive ? {
                  background: 'linear-gradient(to bottom right, rgba(6,182,212,0.1), transparent)',
                  border: '2px solid rgba(6,182,212,0.5)',
                  boxShadow: '0 0 20px rgba(6,182,212,0.3)',
                } : {
                  ...cardStyle,
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: isActive ? 'rgba(6,182,212,0.2)' : 'rgba(20,184,166,0.2)' }}>
                    <span className="text-lg">{v.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{v.label.toUpperCase()}</h4>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>{v.tag}</p>
                  </div>
                </div>
                {isActive && <div className="text-xs text-cyan-400 font-medium">Currently Selected</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-[57px] z-40 no-print relative" style={{ background: 'rgba(17,24,39,0.95)', borderBottom: '1px solid #1f2937', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-6">
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
                    ? 'text-cyan-400 border-cyan-400'
                    : 'border-transparent hover:text-gray-300'
                }`}
                style={activeTab !== k ? { color: '#6b7280' } : {}}
              >
                <span>{icon}</span> {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">

        {activeTab === 'feasibility' && (
          <>
            <Section num={1} title="Development Configuration" delay={200}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl p-5" style={cardStyle}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9ca3af' }}>Plot Details</h4>
                  <div className="space-y-2">
                    {[
                      ['Plot Area', `${fmt(Math.round(fs.plot.area))} sqft`],
                      ['Plot Ratio', `× ${fs.plot.ratio.toFixed(2)}`],
                      ['GFA', `${fmt(Math.round(fs.gfa))} sqft`],
                      ['BUA', `${fmt(Math.round(fs.bua))} sqft`],
                      ['Approved Height', fs.plot.height],
                    ].map(([param, val]) => (
                      <div key={param as string} className="flex justify-between py-1.5 last:border-0" style={{ borderBottom: '1px solid rgba(31,41,55,0.5)' }}>
                        <span className="text-sm" style={{ color: '#9ca3af' }}>{param}</span>
                        <span className="text-sm font-semibold font-mono text-white">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl p-5" style={cardStyle}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9ca3af' }}>Efficiency Metrics</h4>
                  <MetricBar label="Sellable Area" value={`${fmt(Math.round(fs.sellableArea))} sqft (95%)`} percent={95} />
                  <MetricBar label="GFA Utilization" value="100%" percent={100} />
                  <MetricBar label="Avg Selling PSF" value={`AED ${fmt(Math.round(fs.avgPsf))}`} percent={Math.min((fs.avgPsf / 2000) * 100, 100)} />
                </div>
              </div>
            </Section>

            <Section num={2} title="Recommended Unit Mix" delay={400}>
              <div className="overflow-x-auto rounded-xl" style={tableWrapStyle}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ borderBottom: '1px solid #1f2937' }}>
                      {['Unit Type', 'Count', 'Avg Size (sqft)', 'Selling PSF (AED)', 'Total Value'].map(h => (
                        <TableHead key={h} className="text-xs text-right first:text-left" style={{ color: '#9ca3af' }}>{h}</TableHead>
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
                      <TableRow key={r.type} style={{ borderBottom: '1px solid rgba(31,41,55,0.5)' }}>
                        <TableCell className="text-sm font-medium py-2 text-white">{r.type}</TableCell>
                        <TableCell className="text-sm text-right font-mono py-2 text-white">{fmt(r.u)}</TableCell>
                        <TableCell className="text-sm text-right py-2" style={{ color: '#9ca3af' }}>{fmt(r.sz)}</TableCell>
                        <TableCell className="text-sm text-right font-mono py-2" style={{ color: '#9ca3af' }}>{fmt(r.psf)}</TableCell>
                        <TableCell className="text-sm text-right font-mono py-2 text-cyan-400">{fmtM(r.rev)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow style={{ borderTop: '1px solid rgba(6,182,212,0.3)' }}>
                      <TableCell className="text-sm font-bold py-2 text-white">Total</TableCell>
                      <TableCell className="text-sm text-right font-bold py-2 text-white">{fmt(fs.units.total)}</TableCell>
                      <TableCell className="text-sm text-right py-2" style={{ color: '#6b7280' }}>-</TableCell>
                      <TableCell className="text-sm text-right py-2" style={{ color: '#6b7280' }}>-</TableCell>
                      <TableCell className="text-sm text-right font-bold font-mono py-2 text-cyan-400" style={{ textShadow: '0 0 10px rgba(6,182,212,0.3)' }}>{fmtM(fs.grossSales)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </Section>

            <Section num={3} title="Financial Feasibility" delay={600}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl p-5" style={cardStyle}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9ca3af' }}>Cost Breakdown</h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Land Cost', sub: 'Including transfer fees', val: fs.landCost, pctGdv: fs.landCost / fs.grossSales },
                      { label: 'Construction', sub: 'AED 420/sqft BUA', val: fs.constructionCost, pctGdv: fs.constructionCost / fs.grossSales },
                      { label: 'Soft Costs', sub: 'Design, permits, legal', val: fs.authorityFees + fs.consultantFees + fs.marketing, pctGdv: (fs.authorityFees + fs.consultantFees + fs.marketing) / fs.grossSales },
                      { label: 'Contingency', sub: '5% buffer', val: fs.contingency, pctGdv: fs.contingency / fs.grossSales },
                    ].map(c => (
                      <div key={c.label} className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: '1px solid rgba(31,41,55,0.5)' }}>
                        <div>
                          <div className="text-sm font-medium text-white">{c.label}</div>
                          <div className="text-xs" style={{ color: '#6b7280' }}>{c.sub}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold font-mono text-white">{fmtM(c.val)}</div>
                          <div className="text-xs" style={{ color: '#6b7280' }}>{pct(c.pctGdv)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl p-5" style={cardStyle}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9ca3af' }}>Return Metrics</h4>
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm" style={{ color: '#9ca3af' }}>Project ROI</span>
                      <span className="text-2xl font-extrabold text-green-400 font-mono" style={{ textShadow: '0 0 15px rgba(16,185,129,0.4)' }}>{pct(fs.roi)}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1f2937' }}>
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(fs.roi * 100, 100)}%`, background: 'linear-gradient(90deg, #10b981, #06b6d4)' }} />
                    </div>
                    <div className="flex justify-between mt-1 text-xs">
                      <span style={{ color: '#6b7280' }}>Industry avg: 20%</span>
                      <span className="font-bold" style={{ color: fs.roi > 0.2 ? '#10b981' : fs.roi > 0.1 ? '#f59e0b' : '#ef4444' }}>{fs.roi > 0.2 ? 'Excellent' : fs.roi > 0.1 ? 'Good' : 'Below avg'}</span>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm" style={{ color: '#9ca3af' }}>Profit Margin</span>
                      <span className="text-lg font-bold font-mono text-teal-400">{pct(fs.grossMargin)}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1f2937' }}>
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(fs.grossMargin * 100, 100)}%`, background: 'linear-gradient(90deg, #14b8a6, #06b6d4)' }} />
                    </div>
                  </div>
                  <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(17,24,39,0.5)', border: '1px solid #1f2937' }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Building2 className="w-3.5 h-3.5" style={{ color: '#9ca3af' }} />
                      <span className="text-xs font-bold uppercase" style={{ color: '#9ca3af' }}>Finance Structure</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
                        <div className="text-xs" style={{ color: '#9ca3af' }}>Equity (40%)</div>
                        <div className="text-sm font-bold font-mono text-cyan-400">{fmtM(equityAmt)}</div>
                      </div>
                      <div className="text-center p-2 rounded-lg" style={{ background: 'rgba(31,41,55,0.5)', border: '1px solid #1f2937' }}>
                        <div className="text-xs" style={{ color: '#9ca3af' }}>Debt (60%)</div>
                        <div className="text-sm font-bold font-mono text-white">{fmtM(debtAmt)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section num={4} title="Recommended Payment Plan" delay={800}>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(fs.payPlan).map(([stage, pctVal]) => (
                  <div key={stage} className="rounded-xl p-5 text-center" style={cardStyle}>
                    <div className="text-4xl font-extrabold font-mono mb-2 text-cyan-400" style={{ textShadow: '0 0 20px rgba(6,182,212,0.4)' }}>{pctVal}%</div>
                    <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>
                      {stage === 'booking' ? 'On Booking' : stage === 'construction' ? 'During Construction' : 'Upon Handover'}
                    </div>
                    <div className="text-xs font-mono" style={{ color: '#6b7280' }}>{fmtA(fs.grossSales * pctVal / 100)}</div>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {activeTab === 'benchmarks' && (
          <Section title="DSC Market Benchmarks" badge={`${COMPS.length} projects`} delay={200}>
            <div className="overflow-x-auto rounded-xl" style={tableWrapStyle}>
              <Table>
                <TableHeader>
                  <TableRow style={{ borderBottom: '1px solid #1f2937' }}>
                    {['Project', 'Developer', 'Units', 'BUA', 'PSF', 'Handover', 'Payment', 'Studio%', '1BR%', '2BR%'].map(h => (
                      <TableHead key={h} className="text-xs text-right first:text-left whitespace-nowrap" style={{ color: '#9ca3af' }}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {COMPS.map(c => (
                    <TableRow key={c.name} style={{ borderBottom: '1px solid rgba(31,41,55,0.5)' }}>
                      <TableCell className="text-sm font-medium py-2 text-white">{c.name}</TableCell>
                      <TableCell className="text-sm text-right py-2" style={{ color: '#9ca3af' }}>{c.developer}</TableCell>
                      <TableCell className="text-sm text-right font-mono py-2 text-white">{c.units}</TableCell>
                      <TableCell className="text-sm text-right font-mono py-2 text-white">{fmt(c.bua)}</TableCell>
                      <TableCell className="text-sm text-right font-mono py-2 text-cyan-400">AED {fmt(c.psf)}</TableCell>
                      <TableCell className="text-sm text-right py-2" style={{ color: '#9ca3af' }}>{c.handover}</TableCell>
                      <TableCell className="text-sm text-right py-2" style={{ color: '#9ca3af' }}>{c.payPlan}</TableCell>
                      <TableCell className="text-sm text-right py-2 text-white">{c.studioP}%</TableCell>
                      <TableCell className="text-sm text-right py-2 text-white">{c.br1P}%</TableCell>
                      <TableCell className="text-sm text-right py-2 text-white">{c.br2P}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: 'rgba(17,24,39,0.5)', border: '1px solid #1f2937', color: '#9ca3af' }}>
              <strong className="text-white">Market Intelligence:</strong> DSC sales avg AED 1,565/sqft ({TXN_COUNT.total} txns) · Rental avg AED 86/sqft/yr
            </div>
          </Section>
        )}

        {activeTab === 'sensitivity' && (
          <>
            <Section num={5} title="Price Sensitivity Analysis" badge="±10% Range" delay={200}>
              <div className="overflow-x-auto rounded-xl" style={tableWrapStyle}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ borderBottom: '1px solid #1f2937' }}>
                      {['Scenario', 'PSF', 'Revenue', 'Profit', 'Margin', 'ROI', 'Viability'].map(h => (
                        <TableHead key={h} className="text-xs text-right first:text-left" style={{ color: '#9ca3af' }}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fs.sens.map((s, i) => {
                      const psf = Math.round(fs.avgPsf * (1 + s.delta));
                      const isBase = s.delta === 0;
                      return (
                        <TableRow key={i} style={{ borderBottom: '1px solid rgba(31,41,55,0.5)', background: isBase ? 'rgba(6,182,212,0.05)' : undefined }}>
                          <TableCell className="text-xs font-bold py-2" style={{ color: isBase ? '#06b6d4' : s.delta > 0 ? '#10b981' : '#f59e0b' }}>
                            {isBase ? '► BASE' : s.delta > 0 ? `▲ +${Math.abs(s.delta * 100)}%` : `▼ -${Math.abs(s.delta * 100)}%`}
                          </TableCell>
                          <TableCell className="text-sm text-right font-mono py-2 text-white">AED {fmt(psf)}</TableCell>
                          <TableCell className="text-sm text-right font-mono py-2 text-white">{fmtA(s.revenue)}</TableCell>
                          <TableCell className={`text-sm text-right font-mono py-2`} style={{ color: s.profit > 0 ? '#14b8a6' : '#ef4444' }}>{fmtA(s.profit)}</TableCell>
                          <TableCell className="text-sm text-right py-2" style={{ color: s.margin > 0.2 ? '#10b981' : '#f59e0b' }}>{pct(s.margin)}</TableCell>
                          <TableCell className="text-sm text-right py-2" style={{ color: s.roi > 0.15 ? '#10b981' : '#f59e0b' }}>{pct(s.roi)}</TableCell>
                          <TableCell className="text-right py-2">
                            <span className="text-xs font-bold px-2 py-1 rounded-full" style={
                              s.margin >= 0.25 ? { color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }
                              : s.margin >= 0.15 ? { color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }
                              : { color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }
                            }>
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
              <p className="text-xs mb-3" style={{ color: '#9ca3af' }}>
                Impact on your plot's feasibility if sold at each DSC developer's average PSF
              </p>
              <div className="overflow-x-auto rounded-xl" style={tableWrapStyle}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ borderBottom: '1px solid #1f2937' }}>
                      {['Developer', 'Project', 'PSF', 'Revenue', 'Profit', 'Margin', 'ROI'].map(h => (
                        <TableHead key={h} className="text-xs text-right first:text-left whitespace-nowrap" style={{ color: '#9ca3af' }}>{h}</TableHead>
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
                        <TableRow key={c.name} style={{ borderBottom: '1px solid rgba(31,41,55,0.5)' }}>
                          <TableCell className="text-sm font-bold py-2 text-white">{c.developer}</TableCell>
                          <TableCell className="text-sm text-right py-2" style={{ color: '#9ca3af' }}>{c.name}</TableCell>
                          <TableCell className="text-sm text-right font-mono py-2 text-cyan-400">AED {fmt(c.psf)}</TableCell>
                          <TableCell className="text-sm text-right font-mono py-2 text-white">{fmtM(devRevenue)}</TableCell>
                          <TableCell className="text-sm text-right font-mono py-2" style={{ color: devProfit > 0 ? '#14b8a6' : '#ef4444' }}>{fmtM(devProfit)}</TableCell>
                          <TableCell className="text-sm text-right py-2" style={{ color: devMargin > 0.2 ? '#10b981' : '#f59e0b' }}>{pct(devMargin)}</TableCell>
                          <TableCell className="text-sm text-right py-2" style={{ color: devRoi > 0.15 ? '#10b981' : '#f59e0b' }}>{pct(devRoi)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow style={{ borderTop: '2px solid rgba(6,182,212,0.4)', background: 'rgba(6,182,212,0.05)' }}>
                      <TableCell className="text-sm font-bold text-cyan-400 py-2">Your Plot</TableCell>
                      <TableCell className="text-sm text-right text-cyan-400 py-2">{link.plotId}</TableCell>
                      <TableCell className="text-sm text-right font-mono font-bold text-cyan-400 py-2" style={{ textShadow: '0 0 10px rgba(6,182,212,0.3)' }}>AED {fmt(Math.round(fs.avgPsf))}</TableCell>
                      <TableCell className="text-sm text-right font-mono font-bold py-2 text-white">{fmtM(fs.grossSales)}</TableCell>
                      <TableCell className="text-sm text-right font-mono font-bold py-2" style={{ color: '#14b8a6' }}>{fmtM(fs.grossProfit)}</TableCell>
                      <TableCell className="text-sm text-right font-bold py-2 text-white">{pct(fs.grossMargin)}</TableCell>
                      <TableCell className="text-sm text-right font-bold py-2 text-white">{pct(fs.roi)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Section>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="pb-6 relative z-10" style={{ borderTop: '1px solid #1f2937' }}>
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={xEstateLogo} alt="X-Estate" className="w-8 h-8 opacity-50" />
            <span className="text-xs" style={{ color: '#6b7280' }}>HyperPlot AI · Decision Confidence</span>
          </div>
          <div className="text-xs" style={{ color: '#6b7280' }}>
            Confidential Feasibility Analysis • Generated {new Date(link.createdAt).toLocaleDateString()}
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
      `}</style>
    </div>
  );
}
