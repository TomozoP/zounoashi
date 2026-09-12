/* 実ブラウザで模型・材質・追従カメラを確認し、見た目を一時フォルダに保存する。 */
var fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),cp=require('child_process');
var root=path.resolve(__dirname,'../../..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'bowling-view-'));
var child,timer;
var hook=`
  window.__visual={placement:function(){for(var z of [-.15,1.6]){var p=project(1,ZBowlingPhysics.releaseHeight(kind),z);movePosition(p.x,p.y);if(Math.abs(position-1)>.001||Math.abs(positionZ-z)>.001)throw Error('触れた位置と球の位置が一致しない');}position=0;positionZ=.65;draw();},supply:function(t){phase='return';elapsed=t;view3d.follow=0;draw();var p=view3d.ballMeshes[kind.skin].position;return project(p.x,p.y,p.z);},bottom:function(){return view3d.pins.every(function(p){return p.children.some(function(m){return m.geometry.type==='CircleGeometry'&&m.material.side===THREE.DoubleSide;});});},pick:function(i){scoreTime=0;history=[];shot=0;state=S.PLAY;kind=kinds[i];world.reset(kind);syncPhysics();phase='position';position=0;aim=.01;view3d.follow=0;view3d.followX=0;draw();return project(0,ZBowlingPhysics.releaseHeight(kind),.65);},fit:function(h){H=h;view3d.resize(540,h);draw();var p=project(2.1,kind.r,.65);layout();return p.x;}};
`;
var runner=`<script>
window.__recordManual=true;
(async function(){
  function key(){window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space'}));window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space'}));}
  async function save(name,cv){await fetch('/__save/'+name,{method:'POST',body:await new Promise(function(resolve){cv.toBlob(resolve,'image/png');})});}
  try {
    for(var i=0;i<100&&!window.__probe.now().modelsReady;i++)await new Promise(function(r){setTimeout(r,50);});
    if(!window.__probe.now().modelsReady)throw Error('Blenderの模型が読み込まれない');
    var cv=document.getElementById('c'),all=document.createElement('canvas');all.width=1200;all.height=480;var c=all.getContext('2d');c.fillStyle='#142a37';c.fillRect(0,0,1200,480);
    for(var i=0;i<10;i++){
      var p=window.__visual.pick(i),scale=cv.width/540;
      c.drawImage(cv,(p.x-82)*scale,(p.y-74)*scale,164*scale,164*scale,(i%5)*240,Math.floor(i/5)*240,240,240);
    }
    await save('種類.png',all);
    window.__visual.pick(0);window.__visual.placement();var entry=window.__visual.supply(0),arrived=window.__visual.supply(1.2);if(entry.y<window.__probe.now().H||arrived.y>=entry.y||Math.abs(arrived.x-270)>1)throw Error('球が画面下から中央へ補充されない');if(!window.__visual.bottom())throw Error('ピンの底板がない');window.__visual.pick(0);await save('投球前.png',cv);key();key();window.__probe.step(27);await save('パワー.png',cv);key();
    for(var i=0;i<90;i++)window.__probe.step(1);
    var first=window.__probe.now();await save('追従.png',cv);
    for(var i=0;i<90;i++)window.__probe.step(1);
    var second=window.__probe.now();await save('衝突.png',cv);
    if(first.cameraFollow<3||second.cameraFollow<8)throw Error('カメラが球を追っていない');
    var until=0;while(window.__probe.now().phase!=='position'&&until++<1000)window.__probe.step(1);
    for(var i=0;i<120;i++)window.__probe.step(1);
    if(window.__probe.now().cameraFollow>.1)throw Error('カメラが投球位置へ戻らない');
    var edges=[780,960,1200,1700].map(function(h){return window.__visual.fit(h);});
    if(edges.some(function(x){return x>515||x<270;}))throw Error('縦横比によって投球位置が画面から外れる');
    await fetch('/__done',{method:'POST',body:JSON.stringify({models:true,edges:edges,follow:first.cameraFollow,nearPins:second.cameraFollow,returned:window.__probe.now().cameraFollow})});
  }catch(e){await fetch('/__fail',{method:'POST',body:e.stack});}
})();</script>`;
var server=http.createServer(function(req,res){
  var u=decodeURIComponent(req.url.split('?')[0]);
  if(u.startsWith('/__')){var parts=[];req.on('data',function(b){parts.push(b);});req.on('end',function(){var data=Buffer.concat(parts);res.end('ok');if(u.startsWith('/__save/'))fs.writeFileSync(path.join(out,path.basename(u)),data);else finish(u==='/__done'?0:1,data.toString());});return;}
  var file=path.resolve(root,'.'+u);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try {var data=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'application/json');
    if(u==='/games/_random-bowling/index.html')data=data.toString().replace('  /* ============ ループ ============ */',hook+'\n  /* ============ ループ ============ */').replace('</body>',runner+'</body>');
    res.end(data);
  }catch(e){res.writeHead(404);res.end();}
});
function finish(code,message){clearTimeout(timer);if(child)child.kill();server.close();console.log(message);console.log(out);process.exit(code);}
server.listen(0,'127.0.0.1',function(){
  var exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  if(!exe)return finish(1,'ブラウザが見つからない');
  child=cp.spawn(exe,['--headless=new','--no-first-run','--no-default-browser-check','--enable-unsafe-swiftshader','--window-size=540,1080','--user-data-dir='+path.join(out,'profile'),'http://127.0.0.1:'+server.address().port+'/games/_random-bowling/index.html'],{stdio:'ignore'});
  child.on('error',function(e){finish(1,e.message);});timer=setTimeout(function(){finish(1,'時間切れ');},90000);
});
