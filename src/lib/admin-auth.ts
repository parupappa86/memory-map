import { createHmac } from 'crypto';

const COOKIE_NAME = 'admin_session';
const COOKIE_MAX_AGE = 86400; // 24時間

/** サーバー専用: 正しいパスワードから期待されるセッショントークンを生成 */
function getExpectedToken(): string {
  const secret = process.env.ADMIN_PASSWORD ?? '';
  return createHmac('sha256', secret).update('admin-session').digest('hex');
}

/** リクエストの Cookie が有効な管理者セッションか検証（サーバー専用） */
export function verifyAdminCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader || !process.env.ADMIN_PASSWORD) return false;
  const expected = getExpectedToken();
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const value = match?.[1]?.trim();
  if (!value || value.length !== expected.length) return false;
  try {
    const bufA = Buffer.from(value, 'hex');
    const bufB = Buffer.from(expected, 'hex');
    return bufA.length === bufB.length && bufA.equals(bufB);
  } catch {
    return false;
  }
}

/** レスポンスに管理者セッション Cookie を付与するための Set-Cookie ヘッダー値（サーバー専用） */
export function buildAdminSetCookie(): string {
  const token = getExpectedToken();
  const isProd = process.env.NODE_ENV === 'production';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}${isProd ? '; Secure' : ''}`;
}
