/* 開始待ち、指離し、ジョイパッド、揚げ時間とやり直しの確認。 */
const assert=require('assert'),load=require('../harness');
const g=load('games/_karaage/index.html');
g.step(120);assert.equal(g.probe.now().state,'intro');assert.equal(g.probe.now().seconds,0);
g.press(' ');assert.equal(g.probe.now().state,'play');g.step(120);assert.equal(g.probe.now().seconds,0);
g.pad({press:true});g.step(1);assert.equal(g.probe.now().state,'play');g.pad({press:false});g.step(1);assert.equal(g.probe.now().state,'frying');
g.probe.step(480);assert(Math.abs(g.probe.now().seconds-8)<.04);g.press(' ');g.probe.step(45);assert.equal(g.probe.now().state,'result');
g.esc();assert.equal(g.probe.now().state,'play');assert.equal(g.probe.now().seconds,0);
g.press(' ');g.probe.step(1200);assert.equal(g.probe.now().state,'result');assert.equal(g.probe.now().seconds,18);
for(const [w,h] of load.SHAPES){g.view(w,h);assert(g.probe.now().H>=780&&g.probe.now().H<=1700);}
console.log('開始待ち・ジョイパッド・8秒で引き上げ・18秒で自動停止・Esc・画面6通りを確認しました');
