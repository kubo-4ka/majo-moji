# 魔女文字練習帳

アニメ『魔法少女まどか ☆ マギカ』シリーズに登場する「魔女文字」を、一覧・クイズ・変換で練習できる静的 Web アプリです。
HTML / CSS / JavaScript のみで動作します。

## DEMO

https://kubo-4ka.github.io/majo-moji/

## 免責事項

本アプリは『魔法少女まどか ☆ マギカ』を題材にした**非公式のファンメイド作品**です。
原作者・制作会社・その他の権利者様とは一切関係ありません。権利者様への本アプリに関するお問い合わせはご遠慮ください。

## 機能

画面下のメニューで 6 つの画面を切り替えます。

- **クイズ**（5／10／20／30／50 問／全部）
  - 文字を読む・文字を探す：1 文字ずつの対応
  - 言葉を読む：名前・作中の文を 4 択で
  - 書き取り：画面上のキーボード（A〜Z・Ä・Ö・Ü・ß）で入力。Ä は AE、ß は SS でも可
  - 瞬間読み：一瞬だけ表示される魔女文字を読む（表示時間は設定可）
  - 予測読み：前半だけ見えている文から全体を推測する
  - 言語を見分ける：一瞬映る魔女文字がドイツ語・英語・ローマ字・その他のどれかを当てる
  - クイズ中はヘッダーとメニューを隠し、スマホでもスクロールせずに進められるレイアウト
  - 「正解したら自動で次へ」オプション、答えたあとは問題部分のタップでも次へ
  - 間違えた文字・言葉を多めに出題、結果画面から「間違えた問題だけ」再挑戦
  - 作中の文は、作中と同じ書体（Modern・Musical など）で出題（設定で切替）
- **文字**：Archaic／Modern／Musical／Latin の 4 書体、数字・記号
- **収録**：出題される言葉と文の全件。範囲ごとに折りたたみ、検索、「読みを隠す」、言語バッジ
- **変換**：入力した文字列を魔女文字で表示
- **図鑑**：魔女の紹介文を魔女文字だけで読む長文読解（ローマ字版／英語版、日本語訳の有無、書体を選択。行をタップで読みを表示）
- **説明**：ネタバレの注意、使い方、書体、インストール方法、出典、免責事項
- ホーム画面に追加してアプリとして使える（PWA）。オフラインで動くのは https:// で配信した場合のみ（Service Worker は安全なコンテキストでしか動かないため、LAN 内の http:// ではキャッシュされません）
- ライト／ダークテーマ（初回は OS の設定に従う）

見つかっていない文字（Modern の P・V・X、Musical の J・Q・W・X、Latin と Musical の Ä・Ö・Ü・ß）は、言葉の中では Archaic 体で代用して薄く表示します。1 文字クイズでは、その書体にある文字だけを出題します。

## ファイル構成

| ファイル                                    | 内容                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `index.html`                                | 画面                                                                                           |
| `style.css`                                 | デザイン（色は `:root` のトークンで管理）                                                      |
| `app.js`                                    | アプリ本体                                                                                     |
| `data.js`                                   | 収録データ（魔女図鑑・作中の文・単語）。ここを編集すれば問題を追加できます                     |
| `zukan.js`                                  | 図鑑タブの紹介文（ローマ字・英語・日本語）                                                     |
| `manifest.webmanifest` / `sw.js` / `icons/` | アプリとしてインストールするための設定・オフライン用キャッシュ・アイコン                       |
| `runes.js`                                  | 魔女文字のグリフ（生成ファイル）                                                               |
| `tools/build-runes.js`                      | SVG から `runes.js` を生成するスクリプト（`node tools/build-runes.js runes.js <SVGフォルダ>`） |
| `tools/serve.js`                            | ローカル確認用サーバ（`node tools/serve.js` → http://localhost:26828）                         |
| `tools/make-cert.js`                        | ローカル HTTPS 確認用の自己署名証明書を作るスクリプト（要 openssl）                            |

### data.js の書き方

