/* 結果ボタンの共通アイコン。文字ラベルは操作の名前として残す。 */
(function(global){
  'use strict';
  function kind(label){return label==='もう一度'||label==='もう一度走る'?'retry':label==='Xでシェア'||label==='Xでポスト'?'share':null;}
  function draw(ctx,label,x,y,size){
    var id=kind(label);if(!id)return false;
    ctx.save();ctx.translate(x,y);ctx.scale((size||30)/24,(size||30)/24);ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';
    if(id==='retry'){
      ctx.beginPath();ctx.arc(0,0,8,-Math.PI*.8,Math.PI*.85);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-8,-8);ctx.lineTo(-6.5,-3);ctx.lineTo(-1.5,-5);ctx.stroke();
    }else{
      ctx.beginPath();ctx.moveTo(-9,-10);ctx.lineTo(-4,-10);ctx.lineTo(9,10);ctx.lineTo(4,10);ctx.closePath();ctx.stroke();
      ctx.beginPath();ctx.moveTo(9,-10);ctx.lineTo(1,-1);ctx.moveTo(-1,1);ctx.lineTo(-9,10);ctx.stroke();
    }
    ctx.restore();return true;
  }
  global.zActionIcon=draw;
})(window);
