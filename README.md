# haubook

1週間の収支を記録して集計する家計簿アプリ(PWA)です。

- 公開 URL: https://taro26022.github.io/haubook/
- データはその端末のブラウザの中だけに保存されます。サーバーには送信しません。
- 仕様: [docs/spec.md](docs/spec.md)

## iPhone での使い方

1. Safari で公開 URL を開く
2. 共有ボタン(□に↑)→「ホーム画面に追加」→「追加」
3. ホーム画面の「家計簿」アイコンから開く

データが端末にしかないため、設定画面の「JSON ファイルに書き出す」でときどきバックアップしてください。

## 構成

| パス | 内容 |
|---|---|
| `index.html` | 画面 |
| `css/style.css` | 見た目 |
| `js/app.js` | 画面の表示と操作 |
| `js/db.js` | 端末内の保存(IndexedDB) |
| `js/date.js`、`js/format.js`、`js/summary.js`、`js/backup.js` | 日付、金額、週の集計、バックアップの処理 |
| `js/defaults.js` | 初期カテゴリ |
| `sw.js`、`manifest.webmanifest` | オフライン対応とホーム画面への追加 |
| `tests/` | テスト(ブラウザで開くと実行される) |
| `tools/make_icons.py` | アイコンの生成 |

ビルドは不要です。ファイルをそのまま GitHub Pages で公開しています。
