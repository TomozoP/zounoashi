/* C力検査。遊びとして成立するかを数字で確かめる。

     node games/_tools/tests/c-ryoku.js

   見るところ
   ・開始画面ではつかめない
   ・下のエリアのCを触ったところでつかみ、ぶら下げると回る。Cはエリアの外へ持ち出せない
   ・エリアの中で落としただけでは数えない。振って上へ飛ばすと1投
   ・投げたCが相手のCに引っかかると次の段へ進み、相手は小さくなる
   ・5段とも、実際につかんで振る操作で引っかけられる投げ方がある
   ・5段を終えると結果画面で、投げた回数に応じたC力が出る
   ・Esc で最初から */

var load = require("../harness");
var FILE = "games/_c-ryoku/index.html";

var bad = [];
function ok(label, cond, extra) {
  console.log((cond ? "OK  " : "NG  ") + label + (extra ? "  " + extra : ""));
  if (!cond) bad.push(label);
}

function settle(g) {
  g.until(function () { var q = g.probe.now(); return q.clearing || q.state !== "play" || q.ball.idle; }, 900);
}
/* Cの縁の th 番目（45°刻み）の点をつかんで少しぶら下げ、指を (vx, vy) の速さでエリアの上まで動かして離す */
function swing(g, th, vx, vy) {
  var p = g.probe.now(), b = p.ball, A = p.area;
  var gx = b.x + 44 * Math.cos(th * Math.PI / 4 + b.a), gy = b.y + 44 * Math.sin(th * Math.PI / 4 + b.a);
  g.down(gx, gy); g.step(10);
  var fx = gx, fy = gy;
  while (fy > A.y + 10) { fx += vx / 60; fy += vy / 60; g.moveTo(fx, fy); g.step(1); }
  g.up();
}

/* ---- つかむ・振る・離す ---- */
(function () {
  var g = load(FILE, { quiet: true });
  var p0 = g.probe.now();
  g.down(p0.ball.x + 44, p0.ball.y); g.step(5); g.up();
  ok("開始前はつかめない", g.probe.now().state === "intro" && g.probe.now().ball.idle);
  g.press(" "); g.step(2);
  ok("スペースで開始", g.probe.now().state === "play");
  var p = g.probe.now();
  ok("Cは下のエリアの中で待つ", p.ball.y > p.area.y && p.ball.y < p.area.y + p.area.h && p.target.y < p.area.y);
  g.down(p.ball.x + 150, p.ball.y - 150); g.step(30); g.up();
  ok("Cから離れたところを触ってもつかまない", g.probe.now().ball.idle);
  g.down(p.ball.x - 44, p.ball.y + 3); g.step(1);
  var q = g.probe.now();
  ok("触ったところでつかむ", q.grab && Math.abs(q.grab.lx + 44) < 1 && Math.abs(q.grab.ly - 3) < 1);
  g.up(); settle(g);
  g.down(p.ball.x + 44, p.ball.y); g.step(1);
  q = g.probe.now();
  var gd = Math.hypot(q.grab.lx, q.grab.ly);
  ok("すき間を触ると近くの線の上をつかむ", Math.abs(gd - 44) < 7 && Math.abs(Math.atan2(q.grab.ly, q.grab.lx)) > 0.6);
  g.step(40);
  q = g.probe.now();
  ok("端をつかむと重さでぶら下がって回る", Math.abs(q.ball.a) > 0.5, "角度 " + (q.ball.a * 180 / Math.PI).toFixed(0) + "°");
  g.moveTo(q.ball.x, 10); g.step(20);
  q = g.probe.now();
  ok("指をエリアの外へ出してもCはエリアに残る", q.grab.py === q.area.y && q.ball.y > q.area.y - 60, "Cの中心 " + Math.round(q.ball.y) + " / エリア上端 " + q.area.y);
  g.moveTo(q.area.x + q.area.w / 2, q.area.y + q.area.h - 10); g.step(40); g.up();
  settle(g);
  ok("エリアの中で落としただけなら数えず、次のCが出る", g.probe.now().throws === 0 && g.probe.now().ball.idle);
  swing(g, 0, 300, -2000);
  g.step(20);
  q = g.probe.now();
  ok("振って離すとエリアの上へ飛んで1投", q.throws === 1 && !q.grab && q.ball.out, "vx " + Math.round(q.ball.vx) + " vy " + Math.round(q.ball.vy) + " 回転 " + q.ball.w.toFixed(1));
  settle(g);
  g.press("Escape"); g.step(2);
  ok("Esc で最初から", g.probe.now().throws === 0 && g.probe.now().stage === 0);
})();

/* ---- 5段とも、つかんで投げて引っかけられる ---- */
(function () {
  var g = load(FILE, { quiet: true });
  g.press(" "); g.step(2);
  var sizes = [], found = [];
  for (var stage = 0; stage < 5; stage++) {
    sizes.push(g.probe.now().target.D);
    var hit = null;
    search:
    for (var th = 0; th < 8; th++) for (var vx = -900; vx <= 900; vx += 150) for (var vy = -2400; vy <= -1200; vy += 150) {
      swing(g, th, vx, vy);
      settle(g);
      if (g.probe.now().clearing) { hit = [th, vx, vy].join("/"); break search; }
    }
    found.push(hit);
    if (!hit) break;
    g.until(function () { return !g.probe.now().clearing; }, 200);
  }
  ok("5段とも引っかけられる", found.length === 5 && found.every(Boolean), found.join("  "));
  ok("段が進むと相手のCが小さくなる", sizes.every(function (d, i) { return i === 0 || d < sizes[i - 1]; }), sizes.join(" > "));
  var r = g.probe.now();
  ok("5段で結果画面", r.state === "result", "投げた回数 " + r.throws + " → C力 " + r.score);
  g.press(" "); g.step(2);
  ok("もう一度で1段目から", g.probe.now().state === "play" && g.probe.now().stage === 0 && g.probe.now().throws === 0);
})();

/* ---- 回数とC力 ---- */
(function () {
  var g = load(FILE, { quiet: true });
  var t = g.probe.table();
  ok("最少の5回でC力 2.0", t[0][0] === 5 && t[0][1] === "2.0");
  ok("回数が増えるほどC力は下がる", t.every(function (r, i) { return i === 0 || (r[0] > t[i - 1][0] && +r[1] < +t[i - 1][1]); }));
})();

if (bad.length) { console.log("\nNG " + bad.length + "件"); process.exit(1); }
console.log("\nぜんぶOK");
