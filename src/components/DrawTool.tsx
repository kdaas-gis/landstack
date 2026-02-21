'use client';

import { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp, Undo2, Redo2 } from 'lucide-react';
import Map from 'ol/Map';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import Feature from 'ol/Feature';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import CircleStyle from 'ol/style/Circle';
import { Draw, Modify, Snap } from 'ol/interaction';
import Overlay from 'ol/Overlay';
import { unByKey } from 'ol/Observable';
import { LineString, Point, Polygon, Circle } from 'ol/geom';
import { createBox } from 'ol/interaction/Draw';
import type { EventsKey } from 'ol/events';
import type { DrawEvent } from 'ol/interaction/Draw';
import type { ModifyEvent } from 'ol/interaction/Modify';
import {
    segmentLength,
    calculateBearing,
    formatBearingCompact,
    formatDistance,
    formatArea,
    formatBearing,
    polygonArea,
    coordsEqual,
    type GeometryType,
    type DistanceUnit,
    type AreaUnit,
    DISTANCE_UNITS,
    AREA_UNITS,
} from '@/lib/geometry-utils';

// ── Props ───────────────────────────────────────────────

export interface DrawToolHandle {
    undo: () => void;
    redo: () => void;
    cancel: () => void;
}

interface DrawToolProps {
    readonly map: Map | null;
    readonly active: boolean;
    readonly geometryType: GeometryType;
    readonly snapEnabled: boolean;
    readonly onClose?: () => void;
    readonly onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

// ── Styles ──────────────────────────────────────────────

const DRAWING_STYLE = new Style({
    stroke: new Stroke({ color: 'rgba(255, 204, 51, 0.8)', lineDash: [10, 6], width: 2.5 }),
    fill: new Fill({ color: 'rgba(255, 204, 51, 0.06)' }),
    image: new CircleStyle({
        radius: 5,
        fill: new Fill({ color: '#ffcc33' }),
        stroke: new Stroke({ color: '#333', width: 1.5 }),
    }),
});

const FINISHED_STYLE = new Style({
    stroke: new Stroke({ color: '#3b82f6', width: 3 }),
    fill: new Fill({ color: 'rgba(59, 130, 246, 0.1)' }),
});

const VERTEX_STYLE = new Style({
    image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: '#ffffff' }),
        stroke: new Stroke({ color: '#3b82f6', width: 2 }),
    }),
});

const MIDPOINT_STYLE = new Style({
    image: new CircleStyle({
        radius: 4,
        fill: new Fill({ color: 'rgba(255, 255, 255, 0.5)' }),
        stroke: new Stroke({ color: '#3b82f6', width: 1, lineDash: [3, 3] }),
    }),
});

// ── Helpers ─────────────────────────────────────────────

function createLabelEl(text: string, isSegment: boolean): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, {
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        fontSize: '11px',
        fontWeight: '600',
        padding: '2px 8px',
        borderRadius: '4px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        fontFamily: "'Inter', system-ui, sans-serif",
        letterSpacing: '0.01em',
        background: isSegment ? 'rgba(15, 23, 42, 0.88)' : '#3b82f6',
        color: '#fff',
        border: isSegment ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.3)',
    });
    el.textContent = text;
    return el;
}

function createTooltipEl(): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, {
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        fontSize: '11px',
        fontWeight: '600',
        padding: '4px 10px',
        borderRadius: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        fontFamily: "'Inter', system-ui, sans-serif",
        background: 'rgba(15, 23, 42, 0.92)',
        color: '#e2e8f0',
        border: '1px solid rgba(59,130,246,0.5)',
        display: 'none',
    });
    return el;
}

