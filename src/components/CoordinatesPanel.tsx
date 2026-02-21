import React from 'react';
import { X, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, useDragControls, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/lib/i18n';

type CoordinatesPanelProps = {
    readonly geometry: any;
    readonly onClose: () => void;
    readonly embedded?: boolean;
};

export default function CoordinatesPanel({ geometry, onClose, embedded = false }: CoordinatesPanelProps) {
    const { t } = useLanguage();
    const dragControls = useDragControls();
    const [isCollapsed, setIsCollapsed] = React.useState(false);

    if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
        return null;
    }

    const coordsTable = (
        <div className="rounded-xl border border-edge bg-base/20 overflow-hidden shadow-inner">
            <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 bg-base border-b border-edge shadow-sm z-10">
                    <tr className="text-muted/70 uppercase tracking-wider font-bold text-[9px]">
                        <th className="px-3 py-2 w-10 bg-base">#</th>
                        <th className="px-3 py-2 bg-base">{t('coord.lon')}</th>
                        <th className="px-3 py-2 bg-base">{t('coord.lat')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-edge bg-base/40">
                    {(() => {
                        const coords = geometry.type === 'Polygon'
                            ? geometry.coordinates[0]
                            : geometry.coordinates[0][0];

                        return coords.slice(0, -1).map((pt: number[], idx: number) => (
                            <tr key={idx} className="hover:bg-panel transition-colors group">
                                <td className="px-3 py-1.5 font-mono text-muted group-hover:text-ink">{idx + 1}</td>
                                <td className="px-3 py-1.5 font-mono text-ink">{pt[0].toFixed(6)}</td>
                                <td className="px-3 py-1.5 font-mono text-ink">{pt[1].toFixed(6)}</td>
                            </tr>
                        ));
                    })()}
                </tbody>
            </table>
        </div>
    );

    // Embedded mode: static card matching LegendPanel style
    if (embedded) {
        return (
            <AnimatePresence mode="wait">
                {isCollapsed ? (
                    <motion.div
                        key="collapsed"
                        initial={{ opacity: 0, x: -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                        className="rounded-2xl border border-edge bg-panel p-3 md:p-4 shadow-2xl"
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">{t('coord.title')}</h2>
                            <button
                                onClick={() => setIsCollapsed(false)}
                                className="p-0.5 rounded text-muted hover:text-ink transition-colors"
                                title={t('tool.expand') + ' ' + t('coord.polygonTitle')}
                            >
                                <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="expanded"
                        initial={{ opacity: 0, x: -60, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -60, scale: 0.95 }}
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }}
                        className="rounded-2xl border border-edge bg-panel p-3 md:p-4 shadow-2xl flex flex-col max-h-[40vh]"
                    >
                        <div className="flex items-center justify-between mb-3 md:mb-4">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">{t('coord.polygonTitle')}</h2>
                            <button
                                onClick={() => setIsCollapsed(true)}
                                className="p-0.5 rounded text-muted hover:text-ink transition-colors"
                                title={t('tool.collapse') + ' ' + t('coord.polygonTitle')}
                            >
                                <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {coordsTable}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        );
    }

    // Floating draggable mode (original)
    return (
        <motion.div
            drag
            dragListener={false}
            dragControls={dragControls}
            dragMomentum={false}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-20 right-4 z-[1000]"
        >
            <AnimatePresence mode="wait">
                {isCollapsed ? (
                    <motion.div
                        key="collapsed"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="w-48 bg-base/95 backdrop-blur-md rounded-2xl shadow-xl border border-edge flex items-center justify-between p-2"
                    >
                        <div
                            onPointerDown={(e) => dragControls.start(e)}
                            className="flex items-center gap-2 px-2 cursor-grab active:cursor-grabbing touch-none select-none flex-1"
                        >
                            <GripVertical className="w-4 h-4 text-muted/50" />
                            <span className="text-[10px] font-bold text-ink uppercase tracking-wider">{t('coord.title')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsCollapsed(false)}
                                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-base transition-colors"
                            >
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-base transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="expanded"
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.22 }}
                        className="w-80 bg-base/95 backdrop-blur-md rounded-2xl shadow-xl border border-edge flex flex-col max-h-[50vh]"
                    >
                        {/* Header */}
                        <div
                            onPointerDown={(e) => dragControls.start(e)}
                            className="flex items-center justify-between border-b border-edge p-3 bg-base/50 rounded-t-2xl shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
                        >
                            <div className="flex items-center gap-2 pointer-events-none">
                                <GripVertical className="w-4 h-4 text-muted/50" />
                                <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                                    {t('coord.polygonTitle')}
                                </h3>
                            </div>
                            <div className="flex items-center gap-1 pointer-events-auto">
                                <button
                                    onClick={() => setIsCollapsed(true)}
                                    className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-base transition-colors"
                                >
                                    <ChevronUp className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-base transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                            {coordsTable}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

