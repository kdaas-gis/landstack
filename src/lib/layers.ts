export type LayerType = 'wms' | 'wfs' | 'xyz' | 'image' | 'geojson';

export type LayerDefinition = {
  id: string;
  name: string;
  type: LayerType;
  url: string;
  layerName?: string;
  wmsParams?: Record<string, string | number | boolean>;
  opacity: number;
  visible: boolean;
  extent?: [number, number, number, number];
  minZoom?: number;
  maxZoom?: number;
  cqlFilter?: string;
};

export type LayerDraft = {
  name: string;
  type: LayerType;
  url: string;
  layerName: string;
  opacity: number;
  extent: string;
};

export const defaultDraft: LayerDraft = {
  name: 'Untitled Layer',
  type: 'wms',
  url: '',
  layerName: '',
  opacity: 0.85,
  extent: ''
};

export function parseExtent(text: string): [number, number, number, number] | undefined {
  if (!text.trim()) return undefined;
  const parts = text.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) return undefined;
  return [parts[0], parts[1], parts[2], parts[3]];
}

export function buildLayerDefinition(draft: LayerDraft): LayerDefinition {
  const extent = parseExtent(draft.extent);
  return {
    id: crypto.randomUUID(),
    name: draft.name.trim() || 'Untitled Layer',
    type: draft.type,
    url: draft.url.trim(),
    layerName: draft.layerName.trim() || undefined,
    opacity: draft.opacity,
    visible: true,
    extent
  };
}

export function normalizeLayerName(definition: LayerDefinition): string {
  if (definition.layerName) return definition.layerName;
  return definition.name;
}

export type BaseLayerType = 'osm' | 'googleSatellite' | 'googleRoad' | 'googleHybrid' | 'googleTerrain' | 'bbmp';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const BASE_LAYER_METADATA: Record<BaseLayerType, { name: string; thumbnail: string }> = {
  osm: {
    name: 'OpenStreetMap',
    thumbnail: `${basePath}/thumbnails/osm_thumbnail_1770370593822.png`
  },
  googleSatellite: {
    name: 'Google Satellite',
    thumbnail: `${basePath}/thumbnails/google_satellite_thumbnail_1770370627604.png`
  },
  googleRoad: {
    name: 'Google Road',
    thumbnail: `${basePath}/thumbnails/google_road_thumbnail_1770370854504.png`
  },
  googleHybrid: {
    name: 'Google Hybrid',
    thumbnail: `${basePath}/thumbnails/google_hybrid_thumbnail_1770370789238.png`
  },
  googleTerrain: {
    name: 'Google Terrain',
    thumbnail: `${basePath}/thumbnails/google_terrain_thumbnail_1770370809820.png`
  },
  bbmp: {
    name: 'BBMP',
    thumbnail: `${basePath}/thumbnails/google_satellite_thumbnail_1770370627604.png`
  }
};
