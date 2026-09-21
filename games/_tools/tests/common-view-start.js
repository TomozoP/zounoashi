/* 共通化しても画面の寸法・タップ座標・開始操作の境界が変わらないことを確かめる。 */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
function events(){const handlers={};return {
 addEventListener(n,f){(handlers[n]||(handlers[n]=[])).push(f);},
 removeEventListener(n,f){handlers[n]=handlers[n].filter(v=>v!==f);},
 fire(n,e){(handlers[n]||[]).forEach(f=>f(e));}
};}
const window=events(),document=events();
vm.runInNewContext(fs.readFileSync('games/view.js','utf8')+fs.readFileSync('games/start.js','utf8'),{window,document});
for(const [w,h] of [[375,812],[700,700],[500,1600],[1920,1080]])for(const dpr of [1,2,3]){
 window.devicePixelRatio=dpr;
 const wrap={parentNode:{clientWidth:w,clientHeight:h},style:{}},canvas={style:{}},ctx={setTransform(...v){this.transform=v;}};
 const view=window.zGameView.measure(wrap,540),height=Math.max(780,Math.min(1700,Math.round(540*h/w)));
 assert.equal(view.gameHeight,height);
 window.zGameView.fit(canvas,wrap,ctx,540,height,view);
 const scale=Math.min(w/540,h/height);
 assert.equal(canvas.width,Math.round(540*scale*Math.min(dpr,2)));
 assert.equal(canvas.height,Math.round(height*scale*Math.min(dpr,2)));
 assert.equal(wrap.style.width,Math.round(540*scale)+'px');
 assert.equal(wrap.style.height,Math.round(height*scale)+'px');
 assert.equal(ctx.transform[0],canvas.width/540);
 canvas.getBoundingClientRect=()=>({left:20,top:30,width:270,height:height/2});
 const p=window.zGameView.point(canvas,{clientX:155,clientY:30+height/4},540,height);
 assert.equal(p.x,270);assert.equal(p.y,height/2);
}
window.innerWidth=390;window.innerHeight=844;
assert.equal(window.zGameView.measure({parentNode:{clientWidth:0,clientHeight:0}},540).gameHeight,1169);
let waiting=true,starts=0,stopped=0;
const unbind=window.zStartTap(()=>waiting,()=>{starts++;waiting=false;});
function fire(name,id=1,extra={}){document.fire(name,{pointerId:id,button:0,isPrimary:true,preventDefault(){},stopImmediatePropagation(){stopped++;},...extra});}
fire('pointerup');assert.equal(starts,0);
fire('pointerdown',1,{button:2});fire('pointerup');assert.equal(starts,0,'右クリックでは開始しない');
fire('pointerdown');assert.equal(starts,0,'押した時点では始まらない');
fire('pointerdown',2,{isPrimary:false});fire('pointercancel',2);fire('pointerup',2);assert.equal(starts,0,'別の指では開始しない');
fire('pointerup');assert.equal(starts,1);assert.equal(stopped,2,'開始操作を本編へ流さない');
fire('pointerdown');fire('pointerup');assert.equal(starts,1,'本編中の操作は取り込まない');
waiting=true;fire('pointerdown');fire('pointercancel');fire('pointerup');assert.equal(starts,1,'取消では開始しない');
fire('pointerdown');window.fire('blur');fire('pointerup');assert.equal(starts,1,'画面を離れた操作は破棄');
fire('pointerdown');waiting=false;fire('pointerup');assert.equal(starts,1,'途中で待機が終わったら開始し直さない');
waiting=true;unbind();fire('pointerdown');fire('pointerup');assert.equal(starts,1,'解除後は反応しない');
console.log('画面4種×解像度3種・座標変換・開始と取消・別の指・解除：確認済み');

const load=require('../harness');
function tapDocument(g,x,y,cancel){
 const event={pointerId:9,isPrimary:true,button:0,clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){}};
 g.doc.fire('pointerdown',event);
 g.doc.fire(cancel?'pointercancel':'pointerup',event);
}
for(const name of ['_template','baibai-quiz','random-bowling','shuto','wanko']){
 const g=load('games/'+name+'/index.html',{withScripts:name==='random-bowling'});
 const before=g.probe.now();
 tapDocument(g,270,400,true);assert.equal(g.probe.now().state,before.state,name+' 取消で開始しない');
 tapDocument(g,-10,10,false);
 g.step(1);assert.notEqual(g.probe.now().state,'intro',name+' 余白を離して開始');
 if(name==='_template')assert.equal(g.probe.now().score,0,'開始タップで加点しない');
 if(name==='random-bowling')assert.equal(g.probe.now().phase,'ready','開始タップで投球しない');
}
const levelOrder=['coffee','ramen','nabe'];
// 食べ物で段階を選ぶゲームは、余白では開始しない。
for(let i=0;i<3;i++){
 const g=load('games/ichirin-nabe/index.html');
 tapDocument(g,270,10);assert.equal(g.probe.now().state,'intro');
 tapDocument(g,540*(.2+.3*i),g.H-150);
 assert.equal(g.probe.now().state,'play');
 assert.equal(g.probe.now().level,levelOrder[i]);
}
console.log('実際のゲーム6本：開始・取消・余白・食べ物の選択を確認');
