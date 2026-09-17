const assert=require('assert');const load=require('../harness');
for(const shape of [[375,812],[700,700],[500,1600]]){
 const g=load('games/shuto/index.html',{w:shape[0],h:shape[1]});
 g.step(180);assert.equal(g.probe.now().T,0,'開始前は進まない');g.press(' ');assert.equal(g.probe.now().state,'play');
 for(let round=0;round<9;round++){
  g.probe.reset();g.tap(270,100);assert.equal(g.probe.now().state,'play');
  assert(g.until(()=>g.probe.now().elapsed>=0,1200),'手刀が出る');
  let s=g.probe.now();assert.equal(s.people.length,20,'最初の群衆は20人');assert(Math.abs(s.people[s.attacker].worldX-s.people[s.victim].worldX)<88,'近くの相手に手刀');
  for(let i=0;i<s.people.length;i++)for(let j=i+1;j<s.people.length;j++){if(i===s.victim||j===s.victim)continue;assert(Math.hypot(s.people[i].worldX-s.people[j].worldX,s.people[i].worldY-s.people[j].worldY)>=39,'人同士の間隔');}
  if(round%3===0){g.probe.step(49);assert.equal(g.probe.now().state,'play');g.probe.step(1);assert.equal(g.probe.now().outcome,'miss');assert.equal(g.probe.now().elapsed,5);assert.equal(g.probe.now().resultText,'見逃した');}
  else if(round%3===1){g.probe.step(20);s=g.probe.now();const p=s.people[s.attacker];g.tap(p.x,p.y);assert.equal(g.probe.now().outcome,'caught');assert.equal(g.probe.now().resultText,'見逃さなかった');}
  else{let p=s.people.find(p=>p.id!==s.attacker&&p.id!==s.victim&&p.x>32&&p.x<508&&p.y>45&&p.y<s.H-45);g.tap(p.x,p.y);assert.equal(g.probe.now().outcome,'wrong');assert.equal(g.probe.now().resultText,'見逃した');}
  g.esc();assert.equal(g.probe.now().state,'play');g.drawn.length=0;
 }
}
console.log('OK 3画面×9回：開始待ち・隣の人への手刀・40の避け合う間隔・5秒の境界・正解・不正解・再挑戦');

// 結果後まで歩行だけ進め、再入場の全件が画面外か確認する。
const crowd=load('games/shuto/index.html',{inject:'window.__dbg={walk:function(){walkCrowd(1/60);}};'});
crowd.probe.reset();let before=crowd.probe.now(),entries=0;
for(let frame=0;frame<7200;frame++){
 crowd.dbg.walk();const after=crowd.probe.now();
 after.people.forEach((p,i)=>{
  if(p.generation!==before.people[i].generation){
   entries++;assert(p.x< -90||p.x>630||p.footY< -90||p.footY>after.H+140,'再入場は全身が画面外');
  }else assert(Math.hypot(p.x-before.people[i].x,p.y-before.people[i].y)<8,'画面内で飛ばない');
 });before=after;
}
assert(entries>0,'画面外で出入りする');
console.log('OK 120秒の歩行：'+entries+'回の画面外からの再入場・連続した移動');

const strike=load('games/shuto/index.html');strike.probe.reset();assert(strike.until(()=>strike.probe.now().elapsed>=0,1200));
assert(strike.probe.now().strikeVisible);assert.equal(strike.probe.now().fallProgress,0);
strike.probe.step(1);assert(!strike.probe.now().strikeVisible);
strike.probe.step(3);assert.equal(strike.probe.now().fallProgress,0);
strike.probe.step(1);assert(strike.probe.now().fallProgress>0);
strike.probe.step(10);assert(Math.abs(strike.probe.now().fallProgress-1)<1e-9);
const fps=load('games/shuto/index.html');fps.probe.reset();fps.drawn.length=0;fps.step(60);
assert.equal(fps.drawn.filter(x=>x==='clearRect').length,10,'1秒で10回描画');
assert(Math.abs(fps.probe.now().T-1)<1e-9,'10fpsでも時間は実時間と同じ');
console.log('OK 10fps・手刀1コマ・0.4秒停止後1.1秒で倒れる・成功文言');

