/* 手刀のリプレイ。勝敗の札は画面の上へすぐ出し、1.5秒あとから札の後ろで手刀のコマを流す。
   流している間は「リプレイ」と出し、成功なら「次へ」で待たずに進める。 */
const assert=require('assert');const load=require('../harness');
const peek=`window.__dbg={
  tick:function(){update(1/10);},
  shown:function(){var got=null,real=draw;draw=function(){got={T:T,elapsed:elapsed,fall:fallProgress(),
    spots:people.map(function(p){return {x:p.x,y:p.y};})};};drawFrame();draw=real;return got;},
  next:function(){return nextButton();},
  paint:function(){drawFrame();}   /* 進めずに描くだけ */
};`;
function game(){const g=load('games/shuto/index.html',{inject:peek});g.probe.reset();return g;}
function toAttack(g){for(let i=0;i<720&&g.probe.now().elapsed<0;i++)g.dbg.tick();assert(g.probe.now().elapsed>=0,'手刀が出る');}
function other(s){
 const p=s.people.find(p=>p.id!==s.attacker&&p.id!==s.victim&&p.x>32&&p.x<508&&p.y>45&&p.y<s.H-45);
 assert(p,'手刀と関係ない人が画面内にいる');return p;
}
function texts(g){g.drawn.length=0;g.dbg.paint();return g.drawn.filter(x=>x==='fillText').length;}
function untilReplay(g){for(let i=0;i<30&&g.probe.now().replay.at<0;i++)g.dbg.tick();}

// 勝敗の札はリプレイを待たず、タップした時点で出る。
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
 assert(Math.abs(n.replay.over-4.6)<1e-9,'待ち1.5秒＋流し1.8秒＋止め1.3秒');
}
console.log('OK 当てた・外した・見逃した：どれも札が先に出て、その時点ではまだ流さない');

// 1.5秒は本物の姿のまま。そこから0.3秒ごとに1コマ、手刀のコマまで進んで止まる。
const g=game();toAttack(g);
const strike=g.probe.now();
for(let i=0;i<50;i++)g.dbg.tick();
const real=g.probe.now();
assert.equal(real.outcome,'miss');
assert(Math.abs(real.fallProgress-1)<1e-9,'見逃した側は倒れきっている');
assert.equal(texts(g),2,'流す前に出るのは勝敗と回数の2つ');
for(let i=0;i<14;i++)g.dbg.tick();
assert.equal(g.probe.now().replay.at,-1,'1.4秒までは本物の姿');
assert.equal(g.dbg.shown().fall,1,'本物の姿では倒れたまま');
g.dbg.tick();
assert.equal(g.probe.now().replay.at,0,'1.5秒たったら流しはじめる');
assert.equal(texts(g),3,'流している間は「リプレイ」も出る');
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
assert.equal(texts(g),3,'止まっている間も「リプレイ」は出たまま');
console.log('OK 1.5秒は本物の姿、そこから0.3秒ごとに1コマ流し、手刀のコマで止まったまま');

// 流すのは絵だけ。進行と覗き穴は判定のときのまま。「もう一度」も生きている。
const after=g.probe.now();
assert.equal(after.T,real.T,'進行の時計は止まっている');
assert.equal(after.elapsed,real.elapsed,'手刀からの経過も止まっている');
assert(Math.abs(after.fallProgress-1)<1e-9,'本物の側は倒れたまま');
after.people.forEach((p,i)=>assert(Math.abs(p.worldX-real.people[i].worldX)<1e-9&&Math.abs(p.worldY-real.people[i].worldY)<1e-9,'人は動かない'));
g.tap(150,after.H*0.62+27);
assert.equal(g.probe.now().state,'play','見逃しの札のボタンは流している間も押せる');
assert.equal(g.probe.now().replay.taped,0,'やり直しで控えたコマを捨てる');
toAttack(g);assert.equal(g.probe.now().replay.taped,7,'次の面でも控え直す');
console.log('OK 流している間も進行と覗き穴は本物のまま。見逃しの押しどころも生きている');

// 成功は「次へ」で待たずに進める。流れはじめる前の入力では飛ばさない。
const streak=game();
for(let n=1;n<=2;n++){
 toAttack(streak);const s=streak.probe.now();
 streak.tap(s.people[s.attacker].x,s.people[s.attacker].y);
 assert.equal(streak.probe.now().state,'success');
 assert.equal(streak.probe.now().score,n);
 assert.equal(texts(streak),2,'流す前は「次へ」を出さない');
 streak.tap(270,s.H*0.62+27);streak.press(' ');
 assert.equal(streak.probe.now().state,'success','流れる前に触っても飛ばない');
 untilReplay(streak);
 const b=streak.dbg.next();
 assert(Math.abs(b.x+b.w/2-270)<1e-9&&b.w===170,'「次へ」は画面の真ん中');
 assert.equal(texts(streak),4,'流している間は「リプレイ」と「次へ」が出る');
 streak.tap(b.x-20,b.y+b.h/2);
 assert.equal(streak.probe.now().state,'success','押しどころの外では進まない');
 if(n===1){
  streak.tap(270,b.y+b.h/2);
  assert.equal(streak.probe.now().state,'play','「次へ」で待たずに次の面へ');
 }else{
  streak.press(' ');
  assert.equal(streak.probe.now().state,'play','キーでも次へ進める');
 }
 assert.equal(streak.probe.now().score,n,'点は持ち越す');
 assert.equal(streak.probe.now().people.length,(n+1)*20,'次の面は20人増える');
 assert.equal(streak.probe.now().replay.taped,0,'次の面の頭では空');
}
console.log('OK 成功は流れはじめてからの「次へ」で進める。流れる前や押しどころの外では飛ばさない');

// 押さずに放っておけば4.6秒で次の面へ。
const wait=game();toAttack(wait);const w=wait.probe.now();
wait.tap(w.people[w.attacker].x,w.people[w.attacker].y);
for(let i=0;i<45;i++)wait.dbg.tick();
assert.equal(wait.probe.now().state,'success','4.5秒までは札のまま');
wait.dbg.tick();
assert.equal(wait.probe.now().state,'play','4.6秒で次の面へ');
assert.equal(wait.probe.now().score,1,'点は持ち越す');
console.log('OK 押さずに放っておけば、札1.5秒→流し1.8秒→止め1.3秒の4.6秒で次の面へ');
