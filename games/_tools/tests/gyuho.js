/* 牛歩シミュレーター：押した数・景色の移り変わり・壊すものを測る。
     node games/_tools/tests/gyuho.js
   見るもの
     - 指を上へなぞったぶんだけ速くなる。なぞらなければ落ちも進みもしない
     - 下へなぞっても、指を離したあとの動きも効かない
     - 大きくはらうと、そのぶん牛がぐっと前へ出る（boost）
     - 指を離したあとは、サイトのスクロールのように余韻で進んで止まる（glide）
     - 景色が変わると、上に速報が流れる
     - 景色の切れ目は 時速10 / 50 / 200 / 1000 / 3万。宇宙に出ると一気に上がる
     - 景色ごとに要るこぎの数（100 / 200 / 200 / 250 / 264 / 300）と、光の速さまでの合計
     - 壊すものが景色ごとに変わる（わら・人・車・ビル・山・星）
     - 速さの表記は時速で統一（光の速さは 1,079,252,849 km/h）
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
function push(g, n, per) {                       /* スペース1回＝ひとこぎ */
  for (var i = 0; i < (n || 1); i++) {
    if (g.probe.now().state !== "play") return i;
    g.press(" ");
    if (per) g.step(per);
  }
  return n;
}
function swipe(g, px) {                          /* 指を上へ px ぶんはらう */
  var H = g.probe.now().H;
  g.down(270, H * 0.85);
  g.moveTo(270, H * 0.85 - px);
  g.up();
  return g;
}

/* 1. 押すと速くなる。押さなければ変わらない */
var g = start();
ok(g.probe.now().state === "play", "スペースで始まる", g.probe.now().state);
ok(Math.abs(g.probe.now().kmh - 0.1) < 1e-9, "はじめは牛歩", g.probe.now().read);
push(g, 1);
ok(Math.abs(g.probe.now().kmh - 0.2) < 1e-9, "牧場はひとこぎ0.1km/h", g.probe.now().read);
var keep = g.probe.now().kmh;
g.step(60 * 20);
ok(g.probe.now().kmh === keep, "こがずに20秒おいても落ちない", g.probe.now().read);

/* 2. 最初はじっくり */
var t100 = start(), n100 = 0;
while (t100.probe.now().kmh < 100 && n100 < 3000) { t100.press(" "); n100++; }
ok(n100 > 300 && n100 < 420, "時速100kmまでは道のり長い", n100 + "押し");
var t50 = start();
push(t50, 10);
ok(t50.probe.now().kmh < 2, "10押しではまだ牛歩", t50.probe.now().read);
ok(!/ c$/.test(t50.probe.now().read), "表記は時速で統一", t50.probe.now().read);

/* 2b. なぞった長さで進む */
var sw = start();
swipe(sw, 160);
ok(Math.abs(sw.probe.now().kmh - 0.2) < 1e-6, "160px なぞるとひとこぎぶん", sw.probe.now().read);
swipe(sw, 800);
ok(Math.abs(sw.probe.now().kmh - 0.7) < 1e-6, "800px なぞると5こぎぶん", sw.probe.now().read);
ok(sw.probe.now().score === 6, "数えかたもこいだ回数", sw.probe.now().score);
ok(sw.probe.now().boost > 0, "大きくはらうと前へ突き出す", sw.probe.now().boost);
var wasBoost = sw.probe.now().boost;
sw.step(60);
ok(sw.probe.now().boost < wasBoost, "突き出したぶんはすぐ使いきる", sw.probe.now().boost);
var back = sw.probe.now().kmh;
var H2 = sw.probe.now().H;
sw.down(270, H2 * 0.3); sw.moveTo(270, H2 * 0.3 + 300); sw.up();
ok(sw.probe.now().kmh === back, "下へなぞっても進まない（戻すぶんは効かない）", sw.probe.now().read);
sw.moveTo(270, H2 * 0.1);
ok(sw.probe.now().kmh === back, "指を離したあとの動きは拾わない");

/* 2c. 指を離したあとの余韻 */
var fl = start();
var H3 = fl.probe.now().H;
fl.down(270, H3 * 0.9);
fl.moveTo(270, H3 * 0.9 - 150); fl.step(1);
fl.moveTo(270, H3 * 0.9 - 300); fl.step(1);
ok(fl.probe.now().glide === 0, "なぞっているあいだは余韻なし");
fl.up();
ok(fl.probe.now().glide > 0, "離すと勢いが余韻に移る", fl.probe.now().glide + "px/秒");
var s0 = fl.probe.now().score;
fl.step(30);
var s1 = fl.probe.now().score;
ok(s1 > s0, "離したあとも余韻で進む", s0 + "こぎ → " + s1 + "こぎ");
fl.step(150);
ok(fl.probe.now().glide === 0, "余韻は2〜3秒でおさまる", fl.probe.now().glide);
var s2 = fl.probe.now().score;
fl.step(120);
ok(fl.probe.now().score === s2, "おさまったら、もう進まない");

