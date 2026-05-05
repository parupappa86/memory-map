'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import AdminGuard from '@/app/admin/_components/AdminGuard';

const MapView = dynamic(() => import('../../MapView'), { ssr: false });
const SITE_TITLE = 'みんなのぞっとする話マップ';

export default function AdminMapPage() {
  return (
    <AdminGuard>
      <div className="flex h-screen w-screen flex-col bg-white">
        <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
          <Link href="/" className="text-lg font-medium tracking-tight text-zinc-900 hover:text-zinc-600">
            {SITE_TITLE}
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/admin/reports" className="text-zinc-600 underline hover:text-zinc-900">
              通報管理へ
            </Link>
            <p className="text-xs text-zinc-500">管理者用マップ（実座標表示）</p>
          </div>
        </header>
        <main className="min-h-0 flex-1">
          {/* TODO: 将来的に Supabase Auth などで /admin 配下を包括保護する */}
          <MapView mode="post" isAdmin />
        </main>
      </div>
    </AdminGuard>
  );
}
