'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

const SITE_TITLE = 'みんなのぞっとする話マップ';
const SUBTITLE = '日本全国・怪異地点録';
const MapView = dynamic(() => import('./MapView'), { ssr: false });

export default function HomePage() {
  return (
    <div className="flex h-screen w-screen flex-col bg-white">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">{SITE_TITLE}</h1>
          <p className="text-sm text-zinc-600">{SUBTITLE}</p>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/map" className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline">
            閲覧専用ページ
          </Link>
        </nav>
      </header>
      <main className="min-h-0 flex-1">
        <MapView mode="post" />
      </main>
      <div className="shrink-0 border-t border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-600">
        地図上をクリックして投稿地点を選択し、フォームに体験内容を入力してください。
      </div>
    </div>
  );
}
