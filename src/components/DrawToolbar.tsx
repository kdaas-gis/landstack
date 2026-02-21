'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Minus, Pentagon, Square, Dot, Magnet, Undo2, Redo2, X } from 'lucide-react';
import type { GeometryType } from '@/lib/geometry-utils';

import { useLanguage } from '@/lib/i18n';

interface DrawToolbarProps {
    readonly visible: boolean;
    readonly geometryType: GeometryType;
    readonly onGeometryTypeChange: (type: GeometryType) => void;
    readonly snapEnabled: boolean;
    readonly onSnapToggle: () => void;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly onUndo: () => void;
    readonly onRedo: () => void;
    readonly onCancel: () => void;
    readonly variant?: 'standalone' | 'extension';
}

const SHAPE_BUTTONS: { type: GeometryType; icon: React.ReactNode; labelKey: string; shortcut: string }[] = [
    { type: 'Point', icon: <Dot size={14} />, labelKey: 'draw.point', shortcut: '1' },
    { type: 'LineString', icon: <Minus size={14} />, labelKey: 'draw.linestring', shortcut: '2' },
    { type: 'Polygon', icon: <Pentagon size={14} />, labelKey: 'draw.polygon', shortcut: '3' },
    { type: 'Rectangle', icon: <Square size={14} />, labelKey: 'draw.rectangle', shortcut: '4' },
];

export default function DrawToolbar({
    visible,
    geometryType,
    onGeometryTypeChange,
    snapEnabled,
    onSnapToggle,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onCancel,
    variant = 'standalone',
}: DrawToolbarProps) {
    const { t } = useLanguage();
    const isExtension = variant === 'extension';

    const content = (
        <div className={`flex flex-wrap justify-center items-center gap-1 p-0.5 ${isExtension ? '' : 'rounded-2xl border border-edge bg-panel shadow-2xl'}`}>
            {/* Shape selector */}
            <div className="flex items-center gap-0.5 rounded-xl bg-base/80 p-0.5 border border-edge relative isolate">
                {SHAPE_BUTTONS.map(({ type, icon, labelKey, shortcut }) => (
                    <motion.button
                        key={type}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onGeometryTypeChange(type)}
                        title={`${t(labelKey)} (${shortcut})`}
                        className={`relative flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors z-10 ${geometryType === type
                            ? 'text-white'
                            : 'text-muted hover:text-ink hover:bg-base'
                            }`}
                    >
                        {geometryType === type && (
                            <motion.div
                                layoutId="active-draw-shape"
                                className="absolute inset-0 bg-accent rounded-lg -z-10 shadow-lg shadow-accent/20"
                                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span className="flex items-center justify-center">{icon}</span>
                        <span className="hidden sm:inline lowercase first-letter:uppercase">{t(labelKey)}</span>
                    </motion.button>
                ))}
            </div>

            <div className="hidden sm:block mx-1 h-6 w-[1px] bg-edge" />

            {/* Snap toggle */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onSnapToggle}
                title={`${t('draw.snap')} ${snapEnabled ? 'ON' : 'OFF'} (S)`}
                className={`relative flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-all ${snapEnabled
                    ? 'text-emerald-500 bg-emerald-500/10'
                    : 'text-muted hover:text-ink hover:bg-base'
                    }`}
            >
                <div className="relative">
                    <span className="flex items-center justify-center"><Magnet size={14} /></span>
                    <motion.div
                        animate={snapEnabled ? { scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] } : { scale: 1, opacity: 1 }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-white ${snapEnabled ? 'bg-emerald-400' : 'bg-gray-400'
                            }`}
                    />
                </div>
                <span className="hidden sm:inline">{t('draw.snap')}</span>
            </motion.button>

            <div className="hidden sm:block mx-1 h-6 w-[1px] bg-edge" />

            {/* Undo / Redo */}
            <div className="flex items-center gap-0.5">
                <motion.button
                    whileHover={canUndo ? { scale: 1.1 } : {}}
                    whileTap={canUndo ? { scale: 0.9 } : {}}
                    onClick={onUndo}
                    disabled={!canUndo}
                    title={`${t('draw.undo')} (Ctrl+Z)`}
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-base transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <Undo2 size={14} />
                </motion.button>
                <motion.button
                    whileHover={canRedo ? { scale: 1.1 } : {}}
                    whileTap={canRedo ? { scale: 0.9 } : {}}
                    onClick={onRedo}
                    disabled={!canRedo}
                    title={`${t('draw.redo')} (Ctrl+Shift+Z)`}
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-base transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <Redo2 size={14} />
                </motion.button>
            </div>

            <div className="hidden sm:block mx-1 h-6 w-[1px] bg-edge" />

            {/* Cancel */}
            <motion.button
                whileHover={{ scale: 1.05, backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                whileTap={{ scale: 0.95 }}
                onClick={onCancel}
                title={`${t('draw.cancel')} (Esc)`}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-red-400 transition-all"
            >
                <X size={14} />
                <span className="hidden sm:inline">{t('draw.cancel')}</span>
            </motion.button>
        </div>
    );

    if (isExtension) {
        return content;
    }

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                    className="flex items-center justify-center"
                >
                    {content}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
