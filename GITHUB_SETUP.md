# GitHub へのアップロード手順

このプロジェクトを新しい GitHub リポジトリにプッシュする手順です。

---

## 事前準備

### 1. Git のインストール

まだの場合は [Git for Windows](https://git-scm.com/download/win) をダウンロードしてインストールし、インストール後は **ターミナル（PowerShell や CMD）を一度閉じて開き直してください**。

### 2. GitHub アカウント

[GitHub](https://github.com/) にサインアップまたはログインしておいてください。

---

## 手順

### ステップ 1: リポジトリの初期化（プロジェクトフォルダで実行）

```bash
cd c:\memory-map
git init
```

### ステップ 2: 全ファイルをステージング

```bash
git add .
```

### ステップ 3: 初回コミット

```bash
git commit -m "Initial commit: memory-map (Leaflet + Supabase)"
```

### ステップ 4: デフォルトブランチ名を main にする（推奨）

```bash
git branch -M main
```

### ステップ 5: GitHub で新しいリポジトリを作成

1. [GitHub](https://github.com/) にログイン
2. 右上の **「+」** → **「New repository」**
3. **Repository name** に `memory-map` など好きな名前を入力
4. **Public** を選択
5. **「Add a README file」** や **「Add .gitignore」** は**チェックしない**（既にローカルにあるため）
6. **「Create repository」** をクリック

### ステップ 6: リモートを追加してプッシュ

GitHub の作成後、表示される **リポジトリの URL** を使います。

- HTTPS の場合（例）: `https://github.com/あなたのユーザー名/memory-map.git`
- SSH の場合（例）: `git@github.com:あなたのユーザー名/memory-map.git`

```bash
git remote add origin https://github.com/あなたのユーザー名/memory-map.git
git push -u origin main
```

- **HTTPS** のとき: 初回プッシュで GitHub のユーザー名とパスワード（または Personal Access Token）の入力が求められます。
- **SSH** のとき: あらかじめ [SSH キーを GitHub に登録](https://docs.github.com/ja/authentication/connecting-to-github-with-ssh)しておく必要があります。

---

## 注意事項

- **`.env.local`** は `.gitignore` で除外されているため、**GitHub には送信されません**（セキュリティ上そのままで問題ありません）。別の PC や Vercel などで動かすときは、同じ環境変数をその環境で設定してください。
- GitHub で「New repository」作成時に README を追加してしまった場合は、先に `git pull origin main --allow-unrelated-histories` してから `git push` するか、GitHub 側の README を削除してから上記のプッシュを行ってください。

---

## よく使うコマンド（参考）

| 操作           | コマンド |
|----------------|----------|
| 状態確認       | `git status` |
| 変更を追加     | `git add .` または `git add ファイル名` |
| コミット       | `git commit -m "メッセージ"` |
| プッシュ       | `git push` |
| リモート確認   | `git remote -v` |
