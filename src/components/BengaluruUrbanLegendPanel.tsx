'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import AnimatedCheckbox from '@/components/AnimatedCheckbox';

type BuLegendSublayer = {
    id: string;
    name: string;
    color: string;
    pattern?: string;
    checked: boolean;
};

type BuLegendTaluk = {
    id: string;
    name: string;
    checked: boolean;
    sublayers: BuLegendSublayer[];
};

type BengaluruUrbanLegendPanelProps = {
    taluks: BuLegendTaluk[];
    onToggleTaluk: (talukId: string, checked: boolean) => void;
    onToggleSublayer: (talukId: string, sublayerId: string, checked: boolean) => void;
    onZoomToTaluk: (talukId: string) => void;
};

export default function BengaluruUrbanLegendPanel({ taluks, onToggleTaluk, onToggleSublayer, onZoomToTaluk }: BengaluruUrbanLegendPanelProps) {
    const { t } = useLanguage();

    const [collapsed, setCollapsed] = useState(false);
    // Track expanded state instead of collapsed state to default to collapsed (false)
    const [expandedTaluks, setExpandedTaluks] = useState<Record<string, boolean>>({});

    const toggleTalukExpanded = (talukId: string) => {
        setExpandedTaluks((prev) => ({
            ...prev,
            [talukId]: !prev[talukId],
        }));
    };

    return (
        <div className="w-[220px] md:w-[260px]">
            <AnimatePresence mode="wait" initial={false}>
                {collapsed ? (
                    <motion.button
                        key="collapsed"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setCollapsed(false)}
                        className="w-full rounded-xl border border-edge bg-panel px-3 py-2 shadow-lg flex items-center justify-between transition-all duration-300 hover:bg-base hover:scale-[1.02] hover:shadow-[0_0_12px_rgba(6,182,212,0.2)] active:scale-98"
                        title={t('tool.show') + ' ' + t('legend.bu.title')}
                    >
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">{t('legend.bu.title')}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-accent" />
                    </motion.button>
                ) : (
                    <motion.div
                        key="expanded"
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.22 }}
                        className="rounded-2xl border border-edge bg-panel p-3 shadow-2xl"
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">
                                {t('legend.bu.govtLands')}
                            </h2>
                            <button
                                onClick={() => setCollapsed(true)}
                                className="p-0.5 rounded text-muted transition-all duration-300 hover:text-ink hover:bg-black/5 hover:scale-110 active:scale-95"
                                title={t('tool.collapse') + ' ' + t('legend.bu.title')}
                            >
                                <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {taluks.map((taluk) => (
                                <div key={taluk.name} className="rounded-lg border border-edge/60 bg-base/30 px-2.5 py-2">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <label className="flex items-center gap-2.5 cursor-pointer">
                                            <AnimatedCheckbox
                                                checked={taluk.checked}
                                                onChange={(checked) => onToggleTaluk(taluk.id, checked)}
                                            />
                                            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-muted">
                                                {t(taluk.name)}
                                            </span>
                                        </label>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => onZoomToTaluk(taluk.id)}
                                                className="px-1.5 py-0.5 rounded border border-edge text-[10px] font-bold uppercase tracking-[0.08em] text-muted transition-all duration-300 hover:text-ink hover:bg-base hover:shadow focus:ring-1 focus:ring-accent/40 active:scale-95"
                                                title={t('tool.zoom') + ' ' + t(taluk.name)}
                                            >
                                                {t('tool.zoom')}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => toggleTalukExpanded(taluk.id)}
                                                className="p-0.5 rounded text-muted transition-all duration-300 hover:text-ink hover:bg-black/5 hover:scale-110 active:scale-95"
                                                title={expandedTaluks[taluk.id] ? `${t('tool.collapse')} ${t(taluk.name)}` : `${t('tool.expand')} ${t(taluk.name)}`}
                                            >
                                                {expandedTaluks[taluk.id] ? (
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                ) : (
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    {expandedTaluks[taluk.id] && (
                                        <div className="space-y-1.5">
                                            {taluk.sublayers.map((item) => (
                                                <label key={`${taluk.id}-${item.id}`} className="flex items-center gap-2.5 pl-6 cursor-pointer">
                                                    <AnimatedCheckbox
                                                        checked={item.checked}
                                                        onChange={(checked) => onToggleSublayer(taluk.id, item.id, checked)}
                                                    />
                                                    {item.pattern === 'hatch' ? (
                                                        <svg className="h-2.5 w-2.5 rounded" viewBox="0 0 10 10">
                                                            <defs>
                                                                <pattern id={`bu-hatch-${taluk.id}-${item.id}`} patternUnits="userSpaceOnUse" width="3" height="3">
                                                                    <circle cx="1.5" cy="1.5" r="0.8" fill={item.color} />
                                                                </pattern>
                                                            </defs>
                                                            <rect width="10" height="10" fill={`${item.color}22`} />
                                                            <rect width="10" height="10" fill={`url(#bu-hatch-${taluk.id}-${item.id})`} />
                                                            <rect width="10" height="10" fill="none" stroke={item.color} strokeWidth="1" />
                                                        </svg>
                                                    ) : (
                                                        <div className="h-2.5 w-2.5 rounded border border-black/10" style={{ backgroundColor: item.color }} />
                                                    )}
                                                    <span className="text-[11px] font-semibold tracking-tight text-ink">{t(item.name)}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
