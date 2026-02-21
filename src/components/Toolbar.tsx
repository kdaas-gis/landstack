'use client';

import React from 'react';
import { motion } from 'motion/react';
import {
    Plus, Minus, House, Info, Crosshair, Pencil, Search
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import SearchBar from './SearchBar';
import type { SearchResult } from '@/lib/search';
import type { GeometryType } from '@/lib/geometry-utils';
import DrawToolbar from './DrawToolbar';

type ToolbarProps = {
    readonly onZoomIn: () => void;
    readonly onZoomOut: () => void;
    readonly onResetView: () => void;
    readonly onCurrentLocation: () => void;
    readonly activeTool: string | null;
    readonly onToggleTool: (tool: string) => void;
    readonly onResultSelect: (result: SearchResult) => void;
    readonly onSearchClick: () => void;
    readonly onAdvancedSearchClick: () => void;

    // Drawing props
    readonly drawGeometryType: GeometryType;
    readonly onDrawGeometryTypeChange: (type: GeometryType) => void;
    readonly drawSnapEnabled: boolean;
    readonly onDrawSnapToggle: () => void;
    readonly drawCanUndo: boolean;
    readonly drawCanRedo: boolean;
    readonly onDrawUndo: () => void;
    readonly onDrawRedo: () => void;
    readonly onDrawCancel: () => void;
};

export default function Toolbar({
    onZoomIn,
    onZoomOut,
    onResetView,
    onCurrentLocation,
    activeTool,
    onToggleTool,
    onResultSelect,
    onSearchClick,
    onAdvancedSearchClick,
    drawGeometryType,
    onDrawGeometryTypeChange,
    drawSnapEnabled,
    onDrawSnapToggle,
    drawCanUndo,
    drawCanRedo,
    onDrawUndo,
    onDrawRedo,
    onDrawCancel,

}: ToolbarProps) {
    const { t } = useLanguage();

    return (
        <div className="flex flex-col items-center gap-1.5 w-fit">
            {/* Primary Row */}
            <div className="flex items-center gap-0.5 md:gap-1 rounded-xl md:rounded-2xl border border-edge bg-panel p-1 md:p-1.5 shadow-2xl transition-all duration-300 hover:border-white/10 relative z-20">
                <div className="md:hidden">
                    <ToolbarButton
                        onClick={onSearchClick}
                        title={t('tool.search') || 'Search'}
                        icon={<Search size={16} />}
                    />
                </div>
                <div className="hidden md:block">
                    <SearchBar onResultSelect={onResultSelect} />
                </div>
                <motion.button
                    onClick={onAdvancedSearchClick}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center justify-center gap-2 px-3 py-1.5 ml-1 rounded-full bg-accent text-white font-bold text-[11px] shadow-lg shadow-accent/20 hover:brightness-110 transition-all"
                    title={t('tool.parcelSearch') || 'Parcel Search'}
                >
                    <Search size={14} strokeWidth={3} />
                    <span className="hidden md:inline whitespace-nowrap">{t('tool.parcelSearch')}</span>
                </motion.button>

                <ToolbarButton
                    onClick={onCurrentLocation}
                    title={t('tool.currentLocation') || 'My Location'}
                    icon={<Crosshair size={16} />}
                />
                <ToolbarButton
                    onClick={onResetView}
                    title={t('tool.reset') || 'Reset View'}
                    icon={<House size={16} />}
                />

                <div className="hidden md:flex items-center">

                    <div className="mx-0.5 md:mx-1 h-5 md:h-6 w-[1px] bg-edge" />

                    <ToolbarButton
                        onClick={onZoomIn}
                        title={t('tool.zoomIn')}
                        icon={<Plus size={16} />}
                    />
                    <ToolbarButton
                        onClick={onZoomOut}
                        title={t('tool.zoomOut')}
                        icon={<Minus size={16} />}
                    />
                </div>

                <div className="hidden md:block mx-0.5 md:mx-1 h-5 md:h-6 w-[1px] bg-edge" />

                <ToolbarButton
                    active={activeTool === 'draw'}
                    onClick={() => onToggleTool('draw')}
                    title={`${t('mode.draw')} (D)`}
                    icon={<Pencil size={16} />}
                />
                <ToolbarButton
                    active={activeTool === 'identify'}
                    onClick={() => onToggleTool('identify')}
                    title={t('tool.identify')}
                    icon={<Info size={16} />}
                />

                <div className="mx-0.5 md:mx-1 h-5 md:h-6 w-[1px] bg-edge" />

                <LanguagesButton />
            </div>

            {/* Draw Tool Extension (Row 2) */}
            <motion.div
                initial={false}
                animate={activeTool === 'draw' ? { height: 'auto', opacity: 1, y: 0 } : { height: 0, opacity: 0, y: -10 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                className="overflow-hidden w-full flex justify-center relative z-10"
            >
                <div className="flex items-center gap-1.5 p-1 rounded-xl border border-edge bg-panel/80 backdrop-blur-xl shadow-xl mt-0.5">
                    <DrawToolbar
                        variant="extension"
                        visible={activeTool === 'draw'}
                        geometryType={drawGeometryType}
                        onGeometryTypeChange={onDrawGeometryTypeChange}
                        snapEnabled={drawSnapEnabled}
                        onSnapToggle={onDrawSnapToggle}
                        canUndo={drawCanUndo}
                        canRedo={drawCanRedo}
                        onUndo={onDrawUndo}
                        onRedo={onDrawRedo}
                        onCancel={onDrawCancel}
                    />
                </div>
            </motion.div>
        </div>
    );
}

function LanguagesButton() {
    const { language, setLanguage } = useLanguage();

    return (
        <div className="flex items-center gap-0.5 rounded-full bg-base/80 p-0.5 border border-edge ml-1 shadow-inner relative isolate">
            <LanguageOption
                active={language === 'en'}
                onClick={() => setLanguage('en')}
                label="EN"
            />
            <LanguageOption
                active={language === 'kn'}
                onClick={() => setLanguage('kn')}
                label="ಕನ್ನಡ"
            />
        </div>
    );
}

function LanguageOption({ active, onClick, label }: { readonly active: boolean; readonly onClick: () => void; readonly label: string }) {
    return (
        <button
            onClick={onClick}
            className={`relative rounded-full px-3 py-1 text-[10px] font-black transition-colors z-10 ${active ? 'text-accent' : 'text-muted hover:text-ink'
                }`}
        >
            {active && (
                <motion.div
                    layoutId="language-active"
                    className="absolute inset-0 bg-white rounded-full shadow-sm ring-1 ring-black/5 -z-10"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
            )}
            <span className="relative z-10">{label}</span>
        </button>
    );
}

function ToolbarButton({
    icon,
    onClick,
    title,
    active = false,
    highlight = false
}: {
    readonly icon: React.ReactNode;
    readonly onClick: () => void;
    readonly title: string;
    readonly active?: boolean;
    readonly highlight?: boolean;
}) {
    let btnClass = 'toolbar-btn-default';
    if (active) {
        btnClass = 'toolbar-btn-active';
    } else if (highlight) {
        btnClass = 'toolbar-btn-highlight';
    }

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            title={title}
            className={`h-7 w-7 md:h-8 md:w-8 toolbar-btn ${btnClass}`}
        >
            {active && (
                <motion.div
                    layoutId="toolbar-active"
                    className="absolute inset-0 bg-accent rounded-lg z-0 shadow-lg shadow-accent/20"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
            )}
            <motion.span
                className="relative z-10 flex items-center justify-center"
                animate={highlight && !active ? {
                    scale: [1, 1.25, 1],
                } : {
                    scale: 1
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            >
                {/* Clone element to ensure we can control color if needed, though parent handles it */}
                {highlight && !active
                    ? React.cloneElement(icon as React.ReactElement, { className: 'text-accent' })
                    : icon
                }
            </motion.span>
        </motion.button>
    );
}
