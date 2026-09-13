/* 実ブラウザで画像の読み込み・衣・開始操作・保存用画像を確認する。 */
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),cp=require('child_process');
const root=path.resolve(__dirname,'../../..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'karaage-check-'));
const page=process.argv[2]||'/games/_karaage/index.html';
let child,timer;
const hook=`window.__test={original:original,fried:fried,exported:exported,accept:acceptImage};`;
const runner=`<script>
window.__recordManual=true;
(async function(){
function check(ok,msg){if(!ok)throw Error(msg);}
function key(type){window.dispatchEvent(new KeyboardEvent(type,{key:' ',code:'Space',bubbles:true}));}
async function shot(name){window.__probe.step(1);await fetch('/__save/'+name,{method:'POST',body:await new Promise(r=>document.getElementById('c').toBlob(r))});}
async function input(white){var c=document.createElement('canvas');c.width=500;c.height=400;var q=c.getContext('2d');if(white){q.fillStyle='white';q.fillRect(0,0,500,400);}q.fillStyle='#254e83';q.fillRect(100,80,300,240);q.fillStyle='#79a4d8';q.beginPath();q.arc(250,150,62,0,Math.PI*2);q.fill();q.clearRect(230,245,40,45);return new File([await new Promise(r=>c.toBlob(r))],'試験.png',{type:'image/png'});}
try{
const p=window.__probe,t=window.__test;
check(p.now().state==='intro','待機画面でない');p.step(120);check(p.now().seconds===0,'開始前に進んだ');
document.dispatchEvent(new PointerEvent('pointerdown',{pointerId:3,isPrimary:true,button:0,bubbles:true}));document.dispatchEvent(new PointerEvent('pointercancel',{pointerId:3,bubbles:true}));check(p.now().state==='intro','取消で始まった');
document.dispatchEvent(new PointerEvent('pointerdown',{pointerId:4,isPrimary:true,button:0,bubbles:true}));document.dispatchEvent(new PointerEvent('pointerup',{pointerId:4,isPrimary:true,button:0,bubbles:true}));check(p.now().state==='play','指離しで始まらない');check(p.now().seconds===0,'開始操作が流れた');
await shot('開始.png');key('keydown');check(p.now().state==='play','押した瞬間に揚げた');key('keyup');p.step(480);check(p.now().state==='frying','揚げていない');await shot('星を揚げる.png');key('keydown');key('keyup');p.step(45);check(p.now().state==='result','引き上げられない');await shot('星の唐揚げ.png');check(t.exported.width===1080,'保存画像の大きさ');
await t.accept(await input(false));check(p.now().state==='play','画像選択で戻らない');check(p.now().imageWidth===300&&p.now().imageHeight===240,'透明余白を詰めない');await shot('写真を選ぶ.png');
const orig=t.original.getContext('2d').getImageData(0,0,300,240).data;
key('keydown');key('keyup');p.step(480);const fried=t.fried.getContext('2d').getImageData(0,0,300,240).data;var changed=0,visible=0;
for(var i=0;i<orig.length;i+=4){check(orig[i+3]===fried[i+3],'透明度が変わった');if(orig[i+3]){visible++;if(Math.abs(orig[i]-fried[i])>20)changed++;}}
check(changed/visible>.8,'画像が衣に変わらない');check(fried[(20*300+20)*4]>fried[(20*300+20)*4+2],'揚げ色でない');await shot('写真を揚げる.png');
key('keydown');key('keyup');p.step(45);await shot('写真の唐揚げ.png');
await fetch('/__save/保存.png',{method:'POST',body:await new Promise(r=>t.exported.toBlob(r))});
await t.accept(await input(true));check(p.now().imageWidth===300,'単色背景が抜けない');
await t.accept(new File(['invalid'],'壊れた.png',{type:'image/png'}));check(!p.now().busy&&!document.getElementById('error').hidden,'壊れた画像から戻れない');
key('keydown');key('keyup');p.step(1200);check(p.now().state==='result'&&p.now().seconds===18,'18秒で自動引き上げしない');
window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));check(p.now().state==='play'&&p.now().seconds===0,'Escで戻れない');
for(var [w,h] of [[375,667],[390,844],[820,1180],[700,700],[320,1000]]){Object.defineProperty(window,'innerWidth',{value:w,configurable:true});Object.defineProperty(window,'innerHeight',{value:h,configurable:true});window.dispatchEvent(new Event('resize'));var n=p.now();check(n.H>=780&&n.H<=1700,'高さの範囲');var buttons=['pick','act','save'].map(id=>document.getElementById(id).getBoundingClientRect());for(var i=1;i<buttons.length;i++)check(buttons[i].left-buttons[i-1].right>=20,'ボタンが近い');await shot('画面-'+w+'x'+h+'.png');}
await fetch('/__done',{method:'POST',body:JSON.stringify({pixelsChanged:changed,visiblePixels:visible,alphaPreserved:true,states:true,export:1080,sizes:5})});
}catch(e){await fetch('/__fail',{method:'POST',body:e.stack});}
})();</script>`;
const server=http.createServer((req,res)=>{
const u=decodeURIComponent(req.url.split('?')[0]);
if(u.startsWith('/__')){let parts=[];req.on('data',b=>parts.push(b));req.on('end',()=>{let b=Buffer.concat(parts);res.end('ok');if(u.startsWith('/__save/'))fs.writeFileSync(path.join(out,path.basename(u)),b);else finish(u==='/__done'?0:1,b.toString());});return;}
const f=path.resolve(root,'.'+u);if(!f.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}try{let data=fs.readFileSync(f);res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'image/png');if(u===page)data=data.toString().replace('/* ============ ループ ============ */',hook+'\n/* ============ ループ ============ */').replace('</body>',runner+'</body>');res.end(data);}catch(e){res.writeHead(404);res.end();}
});
function finish(code,msg){clearTimeout(timer);if(child)child.kill();server.close();console.log(msg);console.log(out);process.exit(code);}
server.listen(0,'127.0.0.1',()=>{let exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);if(!exe)return finish(1,'ブラウザが見つからない');child=cp.spawn(exe,['--headless=new','--no-first-run','--no-default-browser-check','--window-size=430,930','--user-data-dir='+path.join(out,'profile'),'http://127.0.0.1:'+server.address().port+page],{stdio:'ignore',windowsHide:true});child.on('error',e=>finish(1,e.message));timer=setTimeout(()=>finish(1,'時間切れ'),55000);});
