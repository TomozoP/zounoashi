/* C力検査。遊びとして成立するかを数字で確かめる。

     node games/_tools/tests/c-ryoku.js

   見るところ
   ・開始画面ではつかめない
   ・エリアのCを触ったところでつかみ、ぶら下げると回る。Cはエリアの外へ持ち出せない
   ・離してエリアから出たら1投。エリアの下へ落としただけなら数えない
   ・相手のCに乗って止まってもクリア。丸い背から転げ落ちたり、外れて落ちたらクリアしない
   ・25段目（最後）だけ相手がC、ほかの段は「C」から始まる物がゴール（24段とも別のモチーフ）
   ・25段とも、実際につかんで運ぶ・振る操作で引っかけられる（物なら乗って止まってもよい）
   ・初めてクリアするたびにC力が上がり、上がる演出が出る。小さいCの段ほど多く上がり、全部で10.0。2回目は上がらない
   ・毎段クリアの画面になり、そのときのC力と「次」「シェア」が出る（暗くしない）
   ・クリアの画面はボタンの外を触っても進まず、「次」で次の段へ
   ・左上のボタンで段を選べる。最初から全部選べる
   ・投げるCは一覧のCと同じ向き（上下左右）と大きさ。下の行ほど小さい
   ・引っかけた段は保存され、次に開いたとき続きから始まる
   ・クリアすると紙吹雪が降り、しばらくすると消える
   ・つかんで動かしている間だけ、ドの音が動きに合わせてなめらかに鳴る
   ・Esc でいまの行の最初から */

var load = require("../harness");
var FILE = "games/c-ryoku/index.html";

var bad = [];
function ok(label, cond, extra) {
  console.log((cond ? "OK  " : "NG  ") + label + (extra ? "  " + extra : ""));
  if (!cond) bad.push(label);
}

/* 端末の保存場所の代わりを入れて開く。mem は保存済みの中身 */
function openWith(mem, extra) {
  /* 時計の段は今の時刻で針が変わるので、ふだんは10時10分に止めて確かめる */
  var inj = "CLOCK_FIX = 36600;" +
            "window.__mem = " + JSON.stringify(mem || {}) + ";" +
            "window.localStorage = { getItem: function (k) { return window.__mem[k] == null ? null : window.__mem[k]; }, setItem: function (k, v) { window.__mem[k] = String(v); } };" +
            "window.__probe.go = function (i) { newRound(i); }; window.__probe.startHidden = function () { return startButton.hidden; }; window.__probe.mem = function () { return window.__mem; };";
  return load(FILE, { quiet: true, inject: inj + (extra || "") });
}

