/* 上下移動・通過数・顔だけの落下を確認する。 */
const assert=require('assert'),load=require('../harness');
const g=load('games/_koe-balloon/index.html',{inject:`
 window.__dbg={setup:function(h){newRound();gates=[{height:h,left:100,right:440,passed:false}];},empty:function(){air=0;},pop:popBalloon};
`});
g.dbg.setup(500);g.step(30);assert.equal(g.probe.now().score,0);
g.dbg.setup(-55);g.step(1);assert.equal(g.probe.now().score,1);g.step(20);assert.equal(g.probe.now().score,1);
g.probe.reset();g.dbg.empty();g.key(' ');g.step(7);assert.equal(g.probe.now().air,1);
g.key(' ',true);g.step(7);assert.equal(g.probe.now().air,0);
g.dbg.pop();assert.equal(g.probe.now().state,'fall');const y=g.probe.now().fallen.y;
g.step(40);assert(g.probe.now().fallen.y>y);assert(g.probe.now().fallen.angle>1);
g.step(100);assert.equal(g.probe.now().state,'result');assert.equal(g.probe.now().score,0);
g.press(' ');assert.equal(g.probe.now().fallen,null);assert.equal(g.probe.now().x,270);
console.log('上方向の通過数・0.1秒の反応・顔の落下・再挑戦を確認');
