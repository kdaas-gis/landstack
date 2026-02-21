
import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import TileWMS from 'ol/source/TileWMS';
import ImageWMS from 'ol/source/ImageWMS';
import ImageStatic from 'ol/source/ImageStatic';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import WMSGetFeatureInfo from 'ol/format/WMSGetFeatureInfo';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import { getPointResolution } from 'ol/proj';
import type { LayerDefinition, BaseLayerType } from '@/lib/layers';


const DEFAULT_EXTENT: [number, number, number, number] = [
  -180, -90, 180, 90
];

import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import Fill from 'ol/style/Fill';
import CircleStyle from 'ol/style/Circle'; // Import CircleStyle
import Point from 'ol/geom/Point';
import Text from 'ol/style/Text';
import { getDistance } from 'ol/sphere';
import DrawTool, { type DrawToolHandle } from './DrawTool';
import type { GeometryType } from '@/lib/geometry-utils';
import { ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


const INITIAL_CENTER = [75.9, 14.5]; // [Lon, Lat]
const INITIAL_ZOOM = 7.5;
const KARNATAKA_EXTENT: [number, number, number, number] = [73.5, 11.5, 78.6, 18.6];

// Style presets for administrative boundaries
const getDotPattern = (color: string) => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const size = 12; // Pattern cell size
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    // Fill transparent background
    // context.fillStyle = 'rgba(255, 255, 255, 0)';
    // context.fillRect(0, 0, size, size);

    // Draw dot
    context.fillStyle = color;
    context.beginPath();
    context.arc(size / 2, size / 2, 2.5, 0, 2 * Math.PI); // Center dot, radius 2.5
    context.fill();
  }
  return context?.createPattern(canvas, 'repeat');
};

const BOUNDARY_STYLES = {
  state: new Style({
    stroke: new Stroke({ color: '#f59e0b', width: 3 }),
    fill: new Fill({ color: 'rgba(245, 158, 11, 0.05)' })
  }),
  district: new Style({
    stroke: new Stroke({ color: '#10b981', width: 2 }),
    fill: new Fill({ color: 'rgba(16, 185, 129, 0.05)' })
  }),
  taluk: new Style({
    stroke: new Stroke({ color: '#3b82f6', width: 1, lineDash: [4, 4] }),
    fill: new Fill({ color: 'rgba(59, 130, 246, 0.02)' })
  }),
  // New style for Taluk polygons with dot pattern
  talukPolygon: new Style({
    stroke: new Stroke({ color: '#ff0000ff', width: 2 }), // Darker Red stroke
    fill: new Fill({ color: getDotPattern('#ef4444') || 'rgba(239, 68, 68, 0.1)' }) // Red dots (keep same or match stroke?) usually keep pattern lighter
  }),
  // New style function for Taluk polygons with measurements
  polygonStyleFunction: (feature: any, resolution: number) => {
    const styles = [
      new Style({
        stroke: new Stroke({ color: '#ff0000ff', width: 2 }), // Darker Red stroke
        fill: new Fill({ color: getDotPattern('#ef4444') || 'rgba(239, 68, 68, 0.1)' }) // Red dots
      })
    ];

    // Show numbering and edge distances only at closer zoom levels.
    if (resolution > 10) return styles;

    const geometry = feature.getGeometry();
    if (!geometry) return styles;

    const type = geometry.getType();
    if (type !== 'Polygon' && type !== 'MultiPolygon') return styles;

    const polygons = type === 'Polygon' ? [geometry] : geometry.getPolygons();

    polygons.forEach((poly: any) => {
      const coords = poly.getCoordinates()[0];

      // Vertex numbering
      coords.forEach((coord: any, index: number) => {
        if (index === coords.length - 1) return; // last point repeats first
        styles.push(new Style({
          geometry: new Point(coord),
          text: new Text({
            text: (index + 1).toString(),
            font: 'bold 14px sans-serif',
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({ color: '#000000ff', width: 3 }),
            offsetY: -10
          })
        }));
      });

      // Edge distances
      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const dist = getDistance(p1, p2);
        const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];

        styles.push(new Style({
          geometry: new Point(mid),
          text: new Text({
            text: `${Math.round(dist)}m`,
            font: '10px sans-serif',
            fill: new Fill({ color: '#000000' }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
            placement: 'point',
            overflow: true
          })
        }));
      }
    });

    return styles;
  },
  surveyBoundaryCentroidLabelStyle: (feature: any, resolution: number) => {
    const styles = [
      new Style({
        stroke: new Stroke({ color: '#facc15', width: 1.8 })
      })
    ];

    if (resolution > 12) return styles;

    const geometry = feature.getGeometry();
    if (!geometry) return styles;

    const type = geometry.getType();
    if (type !== 'Polygon' && type !== 'MultiPolygon') return styles;

    const surveyNo = feature.get('survey_num') || feature.get('Surveynumb') || '';
    const surnoc = feature.get('surnoc') || feature.get('Surnoc') || '';
    const hissaNo = feature.get('hissa_num') || feature.get('HissaNo') || '';
    const labelText = [surveyNo, surnoc, hissaNo].filter(Boolean).join('/');
    if (!labelText) return styles;

    const polygons = type === 'Polygon' ? [geometry] : geometry.getPolygons();
    polygons.forEach((poly: any) => {
      styles.push(new Style({
        geometry: poly.getInteriorPoint(),
        text: new Text({
          text: labelText,
          font: 'bold 14px sans-serif',
          fill: new Fill({ color: '#0044ff' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
          overflow: true,
          padding: [2, 4, 2, 4]
        })
      }));
    });

    return styles;
  },
  surveyBoundaryOutlineStyle: new Style({
    stroke: new Stroke({ color: '#facc15', width: 1.8 })
  }),
  // New style for Taluk points
  talukPoint: new Style({
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: '#ff0000ff' }), // Red fill
      stroke: new Stroke({ color: '#ffffff', width: 1.5 }) // White border
    })
  }),
  rural: new Style({
    stroke: new Stroke({ color: '#f97316', width: 2 }), // Orange 500
    fill: new Fill({ color: 'rgba(249, 115, 22, 0.05)' })
  })
};

