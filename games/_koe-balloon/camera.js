/* カメラ映像はブラウザ内で処理し、本人の姿をゲーム画面へ合成する。外部へは送信しない。
   外部から読み込むものは固定版の判定プログラムと公式モデルだけ。 */
(function(global){
  'use strict';
  var ROOT='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
  var MODEL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
  var loading=null;
  async function detector(){
    if(!loading)loading=(async function(){
      var vision=await import(ROOT+'/vision_bundle.mjs');
      var files=await vision.FilesetResolver.forVisionTasks(ROOT+'/wasm');
      return vision.PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:MODEL,delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55,minTrackingConfidence:.55,outputSegmentationMasks:true});
    })().catch(function(e){loading=null;throw e;});
    return loading;
  }
  function WingInput(){
    this.stream=null;this.video=null;this.model=null;this.status='idle';this.vector=0;
    this.wings=[-.45,-.45];this.pending=[0,0];this.arms=[{},{}];this.portrait=null;this.crop=null;
    this.found=false;this.neutral=null;this.centers=[];this.seen=-Infinity;this.last=-Infinity;this.epoch=0;this.previousFrame=-1;
  }
  WingInput.prototype.stop=function(keepFrame){
    this.epoch++;if(this.stream)this.stream.getTracks().forEach(function(t){t.stop();});
    if(this.video){this.video.pause();this.video.srcObject=null;}
    this.stream=null;this.video=null;this.vector=0;this.found=false;this.status='idle';this.pending=[0,0];this.arms=[{},{}];
    if(!keepFrame){this.portrait=null;this.crop=null;}
  };
  WingInput.prototype.start=async function(){
    if(this.status==='loading'||this.status==='active')return;
    this.stop();var epoch=this.epoch,self=this;
    this.status='loading';this.neutral=null;this.centers=[];this.previousFrame=-1;this.seen=-Infinity;this.last=-Infinity;
    try{
      if(!global.navigator.mediaDevices)throw Error('カメラ非対応');
      var stream=await global.navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}},audio:false});
      if(epoch!==this.epoch||document.hidden){stream.getTracks().forEach(function(t){t.stop();});return;}
      this.stream=stream;
      stream.getTracks().forEach(function(t){t.onended=function(){self.stop();self.status='error';};});
      this.video=document.createElement('video');this.video.muted=true;this.video.playsInline=true;this.video.setAttribute('playsinline','');
      this.video.srcObject=stream;await this.video.play();
      var timer;
      try{this.model=await Promise.race([detector(),new Promise(function(_,reject){timer=setTimeout(function(){reject(Error('姿勢判定の準備時間切れ'));},20000);})]);}
      finally{clearTimeout(timer);}
      if(epoch!==this.epoch)return;
      this.status='active';
    }catch(e){if(epoch!==this.epoch)return;this.stop();this.status='error';console.warn('カメラを開始できません。',e);}
  };
  WingInput.prototype.lose=function(){this.vector=0;this.found=false;this.pending=[0,0];this.arms=[{},{}];};
  WingInput.prototype.accept=function(result,width,height,now){
    var p=result.landmarks&&result.landmarks[0];
    var valid=p&&[0,11,12,13,14,15,16].every(function(i){return p[i]&&p[i].visibility>.5&&p[i].x>0&&p[i].x<1&&p[i].y>0&&p[i].y<1;});
    if(!valid){if(now-this.seen>350)this.lose();return;}
    this.seen=now;
    var span=Math.max(.08,Math.abs(p[11].x-p[12].x)),center=p[0].x;
    if(this.neutral===null){this.centers.push(center);if(this.centers.length>=5)this.neutral=this.centers.reduce(function(a,b){return a+b;},0)/this.centers.length;}
    if(this.neutral===null)return;
    this.found=true;
    var offset=this.neutral-center,target=Math.abs(offset)<.025?0:Math.sign(offset)*Math.min(1,(Math.abs(offset)-.025)/.19);
    this.vector+=(target-this.vector)*.65;
    for(var i=0;i<2;i++){
      var shoulder=p[11+i],wrist=p[15+i],elevation=(shoulder.y-wrist.y)*height/width/span;
      this.wings[i]=Math.max(-1.15,Math.min(1.15,Math.atan2((shoulder.y-wrist.y)*height,Math.abs(wrist.x-shoulder.x)*width)));
      var arm=this.arms[i],dt=arm.time===undefined?0:(now-arm.time)/1000;
      // 上げてから十分な距離を下げた一往復だけを数える。静止・手の小さな揺れでは飛ばない。
      if(elevation>.2){if(!arm.armed)arm.raised=now;arm.armed=true;arm.peak=Math.max(arm.peak||elevation,elevation);}
      if(arm.armed&&dt>0&&dt<.4&&elevation<-.15&&arm.peak-elevation>.55&&(arm.previous-elevation)/dt>.7&&now-arm.raised<1800){
        this.pending[i]=Math.min(1.3,Math.max(.65,(arm.peak-elevation)*.65));arm.armed=false;arm.peak=0;
      }
      if(arm.armed&&now-arm.raised>=1800){arm.armed=false;arm.peak=0;}
      arm.previous=elevation;arm.time=now;
    }
    this.capture(result,p,width,height,span);
  };
  WingInput.prototype.takeFlaps=function(){var pulses=this.pending;this.pending=[0,0];return pulses;};
  WingInput.prototype.capture=function(result,p,width,height,span){
    if(!this.video)return;
    if(!this.portrait)this.portrait=document.createElement('canvas');
    var c=this.portrait;if(c.width!==width||c.height!==height){c.width=width;c.height=height;}
    var ctx=c.getContext('2d');ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,width,height);ctx.drawImage(this.video,0,0,width,height);
    var mask=result.segmentationMasks&&result.segmentationMasks[0];
    if(mask){
      if(!this.maskCanvas)this.maskCanvas=document.createElement('canvas');
      var m=this.maskCanvas;m.width=mask.width;m.height=mask.height;
      var mc=m.getContext('2d'),pixels=mc.createImageData(m.width,m.height),values=mask.getAsFloat32Array();
      for(var k=0;k<values.length;k++){pixels.data[k*4+3]=Math.max(0,Math.min(255,(values[k]-.25)*510));}
      mc.putImageData(pixels,0,0);ctx.globalCompositeOperation='destination-in';ctx.drawImage(m,0,0,width,height);ctx.globalCompositeOperation='source-over';
    }
    var cx=(p[11].x+p[12].x)*.5,cy=(p[11].y+p[12].y)*.5;
    var top=Math.max(0,p[0].y-span*.7*width/height),bottom=Math.min(1,cy+span*1.6*width/height);
    var left=Math.max(0,cx-span*1.25),right=Math.min(1,cx+span*1.25);
    this.crop={x:left*width,y:top*height,w:(right-left)*width,h:(bottom-top)*height,cx:cx*width,cy:cy*height,scale:54/(span*width)};
  };
  WingInput.prototype.drawPlayer=function(ctx,x,y,angle){
    var c=this.crop;if(!this.portrait||!c)return false;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle||0);ctx.scale(-c.scale,c.scale);
    ctx.drawImage(this.portrait,c.x,c.y,c.w,c.h,c.x-c.cx,c.y-c.cy,c.w,c.h);ctx.restore();return true;
  };
  WingInput.prototype.tick=function(now){
    if(this.status!=='active')return;
    if(now-this.seen>350)this.lose();
    if(now-this.last<60||!this.video||this.video.readyState<2||this.video.currentTime===this.previousFrame)return;
    this.last=now;this.previousFrame=this.video.currentTime;
    try{
      var result=this.model.detectForVideo(this.video,now);
      try{this.accept(result,this.video.videoWidth,this.video.videoHeight,now);}
      finally{if(result.segmentationMasks)result.segmentationMasks.forEach(function(m){m.close();});}
    }
    catch(e){this.stop();this.status='error';console.warn('腕の位置を取得できません。',e);}
  };
  global.WingInput=WingInput;
})(window);