/* 開くと段の一覧なので、閉じて今の段から遊ぶ */
function begin(g) {
  if (g.probe.now().sel) g.press(" ");
  g.step(2);
}
function settle(g) {
  g.drawn.length = 0;
  g.until(function () { var q = g.probe.now(); return q.clearing || q.state !== "play" || q.ball.idle; }, 900);
}
/* Cの縁の th 番目をつかみ、エリアの真ん中から指を (vx, vy) の速さでエリアの縁まで動かして離す */
function swing(g, th, vx, vy) {
  var p = g.probe.now(), b = p.ball, A = p.area;
  var gx = b.x + b.rm * Math.cos(th * Math.PI / 4 + b.a), gy = b.y + b.rm * Math.sin(th * Math.PI / 4 + b.a);
  g.down(gx, gy); g.step(10);
  var fx = gx, fy = gy, n = 0;
  while (fx > A.x + 8 && fx < A.x + A.w - 8 && fy > A.y + 8 && fy < A.y + A.h - 8 && n < 40) { fx += vx / 60; fy += vy / 60; g.moveTo(fx, fy); g.step(1); n++; }
  g.up();
}
/* Cの縁の th 番目をつかみ、エリアの下の横 sx の位置まで運んでぶら下げ、そこから指を (vx, vy) の速さで動かして離す */
function toss(g, th, sx, vx, vy) {
  var p = g.probe.now(), b = p.ball, A = p.area;
  var gx = b.x + b.rm * Math.cos(th * Math.PI / 4 + b.a), gy = b.y + b.rm * Math.sin(th * Math.PI / 4 + b.a);
  var hx = A.x + A.w * sx, hy = A.y + A.h - 20;
  g.down(gx, gy);
  for (var i = 1; i <= 15; i++) { g.moveTo(gx + (hx - gx) * i / 15, gy + (hy - gy) * i / 15); g.step(1); }
  g.step(40);
  var fx = hx, fy = hy, n = 0;
  while (fx > A.x + 8 && fx < A.x + A.w - 8 && fy > A.y + 8 && fy < A.y + A.h + 8 && n < 40) { fx += vx / 60; fy += vy / 60; g.moveTo(fx, fy); g.step(1); n++; }
  g.up();
}
/* いまの段を、運んで放る操作の総当たりで引っかけるまで試す。見つけた操作を返す */
function solve(g) {
  var idx = g.probe.now().stage;
  function done() { var q = g.probe.now(); return q.clearing || q.stage !== idx || q.state !== "play"; }
  for (var th = 0; th < 8; th += 2)
    for (var sx = 0.12; sx < 0.95; sx += 0.19)
      for (var vx = -1200; vx <= 1200; vx += 300) for (var vy = -2400; vy <= -600; vy += 300) {
        toss(g, th, sx, vx, vy); settle(g); if (done()) return "放る " + th + "/" + sx.toFixed(2) + "/" + vx + "/" + vy;
      }
  /* 粗い目で見つからなければ、細かい目で探す */
  for (th = 1; th < 8; th += 2)
    for (sx = 0.12; sx < 0.95; sx += 0.1)
      for (vx = -1200; vx <= 1200; vx += 200) for (vy = -2400; vy <= -600; vy += 200) {
        toss(g, th, sx, vx, vy); settle(g); if (done()) return "細かく放る " + th + "/" + sx.toFixed(2) + "/" + vx + "/" + vy;
      }
  for (th = 0; th < 8; th += 2)
    for (sx = 0.17; sx < 0.95; sx += 0.1)
      for (vx = -1100; vx <= 1100; vx += 200) for (vy = -2300; vy <= -600; vy += 200) {
        toss(g, th, sx, vx, vy); settle(g); if (done()) return "細かく放る " + th + "/" + sx.toFixed(2) + "/" + vx + "/" + vy;
      }
  return null;
}
function waitNext(g) { g.until(function () { return !g.probe.now().clearing; }, 200); }

/* ---- つかむ・運ぶ・離す（1段目：エリアは下、相手はその上） ---- */
(function () {
  var g = openWith({});
  var p0 = g.probe.now();
  var startSel = p0.sel && p0.state === "play" && g.probe.startHidden();
  g.down(p0.ball.x + 44, p0.ball.y); g.step(5); g.up();
  ok("STARTはなく、開くとすぐ段の一覧。一覧の間はつかめない", startSel && g.probe.now().ball.idle && !g.probe.now().grab);
  begin(g);
  var p = g.probe.now();
  ok("はじめてなら1段目から", p.state === "play" && p.stage === 0);
  ok("1段目はCが下のエリアで待ち、相手はその上", p.ball.y > p.area.y && p.ball.y < p.area.y + p.area.h && p.area.y > g.H / 2 && p.target.y < p.area.y);
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
  begin(g);
  g.probe.go(21); g.step(2);
  var p = g.probe.now();
  ok("22段目はCが下のエリア、相手はその上", p.ball.y > p.area.y && p.target.y < p.area.y);
  g.down(p.ball.x - p.ball.rm, p.ball.y); g.step(20);
  g.moveTo(p.area.x + p.area.w / 2, p.area.y + p.area.h - 10); g.step(40); g.up();
  settle(g);
  ok("エリアの中で落としただけなら数えず、次のCが出る", g.probe.now().throws === 0 && g.probe.now().ball.idle);
  swing(g, 0, 300, -2000);
  g.step(10);
  var q = g.probe.now();
  ok("振って離すとエリアの上へ飛んで1投", q.throws === 1 && !q.grab && q.ball.out, "vx " + Math.round(q.ball.vx) + " vy " + Math.round(q.ball.vy) + " 回転 " + q.ball.w.toFixed(1));
})();