// Style for highlighted feature
const HIGHLIGHT_STYLE = new Style({
  stroke: new Stroke({
    color: '#ff0000ff', // Cyan
    width: 3
  }),
  // fill: new Fill({
  //   color: 'rgba(6, 182, 212, 0.2)'
  // }),
  image: new CircleStyle({
    radius: 7,
    // fill: new Fill({ color: '#06b6d4' }),
    // stroke: new Stroke({ color: '#fff', width: 2 })
  })
});

function buildLayer(definition: LayerDefinition) {
  const layer = (() => {
    switch (definition.type) {
      case 'wms': {
        const wmsParams: Record<string, any> = {
          LAYERS: definition.layerName,
          TILED: true,
          TRANSPARENT: true,
          VERSION: '1.1.1',
          ...(definition.wmsParams || {})
        };
        if (definition.cqlFilter) {
          wmsParams.CQL_FILTER = definition.cqlFilter;
        }
        return new TileLayer({
          source: new TileWMS({
            url: definition.url,
            // Explicitly define projection to ensure SRS calculation
            projection: 'EPSG:4326',
            params: wmsParams,
            crossOrigin: 'anonymous'
          })
        });
      }
      case 'image-wms': {
        const wmsParams: Record<string, any> = {
          LAYERS: definition.layerName,
          TRANSPARENT: true,
          VERSION: '1.1.1',
          ...(definition.wmsParams || {})
        };
        if (definition.cqlFilter) {
          wmsParams.CQL_FILTER = definition.cqlFilter;
        }
        return new ImageLayer({
          source: new ImageWMS({
            url: definition.url,
            projection: 'EPSG:4326',
            params: wmsParams,
            crossOrigin: 'anonymous'
          })
        });
      }
      case 'xyz':
        return new TileLayer({
          source: new XYZ({
            url: definition.url,
            projection: 'EPSG:3857', // Most XYZ are 3857
            crossOrigin: 'anonymous'
          })
        });
      case 'image':
        return new ImageLayer({
          source: new ImageStatic({
            url: definition.url,
            projection: 'EPSG:4326',
            imageExtent: definition.extent ?? DEFAULT_EXTENT,
            crossOrigin: 'anonymous'
          })
        });
      case 'wfs':
        return new VectorLayer({
          source: new VectorSource({
            format: new GeoJSON({
              // Tell OL to read as 4326 and match the view
              dataProjection: 'EPSG:4326',
              featureProjection: 'EPSG:4326'
            }),
            strategy: bboxStrategy,
            loader: function (extent, resolution, projection) {
              const base = definition.url;
              // Build the BBOX parameter. 
              // WFS 1.1.0 with EPSG:4326 expects axis order: Latitude, Longitude (y, x)
              // OL extent is [minX, minY, maxX, maxY]

              let url: string;
              const separator = base.includes('?') ? '&' : '?';

              // Handle filtering (CQL) - Mutually exclusive with BBOX for our GeoServer WFS
              if (definition.cqlFilter) {
                url = `${base}${separator}CQL_FILTER=${encodeURIComponent(definition.cqlFilter)}`;
              } else {
                const bboxParam = `${extent[0]},${extent[1]},${extent[2]},${extent[3]}`;
                url = `${base}${separator}BBOX=${bboxParam},EPSG:4326`;
              }
              if (!url.includes('request=')) url += '&request=GetFeature';
              if (!url.includes('service=')) url += '&service=WFS';
              if (!url.includes('version=')) url += '&version=1.1.0';
              if (!url.includes('outputFormat=')) url += '&outputFormat=application/json';
              if (!url.includes('srsname=')) url += '&srsname=EPSG:4326';

              const tn = definition.layerName || definition.name;
              if (!url.toLowerCase().includes('typename=')) {
                url += `&typeName=${tn}`;
              }

              // Workaround for broken GeoServer schema: explicit property list to avoid "property_number" error
              // Note: polygon and polyline layers are left unrestricted so all attributes are returned.
              if (definition.type === 'wfs' && !url.includes('propertyName=')) {
                const nameKey = (definition.layerName || definition.name).toLowerCase();
                let safeProps = '';

                if (nameKey.includes('points')) {
                  safeProps = [
                    'geom',
                    'point_name', 'survey_num_point',
                    'project_name', 'surveyor_name'
                  ].join(',');
                }

                if (safeProps) {
                  url += `&propertyName=${safeProps}`;
                }
              }

              // Apply proxy if needed
              let fetchUrl = url;
              const proxyPath = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/proxy`;
              if (url.includes('117.252.86.213') && !url.includes(proxyPath)) {
                fetchUrl = `${proxyPath}?url=${encodeURIComponent(url)}`;
              }

              fetch(fetchUrl)
                .then(async response => {
                  const text = await response.text();
                  if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}\nResponse: ${text.substring(0, 500)}`);
                  }
                  try {
                    return JSON.parse(text);
                  } catch (e) {
                    throw new Error(`JSON parse failed. Response might be XML/Exception.\nResponse: ${text.substring(0, 500)}`);
                  }
                })
                .then(data => {
                  const source = this as VectorSource;
                  const format = source.getFormat();
                  if (format) {
                    const features = format.readFeatures(data);
                    if (features.length > 0) {
                      source.addFeatures(features as any);
                    }
                  }
                })
                .catch(err => {
                  console.error('WFS loading failed for', definition.name, ':', err);
                  (this as VectorSource).removeLoadedExtent(extent);
                });
            }
          })
        });
      case 'geojson':
        return new VectorLayer({
          source: new VectorSource({
            url: definition.url,
            format: new GeoJSON({
              // Tell OL to read as 4326 and match the view
              dataProjection: 'EPSG:4326',
              featureProjection: 'EPSG:4326'
            })
          })
        });
      default:
        return new TileLayer({ source: new OSM() });
    }
  })();

  // Apply zoom constraints if present
  if (definition.minZoom !== undefined) layer.setMinZoom(definition.minZoom);
  if (definition.maxZoom !== undefined) layer.setMaxZoom(definition.maxZoom);

  return layer;
}

