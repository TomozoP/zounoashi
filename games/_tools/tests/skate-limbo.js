/* 開始・反り・重心・バー・転倒を、実際の入力と氷上の計算で確認する。 */
const assert=require('assert'),load=require('../harness'),P=require('../../_skate-limbo/physics');
const file='games/_skate-limbo/index.html';
function game(){return load(file,{withScripts:true,quiet:true});}
function running(){const s=P.create();s.state='play';return s;}
function drive(s,bend,limit=3000){for(let i=0;i<limit&&s.state==='play';i++){s.target=bend;s.weight=P.clamp(s.roll*3+s.rv*1.7,-1,1);P.step(s,1/60);}return s;}
let g=game();g.step(180);assert.equal(g.probe.now().state,'intro');assert.equal(g.probe.now().z,0);
g.key(' ');g.step(20);assert.equal(g.probe.now().state,'intro');g.key(' ',true);assert.equal(g.probe.now().state,'play');g.step(1);assert.equal(g.probe.now().target,0,'開始を反る入力にしない');
g.key('ArrowDown');g.step(60);assert(g.probe.now().bend>.98);g.key('ArrowDown',true);g.step(60);assert(g.probe.now().bend<.02);
g.probe.reset();const H=g.probe.now().H;g.down(270,H-46);g.step(30);assert(g.probe.now().bend>.9);g.wrap.fire('pointercancel',{pointerId:1});g.step(60);assert.equal(g.probe.now().target,0);assert.equal(g.probe.now().weight,0);
g.probe.reset();g.down(380,H-150);g.step(15);assert(g.probe.now().roll>0,'右入力の重心移動が以前と逆になる');g.win.fire('blur');g.step(1);assert.equal(g.probe.now().weight,0);
g.probe.reset();g.key('ArrowRight');g.step(15);assert(g.probe.now().roll>0,'右キーも反転する');g.key('ArrowRight',true);g.probe.reset();g.down(25,H-25);g.step(1);assert(g.probe.now().weight>.9,'広げた左下の端も操作できる');g.up();
g.probe.reset();g.down(50,100);g.step(2);assert.equal(g.probe.now().weight,0,'操作面の外を押しても力は加わらない');
g=game();const e={pointerId:8,isPrimary:true,button:0,clientX:30,clientY:40,preventDefault(){},stopImmediatePropagation(){}};g.doc.fire('pointerdown',e);g.doc.fire('pointercancel',e);g.doc.fire('pointerup',e);assert.equal(g.probe.now().state,'intro');g.doc.fire('pointerdown',e);g.doc.fire('pointerup',e);assert.equal(g.probe.now().state,'play');assert.equal(g.probe.now().target,0);
for(const [w,h] of load.SHAPES){g.view(w,h);g.step(2);assert(Number.isFinite(g.probe.now().z));assert(g.probe.now().H>=780);}
let s=drive(running(),0);assert.equal(s.reason,'bar');assert.equal(s.score,0);const collisionZ=s.z;assert(collisionZ>15&&collisionZ<17);
let furthest=s.z,maxLift=0;for(let i=0;i<280;i++){P.step(s,1/60);furthest=Math.max(furthest,s.z);for(const p of s.rag){assert(Number.isFinite(p.x+p.y+p.z));assert(p.y>=.12);maxLift=Math.max(maxLift,p.y);}}
assert.equal(s.state,'result');assert(furthest-collisionZ>1,'転んだ勢いが氷上の滑りに残る');assert(maxLift>1.4,'手足が持ち上がる');
P.links.forEach(([a,b],i)=>{const p=s.rag[a],q=s.rag[b];assert(Math.abs(Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)-s.lengths[i])<.12,'手足がちぎれない');});
s=running();s.weight=1;for(let i=0;i<240&&s.state==='play';i++)P.step(s,1/60);assert.equal(s.reason,'balance');assert(s.z<16,'バーの前でも重心を崩すと転ぶ');
const mid=drive(running(),.7),deep=drive(running(),1);assert(mid.score>=1&&mid.score<7);assert.equal(deep.score,7);assert.equal(deep.reason,'clear');assert.equal(deep.state,'result');assert.equal(deep.distance,deep.goal,'ゴールで残り距離がゼロ');
/* 指の左右調整だけで全バーを通れることを台で確認。内部状態は書き換えない。 */
g=game();g.press(' ');let steps=0;g.down(270,g.probe.now().H-46);
while(g.probe.now().state==='play'&&steps++<2400){const n=g.probe.now(),weight=P.clamp(n.roll*3+n.rv*1.7,-1,1);g.moveTo(270-weight*220,n.H-46);g.step(1);}
assert.equal(g.probe.now().score,7);assert.equal(g.probe.now().reason,'clear');g.press(' ');assert.equal(g.probe.now().state,'play');assert.equal(g.probe.now().score,0);assert.equal(g.probe.now().z,0);
console.log('開始・取消・左右の向き・反り・画面6種・衝突・転倒後の関節・再挑戦：確認済み');
console.log('反り90%まで約0.45秒。立つと加速、反ると減速。');
console.log('転倒後の移動 '+(furthest-collisionZ).toFixed(2)+'m、7本通過 '+(steps/60).toFixed(2)+'秒。');

/* 転倒直後に距離を共有でき、転がった距離で記録が増えない。 */
g=game();assert.equal(g.probe.now().distance,0);assert.equal(g.probe.now().remaining,131.5);g.press(' ');assert(g.until(()=>g.probe.now().state==='fall',400));
const record=g.probe.now().distance;assert(record>0);assert(g.probe.now().shareVisible);assert(g.probe.now().shareText.includes(record.toFixed(1)+'m'));
g.step(180);assert.equal(g.probe.now().distance,record);assert(g.probe.now().z>record);g.tap(150,g.probe.now().H-92);g.step(1);assert.equal(g.probe.now().state,'play');assert(!g.probe.now().shareVisible);assert(g.probe.now().distance<.1);
console.log('転倒直後の共有・距離の固定・残り距離・ゴール・再挑戦を確認');

// バーのない区間で、姿勢だけによる速度差を確かめる。
const upright=running(),bent=running();upright.gates.forEach(g=>g.z+=1000);bent.gates.forEach(g=>g.z+=1000);drive(upright,0,180);drive(bent,1,180);assert(upright.speed>bent.speed+1.2,'立った姿勢では十分に速くなる');assert(upright.speed<5.77&&bent.speed>3.7,'速度は急激に変えず範囲内に収める');console.log('3秒後の速度：直立 '+upright.speed.toFixed(2)+'m/s、反り '+bent.speed.toFixed(2)+'m/s');
