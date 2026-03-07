'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, getCategoryDisplayName, type Episode } from '@/src/lib/supabase';

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? '';

type ReportRow = {
  id: string;
  episode_id: string;
  reason: string | null;
  details: string | null;
  created_at?: string;
  episode: Episode | null;
};

function contentPreview(content: string, maxLen: number): string {
  const t = content.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + '...';
}

export default function AdminReportsPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [list, setList] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handlePasswordSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (passwordInput === ADMIN_PASSWORD && ADMIN_PASSWORD) {
        setAuthenticated(true);
        setAccessDenied(false);
      } else {
        setAccessDenied(true);
      }
    },
    [passwordInput]
  );

  const fetchReports = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data: reportsData, error: reportsError } = await supabase
      .from('reports')
      .select('id, episode_id, reason, details, created_at')
      .order('created_at', { ascending: false });

    if (reportsError || !reportsData) {
      setList([]);
      setLoading(false);
      return;
    }

    const episodeIds = [...new Set((reportsData as { episode_id: string }[]).map((r) => r.episode_id))];
    let episodesMap: Record<string, Episode> = {};
    if (episodeIds.length > 0) {
      const { data: episodesData } = await supabase
        .from('episodes')
        .select('id, content, lat, lng, category, event_date, created_at')
        .in('id', episodeIds);
      if (episodesData) {
        episodesMap = (episodesData as Episode[]).reduce(
          (acc, ep) => {
            acc[ep.id] = ep;
            return acc;
          },
          {} as Record<string, Episode>
        );
      }
    }

    const rows: ReportRow[] = (reportsData as ReportRow[]).map((r) => ({
      ...r,
      episode: episodesMap[r.episode_id] ?? null,
    }));
    setList(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchReports();
  }, [authenticated, fetchReports]);

  // パスワード未認証: 入力フォームのみ表示（データは取得しない）
  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="w-full max-w-[320px] px-4">
          {accessDenied ? (
            <p className="text-center text-zinc-400">アクセス権限がありません</p>
          ) : (
            <>
              <p className="mb-4 text-center text-sm text-zinc-400">
                管理コードを入力してください
              </p>
              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="管理コード"
                  className="w-full border border-zinc-600 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                  autoFocus
                />
                <button
                  type="submit"
                  className="w-full border border-zinc-500 bg-zinc-800 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
                >
                  送信
                </button>
              </form>
            </>
          )}
          <p className="mt-6 text-center">
            <Link href="/" className="text-xs text-zinc-500 underline hover:text-zinc-400">
              トップへ戻る
            </Link>
          </p>
        </div>
      </div>
    );
  }
  const handleDeleteEpisode = useCallback(
    async (episodeId: string) => {
      if (!supabase) return;
      const ok = window.confirm('この投稿を削除しますか？削除すると元に戻せません。');
      if (!ok) return;
      setDeletingId(episodeId);
      const { error } = await supabase.from('episodes').delete().eq('id', episodeId);
      setDeletingId(null);
      if (error) {
        console.error('[Admin] 削除エラー:', error);
        alert('削除に失敗しました。');
        return;
      }
      await fetchReports();
    },
    [fetchReports]
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between border-b border-zinc-700 pb-4">
          <h1 className="text-xl font-semibold uppercase tracking-wider text-zinc-100">
            通報一覧（管理者）
          </h1>
          <Link
            href="/"
            className="text-sm text-zinc-400 underline hover:text-zinc-300"
          >
            トップへ戻る
          </Link>
        </div>

        {loading ? (
          <p className="py-8 text-zinc-500">読み込み中...</p>
        ) : list.length === 0 ? (
          <p className="py-8 text-zinc-500">通報はまだありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-xs font-medium uppercase tracking-wider text-zinc-400">
                  <th className="p-3">通報理由</th>
                  <th className="p-3">詳細（自由記述）</th>
                  <th className="p-3">対象投稿</th>
                  <th className="p-3 w-[140px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-800 hover:bg-zinc-900/50"
                  >
                    <td className="p-3 text-zinc-200">{row.reason ?? '—'}</td>
                    <td className="max-w-[280px] p-3 text-zinc-300 whitespace-pre-wrap">
                      {row.details?.trim() ? row.details : '—'}
                    </td>
                    <td className="p-3">
                      {row.episode ? (
                        <div className="space-y-1 text-zinc-300">
                          <p className="font-medium text-zinc-200">
                            {getCategoryDisplayName(row.episode.category)}
                          </p>
                          <p className="whitespace-pre-wrap text-zinc-400">
                            {contentPreview(row.episode.content, 120)}
                          </p>
                          <p className="text-xs text-zinc-500">
                            場所: {row.episode.lat.toFixed(5)}, {row.episode.lng.toFixed(5)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-zinc-500">（削除済み）</span>
                      )}
                    </td>
                    <td className="p-3">
                      {row.episode ? (
                        <button
                          type="button"
                          disabled={deletingId === row.episode.id}
                          onClick={() => handleDeleteEpisode(row.episode!.id)}
                          className="rounded border border-red-800 bg-red-900/50 px-3 py-2 text-xs font-medium text-red-200 hover:bg-red-900/70 disabled:opacity-50"
                        >
                          {deletingId === row.episode.id ? '削除中...' : 'この投稿を削除'}
                        </button>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
