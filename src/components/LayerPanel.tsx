'use client';

import { useMemo, useState } from 'react';
import type { LayerDefinition, LayerDraft, LayerType, BaseLayerType } from '@/lib/layers';
import { buildLayerDefinition, defaultDraft, parseExtent, BASE_LAYER_METADATA } from '@/lib/layers';
import AnimatedCheckbox from '@/components/AnimatedCheckbox';

const TYPE_LABELS: Record<LayerType, string> = {
  wms: 'WMS (tiled)',
  'image-wms': 'WMS (single image)',
  wfs: 'WFS (GeoJSON)',
  xyz: 'XYZ Tiles',
  image: 'Static Image',
  geojson: 'GeoJSON'
};

type LayerPanelProps = {
  layers: LayerDefinition[];
  onChange: (layers: LayerDefinition[]) => void;
  baseLayer: BaseLayerType;
  onBaseLayerChange: (type: BaseLayerType) => void;
};

export default function LayerPanel({ layers, onChange, baseLayer, onBaseLayerChange }: LayerPanelProps) {
  const [draft, setDraft] = useState<LayerDraft>(defaultDraft);
  const [dragId, setDragId] = useState<string | null>(null);

  const canAdd = useMemo(() => draft.url.trim().length > 0, [draft.url]);
  const extentWarning = useMemo(() => {
    if (!draft.extent.trim()) return '';
    return parseExtent(draft.extent) ? '' : 'Extent must be four comma-separated numbers.';
  }, [draft.extent]);

  function updateLayer(id: string, patch: Partial<LayerDefinition>) {
    onChange(layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  }

  function removeLayer(id: string) {
    onChange(layers.filter((layer) => layer.id !== id));
  }

  function moveLayer(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const next = [...layers];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    onChange(next);
  }

  function handleDragStart(id: string) {
    setDragId(id);
  }

  function handleDrop(targetId: string) {
    if (!dragId) return;
    const fromIndex = layers.findIndex((layer) => layer.id === dragId);
    const toIndex = layers.findIndex((layer) => layer.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    moveLayer(fromIndex, toIndex);
    setDragId(null);
  }

  function addLayer() {
    if (!canAdd || extentWarning) return;
    const definition = buildLayerDefinition(draft);
    onChange([definition, ...layers]);
    setDraft({ ...defaultDraft, type: draft.type });
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pr-2 pb-8 custom-scrollbar">
      {/* Base Layer Selection */}
      <div className="rounded-2xl border border-edge bg-panel/90 p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Basemap</h2>
        <p className="mb-4 text-xs text-muted">Select the underlying map style.</p>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(BASE_LAYER_METADATA) as BaseLayerType[]).map((type) => {
            const config = BASE_LAYER_METADATA[type];
            const active = baseLayer === type;
            return (
              <button
                key={type}
                onClick={() => onBaseLayerChange(type)}
                className={`group relative h-20 overflow-hidden rounded-xl border transition-all duration-300 ${active ? 'border-accent ring-2 ring-accent/30' : 'border-edge hover:border-white/20'
                  }`}
              >
                <img
                  src={config.thumbnail}
                  alt={config.name}
                  className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 ${active ? 'scale-110' : 'group-hover:scale-110'
                    }`}
                />
                <div className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${active ? 'opacity-20' : 'opacity-100 group-hover:opacity-40'}`} />
                <span className={`relative z-10 px-2 text-center text-[10px] font-bold text-white drop-shadow-md`}>
                  {config.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-edge bg-panel/90 p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Layer Stack</h2>
            <p className="text-xs text-muted">Drag to reorder. Top renders on top.</p>
          </div>
          <span className="rounded-full border border-edge px-3 py-1 text-[11px] text-muted">
            {layers.length}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {layers.length === 0 && (
            <div className="rounded-xl border border-dashed border-edge p-4 text-xs text-muted">
              No overlays yet.
            </div>
          )}
          {layers.map((layer, index) => (
            <div
              key={layer.id}
              draggable
              onDragStart={() => handleDragStart(layer.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(layer.id)}
              className={`rounded-xl border border-edge bg-black/30 p-4 transition ${dragId === layer.id ? 'ring-2 ring-accent/70' : ''
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{layer.name}</p>
                  <p className="text-[10px] text-muted uppercase tracking-wider">{TYPE_LABELS[layer.type]}</p>
                </div>
                <button
                  className="p-1 rounded-full text-muted transition-all duration-300 hover:text-rose-400 hover:bg-rose-400/10 hover:scale-110 active:scale-95"
                  onClick={() => removeLayer(layer.id)}
                  title="Remove Layer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-muted">
                  <AnimatedCheckbox
                    checked={layer.visible}
                    onChange={(checked) => updateLayer(layer.id, { visible: checked })}
                  />
                  Visible
                </label>
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    className="premium-slider"
                    value={layer.opacity}
                    onChange={(event) => updateLayer(layer.id, { opacity: Number(event.target.value) })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-edge bg-panel/90 p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Add Overlay</h2>
        <div className="mt-4 grid gap-3">
          <input
            className="w-full rounded-lg border border-edge bg-black/40 px-3 py-2.5 text-sm shadow-inner transition-all duration-300 hover:border-white/20 focus:border-accent/50 focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-accent/50"
            placeholder="Name"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          <select
            className="w-full rounded-lg border border-edge bg-black/40 px-3 py-2.5 text-sm shadow-inner transition-all duration-300 hover:border-white/20 focus:border-accent/50 focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-accent/50"
            value={draft.type}
            onChange={(event) => setDraft({ ...draft, type: event.target.value as LayerType })}
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            className="w-full rounded-lg border border-edge bg-black/40 px-3 py-2.5 text-sm shadow-inner transition-all duration-300 hover:border-white/20 focus:border-accent/50 focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-accent/50"
            placeholder="URL"
            value={draft.url}
            onChange={(event) => setDraft({ ...draft, url: event.target.value })}
          />
          {(draft.type === 'wms' || draft.type === 'wfs') && (
            <input
              className="w-full rounded-lg border border-edge bg-black/40 px-3 py-2.5 text-sm shadow-inner transition-all duration-300 hover:border-white/20 focus:border-accent/50 focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-accent/50"
              placeholder={draft.type === 'wms' ? 'Layer ID' : 'Type Name'}
              value={draft.layerName}
              onChange={(event) => setDraft({ ...draft, layerName: event.target.value })}
            />
          )}
          <button
            className={`mt-2 rounded-xl py-2.5 text-sm font-bold transition-all duration-300 ${canAdd && !extentWarning
              ? 'bg-accent text-base-900 shadow-[0_0_12px_rgba(14,165,233,0.3)] hover:scale-[1.03] hover:shadow-[0_0_16px_rgba(14,165,233,0.5)] hover:bg-[#38bdf8] active:scale-[0.97]'
              : 'border border-edge bg-black/20 text-muted cursor-not-allowed opacity-50'
              }`}
            disabled={!canAdd || Boolean(extentWarning)}
            onClick={addLayer}
          >
            Add to Stack
          </button>
        </div>
      </div>
    </div>
  );
}
