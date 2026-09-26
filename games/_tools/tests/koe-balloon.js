/* 声で上昇し、上から来るすき間を左右移動で通る。 */
const assert=require('assert'),load=require('../harness');
const file='games/_koe-balloon/index.html';
let g=load(file);g.step(120);assert.equal(g.probe.now().state,'intro');g.press(' ');
g.key(' ');g.step(30);assert(g.probe.now().vy>0);assert(g.probe.now().altitude>0);
g.key(' ',true);g.step(100);assert.equal(g.probe.now().air,0);assert(g.probe.now().vy<0);
g.probe.reset();assert(g.until(()=>g.probe.now().state==='result',1600));
for(const shape of [[390,844],[700,700],[500,1600]]){
 g=load(file,{w:shape[0],h:shape[1]});g.probe.reset();g.key(' ');
 let left=false,right=false;
 for(let n=0;n<3600;n++){
  const p=g.probe.now();assert.equal(p.state,'play','上昇経路 '+shape+' '+n);
  const gate=p.gates.find(x=>x.height+54>p.altitude),target=gate?(gate.left+gate.right)/2-8:270;
  const l=p.x>target+7,r=p.x<target-7;
  if(l!==left){g.key('ArrowLeft',!l);left=l;}if(r!==right){g.key('ArrowRight',!r);right=r;}g.step(1);
 }
 assert(g.probe.now().score>=20);assert(g.probe.now().scroll>1000);console.log('60秒の上昇・通過',shape.join('×'),g.probe.now().score);
}
