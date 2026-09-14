/* 実ブラウザで画像の読み込み・衣・開始操作・保存用画像を確認する。 */
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),cp=require('child_process');
const root=path.resolve(__dirname,'../../..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'karaage-check-'));
const page=process.argv[2]||'/games/karaage/index.html';
let child,timer;
const hook=`window.__test={original:original,fried:fried,exported:exported,accept:acceptImage,finishCut:finishCut,makeExport:makeExport};`;
const runner=`<script>
window.__recordManual=true;
(async function(){try{
function check(ok,msg){if(!ok)throw Error(msg);}
const p=window.__probe,t=window.__test;
for(let i=0;i<100&&p.now().busy;i++)await new Promise(r=>setTimeout(r,20));
check(!p.now().busy&&p.now().imageWidth>100,'初期画像を読み込めない');
function key(){window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space'}));}
key();p.step(600);check(p.now().oil&&p.now().seconds>9,'揚げられない');key();check(!p.now().oil&&p.now().steam>0,'引き上げられない');
t.makeExport();check(t.exported.width===1080,'保存寸法');
await fetch('/__save/唐揚げ.png',{method:'POST',body:await new Promise(r=>document.getElementById('c').toBlob(r))});
document.getElementById('tempura-mode').click();
for(let i=0;i<100&&p.now().busy;i++)await new Promise(r=>setTimeout(r,20));
check(p.now().mode==='tempura'&&!p.now().busy&&p.now().seconds===0,'天ぷら切り替え');key();p.step(600);key();
await fetch('/__save/天ぷら.png',{method:'POST',body:await new Promise(r=>document.getElementById('c').toBlob(r))});
await fetch('/__done',{method:'POST',body:'初期画像・両モードの加熱と引き上げ・保存寸法を確認'});
}catch(e){await fetch('/__fail',{method:'POST',body:e.stack});}})();</script>`;
const server=http.createServer((req,res)=>{
const u=decodeURIComponent(req.url.split('?')[0]);
if(u.startsWith('/__')){let parts=[];req.on('data',b=>parts.push(b));req.on('end',()=>{let b=Buffer.concat(parts);res.end('ok');if(u.startsWith('/__save/'))fs.writeFileSync(path.join(out,path.basename(u)),b);else finish(u==='/__done'?0:1,b.toString());});return;}
const f=path.resolve(root,'.'+u);if(!f.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}try{let data=fs.readFileSync(f);res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'image/png');if(u===page)data=data.toString().replace('/* ============ ループ ============ */',hook+'\n/* ============ ループ ============ */').replace('</body>',runner+'</body>');res.end(data);}catch(e){res.writeHead(404);res.end();}
});
function finish(code,msg){clearTimeout(timer);if(child)child.kill();server.close();console.log(msg);console.log(out);process.exit(code);}
server.listen(0,'127.0.0.1',()=>{let exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);if(!exe)return finish(1,'ブラウザが見つからない');child=cp.spawn(exe,['--headless=new','--no-first-run','--no-default-browser-check','--window-size=430,930','--user-data-dir='+path.join(out,'profile'),'http://127.0.0.1:'+server.address().port+page],{stdio:'ignore',windowsHide:true});child.on('error',e=>finish(1,e.message));timer=setTimeout(()=>finish(1,'時間切れ'),55000);});
