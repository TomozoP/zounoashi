/* 二つ・四つの操作切り替えと複数指、再生の横長領域を確認する。 */
const assert=require('assert'),load=require('../harness');
const g=load('games/shark-walk/index.html',{withScripts:true});
function fire(type,id,x,y){g.wrap.fire(type,{pointerId:id,clientX:x,clientY:y,button:0,isPrimary:true,preventDefault(){}});}
function toggle(n){const x=n===2?232:308,y=g.H*.82-98;fire('pointerdown',9,x,y);fire('pointerup',9,x,y);}
toggle(2);assert.equal(g.probe.now().controlCount,2);assert.equal(g.probe.now().controls.length,2,'二モードの編集も二ボタン');
fire('pointerdown',8,340,g.H*.94);fire('pointerup',8,340,g.H*.94);assert.equal(g.probe.now().state,'play','横長再生ボタンの端から開始');assert.equal(g.probe.now().controls.length,2);
fire('pointerdown',1,35,g.H*.82+40);let n=g.probe.now();assert(n.leftLegPressed&&n.rightLegPressed&&!n.leftArmPressed,'角丸四角の内側で後ろ二本を操作');
fire('pointerdown',2,400,g.H*.82);n=g.probe.now();assert(n.leftArmPressed&&n.rightArmPressed&&n.leftLegPressed,'二本指で四肢を操作');
fire('pointerup',1,35,g.H*.82+40);n=g.probe.now();assert(!n.leftLegPressed&&!n.rightLegPressed&&n.leftArmPressed,'片側だけ離す');
toggle(4);assert.equal(g.probe.now().controlCount,2,'走行中は切り替えない');g.esc();toggle(4);g.press(' ');n=g.probe.now();assert.equal(n.controls.length,4);assert(!n.leftArmPressed&&!n.rightArmPressed,'切り替え時に操作を解除');
g.key('a');assert(g.probe.now().leftLegPressed&&!g.probe.now().rightLegPressed,'四ボタンは独立');g.esc();toggle(2);g.press(' ');g.key('s');assert(g.probe.now().leftLegPressed&&g.probe.now().rightLegPressed,'二ボタンはキーでも連動');g.key('s',true);
g.esc();assert.equal(g.probe.now().controlCount,2,'編集へ戻っても方式を保持');assert.equal(g.probe.now().controls.length,2);
console.log('2/4切り替え・前後の同時操作・複数指・入力解除・横長再生：確認済み');

fire('pointerdown',1,140,g.H*.82);fire('pointerup',1,140,g.H*.82);let parts=g.probe.now().equipment;assert.equal(parts.leftLeg,parts.rightLeg,'後ろの二本をまとめて変更');assert.equal(parts.leftLeg,'arm');g.press('l');parts=g.probe.now().equipment;assert.equal(parts.leftArm,parts.rightArm,'前の二本をキーでもまとめて変更');assert.equal(parts.leftArm,'wheel');toggle(4);g.press('a');assert.notEqual(g.probe.now().equipment.leftLeg,g.probe.now().equipment.rightLeg,'四モードは一本ずつ編集');toggle(2);assert.equal(g.probe.now().equipment.leftLeg,g.probe.now().equipment.rightLeg,'二モードへ戻すとパーツを揃える');
