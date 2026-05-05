'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

const MapView = dynamic(() => import('../MapView'), { ssr: false });

const SITE_TITLE = 'みんなのぞっとする話マップ';

export default function MapPage() {
  return (
    <div className="flex h-screen w-screen flex-col bg-white">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <Link
            href="/"
            className="text-lg font-medium tracking-tight text-zinc-900 hover:text-zinc-600"
          >
            {SITE_TITLE}
          </Link>
          <p className="text-xs text-zinc-500">地図の閲覧と投稿はこのページで行えます。</p>
        </div>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/" className="text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline">
            トップへ
          </Link>
        </nav>
      </header>
      <main className="min-h-0 flex-1">
        <div className="h-full w-full">
          <MapView mode="post" />
        </div>
      </main>
    </div>
  );
}
