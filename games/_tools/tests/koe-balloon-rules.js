const assert=require('assert'),load=require('../harness');
const g=load('games/_koe-balloon/index.html',{inject:'window.__dbg={crash:function(){T=2.7;py=H*.36;track=[{y:.36,air:1},{y:.36,air:0}];popBalloon();},off:function(){air=0;},physics:fallStep};'});
g.press(' ');g.key(' ');g.step(1);assert.equal(g.probe.now().air,1);
g.key(' ',true);g.step(1);assert.equal(g.probe.now().air,0);
g.dbg.crash();let p=g.probe.now();assert.equal(p.historyCount,1);assert(p.damage[0],'爆発が柱を削る');
const first=p.doll[0].y;g.step(35);assert(g.probe.now().doll[0].y>first);
g.step(120);assert.equal(g.probe.now().state,'result');
g.press(' ');g.step(1);p=g.probe.now();assert.equal(p.historyCount,1);assert(p.damage[0]);assert(p.ghosts[0].x>155,'過去の自分は先行');
for(let i=0;i<12;i++){g.dbg.crash();g.step(140);g.press(' ');}
assert.equal(g.probe.now().historyCount,10,'記録は直近10回まで');
console.log('即時噴射・落下・爆発による削れ・先行する履歴・10回の上限を確認');