// 成功の表示中は追加の入力を受けず、リプレイを見せ終えた5.1秒後に回数を保って進む。
const streak=load('games/shuto/index.html',{inject:'window.__dbg={tick:function(){update(1/10);}};'});
streak.probe.reset();
function waitForAttack(){for(let i=0;i<720&&streak.probe.now().elapsed<0;i++)streak.dbg.tick();assert(streak.probe.now().elapsed>=0);}
for(let n=1;n<=3;n++){
 waitForAttack();let s=streak.probe.now(),p=s.people[s.attacker];streak.tap(p.x,p.y);
 assert.equal(streak.probe.now().state,'success');assert.equal(streak.probe.now().score,n);
 assert.equal(streak.probe.now().resultText,'見逃さなかった');
 streak.tap(p.x,p.y);streak.press(' ');assert.equal(streak.probe.now().score,n);
 for(let i=0;i<50;i++)streak.dbg.tick();assert.equal(streak.probe.now().state,'success');
 streak.dbg.tick();assert.equal(streak.probe.now().state,'play');assert.equal(streak.probe.now().score,n);
 assert.equal(streak.probe.now().elapsed,-1);assert.equal(streak.probe.now().T,0);assert.equal(streak.probe.now().people.length,(n+1)*20);
}
waitForAttack();for(let i=0;i<50;i++)streak.dbg.tick();
assert.equal(streak.probe.now().state,'result');assert.equal(streak.probe.now().score,3);
assert.equal(streak.probe.now().resultText,'見逃した');streak.press(' ');assert.equal(streak.probe.now().score,0);
console.log('OK 3連続成功・表示中の連打・5.1秒の境界・失敗後の回数・再挑戦で0に戻る');

for(let level=1;level<=10;level++){
 streak.press(level===10?'0':String(level));let s=streak.probe.now();
 assert.equal(s.level,Math.min(7,level));assert.equal(s.people.length,Math.min(7,level)*20);assert.equal(s.score,0);
 assert.equal(s.state,'play');assert.equal(s.elapsed,-1);
}
waitForAttack();let final=streak.probe.now(),target=final.people[final.attacker];streak.tap(target.x,target.y);
for(let i=0;i<20;i++)streak.dbg.tick();
assert.equal(streak.probe.now().people.length,140);assert.equal(streak.probe.now().level,7);assert.equal(streak.probe.now().score,1);
streak.esc();assert.equal(streak.probe.now().people.length,20);assert.equal(streak.probe.now().score,0);
console.log('OK 数字1〜9・0の段階移動、20人ずつ増加、上限140人、飛ばした分は得点にしない');

// 140人でも広い空白を作らず、40の間隔で歩ける。
const dense=load('games/shuto/index.html',{w:700,h:700,inject:'window.__dbg={walk:function(){walkCrowd(1/10);}};'});
dense.press('0');let ds=dense.probe.now();
assert(ds.people.filter(p=>p.x>=0&&p.x<=540&&p.footY>=0&&p.footY<=ds.H).length>=133,'140人の大半を最初から画面内に置く');
for(let frame=0;frame<100;frame++)dense.dbg.walk();ds=dense.probe.now();let nearest=Infinity;
for(let i=0;i<ds.people.length;i++)for(let j=i+1;j<ds.people.length;j++)nearest=Math.min(nearest,Math.hypot(ds.people[i].worldX-ds.people[j].worldX,ds.people[i].worldY-ds.people[j].worldY));
assert(nearest>=39&&nearest<48,'40付近まですれ違える');
console.log('OK 140人を画面内に配置、10秒歩行後も間隔は40付近');

// X共有は指を置いた時ではなく、通常のボタンのクリックから一度だけ実行する。
const share=load('games/shuto/index.html',{inject:'window.__dbg={button:shareButton,result:function(){state=S.RESULT;score=3;draw();}};'});
assert(share.dbg.button.hidden);share.dbg.result();assert.equal(share.dbg.button.hidden,false);
share.down(363,share.H*.62+27);assert.equal(share.shared.length,0);
share.dbg.button.fire('pointerdown',{stopPropagation:function(){}});assert.equal(share.shared.length,0);
share.dbg.button.fire('click',{stopPropagation:function(){}});
assert.equal(share.shared.length,1);assert.equal(share.shared[0],'3回連続で見逃さなかった #手刀を見逃さないゲーム');
share.esc();assert(share.dbg.button.hidden);share.dbg.button.fire('click',{stopPropagation:function(){}});assert.equal(share.shared.length,1);
console.log('OK Xボタン：結果時だけ表示、クリックで一度だけ共有、押した瞬間やプレイ中は共有しない');
