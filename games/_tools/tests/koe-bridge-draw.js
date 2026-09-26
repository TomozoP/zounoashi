/* 実ブラウザで立体・投影と判定位置・録画元の合成画面を確認する。 */
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),cp=require('child_process');
const root=path.resolve(__dirname,'../../..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'koe-bridge-3d-'));
let child,timer,finished=false;
const hook=`window.__check={setup:function(height){H=height;canvas.width=540;canvas.height=H;newRound();state=S.INTRO;draw();},win:function(){newRound();held=true;},draw:draw};`;
const runner=`<script>window.__recordManual=true;(async()=>{try{
const c=document.getElementById('c'),p=window.__probe,t=window.__check;
async function save(name){await fetch('/__image/'+name,{method:'POST',body:await new Promise(r=>c.toBlob(r))});}
for(const h of [700,1130,1700]){t.setup(h);await save('start-'+h+'.png');t.win();p.step(900);if(!p.now().won)throw Error('平らな橋で渡れない');if(p.now().state!=='result')throw Error('結果が出ない');await save('win-'+h+'.png');}
await fetch('/__done',{method:'POST',body:'橋・車の通過・録画元の画面を3種類で確認'});
}catch(e){await fetch('/__fail',{method:'POST',body:e.stack});}})();</script>`;
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
  child=cp.spawn(exe,['--headless=new','--no-first-run','--no-default-browser-check','--enable-unsafe-swiftshader','--window-size=430,930','--user-data-dir='+path.join(out,'profile'),'http://127.0.0.1:'+server.address().port+'/games/_koe-bridge/index.html?recorder-cli=1'],{stdio:'ignore',windowsHide:true});
  child.on('error',e=>finish(1,e.message));timer=setTimeout(()=>finish(1,'時間切れ'),30000);
});
