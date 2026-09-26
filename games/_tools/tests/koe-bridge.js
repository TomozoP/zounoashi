const assert=require('assert'),load=require('../harness');
for(const shape of [[390,844],[700,700],[500,1600]]){
 const g=load('games/_koe-bridge/index.html',{w:shape[0],h:shape[1],inject:`var volume=0;readVoice=function(){return volume;};window.__dbg={volume:function(v){volume=v;}};`});
 g.press(' ');g.dbg.volume(.45);g.step(241);assert.equal(g.probe.now().road.length,120);assert(g.until(()=>g.probe.now().state==='result',1400));assert(g.probe.now().won,'一定の声で渡れる');
 g.probe.reset();g.dbg.volume(0);g.step(241);g.until(()=>g.probe.now().state==='result',1400);assert(!g.probe.now().won,'無音では落ちる');
 g.probe.reset();g.dbg.volume(1);g.step(241);g.until(()=>g.probe.now().state==='result',1400);assert(!g.probe.now().won,'大声の急坂では止まる');
 console.log(shape.join('×')+'：4秒の橋作り・一定音で成功・無音と急坂で失敗');
}
