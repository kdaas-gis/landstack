'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import MapView, { type MapViewHandle } from '@/components/MapView';
import LegendPanel from '@/components/LegendPanel';
import BengaluruUrbanLegendPanel from '@/components/BengaluruUrbanLegendPanel';
import Toolbar from '@/components/Toolbar';
import InfoPanel from '@/components/InfoPanel';
import CoordinatesPanel from '@/components/CoordinatesPanel';
import BaseLayerPicker from '@/components/BaseLayerPicker';
import AdvancedSearchPanel from '@/components/AdvancedSearchPanel';
import CoordinatesDisplay from '@/components/CoordinatesDisplay';
import ModeBadge from '@/components/ModeBadge';
import Toast from '@/components/Toast';
import SearchBar from '@/components/SearchBar';

import { LanguageProvider, useLanguage } from '@/lib/i18n';
import type { LayerDefinition, BaseLayerType } from '@/lib/layers';
import type { SearchResult } from '@/lib/search';
import type { GeometryType } from '@/lib/geometry-utils';
import { registerServiceWorker } from '@/lib/register-sw';

const BU_TALUK_PROFILES = [
  { id: 'bu_anekal', workspace: 'BU_anekal_Sva', layer: 'anekal', label: 'Anekal' },
  { id: 'bu_bengaluru_east', workspace: 'BU_bengaluru_east_Sva', layer: 'east', label: 'Bengaluru East' },
  { id: 'bu_bengaluru_north', workspace: 'BU_bengaluru_north_Sva', layer: 'north', label: 'Bengaluru North' },
  { id: 'bu_bengaluru_south', workspace: 'BU_bengaluru_south_Sva', layer: 'south', label: 'Bengaluru South' },
  { id: 'bu_yelahanka', workspace: 'BU_yelahanka_Sva', layer: 'yelahanka', label: 'Yelahanka' },
] as const;

const BU_GEOMETRY_TYPES = [
  { suffix: '_points', label: 'Points', color: '#ff0000' },
  { suffix: '_polygon', label: 'Polygon', color: '#ef4444', pattern: 'hatch' },
] as const;

