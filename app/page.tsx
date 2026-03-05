'use client';

import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

export default function Home() {
  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden">
      <MapView />
    </div>
  );
}
