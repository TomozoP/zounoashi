/* 逆・作業支援ツール: 落ちずに作業が終わるか。画面の邪魔を閉じ、道具を止めながら打つ。 */
var path = require("path");
var load = require("../harness");
var g = load(path.join(__dirname, "../../_gyaku-sagyou/index.html"));
g.press(" "); g.step(5);
/* 台はタテ540の座標で触るので、ヨコ960×540のゲーム座標に直して触る */
var tap0 = g.tap;
function tap(x, y) { tap0(x * 540 / 960, y * g.H / 540); }
var taps = 0;
for (var i = 0; i < 6000 && g.probe.now().state !== "result"; i++) {
  var s = g.probe.now();
  if (s.state === "play" && i % 7 === 0) {
    taps++;
    if (s.popupClose.length) { var c = s.popupClose[s.popupClose.length - 1]; tap(c.x, c.y); }
    else if (s.blocked) tap(s.W / 2, s.H / 2);
    else if (s.targets.length >= 6) { var v = s.targets[Math.floor(Math.random() * s.targets.length)]; tap(v.x, v.y); }
    else tap(480, 470);
  }
  g.step(1);
}
var e = g.probe.now();
console.log(e.state === "result" ? "OK" : "NG", "結果", e.score + "秒", "妨害" + e.disturb + "回", "タップ" + taps);
if (e.state !== "result") process.exit(1);
