/* 牛歩シミュレーター：押した数・景色の移り変わり・壊すものを測る。
     node games/_tools/tests/gyuho.js
   見るもの
     - 押すたびに速くなる。押さなければ落ちも進みもしない
     - 時速100kmに届くのは100押しを過ぎたあたり（最初はじっくり）
     - 景色は 牧場→道路→町→都市→宇宙。変わるたびに1押しの効きが上がる
     - 景色ごとに要る押しの数（100 / 198 / 198 / 248 / 297）と、光の速さまでの合計
     - 壊すものが景色ごとに変わる（わら・電柱・車・ビル・星）
     - 光の速さの手前で警告。押すのをやめれば壊れない
     - 光の速さに届くと宇宙が壊れ、結果は押した回数
     - 画面の形が変わっても遊べる */
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
function push(g, n, per) {
  for (var i = 0; i < (n || 1); i++) {
    if (g.probe.now().state !== "play") return i;
    g.tap(270, Math.round(g.probe.now().H * 0.3));
    if (per) g.step(per);
  }
  return n;
}

/* 1. 押すと速くなる。押さなければ変わらない */
var g = start();
ok(g.probe.now().state === "play", "スペースで始まる", g.probe.now().state);
ok(Math.abs(g.probe.now().kmh - 0.1) < 1e-9, "はじめは牛歩", g.probe.now().read);
push(g, 1);
ok(Math.abs(g.probe.now().kmh - 0.5) < 1e-9, "牧場は1押し0.4km/h", g.probe.now().read);
var keep = g.probe.now().kmh;
g.step(60 * 20);
ok(g.probe.now().kmh === keep, "押さずに20秒おいても落ちない", g.probe.now().read);

/* 2. 最初はじっくり */
var t100 = start(), n100 = 0;
while (t100.probe.now().kmh < 100 && n100 < 3000) { t100.tap(270, 400); n100++; }
ok(n100 > 80 && n100 < 140, "時速100kmまで100押しくらいかかる", n100 + "押し");
var t50 = start();
push(t50, 10);
ok(t50.probe.now().kmh < 5, "10押しではまだ歩くほど", t50.probe.now().read);

/* 3. 景色ごとに要る押しの数 */
g.probe.reset();
var marks = [], seen = 0, total = 0, guard = 0;
while (g.probe.now().state === "play" && guard++ < 5000) {
  var before = g.probe.now().gear;
  g.tap(270, 400); total++;
  var n = g.probe.now();
  if (n.gear !== before || n.state !== "play") {
    marks.push({ phase: ["牧場", "道路", "町", "都市", "宇宙"][before], clicks: total - seen });
    seen = total;
  }
}
ok(g.probe.now().state !== "play", "押し続ければ必ず光の速さに届く", g.probe.now().state);
marks.forEach(function (m) { console.log("    " + m.phase + " … " + m.clicks + "押し"); });
ok(marks.length === 5, "景色は5つ", marks.length + "つ");
ok(marks[0].clicks === 100, "牧場は100押し", marks[0].clicks);
var inc = marks.every(function (m, i) { return i === 0 || m.clicks >= marks[i - 1].clicks; });
ok(inc, "先へ行くほど押す数が増える", marks.map(function (m) { return m.clicks; }).join(" → "));
ok(total > 950 && total < 1150, "光の速さまで合計1000押しくらい", total + "押し");
ok(g.probe.now().score === total, "結果の数字は押した回数", g.probe.now().score);

/* 4. ギアの中身 */
[[0, "牧場", 0.4], [120, "道路", 20], [320, "町", 2000], [510, "都市", 160000], [760, "宇宙", 3500000]].forEach(function (c) {
  var t = start();
  push(t, c[0]);
  var n = t.probe.now();
  ok(n.phase === c[1] && n.step === c[2], c[0] + "押しめは" + c[1] + "（1押し " + c[2] + "km/h）",
     n.phase + " / " + n.step + " / " + n.read);
});

/* 5. 壊すものが景色ごとに変わる */
[[40, "牧場"], [200, "道路"], [400, "町"], [600, "都市"], [800, "宇宙"]].forEach(function (c) {
  var t = start();
  push(t, c[0], 1);
  var before = t.probe.now().broken;
  t.step(60 * 12);
  var n = t.probe.now();
  ok(n.broken > before, c[1] + "で道の先のものを壊す",
     "壊した数 " + (n.broken - before) + " / " + n.read);
});
var tb = start();
push(tb, 300, 1);
tb.step(60 * 6);
ok(tb.probe.now().bits > 0, "壊すと破片が飛ぶ", tb.probe.now().bits + "個");

/* 6. 警告と、やめれば壊れない */
var t4 = start();
var toWarn = 0;
while (!t4.probe.now().warn && t4.probe.now().state === "play" && toWarn < 3000) { t4.tap(270, 400); toWarn++; }
ok(t4.probe.now().warn, "光の速さの手前で警告が出る", t4.probe.now().read + " / " + toWarn + "押しめ");
var t5 = start(), left = 0;
push(t5, toWarn);
while (t5.probe.now().state === "play" && left < 2000) { t5.tap(270, 400); left++; }
ok(left > 10 && left < 60, "警告が出てから光の速さまで少し間がある", left + "押し");
t4.step(60 * 30);
ok(t4.probe.now().state === "play" && t4.probe.now().warn, "警告のまま押すのをやめれば壊れない（30秒）", t4.probe.now().read);

/* 7. 宇宙が壊れる */
var t6 = start();
while (t6.probe.now().state === "play") t6.tap(270, 400);
ok(t6.probe.now().state === "boom", "光の速さに届くと宇宙が壊れる", t6.probe.now().read);
ok(t6.probe.now().read === "1.000000 c", "壊れる瞬間はちょうど光の速さ", t6.probe.now().read);
ok(t6.until(function () { return t6.probe.now().state === "result"; }, 300), "壊れたあと結果画面へ",
   t6.probe.now().state);

/* 8. 結果画面から、もう一度 */
var H = t6.probe.now().H, Wd = t6.probe.now().W;
t6.tap(Wd / 2 - 115, H * 0.62 + 27);
ok(t6.probe.now().state === "play", "「もう一度」で遊び直せる", t6.probe.now().state);
ok(t6.probe.now().score === 0 && Math.abs(t6.probe.now().kmh - 0.1) < 1e-9, "やり直すと牛歩から");

/* 9. キーとジョイパッド */
var t7 = start();
t7.press(" "); t7.press(" "); t7.press(" ");
ok(t7.probe.now().score === 3, "スペースの連打で進む", t7.probe.now().score + "押し");
t7.pad({ press: true }); t7.step(1); t7.pad({}); t7.step(1);
ok(t7.probe.now().score === 4, "ジョイパッドでも押せる", t7.probe.now().score + "押し");
t7.esc();
ok(t7.probe.now().score === 0, "Escで最初から");

/* 10. 画面の形 */
[[375, 667], [390, 844], [430, 932], [768, 1024], [412, 915], [360, 780]].forEach(function (v) {
  var t = load(FILE, { w: v[0], h: v[1] });
  t.press(" "); t.step(2);
  push(t, 5, 1);
  ok(t.probe.now().score === 5 && Math.abs(t.probe.now().kmh - 2.1) < 1e-9,
     "画面 " + v[0] + "x" + v[1] + " で押せる", "高さ" + t.probe.now().H + " / " + t.probe.now().read);
});

console.log(ng ? "\n問題 " + ng + " 件" : "\nぜんぶ通った");
process.exit(ng ? 1 : 0);