function getGeomCoords(feature: Feature): number[][] {
    const geom = feature.getGeometry();
    if (!geom) return [];
    if (geom instanceof Polygon) return geom.getCoordinates()[0];
    if (geom instanceof LineString) return geom.getCoordinates();
    if (geom instanceof Point) return [geom.getCoordinates()];
    if (geom instanceof Circle) {
        // Box geometries stored as Circle in OL but actually a polygon
        const ext = geom.getExtent();
        return [
            [ext[0], ext[1]], [ext[2], ext[1]],
            [ext[2], ext[3]], [ext[0], ext[3]],
            [ext[0], ext[1]],
        ];
    }
    return [];
}

// ── Component ───────────────────────────────────────────

export interface MeasureRow {
    x: number;
    y: number;
    segmentDist: number | null;
    bearing: number | null;
}

const DrawTool = forwardRef<DrawToolHandle, DrawToolProps>(({ map, active, geometryType, snapEnabled, onClose, onHistoryChange }, ref) => {
    // Measurement state
    const [rows, setRows] = useState<MeasureRow[]>([]);
    const [totalDist, setTotalDist] = useState(0);
    const [totalArea, setTotalArea] = useState(0);
    const [isClosed, setIsClosed] = useState(false);
    const [distUnit, setDistUnit] = useState<DistanceUnit>('m');
    const [areaUnit, setAreaUnit] = useState<AreaUnit>('ac');
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasGeometry, setHasGeometry] = useState(false);

    // Undo/redo

    const undoStackRef = useRef<number[][][]>([]);
    const redoStackRef = useRef<number[][][]>([]);

    const [historyState, setHistoryState] = useState({ undo: false, redo: false });

    // ── Check if we can undo (either historystack or drawing points) ──
    const getUndoState = useCallback(() => {
        if (isDrawing) {
            // If drawing, we can "undo" if we have at least 1 point (start point)
            // But usually we want at least 2 points to undo back to 1.
            // Let's just say if drawing is active, we can likely undo the last point.
            return true;
        }
        return undoStackRef.current.length > 0;
    }, [isDrawing]);

    const notifyHistory = useCallback(() => {
        const canUndo = getUndoState();
        const canRedo = !isDrawing && redoStackRef.current.length > 0;
        onHistoryChange?.(canUndo, canRedo);
        setHistoryState({ undo: canUndo, redo: canRedo });
    }, [onHistoryChange, getUndoState, isDrawing]);

    // OL refs
    const drawRef = useRef<Draw | null>(null);
    const modifyRef = useRef<Modify | null>(null);
    const sourceRef = useRef<VectorSource | null>(null);
    const overlaysRef = useRef<Overlay[]>([]);
    const currentFeatureRef = useRef<Feature | null>(null);

    // Persist unit selection
    useEffect(() => {
        const savedDist = localStorage.getItem('landstack-dist-unit') as DistanceUnit;
        const savedArea = localStorage.getItem('landstack-area-unit') as AreaUnit;
        if (savedDist && DISTANCE_UNITS.some(u => u.value === savedDist)) setDistUnit(savedDist);
        if (savedArea && AREA_UNITS.some(u => u.value === savedArea)) setAreaUnit(savedArea);
    }, []);

    useEffect(() => { localStorage.setItem('landstack-dist-unit', distUnit); }, [distUnit]);
    useEffect(() => { localStorage.setItem('landstack-area-unit', areaUnit); }, [areaUnit]);

    // ── Clear all overlays from map ──
    const clearOverlays = useCallback(() => {
        overlaysRef.current.forEach(ov => map?.removeOverlay(ov));
        overlaysRef.current = [];
    }, [map]);

    // ── Add segment label to map ──
    const addSegmentLabel = useCallback((midpoint: number[], dist: number, bearing: number) => {
        const text = `${formatDistance(dist, distUnit)} · ${formatBearingCompact(bearing)}`;
        const el = createLabelEl(text, true);
        const ov = new Overlay({
            element: el,
            positioning: 'bottom-center',
            offset: [0, -8],
            position: midpoint,
        });
        map?.addOverlay(ov);
        overlaysRef.current.push(ov);
    }, [map, distUnit]);

    // ── Rebuild segment labels for a set of coords ──
    const rebuildLabels = useCallback((coords: number[][]) => {
        clearOverlays();
        for (let i = 1; i < coords.length; i++) {
            const prev = coords[i - 1];
            const curr = coords[i];
            // Skip closing segment that is same as first point
            if (i === coords.length - 1 && coordsEqual(prev, curr)) continue;
            const dist = segmentLength(prev, curr);
            const brng = calculateBearing(prev, curr);
            const mid = [(prev[0] + curr[0]) / 2, (prev[1] + curr[1]) / 2];
            addSegmentLabel(mid, dist, brng);
        }
    }, [clearOverlays, addSegmentLabel]);

    // ── Update measurement state from coords ──
    const updateMeasurement = useCallback((coords: number[][], closed: boolean) => {
        const newRows: MeasureRow[] = coords.map((c, i) => ({
            x: c[0],
            y: c[1],
            segmentDist: i > 0 ? segmentLength(coords[i - 1], c) : null,
            bearing: i > 0 ? calculateBearing(coords[i - 1], c) : null,
        }));

        // Filter out duplicate closing point for display
        if (closed && newRows.length > 1 && coordsEqual(coords[0], coords.at(-1)!)) {
            newRows.pop();
        }

        setRows(newRows);
        setIsClosed(closed);

        let total = 0;
        for (let i = 1; i < coords.length; i++) {
            total += segmentLength(coords[i - 1], coords[i]);
        }
        setTotalDist(total);

        if (closed && coords.length >= 4) {
            setTotalArea(polygonArea(coords));
        } else {
            setTotalArea(0);
        }
    }, []);

    // ── Push to undo stack ──
    const pushUndo = useCallback((coords: number[][]) => {
        undoStackRef.current.push(coords.map(c => [...c]));
        redoStackRef.current = [];
        notifyHistory();
    }, [notifyHistory]);

    // ── Undo ──
    const doUndo = useCallback(() => {
        // If actively drawing, remove last point
        if (isDrawing && drawRef.current) {
            drawRef.current.removeLastPoint();
            return;
        }

        const feature = currentFeatureRef.current;
        if (!feature || undoStackRef.current.length === 0) return;

        const geom = feature.getGeometry();
        if (!geom) return;

        // Save current state to redo
        const currentCoords = getGeomCoords(feature);
        redoStackRef.current.push(currentCoords.map(c => [...c]));

        // Pop undo
        const prevCoords = undoStackRef.current.pop()!;

        if (geom instanceof Polygon) {
            geom.setCoordinates([prevCoords]);
        } else if (geom instanceof LineString) {
            geom.setCoordinates(prevCoords);
        }

        const closed = geom instanceof Polygon;
        rebuildLabels(prevCoords);
        updateMeasurement(prevCoords, closed);
        notifyHistory();
    }, [rebuildLabels, updateMeasurement, notifyHistory]);

    // ── Redo ──
    const doRedo = useCallback(() => {
        const feature = currentFeatureRef.current;
        if (!feature || redoStackRef.current.length === 0) return;

        const geom = feature.getGeometry();
        if (!geom) return;

        // Save current to undo
        const currentCoords = getGeomCoords(feature);
        undoStackRef.current.push(currentCoords.map(c => [...c]));

        const nextCoords = redoStackRef.current.pop()!;

        if (geom instanceof Polygon) {
            geom.setCoordinates([nextCoords]);
        } else if (geom instanceof LineString) {
            geom.setCoordinates(nextCoords);
        }

        const closed = geom instanceof Polygon;
        rebuildLabels(nextCoords);
        updateMeasurement(nextCoords, closed);
        notifyHistory();
    }, [rebuildLabels, updateMeasurement, notifyHistory]);

    // Expose handle
    useImperativeHandle(ref, () => ({
        undo: doUndo,
        redo: doRedo,
        cancel: () => {
            if (active) onClose?.();
        },
    }));

    // Expose undo/redo to keyboard handler
    useEffect(() => {
        if (!active) return;
        const handler = (e: KeyboardEvent) => {
            // Only handle when not in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
                e.preventDefault();
                doUndo();
            }
            if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
                e.preventDefault();
                doRedo();
            }
            if (e.key === 'Escape') {
                // If drawing, cancel the draw
                if (drawRef.current && isDrawing) {
                    drawRef.current.abortDrawing();
                    setIsDrawing(false);
                } else {
                    onClose?.();
                }
            }
            if (e.key === 'Backspace' && isDrawing && drawRef.current) {
                e.preventDefault();
                drawRef.current.removeLastPoint();
            }
        };
        globalThis.addEventListener('keydown', handler);
        return () => globalThis.removeEventListener('keydown', handler);
    }, [active, isDrawing, doUndo, doRedo, onClose]);

    // ── Main OL interaction effect ──
    useEffect(() => {
        if (!map || !active) return;

        const source = new VectorSource();
        sourceRef.current = source;

        const drawLayer = new VectorLayer({
            source,
            style: (feature) => {
                const geom = feature.getGeometry();
                if (!geom) return FINISHED_STYLE;
                // Return both fill/stroke + vertex styles
                return [FINISHED_STYLE, VERTEX_STYLE];
            },
            zIndex: 1000,
        });
        map.addLayer(drawLayer);

        // Help tooltip
        const tooltipEl = createTooltipEl();
        const tooltipOverlay = new Overlay({
            element: tooltipEl,
            offset: [20, 10],
            positioning: 'center-left',
        });
        map.addOverlay(tooltipOverlay);

        // Determine OL draw type
        let olType: 'Point' | 'LineString' | 'Polygon' | 'Circle' = geometryType as any;
        let geometryFunction: any = undefined;

        if (geometryType === 'Rectangle') {
            olType = 'Circle';
            geometryFunction = createBox();
        }

        // Draw interaction
        const draw = new Draw({
            source,
            type: olType,
            style: DRAWING_STYLE,
            geometryFunction,
            condition: (e) => (e.originalEvent as MouseEvent).button === 0,
            freehandCondition: () => false,
        });
        drawRef.current = draw;

        let geoKey: EventsKey | null = null;
        let sketchVertices: number[][] = [];

        draw.on('drawstart', (evt: DrawEvent) => {
            // Clear previous geometry
            source.clear();
            clearOverlays();
            setRows([]);
            setTotalDist(0);
            setTotalArea(0);
            setIsClosed(false);
            setIsDrawing(true);
            setHasGeometry(false);
            currentFeatureRef.current = null;
            undoStackRef.current = [];
            redoStackRef.current = [];
            sketchVertices = [];
            setHasGeometry(false);
            currentFeatureRef.current = null;
            undoStackRef.current = [];
            redoStackRef.current = [];
            sketchVertices = [];
            // Force enable undo button while drawing
            setHistoryState({ undo: true, redo: false });
            onHistoryChange?.(true, false);

            const sketch = evt.feature;
            geoKey = sketch.getGeometry()!.on('change', (changeEvt) => {
                const geom = changeEvt.target;

                let coords: number[][] = [];
                let isPoly = false;

                if (geom instanceof Polygon) {
                    coords = geom.getCoordinates()[0];
                    isPoly = true;
                } else if (geom instanceof LineString) {
                    coords = geom.getCoordinates();
                } else if (geom instanceof Point) {
                    coords = [geom.getCoordinates()];
                }

                if (coords.length < 2) {
                    tooltipEl.style.display = 'none';
                    return;
                }

                // Current segment (last fixed to cursor)
                const fixedCount = coords.length - 1;
                const cursor = coords.at(-1)!;
                const prev = coords.length >= 2 ? coords.at(-2)! : null;

                // Show tooltip with current segment + total
                if (prev) {
                    const segDist = segmentLength(prev, cursor);
                    const segBrng = calculateBearing(prev, cursor);
                    let total = 0;
                    for (let i = 1; i < coords.length; i++) {
                        total += segmentLength(coords[i - 1], coords[i]);
                    }

                    let tooltipHtml = `<span style="color:#93c5fd">Seg:</span> ${formatDistance(segDist, 'm')} · ${formatBearingCompact(segBrng)}`;
                    tooltipHtml += `<br/><span style="color:#93c5fd">Total:</span> ${formatDistance(total, 'm')}`;

                    if (isPoly && coords.length >= 4) {
                        const a = polygonArea(coords);
                        tooltipHtml += `<br/><span style="color:#6ee7b7">Area:</span> ${formatArea(a, 'ac')}`;
                    }

                    tooltipEl.innerHTML = tooltipHtml;
                    tooltipEl.style.display = '';
                    tooltipEl.style.whiteSpace = 'normal';
                    tooltipEl.style.maxWidth = '200px';
                }

                // Add segment labels for newly fixed vertices
                if (!isPoly) {
                    while (sketchVertices.length < fixedCount) {
                        const idx = sketchVertices.length;
                        sketchVertices.push(coords[idx]);
                        if (idx > 0) {
                            const p = coords[idx - 1];
                            const c = coords[idx];
                            const dist = segmentLength(p, c);
                            const brng = calculateBearing(p, c);
                            const mid = [(p[0] + c[0]) / 2, (p[1] + c[1]) / 2];
                            addSegmentLabel(mid, dist, brng);
                        }
                    }
                }
            });
        });

        draw.on('drawend', (evt: DrawEvent) => {
            setIsDrawing(false);
            setHasGeometry(true);
            tooltipEl.style.display = 'none';

            if (geoKey) { unByKey(geoKey); geoKey = null; }

            const feature = evt.feature;
            currentFeatureRef.current = feature;

            const coords = getGeomCoords(feature);

            const geom = feature.getGeometry();
            const closed = geom instanceof Polygon || geometryType === 'Rectangle';

            rebuildLabels(coords);
            updateMeasurement(coords, closed);
            pushUndo(coords);
            sketchVertices = [];
        });

        map.addInteraction(draw);

        // Modify interaction for editing finished geometries
        const modify = new Modify({
            source,
            style: MIDPOINT_STYLE,
            deleteCondition: (e) => {
                return (e.originalEvent as KeyboardEvent).altKey && e.type === 'pointerdown';
            },
        });
        modifyRef.current = modify;

        modify.on('modifystart', () => {
            const feature = currentFeatureRef.current;
            if (feature) {
                pushUndo(getGeomCoords(feature));
            }
        });

        modify.on('modifyend', (evt: ModifyEvent) => {
            const features = evt.features.getArray();
            if (features.length > 0) {
                const feature = features[0];
                currentFeatureRef.current = feature;
                const coords = getGeomCoords(feature);
                const geom = feature.getGeometry();
                const closed = geom instanceof Polygon;

                rebuildLabels(coords);
                updateMeasurement(coords, closed);
            }
        });

        map.addInteraction(modify);

        // Snap interaction
        const snaps: Snap[] = [];
        if (snapEnabled) {
            // Snap to own source
            const selfSnap = new Snap({ source });
            map.addInteraction(selfSnap);
            snaps.push(selfSnap);

            // Snap to other vector layers
            map.getLayers().getArray().forEach(l => {
                if (l instanceof VectorLayer && l !== drawLayer) {
                    const s = l.getSource();
                    if (s) {
                        const snap = new Snap({ source: s });
                        map.addInteraction(snap);
                        snaps.push(snap);
                    }
                }
            });
        }

        // Pointer move for tooltip positioning
        const pointerMoveHandler = (evt: any) => {
            if (evt.dragging) return;
            tooltipOverlay.setPosition(evt.coordinate);
        };
        map.on('pointermove', pointerMoveHandler);

        // Context menu prevention on map
        const ctxHandler = (e: Event) => e.preventDefault();
        map.getViewport().addEventListener('contextmenu', ctxHandler);

        return () => {
            map.removeInteraction(draw);
            map.removeInteraction(modify);
            snaps.forEach(s => map.removeInteraction(s));
            map.removeLayer(drawLayer);
            map.removeOverlay(tooltipOverlay);
            map.un('pointermove', pointerMoveHandler);
            map.getViewport().removeEventListener('contextmenu', ctxHandler);
            clearOverlays();
            drawRef.current = null;
            modifyRef.current = null;
            sourceRef.current = null;
            currentFeatureRef.current = null;
        };
    }, [map, active, geometryType, snapEnabled]);

    // ── Rebuild labels when unit changes ──
    useEffect(() => {
        if (!active || !hasGeometry || !currentFeatureRef.current) return;
        const coords = getGeomCoords(currentFeatureRef.current);
        if (coords.length >= 2) {
            rebuildLabels(coords);
        }
    }, [distUnit, active, hasGeometry, rebuildLabels]);

    const [isExpanded, setIsExpanded] = useState(true);

    if (!active) return null;

    // ── Render measurement panel ──
    return (
        <div
            className="fixed bottom-10 left-0 right-0 md:bottom-20 md:left-auto md:right-6 z-50 w-full md:w-[320px] select-none p-4 md:p-0"
            style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
        >
            <div className="rounded-xl border border-white/10 bg-[#1a1a1d]/95 shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-300">
                {/* Header */}
                <div
                    className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white tracking-wide">Drawing</span>
                        {isDrawing && (
                            <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                                Drawing...
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            className={`text-white/50 hover:text-white transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            title={isExpanded ? "Collapse" : "Expand"}
                        >
                            <ChevronUp size={16} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose?.();
                            }}
                            className="text-white/50 hover:text-white transition-colors text-lg leading-none"
                            title="Close"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Summary */}
                            {rows.length > 0 && (
                                <div className="border-b border-white/10 px-4 py-2.5 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-white/50 font-medium">Perimeter</span>
                                        <span className="text-sm font-bold text-accent tabular-nums">
                                            {formatDistance(totalDist, distUnit)}
                                        </span>
                                    </div>
                                    {(isClosed || totalArea > 0) && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-white/50 font-medium">Area</span>
                                            <span className="text-sm font-bold text-emerald-400 tabular-nums">
                                                {formatArea(totalArea, areaUnit)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-white/50 font-medium">Vertices</span>
                                        <span className="text-sm font-bold text-white/70 tabular-nums">{rows.length}</span>
                                    </div>
                                </div>
                            )}

                            {/* Segments table */}
                            <div className="max-h-[150px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-[10px]">
                                    <thead>
                                        <tr className="border-b border-white/10 text-white/60">
                                            <th className="px-2 py-1 text-left font-medium w-6">#</th>
                                            <th className="px-2 py-1 text-left font-medium">X</th>
                                            <th className="px-2 py-1 text-left font-medium">Y</th>
                                            <th className="px-2 py-1 text-right font-medium">Dist</th>
                                            <th className="px-2 py-1 text-right font-medium">Brng</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-3 py-6 text-center text-white/30 text-xs">
                                                    Click on the map to start drawing
                                                </td>
                                            </tr>
                                        ) : (
                                            rows.map((r, i) => (
                                                <tr key={`seg-${r.x}-${r.y}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                    <td className="px-2 py-0.5 text-white/40 tabular-nums">{i + 1}</td>
                                                    <td className="px-2 py-0.5 text-white/80 tabular-nums">{r.x.toFixed(4)}</td>
                                                    <td className="px-2 py-0.5 text-white/80 tabular-nums">{r.y.toFixed(4)}</td>
                                                    <td className="px-2 py-0.5 text-right text-accent tabular-nums font-medium">
                                                        {r.segmentDist === null || r.segmentDist === undefined ? '—' : formatDistance(r.segmentDist, distUnit)}
                                                    </td>
                                                    <td className="px-2 py-0.5 text-right text-amber-300 tabular-nums font-medium">
                                                        {r.bearing === null || r.bearing === undefined ? '—' : formatBearing(r.bearing)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Unit selectors */}
                            <div className="border-t border-white/10 px-4 py-2 flex items-center gap-3 text-[10px]">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-white/40 font-medium uppercase tracking-wider">Dist:</span>
                                    <select
                                        value={distUnit}
                                        onChange={(e) => setDistUnit(e.target.value as DistanceUnit)}
                                        className="bg-white/10 text-white/80 rounded px-1.5 py-0.5 border border-white/10 text-[10px] outline-none cursor-pointer"
                                    >
                                        {DISTANCE_UNITS.map(u => (
                                            <option key={u.value} value={u.value} className="bg-[#1a1a1d]">{u.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-white/40 font-medium uppercase tracking-wider">Area:</span>
                                    <select
                                        value={areaUnit}
                                        onChange={(e) => setAreaUnit(e.target.value as AreaUnit)}
                                        className="bg-white/10 text-white/80 rounded px-1.5 py-0.5 border border-white/10 text-[10px] outline-none cursor-pointer"
                                    >
                                        {AREA_UNITS.map(u => (
                                            <option key={u.value} value={u.value} className="bg-[#1a1a1d]">{u.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="border-t border-white/10 px-4 py-2.5 flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        sourceRef.current?.clear();
                                        clearOverlays();
                                        setRows([]);
                                        setTotalDist(0);
                                        setTotalArea(0);
                                        setIsClosed(false);
                                        setHasGeometry(false);
                                        currentFeatureRef.current = null;
                                        undoStackRef.current = [];
                                        redoStackRef.current = [];
                                        notifyHistory();
                                    }}
                                    className="flex-1 rounded bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/15 transition-colors"
                                >
                                    New
                                </button>
                                <button
                                    onClick={doUndo}
                                    disabled={!historyState.undo}
                                    title="Undo (Ctrl+Z)"
                                    className="flex items-center justify-center rounded bg-white/10 px-2.5 py-1.5 text-white/80 hover:bg-white/15 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Undo2 size={14} />
                                </button>
                                <button
                                    onClick={doRedo}
                                    disabled={!historyState.redo}
                                    title="Redo (Ctrl+Shift+Z)"
                                    className="flex items-center justify-center rounded bg-white/10 px-2.5 py-1.5 text-white/80 hover:bg-white/15 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Redo2 size={14} />
                                </button>
                                <button
                                    onClick={() => {
                                        if (rows.length === 0) return;
                                        const header = `#\tX\tY\tDistance (${distUnit})\tBearing`;
                                        const body = rows.map((r, i) => {
                                            const distStr = r.segmentDist === null ? '' : formatDistance(r.segmentDist, distUnit);
                                            const brngStr = r.bearing === null ? '' : formatBearing(r.bearing);
                                            return `${i + 1}\t${r.x.toFixed(6)}\t${r.y.toFixed(6)}\t${distStr}\t${brngStr}`;
                                        }).join('\n');
                                        const areaLine = isClosed ? `\nArea: ${formatArea(totalArea, areaUnit)}` : '';
                                        const footer = `\nPerimeter: ${formatDistance(totalDist, distUnit)}${areaLine}`;
                                        navigator.clipboard.writeText(header + '\n' + body + footer);
                                    }}
                                    disabled={rows.length === 0}
                                    className="flex-1 rounded bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/15 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    Copy
                                </button>
                                <button
                                    onClick={onClose}
                                    className="flex-1 rounded bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/30 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
});

export default DrawTool;
