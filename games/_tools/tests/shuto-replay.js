/* 手刀のリプレイ。勝敗の札はタップ直後に出し、2秒あとからその後ろで手刀のコマを流す。 */
const assert=require('assert');const load=require('../harness');
const peek=`window.__dbg={
  tick:function(){update(1/10);},
  shown:function(){var got=null,real=draw;draw=function(){got={T:T,elapsed:elapsed,fall:fallProgress(),
    spots:people.map(function(p){return {x:p.x,y:p.y};})};};drawFrame();draw=real;return got;}
};`;
function game(){const g=load('games/shuto/index.html',{inject:peek});g.probe.reset();return g;}
function toAttack(g){for(let i=0;i<720&&g.probe.now().elapsed<0;i++)g.dbg.tick();assert(g.probe.now().elapsed>=0,'手刀が出る');}
function other(s){
 const p=s.people.find(p=>p.id!==s.attacker&&p.id!==s.victim&&p.x>32&&p.x<508&&p.y>45&&p.y<s.H-45);
 assert(p,'手刀と関係ない人が画面内にいる');return p;
}

// 勝敗の札はリプレイを待たず、決まった時点で出る。
for(const how of ['caught','wrong','miss']){
 const g=game();toAttack(g);const s=g.probe.now();
 if(how==='caught')g.tap(s.people[s.attacker].x,s.people[s.attacker].y);
 else if(how==='wrong')g.tap(other(s).x,other(s).y);
 else for(let i=0;i<50;i++)g.dbg.tick();
 const n=g.probe.now();
 assert.equal(n.outcome,how);
 assert.equal(n.state,how==='caught'?'success':'result',how+'の札はすぐ出る');
 assert.equal(n.resultText,how==='caught'?'見逃さなかった':'見逃した');
 assert.equal(n.replay.at,-1,'札が出た時点ではまだ流さない');
 assert.equal(n.replay.taped,7,'控えるのは手刀とその前6コマ');
 assert(Math.abs(n.replay.over-5.1)<1e-9,'待ち2秒＋流し1.8秒＋止め1.3秒');
}
console.log('OK 当てた・外した・見逃した：どれも札が先に出て、その時点ではまだ流さない');

// 2秒は本物の姿のまま。そこから0.3秒ごとに1コマ、手刀のコマまで進んで止まる。
const g=game();toAttack(g);
const strike=g.probe.now();
for(let i=0;i<50;i++)g.dbg.tick();
const real=g.probe.now();
assert.equal(real.outcome,'miss');
assert(Math.abs(real.fallProgress-1)<1e-9,'見逃した側は倒れきっている');
for(let i=0;i<19;i++)g.dbg.tick();
assert.equal(g.probe.now().replay.at,-1,'1.9秒までは本物の姿');
assert.equal(g.dbg.shown().fall,1,'本物の姿では倒れたまま');
g.dbg.tick();
assert.equal(g.probe.now().replay.at,0,'2秒たったら流しはじめる');
let f=g.dbg.shown();
assert.equal(f.fall,0,'流している間は倒れる前に戻っている');
assert.equal(f.elapsed,-1,'流しはじめは手刀より前');
assert(Math.abs(f.T-(strike.T-0.6))<1e-9,'手刀の0.6秒前から流す');
const startT=f.T;
g.dbg.tick();g.dbg.tick();assert.equal(g.dbg.shown().T,startT,'3コマたつまで次へ行かない');
g.dbg.tick();assert(Math.abs(g.dbg.shown().T-(startT+1/10))<1e-9,'3コマごとに1コマ進む＝3分の1の速さ');

// 手刀のコマで止まる。見逃しの札は消えないので、放っておいても止まったまま。
while(g.probe.now().replay.at<6)g.dbg.tick();
f=g.dbg.shown();
assert.equal(f.elapsed,0,'止まるのは手刀のコマ');
assert.equal(f.fall,0,'手刀のコマではまだ倒れていない');
assert(Math.abs(f.T-strike.T)<1e-9,'手刀が出た時刻に一致する');
f.spots.forEach((p,i)=>assert(Math.abs(p.x-strike.people[i].worldX)<1e-9&&Math.abs(p.y-strike.people[i].worldY)<1e-9,'居場所も手刀のときと同じ'));
for(let i=0;i<60;i++)g.dbg.tick();
assert.equal(g.probe.now().state,'result','見逃しの札は消えない');
assert.equal(g.probe.now().replay.at,6,'手刀のコマで止まったまま');
console.log('OK 2秒は本物の姿、そこから0.3秒ごとに1コマ流し、手刀のコマで止まったまま');

// 流すのは絵だけ。札の文字は出たままで、進行と覗き穴は判定のときのまま。
g.drawn.length=0;g.probe.step(1);   /* step は進めて描くところまでやる */
assert(g.drawn.indexOf('fillText')>=0,'流している間も札の文字を描く');
const after=g.probe.now();
assert.equal(after.T,real.T,'進行の時計は止まっている');
assert.equal(after.elapsed,real.elapsed,'手刀からの経過も止まっている');
assert(Math.abs(after.fallProgress-1)<1e-9,'本物の側は倒れたまま');
after.people.forEach((p,i)=>assert(Math.abs(p.worldX-real.people[i].worldX)<1e-9&&Math.abs(p.worldY-real.people[i].worldY)<1e-9,'人は動かない'));

// 流している後ろでも「もう一度」は効く。
g.tap(150,after.H*0.62+27);
assert.equal(g.probe.now().state,'play','札のボタンはリプレイ中も押せる');
assert.equal(g.probe.now().replay.taped,0,'やり直しで控えたコマを捨てる');
assert.equal(g.probe.now().replay.at,-1);
toAttack(g);assert.equal(g.probe.now().replay.taped,7,'次の面でも控え直す');
console.log('OK 札の文字と押しどころは流している間も生きている。進行と覗き穴は本物のまま');

// 連続して当てたときは、札を2秒見せ、流し終えた5.1秒後に次の面へ。
const streak=game();
for(let n=1;n<=2;n++){
 toAttack(streak);const s=streak.probe.now();
 streak.tap(s.people[s.attacker].x,s.people[s.attacker].y);
 assert.equal(streak.probe.now().state,'success');
 assert.equal(streak.probe.now().score,n);
 for(let i=0;i<20;i++)streak.dbg.tick();
 assert.equal(streak.probe.now().replay.at,0,'2秒後から流れる');
 for(let i=0;i<18;i++)streak.dbg.tick();
 assert.equal(streak.probe.now().replay.at,6,'3.8秒で手刀のコマ');
 for(let i=0;i<12;i++)streak.dbg.tick();
 assert.equal(streak.probe.now().state,'success','止めの1.3秒が終わるまでは札のまま');
 streak.dbg.tick();
 assert.equal(streak.probe.now().state,'play','5.1秒で次の面へ');
 assert.equal(streak.probe.now().score,n,'点は持ち越す');
 assert.equal(streak.probe.now().replay.taped,0,'次の面の頭では空');
}
console.log('OK 連続成功：札2秒→流し1.8秒→止め1.3秒の5.1秒で次の面へ、点は持ち越す');
