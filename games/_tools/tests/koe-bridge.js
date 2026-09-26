const assert=require('assert'),load=require('../harness');
for(const shape of [[390,844],[700,700],[500,1600]]){
const g=load('games/_koe-bridge/index.html',{w:shape[0],h:shape[1],inject:`var hz=0;readPitch=function(){return hz;};window.__dbg={pitch:function(v){hz=v;},detect:detectPitch};`});
g.press(' ');let jumps=0;for(let n=0;n<3600;n++){g.dbg.pitch(n%240<120?120:400);g.step(1);if(g.probe.now().airborne)jumps++;}
let p=g.probe.now();assert.equal(p.state,'play');assert(Math.abs(p.x-7200)<.01);assert(p.road.length<90,'古い道を保持し続けない');assert(jumps>0,'起伏で跳ねる');assert(Number.isFinite(p.y));
g.dbg.pitch(0);g.step(120);p=g.probe.now();assert.equal(p.road.at(-1).y,p.road.at(-2).y,'無音で平らな道');
for(const rate of [44100,48000])for(const hz of [100,180,300,500])for(const amp of [.04,.3]){const data=Float32Array.from({length:2048},(_,i)=>amp*Math.sin(i*2*Math.PI*hz/rate));assert(Math.abs(g.dbg.detect(data,rate)-hz)/hz<.03,'音量によらず音程を検出');}
assert.equal(g.dbg.detect(new Float32Array(2048),48000),0);console.log(shape.join('×')+'：60秒定速走行・跳ね・無音・音程を確認');
}
