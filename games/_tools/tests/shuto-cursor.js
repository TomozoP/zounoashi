/* カーソルの移動ではゲームを進めず、タッチや画面外では消す。 */
const assert=require('assert'),load=require('../harness');
const g=load('games/shuto/index.html',{imagesLoad:true,inject:"window.__dbg={pointer:pointer};"});
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
console.log('指先の座標・描画・開始待ち・タッチ・画面外・時間維持を確認しました');