const buTalukLayers: LayerDefinition[] = BU_TALUK_PROFILES.flatMap((taluk) =>
  BU_GEOMETRY_TYPES.map((geometry) => ({
    id: `${taluk.id}${geometry.suffix}`,
    name: `${taluk.label} ${geometry.label}`,
    type: 'wfs',
    url: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/proxy?profile=${taluk.id}`,
    layerName: `${taluk.workspace}:${taluk.layer}${geometry.suffix}`,
    cqlFilter: undefined,
    opacity: 0.9,
    visible: true,
    minZoom: 9,

  }))
);

const APPLICATION_OWS_URL = 'http://117.252.86.213:8080/geoserver/application/ows';
const APPLICATION_WFS_URL = 'http://117.252.86.213:8080/geoserver/application/wfs';

const initialLayers: LayerDefinition[] = [
  {
    id: 'karnataka-districts',
    name: 'Districts',
    type: 'wms',
    url: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/proxy?url=${encodeURIComponent('http://117.252.86.213:8080/geoserver/application/wms')}`,
    layerName: 'application:district_boundary',
    opacity: 0.8,
    visible: true,
    minZoom: 0,
    maxZoom: 9
  },
  {
    id: 'karnataka-taluks',
    name: 'Taluks',
    type: 'wms',
    url: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/proxy?url=${encodeURIComponent('http://117.252.86.213:8080/geoserver/application/wms')}`,
    layerName: 'application:taluk_boundary',
    opacity: 0.8,
    visible: true,
    minZoom: 9,
    maxZoom: 11
  },
  {
    id: 'karnataka-hoblis',
    name: 'Hoblis',
    type: 'wms',
    url: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/proxy?url=${encodeURIComponent('http://117.252.86.213:8080/geoserver/application/wms')}`,
    layerName: 'application:hobli_boundary',
    opacity: 0.8,
    visible: true,
    minZoom: 11,
    maxZoom: 13
  },
  {
    id: 'karnataka-villages',
    name: 'Villages',
    type: 'wms',
    url: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/proxy?url=${encodeURIComponent('http://117.252.86.213:8080/geoserver/application/wms')}`,
    layerName: 'application:village_boundary',
    opacity: 0.8,
    visible: true,
    minZoom: 13,
    maxZoom: 22
  },
  {
    id: 'survey-number-boundary',
    name: 'Hissa Boundary',
    type: 'image-wms',
    url: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/proxy?url=${encodeURIComponent(APPLICATION_OWS_URL)}`,
    layerName: 'application:banglore_urban',
    opacity: 0.8,
    visible: true,
    minZoom: 15
  },
  ...buTalukLayers
];

function AppTitle() {
  const { t } = useLanguage();
  return (
    <h1 className="text-2xl font-bold tracking-tight text-ink leading-tight">
      {t('app.title')}
    </h1>
  );
}

function MapInterface() {
  const { t } = useLanguage();
  const [baseLayer, setBaseLayer] = useState<BaseLayerType>('googleSatellite');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<{
    attributes: Record<string, any>;
    sourceLayer: string;
    id?: string;
    geometry?: any;
  } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(7.5);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<[number, number] | null>(null);

  const [showOfflineToast, setShowOfflineToast] = useState(false);
  const [locationErrorMsg, setLocationErrorMsg] = useState<string | null>(null);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [layers, setLayers] = useState<LayerDefinition[]>(initialLayers);

  // Layers rendered as-is; WMS layers only fetch tiles for the visible viewport
  const activeLayers = layers;
  const districtBoundaryVisible = layers.find((layer) => layer.id === 'karnataka-districts')?.visible ?? false;
  const talukBoundaryVisible = layers.find((layer) => layer.id === 'karnataka-taluks')?.visible ?? false;
  const hobliBoundaryVisible = layers.find((layer) => layer.id === 'karnataka-hoblis')?.visible ?? false;
  const villageBoundaryVisible = layers.find((layer) => layer.id === 'karnataka-villages')?.visible ?? false;
  const bengaluruUrbanBoundaryVisible = layers.find((layer) => layer.id === 'survey-number-boundary')?.visible ?? false;
  const surveyPolygonsVisible = layers.some((layer) => layer.id.endsWith('_polygon') && layer.visible);

  const handleToggleLegendLayer = (layerId: 'karnataka-districts' | 'karnataka-taluks' | 'karnataka-hoblis' | 'karnataka-villages' | 'survey-number-boundary' | 'survey-polygons', visible: boolean) => {
    if (layerId === 'survey-polygons') {
      setLayers((prev) =>
        prev.map((layer) =>
          layer.id.endsWith('_polygon')
            ? { ...layer, visible }
            : layer
        )
      );
    } else {
      setLayers((prev) =>
        prev.map((layer) =>
          layer.id === layerId
            ? { ...layer, visible }
            : layer
        )
      );
    }
  };

  const buLegendTaluks = BU_TALUK_PROFILES.map((taluk) => ({
    id: taluk.id,
    name: taluk.label,
    checked: BU_GEOMETRY_TYPES.every((geometry) => {
      const layerId = `${taluk.id}${geometry.suffix}`;
      const layer = layers.find((item) => item.id === layerId);
      return layer?.visible ?? false;
    }),
    sublayers: BU_GEOMETRY_TYPES.map((geometry) => ({
      id: geometry.suffix,
      name: geometry.label,
      color: geometry.color,
      pattern: 'pattern' in geometry ? (geometry as any).pattern : undefined,
      checked: layers.find((item) => item.id === `${taluk.id}${geometry.suffix}`)?.visible ?? false,
    })),
  }));

  const handleToggleBuTaluk = (talukId: string, checked: boolean) => {
    const layerIds = new Set(BU_GEOMETRY_TYPES.map((g) => `${talukId}${g.suffix}`));
    setLayers((prev) =>
      prev.map((layer) =>
        layerIds.has(layer.id)
          ? { ...layer, visible: checked }
          : layer
      )
    );
  };

  const handleToggleBuSublayer = (talukId: string, sublayerId: string, checked: boolean) => {
    const targetLayerId = `${talukId}${sublayerId}`;
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === targetLayerId
          ? { ...layer, visible: checked }
          : layer
      )
    );
  };

  /*
   * UPDATED ZOOM LOGIC:
   * Instead of zooming to the first feature of the detailed parcel layer (which might be just one small plot),
   * we now zoom to the official Taluk boundary from the 'application:taluk_boundary' layer.
   *
   * We use a CQL_FILTER on the 'kgistalukn' column to find the matching taluk.
   */
  const handleZoomToBuTaluk = async (talukId: string) => {
    const taluk = BU_TALUK_PROFILES.find((item) => item.id === talukId);
    if (!taluk) return;

    // Parcel-layer fallback mapping (profile WFS data)
    const TALUK_CQL_MAPPING: Record<string, string> = {
      'bu_anekal': "kgistalukn ILIKE '%Anekal%'",
      'bu_bengaluru_east': "kgistalukn ILIKE '%Bangalore%East%' OR kgistalukn ILIKE '%Bengaluru%East%'",
      'bu_bengaluru_north': "kgistalukn ILIKE '%Bangalore%North%' OR kgistalukn ILIKE '%Bengaluru%North%'",
      'bu_bengaluru_south': "kgistalukn ILIKE '%Bangalore%South%' OR kgistalukn ILIKE '%Bengaluru%South%'",
      'bu_yelahanka': "kgistalukn ILIKE '%Yelahanka%'",
    };
    // Admin boundary mapping (application:taluk_boundary)
    const TALUK_ADMIN_CQL_MAPPING: Record<string, string> = {
      'bu_anekal': "lgd_tlk_n ILIKE '%Anekal%'",
      'bu_bengaluru_east': "lgd_tlk_n ILIKE '%Bangalore%East%' OR lgd_tlk_n ILIKE '%Bengaluru%East%'",
      'bu_bengaluru_north': "lgd_tlk_n ILIKE '%Bangalore%North%' OR lgd_tlk_n ILIKE '%Bengaluru%North%'",
      'bu_bengaluru_south': "lgd_tlk_n ILIKE '%Bangalore%South%' OR lgd_tlk_n ILIKE '%Bengaluru%South%'",
      'bu_yelahanka': "lgd_tlk_n ILIKE '%Yelahanka%'",
    };

    const cqlFilter = TALUK_CQL_MAPPING[talukId];
    if (!cqlFilter) {
      console.warn(`No CQL mapping found for taluk: ${talukId}`);
      return;
    }

    const typeName = 'application:taluk_boundary';
    const adminCqlFilter = TALUK_ADMIN_CQL_MAPPING[talukId];
    const applicationBaseUrl = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/proxy?url=${encodeURIComponent(APPLICATION_WFS_URL)}`;
    const profileBaseUrl = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/proxy?profile=${encodeURIComponent(taluk.id)}`;
    const profileLayerName = `${taluk.workspace}:${taluk.layer}_polygon`;

    try {
      const requestVariants = [
        {
          label: 'application taluk boundary (WFS 1.1.0)',
          url: `${applicationBaseUrl}&service=WFS&version=1.1.0&request=GetFeature&typeName=${encodeURIComponent(typeName)}&outputFormat=application/json&srsName=EPSG:4326&CQL_FILTER=${encodeURIComponent(cqlFilter)}`,
        },
        {
          label: 'taluk profile polygon (WFS 1.1.0)',
          url: `${profileBaseUrl}&service=WFS&version=1.1.0&request=GetFeature&typeName=${encodeURIComponent(profileLayerName)}&outputFormat=application/json&srsName=EPSG:4326`,
        },
      ];

      let data: any = null;
      for (const variant of requestVariants) {
        const response = await fetch(variant.url);
        if (!response.ok) {
          console.warn(`Zoom request failed (${variant.label}):`, response.status, response.statusText);
          continue;
        }

        const bodyText = await response.text();
        try {
          const parsed = JSON.parse(bodyText);
          if (Array.isArray(parsed?.features) && parsed.features.length > 0) {
            data = parsed;
            break;
          }
          console.warn(`Zoom request returned JSON without features (${variant.label}).`);
          continue;
        } catch {
          const xmlHint = bodyText.slice(0, 180).replace(/\s+/g, ' ').trim();
          console.warn(`Zoom request returned non-JSON (${variant.label}).`, xmlHint);
          continue;
        }
      }

      if (!data) {
        console.error(`Failed to zoom to taluk (${talukId}): WFS did not return GeoJSON`);
        return;
      }

      if (data?.features?.length > 0) {
        console.log(`Zooming to taluk (${talukId}): Found ${data.features.length} features.`);

        let targetGeometry: any = null;

        if (data.features.length === 1) {
          targetGeometry = data.features[0].geometry;
        } else {
          // Merge polygonal geometries into a single MultiPolygon when possible.
          const geometries = data.features.map((f: any) => f.geometry).filter(Boolean);
          if (geometries.length > 0) {
            const multiPolygonCoords: any[] = [];
            for (const geometry of geometries) {
              if (geometry?.type === 'Polygon') {
                multiPolygonCoords.push(geometry.coordinates);
              } else if (geometry?.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
                multiPolygonCoords.push(...geometry.coordinates);
              }
            }

            if (multiPolygonCoords.length > 0) {
              targetGeometry = {
                type: 'MultiPolygon',
                coordinates: multiPolygonCoords,
              };
            } else {
              targetGeometry = {
                type: 'GeometryCollection',
                geometries: geometries
              };
            }
          }
        }

        if (targetGeometry) {
          // Fetch admin taluk boundary for zoom + highlight (single boundary),
          // even if fallback data came from profile parcel polygons.
          let zoomGeometry: any = targetGeometry;
          let highlightGeometry: any = targetGeometry;
          if (adminCqlFilter) {
            try {
              const adminResponse = await fetch(
                `${applicationBaseUrl}&service=WFS&version=1.1.0&request=GetFeature&typeName=${encodeURIComponent(typeName)}&outputFormat=application/json&srsName=EPSG:4326&CQL_FILTER=${encodeURIComponent(adminCqlFilter)}`
              );
              if (adminResponse.ok) {
                const adminText = await adminResponse.text();
                const adminData = JSON.parse(adminText);
                if (Array.isArray(adminData?.features) && adminData.features.length > 0) {
                  const adminGeometry = adminData.features[0].geometry || targetGeometry;
                  zoomGeometry = adminGeometry;
                  highlightGeometry = adminGeometry;
                }
              }
            } catch {
              // Keep fallback zoom/highlight geometry
            }
          }

          mapRef.current?.zoomToFeature(zoomGeometry);

          // Always show taluk-level metadata for zoom action; do not show random parcel attributes.
          setSelectedFeature({
            attributes: {
              name: taluk.label,
              taluk: taluk.label,
              feature_count: data.features.length,
            },
            sourceLayer: typeName,
            id: `taluk-zoom-${talukId}`,
            geometry: highlightGeometry
          });
        }

      } else {
        console.warn('No features found for zoom request:', cqlFilter);
      }
    } catch (error) {
      console.error(`Failed to zoom to taluk (${talukId}):`, error);
    }
  };  // Draw mode state
  const [drawGeometryType, setDrawGeometryType] = useState<GeometryType>('Polygon');
  const [drawSnapEnabled, setDrawSnapEnabled] = useState(true);
  const [drawCanUndo, setDrawCanUndo] = useState(false);
  const [drawCanRedo, setDrawCanRedo] = useState(false);

  const mapRef = useRef<MapViewHandle | null>(null);

  // Register service worker for PWA
  useEffect(() => {
    registerServiceWorker();
  }, []);


  // Keyboard shortcuts
  const toggleTool = useCallback((tool: string) => {
    setActiveTool(prev => prev === tool ? null : tool);
  }, []);

  useEffect(() => {
    const SHAPE_KEYS: Record<string, GeometryType> = {
      '1': 'Point', '2': 'LineString', '3': 'Polygon', '4': 'Rectangle',
    };

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'd': e.preventDefault(); toggleTool('draw'); break;
        case 'm':
          e.preventDefault();
          setActiveTool('draw');
          setDrawGeometryType('LineString');
          break;
        case 's':
          if (activeTool === 'draw') {
            e.preventDefault();
            setDrawSnapEnabled(prev => !prev);
          }
          break;
        case 'escape':
          if (activeTool && activeTool !== 'draw') {
            setActiveTool(null);
          }
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) mapRef.current?.redoDraw();
            else mapRef.current?.undoDraw();
          }
          break;
        default:
          if (SHAPE_KEYS[e.key] && activeTool === 'draw') {
            e.preventDefault();
            setDrawGeometryType(SHAPE_KEYS[e.key]);
          }
      }
    };

    globalThis.addEventListener('keydown', handler);
    return () => globalThis.removeEventListener('keydown', handler);
  }, [activeTool, toggleTool]);

  const handleSearchResult = (result: SearchResult) => {
    if (result.geometry) {
      mapRef.current?.zoomToFeature(result.geometry);

      setSelectedFeature({
        attributes: result.properties || {},
        sourceLayer: result.sourceLayer || '',
        id: result.id,
        geometry: result.geometry
      });

      // When a village is selected, filter hissa boundary layers to show only that village
      if (result.type === 'Village' && result.properties?.lgd_vill_n) {
        const villageName = result.properties.lgd_vill_n;
        const villageCode = result.properties.lgd_vill_c;

        const cqlName = `lgd_vill_n = '${villageName}'`;
        const cqlVillageCode = villageCode ? `lgd_vill_c = '${villageCode}'` : cqlName;
        const cqlCode = villageCode ? `LGD_Villag = '${villageCode}'` : cqlName;
        const turnOffIds = new Set([
          'karnataka-districts', 'karnataka-taluks',
          'karnataka-hoblis',
        ]);
        const filterByVillageIds = new Set([
          'karnataka-villages',
        ]);
        const filterByCodeIds = new Set([
          'survey-number-boundary'
        ]);
        // Only polygon BU layers have lgd_vill_n for CQL filtering
        const buPolygonIds = new Set(
          BU_TALUK_PROFILES.map(t => `${t.id}_polygon`)
        );
        const buNonPolygonIds = new Set(
          buTalukLayers.filter(l => !l.id.endsWith('_polygon')).map(l => l.id)
        );

        setLayers(prev => prev.map(layer => {
          // BU taluk polygon layers — filter by village code (fallback to name if code unavailable)
          if (buPolygonIds.has(layer.id)) {
            return { ...layer, visible: true, cqlFilter: cqlVillageCode };
          }
          // BU taluk points/polyline — hide (no lgd_vill_n column)
          if (buNonPolygonIds.has(layer.id)) {
            return { ...layer, visible: true };
          }
          // Village boundary — filter by village code (fallback to name if code unavailable)
          if (filterByVillageIds.has(layer.id)) {
            return { ...layer, visible: true, cqlFilter: cqlVillageCode, minZoom: undefined };
          }
          // Survey Number boundary — filter by village code (LGD_Villag)
          if (filterByCodeIds.has(layer.id)) {
            return {
              ...layer,
              type: 'wfs',
              url: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/proxy?url=${encodeURIComponent(APPLICATION_OWS_URL)}`,
              visible: true,
              cqlFilter: cqlCode,
              minZoom: undefined
            };
          }
          // Hide district/taluk/hobli layers
          if (turnOffIds.has(layer.id)) {
            return { ...layer, visible: false };
          }
          return layer;
        }));
      }
    }
  };

  const isPolygonFeature =
    selectedFeature?.geometry &&
    selectedFeature.sourceLayer?.toLowerCase().includes('polygon') &&
    (
      (selectedFeature.geometry.getType && typeof selectedFeature.geometry.getType === 'function' ? selectedFeature.geometry.getType() : selectedFeature.geometry.type) === 'Polygon' ||
      (selectedFeature.geometry.getType && typeof selectedFeature.geometry.getType === 'function' ? selectedFeature.geometry.getType() : selectedFeature.geometry.type) === 'MultiPolygon'
    );

  return (
    <main className="relative h-screen w-screen bg-[#0a0a0b] overflow-hidden">
      {/* 1. Full-Screen Map View */}
      <div className="absolute inset-0 z-0">
        <MapView
          ref={mapRef}
          layers={activeLayers}
          baseLayer={baseLayer}
          activeTool={activeTool}
          onFeatureClick={setSelectedFeature}
          onZoomChange={setCurrentZoom}
          onMouseCoordinates={setCursorCoords}
          highlightedFeature={selectedFeature}
          onDrawClose={() => setActiveTool(null)}
          drawGeometryType={drawGeometryType}
          drawSnapEnabled={drawSnapEnabled}
          onDrawHistoryChange={(u, r) => {
            setDrawCanUndo(u);
            setDrawCanRedo(r);
          }}
          onOfflineAction={() => setShowOfflineToast(true)}
          onLocationError={(msg) => setLocationErrorMsg(msg)}
        />
      </div>

      {/* 2. Floating Header / Branding (Minimal) */}
      {/* <div className="absolute top-6 left-6 z-30 flex items-center gap-4 pointer-events-none">
        <div className="pointer-events-auto">
          <AppTitle />
        </div>
      </div> */}

      {/* Mode Badge (Top-Left) — desktop only */}
      {/* <div className="hidden md:block absolute top-6 left-6 z-50">
        <ModeBadge activeTool={activeTool} geometryType={drawGeometryType} />
      </div> */}

      {/* 3. Floating Toolbar (Center Top) */}
      <div className="absolute top-3 md:top-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 w-[calc(100%-24px)] md:w-auto">
        <Toolbar
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          onResetView={() => {
            mapRef.current?.resetView();
            setActiveTool(null);
            setSelectedFeature(null);
            setCursorCoords(null);
            setLayers(initialLayers);
            setShowAdvancedSearch(false);
            setShowMobileSearch(false);
          }}
          onCurrentLocation={() => mapRef.current?.goToCurrentLocation()}
          activeTool={activeTool}
          onToggleTool={(tool) => {
            setActiveTool(activeTool === tool ? null : tool);
            if (activeTool !== 'identify') setSelectedFeature(null);
          }}
          onResultSelect={(res) => {
            handleSearchResult(res);
            setShowMobileSearch(false);
          }}
          onSearchClick={() => setShowMobileSearch(!showMobileSearch)}
          onAdvancedSearchClick={() => setShowAdvancedSearch(true)}

          // Draw props
          drawGeometryType={drawGeometryType}
          onDrawGeometryTypeChange={setDrawGeometryType}
          drawSnapEnabled={drawSnapEnabled}
          onDrawSnapToggle={() => setDrawSnapEnabled(!drawSnapEnabled)}
          drawCanUndo={drawCanUndo}
          drawCanRedo={drawCanRedo}
          onDrawUndo={() => mapRef.current?.undoDraw()}
          onDrawRedo={() => mapRef.current?.redoDraw()}
          onDrawCancel={() => {
            setActiveTool(null);
            mapRef.current?.cancelDraw();
          }}
        />

        {/* Mobile Search Overlay */}
        <AnimatePresence>
          {showMobileSearch && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] p-4 pt-20 md:hidden flex flex-col items-start pointer-events-none"
              onClick={() => setShowMobileSearch(false)}
            >
              <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg mx-auto pointer-events-auto">
                <SearchBar
                  variant="spotlight"
                  placeholder={t('tool.search') || 'Search...'}
                  onResultSelect={(res) => {
                    handleSearchResult(res);
                    setShowMobileSearch(false);
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile mode badge — below toolbar */}
        {/* <div className="md:hidden">
          <ModeBadge activeTool={activeTool} geometryType={drawGeometryType} />
        </div> */}
      </div>

      {/* Advanced Search Panel (Modal) */}
      <AdvancedSearchPanel
        isOpen={showAdvancedSearch}
        onClose={() => setShowAdvancedSearch(false)}
        onResultSelect={handleSearchResult}
      />

      {/* 4. Floating Basemap + BU Legend Stack (Top-Right) */}
      <div className="absolute top-14 right-2 md:top-6 md:right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
        {/* <LanguageSwitcher /> Moved to Toolbar */}
        <div className="pointer-events-auto">
          <BaseLayerPicker
            currentBaseLayer={baseLayer}
            onChange={setBaseLayer}
          />
        </div>
        <div className="pointer-events-auto">
          <BengaluruUrbanLegendPanel
            taluks={buLegendTaluks}
            onToggleTaluk={handleToggleBuTaluk}
            onToggleSublayer={handleToggleBuSublayer}
            onZoomToTaluk={handleZoomToBuTaluk}
          />
        </div>
      </div>

      {/* 5. Left Side Sidebar + Info Panel Layout */}
      <div className="absolute top-14 left-3 md:top-24 md:left-6 z-40 flex flex-row gap-4 max-h-[calc(100vh-120px)] pointer-events-none">
        <LayoutGroup>
          {/* Left column: Legend + Coordinates */}
          <div className="flex flex-col gap-4 w-auto md:w-72 shrink-0">
            {/* Map Legend */}
            <div className="pointer-events-auto shrink-0">
              <LegendPanel
                currentZoom={currentZoom}
                layerToggles={{
                  districts: districtBoundaryVisible,
                  taluks: talukBoundaryVisible,
                  hoblis: hobliBoundaryVisible,
                  villages: villageBoundaryVisible,
                  bengaluruUrban: bengaluruUrbanBoundaryVisible,
                  surveyPolygons: surveyPolygonsVisible,
                }}
                onToggleLayer={handleToggleLegendLayer}
              />
            </div>

            {/* Polygon Coordinates Panel — below legend, same width */}
            <AnimatePresence mode="wait">
              {selectedFeature && isPolygonFeature && (
                <motion.div key={`coords-${selectedFeature.id || JSON.stringify(selectedFeature.attributes)}`} layout className="pointer-events-auto shrink-0 hidden md:block">
                  <CoordinatesPanel
                    geometry={(() => {
                      const geom = selectedFeature.geometry;
                      if (!geom) return null;
                      if (geom.getType && typeof geom.getType === 'function') {
                        return {
                          type: geom.getType(),
                          coordinates: geom.getCoordinates()
                        };
                      }
                      return geom;
                    })()}
                    onClose={() => { }}
                    embedded
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Info Panel for NON-polygon features — stays below legend */}
            <AnimatePresence mode="wait">
              {selectedFeature && !isPolygonFeature && (
                <motion.div key={`info-nonpoly-${selectedFeature.id || JSON.stringify(selectedFeature.attributes)}`} layout className="pointer-events-auto min-h-0 hidden md:block">
                  <InfoPanel
                    attributes={selectedFeature.attributes}
                    sourceLayer={selectedFeature.sourceLayer}
                    id={selectedFeature.id}
                    onClose={() => setSelectedFeature(null)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right column: Info Panel for polygon features — beside legend+coords */}
          <AnimatePresence mode="wait">
            {selectedFeature && isPolygonFeature && (
              <motion.div key={`info-poly-${selectedFeature.id || JSON.stringify(selectedFeature.attributes)}`} layout className="pointer-events-auto min-h-0 hidden md:block w-72">
                <InfoPanel
                  attributes={selectedFeature.attributes}
                  sourceLayer={selectedFeature.sourceLayer}
                  id={selectedFeature.id}
                  onClose={() => setSelectedFeature(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </div>

      {/* Mobile Info Panel — bottom sheet */}
      <AnimatePresence mode="wait">
        {selectedFeature && (
          <motion.div key={`info-mobile-${selectedFeature.id || JSON.stringify(selectedFeature.attributes)}`} className="md:hidden absolute bottom-0 left-0 right-0 z-50 pointer-events-auto">
            <InfoPanel
              attributes={selectedFeature.attributes}
              sourceLayer={selectedFeature.sourceLayer}
              id={selectedFeature.id}
              onClose={() => setSelectedFeature(null)}
              variant="sheet"
            />
          </motion.div>
        )}
      </AnimatePresence>



      {/* Subtle Map Overlays */}
      <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 z-10 hidden md:flex items-center gap-4">
        <CoordinatesDisplay coordinates={cursorCoords} />
      </div>

      {/* Generic Toast for Offline & Errors */}
      <Toast
        show={showOfflineToast}
        onDismiss={() => setShowOfflineToast(false)}
        message="You're offline — Identify requires a network connection"
        type="warning"
      />

      <Toast
        show={!!locationErrorMsg}
        onDismiss={() => setLocationErrorMsg(null)}
        message={locationErrorMsg || ''}
        type="error"
      />
    </main>
  );
}

export default function Home() {
  return (
    <LanguageProvider>
      <MapInterface />
    </LanguageProvider>
  );
}
