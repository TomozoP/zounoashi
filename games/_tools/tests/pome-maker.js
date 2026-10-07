/* オリジナルポメラニアンメーカー：開始・道具の切り替え・完成・再開を短く確認する（立体の形は偽DOMでは作らない）。 */
const assert = require('assert');
const load = require('../harness');
const g = load('games/_pome-maker/index.html');
assert.equal(g.probe.now().state, 'intro');
g.press(' ');
g.step(2);
assert.equal(g.probe.now().state, 'play');
const H = g.probe.now().H;
g.tap(136, H - 62 / 2 - Math.max(28, H * 0.035)); g.step(2);
assert.equal(g.probe.now().tool, 'cut', 'ハサミを選べる');
g.down(270, H * 0.4); g.step(30); g.up();
g.win.fire('keydown', {key:'2',code:'Digit2',preventDefault:function(){}}); g.step(2);
assert.equal(g.probe.now().state, 'result');
g.press(' '); g.step(2);
assert.equal(g.probe.now().state, 'play');
assert.equal(g.probe.now().tool, 'spray', '再開するとスプレーに戻る');
console.log('オリジナルポメラニアンメーカー：開始・道具の切り替え・完成・再開を確認');
