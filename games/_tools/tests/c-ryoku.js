/* C力検査。遊びとして成立するかを数字で確かめる。

     node games/_tools/tests/c-ryoku.js

   見るところ
   ・開始画面ではフリックしても投げない
   ・上へはじくと投げる。ただのタップや下向きでは投げない
   ・投げたCが相手のCに引っかかると次の段へ進み、相手は小さくなる
   ・外れたCは画面の外へ落ち、次のCが用意される（回数は増える）
   ・5段とも、実際のフリックで引っかけられる投げ方がある
   ・5段を終えると結果画面で、投げた回数に応じたC力が出る
   ・Esc で最初から */

var load = require("../harness");
var FILE = "games/_c-ryoku/index.html";

var bad = [];
function ok(label, cond, extra) {
  console.log((cond ? "OK  " : "NG  ") + label + (extra ? "  " + extra : ""));
  if (!cond) bad.push(label);
}

/* 投げたい速さ (vx, vy) になるように、4コマかけて指を動かして離す */
function flick(g, vx, vy) {
  var x = 270, y = g.H - 120, f = 1 / 60 / 0.9;
  g.down(x, y);
  for (var k = 1; k <= 3; k++) { g.step(1); g.moveTo(x + vx * f * k, y + vy * f * k); }
  g.step(1);
  g.up(x + vx * f * 4, y + vy * f * 4);
}
/* 投げる前のCの向きが k（45°刻み）になるまで待つ */
function waitDir(g, k) {
  return g.until(function () {
    var a = g.probe.now().ball.a;
    return Math.abs(a - k * Math.PI / 4) < 1e-6;
  }, 120);
}
/* 相手のCの中心から dh 上まで上がり、横は dvx だけずらす速さ */
function speed(p, dvx, dh) {
  var h = p.launch.y - p.target.y + dh;
  var vy = -Math.sqrt(2 * 1800 * h), t = -vy / 1800;
  return [(p.target.x - p.launch.x) / t + dvx, vy];
}
function settle(g) {
  g.until(function () { var q = g.probe.now(); return q.clearing || q.state !== "play" || !q.ball.flying; }, 900);
}

/* ---- 開始前・投げない操作 ---- */
(function () {
  var g = load(FILE, { quiet: true });
  flick(g, 0, -1500); g.step(5);
  ok("開始前のフリックでは投げない", g.probe.now().state === "intro" && g.probe.now().throws === 0);
  g.press(" "); g.step(2);
  ok("スペースで開始", g.probe.now().state === "play");
  g.tap(270, 700); g.step(5);
  ok("ただのタップでは投げない", g.probe.now().throws === 0 && !g.probe.now().ball.flying);
  flick(g, 0, 1200); g.step(5);
  ok("下へはじいても投げない", g.probe.now().throws === 0);
  flick(g, 900, -900); g.step(3);
  var p = g.probe.now();
  ok("上へはじくと投げる", p.throws === 1 && p.ball.flying && p.ball.vy < 0, "vx " + Math.round(p.ball.vx) + " vy " + Math.round(p.ball.vy));
  settle(g);
  p = g.probe.now();
  ok("外れたら次のCが用意される", !p.ball.flying && p.stage === 0 && p.throws === 1);
  g.press("Escape"); g.step(2);
  ok("Esc で最初から", g.probe.now().throws === 0 && g.probe.now().stage === 0);
})();

/* ---- 5段とも、フリックで引っかけられる ---- */
(function () {
  var g = load(FILE, { quiet: true });
  g.press(" "); g.step(2);
  var sizes = [], found = [];
  for (var stage = 0; stage < 5; stage++) {
    var p = g.probe.now();
    sizes.push(p.target.D);
    var hit = null;
    search:
    for (var dh = 0; dh <= 420; dh += 30) for (var dvx = -300; dvx <= 300; dvx += 30) for (var k = 0; k < 8; k++) {
      /* まず速さだけで当たりそうかを見る代わりに、実際に投げて確かめる */
      p = g.probe.now();
      if (!waitDir(g, k)) continue;
      var v = speed(p, dvx, dh);
      flick(g, v[0], v[1]);
      settle(g);
      if (g.probe.now().clearing) { hit = [k, dvx, dh].join("/"); break search; }
      if (g.probe.now().throws > 3000) break search;
    }
    found.push(hit);
    if (!hit) break;
    g.until(function () { var q = g.probe.now(); return !q.clearing; }, 200);
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
