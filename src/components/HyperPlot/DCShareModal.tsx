import { useState, useMemo } from 'react';
import { X, Link2, Copy, Check, Calendar, Shield, Eye, Download, Clock, Trash2, Users, AlertTriangle, RefreshCw, Settings, UserPlus, Phone, Building2, Mail } from 'lucide-react';
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
  // Demo data
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
  const [expiryDays, setExpiryDays] = useState(1); // 24 hours default
  const [captcha, setCaptcha] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [contactFilter, setContactFilter] = useState<ContactFilter>('all');
  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ email: '', phone: '', company: '' });

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
    const id = Math.random().toString(36).slice(2, 10);
    const expiresAt = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 86400000).toISOString()
      : null;
    const newLink: DCShareLink = {
      id, plotId, mixStrategy: activeMix,
      plotInput: plotInput || fs.plot,
      overrides: overrides || {},
      createdAt: new Date().toISOString(),
      expiresAt, views: 0, downloads: 0, isActive: true,
      url: `${window.location.origin}/dc/${id}`,
    };
    const updated = [...links, newLink];
    setLinks(updated);
    saveShareLinks(updated);
    // Add log
    const newLog: SecurityLog = { id: Math.random().toString(36).slice(2, 8), event: 'access_granted', email: 'system', device: '—', time: new Date().toLocaleString() };
    const updatedLogs = [newLog, ...logs];
    setLogs(updatedLogs);
    saveLogs(updatedLogs);
    toast.success('Secure link generated');
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

  if (!open) return null;

  const eventLabel = (e: SecurityLog['event']) => {
    switch (e) {
      case 'access_granted': return { text: '✅Access Granted', cls: 'text-success' };
      case 'access_denied': return { text: '🚫Access Denied', cls: 'text-destructive' };
      case 'link_forwarded': return { text: '🚩Link Forwarded', cls: 'text-warning' };
      case 'link_expired': return { text: '⏰Link Expired', cls: 'text-muted-foreground' };
      case 'link_revoked': return { text: '🔒Link Revoked', cls: 'text-muted-foreground' };
    }
  };

  const tabs: { key: ModalTab; icon: React.ReactNode; label: string }[] = [
    { key: 'link', icon: <Link2 className="w-3.5 h-3.5" />, label: 'Link Settings' },
    { key: 'contacts', icon: <Users className="w-3.5 h-3.5" />, label: 'Pre-Approved Contacts' },
    { key: 'logs', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Security Logs' },
  ];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Share & Access Control</h2>
              <p className="text-xs text-muted-foreground">Investor Management</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Google Sheets Banner */}
        <div className="mx-5 mt-4 p-3 rounded-xl border border-border/50 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-success/20 flex items-center justify-center">
              <Check className="w-4 h-4 text-success" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">Google Sheets Auto-Approval</div>
              <div className="text-xs text-muted-foreground">Synced · {contacts.filter(c => c.source === 'sheets').length || 1} contacts</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">Configure</button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-primary/40 text-primary">
              <RefreshCw className="w-3 h-3" /> Sync Now
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-0 px-5 mt-4">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-t-lg border transition-all ${
                tab === t.key
                  ? 'bg-card border-border/50 border-b-transparent text-primary -mb-px z-10'
                  : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-y-auto border-t border-border/50 p-5 space-y-4">
          
          {/* ─── LINK SETTINGS TAB ─── */}
          {tab === 'link' && (
            <>
              <div>
                <label className="text-sm font-bold text-foreground">Selected Plot</label>
                <div className="mt-1.5 px-4 py-2.5 rounded-lg bg-muted/30 border border-border/50 text-sm text-foreground">
                  Plot {plotId} — Dubai Sports City
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-foreground">Unit Mix Strategy</label>
                <div className="mt-1.5 px-4 py-2.5 rounded-lg bg-muted/30 border border-border/50 text-sm text-primary font-semibold">
                  {MIX_TEMPLATES[activeMix].label}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-foreground">Link Expiry</label>
                <select
                  value={expiryDays}
                  onChange={e => setExpiryDays(Number(e.target.value))}
                  className="w-full mt-1.5 h-10 text-sm rounded-lg bg-muted/30 border border-border/50 px-4 text-foreground"
                >
                  <option value={1}>24 hours</option>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={0}>Never expires</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20">
                <div>
                  <div className="text-sm font-bold text-foreground">CAPTCHA Protection</div>
                  <div className="text-xs text-muted-foreground">Require CAPTCHA verification before access</div>
                </div>
                <Switch checked={captcha} onCheckedChange={setCaptcha} />
              </div>

              <Button onClick={generateLink} className="w-full h-12 gap-2 text-sm font-bold bg-primary hover:bg-primary/90">
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
                  <h3 className="text-sm font-bold text-foreground">Pre-Approved Contacts</h3>
                  <p className="text-xs text-muted-foreground">
                    {contacts.length} active · {accessedCount} accessed · {notAccessedCount} not accessed
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowAddContact(!showAddContact)}>
                  <UserPlus className="w-3.5 h-3.5" /> Add Contact
                </Button>
              </div>

              {/* Add contact form */}
              {showAddContact && (
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2 animate-fade-in">
                  <input type="email" placeholder="Email address" value={newContact.email}
                    onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border/50 text-sm text-foreground" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="tel" placeholder="Phone number" value={newContact.phone}
                      onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border/50 text-sm text-foreground" />
                    <input type="text" placeholder="Company" value={newContact.company}
                      onChange={e => setNewContact(p => ({ ...p, company: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border/50 text-sm text-foreground" />
                  </div>
                  <Button size="sm" className="w-full" onClick={addContact}>Add Contact</Button>
                </div>
              )}

              {/* Filter pills */}
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
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {k === 'accessed' && <Eye className="w-3 h-3 inline mr-1" />}
                    {k === 'not_accessed' && <Clock className="w-3 h-3 inline mr-1" />}
                    {l}
                  </button>
                ))}
              </div>

              {/* Contact list */}
              <div className="space-y-2">
                {filteredContacts.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm">No contacts found</div>
                )}
                {filteredContacts.map(c => (
                  <div key={c.id} className="p-3 rounded-xl border border-border/50 bg-muted/10 flex items-center justify-between hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground truncate">{c.email}</span>
                          {c.phone && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {c.phone}
                            </span>
                          )}
                          {c.company && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> {c.company}
                            </span>
                          )}
                          <Badge variant="outline" className={`text-[10px] ${c.source === 'sheets' ? 'border-primary/40 text-primary' : 'border-border text-muted-foreground'}`}>
                            {c.source === 'sheets' ? 'Sheets' : 'Manual'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={`text-xs font-medium ${c.accessed ? 'text-success' : 'text-muted-foreground'}`}>
                        {c.accessed ? 'Accessed' : 'Not registered'}
                      </span>
                      <button onClick={() => deleteContact(c.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
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
              {/* Alert banner */}
              {securityAlerts > 0 && (
                <div className="p-3 rounded-xl bg-warning/10 border border-warning/30 flex items-center gap-3 animate-fade-in">
                  <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-warning">{securityAlerts} Security Alert{securityAlerts > 1 ? 's' : ''}</div>
                    <div className="text-xs text-muted-foreground">Forwarded links or device mismatches detected</div>
                  </div>
                </div>
              )}

              {/* Filter pills */}
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
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {l}
                  </button>
                ))}
                <button className="ml-auto text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {/* Log table */}
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/50">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Event</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Email</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Device</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Time</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map(log => {
                      const ev = eventLabel(log.event);
                      return (
                        <tr key={log.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors">
                          <td className={`px-3 py-2.5 font-medium ${ev.cls}`}>{ev.text}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{log.email}</td>
                          <td className="px-3 py-2.5 font-mono text-muted-foreground text-xs">{log.device}</td>
                          <td className="px-3 py-2.5 text-muted-foreground text-xs">{log.time}</td>
                          <td className="px-3 py-2.5">
                            {log.event === 'access_granted' && (
                              <button className="text-xs text-destructive font-medium hover:underline">Revoke</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground text-sm">No events found</td>
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
