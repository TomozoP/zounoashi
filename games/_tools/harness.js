/* ゲームを偽のDOMの上で走らせる台。テストから使う。
   （このフォルダは _ で始まるので GitHub Pages には出ない）

   使い方:
     var load = require("./harness");
     var g = load("games/_hoge/index.html");
     g.step(60);                  // 1秒ぶん進める
     g.tap(270, 400);             // ゲーム座標で触る
     g.key(" ");                  // スペース
     g.view(390, 844);            // 画面の形を変える
     g.probe.now();               // ゲーム側の覗き穴（window.__probe）

   ブラウザのプレビューはコマが進まないので、遊べるかどうかはここで確かめる。 */

var fs = require("fs");
var path = require("path");

function load(file, opts) {
  opts = opts || {};
  var root = opts.root || findRoot();
  var full = path.isAbsolute(file) ? file : path.join(root, file);
  var html = fs.readFileSync(full, "utf8");
  var dir = path.dirname(full);
  var parts = [];

  /* 同じフォルダの .js も読む場合（share.js は zShare として渡すので読まない）。
     別ファイルに分けているゲームだけ opts.withScripts で有効にする */
  var srcs = opts.withScripts ? (html.match(/<script src="([^"]+)"><\/script>/g) || []) : [];
  srcs.forEach(function (tag) {
    var src = tag.match(/src="([^"]+)"/)[1];
    if (/share\.js$/.test(src) || /^https?:/.test(src)) return;
    var p = path.join(dir, src);
    if (fs.existsSync(p)) parts.push(fs.readFileSync(p, "utf8"));
  });

  var blocks = html.match(/<script>[\s\S]*?<\/script>/g);
  if (!blocks) throw new Error("ゲームの <script> が見つからない: " + file);
  blocks.forEach(function (b) {
    parts.push(b.replace(/^<script>/, "").replace(/<\/script>$/, ""));
  });
  var code = parts.join("\n;\n");
  if (opts.inject) {                       /* テストのときだけ覗き穴を足したいとき */
    code = code.replace("  /* ============ ループ ============ */",
                        opts.inject + "\n  /* ============ ループ ============ */");
  }

  var view = { w: opts.w || 430, h: opts.h || 900 };
  var drawn = [];                           /* 呼ばれた描画命令（数だけ見たいとき用） */

  var gradient = { addColorStop: function () {} };
  var ctx = new Proxy({}, {
    get: function (t, k) {
      if (k === "createLinearGradient" || k === "createRadialGradient") return function () { return gradient; };
      if (k === "createPattern") return function () { return null; };
      if (k === "measureText") return function (s) { return { width: String(s).length * 10 }; };
      if (k === "getImageData") return function (x, y, w, h) { return { data: new Uint8ClampedArray(4 * w * h) }; };
      if (k === "canvas") return canvas;
      if (typeof k === "symbol") return undefined;
      return function () { drawn.push(k); };
    },
    set: function () { return true; }
  });

  /* ありがちなDOMの呼び出しを、ひととおり受け止める張りぼて */
  function el(tag) {
    var h = {}, cls = {};
    var e = {
      tagName: tag,
      style: {}, width: 0, height: 0,
      textContent: "", innerHTML: "", value: "", hidden: false, scrollTop: 0,
      dataset: {}, children: [], _h: h,
      classList: {
        add: function (c) { cls[c] = true; },
        remove: function (c) { delete cls[c]; },
        toggle: function (c, on) { if (on === undefined) on = !cls[c]; if (on) cls[c] = true; else delete cls[c]; },
        contains: function (c) { return !!cls[c]; }
      },
      parentNode: { get clientWidth() { return view.w; }, get clientHeight() { return view.h; } },
      getContext: function () { return ctx; },
      addEventListener: function (n, f) { (h[n] = h[n] || []).push(f); },
      removeEventListener: function () {},
      appendChild: function (c) { e.children.push(c); return c; },
      removeChild: function () {}, remove: function () {},
      insertBefore: function (c) { e.children.push(c); return c; },
      setAttribute: function () {}, getAttribute: function () { return null; },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      focus: function () {}, blur: function () {}, click: function () { e.fire("click", {}); },
      play: function () { return { then: function () {}, catch: function () {} }; },
      /* 表示サイズ＝ゲーム座標。テストはゲーム座標のまま触れる */
      getBoundingClientRect: function () { return { left: 0, top: 0, width: 540, height: gameH() }; },
      fire: function (n, ev) { (h[n] || []).forEach(function (f) { f(ev || {}); }); }
    };
    return e;
  }
  function gameH() { return Math.max(780, Math.min(1700, Math.round(540 * view.h / view.w))); }

  var canvas = el("canvas"), wrap = el("div"), win = el("window"), doc = el("document");
  var raf = [], T = 0;
  function noop() {}

  var byId = { c: canvas, wrap: wrap };       /* 知らない id も、その場で作って覚える */
  var document_ = {
    getElementById: function (id) {
      if (!byId[id]) byId[id] = el("div");
      return byId[id];
    },
    querySelector: function (s) { return /canvas/.test(String(s)) ? canvas : el("div"); },
    querySelectorAll: function () { return []; },
    addEventListener: doc.addEventListener,
    removeEventListener: function () {},
    hidden: false,
    createElement: function (t) { return el(t); },
    documentElement: el("html"),
    body: el("body")
  };
  var window_ = {
    addEventListener: win.addEventListener,
    removeEventListener: function () {},
    devicePixelRatio: 1,
    navigator: {},
    open: function () { return null; },
    AudioContext: null, webkitAudioContext: null,
    get innerWidth() { return view.w; },
    get innerHeight() { return view.h; }
  };

  var shared = [];                            /* zShare に渡された文 */
  function FakeImage() {
    var im = el("img");
    im.naturalWidth = 100; im.naturalHeight = 100; im.complete = true;
    Object.defineProperty(im, "src", {
      set: function (v) { im._src = v; if (opts.imagesLoad && im.onload) im.onload(); },
      get: function () { return im._src; }
    });
    return im;
  }
  var location_ = { href: "http://localhost/", hostname: "localhost", protocol: "http:",
                    search: "", hash: "", pathname: "/", assign: noop, replace: noop, reload: noop };
  window_.location = location_;
  window_.Image = FakeImage;

  new Function("window", "document", "performance", "requestAnimationFrame", "zShare",
               "console", "Image", "location", code)(
    window_, document_,
    { now: function () { return T; } },
    function (f) { raf.push(f); },
    function (o) { shared.push(o && o.text); },
    opts.quiet ? { log: noop, warn: noop, error: noop } : console,
    FakeImage, location_
  );

  function poke(name, x, y) {
    var ev = { clientX: x, clientY: y, preventDefault: noop, pointerId: 1, button: 0 };
    wrap.fire(name, ev);
    win.fire(name, ev);
  }

  var api = {
    win: win, wrap: wrap, canvas: canvas, drawn: drawn, shared: shared,
    get probe() { return window_.__probe || {}; },
    get dbg() { return window_.__dbg || {}; },
    get H() { return gameH(); },
    /* n コマ進める（1コマ = 1/60秒） */
    step: function (n) {
      for (var i = 0; i < (n || 1); i++) {
        T += 1000 / 60;
        var q = raf; raf = [];
        q.forEach(function (f) { f(T); });
      }
      return api;
    },
    /* 進めながら、cond が真になるまで待つ（最大 max コマ） */
    until: function (cond, max) {
      for (var i = 0; i < (max || 400); i++) { if (cond()) return true; api.step(1); }
      return cond();
    },
    /* ゲームによって、触るのを wrap で受けるものと window で受けるものがある。
       どちらか片方しか聞いていないので、両方に投げてよい */
    down: function (x, y) { poke("pointerdown", x, y); return api; },
    moveTo: function (x, y) { poke("pointermove", x, y); return api; },
    up: function (x, y) { poke("pointerup", x || 0, y || 0); return api; },
    tap: function (x, y) { api.down(x, y); api.up(); return api; },
    drag: function (pts, stepPer) {
      api.down(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) { api.moveTo(pts[i].x, pts[i].y); api.step(stepPer || 0); }
      api.up();
      return api;
    },
    key: function (k, up) {
      win.fire(up ? "keyup" : "keydown",
               { key: k, code: k === " " ? "Space" : "", repeat: false, preventDefault: noop });
      return api;
    },
    press: function (k) { api.key(k); api.key(k, true); return api; },
    esc: function () { return api.press("Escape"); },
    /* ジョイパッドの今の状態を1回ぶん送る（サイトが枠へ送るのと同じ形）。
       {press: true, dx: -1} のように書く。押しっぱなしなら毎コマ送ること */
    pad: function (o) {
      o = o || {};
      var buttons = [], i;
      for (i = 0; i < 16; i++) buttons.push({ pressed: false, value: 0 });
      if (o.press) buttons[0] = { pressed: true, value: 1 };
      if (o.dx < 0) buttons[14] = { pressed: true, value: 1 };
      if (o.dx > 0) buttons[15] = { pressed: true, value: 1 };
      win.fire("message", { data: { z: "pad", pads: [{ buttons: buttons, axes: [0, 0] }] } });
      return api;
    },
    /* 画面の形を変える（リサイズと同じことが起きる） */
    view: function (w, h) { view.w = w; view.h = h; win.fire("resize"); return api; }
  };
  return api;
}

function findRoot() {
  var d = __dirname;
  for (var i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(d, "index.html")) && fs.existsSync(path.join(d, "games"))) return d;
    d = path.dirname(d);
  }
  return process.cwd();
}

module.exports = load;
module.exports.SHAPES = [                    /* よく使う画面の形 */
  [430, 900], [390, 844], [360, 780], [820, 1180], [500, 1600], [700, 700]
];
