const assert=require('assert'),load=require('../harness');
for(const shape of [[390,844],[700,700],[500,1600]]){
 const g=load('games/_zekkyou-saiban/index.html',{w:shape[0],h:shape[1],inject:`var testVolume=0;readVoice=function(){return testVolume;};window.__dbg={volume:function(v){testVolume=v;},words:function(t){mode='words';chooseWords(t);}};`});
 g.press(' ');g.dbg.words('時間');assert.equal(g.probe.now().selected,1);g.dbg.volume(1);g.step(30);assert(g.probe.now().won);g.step(100);assert.equal(g.probe.now().state,'result');
 g.probe.reset();g.dbg.volume(0);g.dbg.words('天気');g.dbg.volume(1);g.step(30);assert(!g.probe.now().won);assert.equal(g.probe.now().state,'fall');
 g.probe.reset();g.dbg.volume(0);g.step(300);assert.equal(g.probe.now().selected,-1);while(g.probe.now().scan!==g.probe.now().answer)g.step(1);g.dbg.volume(1);g.step(30);assert(g.probe.now().won);
 console.log(shape.join('×')+'：単語の選択・誤答・無音・順番選択を確認');
}
