'use client';

import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

export default function HomePage() {
  return (
    <main className="h-screen w-screen bg-white">
      <MapView mode="post" />
    </main>
  );
}
