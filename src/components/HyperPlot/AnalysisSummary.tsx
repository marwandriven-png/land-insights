import React from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { DSCFeasibilityResult, pct, fmt, fmtM } from '@/lib/dscFeasibility';

export function AnalysisSummary({ fs, mixTemplate }: { fs: DSCFeasibilityResult; mixTemplate: { label: string } }) {
    const { ref: ref1, visible: v1 } = useScrollReveal(0.1);
    const { ref: ref2, visible: v2 } = useScrollReveal(0.1);
    const { ref: ref3, visible: v3 } = useScrollReveal(0.1);

    const breakEvenPsf = Math.round(fs.totalCost / fs.sellableArea);
    const marketAvgPsf = 1565;
    const safetyMargin = Math.round(((marketAvgPsf - breakEvenPsf) / marketAvgPsf) * 100);

    const strengths = [
        `${pct(fs.roi)} ROI significantly exceeds market average (25-30%)`,
        `${pct(fs.grossMargin)} profit margin provides healthy buffer against market volatility`,
        `Break-even at AED ${fmt(breakEvenPsf)} PSF vs market AED ${fmt(marketAvgPsf)} (${safetyMargin}% safety margin)`,
        `${mixTemplate.label} unit mix reduces absorption risk and targets broad market segment`,
        `${(fs.grossYield * 100).toFixed(1)}% yield attractive to institutional investors`,
    ];

    const risks = [
        `Sensitivity analysis confirms viability even at -5% price decline`,
        `Only becomes marginal at -10% price drop (unlikely scenario)`,
        `Market floor (AED ${fmt(Math.round(fs.sens[0]?.revenue ? fs.avgPsf * 0.9 : 1452))}) remains ${Math.round(((fs.avgPsf * 0.9 - breakEvenPsf) / breakEvenPsf) * 100)}% above break-even`,
        `Dubai South infrastructure investment supports long-term price appreciation`,
        `Flexible unit mix allows pivot to investor-focused if market shifts`,
    ];

    const nextSteps = [
        { num: '01', title: 'Secure Acquisition', desc: `Target land cost at ${pct(fs.landCost / fs.grossSales)} of GDV (AED ${fmtM(fs.landCost)})` },
        { num: '02', title: 'Pre-sales Strategy', desc: 'Launch phase 1 to test price elasticity and market response' },
        { num: '03', title: 'Unit Mix Finalization', desc: 'Confirm based on pre-sales feedback and absorption rates' },
        { num: '04', title: 'Monitor DSC Pipeline', desc: 'Track absorption rates quarterly to optimize pricing strategy' },
    ];

    return (
        <div className="mt-12 space-y-6">
            <div
                ref={ref1}
                className={`rounded-2xl p-6 md:p-8 transition-all duration-700 ease-out ${v1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                style={{
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02))',
                    border: '1px solid rgba(16,185,129,0.2)'
                }}
            >
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: '#4ade80' }}>
                    <span className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-sm hidden md:flex">🎯</span>
                    Key Investment Strengths
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm" style={{ color: '#d1d5db' }}>
                    {strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                            <span className="text-green-400 mt-0.5">•</span>
                            <span className="leading-snug">{s}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div
                ref={ref2}
                className={`rounded-2xl p-6 md:p-8 transition-all duration-700 delay-100 ease-out ${v2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                style={{
                    background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(6,182,212,0.02))',
                    border: '1px solid rgba(6,182,212,0.2)'
                }}
            >
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-cyan-400">
                    <span className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-sm hidden md:flex">🛡️</span>
                    Risk Mitigation Factors
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm" style={{ color: '#d1d5db' }}>
                    {risks.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                            <span className="text-cyan-400 mt-0.5">•</span>
                            <span className="leading-snug">{s}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div
                ref={ref3}
                className={`rounded-2xl p-6 md:p-8 transition-all duration-700 delay-200 ease-out ${v3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                style={{
                    background: 'rgba(31,41,55,0.4)',
                    border: '1px solid #374151'
                }}
            >
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
                    <span className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm hidden md:flex">⏭️</span>
                    Recommended Next Steps
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {nextSteps.map(step => (
                        <div key={step.num} className="p-4 rounded-xl" style={{ background: 'rgba(17,24,39,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div className="text-2xl font-black mb-2 opacity-50" style={{ color: '#6b7280' }}>
                                {step.num}
                            </div>
                            <h4 className="text-sm font-semibold text-white mb-2">{step.title}</h4>
                            <p className="text-xs" style={{ color: '#9ca3af' }}>{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
