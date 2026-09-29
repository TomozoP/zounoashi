/* シュレッダー・エージェント。遊びとして成立するかを確かめる。

     node games/_tools/tests/shredder.js

   見るところ
   ・開始画面では時間が進まない。開始するとステージ1、紙片がばらばら
   ・ステージは3つ。紙片の本数と逆さまの本数が 6本・0本 → 10本・3本 → 15本・5本 と増える
   ・紙片をつかんで横へ動かすと、その位置に差し込まれる
   ・動かさずにタップすると上下が入れ替わる
   ・順番と向きがそろうと完成し、次のステージへ。3つ目のあとで結果画面
   ・秒数はステージをまたいで足され、完成した時点で止まる
   ・指でも、キー（← → で選び、スペースでつかむ・置く、↑ で裏返す）でも最後まで遊べる
   ・紙片1本の幅（押しどころ）を測っておく
   ・確認用に F2 か上の「1/3」の3回タップで、今のステージを完成できる
   ・Esc で最初から。毎回ちがう並びになる */

var load = require("../harness");
var FILE = "games/shredder/index.html";

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
ok("開始するとステージ1から", n.state === "play" && n.stage === 0);

function center(k) { var d = g.probe.now().doc; return { x: d.x + (k + 0.5) * d.sw, y: d.y + d.h / 2 }; }
function sorted(a) { return a.slice().sort(function (x, y) { return x - y; }).join(); }

/* 各ステージの並びを確かめる */
function checkStage(want) {
  var n = g.probe.now();
  ok("ステージ" + (n.stage + 1) + " の本数", n.N === want.n && n.order.length === want.n, n.N + "本");
  ok("ステージ" + (n.stage + 1) + " の逆さま", n.flips.filter(Boolean).length === want.flips, n.flips.filter(Boolean).length + "本");
  ok("ステージ" + (n.stage + 1) + " はばらばら", n.order.join() !== sorted(n.order), n.order.join());
  var near = 0;
  for (var i = 1; i < n.N; i++) if (Math.abs(n.order[i] - n.order[i - 1]) === 1) near++;
  ok("ステージ" + (n.stage + 1) + " は隣どうしの紙片がない", near === 0);
  ok("ステージ" + (n.stage + 1) + " の紙片の幅", n.doc.sw >= 30, n.doc.sw.toFixed(1) + "（ゲーム座標）");
}
var WANT = [{ n: 6, flips: 0 }, { n: 10, flips: 3 }, { n: 15, flips: 5 }];

/* 指だけで今のステージを完成させる */
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
/* キーだけで今のステージを完成させる */
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
function nextStage(from) {
  g.until(function () { var n = g.probe.now(); return n.state === "result" || (n.state === "play" && n.stage === from + 1); }, 60 * 10);
}

/* ステージ1で、差し込みと裏返しを確かめる */
checkStage(WANT[0]);
var before = g.probe.now().order.slice();
var from = center(1), to = center(4);
var pts = [];
for (var s = 0; s <= 12; s++) pts.push({ x: from.x + (to.x - from.x) * s / 12, y: from.y + (s % 2) * 3 });
g.drag(pts, 1);
g.step(30);
var after = g.probe.now().order;
ok("運んだ位置に差し込まれる", after[4] === before[1], before.join() + " → " + after.join());
ok("ほかの紙片は順番を保って詰める", after.filter(function (v) { return v !== before[1]; }).join() === before.filter(function (v) { return v !== before[1]; }).join());
ok("運ぶだけでは裏返らない", g.probe.now().flips.filter(Boolean).length === 0);
var c = center(0);
g.tap(c.x, c.y); g.step(20);
ok("タップで上下が入れ替わる", g.probe.now().flips[0] === true);
g.tap(c.x, c.y); g.step(20);

/* 指で3ステージを通す */
var times = [];
for (var st = 0; st < 3; st++) {
  if (st) checkStage(WANT[st]);
  solveByTouch();
  n = g.probe.now();
  ok("ステージ" + (st + 1) + " を指で完成", n.state === "done", n.state + " " + n.order.join());
  times.push(n.T);
  nextStage(st);
}
n = g.probe.now();
ok("3ステージのあとで結果画面", n.state === "result");
ok("最後の演出（印・夜空・爆発）の長さ", n.endLen >= 6 && n.endLen <= 10, n.endLen.toFixed(1) + "秒");
ok("秒数はステージをまたいで増える", times[0] < times[1] && times[1] < times[2], times.map(function (t) { return t.toFixed(2); }).join(" → "));
ok("結果の秒数は完成時点で止まる", n.T === times[2]);

/* もう一度（結果の左ボタン） */
g.tap(270 - 120, n.H * 0.62 + 27);
g.step(2);
n = g.probe.now();
ok("もう一度でステージ1から", n.state === "play" && n.stage === 0 && n.T < 0.1);

/* キーで3ステージを通す */
for (st = 0; st < 3; st++) {
  solveByKey();
  g.step(2);
  ok("ステージ" + (st + 1) + " をキーで完成", g.probe.now().state === "done", g.probe.now().order.join());
  nextStage(st);
}
ok("キーでも結果画面まで", g.probe.now().state === "result");

/* クリアの覗き穴：F2 と、上の「1/3」を素早く3回タップ */
g.esc(); g.step(1);
g.press("F2"); g.step(2);
ok("F2 で今のステージが完成", g.probe.now().state === "done" && g.probe.now().stage === 0);
nextStage(0);
var top = g.probe.now().doc.y - 20;
g.tap(270, top); g.step(3); g.tap(270, top); g.step(3);
ok("上を2回タップではまだ", g.probe.now().state === "play" && g.probe.now().stage === 1);
g.tap(270, top); g.step(2);
ok("上を3回タップで完成", g.probe.now().state === "done" && g.probe.now().stage === 1);
nextStage(1);
g.press("F2"); g.step(2); nextStage(2);
ok("F2 で最後まで進めて結果画面", g.probe.now().state === "result");

/* Esc と並びのちがい */
var seen = {};
for (var r = 0; r < 20; r++) { g.esc(); g.step(1); seen[g.probe.now().order.join()] = true; }
ok("Esc で最初から・毎回ちがう並び", g.probe.now().state === "play" && g.probe.now().stage === 0 && Object.keys(seen).length >= 15, Object.keys(seen).length + "/20");

/* 画面の形（いちばん細かいステージ3で） */
g.esc(); g.step(1);
solveByTouch(); nextStage(0); solveByTouch(); nextStage(1);
[[375, 667], [390, 844], [430, 932], [768, 1024], [1280, 720]].forEach(function (v) {
  g.view(v[0], v[1]); g.step(2);
  var n = g.probe.now(), d = n.doc;
  ok("書類が画面に収まる " + v.join("x"), n.stage === 2 && d.x >= 0 && d.x + d.sw * n.N <= 540 && d.y >= 40 && d.y + d.h <= n.H - 20, "H=" + n.H + " 紙片幅=" + d.sw.toFixed(1));
});

console.log(bad.length ? "\n失敗: " + bad.length : "\n問題なし");
process.exit(bad.length ? 1 : 0);
