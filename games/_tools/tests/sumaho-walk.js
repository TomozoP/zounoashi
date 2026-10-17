/* スマホ歩き：左右交互にほどよい間で出すと歩ける。出さないと倒れ、同じ脚を続けたり急ぎすぎるとつまずく。 */
var load = require("../harness");
function run(gap, same) {
  var g = load(__dirname + "/../../_sumaho/index.html");
  g.probe.reset(); var k = 0;
  for (var i = 0; i < 60 * 60; i++) {
    if (gap && i % gap === 0) { g.probe.leg(same ? 0 : k); k = 1 - k; }
    if (!gap && i === 0) g.probe.leg(0);
    g.probe.step(1);
    if (g.probe.now().state === "result") break;
  }
  return g.probe.now();
}
var ng = 0;
function ok(c, m) { console.log((c ? "OK  " : "NG  ") + m); if (!c) ng++; }
var q = run(20); ok(q.x > 15, "20コマごと交互で15以上進む（" + q.x.toFixed(1) + "）");
ok(q.state === "result", "歩き続けてもいずれ割れて結果へ");
q = run(0); ok(q.broken && q.x < 3, "1歩だけだと倒れて割れる");
q = run(24, true); ok(q.broken && q.steps <= 1, "同じ脚を続けるとつまずく");
q = run(6); ok(q.broken && q.x < 3, "急ぎすぎると脚がもつれる");
process.exit(ng ? 1 : 0);
