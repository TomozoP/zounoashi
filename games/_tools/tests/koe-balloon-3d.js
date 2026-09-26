/* 実ブラウザで立体・投影と判定位置・録画元の合成画面を確認する。 */
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),cp=require('child_process');
const root=path.resolve(__dirname,'../../..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'koe-balloon-3d-'));
let child,timer,finished=false;
const hook="window.__check={\nscene:function(){return scene3d;},\nsetup:function(height){H=height;canvas.width=540;canvas.height=H;newRound();draw();},\nstart:function(){state=S.INTRO;draw();},\necho:function(){history=Array.from({length:30},function(_,i){return {id:i+1,end:6,y:.5,worldX:2075,frames:Array.from({length:360},function(){return {y:.48+Math.sin(i)*.07,air:1};})};});T=2.1;replayStep(0);traps=[trapPosition(0,2.1)];hazards=[1,2].map(function(i){var h=hazardPosition(i,T);h.x=200+i*110;return h;});draw();},\ncrater:function(){gates=[{x:320,top:300,bottom:H-100,holes:[{x:29,y:100/H,r:50}]}];draw();},\ncrash:function(){popBalloon();draw();}\n};\r\n";
const runner="<script>window.__recordManual=true;(async()=>{try{\nconst c=document.getElementById('c'),p=window.__probe,t=window.__check;\nfunction check(ok,msg){if(!ok)throw Error(msg);}\nasync function save(name){await fetch('/__image/'+name,{method:'POST',body:await new Promise(r=>c.toBlob(r))});}\nfor(const height of [780,1130,1700]){\n t.setup(height);check(t.scene(),'立体描画が起動');t.start();await save('start-'+height+'.png');\n t.setup(height);t.echo();check(p.now().historyCount===30&&p.now().ghosts.length===26,'30体の履歴から画面内の26体を描画');await save('crowd-'+height+'.png');\n t.crater();const cut=c.getContext('2d').getImageData(349,100,1,1).data,solid=c.getContext('2d').getImageData(349,170,1,1).data;check(cut[1]>solid[1]+25,'円形の穴');t.crash();check(p.now().state==='dead'&&p.now().lives===99,'死亡時の停止');p.step(6);await save('death-'+height+'.png');p.step(12);check(p.now().state==='play','0.3秒後の再出発');await save('retry-'+height+'.png');\n}\nawait fetch('/__done',{method:'POST',body:'3画面で30体の履歴・弾・円形の穴・0.3秒後の交代・録画元の画面を確認'});\n}catch(e){await fetch('/__fail',{method:'POST',body:e.stack});}})();</script>\r\n";
const server=http.createServer((req,res)=>{
  const u=req.url.split('?')[0];
  if(u.startsWith('/__')){
    const parts=[];req.on('data',b=>parts.push(b));req.on('end',()=>{
      const b=Buffer.concat(parts);res.end('ok');
      if(u.startsWith('/__image/'))fs.writeFileSync(path.join(out,path.basename(u)),b);
      else finish(u==='/__done'?0:1,b.toString());
    });return;
  }
  const file=path.resolve(root,'.'+u);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{
    let b=fs.readFileSync(file);
    res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':'image/webp');
    if(file.endsWith('.html'))b=b.toString().replace('/* ============ ループ ============ */',hook+'\n/* ============ ループ ============ */').replace('</body>',runner+'</body>');
    res.end(b);
  }catch(e){res.writeHead(404);res.end();}
});
function finish(code,msg){
  if(finished)return;finished=true;clearTimeout(timer);if(child)child.kill();server.close();
  console.log(msg);console.log(out);process.exitCode=code;
}
server.listen(0,'127.0.0.1',()=>{
  const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  if(!exe)return finish(1,'ブラウザが見つからない');
  child=cp.spawn(exe,['--headless=new','--no-first-run','--no-default-browser-check','--enable-unsafe-swiftshader','--window-size=430,930','--user-data-dir='+path.join(out,'profile'),'http://127.0.0.1:'+server.address().port+'/games/_koe-balloon/index.html?recorder-cli=1'],{stdio:'ignore',windowsHide:true});
  child.on('error',e=>finish(1,e.message));timer=setTimeout(()=>finish(1,'時間切れ'),30000);
});
