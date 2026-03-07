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
      <p className="text-sm text-zinc-500">まだ投稿はありません。</p>
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
    <ul className="space-y-2 border-t border-zinc-200 pt-4">
      {items.map(({ episode, locationLabel }) => (
        <li key={episode.id} className="text-sm text-zinc-700">
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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          {SITE_TITLE}
        </h1>
        <p className="mt-1 text-base text-zinc-600">{SUBTITLE}</p>

        <p className="mt-8 leading-relaxed text-zinc-700">
          {CONCEPT}
        </p>

        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            最新の投稿
          </h2>
          <div className="mt-3">
            <LatestEpisodesList />
          </div>
        </section>

        <div className="mt-12">
          <Link
            href="/map"
            className="inline-block w-full border-2 border-zinc-900 bg-zinc-900 px-6 py-4 text-center text-base font-medium text-white transition-colors hover:bg-zinc-800 sm:w-auto sm:min-w-[280px]"
          >
            地図から探す・投稿する
          </Link>
        </div>
      </div>
    </div>
  );
}