/* ---- 相手のCに乗って止まる：エリアを上に移した台で、真下の相手へ落とす ---- */
var lastDrop = null;
function dropOnto(gap, miss) {
  var g = openWith({}, "AREA = [0.03, 0.3, 0.94, 0.25]; STAGES[0] = { t: [180, " + (miss ? 0.85 : 0.5) + ", 0.8, " + gap + "] };");
  lastDrop = g;
  begin(g);
  var p = g.probe.now(), b = p.ball, T = p.target;
  g.down(b.x - 44, b.y); g.step(5);
  var tx = miss ? 270 : T.x;
  for (var i = 1; i <= 20; i++) { g.moveTo(b.x - 44 + (tx - b.x + 44) * i / 20, b.y + (p.area.y + p.area.h - b.y) * i / 20); g.step(1); }
  g.step(300); g.up();
  return g.until(function () { return g.probe.now().clearing; }, 800);
}
(function () {
  ok("すき間が上の相手の中へ落ちて止まるとクリア", dropOnto(-90));
  ok("すき間の縁に乗って止まるとクリア", dropOnto(-60));
  var g = lastDrop;
  g.step(1);
  var n = g.probe.now().confetti;
  g.until(function () { return g.probe.now().confetti === 0; }, 600);
  ok("クリアすると紙吹雪が降り、しばらくすると消える", n > 0 && g.probe.now().confetti === 0, "枚数 " + n + " → " + g.probe.now().confetti);
  ok("丸い背に落ちて転げ落ちたらクリアしない", !dropOnto(90));
  ok("相手から外れて落ちたらクリアしない", !dropOnto(-90, true));
})();

/* ---- 動かしている間だけ、ドの音が動きに合わせて鳴る ---- */
(function () {
  var g = openWith({});
  begin(g);
  var p = g.probe.now(), b = p.ball;
  g.down(b.x - b.rm, b.y); g.step(60);
  var h0 = g.probe.now().hum, x = b.x - b.rm, slow = 0, fast = 0;
  for (var i = 0; i < 30; i++) { x += (i % 12 < 6 ? 6 : -6); g.moveTo(x, b.y); g.step(1); slow = Math.max(slow, g.probe.now().hum); }
  for (var j = 0; j < 30; j++) { x += (j % 12 < 6 ? 25 : -25); g.moveTo(x, b.y); g.step(1); fast = Math.max(fast, g.probe.now().hum); }
  g.step(60);
  var h1 = g.probe.now().hum;
  g.up();
  ok("動かしている間だけ鳴り、速いほど大きい。止めると消える", h0 < 0.01 && slow > 0.05 && fast > slow + 0.3 && h1 < 0.01,
     "止め " + h0.toFixed(2) + " ゆっくり " + slow.toFixed(2) + " 速く " + fast.toFixed(2) + " 止めた後 " + h1.toFixed(2));
})();

