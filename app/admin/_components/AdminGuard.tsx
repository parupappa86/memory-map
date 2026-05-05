'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const checkAuth = useCallback(async () => {
    const res = await fetch('/api/admin/reports', { credentials: 'include' });
    setAuthenticated(res.ok);
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handlePasswordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setAccessDenied(false);
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: passwordInput }),
      });
      if (res.ok) {
        setAuthenticated(true);
        setPasswordInput('');
      } else {
        setAccessDenied(true);
      }
    },
    [passwordInput]
  );

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-500">確認中...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="w-full max-w-[320px] px-4">
          {accessDenied ? (
            <p className="text-center text-zinc-400">アクセス権限がありません</p>
          ) : (
            <>
              <p className="mb-4 text-center text-sm text-zinc-400">
                管理コードを入力してください
              </p>
              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="管理コード"
                  className="w-full border border-zinc-600 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                  autoFocus
                />
                <button
                  type="submit"
                  className="w-full border border-zinc-500 bg-zinc-800 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
                >
                  送信
                </button>
              </form>
            </>
          )}
          <p className="mt-6 text-center">
            <Link href="/" className="text-xs text-zinc-500 underline hover:text-zinc-400">
              トップへ戻る
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
