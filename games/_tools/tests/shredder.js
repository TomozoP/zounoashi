/* シュレッダー復元。遊びとして成立するかを確かめる。

     node games/_tools/tests/shredder.js

   見るところ
   ・開始画面では時間が進まない。開始すると紙片がばらばらで、逆さまもまざっている
   ・紙片をつかんで横へ動かすと、その位置に差し込まれる
   ・動かさずにタップすると上下が入れ替わる
   ・指でも、キー（← → で選び、スペースでつかむ・置く、↑ で裏返す）でも完成できる
   ・順番と向きがそろうと完成し、結果画面へ。結果の秒数は完成した時点で止まる
   ・紙片1本の幅（押しどころ）を測っておく
   ・Esc で最初から。毎回ちがう並びになる */

var load = require("../harness");
var FILE = "games/_shredder/index.html";

var bad = [];
function ok(label, cond, extra) {
  console.log((cond ? "OK  " : "NG  ") + label + (extra ? "  " + extra : ""));
  if (!cond) bad.push(label);
}

var g = load(FILE);
g.view(390, 844);
g.step(60);
var n = g.probe.now();
ok("開始画面では時間が進まない", n.state === "intro" && n.T === 0);
g.press(" ");
g.step(2);
n = g.probe.now();
ok("開始すると遊べる", n.state === "play");
ok("ばらばらに並んでいる", n.order.join() !== n.order.slice().sort(function (a, b) { return a - b; }).join(), n.order.join());
var neighbors = 0;
for (var i = 1; i < n.N; i++) if (Math.abs(n.order[i] - n.order[i - 1]) === 1) neighbors++;
ok("はじめから隣どうしの紙片がない", neighbors === 0);
ok("逆さまの紙片がまざっている", n.flips.filter(Boolean).length >= 2, n.flips.filter(Boolean).length + "本");
ok("紙片の幅", n.doc.sw >= 36, n.doc.sw.toFixed(1) + "（ゲーム座標）");

function center(k) { var d = g.probe.now().doc; return { x: d.x + (k + 0.5) * d.sw, y: d.y + d.h / 2 }; }

/* タップで裏返す */
var f0 = g.probe.now().flips[0];
var c = center(0);
g.tap(c.x, c.y); g.step(20);
ok("タップで上下が入れ替わる", g.probe.now().flips[0] === !f0);
g.tap(c.x, c.y); g.step(20);

/* つかんで右へ運ぶ */
var before = g.probe.now().order.slice(), flipBefore = g.probe.now().flips[1];
var from = center(1), to = center(6);
var pts = [];
for (var s = 0; s <= 12; s++) pts.push({ x: from.x + (to.x - from.x) * s / 12, y: from.y + (s % 2) * 3 });
g.drag(pts, 1);
g.step(30);
var after = g.probe.now().order;
ok("運んだ位置に差し込まれる", after[6] === before[1], before.join() + " → " + after.join());
ok("ほかの紙片は順番を保って詰める", after.filter(function (v) { return v !== before[1]; }).join() === before.filter(function (v) { return v !== before[1]; }).join());
ok("運ぶだけでは裏返らない", g.probe.now().flips[6] === flipBefore);

/* 指だけで完成させる */
function solveByTouch() {
  for (var want = 0; want < g.probe.now().N && g.probe.now().state === "play"; want++) {
    var o = g.probe.now().order;
    var at = o.indexOf(want);
    if (at !== want) {
      var a = center(at), b = center(want), p = [];
      for (var s = 0; s <= 16; s++) p.push({ x: a.x + (b.x - a.x) * s / 16, y: a.y });
      g.drag(p, 1);
      g.step(20);
    }
    if (g.probe.now().flips[want]) { var q = center(want); g.tap(q.x, q.y); g.step(10); }
  }
}
var tStart = g.probe.now().T;
solveByTouch();
n = g.probe.now();
ok("指で順番と向きをそろえると完成", n.state === "done" || n.state === "result", n.state + " " + n.order.join());
var tDone = n.T;
g.step(60 * 3);
n = g.probe.now();
ok("結果画面へ進む", n.state === "result");
ok("結果の秒数は完成時点で止まる", n.T === tDone, tDone.toFixed(2));

/* もう一度（結果の左ボタン） */
g.tap(270 - 120, n.H * 0.62 + 27);
g.step(2);
n = g.probe.now();
ok("もう一度で新しい並びから", n.state === "play" && n.T < 0.1);

/* キーだけで完成させる */
function solveByKey() {
  var N = g.probe.now().N;
  for (var want = 0; want < N && g.probe.now().state === "play"; want++) {
    var o = g.probe.now().order, at = o.indexOf(want);
    while (g.probe.now().cur < at) g.press("ArrowRight");
    while (g.probe.now().cur > at) g.press("ArrowLeft");
    if (at !== want) {
      g.press(" ");
      while (g.probe.now().cur > want) g.press("ArrowLeft");
      g.press(" ");
    }
    if (g.probe.now().flips[want]) g.press("ArrowUp");
    g.step(2);
  }
}
solveByKey();
g.step(10);
n = g.probe.now();
ok("キーでも完成する", n.state === "done" || n.state === "result", n.order.join());

/* Esc と並びのちがい */
var seen = {};
for (var r = 0; r < 20; r++) { g.esc(); g.step(1); seen[g.probe.now().order.join()] = true; }
ok("Esc で最初から・毎回ちがう並び", g.probe.now().state === "play" && Object.keys(seen).length >= 18, Object.keys(seen).length + "/20");

/* 画面の形 */
[[375, 667], [390, 844], [430, 932], [768, 1024], [1280, 720]].forEach(function (v) {
  g.view(v[0], v[1]); g.step(2);
  var d = g.probe.now().doc, H = g.probe.now().H;
  ok("書類が画面に収まる " + v.join("x"), d.x >= 0 && d.x + d.sw * 12 <= 540 && d.y >= 90 && d.y + d.h <= H - 20, "H=" + H + " 紙片幅=" + d.sw.toFixed(1));
});

console.log(bad.length ? "\n失敗: " + bad.length : "\n問題なし");
process.exit(bad.length ? 1 : 0);
