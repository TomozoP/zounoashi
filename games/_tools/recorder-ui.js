/* localhostでF9を押したときだけ出す、ゲーム動画の撮影パネル。 */
(function () {
  'use strict';
  if (window.__capturePanel) return;
  window.__capturePanel = true;

  var source = document.querySelector('canvas');
  if (!source || !window.MediaRecorder || !source.captureStream) return;
  var panel, status, recorder, chunks, paintId, output, started = false;

  /* ゲーム音の最終出口を、録画用の音声にも分ける。 */
  if (window.AudioNode && !AudioNode.prototype.__zRecorderOriginal) {
    var original = AudioNode.prototype.connect;
    AudioNode.prototype.__zRecorderOriginal = original;
    AudioNode.prototype.connect = function (destination) {
      var result = original.apply(this, arguments);
      var tap = window.__zRecorderSound;
      if (tap && destination instanceof AudioDestinationNode && this.context === tap.context && !this.__zRecorderTapped) {
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
    line.style.cssText = 'display:grid;grid-template-columns:76px 1fr;align-items:center;gap:10px';
    line.appendChild(make('span', label));
    var select = make('select'); select.name = name;
    select.style.cssText = 'font:inherit;padding:7px;background:#26241f;color:#f4ead5;border:1px solid #8d8064';
    values.forEach(function (v) { var o=make('option',v[0]);o.value=v[1];select.appendChild(o); });
    line.appendChild(select); return line;
  }
  function show() {
    if (!panel) build();
    panel.style.display = panel.style.display === 'none' ? 'grid' : 'none';
  }
  function build() {
    panel = make('div');
    panel.style.cssText = 'position:fixed;z-index:2147483647;inset:50% auto auto 50%;transform:translate(-50%,-50%);width:310px;box-sizing:border-box;padding:20px;display:none;gap:13px;background:#171612;color:#f4ead5;border:1px solid #aa9872;box-shadow:0 14px 50px #000b;font:16px sans-serif';
    panel.appendChild(make('div','動画撮影'));
    panel.appendChild(row('操作',[['自分で操作','manual'],['自動運転','auto']],'mode'));
    panel.appendChild(row('大きさ',[['540×960','540'],['720×1280','720'],['1080×1920','1080']],'size'));
    panel.appendChild(row('画質',[['標準','4'],['高画質','8'],['最高画質','14']],'quality'));
    status = make('div','ゲーム画面と音だけを録画します');
    status.style.cssText='min-height:20px;color:#cabb99;font-size:13px';panel.appendChild(status);
    var buttons=make('div');buttons.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:10px';
    var close=make('button','閉じる'),start=make('button','録画開始');
    [close,start].forEach(function(b){b.style.cssText='padding:10px;font:inherit;border:1px solid #9c8c6b;background:#292720;color:#f4ead5;cursor:pointer';buttons.appendChild(b);});
    close.onclick=function(){panel.style.display='none';};
    start.onclick=function(){begin().catch(fail);};
    panel.appendChild(buttons);document.body.appendChild(panel);
  }

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
    return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']
      .filter(function(t){return MediaRecorder.isTypeSupported(t);})[0];
  }
  function drawOutput() {
    var c=output.getContext('2d'),sw=source.width,sh=source.height;
    c.fillStyle='#12100e';c.fillRect(0,0,output.width,output.height);
    var scale=Math.min(output.width/sw,output.height/sh),w=sw*scale,h=sh*scale;
    c.drawImage(source,(output.width-w)/2,(output.height-h)/2,w,h);
    paintId=requestAnimationFrame(drawOutput);
  }
  async function begin() {
    if (started) return;
    var mode=panel.querySelector('[name=mode]').value;
    var width=Number(panel.querySelector('[name=size]').value),height=Math.round(width*16/9);
    var rate=Number(panel.querySelector('[name=quality]').value)*1000000;
    var type=mime();if(!type)throw Error('このブラウザでは録画できません');
    var recipe=window.__recording,context=recipe&&recipe.sound?recipe.sound():null;
    if(context){window.__zRecorderSound=context.createMediaStreamDestination();}
    output=document.createElement('canvas');output.width=width;output.height=height;drawOutput();
    var stream=output.captureStream(60),tracks=stream.getVideoTracks();
    if(window.__zRecorderSound)tracks=tracks.concat(window.__zRecorderSound.stream.getAudioTracks());
    recorder=new MediaRecorder(new MediaStream(tracks),{mimeType:type,videoBitsPerSecond:rate,audioBitsPerSecond:192000});
    chunks=[];recorder.ondataavailable=function(e){if(e.data&&e.data.size)chunks.push(e.data);};
    recorder.onstop=save;recorder.onerror=function(e){fail(e.error||'録画に失敗しました');};
    started=true;panel.style.display='none';recorder.start(250);
    if(mode==='auto'){
      if(!recipe||!recipe.run)throw Error('このゲームには自動運転がありません');
      if(window.__probe&&window.__probe.reset)window.__probe.reset();
      await recipe.run({wait:wait,key:key,until:until,now:window.__probe&&window.__probe.now});
      stop();
    }
  }
  function stop(){if(recorder&&recorder.state==='recording')recorder.stop();}
  function save(){
    cancelAnimationFrame(paintId);
    var type=recorder.mimeType,ext=type.indexOf('mp4')>=0?'mp4':'webm';
    var blob=new Blob(chunks,{type:type}),a=document.createElement('a');
    var id=(location.pathname.split('/').filter(Boolean).slice(-2)[0]||'game').replace(/^_/,'');
    a.href=URL.createObjectURL(blob);a.download=id+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+ext;a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);},30000);
    started=false;window.__zRecorderSound=null;if(!panel)build();status.textContent='保存しました';panel.style.display='grid';
  }
  function fail(error){
    cancelAnimationFrame(paintId);if(recorder&&recorder.state==='recording')recorder.stop();started=false;
    if(!panel)build();status.textContent=String(error&&error.message||error);panel.style.display='grid';
  }

  window.addEventListener('keydown',function(e){
    if(e.key!=='F9')return;e.preventDefault();e.stopImmediatePropagation();
    if(started)stop();else show();
  },true);
})();