/* ---- 25段とも引っかけられる。毎段クリアの画面、次へ、保存 ---- */
(function () {
  var g = openWith({});
  begin(g);
  var found = [], scores = [], gains = [], completes = [], outsideOk = true, nextOk = true;
  function center(id) { var b = g.probe.buttons().filter(function (q) { return q.id === id; })[0]; return [b.x + b.w / 2, b.y + b.h / 2]; }
  for (var i = 0; i < 25; i++) {
    if (g.probe.now().stage !== i) { found.push(null); break; }
    var how = solve(g);
    found.push(how);
    if (!how) break;
    gains.push(g.probe.now().gain);
    waitNext(g);
    var r = g.probe.now();
    scores.push(r.state === "result" ? r.score : "×");
    completes.push(r.complete);
    if (r.state !== "result") break;
    if (i === 0) { g.tap(40, g.H - 40); g.step(2); if (g.probe.now().state !== "result") outsideOk = false; }
    if (i < 24) {
      var c = center("next"); g.tap(c[0], c[1]); g.step(2);
      if (!(g.probe.now().state === "play" && g.probe.now().stage === i + 1)) nextOk = false;
    }
  }
  var solved = found.filter(Boolean).length;
  ok("25段とも引っかけられる", solved === 25, solved + "段");
  found.forEach(function (h, i) { console.log("      " + (i + 1) + "段目  " + (h || "見つからない")); });
  ok("初めてのクリアではどの段もC力が上がる演出が出る", gains.length === 25 && gains.every(Boolean));
  ok("毎段クリアの画面になり、そのときのC力が出る（全部で10.0）", scores.length === 25 && scores[0] === "0.1" && scores[4] === "0.5" && scores[24] === "10.0", scores.filter(function (x, k) { return k % 5 === 4; }).join(" / "));
  ok("全段そろった回だけ「Complete」、それまでは文字なし", completes.length === 25 && completes[24] === true && completes.slice(0, 24).every(function (x) { return !x; }));
  ok("クリアの画面はボタンの外を触っても進まない", outsideOk);
  ok("「次」で次の段へ", nextOk);
  var m = JSON.parse(g.probe.mem()["zounoashi.c-ryoku.v1"] || "{}");
  ok("引っかけた段が保存される", m.c && m.c.length === 25);
  g.press(" "); g.step(2);
  ok("最後の段の「次」は最初の段へ（全部クリア済みのとき）", g.probe.now().state === "play" && g.probe.now().stage === 0);
  solve(g);
  ok("クリア済みの段をもう一度クリアしてもC力は上がらない", g.probe.now().clearing && !g.probe.now().gain && g.probe.now().power === "10.0");
  waitNext(g);
  ok("全部そろった後のやり直しは「Complete」にならない", g.probe.now().state === "result" && !g.probe.now().complete);
})();

/* ---- 時計の針は今の時刻 ---- */
(function () {
  var g = openWith({}, "CLOCK_FIX = 3 * 3600;");
  begin(g); g.probe.go(11); g.step(2);
  var kind = g.probe.now().objs[0].kind, h24 = g.probe.hands();
  var r = openWith({}, "CLOCK_FIX = null;");
  begin(r); r.probe.go(11); r.step(2);
  var d = new Date(), m = -90 + (d.getMinutes() + d.getSeconds() / 60) * 6, hr = r.probe.hands();
  ok("時計の針は時刻どおり（3時で長い針が上、短い針が右）", h24[0] === -90 && h24[1] === 0, h24.join("/"));
  ok("ふだんは端末の今の時刻を指す", Math.abs(((hr[0] - m) % 360 + 540) % 360 - 180) < 2, hr[0] + " / " + m.toFixed(0));
  ok("12段は枠のない時計（針だけ）", kind === "hands");
})();

/* ---- 12段は、どの時刻でも針に載せられる ---- */
(function () {
  var fails = [];
  ["2:00", "3:30", "6:30", "10:15"].forEach(function (tm) {
    var hm = tm.split(":"), g = openWith({}, "CLOCK_FIX = " + (hm[0] * 3600 + hm[1] * 60) + ";");
    begin(g); g.probe.go(11); g.step(2);
    var found = false;
    function done() { var q = g.probe.now(); return q.clearing || q.stage !== 11 || q.state !== "play"; }
    for (var th = 0; th < 8 && !found; th++)
      for (var sx = 0.12; sx < 0.95 && !found; sx += 0.08)
        for (var vx = -1200; vx <= 1200 && !found; vx += 150) for (var vy = -2400; vy <= -600 && !found; vy += 150) {
          toss(g, th, sx, vx, vy); settle(g); if (done()) found = true;
        }
    if (!found) fails.push(tm);
  });
  ok("12段は針が下を向く時刻でも載せられる", !fails.length, fails.join(" "));
})();

