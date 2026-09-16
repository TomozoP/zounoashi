const assert=require('assert');const load=require('../harness');
for(const shape of [[375,812],[700,700],[500,1600]]){
 const g=load('games/_shuto/index.html',{w:shape[0],h:shape[1]});
 g.step(180);assert.equal(g.probe.now().T,0,'開始前は進まない');g.press(' ');assert.equal(g.probe.now().state,'play');
 for(let round=0;round<9;round++){
  g.probe.reset();g.tap(270,100);assert.equal(g.probe.now().state,'play');
  assert(g.until(()=>g.probe.now().elapsed>=0,1200),'手刀が出る');
  let s=g.probe.now();assert(Math.abs(s.people[s.attacker].x-s.people[s.victim].x)<88,'近くの相手に手刀');
  for(let i=0;i<42;i++)for(let j=i+1;j<42;j++){if(i===s.victim||j===s.victim)continue;assert(Math.hypot(s.people[i].x-s.people[j].x,s.people[i].y-s.people[j].y)>=63,'押す間隔');}
  if(round%3===0){g.step(179);assert.equal(g.probe.now().state,'play');g.step(1);assert.equal(g.probe.now().outcome,'miss');assert.equal(g.probe.now().elapsed,3);}
  else if(round%3===1){g.step(120);s=g.probe.now();const p=s.people[s.attacker];g.tap(p.x,p.y);assert.equal(g.probe.now().outcome,'caught');}
  else{let p=s.people.find(p=>p.id!==s.attacker&&p.id!==s.victim&&p.x>32&&p.x<508&&p.y>45&&p.y<s.H-45);g.tap(p.x,p.y);assert.equal(g.probe.now().outcome,'wrong');}
  g.esc();assert.equal(g.probe.now().state,'play');g.drawn.length=0;
 }
}
console.log('OK 3画面×9回：開始待ち・隣の人への手刀・63以上の間隔・3秒の境界・正解・不正解・再挑戦');

// 結果後まで歩行だけ進め、再入場の全件が画面外か確認する。
const crowd=load('games/_shuto/index.html',{inject:'window.__dbg={walk:function(){walkCrowd(1/60);}};'});
crowd.probe.reset();let before=crowd.probe.now(),entries=0;
for(let frame=0;frame<7200;frame++){
 crowd.dbg.walk();const after=crowd.probe.now();
 after.people.forEach((p,i)=>{
  if(p.generation!==before.people[i].generation){
   entries++;assert(p.x< -90||p.x>630||p.footY< -90||p.footY>after.H+140,'再入場は全身が画面外');
  }else assert(Math.hypot(p.x-before.people[i].x,p.y-before.people[i].y)<8,'画面内で飛ばない');
 });before=after;
}
assert(entries>20,'画面外で出入りする');
console.log('OK 120秒の歩行：'+entries+'回の画面外からの再入場・連続した移動');
