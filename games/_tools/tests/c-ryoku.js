/* C力検査。遊びとして成立するかを数字で確かめる。

     node games/_tools/tests/c-ryoku.js

   見るところ
   ・開始画面ではつかめない
   ・エリアのCを触ったところでつかみ、ぶら下げると回る。Cはエリアの外へ持ち出せない
   ・離してエリアから出たら1投。エリアの下へ落としただけなら数えない
   ・相手のCに乗って止まってもクリア。丸い背から転げ落ちたらクリアしない
   ・1・10・20・25段は相手がC、ほかの段は「C」から始まる物がゴール
   ・25段とも、実際につかんで運ぶ・振る操作で引っかけられる（物なら乗って止まってもよい）
   ・初めてクリアするたびにC力が0.1上がり、上がる演出が出る。2回目は上がらない
   ・行の終わりで結果画面になり、そのときのC力が出る
   ・結果画面でボタンの外を触ると次の行へ、もう一度でその行の最初から
   ・左上のボタンで段を選べる。まだ選べない段は選べない
   ・引っかけた段は保存され、次に開いたとき続きから始まる
   ・Esc でいまの行の最初から */

var load = require("../harness");
var FILE = "games/_c-ryoku/index.html";

var bad = [];
function ok(label, cond, extra) {
  console.log((cond ? "OK  " : "NG  ") + label + (extra ? "  " + extra : ""));
  if (!cond) bad.push(label);
}

/* 端末の保存場所の代わりを入れて開く。mem は保存済みの中身 */
function openWith(mem, extra) {
  var inj = "window.__mem = " + JSON.stringify(mem || {}) + ";" +
            "window.localStorage = { getItem: function (k) { return window.__mem[k] == null ? null : window.__mem[k]; }, setItem: function (k, v) { window.__mem[k] = String(v); } };" +
            "window.__probe.go = function (i) { newRound(i); }; window.__probe.mem = function () { return window.__mem; };";
  return load(FILE, { quiet: true, inject: inj + (extra || "") });
}

function settle(g) {
  g.drawn.length = 0;
  g.until(function () { var q = g.probe.now(); return q.clearing || q.state !== "play" || q.ball.idle; }, 900);
}
/* Cの縁の th 番目（45°刻み）をつかみ、エリアの相手側の縁の割合 f の位置まで運んで、ぶら下げてから離す */
function carry(g, th, f) {
  var p = g.probe.now(), b = p.ball, A = p.area, T = p.target;
  var gx = b.x + 44 * Math.cos(th * Math.PI / 4 + b.a), gy = b.y + 44 * Math.sin(th * Math.PI / 4 + b.a);
  var hx = A.x + A.w * f, hy = T.y > A.y + A.h ? A.y + A.h - 70 : A.y + 60;
  g.down(gx, gy);
  for (var i = 1; i <= 20; i++) { g.moveTo(gx + (hx - gx) * i / 20, gy + (hy - gy) * i / 20); g.step(1); }
  g.step(50);
  g.up();
}
/* Cの縁の th 番目をつかみ、エリアの真ん中から指を (vx, vy) の速さでエリアの縁まで動かして離す */
function swing(g, th, vx, vy) {
  var p = g.probe.now(), b = p.ball, A = p.area;
  var gx = b.x + 44 * Math.cos(th * Math.PI / 4 + b.a), gy = b.y + 44 * Math.sin(th * Math.PI / 4 + b.a);
  g.down(gx, gy); g.step(10);
  var fx = gx, fy = gy, n = 0;
  while (fx > A.x + 8 && fx < A.x + A.w - 8 && fy > A.y + 8 && fy < A.y + A.h - 8 && n < 40) { fx += vx / 60; fy += vy / 60; g.moveTo(fx, fy); g.step(1); n++; }
  g.up();
}
/* いまの段を、運ぶ・振るの総当たりで引っかけるまで試す。見つけた操作を返す */
function solve(g) {
  var idx = g.probe.now().stage;
  function done() { var q = g.probe.now(); return q.clearing || q.stage !== idx || q.state !== "play"; }
  for (var th = 0; th < 8; th++) {
    for (var f = 0.05; f <= 0.951; f += 0.075) { carry(g, th, f); settle(g); if (done()) return "運ぶ " + th + "/" + f.toFixed(2); }
    for (var vx = -1500; vx <= 1500; vx += 250) for (var vy = -2400; vy <= 600; vy += 300) {
      swing(g, th, vx, vy); settle(g); if (done()) return "振る " + th + "/" + vx + "/" + vy;
    }
  }
  return null;
}
function waitNext(g) { g.until(function () { return !g.probe.now().clearing; }, 200); }

