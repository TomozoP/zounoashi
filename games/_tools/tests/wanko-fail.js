/* 失敗側と、進んだ後（30個目あたり）の様子を確かめる */
var fs = require("fs");
var SRC = "C:/Users/megus/Documents/zounoashi/games/wanko/index.html";
var html = fs.readFileSync(SRC, "utf8");
var code = html.match(/<script>\n([\s\S]*?)<\/script>/)[1];
var hook =
  'window.__dbg = {\n' +
  '  only: function (k) { TYPE_KEYS.length = 0; TYPE_KEYS.push(k); },\n' +
  '  now: function () { return { state: (state === "play" && !live().length) ? "serve" : state, key: bomb.key, bomb: bomb, cur: cur, score: score, fuse: bomb.fuse, ft: bomb.fuseTime }; },\n' +
  '  scr: function (b, x, y) { var p = posOf(b), cy = GROUND - 150; return { x: CX + p.x + (x - CX) * p.s, y: cy + p.y + (y - cy) * p.s }; },\n' +
  '  bombs: function () { return bombs; }, live: function () { return live(); },\n' +
  '  face: FACE, cx: function () { return CX; }, S: S\n};\n';
code = code.replace("  /* ============ ループ ============ */", hook + "  /* ============ ループ ============ */");

var gradient = { addColorStop: function () {} };
var ctx = new Proxy({}, {
  get: function (t, k) {
    if (k === "createLinearGradient" || k === "createRadialGradient") return function () { return gradient; };
    if (k === "measureText") return function (s) { return { width: s.length * 10 }; };
    if (typeof k === "symbol") return undefined;
    return function () {};
  },
  set: function () { return true; }
});
var VIEW = { w: 430, h: 900 };
function gameH() { return Math.max(780, Math.min(1700, Math.round(540 * VIEW.h / VIEW.w))); }
function el() {
  var h = {};
  return { style: {}, getContext: function () { return ctx; },
    parentNode: { get clientWidth() { return VIEW.w; }, get clientHeight() { return VIEW.h; } },
    addEventListener: function (n, f) { (h[n] = h[n] || []).push(f); },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 540, height: gameH() }; },
    fire: function (n, e) { (h[n] || []).forEach(function (f) { f(e || {}); }); } };
}
var canvas = el(), wrap = el(), win = el(), doc = el();

/* 触るのは wrap でも window でも受けられるよう、wrap へ投げたぶんは window にも流す */
(function () { var f = wrap.fire; wrap.fire = function (n, e) { f(n, e); win.fire(n, e); }; })();
var document = { getElementById: function (id) { return id === "c" ? canvas : wrap; },
  addEventListener: doc.addEventListener, hidden: false,
  createElement: function () { return { style: {}, click: function () {} }; },
  body: { appendChild: function () {}, removeChild: function () {} } };
var raf = [], T = 0;
function noop() {}
var window_ = { addEventListener: win.addEventListener, devicePixelRatio: 1, navigator: {}, open: function () { return null; } };
new Function("window", "document", "performance", "requestAnimationFrame", "zShare", "console", code)(
  window_, document, { now: function () { return T; } }, function (f) { raf.push(f); }, noop, console);

function step(n) { for (var i = 0; i < (n || 1); i++) { T += 1000 / 60; var q = raf; raf = []; q.forEach(function (f) { f(T); }); } }
function key(k, c, up) { win.fire(up ? "keyup" : "keydown", { key: k, code: c || "", repeat: false, preventDefault: noop }); }
function tapAt(x, y) {
  wrap.fire("pointerdown", { clientX: x, clientY: y, preventDefault: noop });
  wrap.fire("pointerup", { clientX: x, clientY: y, preventDefault: noop });
}
var D = window_.__dbg, bad = [];

function toPlay() { for (var w = 0; w < 300 && D.now().state !== "play"; w++) step(1); return D.now(); }

function pdown(b, x, y) { var p = D.scr(b, x, y); wrap.fire("pointerdown", { clientX: p.x, clientY: p.y, preventDefault: noop }); }
function pmove(b, x, y) { var p = D.scr(b, x, y); wrap.fire("pointermove", { clientX: p.x, clientY: p.y, preventDefault: noop }); }
function pup() { wrap.fire("pointerup", { clientX: 0, clientY: 0, preventDefault: noop }); }
function tapB(b, x, y) { pdown(b, x, y); pup(); }

