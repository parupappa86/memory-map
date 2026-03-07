import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { buildAdminSetCookie } from '@/src/lib/admin-auth';

/** サーバー側でパスワードを照合し、一致時のみセッション Cookie を発行する */
export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  const expectedHash = createHash('sha256').update(adminPassword).digest();
  const receivedHash = createHash('sha256').update(password).digest();

  if (expectedHash.length !== receivedHash.length || !timingSafeEqual(expectedHash, receivedHash)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', buildAdminSetCookie());
  return response;
}