/* 3. 景色ごとに要る押しの数 */
g.probe.reset();
var marks = [], seen = 0, total = 0, guard = 0;
while (g.probe.now().state === "play" && guard++ < 5000) {
  var before = g.probe.now().gear;
  g.press(" "); total++;
  var n = g.probe.now();
  if (n.gear !== before || n.state !== "play") {
    marks.push({ phase: ["牧場", "道路", "町", "都市", "大陸", "宇宙"][before], clicks: total - seen });
    seen = total;
  }
}
ok(g.probe.now().state !== "play", "押し続ければ必ず光の速さに届く", g.probe.now().state);
marks.forEach(function (m) { console.log("    " + m.phase + " … " + m.clicks + "こぎ"); });
ok(marks.length === 6, "景色は6つ", marks.length + "つ");
ok(marks[0].clicks === 100, "牧場は100押し", marks[0].clicks);
var inc = marks.every(function (m, i) { return i === 0 || m.clicks >= marks[i - 1].clicks; });
ok(inc, "先へ行くほど押す数が増える", marks.map(function (m) { return m.clicks; }).join(" → "));
ok(total > 1250 && total < 1400, "光の速さまで合計1300こぎくらい", total + "こぎ");
ok(g.probe.now().score === total, "結果の数字は押した回数", g.probe.now().score);

/* 3b. 景色が変わると速報が出る */
var nw = start();
ok(nw.probe.now().news === "", "はじめは速報なし");
while (nw.probe.now().gear === 0 && nw.probe.now().state === "play") nw.press(" ");
nw.step(1);
ok(nw.probe.now().news.indexOf("逃走") >= 0, "道路に出ると速報が流れる", nw.probe.now().news);
nw.step(60 * 9);
ok(nw.probe.now().news === "", "速報は流れきると消える");

/* 4. ギアの中身 */
[[0, "牧場", 0.1], [120, "道路", 0.2], [320, "町", 0.75], [510, "都市", 3.2], [760, "大陸", 110], [1020, "宇宙", 3600000]].forEach(function (c) {
  var t = start();
  push(t, c[0]);
  var n = t.probe.now();
  ok(n.phase === c[1] && n.step === c[2], c[0] + "押しめは" + c[1] + "（1押し " + c[2] + "km/h）",
     n.phase + " / " + n.step + " / " + n.read);
});

/* 5. 壊すものが景色ごとに変わる */
[[40, "牧場"], [180, "道路"], [380, "町"], [580, "都市"], [800, "大陸"], [1060, "宇宙"]].forEach(function (c) {
  var t = start();
  push(t, c[0], 1);
  var before = t.probe.now().broken;
  t.step(60 * 12);
  var n = t.probe.now();
  ok(n.broken > before, c[1] + "で道の先のものを壊す",
     "壊した数 " + (n.broken - before) + " / " + n.read);
});
/* 破片は立体のほうで持つので、偽DOMでは数えない（壊した数で見る） */

/* 6. 警告と、やめれば壊れない */
var t4 = start();
var toWarn = 0;
while (!t4.probe.now().warn && t4.probe.now().state === "play" && toWarn < 3000) { t4.press(" "); toWarn++; }
ok(t4.probe.now().warn, "光の速さの手前で警告が出る", t4.probe.now().read + " / " + toWarn + "押しめ");
var t5 = start(), left = 0;
push(t5, toWarn);
while (t5.probe.now().state === "play" && left < 2000) { t5.press(" "); left++; }
ok(left > 10 && left < 60, "警告が出てから光の速さまで少し間がある", left + "押し");
t4.step(60 * 30);
ok(t4.probe.now().state === "play" && t4.probe.now().warn, "警告のまま押すのをやめれば壊れない（30秒）", t4.probe.now().read);

/* 7. 宇宙が壊れる */
var t6 = start();
while (t6.probe.now().state === "play") t6.press(" ");
ok(t6.probe.now().state === "boom", "光の速さに届くと宇宙が壊れる", t6.probe.now().read);
ok(t6.probe.now().read === "1,079,252,849 km/h", "壊れる瞬間はちょうど光の速さ", t6.probe.now().read);
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
ok(t7.probe.now().score === 3, "スペースの連打でも進む", t7.probe.now().score + "こぎ");
t7.pad({ press: true }); t7.step(1); t7.pad({}); t7.step(1);
ok(t7.probe.now().score === 4, "ジョイパッドでも進む", t7.probe.now().score + "こぎ");
t7.esc();
ok(t7.probe.now().score === 0, "Escで最初から");

/* 10. 画面の形 */
[[375, 667], [390, 844], [430, 932], [768, 1024], [412, 915], [360, 780]].forEach(function (v) {
  var t = load(FILE, { w: v[0], h: v[1] });
  t.press(" "); t.step(2);
  push(t, 5, 1);
  ok(t.probe.now().score === 5 && Math.abs(t.probe.now().kmh - 0.6) < 1e-9,
     "画面 " + v[0] + "x" + v[1] + " で押せる", "高さ" + t.probe.now().H + " / " + t.probe.now().read);
});

console.log(ng ? "\n問題 " + ng + " 件" : "\nぜんぶ通った");
process.exit(ng ? 1 : 0);
