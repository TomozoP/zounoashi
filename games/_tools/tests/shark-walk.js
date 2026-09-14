/* サメの歩行：待機、接地、踏み替え、ゴール、やり直しを確認する。 */
const assert=require('assert');
const load=require('../harness');
const g=load('games/_shark-walk/index.html',{withScripts:true});
g.step(180);
assert.equal(g.probe.now().state,'intro');
assert.equal(g.probe.now().steps,0);
g.press(' ');
assert.equal(g.probe.now().state,'play');
assert.equal(g.probe.now().steps,0,'開始操作を歩行に混ぜない');
g.step(600);
assert(Math.abs(g.probe.now().x-222.5)<20,'放置してもゴールへ進まない');
assert(g.probe.now().contacts>0,'足が接地する');
g.down(270,600).step(20);
let steps=g.probe.now().steps;
g.wrap.fire('pointercancel',{});
assert.equal(g.probe.now().steps,steps,'取消で蹴らない');
g.esc();
let frames=0;
while(g.probe.now().state==='play'&&frames<6000){g.down(270,600).step(32).up().step(32);frames+=64;g.drawn.length=0;assert(g.probe.now().finite);}
assert.equal(g.probe.now().state,'result','踏み替えでゴールに着く');
assert(g.probe.now().x>=2500);
console.log('到着',g.probe.now().score+'秒',g.probe.now().steps+'回の踏み替え');
g.esc();assert.equal(g.probe.now().state,'play');assert.equal(g.probe.now().steps,0);
load.SHAPES.forEach(v=>{g.view(v[0],v[1]);g.step(30);assert(g.probe.now().finite);assert(g.probe.now().H>=780&&g.probe.now().H<=1700);});
for(let i=0;i<240;i++){g.press(i%2?' ':'Enter').step(2);g.drawn.length=0;assert(g.probe.now().finite);}
console.log('開始・放置・接地・取消・到着・再挑戦・画面6種類・連打：確認済み');
