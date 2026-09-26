const assert=require('assert'),load=require('../harness'),fs=require('fs');
const file='games/_koe-balloon/index.html';
assert(!/getUserMedia|createScriptProcessor|requestMic/.test(fs.readFileSync(file,'utf8')),'マイクを要求しない');
for(const shape of [[390,844],[700,700],[500,1600]]){
 const g=load(file,{w:shape[0],h:shape[1]});g.press(' ');assert.equal(g.probe.now().lives,100);
 let best=0;
 for(let i=0;i<200000;i++){
  const p=g.probe.now();if(p.state==='result')break;
  const gate=p.gates.find(q=>q.x+58>120);let target=gate?(gate.top+gate.bottom)/2:p.H*.52;
  const danger=p.traps.find(m=>m.x>110&&m.x<420);
  if(danger&&Math.abs(target-danger.y)<75)target+=target<p.H*.5?-80:80;
  g.key(' ',!(p.y+p.vy*.13>target));g.step(1);best=Math.max(best,g.probe.now().score);
 }
 const p=g.probe.now();assert(p.won,'100体以内で30本を突破 '+shape+' / '+best);
 assert.equal(p.score,30);console.log(shape.join('×')+'：30本クリア、使用 '+(100-p.lives)+' 体');
 g.press(' ');assert.equal(g.probe.now().lives,100);assert.equal(g.probe.now().historyCount,0);
}
