/* 結果ボタンなどの共通アイコン。文字ラベルは操作の名前として残す。
   ボタンを足すときは、ゲームごとに描かずここへ同じ線の太さで足す。 */
(function(global){
  'use strict';
  function kind(label){return label==='もう一度'||label==='もう一度走る'?'retry':label==='Xでシェア'||label==='Xでポスト'?'share':label==='次'||label==='次へ'?'next':label==='画像を選ぶ'?'photo':label==='ガイドを消す'?'guide':label==='ガイドを出す'?'guideOff':null;}
  function draw(ctx,label,x,y,size){
    var id=kind(label);if(!id)return false;
    ctx.save();ctx.translate(x,y);ctx.scale((size||30)/24,(size||30)/24);ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';
    if(id==='retry'){
      ctx.beginPath();ctx.arc(0,0,8,-Math.PI*.8,Math.PI*.85);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-8,-8);ctx.lineTo(-6.5,-3);ctx.lineTo(-1.5,-5);ctx.stroke();
    }else if(id==='next'){
      ctx.beginPath();ctx.moveTo(-9,0);ctx.lineTo(9,0);ctx.moveTo(2,-7);ctx.lineTo(9,0);ctx.lineTo(2,7);ctx.stroke();
    }else if(id==='photo'){
      ctx.beginPath();ctx.moveTo(-8,-7);ctx.lineTo(8,-7);ctx.arcTo(10,-7,10,-5,2);ctx.lineTo(10,5);ctx.arcTo(10,7,8,7,2);ctx.lineTo(-8,7);ctx.arcTo(-10,7,-10,5,2);ctx.lineTo(-10,-5);ctx.arcTo(-10,-7,-8,-7,2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-10,5);ctx.lineTo(-4,-1);ctx.lineTo(1,4);ctx.lineTo(4,1);ctx.lineTo(10,6);ctx.stroke();
      ctx.beginPath();ctx.arc(4,-3,1.6,0,Math.PI*2);ctx.stroke();
    }else if(id==='guide'||id==='guideOff'){
      /* 目の形。消えているときは斜線を引く */
      ctx.beginPath();ctx.moveTo(-10,0);ctx.quadraticCurveTo(0,-10,10,0);ctx.quadraticCurveTo(0,10,-10,0);ctx.closePath();ctx.stroke();
      ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.stroke();
      if(id==='guideOff'){ctx.beginPath();ctx.moveTo(-9,-9);ctx.lineTo(9,9);ctx.stroke();}
    }else{
      ctx.beginPath();ctx.moveTo(-9,-10);ctx.lineTo(-4,-10);ctx.lineTo(9,10);ctx.lineTo(4,10);ctx.closePath();ctx.stroke();
      ctx.beginPath();ctx.moveTo(9,-10);ctx.lineTo(1,-1);ctx.moveTo(-1,1);ctx.lineTo(-9,10);ctx.stroke();
    }
    ctx.restore();return true;
  }
  global.zActionIcon=draw;
})(window);
