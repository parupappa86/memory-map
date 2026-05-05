'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
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

type PostFormOverlayProps = {
  isSubmitting: boolean;
  isGeocoding: boolean;
  episodeCategory: string;
  episodeEventYear: string;
  episodeBody: string;
  cityName: string | null;
  wardName: string | null;
  onCategoryChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

function normalizeYearInput(value: string): string {
  const halfWidth = value.replace(/[０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
  return halfWidth.replace(/[^0-9]/g, '').slice(0, 4);
}

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

const PostFormOverlay = React.memo(function PostFormOverlay({
  isSubmitting,
  isGeocoding,
  episodeCategory,
  episodeEventYear,
  episodeBody,
  cityName,
  wardName,
  onCategoryChange,
  onYearChange,
  onBodyChange,
  onSubmit,
}: PostFormOverlayProps) {
  return (
    <div className="absolute bottom-4 left-4 z-[1200] w-[calc(100%-1rem)] max-w-[420px] rounded border border-zinc-700 bg-zinc-950/95 p-3 shadow-xl">
      <form className="flex flex-col gap-2" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
            怪異の種別
          </label>
          <select
            value={episodeCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
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
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
            体験時期（年）
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={episodeEventYear}
            onChange={(e) => onYearChange(normalizeYearInput(e.target.value))}
            maxLength={4}
            placeholder="例: 1998"
            disabled={isSubmitting}
            className="w-full border border-zinc-600 bg-zinc-900 p-2.5 text-base text-white placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
          />
        </div>
        <p className="text-left text-xs leading-relaxed text-zinc-300">
          {isGeocoding ? (
            <>📍 市区町村を確認しています...</>
          ) : cityName || wardName ? (
            <>
              📍 近隣への配慮とプライバシー保護のため、正確な地点ではなく、入力された市区町村の中心付近にピンを設置します。これにより特定の場所や個人が特定されることはありません。
            </>
          ) : (
            <>📍 市区町村名を特定できませんでした（座標は非公開で保存されます）</>
          )}
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
            体験内容の詳細
          </label>
          <textarea
            placeholder="ここで何が起きましたか？あなたの体験や、その場所で感じた空気を自由に書いてください。"
            rows={4}
            value={episodeBody}
            onChange={(e) => onBodyChange(e.target.value)}
            disabled={isSubmitting}
            spellCheck={false}
            autoComplete="off"
            className="min-h-[6rem] w-full resize-none border border-zinc-600 bg-zinc-900 p-2.5 text-base text-white placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50 leading-normal"
            style={{ lineHeight: 1.5 }}
          />
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-400">
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
    </div>
  );
});

export default function MapView({ mode = 'view' }: { mode?: MapViewMode }) {
  const isPostMode = mode === 'post';
  const [selectedPosition, setSelectedPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [isPostingEnabled, setIsPostingEnabled] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [episodeBody, setEpisodeBody] = useState('');
  const [episodeCategory, setEpisodeCategory] = useState<string>(EPISODE_CATEGORIES[0].value);
  const [episodeEventYear, setEpisodeEventYear] = useState('');
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
    setEpisodeEventYear('');
    setCityName(null);
    setWardName(null);
    setIsGeocoding(true);
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

  const handleListSelectEpisode = useCallback((ep: EpisodePublic) => {
    setSelectedEpisodeIdForFly(ep.id);
  }, []);

  const handleStartPosting = useCallback(() => {
    setIsPostingEnabled(true);
    setIsFormOpen(false);
    setSubmitSuccess(false);
  }, []);

  const handleStopPosting = useCallback(() => {
    setIsPostingEnabled(false);
    setSelectedPosition(null);
    setIsFormOpen(false);
    setEpisodeBody('');
    setEpisodeCategory(EPISODE_CATEGORIES[0].value);
    setEpisodeEventYear('');
    setCityName(null);
    setWardName(null);
    setIsGeocoding(false);
  }, []);

  const handleOpenReport = useCallback((episodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setReportingEpisodeId(episodeId);
  }, []);

  const handleCloseReport = useCallback(() => {
    setReportingEpisodeId(null);
  }, []);

  const openInfoEpisode = openInfoEpisodeId
    ? episodes.find((ep) => ep.id === openInfoEpisodeId) ?? null
    : null;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedPosition || episodeBody.trim() === '' || isGeocoding) return;
      const { lat, lng } = selectedPosition;
      if (!supabase) return;
      setIsSubmitting(true);
      const eventDate = episodeEventYear.trim() ? `${episodeEventYear.trim()}-01-01` : null;
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
    [selectedPosition, episodeBody, episodeCategory, episodeEventYear, cityName, wardName, isGeocoding]
  );

  useEffect(() => {
    if (!submitSuccess) return;
    const timer = setTimeout(() => {
      setSelectedPosition(null);
      setIsFormOpen(false);
      setEpisodeBody('');
      setEpisodeCategory(EPISODE_CATEGORIES[0].value);
      setEpisodeEventYear('');
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
          onClick={isPostMode && isPostingEnabled ? handleMapClick : undefined}
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
              </React.Fragment>
            );
          })}

          {isPostMode && selectedPosition && (
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
            </>
          )}
        </Map>
        {isPostMode && (
          <div className="absolute left-4 top-4 z-[1200] flex items-center gap-2">
            {!isPostingEnabled ? (
              <button
                type="button"
                onClick={handleStartPosting}
                className="rounded border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-zinc-800"
              >
                ＋体験を記録する
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopPosting}
                className="rounded border border-zinc-400 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow hover:bg-zinc-50"
              >
                投稿モードを終了
              </button>
            )}
          </div>
        )}
        {isPostMode && isPostingEnabled && !selectedPosition && (
          <div className="absolute bottom-4 left-4 z-[1200] max-w-[460px] rounded border border-zinc-700 bg-zinc-950/90 px-3 py-2 text-xs leading-relaxed text-zinc-200 shadow-xl">
            投稿モードです。地図上をクリックして投稿地点を選択してください。
          </div>
        )}
        {isPostMode && selectedPosition && !isFormOpen && !submitSuccess && (
          <div className="absolute bottom-4 left-4 z-[1200] w-[calc(100%-1rem)] max-w-[420px] rounded border border-zinc-700 bg-zinc-950/95 p-3 shadow-xl">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-300">記録を追加</p>
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="w-full border border-zinc-500 bg-zinc-800 px-3 py-2.5 text-base font-medium text-white transition-colors hover:bg-zinc-700"
            >
              この地点で体験を記録する
            </button>
          </div>
        )}
        {isPostMode && selectedPosition && submitSuccess && (
          <div className="absolute bottom-4 left-4 z-[1200] w-[calc(100%-1rem)] max-w-[420px] rounded border border-zinc-700 bg-zinc-950/95 p-3 text-center text-base text-zinc-100 shadow-xl">
            記録を保存しました
          </div>
        )}
        {isPostMode && selectedPosition && isFormOpen && !submitSuccess && (
          <PostFormOverlay
            isSubmitting={isSubmitting}
            isGeocoding={isGeocoding}
            episodeCategory={episodeCategory}
            episodeEventYear={episodeEventYear}
            episodeBody={episodeBody}
            cityName={cityName}
            wardName={wardName}
            onCategoryChange={setEpisodeCategory}
            onYearChange={setEpisodeEventYear}
            onBodyChange={setEpisodeBody}
            onSubmit={handleSubmit}
          />
        )}
        {openInfoEpisode && (
          <div className="absolute bottom-4 left-4 z-[1200] w-[calc(100%-1rem)] max-w-[420px] rounded border border-zinc-300 bg-white/95 p-3 text-black shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">投稿の詳細</p>
              <button
                type="button"
                onClick={() => {
                  setOpenInfoEpisodeId(null);
                  setReportingEpisodeId(null);
                }}
                className="rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                閉じる
              </button>
            </div>
            <div className="mt-1.5 space-y-1.5 text-left">
              <p>
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">怪異の種別</span>
                <br />
                <span className="text-base font-serif">{getCategoryDisplayName(openInfoEpisode.category)}</span>
              </p>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">体験内容の詳細</p>
              <p className="whitespace-pre-wrap text-base font-serif">{openInfoEpisode.content}</p>
              <p className="text-base text-zinc-700">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">体験時期</span>{' '}
                {formatEventDate(openInfoEpisode.event_date)}
              </p>
              <p className="text-base text-zinc-600">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">記録日</span>{' '}
                {formatDate(openInfoEpisode.created_at)}
              </p>
              {openInfoEpisode.city_name && openInfoEpisode.ward_name && (
                <p className="text-xs text-zinc-500">
                  表示位置: {openInfoEpisode.city_name}
                  {openInfoEpisode.ward_name}
                  （市区町村の代表地点）
                </p>
              )}
              {reportingEpisodeId !== openInfoEpisode.id ? (
                <p className="pt-1.5 text-xs text-zinc-500">
                  <button
                    type="button"
                    onClick={(ev) => handleOpenReport(openInfoEpisode.id, ev)}
                    className="underline hover:text-zinc-700"
                  >
                    この投稿を通報・削除依頼する
                  </button>
                </p>
              ) : (
                <ReportForm
                  episodeId={openInfoEpisode.id}
                  onSuccess={handleCloseReport}
                  onCancel={handleCloseReport}
                />
              )}
            </div>
          </div>
        )}
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
