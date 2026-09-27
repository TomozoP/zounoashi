/* 総当たり脱出ゲーム。遊びとして成立するかを数字で確かめる。

     node games/_tools/tests/brute-escape.js

   見るところ
   ・開始画面では押しても番号が進まない
   ・押すたびに今の錠の番号が1つ進み、当たりで外れて次の錠へ移る
   ・3つ外れると扉が開き、結果画面に脱出までの秒数が出る
   ・脱出に必要な押す回数は 3〜297 回。平均と、毎秒8回で押したときの秒数を出す
   ・Esc で最初からやり直せる */

var load = require("../harness");
var FILE = "games/_brute-escape/index.html";

var bad = [];
function ok(label, cond, extra) {
  console.log((cond ? "OK  " : "NG  ") + label + (extra ? "  " + extra : ""));
  if (!cond) bad.push(label);
}

/* ---- 開始画面では進まない ---- */
(function () {
  var g = load(FILE, { quiet: true });
  g.tap(270, 300); g.step(10);
  var p = g.probe.now();
  ok("開始前のタップで番号が進まない", p.tries === 0 && p.state === "intro");
})();

/* ---- 1つずつ試して脱出する ---- */
(function () {
  var g = load(FILE, { quiet: true });
  g.press(" "); g.step(2);
  ok("スペースで開始", g.probe.now().state === "play");
  var codes = g.probe.now().locks.map(function (L) { return L.code; });
  ok("番号は 01〜99", codes.every(function (c) { return c >= 1 && c <= 99; }), codes.join(","));

  var need = codes[0] + codes[1] + codes[2], pressed = 0, stepOk = true, order = true;
  while (g.probe.now().cur < 3 && pressed < 400) {
    var before = g.probe.now();
    g.tap(270, 400);
    g.step(7);                                   /* 毎秒8回ほどの連打 */
    pressed++;
    var after = g.probe.now();
    var i = before.cur;
    if (after.locks[i].n !== before.locks[i].n + 1) stepOk = false;
    for (var k = 0; k < 3; k++) if (k !== i && after.locks[k].n !== before.locks[k].n) order = false;
  }
  ok("押すたびに今の錠だけが1つ進む", stepOk && order);
  ok("押した回数は番号の合計と同じ", pressed === need, pressed + " / " + need);
  var p = g.probe.now();
  ok("3つとも外れた", p.locks.every(function (L) { return L.open; }));
  ok("外れた後に押しても進まない", (g.tap(270, 400), g.probe.now().tries === pressed));
  ok("扉が開いて結果画面になる", g.until(function () { return g.probe.now().state === "result"; }, 600));
  var s = g.probe.now().score;
  ok("記録は脱出の瞬間の秒数", Math.abs(s - pressed * 7 / 60) < 0.2, s + "秒");

  /* 結果画面のもう一度 */
  g.press(" "); g.step(2);
  var q = g.probe.now();
  ok("もう一度で新しい番号から", q.state === "play" && q.tries === 0 && q.cur === 0);
  g.tap(270, 400); g.step(2);
  g.press("Escape"); g.step(2);
  ok("Esc で最初から", g.probe.now().tries === 0);
})();

/* ---- 押す回数の見込み ---- */
(function () {
  var sum = 0, N = 4000, max = 0, min = 999;
  for (var i = 0; i < N; i++) {
    var t = 0;
    for (var k = 0; k < 3; k++) t += 1 + Math.floor(Math.random() * 99);
    sum += t; max = Math.max(max, t); min = Math.min(min, t);
  }
  var avg = sum / N;
  console.log("    押す回数 平均" + avg.toFixed(0) + "（" + min + "〜" + max + "）  毎秒8回で平均" + (avg / 8).toFixed(1) + "秒");
})();

if (bad.length) { console.log("\nNG " + bad.length + "件"); process.exit(1); }
console.log("\nぜんぶOK");
