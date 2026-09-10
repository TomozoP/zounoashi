# わんこボマー（まだ非公開）

`_` で始まるフォルダは GitHub Pages が公開しません。そのため、このフォルダに入れてある間は
`https://www.zounoashi.com/games/wanko/…` も `games/_wanko/…` も 404 になり、直リンクでも開けません。
このファイル自体も公開されません。

サイトのトップ（`index.html`）からも登録を外してあるので、一覧にも出ず、
ページのソースにも名前が残りません。

## 公開するとき

1. フォルダの名前を戻す

   ```
   git mv games/_wanko games/wanko
   ```

2. `index.html` の `var GAMES = [` の中、実験場のゲームが並んでいるところ（`melos` の行の上）に
   次の1行を戻す

   ```js
   { type: "lab", tags: [], id: "wanko", title: "わんこボマー", year: 2026, date: "2026-09-11",
     plays: null, url: "", img: "games/wanko/img/thumb.svg",
     play: "games/wanko/index.html", full: true,
     catch: "次から次へと差し出される爆弾を、導火線が尽きる前に解除しつづける" },
   ```

3. `git add` → `git commit` → `git push origin main`

## 中身のおぼえがき

- タテ画面（横540固定・高さは画面の形に合わせる）、`full: true` で1ページまるごと使う
- 仕掛けは8種類（配線 / 色合わせ / スイッチ / ネジ / ダイヤル / タイミング / ポンプ / 長押し）を
  4種類の胴体（球・ケース・ドラム缶・パイプ）で出す。共通のルールは「緑＝触れ」
- 女将の立ち絵は `img/okami.webp`。台の縁でクリップして、向こう側に立っているように見せている
- 動作確認はブラウザプレビューでは足りない（コマが進まない）。偽DOM上の自動運転で確かめる