/* ---- つかむ・運ぶ・離す（1段目：エリアは左下、相手は右の低いところ） ---- */
(function () {
  var g = openWith({});
  var p0 = g.probe.now();
  g.down(p0.ball.x + 44, p0.ball.y); g.step(5); g.up();
  ok("開始前はつかめない", g.probe.now().state === "intro" && g.probe.now().ball.idle);
  g.press(" "); g.step(2);
  var p = g.probe.now();
  ok("はじめてなら1段目から", p.state === "play" && p.stage === 0);
  ok("1段目はCが下のエリアで待ち、相手はその右", p.ball.y > p.area.y && p.ball.y < p.area.y + p.area.h && p.area.y > g.H / 2 && p.target.x > p.area.x + p.area.w);
  g.down(p.ball.x + 150, p.ball.y + 150); g.step(30); g.up();
  ok("Cから離れたところを触ってもつかまない", g.probe.now().ball.idle);
  g.down(p.ball.x - 44, p.ball.y + 3); g.step(1);
  var q = g.probe.now();
  ok("触ったところでつかむ", q.grab && Math.abs(q.grab.lx + 44) < 1 && Math.abs(q.grab.ly - 3) < 1);
  g.step(40);
  q = g.probe.now();
  ok("端をつかむと重さでぶら下がって回る", Math.abs(q.ball.a) > 0.5, "角度 " + (q.ball.a * 180 / Math.PI).toFixed(0) + "°");
  g.moveTo(q.ball.x, g.H - 10); g.step(30);
  q = g.probe.now();
  ok("指をエリアの外へ出してもCはエリアに残る", q.grab.py === q.area.y + q.area.h && q.ball.y < q.area.y + q.area.h + 60 && q.throws === 0,
     "Cの中心 " + Math.round(q.ball.y) + " / エリア下端 " + (q.area.y + q.area.h));
  g.up(); g.step(30);
  ok("離して下へ落ちただけなら数えない", g.probe.now().throws === 0);
  settle(g);
  g.down(g.probe.now().ball.x + 44, g.probe.now().ball.y); g.step(1);
  q = g.probe.now();
  var gd = Math.hypot(q.grab.lx, q.grab.ly);
  ok("すき間を触ると近くの線の上をつかむ", Math.abs(gd - 44) < 7 && Math.abs(Math.atan2(q.grab.ly, q.grab.lx)) > 0.6);
  g.up(); settle(g);
  g.press("Escape"); g.step(2);
  ok("Esc でいまの行の最初から", g.probe.now().rowThrows === 0 && g.probe.now().stage === 0);
})();

/* ---- 相手が上の段：振って投げ上げると1投 ---- */
(function () {
  var g = openWith({});
  g.press(" "); g.step(2);
  g.probe.go(21); g.step(2);
  var p = g.probe.now();
  ok("22段目はCが下のエリア、相手はその上", p.ball.y > p.area.y && p.target.y < p.area.y);
  g.down(p.ball.x - 44, p.ball.y); g.step(20);
  g.moveTo(p.area.x + p.area.w / 2, p.area.y + p.area.h - 10); g.step(40); g.up();
  settle(g);
  ok("エリアの中で落としただけなら数えず、次のCが出る", g.probe.now().throws === 0 && g.probe.now().ball.idle);
  swing(g, 0, 300, -2000);
  g.step(10);
  var q = g.probe.now();
  ok("振って離すとエリアの上へ飛んで1投", q.throws === 1 && !q.grab && q.ball.out, "vx " + Math.round(q.ball.vx) + " vy " + Math.round(q.ball.vy) + " 回転 " + q.ball.w.toFixed(1));
})();

/* ---- 相手のCに乗って止まる：真上に置いた相手へ落とす ---- */
function dropOnto(gap) {
  var g = openWith({}, "STAGES[0] = { area: [0.03, 0.3, 0.94, 0.25], t: [180, 0.5, 0.8, " + gap + "], o: [] };");
  g.press(" "); g.step(2);
  var p = g.probe.now(), b = p.ball, T = p.target;
  g.down(b.x - 44, b.y); g.step(5);
  for (var i = 1; i <= 20; i++) { g.moveTo(b.x - 44 + (T.x - b.x + 44) * i / 20, b.y + (p.area.y + p.area.h - b.y) * i / 20); g.step(1); }
  g.step(300); g.up();
  return g.until(function () { return g.probe.now().clearing; }, 400);
}
(function () {
  ok("すき間が上の相手の中へ落ちて止まるとクリア", dropOnto(-90));
  ok("すき間の縁に乗って止まるとクリア", dropOnto(-60));
  ok("丸い背に落ちて転げ落ちたらクリアしない", !dropOnto(90));
})();

