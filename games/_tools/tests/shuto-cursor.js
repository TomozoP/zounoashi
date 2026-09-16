/* カーソルの移動ではゲームを進めず、タッチや画面外では消す。 */
const assert=require('assert'),load=require('../harness');
const g=load('games/shuto/index.html',{imagesLoad:true,inject:"window.__dbg={pointer:pointer,handPress:handPress};"});
function move(type,x,y){g.wrap.fire('pointermove',{pointerType:type,clientX:x,clientY:y});}
move('mouse',270,400);assert(!g.dbg.pointer.visible);
g.press(' ');
const before=g.probe.now().T;
move('mouse',270,400);
assert(g.dbg.pointer.visible);assert.equal(g.dbg.pointer.x,270);assert.equal(g.dbg.pointer.y,400);
assert.equal(g.probe.now().T,before);assert(g.drawn.includes('drawImage'));
move('touch',270,400);assert(!g.dbg.pointer.visible);
move('mouse',270,400);g.wrap.fire('pointerleave',{});assert(!g.dbg.pointer.visible);
move('mouse',270,400);g.win.fire('blur',{});assert(!g.dbg.pointer.visible);
g.wrap.fire('pointerdown',{pointerType:'mouse',button:0,clientX:270,clientY:400,preventDefault:function(){}});
assert.equal(g.dbg.handPress(),1);
g.step(8);assert(g.dbg.handPress()>0&&g.dbg.handPress()<.5);
g.step(8);assert.equal(g.dbg.handPress(),0);
console.log('指先の座標・描画・開始待ち・タッチ・画面外・時間維持を確認しました');
