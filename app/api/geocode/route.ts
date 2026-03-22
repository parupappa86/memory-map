import { NextRequest, NextResponse } from 'next/server';

type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GeocodeResult = {
  results?: {
    address_components?: AddressComponent[];
  }[];
  status?: string;
  error_message?: string;
};

/** 都道府県＋市区町村まで（city_name）。町丁名は返さず ward_name は常に null（プライバシー）。失敗時は null を返し投稿は可能にする */
export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat');
  const lng = request.nextUrl.searchParams.get('lng');
  const latNum = lat ? parseFloat(lat) : NaN;
  const lngNum = lng ? parseFloat(lng) : NaN;
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
    return NextResponse.json({ city_name: null, ward_name: null });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  if (!apiKey) {
    console.warn('[geocode] GOOGLE_MAPS_API_KEY が未設定です');
    return NextResponse.json({ city_name: null, ward_name: null });
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${latNum},${lngNum}`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', 'ja');

    const res = await fetch(url.toString());
    const data = (await res.json()) as GeocodeResult;

    if (data.status !== 'OK' || !data.results?.[0]?.address_components) {
      if (data.status !== 'ZERO_RESULTS') {
        console.warn('[geocode] 結果なしまたはエラー:', data.status, data.error_message);
      }
      return NextResponse.json({ city_name: null, ward_name: null });
    }

    const components = data.results[0].address_components;

    let prefecture: string | null = null;
    let municipality: string | null = null;

    for (const c of components) {
      if (c.types.includes('administrative_area_level_1')) {
        prefecture = c.long_name || null;
      }
      if (c.types.includes('locality')) {
        municipality = c.long_name || null;
      }
    }
    if (!municipality) {
      const admin2 = components.find((c) => c.types.includes('administrative_area_level_2'));
      if (admin2) municipality = admin2.long_name || null;
    }

    /** 「都道府県 ＋ 市区町村」（例：東京都中野区） */
    let city_name: string | null = null;
    if (prefecture && municipality) {
      city_name = `${prefecture}${municipality}`;
    } else if (prefecture) {
      city_name = prefecture;
    } else if (municipality) {
      city_name = municipality;
    }

    return NextResponse.json({ city_name, ward_name: null });
  } catch (err) {
    console.error('[geocode] 逆ジオコード失敗:', err);
    return NextResponse.json({ city_name: null, ward_name: null });
  }
}