```js
{ w: 'ICH TÖTE MICH', shown: 'LCH TÖTE MICH', ja: 'わたしはわたしを殺す', where: 'ほむらの変身シーン', script: 'archaic', note: '作中の表記は LCH' }
```

- `w`：答え（読み）
- `shown`：作中の表記が違うとき（誤記など）。魔女文字はこちらで描かれます。書き取りではどちらを入力しても正解です
- `script`：作中の書体。カテゴリに `scene: true` があるときに使われます
- `lang`：`de`（ドイツ語）／`en`（英語）／`ja`（ローマ字）／`other`（その他）／`mix`（混在）／`name`（名前）。「言語を見分ける」は de・en・ja・other から出題します

### スマホから HTTPS で確認する

Service Worker（オフライン・ホーム画面アプリ）は `https` か `localhost` でしか動きません。iPhone など別の端末から確認するときは、自己署名証明書を使って HTTPS で起動します。

以下のコマンドは、この README があるフォルダ（`majo-moji`）で実行してください。別の場所からなら `node majo-moji/tools/make-cert.js` のようにパスを付けて呼んでも動きます。

```bash
node tools/make-cert.js
```

この PC の LAN 内 IPv4 アドレスと `localhost` を SAN に入れた証明書を `tools/certs/` に作ります（有効期間 397 日）。別のアドレスやホスト名を足したいときは引数で渡します（例：`node tools/make-cert.js 192.168.1.5 majo.local`）。

```bash
node tools/serve.js --https
```

起動すると、アプリ本体が `https://<PCのIP>:26828/`、iPhone 用の証明書が `http://<PCのIP>:26829/cert.cer` で配られます。証明書だけ平文 HTTP なのは、まだ信頼していない HTTPS 経由でダウンロードすると iPhone で「プロファイルが無効です」になることがあるためです。

iPhone 側の手順です（**Safari で行ってください**。Chrome など他のブラウザからはプロファイルをインストールできません）。

1. Safari で `http://<PCのIP>:26829/cert.cer` を開き、「許可」してプロファイルをダウンロードする
2. 設定 →「プロファイルがダウンロードされました」→ インストール
3. 設定 → 一般 → 情報 → 証明書信頼設定 で、この証明書のスイッチをオンにする（この操作をしないと Service Worker は登録されません）
4. Safari で `https://<PCのIP>:26828/` を開き、共有 →「ホーム画面に追加」

確認が済んだら、iPhone の 設定 → 一般 → VPN とデバイス管理 からプロファイルを削除してください。

### サーバを止める

起動したターミナルで <kbd>Ctrl</kbd> + <kbd>C</kbd> を押します。ターミナルを閉じてしまった場合は、ポートを使っているプロセスを探して終了します（PowerShell）。

```powershell
Get-NetTCPConnection -LocalPort 26828 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

`tools/certs/` は秘密鍵を含むため `.gitignore` で除外しています。

### 更新するとき

ファイルを変更したら、`sw.js` の `VERSION`（例：`mm-v5` → `mm-v6`）を上げてください。インストール済みのアプリにも更新が届きます。

## 出典・クレジット

- 魔女文字のグリフ：[Puella Magi Wiki – Witch Runes](https://wiki.puella-magi.net/Witch_Runes) の SVG を、テーマの色に合わせて整形しています。
- 魔女・手下の肩書き・性質・役割：[TV シリーズ公式サイト 魔女図鑑](https://www.madoka-magica.com/tv/special/dic/card1.html)
- 図鑑タブの紹介文：公式の魔女図鑑の事実（肩書き・性質・登場話など）をもとに本アプリで書き起こしたもので、図鑑本文の転載ではありません
- 作中の文の解読（ファンによるもの。日本語訳は本アプリでの意訳）
  - [Puella Magi Wiki – Category:Witch Runes](https://wiki.puella-magi.net/Category:Witch_Runes)（各話の解読表）
- フォント：Shippori Mincho / Zen Kaku Gothic New / Cormorant Garamond（Google Fonts, SIL OFL）
- 『ファウスト』（ゲーテ）・『神曲』（ダンテ）の引用はパブリックドメインです。