function solveBomb(b) {
  var i, j, cx = D.cx(), cy = D.face.y + 70 + 80;
  if (b.key === "wire") { tapB(b, b.slots[b.lit].x, b.slots[b.lit].y); return; }
  if (b.key === "color") { tapB(b, b.slots[b.target].x, b.slots[b.target].y); return; }
  if (b.key === "sw") { for (i = 0; i < b.n; i++) if (b.on[i]) tapB(b, b.slots[i].x, b.slots[i].y); return; }
  if (b.key === "screw") { for (i = 0; i < b.n; i++) tapB(b, b.slots[i].x, b.slots[i].y); return; }
  if (b.key === "dial") {
    pdown(b, cx + Math.cos(b.tgt) * 80, D.face.y + 70 + Math.sin(b.tgt) * 80);
    step(30); pup();
    return;
  }
  if (b.key === "time") { for (j = 0; j < 500; j++) { if (Math.abs(b.pos - b.tgt) < b.half * 0.5) { tapB(b, cx, cy); return; } step(1); } return; }
  if (b.key === "pump") { for (j = 0; j < 60; j++) { tapB(b, cx, cy); if (b.v >= 1) return; step(1); } return; }
  if (b.key === "hold") { pdown(b, cx, cy); for (j = 0; j < 500 && b.v < b.tgt; j++) step(1); pup(); return; }
  if (b.key === "trace") {
    pdown(b, b.pts[0].x, b.pts[0].y);
    for (j = 0; j <= 60; j++) { pmove(b, ptAt(b, j / 60).x, ptAt(b, j / 60).y); if (b.prog >= 1) break; }
    pup();
    return;
  }
  if (b.key === "keypad") {
    for (j = 0; j < b.code.length; j++) {
      var s = b.slots[b.code[j] - 1];
      tapB(b, s.x, s.y);
      if (D.now().state !== "play") break;
    }
    return;
  }
}
function solve(g) { solveBomb(g.bomb); }

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

/* ---- 間違えたら爆発するか ---- */
function wrongCheck(k, act, warm) {
  D.only(k); key("Escape"); step(2);
  for (var w = 0; w < (warm || 0); w++) {          /* 選択肢が増えるところまで進める */
    var gw = toPlay();
    solveBomb(gw.bomb);
    step(4);
  }
  var g = toPlay();
  act(g.bomb);
  step(4);
  var st = D.now().state;
  if (st !== "boom") bad.push(k + ": 間違えても爆発しない (state=" + st + ")");
  else console.log("OK  " + k + " 間違い → 爆発");
}
wrongCheck("wire", function (b) { var w = (b.lit + 1) % b.n; tapB(b, b.slots[w].x, b.slots[w].y); }, 8);
wrongCheck("color", function (b) { var w = (b.target + 1) % b.n; tapAt(b.slots[w].x, b.slots[w].y); });
wrongCheck("sw", function (b) { for (var i = 0; i < b.n; i++) if (!b.on[i]) { tapAt(b.slots[i].x, b.slots[i].y); return; } });
wrongCheck("time", function (b) {
  for (var j = 0; j < 500; j++) { if (Math.abs(b.pos - b.tgt) > b.half * 2.5) { key(" ", "Space"); key(" ", "Space", true); return; } step(1); }
});
wrongCheck("hold", function (b) { key(" ", "Space"); step(6); key(" ", "Space", true); });   /* 早く離す */
wrongCheck("hold", function (b) { key(" ", "Space"); for (var j = 0; j < 200 && !b.done; j++) step(1); });   /* 溜めすぎ */

wrongCheck("keypad", function (b) {                        /* 違う数字を押す */
  var w = b.code[0] === 1 ? 2 : 1;
  tapAt(b.slots[w - 1].x, b.slots[w - 1].y);
});

/* コードは線の上ならどこでも切れる（端の方・真ん中どちらでも） */
(function () {
  function bezAt(p, t) {
    var u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return { x: a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x,
             y: a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y };
  }
  [0.15, 0.5, 0.85].forEach(function (t) {
    D.only("wire"); key("Escape"); step(2);
    for (var w = 0; w < 8; w++) { var gw = toPlay(); solveBomb(gw.bomb); step(4); }   /* 2本以上に */
    var g = toPlay(), b = g.bomb;
    var p = bezAt(b.left[b.lit], t);                 /* 正しいコードの、端の方や真ん中 */
    tapB(b, p.x, p.y);
    step(4);
    var got = D.now().score === g.score + 1;
    console.log((got ? "OK  " : "NG  ") + "コードの " + (t * 100) + "% の位置を触って切れる");
    if (!got) bad.push("コードの " + (t * 100) + "% を触っても切れない");
  });
  /* どのコードからも離れたところは切れない */
  D.only("wire"); key("Escape"); step(2);
  for (var w2 = 0; w2 < 8; w2++) { var g2 = toPlay(); solveBomb(g2.bomb); step(4); }
  var g3 = toPlay(), b3 = g3.bomb, fr3 = b3.fr;
  function minDistAll(x, y) {
    var m = Infinity;
    for (var i = 0; i < b3.n; i++) {
      [b3.left[i], b3.right[i]].forEach(function (p) {
        for (var t = 0; t <= 24; t++) {
          var q = bezAt(p, t / 24), dx = q.x - x, dy = q.y - y;
          m = Math.min(m, Math.sqrt(dx * dx + dy * dy));
        }
      });
    }
    return m;
  }
  var far = null, farD = 0;                          /* 面板の中で、どの線からもいちばん遠い点 */
  for (var gx = fr3.x + 20; gx < fr3.x + fr3.w - 20; gx += 8) {
    for (var gy = fr3.y + 20; gy < fr3.y + fr3.h - 20; gy += 8) {
      var d = minDistAll(gx, gy);
      if (d > farD) { farD = d; far = { x: gx, y: gy }; }
    }
  }
  var ok3 = true;
  if (farD < 35) { console.log("--  線から離れた点が取れない (最大" + farD.toFixed(0) + ")"); }
  else {
    tapB(b3, far.x, far.y);
    step(4);
    ok3 = D.now().score === g3.score && D.now().state === "play";
    console.log((ok3 ? "OK  " : "NG  ") + "線から" + farD.toFixed(0) + "離れたところは切れない");
    if (!ok3) bad.push("線から離れても切れてしまう");
  }
})();

