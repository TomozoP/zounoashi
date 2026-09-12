/* 実ブラウザで模型・材質・追従カメラを確認し、見た目を一時フォルダに保存する。 */
var fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),cp=require('child_process');
var root=path.resolve(__dirname,'../../..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'bowling-view-'));
var child,timer;
var hook=`window.__visual={appearance:function(){if(view3d.red.parts.head.children.length!==1||view3d.blue.parts.head.children.length!==1)throw Error('顔や髪が残っている');},tracking:function(){if(view3d.follow>22.001||Math.abs(view3d.followX)>2.001)throw Error('カメラが追い過ぎる');},hold:function(){down(270,600);for(var i=0;i<180;i++){update(1/60);draw();}if(Math.hypot(view3d.swingX,view3d.swingZ)<.03||Math.abs(view3d.swingX)>.6||Math.abs(view3d.swingZ)>.45)throw Error('回転中の控えめな追従が働かない');if(omega<13)throw Error('長押しで最大回転へ加速しない');},fit:function(){var oldH=H,oldAngle=angle;for(var h of [780,960,1200,1700]){H=h;view3d.resize(540,h);for(var a of [0,Math.PI/2,Math.PI,-Math.PI/2]){angle=a;draw();for(var p of ZWrestlePhysics.swingPose(a)){var screen=view3d.project(p.x,p.y,p.z);if(screen.x<8||screen.x>532||screen.y<20||screen.y>h-20)throw Error('回転するレスラーが画面外に出る');}}}H=oldH;angle=oldAngle;layout();draw();},side:function(){angle=.35;draw();}};`;

var runner=`<script>
window.__recordManual=true;
(async function(){
 function key(up){window.dispatchEvent(new KeyboardEvent(up?'keyup':'keydown',{key:' ',code:'Space'}));}
 async function save(name){var cv=document.getElementById('c');await fetch('/__save/'+name,{method:'POST',body:await new Promise(function(r){cv.toBlob(r,'image/png');})});}
 try{
  for(var i=0;i<100&&!window.__probe.now().modelsReady;i++)await new Promise(function(r){setTimeout(r,50);});
  if(!window.__probe.now().modelsReady)throw Error('模型を読み込めない');window.__probe.step(1);if(window.__probe.now().scoreTime!==0)throw Error('初期スコアが表示中');window.__visual.fit();window.__visual.appearance();await save('構え.png');window.__visual.side();await save('横向き.png');window.__probe.reset();
  window.__visual.hold();await save('スイング.png');window.__probe.reset();key();window.__probe.step(90);
  for(var i=0;i<500;i++){window.__probe.step(1);var n=window.__probe.now();if(n.swingTime>2&&Math.sin(n.angle)>.99&&Math.abs(Math.cos(n.angle))<.08)break;}
  key(true);window.__probe.step(18);await save('投げ.png');window.__probe.step(60);await save('衝突.png');window.__visual.tracking();var follow=window.__probe.now().cameraFollow;if(follow<5)throw Error('投げたレスラーを追っていない');
  var frames=0;while(window.__probe.now().phase!=='ready'&&frames++<900)window.__probe.step(1);window.__probe.step(150);var final=window.__probe.now();if(final.phase!=='ready'||final.shot!==1||final.cameraFollow>.1)throw Error('次の投球へ戻れない');
  await fetch('/__done',{method:'POST',body:JSON.stringify({models:true,score:final.score,follow:follow,returned:final.cameraFollow})});
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
