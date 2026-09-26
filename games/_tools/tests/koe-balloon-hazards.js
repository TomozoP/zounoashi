const assert=require('assert'),load=require('../harness');
const g=load('games/_koe-balloon/index.html',{inject:'window.__dbg={trap:trapPosition,hazard:hazardPosition,hit:hazardHit,set:function(t,y){T=t;py=y;},carve:carve};'});
g.probe.reset();
g.dbg.set(0,300);
assert(!g.dbg.hit({type:0,x:149,y:300,gap:50}),'撤去した壁は当たらない');
assert(!g.dbg.hit({type:0,x:149,y:300,gap:160}),'開いた壁');
assert(g.dbg.hit({type:1,x:149,y:300}),'ノコギリ');
assert(!g.dbg.hit({type:2,x:130,y:300,active:true}),'撤去したレーザーは当たらない');
assert(!g.dbg.hit({type:2,x:130,y:300,active:false}),'予告線は当たらない');
g.dbg.set(2,300);const h=g.dbg.hazard(1,2);g.dbg.carve(h.x+820,h.y);
assert(g.probe.now().destroyed>0,'爆発でトラップ破壊');
assert(g.probe.now().progress>0);g.probe.reset();assert.equal(g.probe.now().progress,0);
console.log('壁の撤去・回転刃・レーザーの判定、爆発で破壊、距離バーを確認');

const before=Array.from({length:44},(_,i)=>g.dbg.trap(i,12));g.probe.reset();assert.deepEqual(Array.from({length:44},(_,i)=>g.dbg.trap(i,12)),before,'ロケットは毎回同じ時刻に同じ位置');
