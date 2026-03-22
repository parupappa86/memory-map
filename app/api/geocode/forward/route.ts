import { NextRequest, NextResponse } from 'next/server';

type GeocodeResult = {
  results?: { geometry?: { location?: { lat: number; lng: number } } }[];
  status?: string;
  error_message?: string;
};

/** 市区町村レベルの代表地点（正ジオコーディング）。閲覧用のおおよその座標のみ返す */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q) {
    return NextResponse.json({ lat: null, lng: null });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  if (!apiKey) {
    console.warn('[geocode/forward] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY が未設定です');
    return NextResponse.json({ lat: null, lng: null });
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', q);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', 'ja');
    url.searchParams.set('region', 'jp');

    const res = await fetch(url.toString());
    const data = (await res.json()) as GeocodeResult;

    if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
      if (data.status !== 'ZERO_RESULTS') {
        console.warn('[geocode/forward] 結果なしまたはエラー:', data.status, data.error_message);
      }
      return NextResponse.json({ lat: null, lng: null });
    }

    const loc = data.results[0].geometry.location;
    return NextResponse.json({ lat: loc.lat, lng: loc.lng });
  } catch (err) {
    console.error('[geocode/forward] 失敗:', err);
    return NextResponse.json({ lat: null, lng: null });
  }
}
