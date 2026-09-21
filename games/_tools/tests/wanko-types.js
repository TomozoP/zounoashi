/* わんこ爆弾解除を、偽のDOMの上で自動運転して確かめる */
var load = require("../harness");
var hook =
  'window.__dbg = {\n' +
  '  only: function (k) { TYPE_KEYS.length = 0; TYPE_KEYS.push(k); },\n' +
  '  all: function () { return ["wire","color","sw","screw","dial","time","pump","hold","trace","keypad"]; },\n' +
  '  now: function () { return { state: (state === "play" && !live().length) ? "serve" : state, key: bomb.key, bomb: bomb, cur: cur, score: score, fuse: bomb.fuse }; },\n' +
  '  scr: function (b, x, y) { var p = posOf(b), cy = GROUND - 150; return { x: CX + p.x + (x - CX) * p.s, y: cy + p.y + (y - cy) * p.s }; },\n' +
  '  bombs: function () { return bombs; }, live: function () { return live(); },\n' +
  '  face: FACE, cx: function () { return CX; }, H: function () { return H; },\n' +
  '  ground: function () { return GROUND; }, endY: function () { return END_Y; }, S: S\n' +
  '};\n';
var game = load("games/wanko/index.html", { inject: hook });
var VIEW = { w: 430, h: 900 };
var wrap = game.wrap, window_ = { __dbg: game.dbg };
function noop() {}
function step(n) { game.step(n); game.drawn.length = 0; }
function key(k, code, up) { game.key(k, up); }
var win = { fire: function (name) { if (name === "resize") game.view(VIEW.w, VIEW.h); } };

function tapAt(x, y) {
  wrap.fire("pointerdown", { clientX: x, clientY: y, preventDefault: noop });
  wrap.fire("pointerup", { clientX: x, clientY: y, preventDefault: noop });
}
var D = window_.__dbg;

/* ---- 各仕掛けを正しく解く（台の中の座標を画面の座標に直して触る） ---- */
function pdown(b, x, y) { var p = D.scr(b, x, y); wrap.fire("pointerdown", { clientX: p.x, clientY: p.y, preventDefault: noop }); }
function pmove(b, x, y) { var p = D.scr(b, x, y); wrap.fire("pointermove", { clientX: p.x, clientY: p.y, preventDefault: noop }); }
function pup() { wrap.fire("pointerup", { clientX: 0, clientY: 0, preventDefault: noop }); }
function tapB(b, x, y) { pdown(b, x, y); pup(); }
function center(b) { return { x: D.cx(), y: D.ground() - 150 }; }

function solveBomb(b) {
  var i, j, c = center(b);
  if (b.key === "wire") { tapB(b, b.slots[b.lit].x, b.slots[b.lit].y); return 1; }
  if (b.key === "color") { tapB(b, b.slots[b.target].x, b.slots[b.target].y); return 1; }
  if (b.key === "sw") { for (i = 0; i < b.n; i++) if (b.on[i]) tapB(b, b.slots[i].x, b.slots[i].y); return 1; }
  if (b.key === "screw") { for (i = 0; i < b.n; i++) tapB(b, b.slots[i].x, b.slots[i].y); return 1; }
  if (b.key === "dial") {
    pdown(b, D.cx() + Math.cos(b.tgt) * 80, D.face.y + 70 + Math.sin(b.tgt) * 80);
    step(30);
    pup();
    return 1;
  }
  if (b.key === "time") {
    for (j = 0; j < 400; j++) {
      if (Math.abs(b.pos - b.tgt) < b.half * 0.5) { tapB(b, c.x, c.y); return 1; }
      step(1);
    }
    return 0;
  }
  if (b.key === "pump") {
    for (j = 0; j < 60; j++) { tapB(b, c.x, c.y); if (b.v >= 1) return 1; step(1); }
    return 0;
  }
  if (b.key === "hold") {
    pdown(b, c.x, c.y);
    for (j = 0; j < 400 && b.v < b.tgt; j++) step(1);
    pup();
    return 1;
  }
  if (b.key === "trace") {
    pdown(b, b.pts[0].x, b.pts[0].y);
    for (j = 0; j <= 60; j++) { pmove(b, ptAt(b, j / 60).x, ptAt(b, j / 60).y); if (b.prog >= 1) break; }
    pup();
    return 1;
  }
  if (b.key === "keypad") {
    for (j = 0; j < b.code.length; j++) {
      var s = b.slots[b.code[j] - 1];
      tapB(b, s.x, s.y);
      if (D.now().state !== "play") break;
    }
    return 1;
  }
  return 0;
}
function solveOnce(g) { return solveBomb(g.bomb); }

