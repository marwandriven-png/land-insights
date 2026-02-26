import { useState } from 'react';
import { Brain, Send, Sparkles, TrendingUp, Target, Zap } from 'lucide-react';
import { PlotData, calculateFeasibility } from '@/services/DDAGISService';

interface AIAssistantProps {
  plots: PlotData[];
  selectedPlot: PlotData | null;
  onSelectPlot: (plot: PlotData) => void;
}

const QUICK_PROMPTS = [
  { icon: TrendingUp, label: 'Best ROI plots', query: 'roi' },
  { icon: Target, label: 'Available now', query: 'available' },
  { icon: Zap, label: 'High potential', query: 'potential' },
];

export function AIAssistant({ plots, selectedPlot, onSelectPlot }: AIAssistantProps) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [recommendedPlots, setRecommendedPlots] = useState<PlotData[]>([]);

  const handleAnalysis = (type: string) => {
    let filtered: PlotData[] = [];
    let message = '';

    switch (type) {
      case 'roi':
        filtered = [...plots]
          .filter(p => p.status !== 'Frozen')
          .sort((a, b) => calculateFeasibility(b).roi - calculateFeasibility(a).roi)
          .slice(0, 3);
        message = `Top 3 plots by ROI performance. These plots offer the best return on investment based on current market conditions and construction costs.`;
        break;
      case 'available':
        filtered = plots
          .filter(p => p.status === 'Available')
          .slice(0, 3);
        message = `${filtered.length} plots are currently available for immediate development. These are ready for purchase and construction.`;
        break;
      case 'potential':
        filtered = [...plots]
          .filter(p => !p.isFrozen)
          .sort((a, b) => calculateFeasibility(b).score - calculateFeasibility(a).score)
          .slice(0, 3);
        message = `High potential plots identified based on location, zoning, and market demand. These have the highest investment scores.`;
        break;
      default:
        // Custom query analysis
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes('villa')) {
          filtered = plots.filter(p => p.zoning.includes('Villa'));
          message = `Found ${filtered.length} villa plots matching your criteria.`;
        } else if (lowerQuery.includes('commercial')) {
          filtered = plots.filter(p => p.zoning.includes('Commercial'));
          message = `Found ${filtered.length} commercial plots in the development.`;
        } else if (lowerQuery.includes('mixed')) {
          filtered = plots.filter(p => p.zoning.includes('Mixed'));
          message = `Found ${filtered.length} mixed-use plots with flexible development options.`;
        } else {
          message = `Analyzing "${query}"... I found ${plots.length} total plots in the Dubai South development. Try asking about specific plot types like "villa plots" or "commercial plots".`;
        }
    }

    setRecommendedPlots(filtered);
    setResponse(message);
  };

  return (
    <div className="h-full flex flex-col glass-card glow-border">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))' }}>
            <Brain className="w-5 h-5 text-background" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">AI Assistant</h3>
            <p className="text-xs text-muted-foreground">Intelligent plot analysis</p>
          </div>
        </div>

        {/* Quick Prompts */}
        <div className="flex gap-2 flex-wrap">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt.query}
              onClick={() => handleAnalysis(prompt.query)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 hover:bg-muted rounded-lg text-xs text-muted-foreground hover:text-foreground transition-all"
            >
              <prompt.icon className="w-3 h-3" />
              {prompt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 p-4 overflow-y-auto scrollbar-thin">
        {response ? (
          <div className="space-y-4">
            <div className="glass-card p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">{response}</p>
              </div>
            </div>

            {recommendedPlots.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground font-semibold">Recommended Plots:</div>
                {recommendedPlots.map((plot) => {
                  const feasibility = calculateFeasibility(plot);
                  return (
                    <button
                      key={plot.id}
                      onClick={() => onSelectPlot(plot)}
                      className={`w-full text-left glass-card p-3 transition-all hover:scale-[1.02] ${
                        selectedPlot?.id === plot.id ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-foreground">{plot.id}</span>
                        <span className="text-success font-semibold text-sm">{feasibility.roi}% ROI</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{plot.zoning}</div>
                      {plot.developer && (
                        <div className="text-xs text-primary">{plot.developer}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Ask me about plots, ROI analysis, or development opportunities
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalysis('custom')}
            placeholder="Ask about plots..."
            className="flex-1 px-4 py-2.5 bg-muted/50 border border-border/50 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={() => handleAnalysis('custom')}
            className="btn-primary p-2.5"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
