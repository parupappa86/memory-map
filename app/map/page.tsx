'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

const MapView = dynamic(() => import('../MapView'), { ssr: false });
const SITE_TITLE = 'みんなのぞっとする話マップ';

export default function MapPage() {
  return (
    <div className="flex h-screen w-screen flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        <Link href="/" className="text-lg font-medium tracking-tight text-zinc-900 hover:text-zinc-600">
          {SITE_TITLE}
        </Link>
        <p className="text-xs text-zinc-500">閲覧・投稿をこのページで行えます</p>
      </header>
      <main className="min-h-0 flex-1">
        <MapView mode="post" />
      </main>
    </div>
  );
}
