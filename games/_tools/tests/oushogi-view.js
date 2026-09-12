/* 実ブラウザで五つの場面を撮り、絵と読み込みを確かめる。出力は一時置き場。 */
var fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),os=require('os');
var root=path.resolve(__dirname,'../../..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'oushogi-'));
var browser=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
if(!browser)throw Error('ブラウザがありません');
var script=`<script>
window.addEventListener('load',async function(){
 try {
  await document.fonts.ready;
  var cv=document.getElementById('c'),p=window.__probe;
  var sheet=document.createElement('canvas');sheet.width=540*5;sheet.height=p.now().H;
  var ink=sheet.getContext('2d'),index=0;
  function shot(){ink.drawImage(cv,index++*540,0,540,sheet.height);}
  function press(){window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space'}));window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space'}));}
  p.step(1);shot();
  var rand=Math.random;Math.random=function(){return .1;};press();Math.random=rand;
  p.step(15);press();press();press();
  var start=performance.now();p.step(23);shot();p.step(47);shot();p.step(220);shot();p.step(60);shot();
  if(p.now().state!=='result')throw Error('結果に到達しません');
  await fetch('/__save',{method:'POST',body:JSON.stringify({image:sheet.toDataURL('image/png'),ms:performance.now()-start})});
 }catch(e){await fetch('/__fail',{method:'POST',body:String(e.stack||e)});}
});</script>`;
var child,timer;
function finish(code){clearTimeout(timer);if(child)child.kill();server.close();process.exitCode=code;}
var server=http.createServer(function(req,res){
 if(req.url==='/__save'||req.url==='/__fail'){
  var parts=[];req.on('data',d=>parts.push(d));req.on('end',function(){
   var raw=Buffer.concat(parts).toString();res.end('ok');
   if(req.url==='/__fail'){console.error(raw);finish(1);return;}
   var data=JSON.parse(raw),target=path.join(out,'五場面.png');
   fs.writeFileSync(target,Buffer.from(data.image.split(',')[1],'base64'));
   console.log(target);console.log('350コマの実描画: '+Math.round(data.ms)+'ミリ秒');finish(0);
  });return;
 }
 var file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/javascript; charset=utf-8');
 if(file.endsWith('/index.html')||file.endsWith('\\index.html')){
  res.end(fs.readFileSync(file,'utf8').replace('<head>','<head><script>window.requestAnimationFrame=function(){};</script>').replace('</body>',script+'</body>'));
 }else res.end(fs.readFileSync(file));
});
server.listen(0,'127.0.0.1',function(){
 child=cp.spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--window-size=430,900','--user-data-dir='+path.join(out,'browser'),'http://127.0.0.1:'+server.address().port+'/games/oushogi/index.html'],{stdio:'ignore',windowsHide:true});
 child.on('error',function(e){console.error(e.message);finish(1);});
 timer=setTimeout(function(){console.error('撮影が時間切れになりました');finish(1);},30000);
});
