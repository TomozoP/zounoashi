/* いまの難易度カーブを、ゲーム本体から読み出して並べる */
var load = require("../harness");
var hook =
  'window.__dbg = {\n' +
  '  make: function (key, k, dual) { TYPE_KEYS.length = 0; TYPE_KEYS.push(key); DUAL_FROM = dual ? 0 : 9999; score = dual ? 10 : (k || 1); spawnWave();\n' +
  '    var b = bombs[0]; return { key: b.key, ft: b.fuseTime, n: b.n, need: b.need, half: b.half,\n' +
  '      sp: b.sp, wid: b.wid, len: b.code && b.code.length, on: b.on && b.on.filter(Boolean).length,\n' +
  '      pts: b.ry && b.ry.length }; }\n};\n';
var D = load("games/wanko/index.html", { inject: hook }).dbg;


var KS = [0, 5, 10, 15, 20, 30, 40];
function row(label, f) {
  var cells = KS.map(function (k) { return String(f(k)).padStart(9); });
  console.log(label.padEnd(16) + cells.join(""));
}
console.log("解除した数      " + KS.map(function (k) { return String(k).padStart(9); }).join(""));
console.log("-".repeat(16 + KS.length * 9));

row("導火線(秒)", function (k) { return D.make("screw", k).ft.toFixed(1); });
row("  連結のとき", function (k) { return k < 10 ? "-" : (D.make("screw", k).ft * 2.2).toFixed(1); });
console.log("");
row("配線 本数", function (k) { return D.make("wire", k).n; });
row("色 ボタン数", function (k) { return D.make("color", k).n; });
row("スイッチ 倒す数", function (k) { return D.make("sw", k).on; });
row("ネジ 本数", function (k) { return D.make("screw", k).n; });
row("ダイヤル 幅(度)", function (k) { return (D.make("dial", k).wid * 57.3).toFixed(0); });
row("タイミング 速さ", function (k) { return D.make("time", k).sp.toFixed(2); });
row("タイミング 帯幅%", function (k) { return (D.make("time", k).half * 200).toFixed(1); });
row("  帯を通る時間ms", function (k) { var b = D.make("time", k); return Math.round(b.half * 2 / b.sp * 1000); });
row("ポンプ 回数", function (k) { return D.make("pump", k).need; });
row("長押し 帯幅%", function (k) { return (D.make("hold", k).half * 200).toFixed(1); });
row("なぞる 折れ点数", function (k) { return D.make("trace", k).pts; });
row("数字 桁数", function (k) { return D.make("keypad", k).len; });
console.log("");
console.log("※導火線は仕掛けごとに上乗せあり: ポンプ +1.8 / 数字 +0.9 / なぞる +0.6");
console.log("※連結(10枚ごと)のときは、上の導火線が 2.2倍 になる");
