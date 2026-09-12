# ランダムボーリングの下書き

左右で位置を決める → 角度と高さを決めて離す → タップでパワーを止めて投球。赤い投球線そのものが1.8秒周期で伸び縮みし、長いほど強く投げる。独立したゲージや文字は出さない。
球は画面下から一球ずつ届き、停止後に投球位置へ移る。受け取りレーンは置かない。球名と投球線は到着後に出る。
10投の倒した本数を合計し、結果更新時だけスコア欄を二秒表示する。

## 作り

- `physics.js`：cannon-es による三次元の剛体計算。固定刻みは毎秒180回。
- `scene.js`：Three.js で球・ピン・レーンを描く。球とピンの位置・回転は物理計算の結果を使う。
- `models.json`：Blender MCPで作った指穴付きボーリング球と、底面を閉じたピンの三角形・法線。
- `index.html`：入力、進行、球名、ガイド、得点、音。3D描画を最後に同じcanvasへ写すため、既存の録画・サムネイル作成が使える。

形の大きさはゲーム内の見やすさに合わせた単位。球の質量差はkgを参考に設定しているが、実寸の競技シミュレーターではない。
投げ出しの初速は従来の1.35倍。球の底を床から0.45単位浮かせ、少し上向きに放す。楕円球は形に合わせてさらに0.15単位上げる。着地後の跳ねは素材の反発係数に任せる。

球ごとの半径・質量・摩擦・反発・空気抵抗・投球速度は `physics.js` の `kinds` にまとめてある。
球を上下させる演出や、当たっただけでピンを倒す処理は使わない。傾きが約46度を超えるか、レーン外へ落ちたピンを倒れたものとして数える。
ピンが静まり、球が通過・停止・跳ね返りしたら投球を終了する。最大九秒で終了し、止まらない球にも備える。

先頭のピンまでの距離は約29単位に延ばし、投球前のカメラを低くして奥行きを見せる。投球線は赤い太さ付きの破線。

投球後のカメラは球の進行方向を追いながら低くなり、ピンの手前で前進を止める。次の球では滑らかに元へ戻る。

## 確認

```
node games/_tools/tests/random-bowling.js
node games/_tools/tests/random-bowling-physics.js
node games/_tools/tests/random-bowling-render.js
```

最後の確認は画面なしのブラウザで模型の読み込み、10種類の見た目、カメラ追従と復帰を確認し、一時フォルダへ画像を保存する。
従来の偽DOMでも物理・進行の確認ができる。別のJSも読むため `withScripts: true` が必要。

## 同梱した道具

今回の3D物理化に合わせ、このゲームだけ外部ライブラリを同梱した。ビルド・npm追加・実行中の外部配信元への接続は不要。

- [cannon-es 0.20.0](https://github.com/pmndrs/cannon-es/releases/tag/v0.20.0)：MIT。`vendor/cannon-LICENSE`。
  配布されたCommonJS版をブラウザ用に包み、`perf_hooks` 参照だけ `globalThis.performance` に置き換えた。
- [Three.js r160](https://github.com/mrdoob/three.js/tree/r160)：MIT。配布版0.160.1。`vendor/three-LICENSE`。
  ビルドの要らない従来形式を固定版で同梱。

物理の材質設定は [ContactMaterial](https://pmndrs.github.io/cannon-es/docs/classes/ContactMaterial.html)、描画の粗さと金属感は [MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html) を使用。

球は投球するまで半透明にし、投球時に不透明へ戻す。
