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

/** 最新のエピソードを取得（サーバー・クライアント両方で利用可能） */
export async function getLatestEpisodes(
  limit: number
): Promise<Episode[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('episodes')
    .select('id, content, lat, lng, category, event_date, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as Episode[];
}
