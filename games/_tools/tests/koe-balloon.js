const assert=require('assert');const load=require('../harness');
const file='games/_koe-balloon/index.html';
let g=load(file);g.step(120);assert.equal(g.probe.now().state,'intro');
g.press(' ');assert.equal(g.probe.now().state,'play');assert.equal(g.probe.now().air,0);
g.key(' ');g.step(18);assert(g.probe.now().air>.95);assert(g.probe.now().vy<0);
g.key(' ',true);g.step(18);assert.equal(g.probe.now().air,0,'無音で噴射を止める');g.step(30);assert(g.probe.now().vy>0);
g.probe.reset();assert(g.until(()=>g.probe.now().state==='result',1200),'無操作で落下して終わる');
g.press(' ');assert.equal(g.probe.now().state,'play');
for(const shape of [[390,844],[700,700],[500,1600]]){
  g=load(file,{w:shape[0],h:shape[1]});g.probe.reset();
  let hold=false;
  for(let n=0;n<3600;n++){
    let p=g.probe.now();assert.equal(p.state,'play','経路を通過できる '+shape+' '+n);
    let gate=p.gates.find(x=>x.x+58>90);
    let target=gate?(gate.top+gate.bottom)/2:p.H*.52;
    let desired=p.y+p.vy*.18>target;
    if(n%6===0 && !hold && desired){g.key(' ');hold=true;}
    if(n%6===0 && hold && !desired){g.key(' ',true);hold=false;}
    g.step(1);
  }
  assert(g.probe.now().score>=14);console.log('60秒の通過確認',shape.join('×'),g.probe.now().score);
}
console.log('開始・噴射・停止・落下・再挑戦を確認');
