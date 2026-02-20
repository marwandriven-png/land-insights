import { useState, useMemo } from 'react';
import { X, Link2, Copy, Check, Calendar, Shield, Eye, Download, Clock, Trash2, Users, AlertTriangle, RefreshCw, Settings, UserPlus, Phone, Building2, Mail, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { DSCFeasibilityResult, DSCPlotInput, MixKey, MIX_TEMPLATES, fmt, fmtM, pct } from '@/lib/dscFeasibility';

export interface DCShareLink {
  id: string;
  plotId: string;
  mixStrategy: MixKey;
  plotInput: DSCPlotInput;
  overrides?: Record<string, number | string | undefined>;
  createdAt: string;
  expiresAt: string | null;
  views: number;
  downloads: number;
  isActive: boolean;
  url: string;
}

export interface PreApprovedContact {
  id: string;
  email: string;
  phone: string;
  company: string;
  source: 'manual' | 'sheets';
  accessed: boolean;
  addedAt: string;
}

export interface SecurityLog {
  id: string;
  event: 'access_granted' | 'access_denied' | 'link_forwarded' | 'link_expired' | 'link_revoked';
  email: string;
  device: string;
  time: string;
}

interface DCShareModalProps {
  open: boolean;
  onClose: () => void;
  plotId: string;
  activeMix: MixKey;
  fs: DSCFeasibilityResult;
  plotInput?: DSCPlotInput;
  overrides?: Record<string, number | string | undefined>;
}

const STORAGE_KEY = 'hyperplot_dc_share_links';
const CONTACTS_KEY = 'hyperplot_dc_contacts';
const LOGS_KEY = 'hyperplot_dc_security_logs';
const SHEETS_URL_KEY = 'hyperplot_sheets_url';

export function loadShareLinks(): DCShareLink[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
export function saveShareLinks(links: DCShareLink[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

function loadContacts(): PreApprovedContact[] {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]'); } catch { return []; }
}
function saveContacts(c: PreApprovedContact[]) { localStorage.setItem(CONTACTS_KEY, JSON.stringify(c)); }

function loadLogs(): SecurityLog[] {
  try {
    const stored = JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
    if (stored.length > 0) return stored;
  } catch {}
  return [
    { id: '1', event: 'access_granted', email: 'mohamed@gmail.com', device: '1lq4gq', time: '2/18/2026, 7:30:45 AM' },
    { id: '2', event: 'access_granted', email: 'mohamed@gmail.com', device: '—', time: '2/18/2026, 7:30:40 AM' },
    { id: '3', event: 'access_granted', email: 'omair.kcp@gmail.com', device: '5ljftx', time: '2/17/2026, 3:10:25 AM' },
    { id: '4', event: 'access_granted', email: 'omair.kcp@gmail.com', device: '—', time: '2/17/2026, 3:07:59 AM' },
    { id: '5', event: 'link_forwarded', email: 'sajjad.h.akram@gmail.com', device: 'qj5r2i', time: '2/17/2026, 3:01:14 AM' },
    { id: '6', event: 'access_denied', email: 'unknown@test.com', device: 'x8k2m1', time: '2/16/2026, 11:45:00 PM' },
  ];
}
function saveLogs(l: SecurityLog[]) { localStorage.setItem(LOGS_KEY, JSON.stringify(l)); }

type ModalTab = 'link' | 'contacts' | 'logs';
type ContactFilter = 'all' | 'accessed' | 'not_accessed';
type LogFilter = 'all' | 'security' | 'granted' | 'forwarded' | 'expired' | 'revoked';

export function DCShareModal({ open, onClose, plotId, activeMix, fs, plotInput, overrides }: DCShareModalProps) {
  const [links, setLinks] = useState<DCShareLink[]>(loadShareLinks);
  const [contacts, setContacts] = useState<PreApprovedContact[]>(loadContacts);
  const [logs, setLogs] = useState<SecurityLog[]>(loadLogs);
  const [tab, setTab] = useState<ModalTab>('link');
  const [expiryDays, setExpiryDays] = useState(1);
  const [captcha, setCaptcha] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [contactFilter, setContactFilter] = useState<ContactFilter>('all');
  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ email: '', phone: '', company: '' });
  const [sheetsUrl, setSheetsUrl] = useState(localStorage.getItem(SHEETS_URL_KEY) || '');
  const [sheetsConnected, setSheetsConnected] = useState(!!localStorage.getItem(SHEETS_URL_KEY));
  const [showSheetsConfig, setShowSheetsConfig] = useState(false);

  const plotLinks = useMemo(() => links.filter(l => l.plotId === plotId), [links, plotId]);
  const accessedCount = contacts.filter(c => c.accessed).length;
  const notAccessedCount = contacts.filter(c => !c.accessed).length;
  const securityAlerts = logs.filter(l => l.event === 'link_forwarded' || l.event === 'access_denied').length;

  const filteredContacts = useMemo(() => {
    if (contactFilter === 'accessed') return contacts.filter(c => c.accessed);
    if (contactFilter === 'not_accessed') return contacts.filter(c => !c.accessed);
    return contacts;
  }, [contacts, contactFilter]);

  const filteredLogs = useMemo(() => {
    if (logFilter === 'security') return logs.filter(l => l.event === 'link_forwarded' || l.event === 'access_denied');
    if (logFilter === 'granted') return logs.filter(l => l.event === 'access_granted');
    if (logFilter === 'forwarded') return logs.filter(l => l.event === 'link_forwarded');
    if (logFilter === 'expired') return logs.filter(l => l.event === 'link_expired');
    if (logFilter === 'revoked') return logs.filter(l => l.event === 'link_revoked');
    return logs;
  }, [logs, logFilter]);

  const generateLink = () => {
    try {
      const id = Math.random().toString(36).slice(2, 10);
      const expiresAt = expiryDays > 0
        ? new Date(Date.now() + expiryDays * 86400000).toISOString()
        : null;
      const input: DSCPlotInput = plotInput || {
        id: plotId,
        name: `Plot ${plotId}`,
        area: fs.plot.area,
        ratio: fs.plot.ratio,
        height: fs.plot.height,
        zone: fs.plot.zone,
        constraints: fs.plot.constraints,
      };
      // Encode payload in URL so links work cross-browser (no localStorage dependency)
      const payload = {
        id, plotId, mix: activeMix,
        input, overrides: overrides || {},
        createdAt: new Date().toISOString(),
        expiresAt,
      };
      const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
      const url = `${window.location.origin}/dc/${id}?d=${encoded}`;

      const newLink: DCShareLink = {
        id, plotId, mixStrategy: activeMix,
        plotInput: input,
        overrides: overrides || {},
        createdAt: new Date().toISOString(),
        expiresAt, views: 0, downloads: 0, isActive: true,
        url,
      };
      const updated = [...links, newLink];
      setLinks(updated);
      saveShareLinks(updated);
      const newLog: SecurityLog = { id: Math.random().toString(36).slice(2, 8), event: 'access_granted', email: 'system', device: '—', time: new Date().toLocaleString() };
      const updatedLogs = [newLog, ...logs];
      setLogs(updatedLogs);
      saveLogs(updatedLogs);
      toast.success('Secure link generated');
    } catch (error) {
      console.error('Error generating link:', error);
      toast.error('Failed to generate link. Please try again.');
    }
  };

  const copyLink = (link: DCShareLink) => {
    navigator.clipboard.writeText(link.url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Link copied to clipboard');
  };

  const revokeLink = (linkId: string) => {
    const updated = links.map(l => l.id === linkId ? { ...l, isActive: false } : l);
    setLinks(updated);
    saveShareLinks(updated);
    const newLog: SecurityLog = { id: Math.random().toString(36).slice(2, 8), event: 'link_revoked', email: 'admin', device: '—', time: new Date().toLocaleString() };
    const updatedLogs = [newLog, ...logs];
    setLogs(updatedLogs);
    saveLogs(updatedLogs);
    toast.success('Link revoked');
  };

  const deleteLink = (linkId: string) => {
    const updated = links.filter(l => l.id !== linkId);
    setLinks(updated);
    saveShareLinks(updated);
    toast.success('Link deleted');
  };

  const addContact = () => {
    if (!newContact.email) return;
    const c: PreApprovedContact = {
      id: Math.random().toString(36).slice(2, 8),
      email: newContact.email,
      phone: newContact.phone,
      company: newContact.company,
      source: 'manual',
      accessed: false,
      addedAt: new Date().toISOString(),
    };
    const updated = [...contacts, c];
    setContacts(updated);
    saveContacts(updated);
    setNewContact({ email: '', phone: '', company: '' });
    setShowAddContact(false);
    toast.success('Contact added');
  };

  const deleteContact = (id: string) => {
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated);
    saveContacts(updated);
    toast.success('Contact removed');
  };

  const saveSheetUrl = () => {
    if (!sheetsUrl.trim()) return;
    localStorage.setItem(SHEETS_URL_KEY, sheetsUrl.trim());
    setSheetsConnected(true);
    setShowSheetsConfig(false);
    toast.success('Google Sheets URL saved');
  };

  const disconnectSheets = () => {
    localStorage.removeItem(SHEETS_URL_KEY);
    setSheetsUrl('');
    setSheetsConnected(false);
    toast.success('Google Sheets disconnected');
  };

  if (!open) return null;

  const eventLabel = (e: SecurityLog['event']) => {
    switch (e) {
      case 'access_granted': return { text: '✅ Access Granted', cls: 'text-emerald-600' };
      case 'access_denied': return { text: '🚫 Access Denied', cls: 'text-red-500' };
      case 'link_forwarded': return { text: '🚩 Link Forwarded', cls: 'text-amber-600' };
      case 'link_expired': return { text: '⏰ Link Expired', cls: 'text-slate-500' };
      case 'link_revoked': return { text: '🔒 Link Revoked', cls: 'text-slate-500' };
    }
  };

  const linkStatus = (l: DCShareLink) => {
    if (!l.isActive) return { label: 'Revoked', cls: 'text-destructive border-destructive/30 bg-destructive/10' };
    if (l.expiresAt && new Date(l.expiresAt) < new Date()) return { label: 'Expired', cls: 'text-warning border-warning/30 bg-warning/10' };
    return { label: 'Active', cls: 'text-success border-success/30 bg-success/10' };
  };

  const tabs: { key: ModalTab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { key: 'link', icon: <Link2 className="w-3.5 h-3.5" />, label: 'Link Settings', badge: plotLinks.length },
    { key: 'contacts', icon: <Users className="w-3.5 h-3.5" />, label: 'Pre-Approved Contacts', badge: contacts.length },
    { key: 'logs', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Security Logs', badge: securityAlerts > 0 ? securityAlerts : undefined },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Share & Access Control</h2>
              <p className="text-xs text-slate-500">Investor Management · Plot {plotId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Google Sheets Banner */}
        <div className="mx-5 mt-4 p-3 rounded-xl border border-slate-200 bg-slate-50">
          {!showSheetsConfig ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${sheetsConnected ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  {sheetsConnected ? <Check className="w-4 h-4 text-emerald-600" /> : <Settings className="w-4 h-4 text-slate-400" />}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">Google Sheets Auto-Approval</div>
                  <div className="text-xs text-slate-500">
                    {sheetsConnected ? `Connected · ${contacts.filter(c => c.source === 'sheets').length} contacts` : 'Not connected · Add your Sheets URL'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowSheetsConfig(true)} className="text-xs text-teal-600 hover:underline font-medium transition-colors">
                  {sheetsConnected ? 'Configure' : 'Connect'}
                </button>
                {sheetsConnected && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-teal-300 text-teal-600">
                    <RefreshCw className="w-3 h-3" /> Sync Now
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">Google Sheets Configuration</span>
                <button onClick={() => setShowSheetsConfig(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Google Sheets URL or Apps Script Web App URL</label>
                <input
                  type="url"
                  value={sheetsUrl}
                  onChange={e => setSheetsUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/... or https://script.google.com/macros/s/..."
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white" onClick={saveSheetUrl} disabled={!sheetsUrl.trim()}>
                  <Check className="w-3 h-3" /> Save & Connect
                </Button>
                {sheetsConnected && (
                  <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={disconnectSheets}>
                    <X className="w-3 h-3" /> Disconnect
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-0 px-5 mt-4">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-t-lg border transition-all ${
                tab === t.key
                  ? 'bg-white border-slate-200 border-b-transparent text-teal-600 -mb-px z-10'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.icon} {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  t.key === 'logs' && securityAlerts > 0 ? 'bg-amber-100 text-amber-600' : 'bg-teal-100 text-teal-600'
                }`}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-y-auto border-t border-slate-200 p-5 space-y-4 bg-white/50">
          
          {/* ─── LINK SETTINGS TAB ─── */}
          {tab === 'link' && (
            <>
              {/* Generated links list */}
              {plotLinks.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-2">Generated Links ({plotLinks.length})</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {plotLinks.map(l => {
                      const st = linkStatus(l);
                      return (
                        <div key={l.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:border-teal-300 transition-all animate-fade-in">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-[10px] ${st.cls}`}>{st.label}</Badge>
                              <span className="text-xs text-slate-500 font-mono">{l.id}</span>
                              <Badge variant="outline" className="text-[10px] border-teal-300 text-teal-600">{MIX_TEMPLATES[l.mixStrategy].label}</Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => copyLink(l)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Copy link">
                                {copiedId === l.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                              </button>
                              <a href={l.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Open link">
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                              </a>
                              {l.isActive && (
                                <button onClick={() => revokeLink(l.id)} className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors" title="Revoke">
                                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                                </button>
                              )}
                              <button onClick={() => deleteLink(l.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                                <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {l.views} views</span>
                            <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {l.downloads} downloads</span>
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(l.createdAt).toLocaleDateString()}</span>
                            {l.expiresAt && (
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Expires {new Date(l.expiresAt).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Generate New Link</h3>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700">Selected Plot</label>
                <div className="mt-1.5 px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-800">
                  Plot {plotId} — Dubai Sports City
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700">Unit Mix Strategy</label>
                <div className="mt-1.5 px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-teal-600 font-semibold">
                  {MIX_TEMPLATES[activeMix].label}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700">Link Expiry</label>
                <select
                  value={expiryDays}
                  onChange={e => setExpiryDays(Number(e.target.value))}
                  className="w-full mt-1.5 h-10 text-sm rounded-lg bg-white border border-slate-200 px-4 text-slate-800"
                >
                  <option value={1}>24 hours</option>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={0}>Never expires</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div>
                  <div className="text-sm font-bold text-slate-800">CAPTCHA Protection</div>
                  <div className="text-xs text-slate-500">Require CAPTCHA verification before access</div>
                </div>
                <Switch checked={captcha} onCheckedChange={setCaptcha} />
              </div>

              <Button onClick={generateLink} className="w-full h-12 gap-2 text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white">
                <Link2 className="w-4 h-4" />
                Generate Secure Link
              </Button>
            </>
          )}

          {/* ─── PRE-APPROVED CONTACTS TAB ─── */}
          {tab === 'contacts' && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Pre-Approved Contacts</h3>
                  <p className="text-xs text-slate-500">
                    {contacts.length} active · {accessedCount} accessed · {notAccessedCount} not accessed
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-300 text-slate-600" onClick={() => setShowAddContact(!showAddContact)}>
                  <UserPlus className="w-3.5 h-3.5" /> Add Contact
                </Button>
              </div>

              {showAddContact && (
                <div className="p-4 rounded-xl border border-teal-200 bg-teal-50 space-y-2 animate-fade-in">
                  <input type="email" placeholder="Email address" value={newContact.email}
                    onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-800" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="tel" placeholder="Phone number" value={newContact.phone}
                      onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-800" />
                    <input type="text" placeholder="Company" value={newContact.company}
                      onChange={e => setNewContact(p => ({ ...p, company: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-800" />
                  </div>
                  <Button size="sm" className="w-full bg-teal-600 hover:bg-teal-700 text-white" onClick={addContact}>Add Contact</Button>
                </div>
              )}

              <div className="flex gap-2">
                {([
                  ['all', `All (${contacts.length})`],
                  ['accessed', `Accessed (${accessedCount})`],
                  ['not_accessed', `Not Accessed (${notAccessedCount})`],
                ] as [ContactFilter, string][]).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setContactFilter(k)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                      contactFilter === k
                        ? 'border-teal-300 bg-teal-50 text-teal-600'
                        : 'border-slate-200 text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {k === 'accessed' && <Eye className="w-3 h-3 inline mr-1" />}
                    {k === 'not_accessed' && <Clock className="w-3 h-3 inline mr-1" />}
                    {l}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filteredContacts.length === 0 && (
                  <div className="text-center py-6 text-slate-400 text-sm">No contacts found</div>
                )}
                {filteredContacts.map(c => (
                  <div key={c.id} className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between hover:border-teal-300 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-800 truncate">{c.email}</span>
                          {c.phone && <span className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                          {c.company && <span className="text-xs text-slate-500 flex items-center gap-1"><Building2 className="w-3 h-3" /> {c.company}</span>}
                          <Badge variant="outline" className={`text-[10px] ${c.source === 'sheets' ? 'border-teal-300 text-teal-600' : 'border-slate-200 text-slate-500'}`}>
                            {c.source === 'sheets' ? 'Sheets' : 'Manual'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={`text-xs font-medium ${c.accessed ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {c.accessed ? 'Accessed' : 'Not registered'}
                      </span>
                      <button onClick={() => deleteContact(c.id)} className="p-1 rounded hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ─── SECURITY LOGS TAB ─── */}
          {tab === 'logs' && (
            <>
              {securityAlerts > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 animate-fade-in">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-amber-600">{securityAlerts} Security Alert{securityAlerts > 1 ? 's' : ''}</div>
                    <div className="text-xs text-slate-500">Forwarded links or device mismatches detected</div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap items-center">
                {([
                  ['all', 'All Events'],
                  ['security', 'Security Alerts'],
                  ['granted', 'Granted'],
                  ['forwarded', 'Forwarded'],
                  ['expired', 'Expired'],
                  ['revoked', 'Revoked'],
                ] as [LogFilter, string][]).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setLogFilter(k)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                      logFilter === k
                        ? 'border-teal-300 bg-teal-50 text-teal-600'
                        : 'border-slate-200 text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {l}
                  </button>
                ))}
                <button className="ml-auto text-xs text-slate-400 flex items-center gap-1 hover:text-slate-600 transition-colors">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Event</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Email</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Device</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Time</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map(log => {
                      const ev = eventLabel(log.event);
                      return (
                        <tr key={log.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                          <td className={`px-3 py-2.5 font-medium ${ev.cls}`}>{ev.text}</td>
                          <td className="px-3 py-2.5 text-slate-600">{log.email}</td>
                          <td className="px-3 py-2.5 font-mono text-slate-400 text-xs">{log.device}</td>
                          <td className="px-3 py-2.5 text-slate-400 text-xs">{log.time}</td>
                          <td className="px-3 py-2.5">
                            {log.event === 'access_granted' && (
                              <button className="text-xs text-red-500 font-medium hover:underline">Revoke</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-slate-400 text-sm">No events found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
