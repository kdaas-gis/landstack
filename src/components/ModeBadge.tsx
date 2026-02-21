'use client';

import { motion, AnimatePresence } from 'motion/react';
import { GEOMETRY_TYPE_LABELS, type GeometryType } from '@/lib/geometry-utils';
import { useLanguage } from '@/lib/i18n';

interface ModeBadgeProps {
    readonly activeTool: string | null;
    readonly geometryType?: GeometryType;
}

const MODE_CONFIG: Record<string, { emoji: string; labelKey: string; color: string }> = {
    draw: { emoji: '✏️', labelKey: 'mode.draw', color: 'bg-accent/15 border-accent/30 text-accent' },
    measure: { emoji: '📐', labelKey: 'mode.measure', color: 'bg-amber-500/15 border-amber-500/30 text-amber-300' },
    identify: { emoji: 'ℹ️', labelKey: 'mode.identify', color: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300' },
};

export default function ModeBadge({ activeTool, geometryType }: ModeBadgeProps) {
    const { t } = useLanguage();
    const config = activeTool ? MODE_CONFIG[activeTool] : null;

    return (
        <AnimatePresence>
            {config && (
                <motion.div
                    initial={{ opacity: 0, x: -12, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -12, scale: 0.9 }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                    className={`inline-flex items-center gap-1.5 md:gap-2 rounded-full border px-2 py-1 md:px-3 md:py-1.5 text-[11px] md:text-xs font-semibold backdrop-blur-xl shadow-lg ${config.color}`}
                    style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
                >
                    <span>{config.emoji}</span>
                    <span>{t(config.labelKey)}</span>
                    {activeTool === 'draw' && geometryType && (
                        <>
                            <span className="text-white/20">—</span>
                            <span className="text-white/70">{t(`draw.${geometryType.toLowerCase()}`) || GEOMETRY_TYPE_LABELS[geometryType]}</span>
                        </>
                    )}
                    <span className="hidden md:inline text-[9px] text-white/30 ml-1">{t('mode.exit')}</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
