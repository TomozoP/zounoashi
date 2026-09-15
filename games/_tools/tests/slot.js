/* 全64通りの判定と、狙って止める操作を確かめる。 */
const assert = require('assert');
const load = require('../harness');
const file = 'games/_slot/index.html';
for (let a=0;a<4;a++) for (let b=0;b<4;b++) for (let c=0;c<4;c++) {
  const g=load(file,{quiet:true});
  g.press(' ');
  assert.equal(g.probe.now().state,'play');
  assert.ok(g.probe.now().stopped.every(v=>!v),'開始操作で止まらない');
  [a,b,c].forEach((target,i)=>{
    let frames=0;
    while(Math.round(g.probe.now().reels[i])%4!==target && frames++<61) g.step(1);
    assert.ok(frames<=61,'一周以内に狙った絵柄へ届く');
    const y=g.probe.now().buttonY;
    g.tap(130+i*140,y);
    assert.equal(g.probe.now().reels[i],target);
    g.step(3);
    assert.equal(g.probe.now().reels[i],target,'止めた列は動かない');
  });
  const expected=a===b&&b===c?(a===3?777:100):(a===b||b===c||a===c?10:0);
  assert.equal(g.probe.now().state,'result');
  assert.equal(g.probe.now().score,expected);
  g.press(' ');
  assert.equal(g.probe.now().state,'play');
  g.esc();
  assert.equal(g.probe.now().state,'intro');
}
for(const shape of [[375,667],[390,844],[768,1024],[1280,720]]) {
  const g=load(file,{quiet:true});g.view(...shape);g.press(' ');
  g.tap(20,20);assert.ok(g.probe.now().stopped.every(v=>!v));
  g.press(' ');g.step(20);g.press(' ');g.step(20);g.press(' ');
  assert.equal(g.probe.now().state,'result');
  assert.ok(g.probe.now().H/2+350<=g.probe.now().H,'結果のボタンが収まる');
}
console.log('全64通りの判定、開始・停止・再挑戦、4画面の確認済み。絵柄の停止猶予250ミリ秒、ボタン間隔140。');
