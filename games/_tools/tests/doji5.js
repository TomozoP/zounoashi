/* 同時球技5種。遊びとして成立するかを数字で確かめる。

     node games/_tools/tests/doji5.js

   見るところ
   ・球に合うボタンを間合いで押せば当たる（5競技ぜんぶ）
   ・違うボタンを押すと当たらず、残りが減る
   ・何も来ていないのに押すと残りが減る
   ・見逃すと残りが減る／残りが尽きたら結果画面
   ・はじめの画面で競技を切ると、その球は来ず、ボタンも出ない
   ・ボタン同士が63以上離れている（スマホで44px） */

var load = require("../harness");

var bad = [];
function ok(label, cond, extra) {
  console.log((cond ? "OK  " : "NG  ") + label + (extra ? "  " + extra : ""));
  if (!cond) bad.push(label);
}
function pad(g, kind) {
  var list = g.probe.now().pads;
  for (var i = 0; i < list.length; i++) if (list[i].kind === kind) return list[i];
  return null;
}
function hitPad(g, kind) {
  var b = pad(g, kind);
  if (!b) return false;
  g.tap(b.x + b.w / 2, b.y + b.h / 2);
  return true;
}
function start(g) { g.press(" "); g.step(2); return g; }

/* ---- 合うボタンを間合いで押せば、5競技とも当たる ---- */
(function () {
  var g = start(load("games/_doji5/index.html", { quiet: true }));
  var seen = {}, tries = 0, points = 0;
  while (Object.keys(seen).length < 5 && tries++ < 60) {
    var kind = g.probe.toBall();
    if (!kind) break;
    var before = g.probe.now().score;
    hitPad(g, kind);
    var after = g.probe.now();
    if (after.score > before) { seen[kind] = true; points = after.score; }
    else ok("間合いで合うボタンを押したのに当たらない（" + kind + "）", false, JSON.stringify(after.lives));
    if (after.state !== "play") break;
  }
  ok("5競技ぜんぶ当てられる", Object.keys(seen).length === 5, Object.keys(seen).join(",") + " / " + points + "点");
  ok("当てているあいだは残りが減らない", g.probe.now().lives === 5, String(g.probe.now().lives));
})();

/* ---- 違うボタンを押すと当たらない ---- */
(function () {
  var g = start(load("games/_doji5/index.html", { quiet: true }));
  var kind = g.probe.toBall();
  var other = ["yakyu", "soccer", "tennis", "basket", "volley"].filter(function (k) { return k !== kind; })[0];
  var before = g.probe.now();
  hitPad(g, other);
  var after = g.probe.now();
  ok("違うボタンでは点が入らない", after.score === before.score, kind + " の球に " + other + " のボタン");
  ok("違うボタンは残りが減る", after.lives === before.lives - 1, before.lives + " → " + after.lives);
})();

/* ---- 何も来ていないのに押すと残りが減る ---- */
(function () {
  var g = start(load("games/_doji5/index.html", { quiet: true }));
  var before = g.probe.now().lives;
  hitPad(g, "yakyu");                             /* 最初の球が出るより前 */
  ok("空振りで残りが減る", g.probe.now().lives === before - 1, before + " → " + g.probe.now().lives);
  ok("空振りでは点が入らない", g.probe.now().score === 0);
})();

/* ---- ボタンの外を触っても何も起きない ---- */
(function () {
  var g = start(load("games/_doji5/index.html", { quiet: true }));
  var before = g.probe.now().lives;
  g.tap(270, g.H * .3); g.step(2);
  ok("ボタンの外は相手にしない", g.probe.now().lives === before);
})();

