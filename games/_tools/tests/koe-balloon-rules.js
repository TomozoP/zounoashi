const assert=require('assert'),load=require('../harness');
const g=load('games/koe-balloon/index.html',{inject:'window.__dbg={crash:popBalloon,set:function(t,y){T=t;py=y;},replay:replayStep,carve:carve,trap:trapPosition};'});
g.press(' ');g.key(' ');g.step(1);assert.equal(g.probe.now().air,1);
g.dbg.crash();assert.equal(g.probe.now().lives,99);assert.equal(g.probe.now().state,'dead');const frozen=g.probe.now().time;g.step(17);assert.equal(g.probe.now().state,'dead');assert.equal(g.probe.now().time,frozen);g.step(1);assert.equal(g.probe.now().state,'play');assert.equal(g.probe.now().time,0,'0.3秒後に再開');assert.equal(g.probe.now().air,1,'長押しを次の機体へ引き継ぐ');
for(let i=0;i<99;i++){g.dbg.crash();g.step(18);}
assert.equal(g.probe.now().lives,0);assert.equal(g.probe.now().historyCount,100);assert.equal(g.probe.now().state,'result');
g.dbg.crash();assert.equal(g.probe.now().lives,0,'残機が負にならない');
g.press(' ');assert.equal(g.probe.now().lives,100);
g.dbg.set(1,400);g.dbg.crash();assert(g.probe.now().damage[0],"自機の衝突直後にも柱が削れる");g.step(18);assert.deepEqual(g.probe.now().damage,{});
g.dbg.set(.84,400);g.dbg.replay(0);assert.deepEqual(g.probe.now().damage,{});
g.dbg.set(.9,400);g.dbg.replay(0);assert(g.probe.now().damage[0],'先行する機体の爆発で柱が削れる');
const m=g.dbg.trap(0,2);g.dbg.set(2,400);g.dbg.carve(m.x+820,m.y);assert(g.probe.now().destroyed>0,'爆風で正面の弾を壊す');
console.log('0.3秒待って交代・長押し継続・100体終了・爆発による柱と弾の破壊を確認');
