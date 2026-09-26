/* 実ブラウザで立体・投影と判定位置・録画元の合成画面を確認する。 */
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),cp=require('child_process');
const root=path.resolve(__dirname,'../../..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'koe-balloon-3d-'));
let child,timer,finished=false;
const hook=`window.__check={scene:function(){return scene3d;},setup:function(height,amount){
  H=height;canvas.width=540;canvas.height=H;newRound();wings=[amount,-amount];py=H*.68;
  gates=[{height:300,left:130,right:350,passed:false}];draw();
},intro:function(){state=S.INTRO;draw();},result:function(){state=S.RESULT;draw();},
pose:function(){
 camera=new window.WingInput();var source=document.createElement('canvas');source.width=100;source.height=140;
 var c=source.getContext('2d');c.fillStyle='#ff00cc';c.fillRect(0,0,100,140);camera.video=source;
 var points=Array.from({length:33},function(){return {x:.5,y:.4};});points[0].y=.2;points[11].x=.23;points[12].x=.77;
 camera.capture({segmentationMasks:[{width:2,height:2,getAsFloat32Array:function(){return new Float32Array([1,0,1,0]);}}]},points,100,140,.54);
 var pixel=camera.portrait.getContext('2d').getImageData(95,70,1,1).data;if(pixel[3]!==0)throw Error('背景が切り抜かれない');
 camera.video=null;camera.crop={x:0,y:0,w:100,h:140,cx:25,cy:50,scale:.54};draw();
},crash:function(){gates=[{height:0,left:400,right:520,passed:false}];update(1/60);draw();}};`;
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
  check(Math.abs((projected.x+1)*270-270)<.01,'人物の横位置');
  check(Math.abs((1-projected.y)*height/2-state.y)<.01,'人物の縦位置');
  const box=new THREE.Box3().setFromObject(scene.gateModels[0].root);
  check(Math.abs(box.max.y-box.min.y-40)<1,'横向きの障害物の厚み');
  check(scene.wings.length===2,'左右の翼がない');
  const pixel=c.getContext('2d').getImageData(50,Math.round(height*.68-300),1,1).data;
  check(pixel[0]<150&&pixel[3]===255,'録画元の画面に柱が合成されていない');
}
t.setup(960,1);check(scene.wings[0].rotation.z===-1&&scene.wings[1].rotation.z===-1,'腕ごとの翼の角度');
t.setup(960,.5);
async function save(name){await fetch('/__image/'+name,{method:'POST',body:await new Promise(r=>c.toBlob(r))});}
await save('play.png');t.intro();await save('start.png');t.result();await save('result.png');
check(!document.getElementById('retry-button').hidden&&!document.getElementById('share-button').hidden,'結果の操作ボタン');
t.setup(960,.5);
t.pose();check(!scene.placeholder.visible,'映像があるのに仮の人物が残る');
const portraitPixel=c.getContext('2d').getImageData(270,Math.round(960*.68),1,1).data;
check(portraitPixel[0]===255&&portraitPixel[2]===204,'本人の映像が録画元へ合成されない');await save('portrait.png');
t.crash();check(p.now().state==='fall','衝突後に落下しない');
const before=p.now().fallen.y;p.step(35);check(p.now().fallen.y>before,'人が落下していない');await save('fall.png');
p.step(110);check(p.now().state==='result','落下後に結果へ移らない');
check(Number.isFinite(p.now().fallen.angle),'顔の落下が壊れている');
${process.argv.includes('--model')?`
const source=document.createElement('canvas');source.width=320;source.height=240;
const fill=source.getContext('2d');fill.fillStyle='#8899aa';fill.fillRect(0,0,320,240);
const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia=async()=>source.captureStream(10);
const faceTest=new window.WingInput();await faceTest.start();
check(faceTest.status==='active','公式の姿勢判定モデルを起動できない');
faceTest.tick(performance.now());check(faceTest.status==='active'&&faceTest.previousFrame>=0,'試験映像の姿勢判定が実行されない');check(!faceTest.found,'顔のない画像を顔と判定');faceTest.stop();navigator.mediaDevices.getUserMedia=original;
`:''}
await fetch('/__done',{method:'POST',body:'翼と本人映像の表示・上方向の障害物・衝突・録画画面を確認'+(${process.argv.includes('--model')}?'。公式モデルを読み込み、試験映像の判定も確認':'')});
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
  child.on('error',e=>finish(1,e.message));timer=setTimeout(()=>finish(1,'時間切れ'),60000);
});
