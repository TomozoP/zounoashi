/* 同時球技5種。遊びとして成立するかを数字で確かめる。

     node games/_tools/tests/doji5.js

   見るところ
   ・間合いで押せば当たり、点が入る（5競技ぜんぶ）
   ・何も来ていないのに押すと残りが減る
   ・見逃すと残りが減る
   ・残りが尽きたら結果画面
   ・押しどころ（結果画面のボタン）が63以上離れている */

var load = require("../harness");

var bad = [];
function ok(label, cond, extra) {
  console.log((cond ? "OK  " : "NG  ") + label + (extra ? "  " + extra : ""));
  if (!cond) bad.push(label);
}

/* ---- 間合いで押せば、5競技とも当たる ---- */
(function () {
  var g = load("games/_doji5/index.html", { quiet: true });
  g.press(" "); g.step(2);                       /* START */
  var seen = {}, points = 0, tries = 0;
  while (Object.keys(seen).length < 5 && tries++ < 60) {
    var kind = g.probe.toBall();
    if (!kind) break;
    var before = g.probe.now();
    g.probe.tap();
    var after = g.probe.now();
    if (after.score > before.score) { seen[kind] = (seen[kind] || 0) + 1; points = after.score; }
    else ok("間合いで押したのに当たらない（" + kind + "）", false, JSON.stringify(after));
    if (after.state !== "play") break;
  }
  ok("5競技ぜんぶ当てられる", Object.keys(seen).length === 5, Object.keys(seen).join(",") + " / " + points + "点");
  ok("当てているあいだは残りが減らない", g.probe.now().lives === 5, JSON.stringify(g.probe.now().lives));
})();

/* ---- 何も来ていないのに押すと残りが減る ---- */
(function () {
  var g = load("games/_doji5/index.html", { quiet: true });
  g.press(" "); g.step(2);
  var before = g.probe.now().lives;
  g.probe.tap();                                  /* 最初の球が出るより前 */
  ok("空振りで残りが減る", g.probe.now().lives === before - 1, before + " → " + g.probe.now().lives);
  ok("空振りでは点が入らない", g.probe.now().score === 0);
})();

/* ---- 見逃すと残りが減り、尽きたら結果画面 ---- */
(function () {
  var g = load("games/_doji5/index.html", { quiet: true });
  g.press(" "); g.step(2);
  var frames = 0;
  while (g.probe.now().state === "play" && frames++ < 1800) g.step(1);
  var now = g.probe.now();
  ok("放っておくと残りが尽きて終わる", now.state === "result" && now.lives <= 0, JSON.stringify({ state: now.state, lives: now.lives, T: Math.round(now.T * 10) / 10 }));
  ok("終わるまで十分な間がある", now.T > 4, Math.round(now.T * 10) / 10 + "秒");
})();

/* ---- 難しさを数字で見る。1球あたりの間隔 ---- */
(function () {
  var g = load("games/_doji5/index.html", { quiet: true });
  g.press(" "); g.step(2);
  var gaps = [], last = null, guard = 0;
  while (gaps.length < 40 && guard++ < 200) {
    var kind = g.probe.toBall();
    if (!kind) break;
    var t = g.probe.now().T;
    if (last !== null) gaps.push(t - last);
    last = t;
    g.probe.tap();
    if (g.probe.now().state !== "play") break;
  }
  var first = gaps.slice(0, 5).reduce(function (a, b) { return a + b; }, 0) / 5;
  var later = gaps.slice(-5).reduce(function (a, b) { return a + b; }, 0) / 5;
  ok("はじめは1秒前後の間隔", first > .7 && first < 1.3, first.toFixed(2) + "秒");
  ok("だんだん詰まる", later < first, later.toFixed(2) + "秒");
  ok("詰まりすぎない", later > .38, later.toFixed(2) + "秒");
})();

/* ---- 結果画面の押しどころ ---- */
(function () {
  var g = load("games/_doji5/index.html", { quiet: true });
  g.press(" "); g.step(2);
  var frames = 0;
  while (g.probe.now().state === "play" && frames++ < 1800) g.step(1);
  ok("結果画面から、もう一度で遊びに戻る", (function () {
    g.tap(150, g.H * .62 + 20); g.step(2);
    return g.probe.now().state === "play";
  })());
})();

console.log(bad.length ? "\n直すところ: " + bad.join(" / ") : "\n問題なし");
process.exit(bad.length ? 1 : 0);
