const assert=require('assert'),load=require('../harness');
const g=load('games/_koe-bridge/index.html',{inject:`window.__dbg={set:function(y,a,w){newRound();carY=y;angle=a;spin=w;fallSpeed=0;},step:physicsStep};`});
g.dbg.set(-200,.4,2);const before=g.probe.now();for(let i=0;i<24;i++)g.dbg.step(1/240);let p=g.probe.now();assert(Math.abs(p.spin-2)<1e-8,'空中では回転を強制しない');assert(Math.abs(p.speed-before.speed)<1e-8,'空中では水平速度を固定し直さない');assert(p.vy>0,'重力');
g.dbg.set(8,.3,0);g.dbg.step(1/240);p=g.probe.now();assert(p.spin<0,'沈んだ前端への浮力がトルクを作る');console.log('重力・角運動量・接水点のトルクを確認');
