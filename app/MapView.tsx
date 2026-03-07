'use client';

import React, { useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvents,
} from 'react-leaflet';
import type { LatLngExpression, LeafletMouseEvent } from 'leaflet';
import type { Circle as CircleType } from 'leaflet';
import {
  Eye,
  Ghost,
  HelpCircle,
  TriangleAlert,
} from 'lucide-react';
import {
  EPISODE_CATEGORIES,
  getCategoryDisplayName,
  getSupabaseError,
  supabase,
  type Episode,
} from '@/src/lib/supabase';

const SHINJUKU_CENTER: LatLngExpression = [35.6896, 139.6917];
const CIRCLE_RADIUS_M = 500;

function formatDate(isoOrDate: string | undefined | null): string {
  if (!isoOrDate) return '—';
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

function formatEventDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return '—';
  return `${y}/${m}/${d}`;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  '不思議な体験': HelpCircle,
  '心霊現象': Ghost,
  '命の危機': TriangleAlert,
  '違和感': Eye,
};

const MARKER_ICON_COLOR = '#1a1a1a';
const MARKER_BG = '#262626';
const MARKER_BORDER = '#0a0a0a';

function createCategoryIcon(category: string): L.DivIcon {
  const IconComponent = CATEGORY_ICONS[category] ?? HelpCircle;
  const svg = renderToStaticMarkup(
    <IconComponent size={26} color={MARKER_ICON_COLOR} strokeWidth={1.8} />
  );
  const html = `<div style="display:flex;align-items:center;justify-content:center;width:48px;height:48px;background:${MARKER_BG};border:2px solid ${MARKER_BORDER};border-radius:50%;box-shadow:0 2px 10px rgba(0,0,0,0.5);">${svg}</div>`;
  return L.divIcon({
    className: 'emoji-marker',
    html,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

// Leaflet のデフォルトアイコンを Next.js で正しく表示するための設定
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
    ._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

function ClickHandler({
  onSelectPosition,
  onClearRangeCircle,
}: {
  onSelectPosition: (latlng: LatLngExpression) => void;
  onClearRangeCircle: () => void;
}) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onClearRangeCircle();
      onSelectPosition(e.latlng);
    },
  });
  return null;
}

