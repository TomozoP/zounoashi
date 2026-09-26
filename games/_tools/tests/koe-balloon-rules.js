/* 通過数・即時の噴射停止・衝突と関節の物理を確認する。 */
const assert=require('assert'),load=require('../harness');
const g=load('games/_koe-balloon/index.html',{inject:`
  window.__dbg={setup:function(x){newRound();gates=[{x:x,top:10,bottom:H-10}];},
    empty:function(){air=0;},pop:popBalloon,physics:fallStep,
    links:function(){return doll.links.map(function(l){var a=doll.points[l.a],b=doll.points[l.b];return Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-l.length);});}};
`});
g.dbg.setup(500);g.step(30);assert.equal(g.probe.now().score,0,'時間では増えない');
g.dbg.setup(45);g.step(1);assert.equal(g.probe.now().score,0,'通り抜ける前は加算しない');
g.step(2);assert.equal(g.probe.now().score,1,'柱の後端を抜けたら1');
g.step(30);assert.equal(g.probe.now().score,1,'二重加算しない');
g.probe.reset();g.dbg.empty();g.key(' ');g.step(1);assert.equal(g.probe.now().air,1,'強い声は1コマで最大');
g.key(' ',true);g.step(1);assert.equal(g.probe.now().air,0,'無音では1コマで最小');
g.dbg.pop();assert.equal(g.probe.now().state,'fall');const before=g.probe.now().doll.map(p=>({...p}));
g.key(' ');g.step(35);assert.equal(g.probe.now().state,'fall','落下を見せてから結果へ');
assert(g.probe.now().doll[0].y>before[0].y,'重力で落下');
assert(Math.max(...g.dbg.links())<2,'関節のつながりを保持');
assert(Math.abs((g.probe.now().doll[4].x-g.probe.now().doll[1].x)-(before[4].x-before[1].x))>5,'手が胴体と別に動く');
g.step(120);assert.equal(g.probe.now().state,'result');assert.equal(g.probe.now().score,0,'落下中は得点しない');
g.press(' ');assert.equal(g.probe.now().state,'play');assert.equal(g.probe.now().doll,null,'再挑戦で復元');
console.log('柱の通過数・即時の反応・重力落下・関節・再挑戦を確認');
