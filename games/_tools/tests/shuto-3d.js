/* 実ブラウザで立体描画・手刀・倒れ方・見えている模型のクリックを確認する。 */
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),cp=require('child_process');
const root=path.resolve(__dirname,'../../..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'shuto-3d-'));
let child,timer;
const hook=`window.__check={scene:function(){return people3D;},setup:function(){newRound();people=people.slice(0,2);people[0].x=240;people[1].x=300;people.forEach(function(p){p.y=H/2;p.vx=p.vy=0;});attacker=0;victim=1;elapsed=0;draw();}};`;
const runner=`<script>window.__recordManual=true;(async()=>{try{
function check(ok,msg){if(!ok)throw Error(msg);}
const c=document.getElementById('c'),p=window.__probe,t=window.__check;
check(t.scene(),'3D描画が起動しない');t.setup();const scene=t.scene();
check(p.now().strikeVisible,'手刀が出ていない');
p.step(4);check(p.now().fallProgress===0,'受けた直後に倒れた');
p.step(5);check(p.now().fallProgress>0&&p.now().fallProgress<1,'途中の倒れ方');
check(Math.abs(scene.models[1].root.rotation.z)>.1,'模型が倒れていない');
p.step(6);check(p.now().fallProgress===1,'倒れきらない');
const s=p.now(),point=scene.models[0].root.localToWorld(new THREE.Vector3(0,54,0)).project(scene.camera);
const x=(point.x+1)*s.W/2,y=(1-point.y)*s.H/2;
check(scene.pick(x,y,s.W,s.H)===0,'模型のクリック位置がずれている');
const r=c.getBoundingClientRect();c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse',isPrimary:true,button:0,clientX:r.left+x/s.W*r.width,clientY:r.top+y/s.H*r.height}));
check(p.now().state==='success','見えている人物をクリックしても正解しない');
window.dispatchEvent(new KeyboardEvent('keydown',{key:'7'}));p.step(1);
check(scene.models.length===140,'140人の模型がない');
check(scene.renderer.info.render.calls<350,'同じ形をまとめて描けていない');
await fetch('/__image',{method:'POST',body:await new Promise(r=>c.toBlob(r))});
await fetch('/__done',{method:'POST',body:'立体人物・手刀・停止後の転倒・立体判定・140人の描画回数 '+scene.renderer.info.render.calls+' 回を確認'});
}catch(e){await fetch('/__fail',{method:'POST',body:e.stack});}})();</script>`;
const server=http.createServer((req,res)=>{
const u=req.url.split('?')[0];if(u.startsWith('/__')){let parts=[];req.on('data',b=>parts.push(b));req.on('end',()=>{const b=Buffer.concat(parts);res.end('ok');if(u==='/__image')fs.writeFileSync(path.join(out,'crowd.png'),b);else finish(u==='/__done'?0:1,b.toString());});return;}
const f=path.resolve(root,'.'+u);if(!f.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
try{let b=fs.readFileSync(f);res.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'image/webp');if(f.endsWith('.html'))b=b.toString().replace('/* ============ ループ ============ */',hook+'\n/* ============ ループ ============ */').replace('</body>',runner+'</body>');res.end(b);}catch(e){res.writeHead(404);res.end();}
});
function finish(code,msg){clearTimeout(timer);if(child)child.kill();server.close();console.log(msg);console.log(out);process.exitCode=code;}
server.listen(0,'127.0.0.1',()=>{const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);child=cp.spawn(exe,['--headless=new','--no-first-run','--no-default-browser-check','--enable-unsafe-swiftshader','--window-size=430,930','--user-data-dir='+path.join(out,'profile'),'http://127.0.0.1:'+server.address().port+'/games/shuto/index.html?recorder-cli=1'],{stdio:'ignore',windowsHide:true});child.on('error',e=>finish(1,e.message));timer=setTimeout(()=>finish(1,'時間切れ'),30000);});

