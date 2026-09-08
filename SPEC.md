# 【技術仕様書】実録・怪談アーカイブマップ（[SPEC.md](http://SPEC.md)）

## 1. システム概要 & 技術スタック

- Framework: Next.js (App Router, TypeScript, Tailwind CSS)
- Database / Backend: Supabase (PostgreSQL)
- Map Engine: Mapbox GL JS (ダークテーマ)
- Geocoding: Mapbox Geocoding API (町名・丁目レベル取得)

## 2. 画面構成 & ルーティング

- `/` : ランディングページ（単一CTA「怪談マップに入る」で `/map` へ誘導）
- `/map` : 統合マップ画面（Mapbox地図、ピン閲覧、地域ドロワー、即時投稿、ログイン、マイページ）
- `/admin/map` : 実座標プロットマップ`actual_latitude`, `actual_longitude` 表示 / AdminGuard保護）
- `/admin/reports` : 通報管理画面（通報投稿の非表示・削除 / AdminGuard保護）

## 3. データベース設計要件

- `posts` テーブル:
  - `id`: int8 generated always as identity primary key（UI表示は `#001` 形式）
  - `user_id`: uuid nullable（未ログイン投稿を許容）
  - `category`: text not null
  - `event_year`: text not null（4桁西暦）
  - `content`: text not null
  - `lat`, `lng`: float8 not null（公開用：町名・丁目代表座標）
  - `actual_latitude`, `actual_longitude`: float8 not null（実座標）
  - `pref_name`, `city_name`, `town_name`: text（住所情報）
  - `like_count`: int4 default 0 not null
  - `is_deleted`: boolean default false not null
- `users` テーブル:
  - `id`: uuid default gen_random_uuid() primary key
  - `username`: text unique not null（メアド不要）
  - `password_hash`: text not null
- `likes` テーブル:
  - `id`: uuid default gen_random_uuid() primary key
  - `user_id`: uuid references public.users(id) on delete cascade
  - `post_id`: int8 references public.posts(id) on delete cascade
  - `unique(user_id, post_id)`



## 4. UI/UX & 実装ルール

- 地図空きエリアタップで即時投稿フォーム（自前 `div` オーバーレイ）表示。
- Google Maps / Mapbox 標準のポップアップは使用禁止（フォーカス喪失バグ防止のため独立自前UI限定）。
- 体験時期（年）は全角→半角変換、数字以外除去、4桁超過即時カット`slice(0, 4)`）。
- ピンタップ時はサイドメニュー（ドロワー）で地域内エピソードを展開（「最新順」「いいね順」ソート）。
- 管理画面は `ADMIN_PASSWORD` と Cookie による認証を維持。