/* ---- 演出の覗き穴（F2・F4） ---- */
(function () {
  var g = openWith({ "zounoashi.c-ryoku.v1": JSON.stringify({ c: [0, 1, 2] }) });
  begin(g);
  g.press("F2"); g.step(1);
  var small = g.probe.now().confetti, st1 = g.probe.now().state;
  g.step(900);
  g.press("F4"); g.step(1);
  var r = g.probe.now();
  ok("F2でふつうの演出、F4で大合唱の紙吹雪と「Complete」の画面", small === 140 && st1 === "play" && r.confetti === 380 && r.state === "result" && r.complete, small + " / " + r.confetti);
  ok("演出の覗き穴は記録を変えない", r.cleared.length === 3 && r.power === g.probe.power([0, 1, 2]));
})();

/* ---- 段を選ぶ・続きから ---- */
(function () {
  var g = openWith({ "zounoashi.c-ryoku.v1": JSON.stringify({ c: [0, 1, 2, 3, 4, 5, 6] }) });
  ok("続きの段から始まり、まず段の一覧が開いている", g.probe.now().stage === 7 && g.probe.now().sel);
  g.press(" "); g.step(2);
  ok("行の途中の段から遊べる", g.probe.now().stage === 7 && g.probe.now().power === "0.9");
  var b = g.probe.selButton();
  g.tap(b.x + b.w / 2, b.y + b.h / 2); g.step(1);
  ok("左上のボタンで段の一覧が開く", g.probe.now().sel);
  var cells = g.probe.selCells();
  ok("一覧のマスはスマホで押せる大きさ", cells.every(function (c) { return c.w >= 63 && c.h >= 63; }), "高さ " + Math.round(cells[0].h));
  var far = cells[22];
  g.tap(far.x + far.w / 2, far.y + far.h / 2); g.step(1);
  ok("前の段をクリアしていない段は選べない", g.probe.now().sel && g.probe.now().stage === 7);
  var c7 = cells[7], c8 = cells[8];
  g.tap(c8.x + c8.w / 2, c8.y + c8.h / 2); g.step(1);
  var locked8 = g.probe.now().sel;
  g.tap(c7.x + c7.w / 2, c7.y + c7.h / 2); g.step(1);
  ok("次にクリアする段までは選べる", locked8 && !g.probe.now().sel && g.probe.now().stage === 7);
  g.tap(b.x + b.w / 2, b.y + b.h / 2); g.step(1);
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
  begin(g);
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
  ok("25段目だけ相手がC、ほかは物がひとつだけのゴール", cAt.join() === "25" && goals.every(Boolean), goals.join(" "));
  var kinds = goals.filter(function (k) { return k !== "C"; });
  ok("物のゴールは24段とも別のモチーフ", kinds.length === 24 && kinds.every(function (k, i) { return kinds.indexOf(k) === i; }), kinds.length + "種類");
  ok("エリアはどの段も画面の下半分", low);
})();

/* ---- C力の上がり幅と、投げるCの向き・大きさ ---- */
(function () {
  var g = openWith({});
  var all = []; for (var i = 0; i < 25; i++) all.push(i);
  ok("C力は小さいCの段ほど多く上がり、全部で10.0", g.probe.power([]) === "0.0" && g.probe.power([0]) === "0.1" && g.probe.power([24]) === "0.8" && g.probe.power(all) === "10.0");
  begin(g);
  var same = true, dirs = true, cells = g.probe.selCells(), prev = 1e9;
  for (var k = 0; k < 25; k++) {
    g.probe.go(k); g.step(1);
    var q = g.probe.now();
    if (q.ball.D !== g.probe.size(k) || Math.abs(q.ball.a - g.probe.dir(k) * Math.PI / 180) > 1e-9) same = false;
    if ([0, -90, 90, 180].indexOf(g.probe.dir(k)) < 0) dirs = false;
    if (k % 5 === 0) { if (!(cells[k].d < prev)) same = false; prev = cells[k].d; }
    if (Math.abs(cells[k].d / cells[0].d - q.ball.D / g.probe.size(0)) > 0.02) same = false;
  }
  ok("投げるCは一覧のCと同じ向き・大きさで、下の行ほど小さい", same);
  ok("向きは上下左右だけ", dirs);
})();

if (bad.length) { console.log("\nNG " + bad.length + "件"); process.exit(1); }
console.log("\nぜんぶOK");
