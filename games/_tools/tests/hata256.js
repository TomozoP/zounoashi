/* 256色旗揚げ。遊びとして成立するかを数字で確かめる。

     node games/_tools/tests/hata256.js

   見るところ
   ・開始画面では旗が動かない。開始すると赤と白の2色から始まる
   ・言われた色の旗に触ると上げ下げされ、次の指示が出る
   ・3回ごとに色が倍になり、21回で256色になる。どの段階も色が重ならず、赤と白が残る
   ・違う旗に触ると終わる。放っておいても時間切れで終わる
   ・256色でも1マスはゲーム座標で31以上ある（押す間隔の決まり63は意図して下回る）
   ・Esc で最初から */

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
ok("開始画面", g.probe.now().state === "intro");
g.press(" ");
g.step(2);
var n = g.probe.now();
ok("開始すると2色", n.state === "play" && n.colors === 2, n.colors + "色");

var seen = {}, lastColors = 0, sizes = [];
for (var i = 0; i < 40; i++) {
  n = g.probe.now();
  if (n.state !== "play") break;
  if (n.colors !== lastColors) {
    seen[n.colors] = i;
    lastColors = n.colors;
    sizes.push(n.cell.s);
    var list = g.probe.colors(), uniq = {};
    list.forEach(function (c) { uniq[c] = 1; });
    ok(n.colors + "色に赤と白、重なりなし", g.probe.cellOf("#ff0000") && g.probe.cellOf("#ffffff") &&
      Object.keys(uniq).length === n.colors);
  }
  g.step(10);
  g.tap(n.cell.x, n.cell.y);
  g.step(1);
}
ok("40回とも正しく進む", g.probe.now().state === "play" && g.probe.now().score === 40, "得点 " + g.probe.now().score);
ok("21回目で256色", seen[256] === 21, JSON.stringify(seen));
ok("256色でもマスは31以上", sizes[sizes.length - 1] >= 31, sizes.map(Math.round).join(" → "));
n = g.probe.now();
ok("256色の制限時間は2.8秒以上", n.limit >= 2.8, n.limit.toFixed(2) + "秒");

/* 違う旗 */
var cell = n.cell, other = { x: cell.x + (cell.x > 270 ? -cell.s : cell.s), y: cell.y };
g.tap(other.x, other.y);
g.step(2);
ok("違う旗で終わる", g.probe.now().state === "miss");
g.until(function () { return g.probe.now().state === "result"; });
ok("結果画面", g.probe.now().state === "result" && g.probe.now().score === 40);

/* 時間切れ */
g.press("Escape");
g.step(2);
ok("Escで最初から", g.probe.now().state === "play" && g.probe.now().score === 0 && g.probe.now().colors === 2);
g.step(Math.ceil(2 * 60) + 5);
ok("時間切れで終わる", g.probe.now().state !== "play");

console.log(bad.length ? "失敗: " + bad.length : "問題なし");
process.exit(bad.length ? 1 : 0);