/* ---- 25段とも引っかけられる。行の終わりで結果、保存 ---- */
(function () {
  var g = openWith({});
  g.press(" "); g.step(2);
  var found = [], results = [], gains = [];
  for (var i = 0; i < 25; i++) {
    if (g.probe.now().stage !== i) { found.push(null); break; }
    var how = solve(g);
    found.push(how);
    if (!how) break;
    gains.push(g.probe.now().gain);
    waitNext(g);
    if (i % 5 === 4) {
      var r = g.probe.now();
      results.push(r.state === "result" ? r.score : "×");
      if (r.state === "result" && i < 24) { g.tap(270, 160); g.step(2); }   /* ボタンの外を触って次の行へ */
    }
  }
  var solved = found.filter(Boolean).length;
  ok("25段とも引っかけられる", solved === 25, solved + "段");
  found.forEach(function (h, i) { console.log("      " + (i + 1) + "段目  " + (h || "見つからない")); });
  ok("初めてのクリアではどの段もC力が上がる演出が出る", gains.length === 25 && gains.every(Boolean));
  ok("行の終わりごとに結果画面でC力が出る（0.1 × クリアした段）", results.join("/") === "0.5/1.0/1.5/2.0/2.5", results.join(" / "));
  var m = JSON.parse(g.probe.mem()["zounoashi.c-ryoku.v1"] || "{}");
  ok("引っかけた段が保存される", m.c && m.c.length === 25);
  g.press(" "); g.step(2);
  ok("もう一度でその行の最初から", g.probe.now().state === "play" && g.probe.now().stage === 20 && g.probe.now().rowThrows === 0);
  solve(g);
  ok("クリア済みの段をもう一度クリアしてもC力は上がらない", g.probe.now().clearing && !g.probe.now().gain && g.probe.now().power === "2.5");
})();

/* ---- 段を選ぶ・続きから ---- */
(function () {
  var g = openWith({ "zounoashi.c-ryoku.v1": JSON.stringify({ c: [0, 1, 2, 3, 4, 5, 6] }) });
  ok("続きの段から始まる", g.probe.now().stage === 7);
  g.press(" "); g.step(2);
  ok("行の途中の段から遊べる", g.probe.now().stage === 7 && g.probe.now().power === "0.7");
  var b = g.probe.selButton();
  g.tap(b.x + b.w / 2, b.y + b.h / 2); g.step(1);
  ok("左上のボタンで段の一覧が開く", g.probe.now().sel);
  var cells = g.probe.selCells();
  ok("一覧のマスはスマホで押せる大きさ", cells.every(function (c) { return c.w >= 63 && c.h >= 63; }), "高さ " + Math.round(cells[0].h));
  var locked = cells[12];
  g.tap(locked.x + locked.w / 2, locked.y + locked.h / 2); g.step(1);
  ok("まだ選べない段は選べない", g.probe.now().sel && g.probe.now().stage === 7);
  var c2 = cells[2];
  g.tap(c2.x + c2.w / 2, c2.y + c2.h / 2); g.step(2);
  ok("引っかけた段を選べる", !g.probe.now().sel && g.probe.now().stage === 2 && g.probe.now().ball.idle);
  g.tap(b.x + b.w / 2, b.y + b.h / 2); g.step(1);
  g.tap(270, 10); g.step(1);
  ok("一覧の外を触ると閉じる", !g.probe.now().sel && g.probe.now().stage === 2);
  var c5 = cells[5];
  g.tap(b.x + b.w / 2, b.y + b.h / 2); g.step(1);
  g.tap(c5.x + c5.w / 2, c5.y + c5.h / 2); g.step(2);
  ok("行の最初を選べる", g.probe.now().stage === 5);
})();

/* ---- 物の配置：エリアと重ならない。序盤は物なし。エリアは下 ---- */
(function () {
  var g = openWith({});
  g.press(" "); g.step(2);
  var clash = [], goals = [], low = true;
  for (var i = 0; i < 25; i++) {
    g.probe.go(i); g.step(1);
    var p = g.probe.now(), A = p.area;
    goals.push(p.target.kind ? p.objs.length === 1 && p.target.kind : (p.objs.length === 0 && "C"));
    if (A.y < g.H / 2) low = false;
    p.objs.forEach(function (o) {
      var nx = Math.max(A.x, Math.min(A.x + A.w, o.x)), ny = Math.max(A.y, Math.min(A.y + A.h, o.y));
      if (o.R && Math.hypot(nx - o.x, ny - o.y) < o.R * 0.6) clash.push((i + 1) + "段目の" + o.kind);
    });
    var sb = g.probe.selButton();
    if (A.y < sb.y + sb.h && A.x < sb.x + sb.w) clash.push((i + 1) + "段目のエリアと左上のボタン");
  }
  ok("物がエリアに食い込まない", clash.length === 0, clash.join(" "));
  var cAt = goals.map(function (k, i) { return k === "C" ? i + 1 : 0; }).filter(Boolean);
  ok("1・10・20・25段は相手がC、ほかは物がひとつだけのゴール", cAt.join() === "1,10,20,25" && goals.every(Boolean), goals.join(" "));
  ok("エリアはどの段も画面の下半分", low);
})();

/* ---- C力はクリアした段の数 × 0.1 ---- */
(function () {
  var g = openWith({});
  ok("C力は 0.0 から 2.5 まで0.1刻み", g.probe.power(0) === "0.0" && g.probe.power(1) === "0.1" && g.probe.power(10) === "1.0" && g.probe.power(25) === "2.5");
})();

if (bad.length) { console.log("\nNG " + bad.length + "件"); process.exit(1); }
console.log("\nぜんぶOK");