/* ---- 見逃すと残りが減り、尽きたら結果画面 ---- */
(function () {
  var g = start(load("games/_doji5/index.html", { quiet: true }));
  var frames = 0;
  while (g.probe.now().state === "play" && frames++ < 1800) g.step(1);
  var now = g.probe.now();
  ok("放っておくと残りが尽きて終わる", now.state === "result" && now.lives <= 0,
     JSON.stringify({ state: now.state, lives: now.lives, T: Math.round(now.T * 10) / 10 }));
  ok("終わるまで十分な間がある", now.T > 4, Math.round(now.T * 10) / 10 + "秒");
  g.tap(150, g.H * .62 + 20); g.step(2);
  ok("結果画面から、もう一度で遊びに戻る", g.probe.now().state === "play");
})();

/* ---- はじめの画面で競技を切る ---- */
(function () {
  var g = load("games/_doji5/index.html", { quiet: true });
  g.step(2);
  var intro = g.probe.now();
  ok("はじめは5つとも出ている", intro.pads.length === 5 && intro.on.length === 5, intro.on.join(","));
  hitPad(g, "yakyu"); g.step(2);                  /* 野球を切る */
  hitPad(g, "tennis"); g.step(2);                 /* テニスを切る */
  var picked = g.probe.now();
  ok("切った競技は入っていない", picked.on.length === 3 && picked.on.indexOf("yakyu") < 0, picked.on.join(","));
  ok("切っても開始前のまま", picked.state === "intro");
  start(g);
  var playing = g.probe.now();
  ok("遊びに入ると、入れた競技だけボタンが出る", playing.pads.length === 3, playing.pads.map(function (b) { return b.kind; }).join(","));
  var frames = 0, badKind = null;
  while (g.probe.now().state === "play" && frames++ < 900) {
    g.step(1);
    g.probe.now().balls.forEach(function (b) { if (b.kind === "yakyu" || b.kind === "tennis") badKind = b.kind; });
  }
  ok("切った競技の球は来ない", !badKind, badKind || "来なかった");
})();

/* ---- 最後のひとつは切れない ---- */
(function () {
  var g = load("games/_doji5/index.html", { quiet: true });
  g.step(2);
  ["yakyu", "soccer", "tennis", "basket", "volley"].forEach(function (k) { hitPad(g, k); g.step(2); });
  ok("ぜんぶ切ろうとしても1つ残る", g.probe.now().on.length === 1, g.probe.now().on.join(","));
})();

/* ---- 押しどころの間隔 ---- */
(function () {
  var g = start(load("games/_doji5/index.html", { quiet: true }));
  var list = g.probe.now().pads, near = 999;
  for (var i = 1; i < list.length; i++) near = Math.min(near, list[i].x - (list[i - 1].x + list[i - 1].w));
  var step = list.length > 1 ? list[1].x - list[0].x : 999;
  ok("ボタンの間隔が63以上ある", step >= 63, "間隔" + step + " / すきま" + near);
  ok("ボタンが画面に収まっている", list[0].x >= 0 && list[list.length - 1].x + list[0].w <= 540,
     list[0].x + "〜" + (list[list.length - 1].x + list[0].w));
})();

/* ---- 難しさ。球と球の間隔 ---- */
(function () {
  var g = start(load("games/_doji5/index.html", { quiet: true }));
  var gaps = [], last = null, guard = 0;
  while (gaps.length < 40 && guard++ < 200) {
    var kind = g.probe.toBall();
    if (!kind) break;
    var t = g.probe.now().T;
    if (last !== null) gaps.push(t - last);
    last = t;
    hitPad(g, kind);
    if (g.probe.now().state !== "play") break;
  }
  var first = gaps.slice(0, 5).reduce(function (a, b) { return a + b; }, 0) / 5;
  var later = gaps.slice(-5).reduce(function (a, b) { return a + b; }, 0) / 5;
  ok("はじめは1秒前後の間隔", first > .7 && first < 1.3, first.toFixed(2) + "秒");
  ok("だんだん詰まる", later < first, later.toFixed(2) + "秒");
  ok("詰まりすぎない", later > .38, later.toFixed(2) + "秒");
})();

console.log(bad.length ? "\n直すところ: " + bad.join(" / ") : "\n問題なし");
process.exit(bad.length ? 1 : 0);
