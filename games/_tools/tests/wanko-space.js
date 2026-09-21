/* 数が増えたときの、押すところ同士の距離を測る（375px端末での実寸） */
var load = require("../harness");
var hook =
  'window.__dbg = { make: function (key, k) { TYPE_KEYS.length = 0; TYPE_KEYS.push(key);\n' +
  '  DUAL_FROM = 9999; score = k; spawnWave(); var b = bombs[0];\n' +
  '  return { key: b.key, slots: b.slots, n: b.n, len: b.code && b.code.length }; } };\n';
var D = load("games/wanko/index.html", { inject: hook }).dbg;


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
