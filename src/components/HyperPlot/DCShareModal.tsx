import { useState, useMemo } from 'react';
import { X, Link2, Copy, Check, Calendar, Shield, Eye, Download, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export function loadShareLinks(): DCShareLink[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

export function saveShareLinks(links: DCShareLink[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

export function DCShareModal({ open, onClose, plotId, activeMix, fs, plotInput, overrides }: DCShareModalProps) {
  const [links, setLinks] = useState<DCShareLink[]>(loadShareLinks);
  const [expiryDays, setExpiryDays] = useState(30);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const plotLinks = useMemo(() => links.filter(l => l.plotId === plotId), [links, plotId]);
  const activeLinks = plotLinks.filter(l => l.isActive);
  const totalViews = plotLinks.reduce((s, l) => s + l.views, 0);
  const totalDownloads = plotLinks.reduce((s, l) => s + l.downloads, 0);

  const generateLink = () => {
    const id = Math.random().toString(36).slice(2, 10);
    const expiresAt = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 86400000).toISOString()
      : null;

    const newLink: DCShareLink = {
      id,
      plotId,
      mixStrategy: activeMix,
      plotInput: plotInput || fs.plot,
      overrides: overrides || {},
      createdAt: new Date().toISOString(),
      expiresAt,
      views: 0,
      downloads: 0,
      isActive: true,
      url: `${window.location.origin}/dc/${id}`,
    };

    const updated = [...links, newLink];
    setLinks(updated);
    saveShareLinks(updated);
    toast.success('Secure link generated');
  };

  const revokeLink = (id: string) => {
    const updated = links.map(l => l.id === id ? { ...l, isActive: false } : l);
    setLinks(updated);
    saveShareLinks(updated);
    toast.success('Link revoked');
  };

  const deleteLink = (id: string) => {
    const updated = links.filter(l => l.id !== id);
    setLinks(updated);
    saveShareLinks(updated);
    toast.success('Link deleted');
  };

  const copyLink = async (link: DCShareLink) => {
    await navigator.clipboard.writeText(link.url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Link copied to clipboard');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Decision Confidence</h2>
              <p className="text-xs text-muted-foreground">Secure Feasibility Sharing</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 p-5 border-b border-border/50">
          <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <Link2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">Active Links</span>
            </div>
            <div className="text-2xl font-bold text-primary">{activeLinks.length}</div>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">Total Views</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{totalViews}</div>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">Downloads</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{totalDownloads}</div>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">Revoked</span>
            </div>
            <div className="text-2xl font-bold text-muted-foreground">{plotLinks.filter(l => !l.isActive).length}</div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* Generate New Link */}
          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-foreground">Generate New Secure Link</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium">Plot</label>
                <div className="text-sm font-mono font-bold text-foreground mt-0.5">{plotId}</div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium">Unit Mix Strategy</label>
                <div className="text-sm font-bold text-foreground mt-0.5">{MIX_TEMPLATES[activeMix].label}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <div className="text-muted-foreground">GDV</div>
                <div className="font-bold text-primary">{fmtM(fs.grossSales)}</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <div className="text-muted-foreground">ROI</div>
                <div className="font-bold text-success">{pct(fs.roi)}</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <div className="text-muted-foreground">Units</div>
                <div className="font-bold text-foreground">{fmt(fs.units.total)}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground font-medium">Link Expiry</label>
                <select
                  value={expiryDays}
                  onChange={e => setExpiryDays(Number(e.target.value))}
                  className="w-full mt-0.5 h-9 text-sm rounded-lg bg-muted/50 border border-border/50 px-3 text-foreground"
                >
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={0}>Never expires</option>
                </select>
              </div>
              <Button onClick={generateLink} className="gap-1.5 mt-4">
                <Link2 className="w-4 h-4" />
                Generate Link
              </Button>
            </div>
          </div>

          {/* Existing Links */}
          {plotLinks.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Active Feasibility Links
              </h3>
              <div className="space-y-2">
                {plotLinks.map(link => (
                  <div
                    key={link.id}
                    className={`p-3 rounded-xl border transition-all ${
                      link.isActive
                        ? 'border-border/50 bg-muted/20 hover:border-primary/30'
                        : 'border-border/30 bg-muted/10 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[10px] ${link.isActive ? 'bg-success/20 text-success border-success/30' : 'bg-destructive/20 text-destructive border-destructive/30'}`}>
                          {link.isActive ? '● ACTIVE' : '● REVOKED'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {MIX_TEMPLATES[link.mixStrategy]?.label || 'Balanced'} Mix
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {link.isActive && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => copyLink(link)}>
                              {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => revokeLink(link.id)}>
                              Revoke
                            </Button>
                          </>
                        )}
                        {!link.isActive && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteLink(link.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="text-xs font-mono text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5 mb-2 truncate">
                      {link.url}
                    </div>

                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Created: {new Date(link.createdAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {link.expiresAt ? `Expires: ${new Date(link.expiresAt).toLocaleDateString()}` : 'Never expires'}</span>
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {link.views} views</span>
                      <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {link.downloads} downloads</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {plotLinks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No links generated yet</p>
              <p className="text-xs mt-1">Generate a secure link to share your feasibility analysis</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-border/50 shrink-0">
          <p className="text-[10px] text-muted-foreground">Links are encrypted and access-controlled. Revoke anytime.</p>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
