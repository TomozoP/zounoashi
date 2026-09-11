/* 数が増えたときの、押すところ同士の距離を測る（375px端末での実寸） */
var fs = require("fs");
var SRC = "C:/Users/megus/Documents/zounoashi/games/wanko/index.html";
var code = fs.readFileSync(SRC, "utf8").match(/<script>\n([\s\S]*?)<\/script>/)[1];
var hook =
  'window.__dbg = { make: function (key, k) { TYPE_KEYS.length = 0; TYPE_KEYS.push(key);\n' +
  '  DUAL_FROM = 9999; score = k; spawnWave(); var b = bombs[0];\n' +
  '  return { key: b.key, slots: b.slots, n: b.n, len: b.code && b.code.length }; } };\n';
code = code.replace("  /* ============ ループ ============ */", hook + "  /* ============ ループ ============ */");

var gradient = { addColorStop: function () {} };
var ctx = new Proxy({}, { get: function (t, k) {
  if (k === "createLinearGradient" || k === "createRadialGradient") return function () { return gradient; };
  if (k === "measureText") return function (s) { return { width: s.length * 10 }; };
  if (typeof k === "symbol") return undefined;
  return function () {};
}, set: function () { return true; } });
function el() {
  var h = {};
  return { style: {}, getContext: function () { return ctx; },
    parentNode: { clientWidth: 430, clientHeight: 900 },
    addEventListener: function () {}, getBoundingClientRect: function () { return { left: 0, top: 0, width: 540, height: 1130 }; },
    fire: function () {} };
}
var canvas = el(), wrap = el();
var document = { getElementById: function (id) { return id === "c" ? canvas : wrap; },
  addEventListener: function () {}, hidden: false,
  createElement: function () { return { style: {}, click: function () {} }; },
  body: { appendChild: function () {}, removeChild: function () {} } };
var window_ = { addEventListener: function () {}, devicePixelRatio: 1, navigator: {}, open: function () { return null; } };
new Function("window", "document", "performance", "requestAnimationFrame", "zShare", "console", code)(
  window_, document, { now: function () { return 0; } }, function () {}, function () {}, console);
var D = window_.__dbg;

var PX = 0.694;
function minGap(slots) {
  var m = Infinity;
  for (var i = 0; i < slots.length; i++) for (var j = i + 1; j < slots.length; j++) {
    var dx = slots[i].x - slots[j].x, dy = slots[i].y - slots[j].y;
    m = Math.min(m, Math.sqrt(dx * dx + dy * dy));
  }
  return m;
}
console.log("仕掛け      解除数  数  いちばん近い2つの距離");
[["wire", 40], ["color", 40], ["sw", 40], ["screw", 40], ["keypad", 40]].forEach(function (t) {
  var worst = Infinity, n = 0;
  for (var r = 0; r < 200; r++) {                 /* 位置がばらけるものがあるので何度も */
    var b = D.make(t[0], t[1]);
    if (!b.slots) return;
    n = b.slots.length;
    worst = Math.min(worst, minGap(b.slots));
  }
  console.log("  " + t[0].padEnd(9) + String(t[1]).padStart(4) + String(n).padStart(4) +
              "   " + worst.toFixed(0) + "単位 = " + Math.round(worst * PX) + "px" +
              (worst * PX >= 44 ? "  OK" : "  せまい"));
});
