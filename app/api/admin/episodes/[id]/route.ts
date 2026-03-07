import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminCookie } from '@/src/lib/admin-auth';
import { supabase } from '@/src/lib/supabase';

/** 管理者セッションを検証し、指定した episode を削除（サーバー専用） */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieHeader = _request.headers.get('cookie');
  if (!verifyAdminCookie(cookieHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Service Unavailable' }, { status: 503 });
  }

  const { error } = await supabase.from('episodes').delete().eq('id', id);

  if (error) {
    console.error('[Admin API] 削除エラー:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
