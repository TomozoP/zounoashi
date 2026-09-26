const assert=require('assert'),load=require('../harness');
const g=load('games/_koe-balloon/index.html',{inject:'var testVoice=0;readVoice=function(){return testVoice;};window.__dbg={voice:function(v){testVoice=v;},crash:popBalloon};'});
function trace(){const out=[];for(let i=0;i<60;i++){g.dbg.voice(i%10<4?1:0);g.step(1);const p=g.probe.now();assert.equal(p.state,'play');out.push([p.y,p.vy,p.air]);}return out;}
g.probe.reset();const first=trace();g.dbg.crash();g.until(()=>g.probe.now().state==='play',100);assert.equal(g.probe.now().historyCount,1);const second=trace();assert(second.every((p,i)=>p.every((v,j)=>Math.abs(v-first[i][j])<1e-8)));
console.log('同じ音量入力なら初回と自動再開後の高さ・速度・噴射が60コマ一致');
