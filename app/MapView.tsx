'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import type { LatLngExpression, LeafletMouseEvent } from 'leaflet';
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
const FLY_TO_ZOOM = 16;

/** 通報理由の選択肢 */
const REPORT_REASONS = [
  { value: '誹謗中傷・個人攻撃', label: '誹謗中傷・個人攻撃' },
  { value: 'プライバシー侵害', label: 'プライバシー侵害' },
  { value: '不適切な内容', label: '不適切な内容' },
  { value: '虚偽・デマの可能性', label: '虚偽・デマの可能性' },
  { value: 'その他（削除依頼）', label: 'その他（削除依頼）' },
] as const;

/** 通報フォーム（入力 state を内包し、親の再レンダーでフォーカスが外れないようにする） */
function ReportForm({
  episodeId,
  onSuccess,
  onCancel,
}: {
  episodeId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!reason.trim() || !supabase) return;
      setStatus('submitting');
      const { error } = await supabase.from('reports').insert({
        episode_id: episodeId,
        reason: reason.trim(),
        details: details.trim() || null,
      });
      if (error) {
        console.error('[ReportForm] 通報保存エラー:', error);
        setStatus('error');
        return;
      }
      setStatus('success');
    },
    [episodeId, reason, details]
  );

  if (status === 'success') {
    return (
      <div className="space-y-1.5 pt-1.5">
        <p className="text-sm text-zinc-300">
          通報を受け付けました。管理者が確認いたします。
        </p>
        <button
          type="button"
          onClick={onSuccess}
          className="text-xs underline hover:text-zinc-400"
        >
          閉じる
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-1.5 pt-1.5"
      onSubmit={handleSubmit}
    >
      <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400">
        通報理由
      </label>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={status === 'submitting'}
        className="w-full border border-zinc-600 bg-zinc-900 p-2 text-sm text-white focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
      >
        <option value="">選択してください</option>
        {REPORT_REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400">
        詳細（任意）
      </label>
      <textarea
        placeholder="具体的な理由や問題箇所を記入してください（任意）"
        rows={4}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        disabled={status === 'submitting'}
        spellCheck={false}
        autoComplete="off"
        className="min-h-[6rem] w-full resize-none border border-zinc-600 bg-zinc-900 p-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50 font-sans leading-normal"
        style={{ lineHeight: 1.5 }}
      />
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={status === 'submitting' || !reason.trim()}
          className="flex-1 border border-zinc-500 bg-zinc-800 px-4 py-2.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {status === 'submitting' ? '送信中...' : '送信'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={status === 'submitting'}
          className="flex-1 border border-zinc-600 px-4 py-2.5 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
        >
          キャンセル
        </button>
      </div>
      {status === 'error' && (
        <p className="text-xs text-red-400">送信に失敗しました。しばらくしてからお試しください。</p>
      )}
    </form>
  );
}

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

/** クラスターアイコン: 黒ベース・白数字 */
function clusterIconCreate(cluster: { getChildCount: () => number }): L.DivIcon {
  const count = cluster.getChildCount();
  const sizeClass =
    count < 10 ? 'small' : count < 100 ? 'medium' : 'large';
  return L.divIcon({
    html: `<div><span>${count}</span></div>`,
    className: `marker-cluster marker-cluster-${sizeClass} marker-cluster-custom`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
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
}: {
  onSelectPosition: (latlng: LatLngExpression) => void;
}) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onSelectPosition(e.latlng);
    },
  });
  return null;
}

function contentPreview(content: string, maxLen: number): string {
  const t = content.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + '...';
}

