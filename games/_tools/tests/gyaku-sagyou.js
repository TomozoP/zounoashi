/* 逆・作業支援ツール: 落ちずに作業が終わるか。通知を閉じ、道具を止めながら打つ。 */
var path = require("path");
var load = require("../harness");
var g = load(path.join(__dirname, "../../_gyaku-sagyou/index.html"));
g.press(" "); g.step(5);
var taps = 0;
for (var i = 0; i < 6000 && g.probe.now().state !== "result"; i++) {
  var s = g.probe.now();
  if (s.state === "play" && i % 7 === 0) {
    taps++;
    if (s.popupClose.length) { var c = s.popupClose[s.popupClose.length - 1]; g.tap(c.x, c.y); }
    else if (s.evs.some(function (e) { return e.block; })) { var b = s.evs.filter(function (e) { return e.block; })[0]; g.tap(b.x, b.y); }
    else if (s.evs.length && s.active.length + s.evs.length >= 6) { var v = s.evs[0]; g.tap(v.x, v.y); }
    else if (s.active.length >= 2) { var a = s.gadgets.filter(function (q) { return q.id === s.active[0]; })[0]; g.tap(a.x, a.y); }
    else g.tap(270, s.H * 0.6);
  }
  g.step(1);
}
var e = g.probe.now();
console.log(e.state === "result" ? "OK" : "NG", "結果", e.score + "秒", "妨害" + e.disturb + "回", "タップ" + taps);
if (e.state !== "result") process.exit(1);
