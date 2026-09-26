const assert=require('assert'),load=require('../harness');
const g=load('games/_koe-balloon/index.html',{inject:'window.__dbg={crash:function(){T=2.7;py=H*.36;track=[{y:.36,air:1},{y:.36,air:0}];popBalloon();},off:function(){air=0;},physics:fallStep};'});
g.press(' ');g.key(' ');g.step(1);assert.equal(g.probe.now().air,1);
g.key(' ',true);g.step(1);assert.equal(g.probe.now().air,0);
g.dbg.crash();let p=g.probe.now();assert.equal(p.historyCount,1);assert(p.damage[0],'爆発が柱を削る');
const first=p.doll[0].y;g.step(35);assert(g.probe.now().doll[0].y>first);
g.step(54);assert.equal(g.probe.now().state,'fall','1.5秒より前は落下中');g.step(2);assert.equal(g.probe.now().state,'play','1.5秒で自動再開');
g.step(1);p=g.probe.now();assert.equal(p.historyCount,1);assert(p.damage[0]);assert(p.ghosts[0].x>155,'過去の自分は先行');
for(let i=0;i<32;i++){g.dbg.crash();g.step(91);}
assert.equal(g.probe.now().historyCount,30,'記録は直近30回まで');
console.log('即時噴射・落下・爆発による削れ・先行する履歴・30回の上限を確認');

const bottom=load('games/_koe-balloon/index.html',{inject:'window.__dbg={fall:function(){newRound();py=H-10;vy=200;popBalloon();}};'});bottom.dbg.fall();bottom.step(60);assert(bottom.probe.now().doll[0].y>bottom.probe.now().H,'下端を越えて落ち続ける');

assert(bottom.probe.now().doll.some(p=>p.x<0||p.x>bottom.probe.now().W),'左右の画面端でも部品を止めない');