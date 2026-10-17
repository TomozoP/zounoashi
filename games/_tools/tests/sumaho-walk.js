/* スマホ歩き：ほどよい間でタップすると歩ける。タップをやめたり、急ぎすぎたりすると倒れて割れる。 */
var load = require("../harness");
function run(gap, sec) {
  var g = load(__dirname + "/../../_sumaho/index.html");
  g.probe.reset(); var next = 0;
  for (var i = 0; i < 60 * sec; i++) {
    if (i >= next && (gap || i === 0)) { g.probe.tap(); next = i + (gap || 1e9); }
    g.probe.step(1);
    if (g.probe.now().state === "result") break;
  }
  return g.probe.now();
}
var ng = 0;
function ok(c, m) { console.log((c ? "OK  " : "NG  ") + m); if (!c) ng++; }
var q = run(30, 4); ok(!q.broken && q.x > 1.5, "0.5秒ごとのタップで4秒間倒れずに進む（" + q.x.toFixed(1) + "）");
q = run(30, 180); ok(q.state === "result", "続けてもいずれ割れて結果へ（" + q.score + "cm）");
q = run(0, 10); ok(q.broken, "1回だけで止まると倒れて割れる");
q = run(6, 10); ok(q.broken, "急ぎすぎると倒れて割れる");
process.exit(ng ? 1 : 0);
