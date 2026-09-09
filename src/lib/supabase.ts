import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// デバッグ用: createClient に渡している値が正しく読み込まれているか確認（原因特定後は削除推奨）
console.log('[supabase] NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);
console.log('[supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY (length):', supabaseAnonKey.length);
console.log('[supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY (先頭20文字):', supabaseAnonKey.slice(0, 20) + (supabaseAnonKey.length > 20 ? '...' : ''));

const isConfigured =
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/** 環境変数が正しくセットされているか。空の場合はエラーメッセージを返す */
export function getSupabaseError(): string | null {
  if (supabaseUrl.length === 0 && supabaseAnonKey.length === 0) {
    return '環境変数が設定されていません。.env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を追加してください。';
  }
  if (supabaseUrl.length === 0) {
    return 'NEXT_PUBLIC_SUPABASE_URL が設定されていません。.env.local を確認してください。';
  }
  if (supabaseAnonKey.length === 0) {
    return 'NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません。.env.local を確認し、開発サーバーを再起動してください。';
  }
  return null;
}

export type Episode = {
  id: string;
  content: string;
  lat: number;
  lng: number;
  category: string;
  event_date: string | null;
  created_at?: string;
};

/** 地図閲覧・一覧用。公開座標は latitude/longitude（なければ lat/lng） */
export type EpisodePublic = {
  id: string;
  content: string;
  category: string;
  event_date: string | null;
  created_at?: string;
  city_name: string | null;
  ward_name: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  actual_latitude?: number | null;
  actual_longitude?: number | null;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function episodeBodyText(ep: {
  content?: string | null;
  story?: string | null;
}): string {
  return String(ep.content ?? ep.story ?? '');
}

/** 公開ピン座標: SPEC の latitude/longitude を優先し、旧カラム lat/lng にフォールバック */
export function episodePublicLatLng(ep: EpisodePublic): { lat: number; lng: number } | null {
  const lat = toFiniteNumber(ep.latitude) ?? toFiniteNumber(ep.lat);
  const lng = toFiniteNumber(ep.longitude) ?? toFiniteNumber(ep.lng);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

export function resolveEpisodePosition(
  ep: EpisodePublic,
  isAdmin: boolean
): { lat: number; lng: number } | null {
  if (isAdmin) {
    const alat = toFiniteNumber(ep.actual_latitude);
    const alng = toFiniteNumber(ep.actual_longitude);
    if (alat != null && alng != null) return { lat: alat, lng: alng };
  }
  return episodePublicLatLng(ep);
}

function normalizeEpisodeRow(row: Record<string, unknown>): EpisodePublic {
  const yearRaw = row.year;
  const year =
    typeof yearRaw === 'string' || typeof yearRaw === 'number' ? String(yearRaw) : '';
  const eventDate =
    (typeof row.event_date === 'string' && row.event_date) ||
    (/^\d{4}$/.test(year) ? `${year}-01-01` : null);
  const address = typeof row.address === 'string' ? row.address : null;
  return {
    id: String(row.id),
    content: episodeBodyText(row as { content?: string | null; story?: string | null }),
    category: row.category != null ? String(row.category) : '',
    event_date: eventDate,
    created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
    city_name: row.city_name != null ? String(row.city_name) : address,
    ward_name: row.ward_name != null ? String(row.ward_name) : null,
    latitude: toFiniteNumber(row.latitude),
    longitude: toFiniteNumber(row.longitude),
    lat: toFiniteNumber(row.lat),
    lng: toFiniteNumber(row.lng),
    actual_latitude: toFiniteNumber(row.actual_latitude),
    actual_longitude: toFiniteNumber(row.actual_longitude),
  };
}

const EPISODE_SELECTS = [
  'id, content, story, category, event_date, year, created_at, city_name, ward_name, address, latitude, longitude, lat, lng',
  'id, content, category, event_date, created_at, city_name, ward_name, latitude, longitude',
  'id, content, category, event_date, created_at, city_name, ward_name, lat, lng',
  'id, content, category, event_date, created_at, city_name, ward_name',
] as const;

/** episodes テーブルから地図用投稿を取得（スキーマ差を吸収） */
export async function fetchMapEpisodes(isAdmin: boolean): Promise<EpisodePublic[]> {
  if (!supabase) return [];
  const adminVariants = isAdmin
    ? [', actual_latitude, actual_longitude', '']
    : [''];
  for (const adminCols of adminVariants) {
    for (const cols of EPISODE_SELECTS) {
      const query = `${cols}${adminCols}`;
      const { data, error } = await supabase
        .from('episodes')
        .select(query as '*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        const rows = (data as unknown as Record<string, unknown>[]).map(normalizeEpisodeRow);
        console.log('[episodes] select 成功:', query, '件数:', rows.length);
        return rows;
      }
      if (error) {
        console.warn('[episodes] select 失敗、次のカラムセットを試します:', query, error.message);
      }
    }
  }
  return [];
}

export const EPISODE_CATEGORIES = [
  { value: '不思議な体験', label: '🌫️ 不思議な体験' },
  { value: '心霊現象', label: '👻 心霊現象' },
  { value: '命の危機', label: '⚠️ 命の危機' },
  { value: '違和感', label: '👁️ 違和感' },
] as const;

/** カテゴリーの値から表示用ラベル（絵文字付き）を返す */
export function getCategoryDisplayName(category: string): string {
  const found = EPISODE_CATEGORIES.find((c) => c.value === category);
  return found ? found.label : category;
}

/** 最新のエピソードを取得 */
export async function getLatestEpisodes(
  limit: number
): Promise<EpisodePublic[]> {
  const all = await fetchMapEpisodes(false);
  return all.slice(0, limit);
}
