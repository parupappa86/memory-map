import Link from 'next/link';
import { getLatestEpisodes } from '@/src/lib/supabase';
import { getLocationLabel } from '@/src/lib/geocode';

const SITE_TITLE = 'みんなのぞっとする話マップ';
const SUBTITLE = '日本全国・怪異地点録';
const CONCEPT =
  'その場所には、かつて誰かが震えた記憶がある。日本中の有志から寄せられた、実録の恐怖体験を地図上にアーカイブ。';

const PREVIEW_LEN = 18;

function contentPreview(content: string): string {
  const t = content.replace(/\s+/g, ' ').trim();
  if (t.length <= PREVIEW_LEN) return t;
  return t.slice(0, PREVIEW_LEN) + '...';
}

async function LatestEpisodesList() {
  const episodes = await getLatestEpisodes(5);
  if (episodes.length === 0) {
    return (
      <p className="text-lg text-zinc-500">まだ投稿はありません。</p>
    );
  }

  const items: { episode: (typeof episodes)[0]; locationLabel: string }[] = [];
  for (let i = 0; i < episodes.length; i++) {
    const locationLabel = await getLocationLabel(episodes[i].lat, episodes[i].lng);
    items.push({ episode: episodes[i], locationLabel });
    if (i < episodes.length - 1) {
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  return (
    <ul className="space-y-2.5 border-t border-zinc-200 pt-4">
      {items.map(({ episode, locationLabel }) => (
        <li key={episode.id} className="text-lg leading-relaxed text-zinc-700">
          【{locationLabel}】{contentPreview(episode.content)}
        </li>
      ))}
    </ul>
  );
}

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

        <section className="mt-10">
          <h2 className="text-lg font-medium uppercase tracking-wider text-zinc-500">
            最新の投稿
          </h2>
          <div className="mt-3">
            <LatestEpisodesList />
          </div>
        </section>

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

        <div className="mt-12">
          <Link
            href="/map"
            className="inline-block w-full border-2 border-zinc-900 bg-zinc-900 px-6 py-4 text-center text-[1.1rem] font-medium text-white transition-colors hover:bg-zinc-800 sm:w-auto sm:min-w-[280px]"
          >
            地図から探す・投稿する
          </Link>
        </div>
      </div>
    </div>
  );
}
