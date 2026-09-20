/* 牛歩シミュレーター：ツマミの効き・車の跳ね飛ばし・警告・宇宙の壊れかたを測る。
     node games/_tools/tests/gyuho.js
   見るもの
     - ツマミ0は牛歩（0.1km/h）、目盛りの位置が音の速さ、右端が光の速さ
     - 遅いうちは車が出ない。速くすると追いついて跳ね飛ばす
     - 光の速さの手前で警告が出る。そこで戻せば壊れない
     - 右端に置いた時点で警告が出て、そのままにすると 2秒で宇宙が壊れ、結果画面へ
     - キー（→ ← スペース）とジョイパッドでもツマミが動く
     - 画面の形が変わってもツマミの位置がずれない */
var load = require("../harness");
var FILE = "games/_gyuho/index.html";

var ng = 0;
function ok(cond, name, info) {
  console.log((cond ? "OK  " : "NG  ") + name + (info === undefined ? "" : "  " + info));
  if (!cond) ng++;
}
function start(w, h) {
  var g = load(FILE, { w: w || 430, h: h || 900 });
  g.press(" ");
  g.step(2);
  return g;
}
function knobY(g) { return Math.round(g.probe.now().H * 0.83); }
function knobX(g, t) { var W = g.probe.now().W; return 76 + (W - 152) * t; }
function setKnob(g, t) {
  var y = knobY(g), x = knobX(g, t);
  g.down(x, y); g.moveTo(x, y); g.up();
  return g;
}
function settle(g, t, frames) { setKnob(g, t); g.step(frames || 240); return g.probe.now(); }

/* 1. ツマミと速さの対応 */
var g = start();
ok(g.probe.now().state === "play", "スペースで始まる", g.probe.now().state);
var n0 = settle(g, 0, 60);
ok(Math.abs(n0.kmh - 0.1) < 0.001, "ツマミ0は牛歩", n0.read);
ok(n0.vis > 5 && n0.vis < 16, "牛歩でも画面は少しずつ流れる", n0.vis.toFixed(1) + "px/s");

var nSonic = settle(g, 0.3408);
ok(nSonic.kmh > 1100 && nSonic.kmh < 1400, "目盛りの位置が音の速さ", nSonic.read);

var nHalf = settle(g, 0.5);
ok(nHalf.kmh > 8e4 && nHalf.kmh < 1.2e5, "まん中は10万km/hくらい", nHalf.read);

var nC = settle(g, 0.99, 300);
ok(nC.beta > 0.999 && nC.beta < 1, "右端の手前は光の速さのすぐ下", nC.read);
ok(/ c$/.test(nC.read), "光の速さに近いと c で出る", nC.read);

/* 2. 遅いうちは車が出ない */
g.probe.reset();
var slow = settle(g, 0.12, 60 * 12);
ok(slow.kmh < 55, "ツマミ0.12はまだ55km/h未満", slow.read);
ok(slow.cars === 0 && slow.score === 0, "遅いうちは車が出ない", "車" + slow.cars + " 台" + slow.score);

/* 3. 速くすると車を跳ね飛ばす */
g.probe.reset();
setKnob(g, 0.5);
g.step(60 * 10);
var fast = g.probe.now();
ok(fast.score >= 10, "速くすると次々跳ね飛ばす（10秒）", fast.score + "台");
ok(fast.flying > 0, "跳ね飛ばした車が飛んでいる", fast.flying + "台");

g.probe.reset();
setKnob(g, 0.26);
g.step(60 * 20);
var mid = g.probe.now();
ok(mid.score >= 1 && mid.score <= 12, "100km/hあたりはたまに跳ねる（20秒）", mid.score + "台 / " + mid.read);

/* 4. 警告 */
g.probe.reset();
var warn = settle(g, 0.94, 300);
ok(warn.warn === true, "光の速さの手前で警告が出る", warn.read);
var nowarn = settle(g, 0.8, 300);
ok(nowarn.warn === false, "戻せば警告が消える", nowarn.read);

/* 5. 警告のまま止めても壊れない */
g.probe.reset();
setKnob(g, 0.95);
g.step(60 * 15);
var held = g.probe.now();
ok(held.state === "play" && held.warn, "右端まで行かなければ壊れない（15秒）", held.read);

/* 6. 右端に置くと宇宙が壊れる */
g.probe.reset();
setKnob(g, 1);
g.step(30);
var before = g.probe.now();
ok(before.state === "play" && before.hold > 0, "右端に置くと溜めが始まる", before.hold.toFixed(2) + "秒");
ok(before.warn === true, "右端に置いた時点で警告が出る", before.read);
var boomed = g.until(function () { return g.probe.now().state === "boom"; }, 200);
ok(boomed, "2秒ほどで宇宙が壊れる", g.probe.now().read);
ok(g.probe.now().read === "1.000000 c", "壊れる瞬間はちょうど光の速さ", g.probe.now().read);
var done = g.until(function () { return g.probe.now().state === "result"; }, 300);
ok(done, "壊れたあと結果画面へ", g.probe.now().state);

/* 7. 溜めの途中で戻せば助かる */
g.probe.reset();
setKnob(g, 1);
g.step(60);                                   /* 1秒だけ右端に置く */
setKnob(g, 0.5);
g.step(60 * 4);
ok(g.probe.now().state === "play", "溜めの途中で戻せば助かる", g.probe.now().read);

/* 8. 結果画面から、もう一度 */
g.probe.reset();
setKnob(g, 1);
g.until(function () { return g.probe.now().state === "result"; }, 400);
var H = g.probe.now().H, W = g.probe.now().W;
g.tap(W / 2 - 115, H * 0.62 + 27);
ok(g.probe.now().state === "play", "「もう一度」で遊び直せる", g.probe.now().state);
ok(g.probe.now().knob === 0 && g.probe.now().score === 0, "やり直すとツマミも数も戻る");

/* 9. キーとジョイパッド */
g.probe.reset();
g.key("ArrowRight"); g.step(60); g.key("ArrowRight", true);
var byKey = g.probe.now().knob;
ok(byKey > 0.2 && byKey < 0.35, "→ 1秒でツマミが0.28ほど動く", byKey.toFixed(3));
g.key("ArrowLeft"); g.step(30); g.key("ArrowLeft", true);
ok(g.probe.now().knob < byKey, "← で戻る", g.probe.now().knob.toFixed(3));
g.probe.reset();
for (var i = 0; i < 60; i++) { g.pad({ press: true }); g.step(1); }
g.pad({});
ok(g.probe.now().knob > 0.2, "ジョイパッドでも上がる", g.probe.now().knob.toFixed(3));

/* 10. ツマミ以外を触っても動かない */
g.probe.reset();
g.tap(270, Math.round(g.probe.now().H * 0.3));
ok(g.probe.now().knob === 0, "道路のあたりを触ってもツマミは動かない");

/* 11. 画面の形が変わってもツマミは同じ場所で効く */
[[375, 667], [390, 844], [430, 932], [768, 1024], [412, 915], [360, 780]].forEach(function (v) {
  var t = load(FILE, { w: v[0], h: v[1] });
  t.press(" "); t.step(2);
  var y = Math.round(t.probe.now().H * 0.83), x = 76 + (t.probe.now().W - 152) * 0.6;
  t.down(x, y); t.up();
  ok(Math.abs(t.probe.now().knob - 0.6) < 0.01, "画面 " + v[0] + "x" + v[1] + " でツマミが効く",
     "高さ" + t.probe.now().H);
});

console.log(ng ? "\n問題 " + ng + " 件" : "\nぜんぶ通った");
process.exit(ng ? 1 : 0);