/* 溝の t の位置（ゲーム側の tracePoint と同じ計算） */
function ptAt(b, t) {
  var d = t * b.len;
  for (var i = 0; i < b.seg.length; i++) {
    if (d <= b.seg[i]) {
      var a = b.pts[i], c = b.pts[i + 1], u = b.seg[i] ? d / b.seg[i] : 0;
      return { x: a.x + (c.x - a.x) * u, y: a.y + (c.y - a.y) * u };
    }
    d -= b.seg[i];
  }
  return b.pts[b.pts.length - 1];
}

/* ---- 1: 仕掛けごとに、10個続けて解けるか ---- */
var bad = [];
D.all().forEach(function (k) {
  D.only(k);
  key("Escape");
  step(2);
  var got = 0;
  for (var n = 0; n < 10; n++) {
    for (var w = 0; w < 200 && D.now().state !== "play"; w++) step(1);
    var g = D.now();
    if (g.state !== "play") { bad.push(k + ": 出番が来ない"); break; }
    var before = g.score;
    solveOnce(g);
    step(2);
    if (D.now().score === before + 1) got++;
    else { bad.push(k + ": " + (n + 1) + "個目で解除できず (state=" + D.now().state + ")"); break; }
    step(30);
  }
  console.log((got === 10 ? "OK  " : "NG  ") + k + "  " + got + "/10");
});

/* ---- 2: どの画面の形でも、部品が面板と画面に収まっているか ---- */
var F = D.face;
[[430, 900], [390, 844], [360, 780], [820, 1180], [500, 1600], [700, 700]].forEach(function (v) {
  VIEW.w = v[0]; VIEW.h = v[1];
  win.fire("resize");
  var H = D.H(), tag = v[0] + "x" + v[1] + " (H=" + H + ")";
  if (D.ground() > H || D.endY() > H - 30) bad.push(tag + ": 爆弾か配線が画面の下にはみ出す");
  D.all().forEach(function (k) {
    D.only(k);
    step(30);
    var b = D.now().bomb;
    if (!b.slots) return;
    var fr = b.fr || F;                       /* 仕掛けごとに面板の大きさが違う */
    b.slots.forEach(function (s, i) {
      var inFace = s.x > fr.x - 4 && s.x < fr.x + fr.w + 4 && s.y > fr.y - 4 && s.y < fr.y + fr.h + 4;
      if (!inFace) bad.push(tag + " " + b.key + ": 部品" + i + " が面板の外 (" + Math.round(s.x) + "," + Math.round(s.y) + ")");
    });
  });
});
VIEW.w = 430; VIEW.h = 900;
win.fire("resize");

/* ---- 2b: 遊んでいる途中に画面の形が変わっても、続きが解けるか ---- */
D.only("wire");
key("Escape"); step(2);
for (var w2 = 0; w2 < 200 && D.now().state !== "play"; w2++) step(1);
VIEW.w = 820; VIEW.h = 1180;
win.fire("resize");
var g3 = D.now();
solveOnce(g3);
step(2);
if (D.now().score !== 1) bad.push("途中で画面の形が変わると解けなくなる");
else console.log("OK  途中で画面の形が変わっても解ける");
VIEW.w = 430; VIEW.h = 900;
win.fire("resize");

/* ---- 3: 導火線切れで爆発 → 結果画面 ---- */
D.only("screw");
key("Escape");
step(2);
step(600);
var g2 = D.now();
if (g2.state !== "result") bad.push("放置しても結果画面にならない (state=" + g2.state + ")");
else console.log("OK  放置 → 爆発 → 結果画面");

/* ---- 4: Escでいつでも最初から ---- */
key("Escape");
step(2);
if (D.now().score !== 0) bad.push("Escでリセットされない");
else console.log("OK  Escで最初から");

/* ---- 5: 全体を通しで（乱数まかせ）100個 ---- */
(function () {
  var keys = ["wire", "color", "sw", "screw", "dial", "time", "pump", "hold", "trace", "keypad"];
  TYPE_RESET();
  function TYPE_RESET() { keys.forEach(function () {}); }
  D.only(keys[0]);
  // 全種混ぜて回す
  var s = 0;
  for (var i = 0; i < keys.length; i++) {}
  var mix = keys.slice();
  var idx = 0;
  for (var n = 0; n < 100; n++) {
    D.only(mix[idx % mix.length]); idx++;
    key("Escape"); step(2);
    for (var w = 0; w < 200 && D.now().state !== "play"; w++) step(1);
    var g = D.now();
    if (g.state !== "play") { bad.push("通し: 出番が来ない"); break; }
    if (solveOnce(g)) { step(2); if (D.now().score === 1) s++; }
  }
  console.log((s === 100 ? "OK  " : "NG  ") + "通し " + s + "/100");
})();

console.log("");
if (bad.length) { console.log("問題:"); bad.forEach(function (b) { console.log("  - " + b); }); }
else console.log("問題なし");

if (bad.length) process.exitCode = 1;