export default function MapView() {
  const [selectedPosition, setSelectedPosition] =
    useState<LatLngExpression | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [episodeBody, setEpisodeBody] = useState('');
  const [episodeCategory, setEpisodeCategory] = useState<string>(
    EPISODE_CATEGORIES[0].value
  );
  const [episodeEventDate, setEpisodeEventDate] = useState('');
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [selectedEpisodeIdForFly, setSelectedEpisodeIdForFly] = useState<
    string | null
  >(null);
  const [reportingEpisodeId, setReportingEpisodeId] = useState<string | null>(null);
  const draftMarkerRef = useRef<L.Marker | null>(null);
  const markerRefs = useRef<Record<string, L.Marker>>({});

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
      const marker = draftMarkerRef.current;
      if (marker && typeof marker.openPopup === 'function') marker.openPopup();
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedPosition]);

  useEffect(() => {
    if (!selectedEpisodeIdForFly) return;
    const t = setTimeout(() => {
      const marker = markerRefs.current[selectedEpisodeIdForFly];
      if (marker) marker.openPopup();
      setSelectedEpisodeIdForFly(null);
    }, 900);
    return () => clearTimeout(t);
  }, [selectedEpisodeIdForFly]);

  const handleSelectPosition = useCallback((latlng: LatLngExpression) => {
    setSelectedPosition(latlng);
    setIsFormOpen(false);
    setEpisodeBody('');
    setEpisodeCategory(EPISODE_CATEGORIES[0].value);
    setEpisodeEventDate('');
  }, []);

  const handleOpenForm = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFormOpen(true);
  }, []);

  const handleListSelectEpisode = useCallback((ep: Episode) => {
    setSelectedEpisodeIdForFly(ep.id);
  }, []);

  const registerMarkerRef = useCallback((id: string, el: L.Marker | null) => {
    if (el) markerRefs.current[id] = el;
    else delete markerRefs.current[id];
  }, []);

  const handleOpenReport = useCallback((episodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setReportingEpisodeId(episodeId);
  }, []);

  const handleCloseReport = useCallback(() => {
    setReportingEpisodeId(null);
  }, []);

  const handleSubmit = useCallback(
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
    <div className="relative h-full w-full">
      <MapContainer
        center={SHINJUKU_CENTER}
        zoom={12}
        className="h-full w-full"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'
          url="https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"
        />
        <ClickHandler onSelectPosition={handleSelectPosition} />
        <MarkerClusterGroup
          iconCreateFunction={clusterIconCreate}
          spiderfyOnMaxZoom
          maxClusterRadius={60}
          chunkedLoading
        >
          {episodes.map((ep) => (
            <Marker
              key={ep.id}
              position={[ep.lat, ep.lng]}
              icon={createCategoryIcon(ep.category)}
              ref={(el) => registerMarkerRef(ep.id, el)}
              eventHandlers={{
                click: () => {
                  setSelectedPosition(null);
                  setIsFormOpen(false);
                  setEpisodeBody('');
                  setReportingEpisodeId(null);
                },
              }}
            >
              <Popup className="popup-dark">
                <div className="min-w-[260px] max-w-[360px] space-y-1.5 text-left">
                  <p>
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">怪異の種別</span>
                    <br />
                    <span className="text-base font-serif text-white">{getCategoryDisplayName(ep.category)}</span>
                  </p>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    体験内容の詳細
                  </p>
                  <p className="whitespace-pre-wrap text-base font-serif text-white">{ep.content}</p>
                  <p className="text-base text-zinc-300">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">体験時期</span>{' '}
                    {formatEventDate(ep.event_date)}
                  </p>
                  <p className="text-base text-zinc-400">
                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">記録日</span>{' '}
                    {formatDate(ep.created_at)}
                  </p>
                  {reportingEpisodeId !== ep.id ? (
                    <p className="pt-1.5 text-xs text-zinc-500">
                      <button
                        type="button"
                        onClick={(ev) => handleOpenReport(ep.id, ev)}
                        className="underline hover:text-zinc-400"
                      >
                        この投稿を通報・削除依頼する
                      </button>
                    </p>
                  ) : (
                    <ReportForm
                      episodeId={ep.id}
                      onSuccess={handleCloseReport}
                      onCancel={handleCloseReport}
                    />
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
        {selectedPosition && (
          <Marker
            position={
              Array.isArray(selectedPosition)
                ? selectedPosition
                : [selectedPosition.lat, selectedPosition.lng]
            }
            ref={draftMarkerRef}
            eventHandlers={{
              click: () => {
                setSelectedPosition(null);
                setIsFormOpen(false);
                setEpisodeBody('');
              },
            }}
          >
            <Popup className="popup-dark">
              <div className="min-w-[240px] text-center">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
                  記録を追加
                </p>
                {!isFormOpen ? (
                  <button
                    type="button"
                    onClick={handleOpenForm}
                    className="w-full border border-zinc-500 bg-zinc-800 px-3 py-2.5 text-base font-medium text-white transition-colors hover:bg-zinc-700"
                  >
                    体験を記録する
                  </button>
                ) : submitSuccess ? (
                  <p className="py-1.5 text-center text-base text-zinc-300">
                    記録を保存しました
                  </p>
                ) : (
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={handleSubmit}
                  >
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                        怪異の種別
                      </label>
                      <select
                        value={episodeCategory}
                        onChange={(e) =>
                          setEpisodeCategory(e.target.value)
                        }
                        disabled={isSubmitting}
                        className="w-full border border-zinc-600 bg-zinc-900 p-2.5 text-base text-white placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
                      >
                        {EPISODE_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                        体験時期
                      </label>
                      <input
                        type="date"
                        value={episodeEventDate}
                        onChange={(e) =>
                          setEpisodeEventDate(e.target.value)
                        }
                        disabled={isSubmitting}
                        className="w-full border border-zinc-600 bg-zinc-900 p-2.5 text-base text-white focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                        体験内容の詳細
                      </label>
                      <textarea
                        placeholder="ここで何が起きましたか？あなたの体験や、その場所で感じた空気を自由に書いてください。"
                        rows={4}
                        value={episodeBody}
                        onChange={(e) => setEpisodeBody(e.target.value)}
                        disabled={isSubmitting}
                        spellCheck={false}
                        autoComplete="off"
                        className="min-h-[6rem] w-full resize-none border border-zinc-600 bg-zinc-900 p-2.5 text-base text-white placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50 leading-normal"
                        style={{ lineHeight: 1.5 }}
                      />
                    </div>
                    <p className="text-[11px] leading-relaxed text-zinc-500">
                      【禁止事項】個人宅の特定、特定の施設・個人への誹謗中傷、プライバシーを侵害する内容の投稿。違反した場合は予告なく削除します。
                    </p>
                    <button
                      type="submit"
                      disabled={isSubmitting || !episodeBody.trim()}
                      className="border border-zinc-500 bg-zinc-800 px-3 py-2.5 text-base font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                    >
                      {isSubmitting ? '保存中...' : '記録を保存する'}
                    </button>
                  </form>
                )}
              </div>
            </Popup>
          </Marker>
        )}
        <BoundsListPanelWrapper
          episodes={episodes}
          onSelectEpisode={handleListSelectEpisode}
          selectedEpisodeIdForFly={selectedEpisodeIdForFly}
        />
      </MapContainer>
    </div>
  );
}

function BoundsListPanelWrapper({
  episodes,
  onSelectEpisode,
  selectedEpisodeIdForFly,
}: {
  episodes: Episode[];
  onSelectEpisode: (ep: Episode) => void;
  selectedEpisodeIdForFly: string | null;
}) {
  const map = useMap();
  const [boundsEpisodes, setBoundsEpisodes] = useState<Episode[]>([]);

  useEffect(() => {
    const updateBounds = () => {
      const b = map.getBounds();
      const inBounds = episodes.filter(
        (ep) => b.contains([ep.lat, ep.lng])
      );
      setBoundsEpisodes(inBounds);
    };
    updateBounds();
    map.on('moveend', updateBounds);
    return () => {
      map.off('moveend', updateBounds);
    };
  }, [map, episodes]);

  const handleClick = useCallback(
    (ep: Episode) => {
      map.flyTo([ep.lat, ep.lng], FLY_TO_ZOOM);
      onSelectEpisode(ep);
    },
    [map, onSelectEpisode]
  );

  return (
    <div className="absolute right-0 top-0 z-[1000] flex h-full w-full max-w-[320px] flex-col border-l border-zinc-200 bg-white/95 shadow-lg backdrop-blur sm:w-[280px]">
      <div className="shrink-0 border-b border-zinc-200 p-3">
        <p className="text-xs uppercase tracking-wider text-zinc-400">
          検索・フィルタ（準備中）
        </p>
        <p className="mt-1 text-[11px] text-zinc-400">
          地名検索やカテゴリー絞り込みは今後追加予定です。
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="mb-2 text-sm font-medium uppercase tracking-wider text-zinc-600">
          表示範囲の記録（{boundsEpisodes.length}件）
        </p>
        <ul className="space-y-1">
          {boundsEpisodes.map((ep) => (
            <li key={ep.id}>
              <button
                type="button"
                onClick={() => handleClick(ep)}
                className={`w-full rounded border px-3 py-2.5 text-left text-base leading-snug transition-colors ${
                  selectedEpisodeIdForFly === ep.id
                    ? 'border-zinc-800 bg-zinc-100 text-zinc-900'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50'
                }`}
              >
                <span className="font-medium text-zinc-600">
                  {getCategoryDisplayName(ep.category)}
                </span>
                <br />
                <span className="text-zinc-900 font-medium">
                  {contentPreview(ep.content, 28)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {boundsEpisodes.length === 0 && (
          <p className="py-4 text-center text-base text-zinc-500">
            この範囲には記録がありません
          </p>
        )}
      </div>
    </div>
  );
}
