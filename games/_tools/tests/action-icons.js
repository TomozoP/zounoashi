/* 全ゲームで共通アイコンを読み込み、既存の画面が落ちないか実ブラウザで確認。 */
var fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),cp=require('child_process');
var root=path.resolve(__dirname,'../../..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'action-icons-'));
var child,timer;
var runner=`<script>
(async function(){try{
var dirs=['_template','momotarogue','melos','wanko','macho','hato','gyaku-mizukiri','oushogi','type16oku','_random-bowling'];
var id=location.pathname.split('/')[2];await new Promise(r=>setTimeout(r,800));
if(window.__errors.length)throw Error(id+': '+window.__errors.join(','));
if(id==='type16oku'||id==='melos'){for(var b of document.querySelectorAll('button[aria-label]'))if(/もう一度|Xで/.test(b.getAttribute('aria-label'))&&!b.querySelector('svg'))throw Error('ボタンのアイコンなし');}
if(id!=='type16oku'){
 if(typeof window.zActionIcon!=='function')throw Error(id+': 共通アイコンなし');
 var c=document.createElement('canvas');c.width=400;c.height=100;var ctx=c.getContext('2d');ctx.fillStyle='#142a37';ctx.fillRect(0,0,400,100);ctx.fillStyle='#fff';
 if(!zActionIcon(ctx,'もう一度',100,50,36)||!zActionIcon(ctx,'Xでシェア',300,50,36)||zActionIcon(ctx,'開始',0,0,30))throw Error('アイコンの対象が違う');
 if(id==='_template')await fetch('/__save/アイコン.png',{method:'POST',body:await new Promise(r=>c.toBlob(r))});
}
var next=dirs.indexOf(id)+1;if(next<dirs.length)location.href='/games/'+dirs[next]+'/index.html';else await fetch('/__done',{method:'POST',body:'10画面の読み込み・アイコン・操作名：問題なし'});
}catch(e){await fetch('/__fail',{method:'POST',body:e.stack});}})();</script>`;
var server=http.createServer(function(req,res){
  var u=decodeURIComponent(req.url.split('?')[0]);
  if(u.startsWith('/__')){var parts=[];req.on('data',function(b){parts.push(b);});req.on('end',function(){var data=Buffer.concat(parts);res.end('ok');if(u.startsWith('/__save/'))fs.writeFileSync(path.join(out,path.basename(u)),data);else finish(u==='/__done'?0:1,data.toString());});return;}
  var file=path.resolve(root,'.'+u);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try {var data=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'application/json');
    if(file.endsWith('.html'))data=data.toString().replace('<head>','<head><script>window.__errors=[];window.addEventListener("error",function(e){window.__errors.push(e.message);});</script>').replace('</body>',runner+'</body>');
    res.end(data);
  }catch(e){res.writeHead(404);res.end();}
});
function finish(code,message){clearTimeout(timer);if(child)child.kill();server.close();console.log(message);console.log(out);process.exit(code);}
server.listen(0,'127.0.0.1',function(){
  var exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  if(!exe)return finish(1,'ブラウザが見つからない');
  child=cp.spawn(exe,['--headless=new','--no-first-run','--no-default-browser-check','--enable-unsafe-swiftshader','--window-size=540,1080','--user-data-dir='+path.join(out,'profile'),'http://127.0.0.1:'+server.address().port+'/games/_template/index.html'],{stdio:'ignore'});
  child.on('error',function(e){finish(1,e.message);});timer=setTimeout(function(){finish(1,'時間切れ');},90000);
});
