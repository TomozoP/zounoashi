/* 声量と勝訴の関係、無音の終了、再挑戦を確認する。 */
const assert=require('assert'),load=require('../harness');
const file='games/_zekkyou-saiban/index.html';
for(const shape of [[390,844],[700,700],[500,1600]]){
 const g=load(file,{w:shape[0],h:shape[1],inject:`var testVolume=0;readVoice=function(){return testVolume;};window.__dbg={volume:function(v){testVolume=v;}};`});
 g.step(60);assert.equal(g.probe.now().state,'intro');g.press(' ');g.dbg.volume(.5);g.step(480);g.step(90);assert.equal(g.probe.now().state,'result');assert(!g.probe.now().won);
 g.probe.reset();g.dbg.volume(1);g.step(1);g.dbg.volume(0);g.step(30);assert(!g.probe.now().won,'一瞬の音で勝たない');
 g.dbg.volume(1);g.step(30);assert(g.probe.now().won);g.step(100);assert.equal(g.probe.now().state,'result');g.press(' ');assert.equal(g.probe.now().state,'play');assert(!g.probe.now().won);
 console.log(shape.join('×')+'：声量0.5は8秒で終了、声量1は0.5秒以内に勝訴、再挑戦を確認');
}
