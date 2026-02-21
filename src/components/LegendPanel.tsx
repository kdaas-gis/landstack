'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import AnimatedCheckbox from '@/components/AnimatedCheckbox';

type LegendPanelProps = {
    readonly currentZoom: number;
    readonly layerToggles: {
        districts: boolean;
        taluks: boolean;
        hoblis: boolean;
        villages: boolean;
        bengaluruUrban: boolean;
        surveyPolygons: boolean;
    };
    readonly onToggleLayer: (layerId: 'karnataka-districts' | 'karnataka-taluks' | 'karnataka-hoblis' | 'karnataka-villages' | 'survey-number-boundary' | 'survey-polygons', visible: boolean) => void;
};

const LEGEND_ITEMS: Array<{
    nameKey: string;
    color: string;
    minZoom: number;
    maxZoom: number;
    layerId?: 'karnataka-districts' | 'karnataka-taluks' | 'karnataka-hoblis' | 'karnataka-villages' | 'survey-number-boundary' | 'survey-polygons';
    pattern?: 'hatch';
}> = [
        { nameKey: 'layer.districts', color: '#ff0000ff', minZoom: 0, maxZoom: 9, layerId: 'karnataka-districts' },
        { nameKey: 'layer.taluks', color: '#0008ffff', minZoom: 9, maxZoom: 11, layerId: 'karnataka-taluks' },
        { nameKey: 'layer.hoblis', color: '#000000ff', minZoom: 11, maxZoom: 13, layerId: 'karnataka-hoblis' },
        { nameKey: 'layer.villages', color: '#00ffeeff', minZoom: 13, maxZoom: 22, layerId: 'karnataka-villages' },
        { nameKey: 'layer.bengaluru_urban', color: '#eeff00ff', minZoom: 14, maxZoom: 22, layerId: 'survey-number-boundary' },
        { nameKey: 'layer.survey_polygons', color: '#ef4444', minZoom: 14, maxZoom: 22, pattern: 'hatch', layerId: 'survey-polygons' },
    ];

export default function LegendPanel({ currentZoom, layerToggles, onToggleLayer }: LegendPanelProps) {
    const { t } = useLanguage();
    const [collapsed, setCollapsed] = useState(false);

    const renderItems = () =>
        LEGEND_ITEMS.map((item) => {
            const isActive = currentZoom >= item.minZoom && currentZoom < item.maxZoom;
            return (
                <div
                    key={item.nameKey}
                    className={`flex items-center gap-3 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-40'}`}
                >
                    {item.pattern === 'hatch' ? (
                        <svg className="h-3 w-3 rounded shadow-sm shrink-0" viewBox="0 0 12 12">
                            <defs>
                                <pattern id={`hatch-${item.nameKey}`} patternUnits="userSpaceOnUse" width="4" height="4">
                                    <circle cx="2" cy="2" r="1" fill={item.color} />
                                </pattern>
                            </defs>
                            <rect width="12" height="12" fill={`${item.color}22`} />
                            <rect width="12" height="12" fill={`url(#hatch-${item.nameKey})`} />
                            <rect width="12" height="12" fill="none" stroke={item.color} strokeWidth="1.5" />
                        </svg>
                    ) : (
                        <div
                            className="h-3 w-3 rounded shadow-sm border border-black/5 shrink-0"
                            style={{ backgroundColor: item.color }}
                        />
                    )}
                    <span className={`text-[12px] font-bold tracking-tight flex-1 ${isActive ? 'text-ink' : 'text-muted'}`}>
                        {t(item.nameKey)}
                    </span>
                    {item.layerId && (
                        <AnimatedCheckbox
                            checked={
                                item.layerId === 'karnataka-districts' ? layerToggles.districts
                                    : item.layerId === 'karnataka-taluks' ? layerToggles.taluks
                                        : item.layerId === 'karnataka-hoblis' ? layerToggles.hoblis
                                            : item.layerId === 'karnataka-villages' ? layerToggles.villages
                                                : item.layerId === 'survey-polygons' ? layerToggles.surveyPolygons
                                                    : layerToggles.bengaluruUrban
                            }
                            onChange={(checked) => item.layerId && onToggleLayer(item.layerId, checked)}
                        />
                    )}
                </div>
            );
        });

    return (
        <AnimatePresence mode="wait">
            {collapsed ? (
                <motion.button
                    layout
                    key="collapsed"
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                    onClick={() => setCollapsed(false)}
                    className="rounded-r-xl border border-l-0 border-edge bg-panel px-1.5 py-3 shadow-xl transition-all duration-300 hover:bg-base hover:scale-105 hover:shadow-[0_0_12px_rgba(6,182,212,0.2)] active:scale-95 -ml-3 md:-ml-6"
                    title={t('tool.show') + ' ' + t('map.legend')}
                >
                    <ChevronRight className="w-3.5 h-3.5 text-accent" />
                </motion.button>
            ) : (
                <motion.div
                    layout
                    key="expanded"
                    initial={{ opacity: 0, x: -60, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -60, scale: 0.95 }}
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }}
                    className="rounded-2xl border border-edge bg-panel p-3 md:p-4 shadow-2xl"
                >
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">{t('map.legend')}</h2>
                        <button
                            onClick={() => setCollapsed(true)}
                            className="p-0.5 rounded text-muted transition-all duration-300 hover:text-ink hover:bg-black/5 hover:scale-110 active:scale-95"
                            title={t('tool.collapse') + ' ' + t('map.legend')}
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="space-y-3">
                        {renderItems()}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
