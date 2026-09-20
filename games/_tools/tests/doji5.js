/* 同時球技5種。遊びとして成立するかを数字で確かめる。

     node games/_tools/tests/doji5.js

   見るところ
   ・球に合うボタンを間合いで押せば当たる（5競技ぜんぶ）
   ・違うボタンを押しても当たらないが、振っただけでは残りは減らない
   ・減るのは球を見逃したときだけ。尽きたら結果画面
   ・もう一度を押すと、開始画面へ戻る
   ・開始画面はSTART待ちで、つねに5競技
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

/* ---- 違うボタンを押しても当たらない。ただし残りは減らない ---- */
(function () {
  var g = start(load("games/_doji5/index.html", { quiet: true }));
  var kind = g.probe.toBall();
  var other = ["yakyu", "soccer", "tennis", "basket", "volley"].filter(function (k) { return k !== kind; })[0];
  var before = g.probe.now();
  hitPad(g, other);
  var after = g.probe.now();
  ok("違うボタンでは点が入らない", after.score === before.score, kind + " の球に " + other + " のボタン");
  ok("違うボタンでも残りは減らない", after.lives === before.lives, before.lives + " → " + after.lives);
})();

/* ---- 何も来ていないのに押しても減らない ---- */
(function () {
  var g = start(load("games/_doji5/index.html", { quiet: true }));
  var before = g.probe.now().lives;
  for (var i = 0; i < 20; i++) { hitPad(g, "yakyu"); g.step(2); }   /* 最初の球が出るより前 */
  ok("空振りを続けても残りが減らない", g.probe.now().lives === before, before + " → " + g.probe.now().lives);
  ok("空振りでは点が入らない", g.probe.now().score === 0);
  ok("空振りでは結果を表示しない", g.probe.now().cheers.length === 0);
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
  var back = g.probe.now();
  ok("もう一度で開始画面へ戻る", back.state === "intro" && back.pads.length === 0, back.state);
  ok("戻ったら点と残りが元に戻っている", back.score === 0 && back.lives === 5);
  g.press(" "); g.step(2);
  ok("そこから始められる", g.probe.now().state === "play", g.probe.now().state);
})();

/* ---- 開始前は競技を切り替えられず、操作ボタンを出さない ---- */
(function () {
  var g = load("games/_doji5/index.html", { quiet: true });
  ["1", "2", "3", "4", "5", "ArrowUp"].forEach(function (k) { g.press(k); });
  ok("開始前はSTART待ちで操作ボタンを出さない", g.probe.now().state === "intro" && g.probe.now().pads.length === 0);
  ok("常に5競技", g.probe.now().on.length === 5);
  start(g);
  ok("開始後は5ボタン", g.probe.now().pads.length === 5);
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

/* 5競技のキー操作と得点時の表示。 */
(function () {
  var g = load("games/_doji5/index.html", { quiet: true });
  var keys = ["yakyu", "soccer", "tennis", "basket", "volley"];
  var words = ["HOME RUN!", "GOAL!", "WINNER!", "BASKET!", "POINT!"];
  start(g);
  var seen = {};
  for (var i = 0; i < 60 && Object.keys(seen).length < 5; i++) {
    var kind = g.probe.toBall(), before = g.probe.now().score;
    if (!kind) break;
    g.press(String(keys.indexOf(kind) + 1));
    ok("数字キーで当たる：" + kind, g.probe.now().score > before);

    seen[kind] = true;
  }
  ok("5競技とも数字キーで操作できる", Object.keys(seen).length === 5);
  g.step(210);
  ok("得点表示は消える", g.probe.now().cheers.length === 0);
})();

/* 結果は打った瞬間には出ず、球が奥へ届いてから出る。 */
["yakyu", "soccer", "tennis", "basket", "volley"].forEach(function (wanted, index) {
  var g = start(load("games/_doji5/index.html", { quiet: true }));
  var found = false;
  for (var i = 0; i < 100; i++) {
    var kind = g.probe.toBall();
    if (!kind) break;
    hitPad(g, kind);
    if (kind !== wanted) continue;
    found = true;
    ok("打った瞬間にその球の結果はまだ出ない：" + kind, !g.probe.now().results.some(function (r) { return r.kind === wanted; }));
    g.step(Math.ceil([2.1, 1.6, 1, 1.15, .9][index] * 60) + 1);
    var result = g.probe.now().results.filter(function (r) { return r.kind === wanted; })[0];
    ok("到着後、奥の位置に結果が出る：" + kind, !!result && result.z >= 19);
    break;
  }
  ok("到着の確認ができた：" + wanted, found);
});

console.log(bad.length ? "\n直すところ: " + bad.join(" / ") : "\n問題なし");
process.exit(bad.length ? 1 : 0);
