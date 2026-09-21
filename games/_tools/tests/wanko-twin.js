/* 20個目から出てくる「左右に2台同時」を確かめる */
var load = require("../harness");
var hook =
  'window.__dbg = {\n' +
  '  only: function (k) { TYPE_KEYS.length = 0; TYPE_KEYS.push(k); },\n' +
  '  from: function (n) { DUAL_FROM = n; },\n' +
  '  scr: function (b, x, y) { var p = posOf(b), cy = GROUND - 150; return { x: CX + p.x + (x - CX) * p.s, y: cy + p.y + (y - cy) * p.s }; },\n' +
  '  bombs: function () { return bombs; }, live: function () { return live(); },\n' +
  '  ground: function () { return GROUND; }, rect: function () { return twinRect(); },\n' +
  '  frames: function () { var py = GROUND - 150; return bombs.map(function (b) { var f = frameOf(b), t = b.tf;\n' +
  '    return { top: py + (t.y + f.top - py) * t.s, bot: py + (t.y + f.bot - py) * t.s }; }); },\n' +
  '  pair: function (a, b) { TYPE_KEYS.length = 0; TYPE_KEYS.push(a); TYPE_KEYS.push(b); DUAL_FROM = 0; score = 10;\n' +
  '    for (var i = 0; i < 300; i++) { spawnWave(); if (bombs.length === 2) return true; } return false; },\n' +
  '  face: FACE, cx: function () { return CX; }, H: function () { return H; },\n' +
  '  now: function () { return { state: (state === "play" && !live().length) ? "serve" : state,\n' +
  '    key: bomb.key, bomb: bomb, score: score, staff: staff.map(function (s) { return { x: Math.round(s.x), mode: s.mode }; }),\n' +
  '    twin: isTwin(), cur: cur, ft: bomb.fuseTime }; }\n};\n';
var game = load("games/wanko/index.html", { inject: hook });
var VIEW = { w: 430, h: 900 };
var wrap = game.wrap, window_ = { __dbg: game.dbg };
function noop() {}
function step(n) { game.step(n); game.drawn.length = 0; }
function key(k, code, up) { game.key(k, up); }
var win = { fire: function (name) { if (name === "resize") game.view(VIEW.w, VIEW.h); } };

var D = window_.__dbg, bad = [];
function pdown(b, x, y) { var p = D.scr(b, x, y); wrap.fire("pointerdown", { clientX: p.x, clientY: p.y, preventDefault: noop }); }
function pup() { wrap.fire("pointerup", { clientX: 0, clientY: 0, preventDefault: noop }); }
function tapB(b, x, y) { pdown(b, x, y); pup(); }
function toPlay() { for (var w = 0; w < 400 && D.now().state !== "play"; w++) step(1); return D.now(); }

/* screw だけ使う（押すだけで解けて、間違いようがない） */
function solveScrew(b) { for (var i = 0; i < b.n; i++) tapB(b, b.slots[i].x, b.slots[i].y); }
function solveAll() {
  var lv = D.live();
  for (var i = 0; i < lv.length; i++) { solveScrew(lv[i]); step(3); }
  return lv.length;
}
/* 2台出るまで進める */
function toDual(max) {
  for (var n = 0; n < (max || 40); n++) {
    toPlay();
    if (D.bombs().length === 2) return true;
    solveAll(); step(40);
  }
  return false;
}

/* ---- 1: 20個目より前は1台だけ ---- */
D.only("screw"); D.from(10);
key("Escape"); step(2);
var dualEarly = 0;
for (var n1 = 0; n1 < 8; n1++) { toPlay(); if (D.bombs().length > 1) dualEarly++; solveAll(); step(40); }
console.log((dualEarly === 0 ? "OK  " : "NG  ") + "10個目より前は1台だけ (" + dualEarly + "回2台)");
if (dualEarly) bad.push("早い段階で2台出てくる");

