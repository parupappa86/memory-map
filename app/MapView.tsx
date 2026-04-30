'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  EPISODE_CATEGORIES,
  getCategoryDisplayName,
  getSupabaseError,
  supabase,
  type EpisodePublic,
} from '@/src/lib/supabase';

const SHINJUKU_CENTER = { lat: 35.6896, lng: 139.6917 };
const FLY_TO_ZOOM = 16;

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

/** 通報理由の選択肢 */
const REPORT_REASONS = [
  { value: '誹謗中傷・個人攻撃', label: '誹謗中傷・個人攻撃' },
  { value: 'プライバシー侵害', label: 'プライバシー侵害' },
  { value: '不適切な内容', label: '不適切な内容' },
  { value: '虚偽・デマの可能性', label: '虚偽・デマの可能性' },
  { value: 'その他（削除依頼）', label: 'その他（削除依頼）' },
] as const;

const MARKER_BG = '#262626';
const MARKER_BORDER = '#0a0a0a';

function categoryPinColors(category: string): { background: string; glyphColor: string } {
  const fill: Record<string, string> = {
    '不思議な体験': '#3f3f46',
    '心霊現象': '#52525b',
    '命の危機': '#991b1b',
    '違和感': '#404040',
  };
  const background = fill[category] ?? MARKER_BG;
  return { background, glyphColor: '#fafafa' };
}

/** 通報フォーム（入力 state を内包） */
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
    <form className="space-y-1.5 pt-1.5" onSubmit={handleSubmit}>
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

function contentPreview(content: string, maxLen: number): string {
  const t = content.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + '...';
}

/**
 * 公開地図用: 同一市区町村（都道府県＋市区町村）の投稿を同一座標に集約するキー。
 * DB の lat/lng カラムは閲覧側では参照しない。
 */
function municipalityKey(ep: EpisodePublic): string | null {
  const c = ep.city_name?.trim();
  const w = ep.ward_name?.trim();
  if (!c || !w) return null;
  return `${c}\t${w}`;
}

function forwardGeocodeQuery(ep: EpisodePublic): string | null {
  const c = ep.city_name?.trim();
  const w = ep.ward_name?.trim();
  if (!c || !w) return null;
  return `${c}${w}`;
}

export type MapViewMode = 'view' | 'post';

