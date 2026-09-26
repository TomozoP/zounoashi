/* カメラ映像はブラウザ内だけで処理する。ゲーム画面に表示するが、外部へ送信しない。
   外部から読み込むものは固定版の判定プログラムと公式モデルだけ。 */
(function(global){
  'use strict';
  var ROOT='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
  var MODEL='https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
  var loading=null;
  async function detector(){
    if(!loading)loading=(async function(){
      var vision=await import(ROOT+'/vision_bundle.mjs');
      var files=await vision.FilesetResolver.forVisionTasks(ROOT+'/wasm');
      return vision.FaceDetector.createFromOptions(files,{baseOptions:{modelAssetPath:MODEL,delegate:'CPU'},runningMode:'VIDEO',minDetectionConfidence:.6});
    })().catch(function(e){loading=null;throw e;});
    return loading;
  }
  function FaceSteering(){
    this.box=null;this.stream=null;this.video=null;this.model=null;this.status='idle';this.vector=0;
    this.found=false;this.neutral=null;this.centers=[];this.seen=-Infinity;this.last=-Infinity;this.epoch=0;this.previousFrame=-1;
  }
  FaceSteering.prototype.stop=function(){
    this.box=null;this.epoch++;if(this.stream)this.stream.getTracks().forEach(function(t){t.stop();});
    if(this.video){this.video.pause();this.video.srcObject=null;}
    this.stream=null;this.video=null;this.vector=0;this.found=false;this.status='idle';
  };
  FaceSteering.prototype.start=async function(){
    if(this.status==='loading'||this.status==='active')return;
    this.stop();var epoch=this.epoch,self=this;
    this.status='loading';this.neutral=null;this.centers=[];this.previousFrame=-1;this.seen=-Infinity;this.last=-Infinity;
    try{
      if(!global.navigator.mediaDevices)throw Error('カメラ非対応');
      var stream=await global.navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:320},height:{ideal:240},frameRate:{ideal:15,max:20}},audio:false});
      if(epoch!==this.epoch||document.hidden){stream.getTracks().forEach(function(t){t.stop();});return;}
      this.stream=stream;
      stream.getTracks().forEach(function(t){t.onended=function(){self.stop();self.status='error';};});
      this.video=document.createElement('video');this.video.muted=true;this.video.playsInline=true;this.video.setAttribute('playsinline','');
      this.video.srcObject=stream;await this.video.play();
      var timer;
      try{this.model=await Promise.race([detector(),new Promise(function(_,reject){timer=setTimeout(function(){reject(Error('顔判定の準備時間切れ'));},20000);})]);}
      finally{clearTimeout(timer);}
      if(epoch!==this.epoch)return;
      this.status='active';
    }catch(e){if(epoch!==this.epoch)return;this.stop();this.status='error';console.warn('カメラを開始できません。',e);}
  };
  FaceSteering.prototype.accept=function(detections,width,now){
    // 複数の顔が映る場合は一番大きい顔を使う。
    var box=detections.map(function(d){return d.boundingBox;}).filter(Boolean).sort(function(a,b){return b.width*b.height-a.width*a.height;})[0];
    this.box=box||null;
    if(!box){if(now-this.seen>350){this.vector=0;this.found=false;}return;}
    var center=(box.originX+box.width*.5)/width;
    this.seen=now;
    if(this.neutral===null){this.centers.push(center);if(this.centers.length<5)return;this.neutral=this.centers.reduce(function(a,b){return a+b;},0)/this.centers.length;}
    this.found=true;
    // 自分の左移動が画面でも左へ向かうように鏡と同じ向きにする。
    var offset=this.neutral-center;
    var target=Math.abs(offset)<.025?0:Math.sign(offset)*Math.min(1,(Math.abs(offset)-.025)/.19);
    this.vector+=(target-this.vector)*.65;
  };
  // 判定の準備中や顔を見失った間も、元の映像は表示する。
  FaceSteering.prototype.drawPreview=function(ctx){
    var v=this.video;if(!v||v.readyState<2||!v.videoWidth||!v.videoHeight)return;
    var x=18,y=18,w=180,h=w*v.videoHeight/v.videoWidth;
    ctx.save();ctx.fillStyle='#16202e';ctx.fillRect(x-3,y-3,w+6,h+6);
    ctx.translate(x+w,y);ctx.scale(-1,1);ctx.drawImage(v,0,0,w,h);ctx.restore();
    ctx.save();ctx.strokeStyle='#42ffb1';ctx.lineWidth=3;
    var b=this.box;if(b&&performance.now()-this.seen<350)ctx.strokeRect(x+w-(b.originX+b.width)*w/v.videoWidth,y+b.originY*h/v.videoHeight,b.width*w/v.videoWidth,b.height*h/v.videoHeight);
    ctx.fillStyle='#16202e';ctx.fillRect(x-3,y+h,w+6,24);ctx.fillStyle='#fff';ctx.font='bold 13px sans-serif';ctx.textAlign='left';ctx.fillText(this.status==='loading'?'顔検出の準備中':this.found?'顔を検出中':'顔を探しています',x+4,y+h+17);ctx.restore();
  };
  FaceSteering.prototype.tick=function(now){
    if(this.status!=='active')return;
    if(now-this.seen>350){this.vector=0;this.found=false;}
    if(now-this.last<90||!this.video||this.video.readyState<2||this.video.currentTime===this.previousFrame)return;
    this.last=now;this.previousFrame=this.video.currentTime;
    try{this.accept(this.model.detectForVideo(this.video,now).detections,this.video.videoWidth,now);}
    catch(e){this.stop();this.status='error';console.warn('顔の位置を取得できません。',e);}
  };
  global.FaceSteering=FaceSteering;
})(window);