/* ---- 2: 左右に並んで、2台とも同時に動いている ---- */
D.only("screw"); D.from(0);
key("Escape"); step(2);
if (!toDual()) bad.push("2台が出てこない");
else {
  var bs = D.bombs();
  var okSide = bs[0].tf.y < bs[1].tf.y - 150 && bs[0].tf.s > 0.55;
  console.log((okSide ? "OK  " : "NG  ") + "2ユニットが縦に並ぶ (上 " + Math.round(bs[0].tf.y) + " / 下 " + Math.round(bs[1].tf.y) + " / 大きさ " + bs[0].tf.s.toFixed(2) + ")");
  if (!okSide) bad.push("縦に並んでいない");
  

  toPlay();
  var f0 = bs[0].fuse, f1 = bs[1].fuse;
  step(30);
  var burning = bs[0].fuse < f0 - 0.01 && bs[1].fuse < f1 - 0.01;
  console.log((burning ? "OK  " : "NG  ") + "2台とも導火線が同時に燃えている");
  if (!burning) bad.push("片方の導火線が燃えていない");

  var before = D.now().score;
  var cnt = solveAll();
  step(6);
  var okBoth = cnt === 2 && D.now().score === before + 2;
  console.log((okBoth ? "OK  " : "NG  ") + "2台とも同時に解ける（皿が2枚増える）");
  if (!okBoth) bad.push("2台解いても皿が2枚にならない (" + (D.now().score - before) + ")");
}

/* ---- 3: 左半分のタップは左の台、右半分は右の台に効く ---- */
D.only("screw"); D.from(0);
key("Escape"); step(2);
if (toDual()) {
  toPlay();
  var b2 = D.bombs();
  var leftBefore = b2[0].out[0], rightBefore = b2[1].out[0];
  tapB(b2[0], b2[0].slots[0].x, b2[0].slots[0].y);      /* 左の台のネジ */
  step(2);
  var okL = b2[0].out[0] > leftBefore && b2[1].out[0] === rightBefore;
  tapB(b2[1], b2[1].slots[0].x, b2[1].slots[0].y);      /* 右の台のネジ */
  step(2);
  var okR = b2[1].out[0] > rightBefore;
  console.log(((okL && okR) ? "OK  " : "NG  ") + "上下のタップが、それぞれの面に効く");
  if (!okL || !okR) bad.push("タップが別の台に吸われる");
}

/* ---- 4: 片方を放っておくと爆発する ---- */
D.only("screw"); D.from(0);
key("Escape"); step(2);
if (toDual()) {
  toPlay();
  solveScrew(D.live()[0]);                                /* 片方だけ解く */
  step(1200);
  var st = D.now().state;
  console.log((st === "result" ? "OK  " : "NG  ") + "片方を放置 → 爆発 → 結果画面 (" + st + ")");
  if (st !== "result") bad.push("片方を放置しても終わらない");
}

/* ---- 5: 2台のときは導火線が長い ---- */
D.only("screw"); D.from(999);
key("Escape"); step(2);
for (var w5 = 0; w5 < 25; w5++) { toPlay(); solveAll(); step(40); }
var single = D.now().ft;
D.from(0);
key("Escape"); step(2);
if (toDual()) {
  var dualFt = D.bombs()[0].fuseTime;
  var longer = dualFt > single * 1.5;
  console.log((longer ? "OK  " : "NG  ") + "2台のときは導火線が長い (1台 " + single.toFixed(1) +
              "秒 → 2台 " + dualFt.toFixed(1) + "秒)");
  if (!longer) bad.push("2台でも導火線が同じ");
}

/* ---- 6: 2台のときに画面の形が変わっても解ける ---- */
D.only("screw"); D.from(0);
key("Escape"); step(2);
if (toDual()) {
  toPlay();
  VIEW.w = 820; VIEW.h = 1180;
  win.fire("resize");
  var before6 = D.now().score, cnt6 = solveAll();
  step(6);
  var ok6 = D.now().score === before6 + cnt6;
  console.log((ok6 ? "OK  " : "NG  ") + "2台のときに画面の形が変わっても解ける");
  if (!ok6) bad.push("形を変えると2台が解けない");
  VIEW.w = 430; VIEW.h = 900; win.fire("resize");
}

