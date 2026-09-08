import type { Map as MapboxMap } from 'mapbox-gl';

export type LatLng = { lat: number; lng: number };

export const MAPBOX_DARK_STYLE = 'mapbox://styles/mapbox/dark-v11';

/** トークン未設定時のダークキャンバス（Mapbox タイルは使わない） */
export const LOCAL_DARK_STYLE = {
  version: 8 as const,
  name: 'local-dark-fallback',
  sources: {
    'carto-dark': {
      type: 'raster' as const,
      tiles: [
        'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
    },
  },
  layers: [
    {
      id: 'carto-dark',
      type: 'raster' as const,
      source: 'carto-dark',
    },
  ],
};

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

/** 店舗・施設などの POI レイヤー（dark-v11 の symbol 層） */
const POI_LAYER_RE = /(^|-)(poi|airport|transit)(-|$)/i;

export function hidePoiLayers(map: MapboxMap): void {
  const layers = map.getStyle()?.layers;
  if (!layers) return;
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue;
    if (!POI_LAYER_RE.test(layer.id)) continue;
    if (map.getLayer(layer.id)) {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  }
}

export function createPinElement(options: {
  background: string;
  borderColor: string;
  glyphColor: string;
  title?: string;
}): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'memory-map-pin';
  if (options.title) el.title = options.title;
  el.setAttribute('role', 'button');
  el.innerHTML = `<svg viewBox="0 0 24 36" width="28" height="36" aria-hidden="true">
    <path d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12c0 8.4 10.5 22 10.5 22s10.5-13.6 10.5-22C22.5 6.2 17.8 1.5 12 1.5z"
      fill="${options.background}" stroke="${options.borderColor}" stroke-width="1.6"/>
    <circle cx="12" cy="12" r="3.6" fill="${options.glyphColor}"/>
  </svg>`;
  return el;
}
