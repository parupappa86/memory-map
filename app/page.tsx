'use client';

import Link from 'next/link';

const SITE_TITLE = 'みんなのぞっとする話マップ';
const SUBTITLE = '日本全国・怪異地点録';
const CONCEPT =
  'その場所には、かつて誰かが震えた記憶がある。日本中の有志から寄せられた、実録の恐怖体験を地図上にアーカイブ。';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[1.75rem]">
          {SITE_TITLE}
        </h1>
        <p className="mt-1.5 text-lg text-zinc-600">{SUBTITLE}</p>

        <p className="mt-8 text-[1.1rem] leading-relaxed text-zinc-700 font-serif">
          {CONCEPT}
        </p>

        <section className="mt-10 rounded border border-zinc-200 bg-zinc-100 px-4 py-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-600">
            ご利用にあたっての免責事項
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-700">
            <li>・本サイトの記録は投稿者の主観に基づくものであり、事実を保証するものではありません。</li>
            <li>・記録地点への無断侵入、周辺住民への迷惑行為は固く禁じます。</li>
            <li>・本サイトの利用により生じた損害について、管理者は一切の責任を負いません。</li>
          </ul>
        </section>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/map"
            className="inline-block w-full border-2 border-zinc-900 bg-zinc-900 px-6 py-4 text-center text-[1.1rem] font-medium text-white transition-colors hover:bg-zinc-800 sm:w-auto sm:min-w-[240px]"
          >
            地図を見る
          </Link>
          <Link
            href="/map"
            className="inline-block w-full border-2 border-zinc-300 bg-white px-6 py-4 text-center text-[1.1rem] font-medium text-zinc-900 transition-colors hover:border-zinc-500 hover:bg-zinc-50 sm:w-auto sm:min-w-[240px]"
          >
            体験を投稿する
          </Link>
        </div>
      </div>
    </div>
  );
}
