/* 一輪車で鍋：遊びとして成り立つかを、人の反応の遅れをまねた自動運転で測る。
     node games/_tools/tests/ichirin-nabe.js
   見るもの
     - 何もしない・押しっぱなしでは、すぐ倒れる
     - 反応が速めの人（0.2秒）はほぼ食べきれる
     - 反応が遅い人（0.4秒）はときどき倒れる（簡単すぎない）
     - 倒れたら％、食べきったら秒で結果が出る */
var load = require("../harness");
var FILE = "games/_ichirin-nabe/index.html";

function play(bot, delayFrames, seed) {
  var s = seed;
  Math.random = function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
  var g = load(FILE);
  g.press(" ");                                  /* 開始 */
  var seen = [], held = false, lastSwitch = -99, f = 0;
  while (g.probe.now().state !== "result" && f < 60 * 90) {
    var n = g.probe.now();
    seen.push(n);
    var look = seen[Math.max(0, seen.length - 1 - delayFrames)];
    var want = n.phase === "ride" && bot(look);
    if (want !== held && f - lastSwitch >= 6) {  /* 0.1秒より細かくは押し直せない */
      g.key(" ", !want);
      held = want; lastSwitch = f;
    }
    g.step(1); f++;
  }
  return g.probe.now();
}

var fails = 0;
function check(ok, label, detail) {
  console.log((ok ? "OK  " : "NG  ") + label + (detail ? "  " + detail : ""));
  if (!ok) fails++;
}

var idle = play(function () { return false; }, 0, 1);
check(idle.phase === "fall" && idle.eaten <= 1, "何もしないと倒れる", "食べた数 " + idle.eaten + "  結果 " + idle.score + "%");
var hold = play(function () { return true; }, 0, 1);
check(hold.phase === "fall" && hold.eaten <= 2, "押しっぱなしでも倒れる", "食べた数 " + hold.eaten);

function rate(delay, n) {
  var ok = 0, times = [];
  for (var i = 1; i <= n; i++) {
    var r = play(function (o) { return o.th + 0.5 * o.w > 0; }, delay, i * 7919);
    if (r.phase === "done") { ok++; times.push(r.score); }
  }
  var avg = times.length ? (times.reduce(function (a, b) { return a + b; }, 0) / times.length).toFixed(1) : "-";
  return { ok: ok, n: n, avg: avg };
}
var fast = rate(12, 20), mid = rate(18, 20), slow = rate(24, 20);
console.log("    反応0.2秒 " + fast.ok + "/20 平均" + fast.avg + "秒 / 0.3秒 " + mid.ok + "/20 平均" + mid.avg + "秒 / 0.4秒 " + slow.ok + "/20 平均" + slow.avg + "秒");
check(fast.ok >= 17, "反応0.2秒ならほぼ食べきれる");
check(slow.ok <= 16, "反応0.4秒ではときどき倒れる（簡単すぎない）");
check(/^\d+(\.\d)?$/.test(String(fast.avg)), "食べきると秒が出る");

process.exit(fails ? 1 : 0);
