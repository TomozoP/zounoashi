/* 実ブラウザで立体・投影と判定位置・録画元の合成画面を確認する。 */
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),cp=require('child_process');
const root=path.resolve(__dirname,'../../..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'koe-balloon-3d-'));
let child,timer,finished=false;
const hook=`window.__check={scene:function(){return scene3d;},setup:function(height,amount){
  H=height;canvas.width=540;canvas.height=H;newRound();air=amount;py=H*.54;
  gates=[{x:320,top:py-220,bottom:py+140}];draw();
},intro:function(){state=S.INTRO;draw();},result:function(){state=S.RESULT;draw();},
voice:function(v){level=v;draw();},crash:function(){gates=[{x:140,top:py-65,bottom:H}];update(1/60);draw();}};`;
const runner=`<script>window.__recordManual=true;(async()=>{try{
function check(ok,msg){if(!ok)throw Error(msg);}
const c=document.getElementById('c'),p=window.__probe,t=window.__check;
check(t.scene(),'立体描画が起動しない');const scene=t.scene();
for(const height of [780,1130,1700]){
  t.setup(height,.5);const state=p.now();
  check(state.threeD,'立体描画の状態');
  check(scene.renderer.info.render.triangles>1000,'模型が描かれない');
  check(scene.renderer.info.render.calls<100,'描画回数が多すぎる');
  const projected=scene.person.position.clone().project(scene.camera);
  check(Math.abs((projected.x+1)*270-155)<.01,'人物の横位置');
  check(Math.abs((1-projected.y)*height/2-state.y)<.01,'人物の縦位置');
  const box=new THREE.Box3().setFromObject(scene.gateModels[0].root);
  check(Math.abs(box.min.x-320)<1&&Math.abs(box.max.x-378)<1,'柱の横幅と判定の不一致');
  const pixel=c.getContext('2d').getImageData(330,30,1,1).data;
  check(pixel[0]<150&&pixel[3]===255,'録画元の画面に柱が合成されていない');
}
t.setup(960,0);const small=scene.balloon.scale.x;t.setup(960,1);
check(scene.balloon.scale.x/small===4,'風船の大小が模型に反映されない');
t.setup(960,.5);
async function save(name){await fetch('/__image/'+name,{method:'POST',body:await new Promise(r=>c.toBlob(r))});}
await save('play.png');t.intro();await save('start.png');t.result();await save('result.png');
check(!document.getElementById('retry-button').hidden&&!document.getElementById('share-button').hidden,'結果の操作ボタン');
t.setup(960,.5);
const baseColor=scene.face.material.color.clone();t.voice(1);check(scene.face.material.color.equals(baseColor),'以前の顔色を保つ');
const mouth=scene.mouth.getWorldPosition(new THREE.Vector3());
check(scene.neck.position.y>mouth.y+25&&scene.rope.visible,'風船が頭上でひもにつながる');
await save('blow.png');
t.crash();check(p.now().state==='fall','衝突後に落下しない');check(!scene.balloon.visible,'破裂後も風船がある');
const before=p.now().doll[0].y;p.step(35);check(p.now().doll[0].y>before,'人が落下していない');await save('fall.png');
p.step(110);check(p.now().state==='result','落下後に結果へ移らない');
check(p.now().doll.every(j=>Number.isFinite(j.x)&&Number.isFinite(j.y)),'関節が壊れている');
await fetch('/__done',{method:'POST',body:'3種類の縦横比・立体の投影位置・4倍の風船・柱への衝突・録画画面の合成を確認'});
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
  child=cp.spawn(exe,['--headless=new','--no-first-run','--no-default-browser-check','--enable-unsafe-swiftshader','--window-size=430,930','--user-data-dir='+path.join(out,'profile'),'http://127.0.0.1:'+server.address().port+'/games/_koe-balloon/index.html?recorder-cli=1'],{stdio:'ignore',windowsHide:true});
  child.on('error',e=>finish(1,e.message));timer=setTimeout(()=>finish(1,'時間切れ'),30000);
});
