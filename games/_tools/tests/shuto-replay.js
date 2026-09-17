/* 手刀のリプレイ。勝敗が決まったら、手刀の前後を遅く流してから結果を出す。 */
const assert=require('assert');const load=require('../harness');
const peek=`window.__dbg={
  tick:function(){update(1/10);},
  tape:function(){return {len:replayTape.length,at:replayAt,lead:REPLAY_LEAD,slow:REPLAY_SLOW,hold:REPLAY_HOLD};},
  shown:function(){var got=null,real=draw;draw=function(){got={T:T,elapsed:elapsed,fall:fallProgress(),reveal:revealAttacker(),
    spots:people.map(function(p){return {x:p.x,y:p.y};})};};drawFrame();draw=real;return got;}
};`;
function game(){const g=load('games/shuto/index.html',{inject:peek});g.probe.reset();return g;}
function toAttack(g){for(let i=0;i<720&&g.probe.now().elapsed<0;i++)g.dbg.tick();assert(g.probe.now().elapsed>=0,'手刀が出る');}
function missPick(s){
 const other=s.people.find(p=>p.id!==s.attacker&&p.id!==s.victim&&p.x>32&&p.x<508&&p.y>45&&p.y<s.H-45);
 assert(other,'手刀と関係ない人が画面内にいる');return other;
}

// 当てても外しても見逃しても、結果の前に同じ長さのリプレイが入る。
for(const how of ['caught','wrong','miss']){
 const g=game();toAttack(g);const s=g.probe.now();
 if(how==='caught')g.tap(s.people[s.attacker].x,s.people[s.attacker].y);
 else if(how==='wrong'){const other=missPick(s);g.tap(other.x,other.y);}
 else for(let i=0;i<50;i++)g.dbg.tick();
 assert.equal(g.probe.now().outcome,how,'勝敗はリプレイの前に決まる');
 assert.equal(g.probe.now().state,'replay',how+'のあとはリプレイに入る');
 assert.equal(g.dbg.tape().len,7,'控えるのは手刀とその前6コマ');
 let ticks=0;while(g.probe.now().state==='replay'&&ticks<200){g.dbg.tick();ticks++;}
 assert.equal(ticks,31,how+'のリプレイは3.1秒（流し1.8秒＋止め1.3秒）');
 assert.equal(g.probe.now().state,how==='caught'?'success':'result');
}
console.log('OK 当てた・外した・見逃した：どれも3.1秒のリプレイを挟んでから結果へ');

// 流している間の絵は手刀より前の姿。倒れておらず、印も出さない。
const g=game();toAttack(g);
const strike=g.probe.now();
for(let i=0;i<50;i++)g.dbg.tick();
const real=g.probe.now();
assert.equal(real.outcome,'miss');
assert(Math.abs(real.fallProgress-1)<1e-9,'本物の側では倒れきっている');
let f=g.dbg.shown();
assert.equal(f.fall,0,'リプレイでは倒れる前に戻っている');
assert.equal(f.elapsed,-1,'流し始めは手刀より前');
assert.equal(f.reveal,false,'流している間は印を出さない');
assert(Math.abs(f.T-(strike.T-0.6))<1e-9,'手刀の0.6秒前から流す');

// 1コマを3コマぶんの時間で見せる＝実時間の3分の1の速さ。
const startT=f.T;
g.dbg.tick();g.dbg.tick();assert.equal(g.dbg.shown().T,startT,'3コマたつまで次へ行かない');
g.dbg.tick();assert(Math.abs(g.dbg.shown().T-(startT+1/10))<1e-9,'3コマごとに1コマ進む');

// 最後は手刀のコマ。腕が伸びた1コマで止まり、出した人に印がつく。
while(g.dbg.tape().at<g.dbg.tape().len-1)g.dbg.tick();
f=g.dbg.shown();
assert.equal(f.elapsed,0,'止まるのは手刀のコマ');
assert.equal(f.reveal,true,'手刀のコマでは印を出す');
assert.equal(f.fall,0,'手刀のコマではまだ倒れていない');
assert(Math.abs(f.T-strike.T)<1e-9,'手刀が出た時刻に一致する');
f.spots.forEach((p,i)=>assert(Math.abs(p.x-strike.people[i].worldX)<1e-9&&Math.abs(p.y-strike.people[i].worldY)<1e-9,'居場所も手刀のときと同じ'));
console.log('OK 流すのは手刀の0.6秒前から、3分の1の速さで、腕の伸びた1コマで止まって印をつける');

// リプレイは絵だけの差し替え。ゲームの中身は判定のときから動かない。
let ticks=0;
while(g.probe.now().state==='replay'&&ticks<200){
 const now=g.probe.now();
 assert.equal(now.T,real.T,'進行の時計は止まっている');
 assert.equal(now.elapsed,real.elapsed,'手刀からの経過も止まっている');
 assert(Math.abs(now.fallProgress-1)<1e-9,'本物の側は倒れたまま');
 now.people.forEach((p,i)=>assert(Math.abs(p.worldX-real.people[i].worldX)<1e-9&&Math.abs(p.worldY-real.people[i].worldY)<1e-9,'人は動かない'));
 g.tap(now.people[0].x,now.people[0].y);g.press(' ');
 assert.equal(g.probe.now().state,'replay','触っても飛ばせない');
 assert.equal(g.probe.now().score,0,'触っても点は動かない');
 g.dbg.tick();ticks++;
}
assert.equal(g.probe.now().state,'result');
const after=g.probe.now();
assert.equal(after.T,real.T);assert.equal(after.elapsed,real.elapsed);
after.people.forEach((p,i)=>assert(Math.abs(p.worldX-real.people[i].worldX)<1e-9,'リプレイのあと元の姿に戻っている'));
assert.equal(g.dbg.shown().reveal,true,'結果画面でも印は出したまま');
console.log('OK 流している間も後も、進行と覗き穴は本物のまま。触っても飛ばせない');

// やり直すと控えたコマは捨てる。次の面のぶんを新しく控える。
g.esc();
assert.equal(g.probe.now().state,'play');
assert.equal(g.dbg.tape().len,0,'やり直しで控えたコマを捨てる');
assert.equal(g.dbg.tape().at,0);
toAttack(g);assert.equal(g.dbg.tape().len,7,'次の面でも控え直す');

// 連続して当てたときも、面ごとに控え直して毎回流す。
const streak=game();
for(let n=1;n<=2;n++){
 toAttack(streak);const s=streak.probe.now();
 streak.tap(s.people[s.attacker].x,s.people[s.attacker].y);
 assert.equal(streak.probe.now().state,'replay',n+'回目も流す');
 assert.equal(streak.dbg.tape().len,7);
 for(let i=0;i<31;i++)streak.dbg.tick();
 assert.equal(streak.probe.now().state,'success');
 for(let i=0;i<20;i++)streak.dbg.tick();
 assert.equal(streak.probe.now().state,'play','2秒後に次の面へ');
 assert.equal(streak.probe.now().score,n,'点は持ち越す');
 assert.equal(streak.dbg.tape().len,0,'次の面の頭では空');
}
console.log('OK やり直し・連続成功のどちらでも、面ごとに控え直して毎回流す');
