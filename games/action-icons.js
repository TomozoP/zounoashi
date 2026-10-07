/* 結果ボタンなどの共通アイコン。文字ラベルは操作の名前として残す。
   ボタンを足すときは、ゲームごとに描かずここへ同じ線の太さで足す。 */
(function(global){
  'use strict';
  function kind(label){return label==='もう一度'||label==='もう一度走る'?'retry':label==='Xでシェア'||label==='Xでポスト'?'share':label==='次'||label==='次へ'?'next':label==='画像を選ぶ'||label==='背景'?'photo':label==='ガイドを消す'?'guide':label==='ガイドを出す'?'guideOff':label==='スプレー'?'spray':label==='ハサミ'?'scissors':label==='毛色'?'palette':label==='飾り'?'ribbon':label==='顔'?'face':null;}
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
    }else if(id==='spray'){
      /* 缶とノズル、吹き出す粒 */
      ctx.beginPath();ctx.moveTo(-8,-2);ctx.lineTo(-8,10);ctx.arcTo(-8,11,-7,11,1);ctx.lineTo(1,11);ctx.arcTo(2,11,2,10,1);ctx.lineTo(2,-2);ctx.closePath();ctx.stroke();
      ctx.beginPath();ctx.moveTo(-6,-2);ctx.lineTo(-6,-6);ctx.lineTo(0,-6);ctx.lineTo(0,-2);ctx.moveTo(0,-5);ctx.lineTo(3,-5);ctx.stroke();
      ctx.beginPath();ctx.arc(7,-9,1,0,Math.PI*2);ctx.arc(9,-4,1,0,Math.PI*2);ctx.arc(7,1,1,0,Math.PI*2);ctx.fill();
    }else if(id==='scissors'){
      /* 交差した刃と2つの持ち手 */
      ctx.beginPath();ctx.arc(-5,6,3.2,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.arc(5,6,3.2,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-3,3.5);ctx.lineTo(6,-10);ctx.moveTo(3,3.5);ctx.lineTo(-6,-10);ctx.stroke();
    }else if(id==='palette'){
      /* 絵の具の板と、色の丸3つ */
      ctx.beginPath();ctx.moveTo(1,-10);ctx.bezierCurveTo(10,-10,12,-2,11,3);ctx.bezierCurveTo(10,8,4,6,3,9);ctx.bezierCurveTo(1,12,-6,11,-9,7);ctx.bezierCurveTo(-13,1,-10,-10,1,-10);ctx.closePath();ctx.stroke();
      ctx.beginPath();ctx.arc(-4,-4,1.6,0,Math.PI*2);ctx.arc(3,-5,1.6,0,Math.PI*2);ctx.moveTo(-3.4,3);ctx.arc(-5,3,1.6,0,Math.PI*2);ctx.fill();
    }else if(id==='face'){
      /* 丸い顔に目と口 */
      ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.arc(-3.6,-2.5,1.5,0,Math.PI*2);ctx.arc(3.6,-2.5,1.5,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.moveTo(-4,3);ctx.quadraticCurveTo(0,7,4,3);ctx.stroke();
    }else if(id==='ribbon'){
      /* 蝶結びのリボン */
      ctx.beginPath();ctx.moveTo(-2,0);ctx.lineTo(-10,-6);ctx.lineTo(-10,6);ctx.closePath();ctx.stroke();
      ctx.beginPath();ctx.moveTo(2,0);ctx.lineTo(10,-6);ctx.lineTo(10,6);ctx.closePath();ctx.stroke();
      ctx.beginPath();ctx.arc(0,0,2.4,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-1.5,2.2);ctx.lineTo(-4,10);ctx.moveTo(1.5,2.2);ctx.lineTo(4,10);ctx.stroke();
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
