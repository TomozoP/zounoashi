/* 保存はPCでダウンロード、対応スマホで共有し、取消時は保存しない。 */
const assert=require('assert'),load=require('../harness');
for(const mode of ['desktop','mobile','cancel','failure']){
 const inject=`var saved={downloads:0,shares:0,file:null};var setTimeout=function(fn){fn();};
 var atob=function(){return 'PNG';},File=function(bytes,name,options){this.name=name;this.type=options.type;saved.file=this;};
 var URL={createObjectURL:function(){return 'blob:test';},revokeObjectURL:function(){}};
 var originalCreate=document.createElement.bind(document);document.createElement=function(tag){if(tag==='a')return{click:function(){saved.downloads++;},remove:function(){}};return originalCreate(tag);};
 window.navigator={userAgent:${JSON.stringify(mode==='desktop'?'PC':'iPhone')},canShare:function(){return true;},share:function(){saved.shares++;return{catch:function(fn){${mode==='cancel'?"fn({name:'AbortError'});":mode==='failure'?"fn({name:'Error'});":''}}};}};
 window.__dbg={finish:function(){walker.points.forEach(function(p){p.x+=3201-222.5;p.px=p.x;});},save:function(){saved.width=goalPrint.width;saved.height=goalPrint.height;goalPrint.toDataURL=function(){return 'data:image/png;base64,UE5H';};saveGoalImage();return saved;}};`;
 const g=load('games/_shark-walk/index.html',{withScripts:true,inject});g.press(' ');g.dbg.finish();g.step(2);const result=g.dbg.save();
 assert.equal(result.width,840);assert.equal(result.height,800);assert.equal(result.file.type,'image/png');assert(result.file.name.startsWith('鮫人歩行-'));
 assert.equal(result.shares,mode==='desktop'?0:1);assert.equal(result.downloads,mode==='desktop'||mode==='failure'?1:0);
}
console.log('枠付きPNG・PC保存・スマホ共有・共有取消・保存への切替：確認済み');
