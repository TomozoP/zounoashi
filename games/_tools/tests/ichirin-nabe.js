/* 一輪車で鍋：遊びとして成り立つかを、人の反応の遅れをまねた自動運転で測る。
     node games/_tools/tests/ichirin-nabe.js
   操作は ← → で体を傾け、スペース（真ん中）で食べる。段階はコーヒー・ラーメン・鍋の3つ。
   体は車輪の上に立てた棒として動く（ボタンは車輪を加速させるだけ）ので、かなり尖った辛さ。
   見るもの
     - 何もしない・片側を押しっぱなしでは、すぐ倒れる
     - 食べずに乗るだけなら、反応0.2秒で20秒もつ。0.3秒では数秒で倒れる
     - ラーメン：反応0.16〜0.2秒で熱さを待って食べれば、ときどき食べきれる。0.24秒ではほぼ無理
     - コーヒー：反応0.24秒でもほぼ飲みきれる
     - 鍋：ラーメンよりはっきり辛い。反応0.16秒でたまに食べきれる
     - 開始画面で ← → を押すと段階が変わる
     - 食べるボタンを連打すると熱くなって倒れやすい
     - タップの列で左右・食べるが分かれる */
var load = require("../harness");
var FILE = "games/_ichirin-nabe/index.html";

function play(opt, seed) {
  var s = seed;
  Math.random = function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
  var g = load(FILE);
  g.press(" ");                                  /* 開始 */
  if (opt.level) g.probe.reset(opt.level);       /* 段階を選んで始める */
  var seen = [], now = 0, last = -99, f = 0, max = opt.frames || 60 * 90;
  while (g.probe.now().state !== "result" && f < max) {
    var n = g.probe.now();
    seen.push(n);
    var o = seen[Math.max(0, seen.length - 1 - (opt.delay || 0))];
    var want = n.phase === "ride" ? opt.lean(o) : 0;
    if (want !== now && f - last >= 6) {         /* 0.1秒より細かくは押し直せない */
      if (now) g.key(now < 0 ? "ArrowLeft" : "ArrowRight", true);
      if (want) g.key(want < 0 ? "ArrowLeft" : "ArrowRight");
      now = want; last = f;
    }
    if (n.phase === "ride" && opt.eat && opt.eat(o, n)) g.press(" ");
    g.step(1); f++;
  }
  return g.probe.now();
}

var fails = 0;
function check(ok, label, detail) {
  console.log((ok ? "OK  " : "NG  ") + label + (detail ? "  " + detail : ""));
  if (!ok) fails++;
}
function lean(o) { var sv = o.th + 0.35 * o.w; return sv > 0.03 ? -1 : sv < -0.03 ? 1 : 0; }
function calm(o, n) { return !n.biting && Math.abs(o.th) < 0.1 && n.burn < 0.4; }

var idle = play({ lean: function () { return 0; } }, 1);
check(idle.phase === "fall", "何もしないと倒れる", idle.T.toFixed(1) + "秒で");
var hold = play({ lean: function () { return -1; } }, 1);
check(hold.phase === "fall", "左を押しっぱなしでも倒れる", hold.T.toFixed(1) + "秒で");
var keep = play({ lean: lean, delay: 12, frames: 60 * 20 }, 1);
check(keep.state === "play" && keep.phase === "ride", "食べずに乗るだけなら反応0.2秒で20秒もつ");
var late = play({ lean: lean, delay: 18, frames: 60 * 20 }, 1);
check(late.phase === "fall" && late.T < 10, "反応0.3秒では乗るだけでも倒れる", late.T.toFixed(1) + "秒で");

function rate(delay, eat, n, level) {
  var ok = 0, times = [];
  for (var i = 1; i <= n; i++) {
    var r = play({ lean: lean, delay: delay, eat: eat, level: level }, i * 7919);
    if (r.phase === "done") { ok++; times.push(r.score); }
  }
  var avg = times.length ? (times.reduce(function (a, b) { return a + b; }, 0) / times.length).toFixed(1) : "-";
  return { ok: ok, avg: avg, txt: ok + "/" + n + " 平均" + avg + "秒" };
}
var fast = rate(10, calm, 20, "ramen"), mid = rate(12, calm, 20, "ramen"), slow = rate(15, calm, 20, "ramen");
var spam = rate(12, function (o, n) { return !n.biting; }, 20, "ramen");
console.log("    ラーメン 待って食べる  反応0.16秒 " + fast.txt + " / 0.2秒 " + mid.txt + " / 0.24秒 " + slow.txt);
console.log("    ラーメン 連打で食べる  反応0.16秒 " + spam.txt);
check(fast.ok >= 8 && mid.ok >= 5, "ラーメン：反応0.2秒前後で待って食べれば、ときどき食べきれる");
check(slow.ok <= 6, "ラーメン：反応0.24秒ではほぼ食べきれない");
check(spam.ok < fast.ok, "ラーメン：連打すると待って食べるより倒れやすい");

var cof = rate(15, calm, 20, "coffee");
var nabe = rate(10, calm, 20, "nabe"), nabe2 = rate(12, calm, 20, "nabe");
console.log("    コーヒー 反応0.24秒 " + cof.txt);
console.log("    鍋       反応0.16秒 " + nabe.txt + " / 0.2秒 " + nabe2.txt);
check(cof.ok >= 15, "コーヒー：反応0.24秒でもほぼ飲みきれる");
check(nabe.ok >= 2 && nabe.ok < fast.ok, "鍋：ラーメンより辛いが、反応0.16秒でたまに食べきれる");

/* 開始画面で段階を選ぶ */
var gs = load(FILE);
gs.key("ArrowLeft"); gs.key("ArrowLeft", true);
check(gs.probe.now().level === "coffee", "開始画面で ← を押すとコーヒー");
gs.key("ArrowRight"); gs.key("ArrowRight", true); gs.key("ArrowRight"); gs.key("ArrowRight", true);
gs.press(" "); gs.step(1);
check(gs.probe.now().state === "play" && gs.probe.now().level === "nabe" && gs.probe.now().N === 20, "→ を2回押して始めると鍋");

/* タップの列 */
var g = load(FILE);
g.press(" ");
g.down(60, 400); g.step(1);
check(g.probe.now().dir === -1, "左の列をタップすると ←");
g.up(); g.down(480, 400); g.step(1);
check(g.probe.now().dir === 1, "右の列をタップすると →");
g.up(); g.step(1);
check(g.probe.now().dir === 0, "離すと止まる");
g.tap(270, 400); g.step(1);
check(g.probe.now().biting, "真ん中をタップすると食べる");

process.exit(fails ? 1 : 0);
