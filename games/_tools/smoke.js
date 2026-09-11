/* どのゲームにも共通の「壊れていないか」確認。

     node games/_tools/smoke.js games/_hoge/index.html

   見るのは、遊びの中身ではなく落ちないかどうか。
   ・読み込んで30秒ぶん回しても落ちない
   ・画面の形を6通りに変えても落ちない
   ・でたらめに触っても・キーを押しても落ちない
   ・Esc で最初から戻る
   ・結果画面まで行ける（覗き穴がある場合）
   中身の確かめ（正しく解けるか等）は、ゲームごとのテストを別に書く。 */

var load = require("./harness");
var file = process.argv[2];
if (!file) { console.log("使い方: node games/_tools/smoke.js games/_hoge/index.html"); process.exit(1); }

var bad = [];
function ok(label, cond, extra) {
  console.log((cond ? "OK  " : "NG  ") + label + (extra ? "  " + extra : ""));
  if (!cond) bad.push(label);
}
function guard(label, fn) {
  try { fn(); return true; }
  catch (e) { bad.push(label + ": " + e.message); console.log("NG  " + label + "  " + e.message); return false; }
}

var g;
if (!guard("読み込める", function () { g = load(file, { quiet: true }); })) finish();

ok("覗き穴がある（window.__probe）", !!g.probe.now,
   g.probe.now ? JSON.stringify(g.probe.now()) : "無いと細かい確認ができない");

guard("30秒ぶん回しても落ちない", function () { g.step(1800); });
ok("絵を描いている", g.drawn.length > 100, g.drawn.length + "命令");

load.SHAPES.forEach(function (v) {
  guard("画面 " + v[0] + "x" + v[1] + " に変えても落ちない", function () {
    g.view(v[0], v[1]); g.step(30);
  });
});
g.view(430, 900); g.step(10);

guard("でたらめに触っても落ちない", function () {
  for (var i = 0; i < 300; i++) {
    var x = Math.random() * 540, y = Math.random() * g.H;
    if (i % 5 === 0) { g.down(x, y); g.moveTo(x + 30, y - 20); g.up(); }
    else g.tap(x, y);
    g.step(2);
  }
});
guard("でたらめにキーを押しても落ちない", function () {
  var keys = [" ", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab", "1", "5", "9", "a", "d"];
  for (var i = 0; i < 300; i++) { g.press(keys[i % keys.length]); g.step(2); }
});

if (g.probe.now && g.probe.reset) {
  g.probe.reset(); g.step(2);
  var after = g.probe.now();
  ok("Esc/やり直しで最初から", after.score === 0 || after.score === undefined,
     JSON.stringify(after));
  guard("Escを押しても落ちない", function () { g.esc(); g.step(30); });
}

if (g.probe.now) {
  var reached = g.until(function () { return g.probe.now().state === "result"; }, 3000);
  ok("放っておくと結果画面まで行く", reached, reached ? "" : "（時間切れの無いゲームなら気にしなくてよい）");
  if (reached) {
    var y = g.probe.now().H ? g.probe.now().H * 0.62 + 27 : g.H * 0.62 + 27;
    guard("「もう一度」を押せる", function () { g.tap(175, y); g.step(10); });
    ok("押すと遊びに戻る", g.probe.now().state !== "result", g.probe.now().state);
  }
}

finish();

function finish() {
  console.log("");
  if (bad.length) { console.log("問題:"); bad.forEach(function (b) { console.log("  - " + b); }); process.exit(1); }
  console.log("問題なし");
}
