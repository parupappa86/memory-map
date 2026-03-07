import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminCookie } from '@/src/lib/admin-auth';
import { supabase } from '@/src/lib/supabase';
import type { Episode } from '@/src/lib/supabase';

export type ReportRow = {
  id: string;
  episode_id: string;
  reason: string | null;
  details: string | null;
  created_at?: string;
  episode: Episode | null;
};

/** 管理者セッションを検証し、通報一覧を返す（サーバー専用） */
export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie');
  if (!verifyAdminCookie(cookieHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Service Unavailable' }, { status: 503 });
  }

  // Left Join 相当: 通報は必ず返し、episodes はあれば付与（Supabase の embed を利用）
  const { data: rawReports, error: reportsError } = await supabase
    .from('reports')
    .select('id, episode_id, reason, details, created_at, episodes(id, content, lat, lng, category, event_date, created_at)')
    .order('created_at', { ascending: false });

  if (reportsError) {
    console.error('[GET /api/admin/reports] Supabase reports 取得エラー:', reportsError.message, reportsError.code, reportsError.details);
    // embed が使えない場合のフォールバック: reports のみ取得し、episodes は別クエリで取得
    const fallback = await getReportsWithEpisodesFallback();
    return NextResponse.json({ list: fallback });
  }

  console.log('Raw Reports:', rawReports);

  // Supabase の embed は episode(s) をオブジェクト or 配列 or null で返すことがあるため正規化
  const list: ReportRow[] = (rawReports ?? []).map((row: Record<string, unknown>) => {
    const episodeRaw = row.episodes ?? row.episode;
    let episode: Episode | null = null;
    if (episodeRaw && typeof episodeRaw === 'object' && !Array.isArray(episodeRaw) && 'id' in episodeRaw) {
      episode = episodeRaw as Episode;
    } else if (Array.isArray(episodeRaw) && episodeRaw.length > 0 && episodeRaw[0] && typeof episodeRaw[0] === 'object' && 'id' in episodeRaw[0]) {
      episode = episodeRaw[0] as Episode;
    }
    return {
      id: row.id,
      episode_id: row.episode_id,
      reason: row.reason ?? null,
      details: row.details ?? null,
      created_at: row.created_at,
      episode,
    } as ReportRow;
  });

  return NextResponse.json({ list });
}

/** embed が使えない場合: reports を単体取得し、episodes を別クエリで Left Join 相当に結合 */
async function getReportsWithEpisodesFallback(): Promise<ReportRow[]> {
  if (!supabase) return [];

  const { data: reportsData, error: reportsError } = await supabase
    .from('reports')
    .select('id, episode_id, reason, details, created_at')
    .order('created_at', { ascending: false });

  if (reportsError) {
    console.error('[GET /api/admin/reports] fallback reports 取得エラー:', reportsError.message, reportsError.code, reportsError.details);
    return [];
  }

  console.log('Raw Reports (fallback):', reportsData);

  const rows = (reportsData ?? []) as { id: string; episode_id: string; reason: string | null; details: string | null; created_at?: string }[];
  const episodeIds = [...new Set(rows.map((r) => r.episode_id).filter(Boolean))];
  let episodesMap: Record<string, Episode> = {};

  if (episodeIds.length > 0) {
    const { data: episodesData, error: episodesError } = await supabase
      .from('episodes')
      .select('id, content, lat, lng, category, event_date, created_at')
      .in('id', episodeIds);

    if (episodesError) {
      console.error('[GET /api/admin/reports] fallback episodes 取得エラー:', episodesError.message, episodesError.code, episodesError.details);
    }
    if (episodesData && Array.isArray(episodesData)) {
      episodesMap = (episodesData as Episode[]).reduce(
        (acc, ep) => {
          acc[ep.id] = ep;
          return acc;
        },
        {} as Record<string, Episode>
      );
    }
  }

  return rows.map((r) => ({
    ...r,
    episode: episodesMap[r.episode_id] ?? null,
  }));
}
