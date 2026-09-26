const assert=require('assert'),load=require('../harness');
const file='games/_koe-balloon/index.html';
for(const shape of [[390,844],[700,700],[500,1600]]){
 const g=load(file,{w:shape[0],h:shape[1]});
 g.press(' ');let hold=false,cleared=false;
 for(let attempt=0;attempt<12&&!cleared;attempt++){
  for(let n=0;n<2700;n++){
   const p=g.probe.now();if(p.state!=='play')break;
   const gate=p.gates.find(x=>x.x+58>112);
   const target=gate?(gate.top+gate.bottom)/2:p.H*.52;
   const desired=p.y+p.vy*.16>target;
   if(hold!==desired){g.key(' ',!desired);hold=desired;}
   g.step(1);
  }
  const p=g.probe.now();cleared=p.won;
  if(!cleared){g.until(()=>g.probe.now().state==='play',100);hold=false;}
 }
 assert(cleared,'履歴を重ねて10本通過できる '+shape);
 assert.equal(g.probe.now().score,10);
 console.log(shape.join('×')+'：先行する履歴と削れた柱で10本通過');
 g.press(' ');assert.equal(g.probe.now().historyCount,0,'クリア後は新しいコース');
 assert.equal(g.probe.now().state,'play');
}
