const assert=require('assert'),load=require('../harness');
const g=load('games/koe-balloon/index.html',{inject:'window.__dbg={hit:pillarHit};'});
const h=g.probe.now().H,p={x:320,top:300,bottom:h-100,holes:[{x:29,y:100/h,r:50}]};
assert(!g.dbg.hit(349,100,10,10,p),'円の内部を通過');
assert(g.dbg.hit(349,170,10,10,p),'爆発の外は柱が残る');
assert(g.dbg.hit(322,143,8,8,p),'円の縁では人物の大きさを判定');
p.holes.push({x:29,y:170/h,r:50});assert(!g.dbg.hit(349,145,10,10,p),'重なる爆発は穴の和集合');
console.log('円の内部・外部・縁・重なる穴の当たり判定を確認');
