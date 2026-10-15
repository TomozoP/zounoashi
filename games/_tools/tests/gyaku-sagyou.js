/* 逆・作業支援ツール: 落ちずに妨害が出続けるか、押すと止まるか（ゲージや結果はない）。 */
var path = require("path");
var load = require("../harness");
var g = load(path.join(__dirname, "../../_gyaku-sagyou/index.html"));
/* 台はタテ540の座標で触るので、ヨコ960×540のゲーム座標に直して触る */
function tap(x, y) { g.tap(x * 540 / 960, y * g.H / 540); }
g.press(" "); g.step(5);
g.step(60 * 6);
var s = g.probe.now(), before = s.active.length + s.popups, stopped = 0;
for (var i = 0; i < 40; i++) {
  s = g.probe.now();
  if (s.popupClose.length) { var c = s.popupClose[s.popupClose.length - 1]; tap(c.x, c.y); stopped++; }
  else if (s.targets.length) { var v = s.targets[0]; tap(v.x, v.y); stopped++; }
  g.step(2);
}
s = g.probe.now();
var ok = s.state === "play" && before > 5 && stopped > 0;
console.log(ok ? "OK" : "NG", "6秒で鳴った数", before, "止めた回数", stopped, "残り", s.active.length + s.popups, "妨害", s.disturb);
if (!ok) process.exit(1);