/* なぞるのは、外れても爆発せず最初に戻るだけ。近道もできない */
(function () {
  D.only("trace"); key("Escape"); step(2);
  var g = toPlay(), b = g.bomb;
  /* いったん半分まで進める */
  wrap.fire("pointerdown", { clientX: b.pts[0].x, clientY: b.pts[0].y, preventDefault: noop });
  for (var j = 0; j <= 30; j++) {
    var p = ptAt(b, j / 60);
    wrap.fire("pointermove", { clientX: p.x, clientY: p.y, preventDefault: noop });
  }
  var half = b.prog;
  /* 溝から大きく外す */
  wrap.fire("pointermove", { clientX: b.pts[0].x, clientY: b.pts[0].y - 200, preventDefault: noop });
  var after = b.prog, st = D.now().state;
  if (st !== "play") bad.push("trace: 外れただけで爆発した");
  else if (half < 0.3) bad.push("trace: なぞっても進んでいない (" + half.toFixed(2) + ")");
  else if (after !== 0) bad.push("trace: 外れても戻らない (" + after.toFixed(2) + ")");
  else console.log("OK  trace 溝から外れる → 最初に戻る（爆発しない）");

  /* いきなり終点に触っても進まない */
  var last = b.pts[b.pts.length - 1];
  wrap.fire("pointermove", { clientX: last.x, clientY: last.y, preventDefault: noop });
  step(2);
  if (D.now().score !== 0 || b.prog > 0.2) bad.push("trace: 終点に触るだけで解けてしまう");
  else console.log("OK  trace 終点に飛んでも進まない");
  wrap.fire("pointerup", { clientX: 0, clientY: 0, preventDefault: noop });
})();

/* ネジは間違いようがない（外すだけ）ので、時間切れで爆発するか見る */
D.only("screw"); key("Escape"); step(2); toPlay(); step(600);
if (D.now().state !== "result") bad.push("screw: 時間切れで終わらない");
else console.log("OK  screw 時間切れ → 爆発");

/* ---- 進んだ後（30個解除まで）まだ解けるか・部品が面板に収まるか ---- */
var keys = ["wire", "color", "sw", "screw", "dial", "time", "pump", "hold", "trace", "keypad"];
D.only(keys[0]); key("Escape"); step(2);
var F = D.face, ok = 0, minFuse = 99, maxNeed = 0;
for (var n = 0; n < 30; n++) {
  D.only(keys[n % keys.length]);
  var g = toPlay();
  minFuse = Math.min(minFuse, g.ft);
  if (g.bomb.slots) {
    var fr = g.bomb.fr || F;                 /* 仕掛けごとに面板の大きさが違う */
    g.bomb.slots.forEach(function (s, i) {
      if (s.x < fr.x - 2 || s.x > fr.x + fr.w + 2 || s.y < fr.y - 2 || s.y > fr.y + fr.h + 2)
        bad.push(g.key + "(" + n + "個目): 部品" + i + " が面板の外");
    });
  }
  if (g.key === "pump") maxNeed = Math.max(maxNeed, g.bomb.need);
  var before = g.score, lv = D.live(), want = lv.length;
  for (var q = 0; q < lv.length; q++) { solveBomb(lv[q]); step(3); }
  step(4);
  if (D.now().score === before + want) ok++;
  else { bad.push(g.key + ": " + n + "個目で解除できず (" + (D.now().score - before) + "/" + want + ")"); break; }
  step(28);
}
console.log((ok === 30 ? "OK  " : "NG  ") + "30個連続 " + ok + "/30  （最短の導火線 " + minFuse.toFixed(1) + "秒 / ポンプ最大 " + maxNeed + "回）");

console.log("");
if (bad.length) { console.log("問題:"); bad.forEach(function (b) { console.log("  - " + b); }); }
else console.log("問題なし");
