/* 牛歩シミュレーター：押した数と景色の移り変わりを測る。
     node games/_tools/tests/gyuho.js
   見るもの
     - 押すたびに速くなる。押さなければ落ちも進みもしない
     - 景色は 牧場→道路→町→都市→宇宙。変わるたびに1押しの効きが上がる
     - 景色ごとに要る押しの数（50 / 100 / 150 / 198 / 297）と、光の速さまでの合計
     - 牧場では車が出ない。道路から先は追いついて跳ね飛ばす
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
ok(Math.abs(g.probe.now().kmh - 1.1) < 1e-9, "牧場は1押し1km/h", g.probe.now().read);
var keep = g.probe.now().kmh;
g.step(60 * 20);
ok(g.probe.now().kmh === keep, "押さずに20秒おいても落ちない", g.probe.now().read);

/* 2. 景色ごとに要る押しの数 */
g.probe.reset();
var marks = [], seen = 0, total = 0, guard = 0;
while (g.probe.now().state === "play" && guard++ < 4000) {
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
ok(marks[0].clicks === 50, "牧場は50押し", marks[0].clicks);
var inc = marks.every(function (m, i) { return i === 0 || m.clicks >= marks[i - 1].clicks; });
ok(inc, "先へ行くほど押す数が増える", marks.map(function (m) { return m.clicks; }).join(" → "));
ok(total > 700 && total < 900, "光の速さまで合計800押しくらい", total + "押し");
ok(g.probe.now().score === total, "結果の数字は押した回数", g.probe.now().score);

/* 3. ギアの中身 */
g.probe.reset();
[[0, "牧場", 1], [60, "道路", 100], [160, "町", 6600], [310, "都市", 5e5], [510, "宇宙", 3.3e6]].forEach(function (c) {
  var t = start();
  push(t, c[0]);
  var n = t.probe.now();
  ok(n.phase === c[1] && n.step === c[2], c[0] + "押しめは" + c[1] + "（1押し " + c[2] + "km/h）",
     n.phase + " / " + n.step + " / " + n.read);
});

/* 4. 車 */
var t1 = start();
push(t1, 40, 2);
g.step(1);
ok(t1.probe.now().kmh < 50 && t1.probe.now().cars === 0, "牧場では車が出ない", t1.probe.now().read);
var t2 = start();
push(t2, 120, 4);
t2.step(60 * 8);
ok(t2.probe.now().flying + t2.probe.now().cars > 0, "道路より先では車が出る", t2.probe.now().read);
var t3 = start();
push(t3, 200, 3);
t3.step(60 * 6);
ok(t3.probe.now().flying > 0, "追いついて跳ね飛ばす", "飛んでいる車 " + t3.probe.now().flying + "台");

/* 5. 警告と、やめれば壊れない */
var t4 = start();
var toWarn = 0;
while (!t4.probe.now().warn && t4.probe.now().state === "play" && toWarn < 2000) { t4.tap(270, 400); toWarn++; }
ok(t4.probe.now().warn, "光の速さの手前で警告が出る", t4.probe.now().read + " / " + toWarn + "押しめ");
var left = 0;
var t5 = load(FILE); t5.press(" "); t5.step(2);
for (var i = 0; i < toWarn; i++) t5.tap(270, 400);
while (t5.probe.now().state === "play" && left < 2000) { t5.tap(270, 400); left++; }
ok(left > 10 && left < 60, "警告が出てから光の速さまで少し間がある", left + "押し");
t4.step(60 * 30);
ok(t4.probe.now().state === "play" && t4.probe.now().warn, "警告のまま押すのをやめれば壊れない（30秒）", t4.probe.now().read);

/* 6. 宇宙が壊れる */
var t6 = start();
while (t6.probe.now().state === "play") t6.tap(270, 400);
ok(t6.probe.now().state === "boom", "光の速さに届くと宇宙が壊れる", t6.probe.now().read);
ok(t6.probe.now().read === "1.000000 c", "壊れる瞬間はちょうど光の速さ", t6.probe.now().read);
ok(t6.until(function () { return t6.probe.now().state === "result"; }, 300), "壊れたあと結果画面へ",
   t6.probe.now().state);

/* 7. 結果画面から、もう一度 */
var H = t6.probe.now().H, Wd = t6.probe.now().W;
t6.tap(Wd / 2 - 115, H * 0.62 + 27);
ok(t6.probe.now().state === "play", "「もう一度」で遊び直せる", t6.probe.now().state);
ok(t6.probe.now().score === 0 && Math.abs(t6.probe.now().kmh - 0.1) < 1e-9, "やり直すと牛歩から");

/* 8. キーとジョイパッド */
var t7 = start();
t7.press(" "); t7.press(" "); t7.press(" ");
ok(t7.probe.now().score === 3, "スペースの連打で進む", t7.probe.now().score + "押し");
t7.pad({ press: true }); t7.step(1); t7.pad({}); t7.step(1);
ok(t7.probe.now().score === 4, "ジョイパッドでも押せる", t7.probe.now().score + "押し");
t7.esc();
ok(t7.probe.now().score === 0, "Escで最初から");

/* 9. 画面の形 */
[[375, 667], [390, 844], [430, 932], [768, 1024], [412, 915], [360, 780]].forEach(function (v) {
  var t = load(FILE, { w: v[0], h: v[1] });
  t.press(" "); t.step(2);
  push(t, 5, 1);
  ok(t.probe.now().score === 5 && Math.abs(t.probe.now().kmh - 5.1) < 1e-9,
     "画面 " + v[0] + "x" + v[1] + " で押せる", "高さ" + t.probe.now().H + " / " + t.probe.now().read);
});

console.log(ng ? "\n問題 " + ng + " 件" : "\nぜんぶ通った");
process.exit(ng ? 1 : 0);