export default function MapView({ mode = 'view' }: { mode?: MapViewMode }) {
  const [selectedPosition, setSelectedPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [episodeBody, setEpisodeBody] = useState('');
  const [episodeCategory, setEpisodeCategory] = useState<string>(EPISODE_CATEGORIES[0].value);
  const [episodeEventDate, setEpisodeEventDate] = useState('');
  const [episodes, setEpisodes] = useState<EpisodePublic[]>([]);
  const [episodePositions, setEpisodePositions] = useState<Record<string, google.maps.LatLngLiteral>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [selectedEpisodeIdForFly, setSelectedEpisodeIdForFly] = useState<string | null>(null);
  const [reportingEpisodeId, setReportingEpisodeId] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [wardName, setWardName] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [openInfoEpisodeId, setOpenInfoEpisodeId] = useState<string | null>(null);
  const [draftInfoOpen, setDraftInfoOpen] = useState(true);
  const posCacheRef = useRef<globalThis.Map<string, google.maps.LatLngLiteral>>(
    new globalThis.Map()
  );

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    async function fetchEpisodes() {
      const { data, error } = await client
        .from('episodes')
        .select('id, content, category, event_date, created_at, city_name, ward_name')
        .order('created_at', { ascending: false });
      if (!error && data) setEpisodes(data as EpisodePublic[]);
    }
    fetchEpisodes();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, google.maps.LatLngLiteral> = {};
      const cache = posCacheRef.current;
      for (const ep of episodes) {
        const key = municipalityKey(ep);
        if (!key) continue;
        if (cache.has(key)) {
          next[ep.id] = cache.get(key)!;
          continue;
        }
        const q = forwardGeocodeQuery(ep);
        if (!q) continue;
        try {
          const res = await fetch(`/api/geocode/forward?q=${encodeURIComponent(q)}`);
          const data = (await res.json()) as { lat: number | null; lng: number | null };
          if (cancelled) return;
          if (data.lat != null && data.lng != null) {
            const pos = { lat: data.lat, lng: data.lng };
            cache.set(key, pos);
            next[ep.id] = pos;
          }
        } catch {
          /* スキップ */
        }
      }
      if (!cancelled) {
        setEpisodePositions((prev) => {
          const merged = { ...prev, ...next };
          return merged;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [episodes]);

  useEffect(() => {
    if (!selectedPosition) return;
    const t = setTimeout(() => setDraftInfoOpen(true), 0);
    return () => clearTimeout(t);
  }, [selectedPosition]);

  useEffect(() => {
    if (!selectedEpisodeIdForFly) return;
    const t = setTimeout(() => {
      setOpenInfoEpisodeId(selectedEpisodeIdForFly);
      setSelectedEpisodeIdForFly(null);
    }, 400);
    return () => clearTimeout(t);
  }, [selectedEpisodeIdForFly]);

  const handleMapClick = useCallback((e: { detail: { latLng: google.maps.LatLngLiteral | null } }) => {
    const ll = e.detail.latLng;
    if (!ll) return;
    setSelectedPosition(ll);
    setIsFormOpen(false);
    setEpisodeBody('');
    setEpisodeCategory(EPISODE_CATEGORIES[0].value);
    setEpisodeEventDate('');
    setCityName(null);
    setWardName(null);
    setIsGeocoding(true);
    setDraftInfoOpen(true);
    setOpenInfoEpisodeId(null);
  }, []);

  useEffect(() => {
    if (!selectedPosition) {
      setIsGeocoding(false);
      return;
    }
    const { lat, lng } = selectedPosition;
    let cancelled = false;
    setIsGeocoding(true);
    (async () => {
      try {
        const res = await fetch(`/api/geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
        if (cancelled) return;
        const data = (await res.json()) as { city_name?: string | null; ward_name?: string | null };
        if (cancelled) return;
        const nextCity = data?.city_name != null && String(data.city_name).trim() !== '' ? String(data.city_name).trim() : null;
        const nextWard = data?.ward_name != null && String(data.ward_name).trim() !== '' ? String(data.ward_name).trim() : null;
        setCityName(nextCity);
        setWardName(nextWard);
      } catch {
        if (!cancelled) {
          setCityName(null);
          setWardName(null);
        }
      } finally {
        if (!cancelled) setIsGeocoding(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPosition]);

  const handleOpenForm = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFormOpen(true);
  }, []);

  const handleListSelectEpisode = useCallback((ep: EpisodePublic) => {
    setSelectedEpisodeIdForFly(ep.id);
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
      if (!selectedPosition || episodeBody.trim() === '' || isGeocoding) return;
      const { lat, lng } = selectedPosition;
      if (!supabase) return;
      setIsSubmitting(true);
      const eventDate = episodeEventDate.trim() || null;
      const { data, error } = await supabase
        .from('episodes')
        .insert({
          content: episodeBody.trim(),
          lat,
          lng,
          actual_latitude: lat,
          actual_longitude: lng,
          city_name: cityName ?? null,
          ward_name: wardName ?? null,
          category: episodeCategory,
          event_date: eventDate,
        })
        .select('id, content, category, event_date, created_at, city_name, ward_name')
        .single();

      setIsSubmitting(false);
      if (error) {
        const detail = `code: ${error.code}\nmessage: ${error.message}`;
        console.error('[MapView] Supabase 投稿エラー:', error);
        alert(`投稿に失敗しました\n\n${detail}`);
        return;
      }

      setEpisodes((prev) => [data as EpisodePublic, ...prev]);
      setSubmitSuccess(true);
    },
    [selectedPosition, episodeBody, episodeCategory, episodeEventDate, cityName, wardName, isGeocoding]
  );

  useEffect(() => {
    if (!submitSuccess) return;
    const timer = setTimeout(() => {
      setSelectedPosition(null);
      setIsFormOpen(false);
      setEpisodeBody('');
      setEpisodeCategory(EPISODE_CATEGORIES[0].value);
      setEpisodeEventDate('');
      setCityName(null);
      setWardName(null);
      setIsGeocoding(false);
      setSubmitSuccess(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [submitSuccess]);

  const supabaseError = getSupabaseError();
  if (supabaseError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-50 p-6">
        <p className="max-w-md text-center font-medium text-red-600">Supabase の接続設定に問題があります</p>
        <p className="max-w-md text-center text-sm text-zinc-600">{supabaseError}</p>
      </div>
    );
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-50 p-6">
        <p className="max-w-md text-center font-medium text-red-600">
          Google Maps の API キーが設定されていません
        </p>
        <p className="max-w-md text-center text-sm text-zinc-600">
          .env.local に NEXT_PUBLIC_GOOGLE_MAPS_API_KEY を設定してください。
        </p>
      </div>
    );
  }

  if (!process.env.NEXT_PUBLIC_MAP_ID?.trim()) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-50 p-6">
        <p className="max-w-md text-center font-medium text-red-600">
          Google Maps の Map ID が設定されていません
        </p>
        <p className="max-w-md text-center text-sm text-zinc-600">
          Vercel / .env.local に NEXT_PUBLIC_MAP_ID を設定してください（ベクターマップ・Advanced Marker に必要です）。
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['marker']}>
        <Map
          mapId={process.env.NEXT_PUBLIC_MAP_ID}
          defaultCenter={SHINJUKU_CENTER}
          defaultZoom={12}
          className="h-full w-full"
          gestureHandling="greedy"
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          onClick={mode === 'post' ? handleMapClick : undefined}
          style={{ width: '100%', height: '100%' }}
        >
          {episodes.map((ep) => {
            const pos = episodePositions[ep.id];
            if (!pos) return null;
            const pin = categoryPinColors(ep.category);
            return (
              <React.Fragment key={ep.id}>
                <AdvancedMarker
                  position={pos}
                  onClick={() => {
                    setSelectedPosition(null);
                    setIsFormOpen(false);
                    setEpisodeBody('');
                    setReportingEpisodeId(null);
                    setOpenInfoEpisodeId(ep.id);
                  }}
                >
                  <Pin
                    background={pin.background}
                    borderColor={MARKER_BORDER}
                    glyphColor={pin.glyphColor}
                  />
                </AdvancedMarker>
                {openInfoEpisodeId === ep.id && (
                  <InfoWindow position={pos} onCloseClick={() => setOpenInfoEpisodeId(null)}>
                    <div className="min-w-[260px] max-w-[360px] space-y-1.5 text-left text-black">
                      <p>
                        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">怪異の種別</span>
                        <br />
                        <span className="text-base font-serif">{getCategoryDisplayName(ep.category)}</span>
                      </p>
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">体験内容の詳細</p>
                      <p className="whitespace-pre-wrap text-base font-serif">{ep.content}</p>
                      <p className="text-base text-zinc-700">
                        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">体験時期</span>{' '}
                        {formatEventDate(ep.event_date)}
                      </p>
                      <p className="text-base text-zinc-600">
                        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">記録日</span>{' '}
                        {formatDate(ep.created_at)}
                      </p>
                      {ep.city_name && ep.ward_name && (
                        <p className="text-xs text-zinc-500">
                          表示位置: {ep.city_name}
                          {ep.ward_name}
                          （市区町村の代表地点）
                        </p>
                      )}
                      {reportingEpisodeId !== ep.id ? (
                        <p className="pt-1.5 text-xs text-zinc-500">
                          <button
                            type="button"
                            onClick={(ev) => handleOpenReport(ep.id, ev)}
                            className="underline hover:text-zinc-700"
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
                  </InfoWindow>
                )}
              </React.Fragment>
            );
          })}

          {mode === 'post' && selectedPosition && (
            <>
              <AdvancedMarker
                position={selectedPosition}
                onClick={() => {
                  setSelectedPosition(null);
                  setIsFormOpen(false);
                  setEpisodeBody('');
                }}
              >
                <Pin background="#4b0082" borderColor="#1a1a1a" glyphColor="#f4f4f5" />
              </AdvancedMarker>
              {draftInfoOpen && (
                <InfoWindow
                  position={selectedPosition}
                  onCloseClick={() => setDraftInfoOpen(false)}
                >
                  <div className="min-w-[240px] text-center text-black">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">記録を追加</p>
                    {!isFormOpen ? (
                      <button
                        type="button"
                        onClick={handleOpenForm}
                        className="w-full border border-zinc-500 bg-zinc-800 px-3 py-2.5 text-base font-medium text-white transition-colors hover:bg-zinc-700"
                      >
                        体験を記録する
                      </button>
                    ) : submitSuccess ? (
                      <p className="py-1.5 text-center text-base text-zinc-700">記録を保存しました</p>
                    ) : (
                      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
                        <div>
                          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                            怪異の種別
                          </label>
                          <select
                            value={episodeCategory}
                            onChange={(e) => setEpisodeCategory(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full border border-zinc-600 bg-zinc-900 p-2.5 text-base text-white focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
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
                            onChange={(e) => setEpisodeEventDate(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full border border-zinc-600 bg-zinc-900 p-2.5 text-base text-white focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
                          />
                        </div>
                        <p className="text-left text-xs leading-relaxed text-zinc-600">
                          {isGeocoding ? (
                            <>📍 市区町村を確認しています...</>
                          ) : cityName || wardName ? (
                            <>
                              📍{' '}
                              {[cityName, wardName].filter(Boolean).join('')}
                              に記録されます
                            </>
                          ) : (
                            <>📍 市区町村名を特定できませんでした（座標は非公開で保存されます）</>
                          )}
                        </p>
                        <div>
                          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
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
                          disabled={isSubmitting || isGeocoding || !episodeBody.trim()}
                          className="border border-zinc-500 bg-zinc-800 px-3 py-2.5 text-base font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                        >
                          {isSubmitting ? '保存中...' : isGeocoding ? '解析を待っています...' : '記録を保存する'}
                        </button>
                      </form>
                    )}
                  </div>
                </InfoWindow>
              )}
            </>
          )}
        </Map>
        <BoundsListPanelWrapper
          episodes={episodes}
          episodePositions={episodePositions}
          onSelectEpisode={handleListSelectEpisode}
          selectedEpisodeIdForFly={selectedEpisodeIdForFly}
        />
      </APIProvider>
    </div>
  );
}

function BoundsListPanelWrapper({
  episodes,
  episodePositions,
  onSelectEpisode,
  selectedEpisodeIdForFly,
}: {
  episodes: EpisodePublic[];
  episodePositions: Record<string, google.maps.LatLngLiteral>;
  onSelectEpisode: (ep: EpisodePublic) => void;
  selectedEpisodeIdForFly: string | null;
}) {
  const map = useMap();
  const [boundsEpisodes, setBoundsEpisodes] = useState<EpisodePublic[]>([]);

  useEffect(() => {
    if (!map) return;
    const updateBounds = () => {
      const b = map.getBounds();
      if (!b) return;
      const inBounds = episodes.filter((ep) => {
        const p = episodePositions[ep.id];
        if (!p) return false;
        return b.contains(p);
      });
      setBoundsEpisodes(inBounds);
    };
    updateBounds();
    const listener = map.addListener('idle', updateBounds);
    return () => {
      if (typeof google !== 'undefined') {
        google.maps.event.removeListener(listener);
      }
    };
  }, [map, episodes, episodePositions]);

  const handleClick = useCallback(
    (ep: EpisodePublic) => {
      const p = episodePositions[ep.id];
      if (!p || !map) return;
      map.panTo(p);
      map.setZoom(FLY_TO_ZOOM);
      onSelectEpisode(ep);
    },
    [map, onSelectEpisode, episodePositions]
  );

  return (
    <div className="absolute right-0 top-0 z-[1000] flex h-full w-full max-w-[320px] flex-col border-l border-zinc-200 bg-white/95 shadow-lg backdrop-blur sm:w-[280px]">
      <div className="shrink-0 border-b border-zinc-200 p-3">
        <p className="text-xs uppercase tracking-wider text-zinc-400">検索・フィルタ（準備中）</p>
        <p className="mt-1 text-[11px] text-zinc-400">地名検索やカテゴリー絞り込みは今後追加予定です。</p>
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
                <span className="font-medium text-zinc-600">{getCategoryDisplayName(ep.category)}</span>
                <br />
                <span className="font-medium text-zinc-900">{contentPreview(ep.content, 28)}</span>
              </button>
            </li>
          ))}
        </ul>
        {boundsEpisodes.length === 0 && (
          <p className="py-4 text-center text-base text-zinc-500">この範囲には記録がありません</p>
        )}
      </div>
    </div>
  );
}
