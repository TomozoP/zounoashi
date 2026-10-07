/* 雪玉ポメ：開始・転がって大きくなる・時間で結果・再開を短く確認する。 */
const assert = require('assert');
const load = require('../harness');
const g = load('games/_snow-pome/index.html');
assert.equal(g.probe.now().state, 'intro');
g.press(' ');
g.step(2);
assert.equal(g.probe.now().state, 'play');
g.down(270, 600);
for (let i = 0; i < 60 * 41 && g.probe.now().state === 'play'; i++) { g.moveTo(270 + Math.sin(i / 40) * 200, 600); g.step(1); }
g.up();
const r = g.probe.now();
assert.equal(r.state, 'result', '40秒で結果になる');
assert.ok(r.score > 60, '転がって大きくなる ' + r.score);
g.press(' '); g.step(2);
assert.equal(g.probe.now().state, 'play');
console.log('雪玉ポメ：開始・転がって大きくなる（直径' + r.score + 'cm）・結果・再開を確認');
