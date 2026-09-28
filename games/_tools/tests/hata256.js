/* 256色旗揚げ。遊びとして成立するかを数字で確かめる。

     node games/_tools/tests/hata256.js

   見るところ
   ・開始画面では指示が出ない。開始すると赤と白の2本から始まる
   ・言われた色の旗の側（画面の左右）をタップすると上げ下げされ、次の指示が出る
   ・上げている旗には「下げて」、下げている旗には「上げて」しか言わない
   ・3回ごとに使う色が倍になり、21回で256色になる
   ・2本の旗は同じ色にならず、見分けがつく程度に離れている
   ・赤白の2色のうちは赤が左・白が右のまま。4色からは指示のたびに片方だけ色が変わる
   ・ときどき「上げないで」「下げないで」が出る。触らずに待てば1回に数え、触ると終わる
   ・反対の旗を動かすと終わる。放っておいても時間切れで終わる
   ・← → キーでも遊べる。Esc で最初から */

var load = require("../harness");
var FILE = "games/_hata256/index.html";

var bad = [];
function ok(label, cond, extra) {
  console.log((cond ? "OK  " : "NG  ") + label + (extra ? "  " + extra : ""));
  if (!cond) bad.push(label);
}

var g = load(FILE);

g.view(390, 844);
g.step(30);
ok("開始画面では指示なし", g.probe.now().state === "intro" && g.probe.now().say === null);
g.press(" ");
g.step(2);
var n = g.probe.now();
ok("開始すると赤と白", n.state === "play" && n.colors === 2 &&
  n.flags.map(function (f) { return f.name; }).sort().join() === "白,赤", n.say);

var seen = {}, lastColors = 0, wrongWay = 0, same = 0, sayings = [], swapBad = 0, fixedBad = 0, feints = 0;
function rgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
var minApart = 999, prev = null, lastScore = -1;
for (var i = 0; i < 20000 && g.probe.now().score < 40; i++) {
  n = g.probe.now();
  if (n.state !== "play") break;
  if (n.score === lastScore) { g.step(1); continue; }       /* フェイントを待っている間 */
  lastScore = n.score;
  if (n.colors !== lastColors) { seen[n.colors] = n.score; lastColors = n.colors; }
  var names = n.flags.map(function (f) { return f.name; });
  if (n.colors === 2 && names.join() !== "赤,白") fixedBad++;
  if (prev && n.colors > 2) {
    var changed = (names[0] !== prev[0]) + (names[1] !== prev[1]);
    if (changed !== 1) swapBad++;
  }
  prev = names;
  var t = n.flags[n.side];
  if (t.up === n.raise) wrongWay++;
  if (names[0] === names[1]) same++;
  var a = rgb(n.flags[0].hex), b = rgb(n.flags[1].hex);
  minApart = Math.min(minApart, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  if (n.feint) { feints++; sayings.push(n.say); continue; }
  if (i % 7 === 0) sayings.push(n.say);
  g.step(20);
  if (i % 2) g.tap(n.side ? 400 : 140, 500);
  else g.press(n.side ? "ArrowRight" : "ArrowLeft");
  g.step(1);
}
n = g.probe.now();
ok("40回とも正しく進む", n.state === "play" && n.score === 40, "得点 " + n.score + " 例: " + sayings.join(" / "));
ok("21回目で256色", seen[256] === 21, JSON.stringify(seen));
ok("できない指示を出さない", wrongWay === 0);
ok("2本が同じ色にならない", same === 0);
ok("2本の色は離れている", minApart >= 60, "最小 " + Math.round(minApart));
ok("赤白のうちは赤が左・白が右", fixedBad === 0);
ok("持ち替えは片方ずつ", swapBad === 0);
ok("フェイントが出る", feints >= 3, feints + "回");
ok("指示の時間は2.2秒以上", n.feint || n.limit >= 2.2, n.limit.toFixed(2) + "秒");

/* 反対の旗（フェイントでない指示まで待つ） */
g.until(function () { var m = g.probe.now(); return m.state !== "play" || !m.feint; });
n = g.probe.now();
/* 反対の旗 */
g.tap(n.side ? 140 : 400, 500);
g.step(2);
ok("反対の旗で終わる", g.probe.now().state === "miss");
g.until(function () { return g.probe.now().state === "result"; });
ok("結果画面", g.probe.now().state === "result" && g.probe.now().score === n.score);

/* フェイントで触ると終わる */
g.press("Escape"); g.step(2);
g.until(function () { var m = g.probe.now(); if (m.state === "play" && !m.feint && m.left < m.limit - 0.3) g.press(m.side ? "ArrowRight" : "ArrowLeft"); return m.state !== "play" || m.feint; });
n = g.probe.now();
g.press(n.side ? "ArrowRight" : "ArrowLeft"); g.step(2);
ok("フェイントで触ると終わる", n.feint && g.probe.now().state === "miss");

/* 時間切れ */
g.press("Escape");
g.step(2);
n = g.probe.now();
ok("Escで最初から", n.state === "play" && n.score === 0 && n.colors === 2);
g.step(Math.ceil(n.limit * 60) + 5);
ok("時間切れで終わる", g.probe.now().state !== "play");

console.log(bad.length ? "失敗: " + bad.length : "問題なし");
process.exit(bad.length ? 1 : 0);
