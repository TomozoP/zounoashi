const assert=require('assert'),load=require('../harness');
function run(loud){
 const g=load('games/_koe-balloon/index.html',{inject:'window.__dbg={crash:function(){T=2.7;py=H*.36;track=[{y:.36,air:0}];beginScream();}};'});
 g.probe.reset();g.dbg.crash();if(loud)g.key(' ');
 g.step(30);assert.equal(g.probe.now().state,'scream');assert.equal(g.probe.now().historyCount,0);
 g.step(25);let p=g.probe.now();assert.equal(p.state,'fall');assert.equal(p.historyCount,1);
 assert.equal(p.damage[0][0].r,p.blastRadius);
 g.step(36);assert.equal(g.probe.now().state,'play','衝突から約1.5秒で再開');
 return p.blastRadius;
}
const quiet=run(false),loud=run(true);assert.equal(quiet,70);assert.equal(loud,270);
console.log('断末魔0.9秒・声で半径70～270・爆発範囲と削れ・自動再開を確認');