/* ---- 7: 連結が出るのは、皿が10枚たまった区切りちょうど ---- */
D.only("screw"); D.from(10);
key("Escape"); step(2);
var waves = 0, twins = 0, at = [], off = 0;
for (var n7 = 0; n7 < 120; n7++) {
  var g7 = toPlay();
  waves++;
  if (D.now().twin) {
    twins++;
    at.push(g7.score);
    if (g7.score < 10 || g7.score % 10 !== 0) off++;
  }
  solveAll(); step(40);
}
console.log((off === 0 && twins > 5 ? "OK  " : "NG  ") + "連結は10枚ごとの区切りだけ (" + twins + "回 / 出た皿数 " +
            at.slice(0, 8).join(",") + (at.length > 8 ? "…" : "") + ")");
if (off) bad.push("区切り以外で連結が出る (" + off + "回)");
if (twins < 5) bad.push("連結がほとんど出ない");

/* ---- 8: 女将は左へはけて、次の人が右から入ってくる ---- */
D.only("screw"); D.from(999);
key("Escape"); step(2);
toPlay(); step(30);
var standing = D.now().staff;
var okStand = standing.length === 1 && Math.abs(standing[0].x) < 6;
if (!okStand) bad.push("遊んでいる間に女将が真ん中に立っていない");

solveAll();
var sawTwo = false, sawLeft = false, sawRight = false;
for (var n8 = 0; n8 < 60; n8++) {
  step(1);
  var st = D.now().staff;
  if (st.length === 2) sawTwo = true;
  for (var q8 = 0; q8 < st.length; q8++) {
    if (st[q8].mode === "out" && st[q8].x < -40) sawLeft = true;
    if (st[q8].mode === "in" && st[q8].x > 40) sawRight = true;
  }
}
toPlay(); step(60);
var after = D.now().staff;
var backOne = after.length === 1 && Math.abs(after[0].x) < 6;
var okFrame = okStand && sawTwo && sawLeft && sawRight && backOne;
console.log((okFrame ? "OK  " : "NG  ") + "左へはけて、次が右から入ってくる (入れ替わりで2人 " +
            sawTwo + " / 左へ " + sawLeft + " / 右から " + sawRight + " / 落ち着いて1人 " + backOne + ")");
if (!okFrame) bad.push("女将の入れ替わりがおかしい");

/* ---- 9: どの組み合わせでも、2つの面板が重ならず画面に収まるか ---- */
var KEYS = ["wire", "color", "sw", "screw", "dial", "time", "pump", "hold", "trace", "keypad"];
var worstTop = 9999, worstPair = "", checked = 0;
[[430, 900], [390, 844], [360, 780], [700, 700], [500, 1600]].forEach(function (v) {
  VIEW.w = v[0]; VIEW.h = v[1];
  win.fire("resize");
  for (var a = 0; a < KEYS.length; a++) for (var b2 = a + 1; b2 < KEYS.length; b2++) {
    D.pair(KEYS[a], KEYS[b2]);
    var bs = D.bombs();
    if (bs.length !== 2) { bad.push(KEYS[a] + "+" + KEYS[b2] + ": 連結が作れない"); continue; }
    checked++;
    var r = D.rect(), fr = D.frames();
    var tag = v[0] + "x" + v[1] + " " + bs[0].key + "+" + bs[1].key;
    if (fr[1].top < fr[0].bot + 2) bad.push(tag + ": 上下の面板が重なる");
    if (r.y < 78) bad.push(tag + ": 箱が吹き出しにかぶる (top=" + Math.round(r.y) + ")");
    if (Math.abs(r.y + r.h - (D.ground() + 4)) > 2) bad.push(tag + ": 箱の下がお盆からずれる");
    if (r.x < 2 || r.x + r.w > 538) bad.push(tag + ": 箱が画面の横からはみ出す");
    if (r.y < worstTop) { worstTop = r.y; worstPair = tag; }
  }
});
VIEW.w = 430; VIEW.h = 900; win.fire("resize");
console.log((bad.length ? "NG  " : "OK  ") + "全" + checked + "通りの組み合わせで、重ならず画面に収まる（いちばん上に来たのは " +
            worstPair + " の top=" + Math.round(worstTop) + "）");

console.log("");
if (bad.length) { console.log("問題:"); bad.forEach(function (b) { console.log("  - " + b); }); }
else console.log("問題なし");

if (bad.length) process.exitCode = 1;
