/**
 * 緯度・経度から都道府県・市区町村を取得（Nominatim 逆ジオコーディング）
 * 利用ポリシー: https://operations.osmfoundation.org/policies/nominatim/ に従い 1 リクエスト/秒を推奨
 */
export async function getLocationLabel(
  lat: number,
  lng: number
): Promise<string> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('zoom', '10');

    const res = await fetch(url.toString(), {
      headers: {
        'Accept-Language': 'ja',
        'User-Agent': 'MemoryMapApp/1.0 (contact@example.com)',
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return '地図で確認';

    const data = (await res.json()) as {
      address?: {
        state?: string;
        prefecture?: string;
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
      };
    };
    const addr = data?.address;
    if (!addr) return '地図で確認';

    const prefecture = addr.state ?? addr.prefecture ?? '';
    const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? '';
    const parts = [prefecture, city].filter(Boolean);
    return parts.length > 0 ? parts.join('・') : '地図で確認';
  } catch {
    return '地図で確認';
  }
}
