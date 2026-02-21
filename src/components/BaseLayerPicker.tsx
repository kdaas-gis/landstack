'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BASE_LAYER_METADATA, BaseLayerType } from '@/lib/layers';
import { Layers, Check } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

type BaseLayerPickerProps = {
    readonly currentBaseLayer: BaseLayerType;
    readonly onChange: (type: BaseLayerType) => void;
};

export default function BaseLayerPicker({ currentBaseLayer, onChange }: BaseLayerPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useLanguage();

    const activeMetadata = BASE_LAYER_METADATA[currentBaseLayer];

    const getTranslatedName = (type: BaseLayerType) => {
        const map: Record<BaseLayerType, string> = {
            googleSatellite: t('base.satellite'),
            googleRoad: t('base.road'),
            googleHybrid: t('base.hybrid'),
            googleTerrain: t('base.terrain'),
            osm: t('base.osm'),
            bbmp: t('base.bbmp'),
        };
        return map[type] || type;
    };

    return (
        <div className="relative flex flex-row-reverse items-center">
            {/* 1. Trigger Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`group relative h-10 w-10 md:h-12 md:w-12 shrink-0 overflow-hidden rounded-xl border transition-all duration-300 shadow-lg ${isOpen ? 'border-accent ring-2 ring-accent/20' : 'border-edge hover:border-accent/40'
                    } bg-panel flex items-center justify-center`}
            >
                <img
                    src={activeMetadata.thumbnail}
                    alt="Current Basemap"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-0"
                />
                <Layers className={`h-4 w-4 md:h-5 md:w-5 relative z-10 transition-colors cursor-pointer ${isOpen ? 'text-accent' : 'text-muted group-hover:text-ink'}`} />
            </motion.button>

            {/* 2. Grid Popover */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, x: 10, y: 0 }}
                        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, x: 0, y: -10 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className="absolute right-full top-0 mr-2 z-50 rounded-2xl border border-edge bg-panel p-3 shadow-2xl w-[240px] md:w-[280px]"
                    >
                        <div className="mb-3 px-1 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">{t('map.layers')}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {(Object.entries(BASE_LAYER_METADATA) as [BaseLayerType, any][]).map(([type, config]) => {
                                const isActive = currentBaseLayer === type;
                                return (
                                    <motion.button
                                        key={type}
                                        whileHover={{ y: -2 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            onChange(type);
                                            setIsOpen(false);
                                        }}
                                        className={`group relative flex flex-col gap-1.5 rounded-xl border p-1 transition-all duration-200 ${isActive
                                            ? 'border-accent bg-accent/5 ring-1 ring-accent/20 shadow-md'
                                            : 'border-edge hover:border-accent/30 hover:bg-base/50'
                                            }`}
                                    >
                                        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-black/5">
                                            <img
                                                src={config.thumbnail}
                                                alt={config.name}
                                                className={`h-full w-full object-cover transition-transform duration-500 ${isActive ? 'scale-110' : 'group-hover:scale-110'
                                                    }`}
                                            />
                                            <div className={`absolute inset-0 transition-colors duration-300 ${isActive ? 'bg-accent/10' : 'bg-black/10 group-hover:bg-transparent'
                                                }`} />

                                            {isActive && (
                                                <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-accent flex items-center justify-center shadow-lg transform scale-100">
                                                    <Check className="h-3 w-3 text-white stroke-[4]" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="px-1 py-0.5">
                                            <p className={`text-[10px] font-bold truncate tracking-tight transition-colors ${isActive ? 'text-accent' : 'text-ink'
                                                }`}>
                                                {getTranslatedName(type)}
                                            </p>
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
