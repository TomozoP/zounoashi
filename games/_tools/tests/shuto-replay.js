/* 手刀のリプレイ。勝敗の札は画面の上へすぐ出し、1.5秒あとから札の後ろで手刀のコマを流す。
   流している間は「リプレイ」と出し、手刀のコマで止めてから頭へ戻って繰り返す。
   成功は下の「次へ」を押すまで進まない。 */
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
function tick(g,n){for(let i=0;i<n;i++)g.dbg.tick();}

// 勝敗の札はリプレイを待たず、タップした時点で出る。
for(const how of ['caught','wrong','miss']){
 const g=game();toAttack(g);const s=g.probe.now();
 if(how==='caught')g.tap(s.people[s.attacker].x,s.people[s.attacker].y);
 else if(how==='wrong')g.tap(other(s).x,other(s).y);
 else tick(g,50);
 const n=g.probe.now();
 assert.equal(n.outcome,how);
 assert.equal(n.state,how==='caught'?'success':'result',how+'の札はすぐ出る');
 assert.equal(n.resultText,how==='caught'?'見逃さなかった':'見逃した');
 assert.equal(n.replay.at,-1,'札が出た時点ではまだ流さない');
 assert.equal(n.replay.taped,7,'控えるのは手刀とその前6コマ');
 assert(Math.abs(n.replay.cycle-3)<1e-9,'一巡は流し1.8秒＋止め1.2秒');
}
console.log('OK 当てた・外した・見逃した：どれも札が先に出て、その時点ではまだ流さない');

// 1.5秒は本物の姿のまま。そこから0.3秒ごとに1コマ、手刀のコマまで進む。
const g=game();toAttack(g);
const strike=g.probe.now();
tick(g,50);
const real=g.probe.now();
assert.equal(real.outcome,'miss');
assert(Math.abs(real.fallProgress-1)<1e-9,'見逃した側は倒れきっている');
assert.equal(texts(g),2,'流す前に出るのは勝敗と回数の2つ');
tick(g,14);
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

// 手刀のコマまで進み、そこで1.2秒止めてから頭へ戻る。これを繰り返す。
tick(g,15);
assert.equal(g.probe.now().replay.at,6,'1.8秒流して手刀のコマ');
f=g.dbg.shown();
assert.equal(f.elapsed,0,'止まるのは手刀のコマ');
assert.equal(f.fall,0,'手刀のコマではまだ倒れていない');
assert(Math.abs(f.T-strike.T)<1e-9,'手刀が出た時刻に一致する');
f.spots.forEach((p,i)=>assert(Math.abs(p.x-strike.people[i].worldX)<1e-9&&Math.abs(p.y-strike.people[i].worldY)<1e-9,'居場所も手刀のときと同じ'));
tick(g,11);
assert.equal(g.probe.now().replay.at,6,'止めている1.2秒のあいだは手刀のコマ');
g.dbg.tick();
assert.equal(g.probe.now().replay.at,0,'止めが終わると頭へ戻る');
assert(Math.abs(g.dbg.shown().T-startT)<1e-9,'戻る先は1巡目と同じ時刻');
// 3巡目の頭まで、ずれずに回る
tick(g,30);
assert.equal(g.probe.now().replay.at,0,'3.0秒ごとに頭へ戻る');
assert(Math.abs(g.dbg.shown().T-startT)<1e-9,'何巡しても同じ絵に戻る');
assert.equal(texts(g),3,'繰り返しているあいだも「リプレイ」は出たまま');
assert.equal(g.probe.now().state,'result','見逃しの札は消えない');
console.log('OK 1.5秒は本物の姿、0.3秒ごとに1コマ流し、手刀のコマで1.2秒止めて頭から繰り返す');

// 流すのは絵だけ。進行と覗き穴は判定のときのまま。「もう一度」も生きている。
const after=g.probe.now();
assert.equal(after.T,real.T,'進行の時計は止まっている');
assert.equal(after.elapsed,real.elapsed,'手刀からの経過も止まっている');
assert(Math.abs(after.fallProgress-1)<1e-9,'本物の側は倒れたまま');
after.people.forEach((p,i)=>assert(Math.abs(p.worldX-real.people[i].worldX)<1e-9&&Math.abs(p.worldY-real.people[i].worldY)<1e-9,'人は動かない'));
g.tap(150,after.H*0.62+27);
assert.equal(g.probe.now().state,'play','見逃しの押しどころは流している間も効く');
assert.equal(g.probe.now().replay.taped,0,'やり直しで控えたコマを捨てる');
toAttack(g);assert.equal(g.probe.now().replay.taped,7,'次の面でも控え直す');
console.log('OK 流している間も進行と覗き穴は本物のまま。見逃しの押しどころも生きている');

// 成功は「次へ」を押すまで進まない。押しどころは画面の下。
const streak=game();
for(let n=1;n<=2;n++){
 toAttack(streak);const s=streak.probe.now();
 streak.tap(s.people[s.attacker].x,s.people[s.attacker].y);
 assert.equal(streak.probe.now().state,'success');
 assert.equal(streak.probe.now().score,n);
 const b=streak.dbg.next();
 assert(Math.abs(b.x+b.w/2-270)<1e-9&&b.w===170,'「次へ」は画面の真ん中');
 assert(Math.abs(b.y-s.H*0.80)<1e-9,'「次へ」は画面の下（80%）');
 assert.equal(texts(streak),2,'流す前は「リプレイ」も「次へ」も出さない');
 streak.tap(b.x+b.w/2,b.y+b.h/2);streak.press(' ');
 assert.equal(streak.probe.now().state,'success','流れる前に触っても飛ばない');
 tick(streak,15);
 assert.equal(texts(streak),4,'流している間は「リプレイ」と「次へ」が出る');
 streak.tap(b.x-20,b.y+b.h/2);
 assert.equal(streak.probe.now().state,'success','押しどころの外では進まない');
 tick(streak,200);
 assert.equal(streak.probe.now().state,'success','20秒放っておいても進まない');
 assert.equal(streak.probe.now().score,n,'待っている間に点は動かない');
 if(n===1)streak.tap(b.x+b.w/2,b.y+b.h/2);
 else streak.press(' ');
 assert.equal(streak.probe.now().state,'play','「次へ」で次の面へ');
 assert.equal(streak.probe.now().score,n,'点は持ち越す');
 assert.equal(streak.probe.now().people.length,(n+1)*20,'次の面は20人増える');
 assert.equal(streak.probe.now().replay.taped,0,'次の面の頭では空');
}
console.log('OK 成功は押すまで進まず繰り返し流れる。「次へ」かキーで次の面へ、外や流れる前は効かない');
