/* localhostでF9を押したときだけ出す、ゲーム動画の撮影パネル。 */
(function () {
  'use strict';
  if (window.__capturePanel) return;
  window.__capturePanel = true;

  var source = document.querySelector('canvas');
  if (!source || !window.MediaRecorder || !source.captureStream) return;
  var panel, status, recorder, chunks, paintId, output, started = false, saving = false, silence;
  var audioClock=null, frames=[];
  var microphone=null, microphoneMix=null, leaving=false;
  var badge, preparing=false;
  var separateRecorder=null, separateDone=null, separateMode="combined", takeId="";
  function mark(label){
    if(!badge){
      var host=document;
      try{if(parent!==window&&parent.location.origin===location.origin)host=parent.document;}catch(e){}
      badge=host.createElement('button');
      badge.style.cssText='position:fixed;z-index:2147483647;right:12px;top:10px;padding:8px 12px;border:0;border-radius:18px;background:#302c24;color:white;font:14px sans-serif;cursor:pointer';
      badge.onclick=function(){if(started&&!saving)stop();else if(!preparing&&!saving)show();};
      host.body.appendChild(badge);
      window.addEventListener('pagehide',function(){badge.remove();});
    }
    badge.textContent=label;badge.style.display=label?'block':'none';
    badge.style.background=label.indexOf('録画中')>=0?'#a71c2a':'#302c24';
  }

  /* ゲーム音の最終出口を、録画用の音声にも分ける。 */
  if (window.AudioNode && !AudioNode.prototype.__zRecorderOriginal) {
    var original = AudioNode.prototype.connect;
    AudioNode.prototype.__zRecorderOriginal = original;
    AudioNode.prototype.connect = function (destination) {
      var result = original.apply(this, arguments);
      if (window.AudioDestinationNode && destination instanceof AudioDestinationNode && !this.__zRecorderTapped) {
        // 録画開始前に作った音の出口も、その時点で録画用につなぐ。
        var tap = window.__zRecorderSound;
        if (!tap || tap.context !== this.context)
          tap = window.__zRecorderSound = this.context.createMediaStreamDestination();
        this.__zRecorderTapped = true;
        original.call(this, tap);
      }
      return result;
    };
  }

  function make(tag, text) {
    var e = document.createElement(tag);
    if (text != null) e.textContent = text;
    return e;
  }
  function row(label, values, name) {
    var line = make('label');
    line.style.cssText = 'display:grid;grid-template-columns:76px minmax(0,1fr);align-items:center;gap:10px';
    line.appendChild(make('span', label));
    var select = make('select'); select.name = name;
    select.style.cssText = 'min-width:0;width:100%;box-sizing:border-box;font:inherit;padding:7px;background:#26241f;color:#f4ead5;border:1px solid #8d8064';
    values.forEach(function (v) { var o=make('option',v[0]);o.value=v[1];select.appendChild(o); });
    line.appendChild(select); return line;
  }
  function show() {
    if (!panel) build();
    panel.style.display = panel.style.display === 'none' ? 'grid' : 'none';
  }
  function build() {
    panel = make('div');
    panel.style.cssText = 'position:fixed;z-index:2147483647;inset:50% auto auto 50%;transform:translate(-50%,-50%);width:310px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;min-width:0;box-sizing:border-box;padding:20px;display:none;gap:13px;background:#171612;color:#f4ead5;border:1px solid #aa9872;box-shadow:0 14px 50px #000b;font:16px sans-serif';
    panel.appendChild(make('div','動画撮影'));
    panel.appendChild(row('操作',[['自分で操作','manual'],['自動運転','auto']],'mode'));
    panel.appendChild(row('大きさ',[
      ['ゲームに合わせる','auto'],
      ['縦 540×960','540x960'],['縦 720×1280','720x1280'],['縦 1080×1920','1080x1920'],
      ['横 960×540','960x540'],['横 1280×720','1280x720'],['横 1920×1080','1920x1080'],
      ['正方形 720×720','720x720']
    ],'size'));
    panel.appendChild(row('画質',[['標準','4'],['高画質','8'],['最高画質','14']],'quality'));
    panel.appendChild(row('マイク',[['入れない','off'],['一緒に録る','on']],'microphone'));
    panel.appendChild(row('保存',[['動画にまとめる','combined'],['マイクを別ファイル','microphone'],['音声を別ファイル','audio']],'separate'));
    status = make('div','ゲーム画面と音を保存します');
    status.style.cssText='min-width:0;overflow-wrap:anywhere;min-height:20px;color:#cabb99;font-size:13px';panel.appendChild(status);
    var buttons=make('div');buttons.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:10px';
    var close=make('button','閉じる'),start=make('button','録画開始');
    [close,start].forEach(function(b){b.style.cssText='padding:10px;font:inherit;border:1px solid #9c8c6b;background:#292720;color:#f4ead5;cursor:pointer';buttons.appendChild(b);});
    close.onclick=function(){panel.style.display='none';};
    start.onclick=function(){begin().catch(fail);};
    panel.appendChild(buttons);document.body.appendChild(panel);
  }

  function releaseMicrophone() {
    if(microphone){microphone.getTracks().forEach(function(t){t.stop();});microphone=null;}
    if(microphoneMix){microphoneMix.close().catch(function(){});microphoneMix=null;}
  }
  async function microphoneTracks(gameSound) {
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw Error('このブラウザではマイクを使えません');
    try {
      microphone=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      if(leaving){releaseMicrophone();throw Error('録画を中止しました');}
      var C=window.AudioContext||window.webkitAudioContext;
      microphoneMix=new C();await microphoneMix.resume();
      var mixed=microphoneMix.createMediaStreamDestination();
      // 自分の声をスピーカーには返さず、録画用の出口だけへつなぐ。
      microphoneMix.createMediaStreamSource(microphone).connect(mixed);
      if(gameSound)microphoneMix.createMediaStreamSource(gameSound.stream).connect(mixed);
      return mixed.stream.getAudioTracks();
    } catch(e) {
      releaseMicrophone();
      if(e.name==='NotAllowedError')throw Error('マイクの使用が許可されていません。ブラウザの許可設定を確認してください');
      if(e.name==='NotFoundError')throw Error('マイクが見つかりません');
      if(e.name==='NotReadableError')throw Error('マイクを使用できません。他のアプリで使用中でないか確認してください');
      throw e;
    }
  }
  window.addEventListener('pagehide',function(){leaving=true;releaseMicrophone();});

  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  async function until(test, seconds) {
    var end=performance.now()+seconds*1000;
    while(performance.now()<end){if(test())return true;await wait(16);}
    return false;
  }
  function key() {
    var o={key:' ',code:'Space',bubbles:true};
    window.dispatchEvent(new KeyboardEvent('keydown',o));
    window.dispatchEvent(new KeyboardEvent('keyup',o));
  }
  function mime() {
    return ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']
      .filter(function(t){return MediaRecorder.isTypeSupported(t);})[0];
  }
  function drawOutput() {
    if(window.__recording&&window.__recording.frame)source=window.__recording.frame();
    var now=performance.now(),delay=0;
    if(audioClock&&audioClock.getOutputTimestamp){
      var stamp=audioClock.getOutputTimestamp();
      if(stamp.contextTime>0)delay=Math.max(0,Math.min(250,(audioClock.currentTime-stamp.contextTime)*1000));
    }
    // 音声出力待ちと同じ時間だけ映像を保持する。固定の補正値は使わない。
    var frame=document.createElement('canvas');frame.width=output.width;frame.height=output.height;
    var fc=frame.getContext('2d'),sw=source.width,sh=source.height;
    fc.fillStyle='#12100e';fc.fillRect(0,0,frame.width,frame.height);
    var fit=Math.min(frame.width/sw,frame.height/sh);
    fc.drawImage(source,(frame.width-sw*fit)/2,(frame.height-sh*fit)/2,sw*fit,sh*fit);
    frames.push({time:now,image:frame});
    while(frames.length>1&&frames[1].time<=now-delay)frames.shift();
    var c=output.getContext('2d');
    c.drawImage(frames[0].image,0,0);
    paintId=requestAnimationFrame(drawOutput);
  }
  async function begin() {
    if (started || saving || preparing) return;
    preparing=true;window.__recordingActive=true;mark('録画準備中');
    try {
      var health=await fetch('http://127.0.0.1:8736/health');
      if(!health.ok)throw Error();
    }catch(e){throw Error('MP4保存係を起動してください：node games/_tools/record-server.js');}
    var mode=panel.querySelector('[name=mode]').value;
    separateMode=panel.querySelector('[name=separate]').value;
    var useMicrophone=panel.querySelector('[name=microphone]').value==='on';
    if(separateMode==='microphone'&&!useMicrophone)throw Error('マイクを「一緒に録る」にしてください');
    separateRecorder=null;separateDone=null;
    takeId=Date.now()+'-'+Math.random().toString(16).slice(2);
    var size=panel.querySelector('[name=size]').value,width,height;
    if(size==='auto'){
      if(window.__recording&&window.__recording.frame)source=window.__recording.frame();
      var gameSize=window.__recording&&window.__recording.frame?null:window.__probe&&window.__probe.now?window.__probe.now():null;
      var sw=gameSize&&gameSize.W||source.width,sh=gameSize&&gameSize.H||source.height;
      var scale=960/Math.max(sw,sh);
      width=Math.max(2,Math.round(sw*scale/2)*2);height=Math.max(2,Math.round(sh*scale/2)*2);
    }else{
      var pair=size.split('x');width=Number(pair[0]);height=Number(pair[1]);
    }
    var rate=Number(panel.querySelector('[name=quality]').value)*1000000;
    var type=mime();if(!type)throw Error('このブラウザでは録画できません');
    var recipe=window.__recording,context=recipe&&recipe.sound?recipe.sound():null;
    audioClock=context;frames=[];
    if(context){
      await context.resume();
      // 効果音のない時間も音声トラックを稼働させ、録画の時計を途切れさせない。
      if(!window.__zRecorderSound || window.__zRecorderSound.context!==context)
        window.__zRecorderSound=context.createMediaStreamDestination();
      silence=context.createConstantSource();silence.offset.value=0;
      silence.connect(window.__zRecorderSound);silence.start();
      await wait(100);
    }
    var audioTracks=window.__zRecorderSound?window.__zRecorderSound.stream.getAudioTracks():[];
    var gameTracks=audioTracks.slice(),separateTracks=[];
    if(useMicrophone)audioTracks=await microphoneTracks(window.__zRecorderSound);
    if(separateMode==='microphone'){separateTracks=microphone.getAudioTracks();audioTracks=gameTracks;}
    if(separateMode==='audio'){separateTracks=audioTracks;audioTracks=[];}
    if(separateMode!=='combined'&&!separateTracks.length)throw Error('録音する音声がありません');
    if(separateTracks.length){
      var audioType=['audio/webm;codecs=opus','audio/webm'].filter(function(t){return MediaRecorder.isTypeSupported(t);})[0];
      if(!audioType)throw Error('このブラウザでは音声を別保存できません');
      separateRecorder=new MediaRecorder(new MediaStream(separateTracks),{mimeType:audioType,audioBitsPerSecond:192000});
      var audioChunks=[];
      separateDone=new Promise(function(resolve){
        separateRecorder.ondataavailable=function(e){if(e.data&&e.data.size)audioChunks.push(e.data);};
        separateRecorder.onstop=function(){resolve(new Blob(audioChunks,{type:audioType}));};
      });
      separateRecorder.onerror=function(e){fail(e.error||'音声の録音に失敗しました');};
    }
    /* 録画専用の表示へ切り替えた画面を最初のコマから使う。 */
    await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
    output=document.createElement('canvas');output.width=width;output.height=height;drawOutput();
    var stream=output.captureStream(60),tracks=stream.getVideoTracks();
    tracks=tracks.concat(audioTracks);
    recorder=new MediaRecorder(new MediaStream(tracks),{mimeType:type,videoBitsPerSecond:rate,audioBitsPerSecond:192000});
    chunks=[];recorder.ondataavailable=function(e){if(e.data&&e.data.size)chunks.push(e.data);};
    recorder.onstop=function(){save().catch(fail);};recorder.onerror=function(e){fail(e.error||'録画に失敗しました');};
    preparing=false;started=true;panel.style.display='none';if(separateRecorder)separateRecorder.start(250);recorder.start(250);mark('● 録画中（停止）');
    if(mode==='auto'){
      if(!recipe||!recipe.run)throw Error('このゲームには自動運転がありません');
      if(window.__probe&&window.__probe.reset)window.__probe.reset();
      await recipe.run({wait:wait,key:key,until:until,now:window.__probe&&window.__probe.now});
      stop();
    }
  }
  function stop(){if(separateRecorder&&separateRecorder.state==='recording')separateRecorder.stop();if(recorder&&recorder.state==='recording')recorder.stop();releaseMicrophone();}
  async function save(){
    if(separateRecorder&&separateRecorder.state==='recording')separateRecorder.stop();
    releaseMicrophone();
    saving=true;
    mark('MP4保存中');
    cancelAnimationFrame(paintId);window.__recordingActive=false;
    recorder.stream.getTracks().filter(function(t){return t.kind==='video';}).forEach(function(t){t.stop();});
    if(silence){silence.stop();silence.disconnect();silence=null;}
    status.textContent='MP4に変換中';panel.style.display='grid';
    var raw=new Blob(chunks,{type:recorder.mimeType});
    var id=(location.pathname.split('/').filter(Boolean).slice(-2)[0]||'game').replace(/^_/,'');
    var response=await fetch('http://127.0.0.1:8736/convert?game='+encodeURIComponent(id)+'&take='+takeId,{method:'POST',body:raw});
    if(!response.ok)throw Error((await response.text())||('MP4保存に失敗しました（'+response.status+'）'));
    if(!(response.headers.get('Content-Type')||'').includes('application/json'))throw Error('MP4保存係を再起動してください');
    var result=await response.json();
    if(separateDone){
      try {
        var audioBlob=await separateDone;
        var audioResponse=await fetch('http://127.0.0.1:8736/convert?game='+encodeURIComponent(id)+'&take='+takeId+'&audio=1',{method:'POST',body:audioBlob});
        if(!audioResponse.ok)throw Error(await audioResponse.text());
        var audioResult=await audioResponse.json();
        result.message='動画：'+result.saved+' ／ 音声：'+audioResult.saved;
      } catch(e) {throw Error('動画は保存済み：'+result.saved+'。音声の保存に失敗しました：'+e.message);}
    }
    started=false;saving=false;mark('');frames=[];if(!panel)build();status.textContent=result.message||'保存しました';panel.style.display='grid';
  }
  function fail(error){
    if(separateRecorder&&separateRecorder.state==='recording'){separateRecorder.onerror=null;separateRecorder.stop();}
    releaseMicrophone();
    preparing=false;mark('録画エラー');
    cancelAnimationFrame(paintId);if(recorder&&recorder.state==='recording'){recorder.onstop=null;recorder.stop();}started=false;saving=false;
    if(silence){silence.stop();silence.disconnect();silence=null;}
    if(!panel)build();status.textContent=String(error&&error.message||error);panel.style.display='grid';
  }

  window.addEventListener('keydown',function(e){
    if(e.key!=='F9')return;e.preventDefault();e.stopImmediatePropagation();
    if(started)stop();else show();
  },true);
})();