function applyLayerSettings(layer: TileLayer<any> | ImageLayer<any> | VectorLayer<any>, definition: LayerDefinition) {
  layer.setOpacity(definition.opacity);
  layer.setVisible(definition.visible);
}

const BASE_LAYER_SOURCES = {
  osm: new OSM({
    // OSM is implicitly 3857, OL will reproject it to 4326 view automatically
    attributions: '&copy; OpenStreetMap contributors'
  }),
  googleSatellite: new XYZ({
    url: 'https://mt{0-3}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    projection: 'EPSG:3857',
    attributions: '&copy; Google'
  }),
  googleRoad: new XYZ({
    url: 'https://mt{0-3}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    projection: 'EPSG:3857',
    attributions: '&copy; Google'
  }),
  googleHybrid: new XYZ({
    url: 'https://mt{0-3}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    projection: 'EPSG:3857',
    attributions: '&copy; Google'
  }),
  googleTerrain: new XYZ({
    url: 'https://mt{0-3}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    projection: 'EPSG:3857',
    attributions: '&copy; Google'
  }),
  bbmp: new TileWMS({
    url: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/proxy?url=${encodeURIComponent('https://rdgis.karnataka.gov.in/geoserver/BU_bbmp_U/wms')}`,
    params: {
      LAYERS: 'BU_bbmp_U',
      TILED: true,
      TRANSPARENT: false,
      VERSION: '1.1.1'
    },
    projection: 'EPSG:4326',
    crossOrigin: 'anonymous'
  })
};

type MapViewProps = {
  layers: LayerDefinition[];
  baseLayer: BaseLayerType;
  activeTool: string | null;
  onFeatureClick?: (data: { attributes: Record<string, any>; sourceLayer: string; id?: string; geometry?: any } | null) => void;
  onZoomChange?: (zoom: number) => void;
  onMouseCoordinates?: (coords: [number, number] | null) => void;
  highlightedFeature?: { geometry?: any } | null;
  onDrawClose?: () => void;
  drawGeometryType?: GeometryType;
  drawSnapEnabled?: boolean;
  onDrawHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onOfflineAction?: () => void;
  onLocationError?: (error: string) => void;
};

export type MapViewHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  zoomToFeature: (geometry: any) => void;
  goToCurrentLocation: () => void;
  undoDraw: () => void;
  redoDraw: () => void;
  cancelDraw: () => void;
};


const MapView = forwardRef<MapViewHandle, MapViewProps>(({
  layers,
  baseLayer,
  activeTool,
  onFeatureClick,
  onZoomChange,
  onMouseCoordinates,
  highlightedFeature,
  onDrawClose,
  drawGeometryType = 'Polygon',
  drawSnapEnabled = true,
  onDrawHistoryChange,
  onOfflineAction,
  onLocationError,
}: MapViewProps, ref: React.ForwardedRef<MapViewHandle>) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<Map | null>(null);
  const [mapVal, setMapVal] = useState<Map | null>(null);
  const [nominalScale, setNominalScale] = useState<number | null>(null);
  const [scaleEditingValue, setScaleEditingValue] = useState<string>('');
  const [isEditingScale, setIsEditingScale] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const highlightLayerRef = useRef<VectorLayer<any> | null>(null);

  const SCALE_PRESETS = [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000];
  const drawToolRef = useRef<DrawToolHandle>(null);

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      const view = mapInstance.current?.getView();
      if (view) view.animate({ zoom: (view.getZoom() || 0) + 1, duration: 250 });
    },
    zoomOut: () => {
      const view = mapInstance.current?.getView();
      if (view) view.animate({ zoom: (view.getZoom() || 0) - 1, duration: 250 });
    },
    resetView: () => {
      const view = mapInstance.current?.getView();
      if (view) {
        view.fit(KARNATAKA_EXTENT, {
          duration: 1000,
          padding: [50, 50, 50, 50]
        });
      }
    },
    zoomToFeature: (geometry: any) => {
      const view = mapInstance.current?.getView();
      if (view && geometry) {
        try {
          const format = new GeoJSON();
          const feature = format.readFeature({
            type: 'Feature',
            geometry,
            properties: {}
          }, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:4326'
          });
          const geom = feature.getGeometry();
          if (geom) {
            const extent = geom.getExtent();
            if (extent?.every((v: number) => Number.isFinite(v))) {
              // Smooth easing function
              const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
              view.fit(extent, {
                duration: 1500,
                padding: [100, 100, 100, 350],
                maxZoom: 21,
                easing: easeOut
              });
            }
          }
        } catch (e) {
          console.error('Error zooming to feature:', e);
        }
      }
    },
    goToCurrentLocation: () => {
      if (!navigator.geolocation) {
        onLocationError?.('Geolocation is not supported by your browser');
        return;
      }

      const success = (position: GeolocationPosition) => {
        const view = mapInstance.current?.getView();
        if (view) {
          const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
          view.animate({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: 14,
            duration: 1500,
            easing: easeOut
          });
        }
      };

      const error = (err: GeolocationPositionError) => {
        let msg = 'Unknown error getting location';
        switch (err.code) {
          case err.PERMISSION_DENIED: msg = 'Location permission denied'; break;
          case err.POSITION_UNAVAILABLE: msg = 'Location unavailable'; break;
          case err.TIMEOUT: msg = 'Location request timed out'; break;
        }
        console.error('Error getting location:', err.message);
        onLocationError?.(msg);
      };

      navigator.geolocation.getCurrentPosition(success, error, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    },
    undoDraw: () => {
      drawToolRef.current?.undo();
    },
    redoDraw: () => {
      drawToolRef.current?.redo();
    },
    cancelDraw: () => {
      drawToolRef.current?.cancel();
    }
  }));

  // Handle highlighted feature
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Initialize highlight layer if not exists
    if (!highlightLayerRef.current) {
      highlightLayerRef.current = new VectorLayer({
        source: new VectorSource(),
        style: HIGHLIGHT_STYLE,
        zIndex: 999 // Ensure it's on top
      });
      map.addLayer(highlightLayerRef.current);
    }

    const source = highlightLayerRef.current.getSource();
    if (source) {
      source.clear();
      if (highlightedFeature?.geometry && highlightedFeature.geometry.type) {
        try {
          const format = new GeoJSON();
          const feature = format.readFeature({
            type: 'Feature',
            geometry: highlightedFeature.geometry,
            properties: {}
          }, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:4326'
          });
          source.addFeature(feature);
        } catch (e) {
          console.warn('Could not highlight feature:', e);
        }
      }
    }

  }, [highlightedFeature]);

  // Handle active tool cursor and click events
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const target = mapRef.current;
    if (target) {
      if (activeTool === 'measure' || activeTool === 'draw') target.style.cursor = 'crosshair';
      else if (activeTool === 'identify') target.style.cursor = 'help';
      else target.style.cursor = '';
    }

    const getIdentifyPriority = (layerName: string): number => {
      const key = layerName.toLowerCase();
      // Prioritize BU taluk polygon overlays so they are identifiable above base boundaries.
      if (key.includes('_polygon')) return 200;
      if (key === 'application:banglore_urban' || key === 'application:bengaluru_urban') return 100;
      return 0;
    };

    const queryWmsLayers = async (coordinate: any, resolution: number, projection: any, currentZoom: number) => {
      const infoFormats = ['application/json', 'application/vnd.ogc.gml', 'text/xml'];
      const wmsLayers = map.getLayers().getArray().filter((layer) => {
        if (!layer.getVisible()) return false;
        const minZoom = layer.getMinZoom();
        const maxZoom = layer.getMaxZoom();
        if (currentZoom < minZoom || currentZoom >= maxZoom) return false;

        const source = (layer as any).getSource?.();
        return source instanceof TileWMS || source instanceof ImageWMS;
      });

      wmsLayers.sort((a, b) => {
        const aName = (a.get('layerName') || '').toString();
        const bName = (b.get('layerName') || '').toString();
        const priorityDiff = getIdentifyPriority(bName) - getIdentifyPriority(aName);
        if (priorityDiff !== 0) return priorityDiff;
        return (b.getZIndex() || 0) - (a.getZIndex() || 0);
      });

      // Build all fetch promises concurrently
      const fetchPromises: Promise<any>[] = [];
      const layerRefs: any[] = [];

      for (const layer of wmsLayers) {
        const source = (layer as any).getSource() as TileWMS | ImageWMS;
        for (const infoFormat of infoFormats) {
          const url = source.getFeatureInfoUrl(coordinate, resolution, projection, {
            INFO_FORMAT: infoFormat,
            FEATURE_COUNT: 5
          });
          if (!url) continue;

          let fetchUrl = url;
          const proxyPath = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/proxy`;
          if (!url.includes(proxyPath) && url.includes('117.252.86.213')) {
            fetchUrl = `${proxyPath}?url=${encodeURIComponent(url)}`;
          }

          fetchPromises.push(
            fetch(fetchUrl).then(res => ({ res, infoFormat, layer })).catch(() => null)
          );
          layerRefs.push(layer);
        }
      }

      // Execute all concurrently
      const results = await Promise.all(fetchPromises);

      // Process results in the original sorted priority order
      for (const layer of wmsLayers) {
        // Find results for this specific layer
        const layerResults = results.filter(r => r && r.layer === layer);

        for (const result of layerResults) {
          if (!result || !result.res.ok) continue;

          try {
            const bodyText = await result.res.text();
            const contentType = (result.res.headers.get('content-type') || '').toLowerCase();

            if (contentType.includes('json') || result.infoFormat === 'application/json') {
              try {
                const data = JSON.parse(bodyText);
                if (data.features && data.features.length > 0) {
                  const feature = data.features[0];
                  return {
                    attributes: feature.properties,
                    layerName: layer.get('displayName') || layer.get('layerName') || 'WMS Layer',
                    id: feature.id,
                    geometry: feature.geometry
                  };
                }
              } catch {
                // Try next INFO_FORMAT
              }
              continue;
            }

            const gmlReader = new WMSGetFeatureInfo();
            const features = gmlReader.readFeatures(bodyText, {
              dataProjection: 'EPSG:4326',
              featureProjection: 'EPSG:4326'
            });

            if (features.length > 0) {
              const first = features[0];
              const geom = first.getGeometry();
              const fmt = new GeoJSON();
              const geojsonGeometry = geom
                ? fmt.writeGeometryObject(geom, {
                  dataProjection: 'EPSG:4326',
                  featureProjection: 'EPSG:4326'
                })
                : undefined;
              return {
                attributes: first.getProperties(),
                layerName: layer.get('displayName') || layer.get('layerName') || 'WMS Layer',
                id: first.getId()?.toString(),
                geometry: geojsonGeometry
              };
            }
          } catch (error) {
            console.error('GetFeatureInfo parsing failed:', error);
          }
        }
      }
      return null;
    };

    const clickHandler = async (event: any) => {
      // Always update coordinates on click
      onMouseCoordinates?.(event.coordinate as [number, number]);

      if (activeTool !== 'identify') return;



      // 1. Vector features (client-side)
      let foundFeature: any = null;
      let foundLayer: any = null;

      map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
        if (foundFeature) return; // Stop after first valid feature

        // Ignore highlight layer and features without a layer
        if (layer === highlightLayerRef.current || !layer) return;

        // Ensure it's a vector layer that we want to interact with
        if (layer instanceof VectorLayer) {
          foundFeature = feature;
          foundLayer = layer;
        }
      });

      if (foundFeature && foundLayer) {
        const sourceLayer = foundLayer.get('displayName') || foundLayer.get('layerName') || 'Vector Layer';
        const geom = foundFeature.getGeometry();
        let geojsonGeometry: any = undefined;
        if (geom) {
          const fmt = new GeoJSON();
          geojsonGeometry = fmt.writeGeometryObject(geom, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:4326'
          });
        }
        onFeatureClick?.({
          attributes: foundFeature.getProperties(),
          sourceLayer,
          id: foundFeature.getId()?.toString(),
          geometry: geojsonGeometry
        });
        return;
      }

      // 2. WMS features (server-side via proxy)
      if (!navigator.onLine) {
        onOfflineAction?.();
        return;
      }

      const view = map.getView();
      const result = await queryWmsLayers(
        event.coordinate,
        view.getResolution()!,
        view.getProjection(),
        view.getZoom() || 0
      );

      if (result) {
        onFeatureClick?.({
          attributes: result.attributes,
          sourceLayer: result.layerName,
          id: result.id,
          geometry: result.geometry
        });
      } else {
        onFeatureClick?.(null);
      }
    };

    map.on('singleclick', clickHandler);

    return () => {
      map.un('singleclick', clickHandler);
    };
  }, [activeTool, onFeatureClick, onMouseCoordinates, highlightedFeature, onOfflineAction]);

  useEffect(() => {
    if (!mapRef.current) return;

    const initialBaseLayer = new TileLayer({
      source: BASE_LAYER_SOURCES[baseLayer]
    });
    initialBaseLayer.set('isBaseLayer', true);

    const map = new Map({
      target: mapRef.current,
      layers: [initialBaseLayer],
      controls: [], // Removed ScaleLine as per user feedback
      view: new View({
        projection: 'EPSG:4326',
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM
      })
    });

    // Fit to state extent on initial load
    map.getView().fit(KARNATAKA_EXTENT, {
      padding: [20, 20, 20, 20]
    });

    mapInstance.current = map;
    setMapVal(map);

    // Listen for zoom changes
    const view = map.getView();

    const updateScale = () => {
      const resolution = view.getResolution();
      const center = view.getCenter();
      if (resolution !== undefined && center) {
        // Calculate nominal scale: 1 : (point resolution / 0.00028)
        // 0.00028m is the standard OGC pixel size (90 DPI)
        const pointRes = getPointResolution('EPSG:4326', resolution, center, 'm');
        setNominalScale(Math.round(pointRes / 0.00028));
      }
    };

    const handleZoomChange = () => {
      const zoom = view.getZoom();
      if (zoom !== undefined) {
        onZoomChange?.(zoom);
        updateScale();
      }
    };

    view.on('change:resolution', handleZoomChange);
    view.on('change:center', updateScale);

    // Initial scale
    updateScale();

    return () => {
      view.un('change:resolution', handleZoomChange);
      view.un('change:center', updateScale);
      map.setTarget();
      mapInstance.current = null;
    };
  }, [onZoomChange]); // Added onZoomChange to dependencies

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const bl = map
      .getLayers()
      .getArray()
      .find((layer) => layer.get('isBaseLayer') === true) as TileLayer<any>;

    if (bl) {
      bl.setSource(BASE_LAYER_SOURCES[baseLayer]);
    }
  }, [baseLayer]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const existing = map
      .getLayers()
      .getArray()
      .filter((layer) => layer.get('userLayer') === true);

    existing.forEach((layer) => map.removeLayer(layer));

    layers.forEach((definition, index) => {
      const layer = buildLayer(definition);
      layer.set('userLayer', true);
      layer.set('layerName', definition.layerName || definition.name);
      layer.set('displayName', definition.name);
      applyLayerSettings(layer, definition);

      // Auto-apply professional boundary styles
      if (definition.type === 'geojson' || definition.type === 'wfs') {
        const name = definition.name.toLowerCase();
        if (definition.id === 'survey-number-boundary') {
          (layer as VectorLayer<any>).setStyle(
            definition.cqlFilter
              ? BOUNDARY_STYLES.surveyBoundaryCentroidLabelStyle
              : BOUNDARY_STYLES.surveyBoundaryOutlineStyle
          );
        }
        else if (name.includes('state')) (layer as VectorLayer<any>).setStyle(BOUNDARY_STYLES.state);
        else if (name.includes('district')) (layer as VectorLayer<any>).setStyle(BOUNDARY_STYLES.district);
        else if (name.includes('polygon')) (layer as VectorLayer<any>).setStyle(BOUNDARY_STYLES.polygonStyleFunction); // Dynamically style polygons
        else if (name.includes('points')) (layer as VectorLayer<any>).setStyle(BOUNDARY_STYLES.talukPoint); // Apply red to points
        else if (name.includes('taluk') || name.includes('hobli')) (layer as VectorLayer<any>).setStyle(BOUNDARY_STYLES.taluk);
        else if (name.includes('rural')) (layer as VectorLayer<any>).setStyle(BOUNDARY_STYLES.rural);
      }

      layer.setZIndex(layers.length - index + 1);
      map.addLayer(layer);
    });
  }, [layers]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0a0b]">
      <div ref={mapRef} className="h-full w-full" />

      {/* Refined Integrated Scale Indicator (Adjustable) */}
      {nominalScale && (
        <div className="absolute bottom-3 md:bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <div className="relative flex flex-col items-center">
            {/* Simple Presets Menu */}
            <AnimatePresence>
              {showPresets && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute bottom-full mb-2 w-48 overflow-hidden rounded-lg border border-edge bg-panel shadow-2xl"
                >
                  <div className="flex flex-col p-1 custom-scrollbar max-h-48 overflow-y-auto">
                    {SCALE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          const view = mapInstance.current?.getView();
                          const center = view?.getCenter();
                          if (view && center) {
                            const pointResAtUnity = getPointResolution('EPSG:4326', 1, center, 'm');
                            const targetRes = (preset * 0.00028) / pointResAtUnity;
                            view.animate({ resolution: targetRes, duration: 500 });
                          }
                          setShowPresets(false);
                        }}
                        className="flex items-center px-3 py-1.5 rounded-md text-[11px] font-mono font-bold text-ink hover:bg-base transition-colors text-left"
                      >
                        1 : {preset.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Panel (Matching CoordinatesDisplay.tsx style) */}
            <div className="flex items-center gap-4 rounded-lg border border-edge bg-panel px-2 py-1 shadow-xl">
              {/* Scale Input Group */}
              <div className="flex flex-col">
                {/* <span className="text-[9px] font-bold text-muted tracking-wider mb-0.5 uppercase">Scale</span> */}
                <div className="flex items-center text-[10px] md:text-[11px] font-mono text-ink font-bold">
                  <span className="md:inline mr-2 text-muted text-[11px] font-bold select-none">Scale</span>
                  <span className="hidden md:inline mr-1 text-[10px] md:text-[11px] font-bold select-none">1 :</span>
                  <input
                    type="text"
                    value={isEditingScale ? scaleEditingValue : nominalScale.toLocaleString()}
                    onFocus={() => {
                      setIsEditingScale(true);
                      setScaleEditingValue(nominalScale.toString());
                    }}
                    onChange={(e) => setScaleEditingValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const newScale = Number.parseInt(scaleEditingValue.replace(/,/g, ''), 10);
                        if (!Number.isNaN(newScale) && newScale > 0) {
                          const view = mapInstance.current?.getView();
                          const center = view?.getCenter();
                          if (view && center) {
                            const pointResAtUnity = getPointResolution('EPSG:4326', 1, center, 'm');
                            const targetRes = (newScale * 0.00028) / pointResAtUnity;
                            view.animate({ resolution: targetRes, duration: 600 });
                          }
                        }
                        setIsEditingScale(false);
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === 'Escape') {
                        setIsEditingScale(false);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    onBlur={() => {
                      // Slight delay to allow clicking presets
                      setTimeout(() => setIsEditingScale(false), 200);
                    }}
                    className="bg-transparent border-none p-0 text-[11px] font-mono font-bold text-ink w-16 focus:outline-none focus:ring-0 selection:bg-accent/20"
                  />
                </div>
              </div>

              <div className="h-4 w-[2px] bg-edge" />

              {/* Presets Trigger Group */}
              <div className="flex flex-col min-w-[10px]">
                {/* <span className="text-[9px] font-bold text-muted tracking-wider mb-0.5 uppercase">Options</span> */}
                <button
                  onClick={() => setShowPresets(!showPresets)}
                  className="flex items-center gap-0.5 text-[12px] font-bold text-accent hover:text-accent/80 transition-colors uppercase"
                >
                  <ChevronUp className={`w-4 h-4 transition-transform ${showPresets ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DrawTool
        ref={drawToolRef}
        map={mapVal}
        active={activeTool === 'draw'}
        geometryType={drawGeometryType}
        snapEnabled={drawSnapEnabled}
        onClose={onDrawClose}
        onHistoryChange={onDrawHistoryChange}
      />


      {/* <div className="pointer-events-none absolute bottom-4 right-4 rounded-full border border-edge bg-panel px-4 py-2 text-[10px] font-bold tracking-widest text-muted/70 shadow-2xl uppercase">
        OpenLayers • EPSG:4326
      </div> */}
    </div>
  );
});

MapView.displayName = 'MapView';

export default MapView;
