const assert=require('assert'),load=require('../harness');
for(const shape of [[390,844],[700,700],[500,1600]]){
 const g=load('games/_koe-bridge/index.html',{w:shape[0],h:shape[1],inject:`var volume=0;readVoice=function(){return volume;};window.__dbg={volume:function(v){volume=v;}};`});
 g.press(' ');g.dbg.volume(.45);g.step(241);assert.equal(g.probe.now().road.length,120);assert(g.until(()=>g.probe.now().state==='result',1400));assert(g.probe.now().won,'一定の声で渡れる');
 g.probe.reset();g.dbg.volume(0);g.step(600);assert.equal(g.probe.now().road.length,0);assert.equal(g.probe.now().time,0);
 g.dbg.volume(.45);g.step(60);const n=g.probe.now().road.length,t=g.probe.now().time;g.dbg.volume(0);g.step(300);assert.equal(g.probe.now().road.length,n);assert.equal(g.probe.now().time,t,'無音で即停止');g.dbg.volume(.45);g.step(181);g.until(()=>g.probe.now().state==='result',1400);assert(g.probe.now().won,'途中で黙っても橋をつなげる');
 g.probe.reset();g.dbg.volume(1);g.step(241);g.until(()=>g.probe.now().state==='result',1400);assert(!g.probe.now().won,'大声の急坂では止まる');
 console.log(shape.join('×')+'：発声中だけ橋作り・無音で停止・再開して成功・急坂で失敗');
}
