/* 開始・反り・重心・バー・転倒を、実際の入力と氷上の計算で確認する。 */
const assert=require('assert'),load=require('../harness'),P=require('../../_skate-limbo/physics');
const file='games/_skate-limbo/index.html';
function game(){return load(file,{withScripts:true,quiet:true});}
function running(){const s=P.create();s.state='play';return s;}
function drive(s,bend,limit=4200){for(let i=0;i<limit&&s.state==='play';i++){s.target=bend;s.weight=P.clamp(s.roll*3+s.rv*1.7,-1,1);P.step(s,1/60);}return s;}
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
const stopped=drive(running(),1,240);assert.equal(stopped.speed,0);assert.equal(stopped.state,'play');const stopZ=stopped.z;drive(stopped,1,60);assert.equal(stopped.z,stopZ);drive(stopped,0,60);assert(stopped.speed>2&&stopped.z>stopZ,'起こすと再発進する');
/* 指の左右調整だけで全バーを通れることを台で確認。内部状態は書き換えない。 */
g=game();g.press(' ');let steps=0;g.down(270,g.probe.now().H-46);
while(g.probe.now().state==='play'&&steps++<4200){const n=g.probe.now(),weight=P.clamp(n.roll*3+n.rv*1.7,-1,1);const gate=n.gates.find(v=>!v.passed),brake=gate&&gate.z-n.z<4;g.moveTo(270-weight*220,n.H-(brake?46:246));g.step(1);}
assert.equal(g.probe.now().score,12);assert.equal(g.probe.now().reason,'clear');g.press(' ');assert.equal(g.probe.now().state,'play');assert.equal(g.probe.now().score,0);assert.equal(g.probe.now().z,0);
console.log('開始・取消・左右の向き・反り・画面6種・衝突・転倒後の関節・再挑戦：確認済み');
console.log('反り90%まで約0.45秒。立つと加速、反ると減速。');
console.log('転倒後の移動 '+(furthest-collisionZ).toFixed(2)+'m、12本通過 '+(steps/60).toFixed(2)+'秒。');

/* 転倒直後に距離を共有でき、転がった距離で記録が増えない。 */
g=game();assert.equal(g.probe.now().distance,0);assert.equal(g.probe.now().remaining,231);g.press(' ');assert(g.until(()=>g.probe.now().state==='fall',400));
const record=g.probe.now().distance;assert(record>0);assert(g.probe.now().shareVisible);assert(g.probe.now().shareText.includes(record.toFixed(1)+'m'));
g.step(180);assert.equal(g.probe.now().distance,record);assert(g.probe.now().z>record);g.tap(150,g.probe.now().H-92);g.step(1);assert.equal(g.probe.now().state,'play');assert(!g.probe.now().shareVisible);assert(g.probe.now().distance<.1);
console.log('転倒直後の共有・距離の固定・残り距離・ゴール・再挑戦を確認');

// バーのない区間で、姿勢だけによる速度差を確かめる。
const upright=running(),bent=running();upright.gates.forEach(g=>g.z+=1000);bent.gates.forEach(g=>g.z+=1000);drive(upright,0,180);drive(bent,1,180);assert(upright.speed>bent.speed+1.2,'立った姿勢では十分に速くなる');assert(upright.speed<6.46&&bent.speed===0,'速度は急激に変えず範囲内に収める');console.log('3秒後の速度：直立 '+upright.speed.toFixed(2)+'m/s、反り '+bent.speed.toFixed(2)+'m/s');

// 同じ姿勢でも、斜めバーの低い側は衝突し、高い側は通れる。
for(const slope of [-.12,.12]){for(const side of [-1,1]){const trial=running();trial.x=side*Math.sign(slope);trial.bend=.8;trial.gates=[{z:5,height:1.5,slope,passed:false,hit:false,drop:0}];trial.goal=6.5;drive(trial,.8,200);assert.equal(trial.reason,side<0?'bar':'clear');}}
console.log('左右両向きの斜めバーの高さに沿った衝突を確認');

// 最後のバー通過とゴールライン到達を別々に確かめる。
const finish=running();finish.z=227;finish.distance=227;finish.bend=1;finish.score=12;finish.gates.forEach(g=>g.passed=true);drive(finish,1,1);assert.equal(finish.state,'play');drive(finish,0,180);assert.equal(finish.reason,'clear');assert.equal(finish.distance,231);
const flat=running(),slopeRun=running();flat.z=100;slopeRun.z=180;for(const v of [flat,slopeRun])v.gates.forEach(g=>g.z+=1000);drive(flat,0,180);drive(slopeRun,0,180);assert(slopeRun.speed>flat.speed+1);assert(P.ground(200)<P.ground(170));
const tumble=running();tumble.z=200;tumble.roll=1.5;P.step(tumble,1/60);for(let i=0;i<240;i++)P.step(tumble,1/60);assert(tumble.rag.every(p=>p.y>=P.ground(p.z)+.12));console.log('下り坂の加速・坂での転倒・ゴールライン到達を確認');

// 空中に余裕がある傾きでは転ばず、靴も氷へ潜らない。
for(const z of [0,200])for(const bend of [0,1])for(const side of [-1,1]){const v=running();v.z=z;v.bend=bend;v.target=bend;v.roll=side*.78;P.step(v,1/60);assert.equal(v.state,'play');const pose=P.pose(v);for(const i of [9,11])assert(pose[i].y>=P.ground(pose[i].z)+.119);v.roll=side*1.55;P.step(v,1/60);assert.equal(v.reason,'balance');}console.log('左右の接地・空中での立て直し・坂の上の接触を確認');

const downhillStop=running();downhillStop.z=180;downhillStop.gates.forEach(g=>g.z+=1000);drive(downhillStop,1,360);assert.equal(downhillStop.speed,0,'下り坂でもブレーキで止まれる');assert.equal(downhillStop.state,'play');console.log('平地と坂での停止、直立での再発進を確認');
