'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getCategoryDisplayName } from '@/src/lib/supabase';
import type { ReportRow } from '@/app/api/admin/reports/route';
import AdminGuard from '@/app/admin/_components/AdminGuard';

function contentPreview(content: string, maxLen: number): string {
  const t = content.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + '...';
}

function formatPostNumber(id: string): string {
  return `#${String(id).padStart(3, '0')}`;
}

export default function AdminReportsPage() {
  const [list, setList] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/reports', { credentials: 'include' });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setList(data.list ?? []);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleDeleteEpisode = useCallback(
    async (episodeId: string) => {
      const ok = window.confirm('この投稿を削除しますか？削除すると元に戻せません。');
      if (!ok) return;
      setDeletingId(episodeId);
      const res = await fetch(`/api/admin/episodes/${episodeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setDeletingId(null);
      if (!res.ok) {
        alert('削除に失敗しました。');
        return;
      }
      const reportsRes = await fetch('/api/admin/reports', { credentials: 'include' });
      if (reportsRes.ok) {
        const data = await reportsRes.json();
        setList(data.list ?? []);
      }
    },
    []
  );

  return (
    <AdminGuard>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between border-b border-zinc-700 pb-4">
            <h1 className="text-xl font-semibold uppercase tracking-wider text-zinc-100">
              通報一覧（管理者）
            </h1>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/admin/map" className="text-zinc-400 underline hover:text-zinc-300">
                管理者マップへ
              </Link>
              <Link href="/" className="text-zinc-400 underline hover:text-zinc-300">
                トップへ戻る
              </Link>
            </div>
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
                              {getCategoryDisplayName(row.episode.category)}{' '}
                              <span className="text-zinc-400">{formatPostNumber(row.episode.id)}</span>
                            </p>
                            <p className="whitespace-pre-wrap text-zinc-400">
                              {contentPreview(row.episode.content, 120)}
                            </p>
                            <p className="text-xs text-zinc-500">
                              場所: {row.episode.lat.toFixed(5)}, {row.episode.lng.toFixed(5)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-zinc-500">（削除済みの投稿への通報）</span>
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
    </AdminGuard>
  );
}