export default function MapView() {
  const [selectedPosition, setSelectedPosition] =
    React.useState<LatLngExpression | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [episodeBody, setEpisodeBody] = React.useState('');
  const [episodeCategory, setEpisodeCategory] = React.useState<string>(
    EPISODE_CATEGORIES[0].value
  );
  const [episodeEventDate, setEpisodeEventDate] = React.useState('');
  const [episodes, setEpisodes] = React.useState<Episode[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);
  const [rangeCirclePosition, setRangeCirclePosition] =
    React.useState<LatLngExpression | null>(null);
  const circleRef = React.useRef<CircleType | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    async function fetchEpisodes() {
      const { data, error } = await client
        .from('episodes')
        .select('id, content, lat, lng, category, event_date, created_at')
        .order('created_at', { ascending: false });
      if (!error && data) setEpisodes(data as Episode[]);
    }
    fetchEpisodes();
  }, []);

  useEffect(() => {
    if (!selectedPosition) return;
    const timer = setTimeout(() => {
      circleRef.current?.openPopup();
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedPosition]);

  const handleSelectPosition = React.useCallback((latlng: LatLngExpression) => {
    setRangeCirclePosition(null);
    setSelectedPosition(latlng);
    setIsFormOpen(false);
    setEpisodeBody('');
    setEpisodeCategory(EPISODE_CATEGORIES[0].value);
    setEpisodeEventDate('');
  }, []);

  const handleClearRangeCircle = React.useCallback(() => {
    setRangeCirclePosition(null);
  }, []);

  const handleOpenForm = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFormOpen(true);
  }, []);

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedPosition || episodeBody.trim() === '') return;
      const lat = Array.isArray(selectedPosition)
        ? selectedPosition[0]
        : (selectedPosition as { lat: number; lng: number }).lat;
      const lng = Array.isArray(selectedPosition)
        ? selectedPosition[1]
        : (selectedPosition as { lat: number; lng: number }).lng;

      if (!supabase) return;
      setIsSubmitting(true);
      const eventDate = episodeEventDate.trim() || null;
      const { data, error } = await supabase
        .from('episodes')
        .insert({
          content: episodeBody.trim(),
          lat,
          lng,
          category: episodeCategory,
          event_date: eventDate,
        })
        .select('id, content, lat, lng, category, event_date, created_at')
        .single();

      setIsSubmitting(false);
      if (error) {
        const detail = `code: ${error.code}\nmessage: ${error.message}`;
        console.error('[MapView] Supabase 投稿エラー:', error);
        console.error('[MapView] error.code:', error.code, 'error.message:', error.message);
        alert(`投稿に失敗しました（401 Unauthorized の原因確認用）\n\n${detail}`);
        return;
      }

      setEpisodes((prev) => [data as Episode, ...prev]);
      setSubmitSuccess(true);
    },
    [
      selectedPosition,
      episodeBody,
      episodeCategory,
      episodeEventDate,
    ]
  );

  useEffect(() => {
    if (!submitSuccess) return;
    const timer = setTimeout(() => {
      setSelectedPosition(null);
      setIsFormOpen(false);
      setEpisodeBody('');
      setEpisodeCategory(EPISODE_CATEGORIES[0].value);
      setEpisodeEventDate('');
      setSubmitSuccess(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [submitSuccess]);

  const supabaseError = getSupabaseError();
  if (supabaseError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-50 p-6">
        <p className="max-w-md text-center font-medium text-red-600">
          Supabase の接続設定に問題があります
        </p>
        <p className="max-w-md text-center text-sm text-zinc-600">
          {supabaseError}
        </p>
        <p className="max-w-md text-center text-xs text-zinc-500">
          .env.local を編集した場合は、開発サーバー（npm run dev）を再起動してください。
        </p>
      </div>
    );
  }

  return (
    <MapContainer
      center={SHINJUKU_CENTER}
      zoom={12}
      className="h-full w-full"
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        detectRetina
      />
      <ClickHandler
        onSelectPosition={handleSelectPosition}
        onClearRangeCircle={handleClearRangeCircle}
      />
      {rangeCirclePosition && (
        <Circle
          center={rangeCirclePosition}
          radius={CIRCLE_RADIUS_M}
          pathOptions={{
            color: '#64748b',
            fillColor: '#94a3b8',
            fillOpacity: 0.2,
            weight: 2,
          }}
        />
      )}
      {episodes.map((ep) => (
        <Marker
          key={ep.id}
          position={[ep.lat, ep.lng]}
          icon={createCategoryIcon(ep.category)}
          eventHandlers={{
            click: () => {
              setSelectedPosition(null);
              setIsFormOpen(false);
              setEpisodeBody('');
              setRangeCirclePosition([ep.lat, ep.lng]);
            },
          }}
        >
          <Popup>
            <div className="min-w-[200px] max-w-[300px] space-y-2 text-left text-sm">
              <p className="text-zinc-700">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">怪異の種別</span>
                <br />
                {getCategoryDisplayName(ep.category)}
              </p>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                体験内容の詳細
              </p>
              <p className="whitespace-pre-wrap text-zinc-800">{ep.content}</p>
              <p className="text-zinc-600">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">体験時期</span>{' '}
                {formatEventDate(ep.event_date)}
              </p>
              <p className="text-zinc-500 text-xs">
                <span className="font-medium uppercase tracking-wider">記録日</span>{' '}
                {formatDate(ep.created_at)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
      {selectedPosition && (
        <Circle
          ref={circleRef}
          center={selectedPosition}
          radius={CIRCLE_RADIUS_M}
          pathOptions={{
            color: '#404040',
            fillColor: '#737373',
            fillOpacity: 0.2,
            weight: 2,
          }}
        >
          <Popup>
            <div className="min-w-[180px] text-center">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                記録を追加
              </p>
              {!isFormOpen ? (
                <button
                  type="button"
                  onClick={handleOpenForm}
                  className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                >
                  体験を記録する
                </button>
              ) : submitSuccess ? (
                <p className="py-2 text-center text-sm text-zinc-600">
                  記録を保存しました
                </p>
              ) : (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={handleSubmit}
                >
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                      怪異の種別
                    </label>
                    <select
                      value={episodeCategory}
                      onChange={(e) =>
                        setEpisodeCategory(e.target.value)
                      }
                      disabled={isSubmitting}
                      className="w-full border border-zinc-300 bg-white p-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                    >
                      {EPISODE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                      体験時期
                    </label>
                    <input
                      type="date"
                      value={episodeEventDate}
                      onChange={(e) =>
                        setEpisodeEventDate(e.target.value)
                      }
                      disabled={isSubmitting}
                      className="w-full border border-zinc-300 bg-white p-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                      体験内容の詳細
                    </label>
                    <textarea
                      placeholder="感情的な表現は避け、その場所で起きた『事実』を淡々と記述してください。"
                      rows={4}
                      value={episodeBody}
                      onChange={(e) => setEpisodeBody(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full resize-none border border-zinc-300 bg-white p-2 text-sm leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting || !episodeBody.trim()}
                    className="border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {isSubmitting ? '保存中...' : '記録を保存する'}
                  </button>
                </form>
              )}
            </div>
          </Popup>
        </Circle>
      )}
    </MapContainer>
  );
}
