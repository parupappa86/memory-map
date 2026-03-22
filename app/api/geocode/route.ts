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

/**
 * city_name: 都道府県のみ（administrative_area_level_1）
 * ward_name: 市区町村のみ（locality、なければ sublocality_level_1 ※区など）
 * それより細かい住所（町名・番地等）は取得しない（プライバシー）
 */
export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat');
  const lng = request.nextUrl.searchParams.get('lng');
  const latNum = lat ? parseFloat(lat) : NaN;
  const lngNum = lng ? parseFloat(lng) : NaN;
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
    return NextResponse.json({ city_name: null, ward_name: null });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  if (!apiKey) {
    console.warn('[geocode] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY が未設定です');
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

    let city_name: string | null = null;
    let ward_name: string | null = null;

    for (const c of components) {
      if (c.types.includes('administrative_area_level_1')) {
        city_name = c.long_name || null;
      }
      if (c.types.includes('locality')) {
        ward_name = c.long_name || null;
      }
    }
    if (!ward_name) {
      const sub1 = components.find((c) => c.types.includes('sublocality_level_1'));
      if (sub1) ward_name = sub1.long_name || null;
    }

    return NextResponse.json({ city_name, ward_name });
  } catch (err) {
    console.error('[geocode] 逆ジオコード失敗:', err);
    return NextResponse.json({ city_name: null, ward_name: null });
  }
}
