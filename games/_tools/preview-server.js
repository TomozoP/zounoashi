/* ローカル配信とMP4保存係をまとめて起動する。既存の配信はそのまま使う。 */
const http=require('http'),fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'../..');
let checking=false,child=null;
function ensureRecorder(){
  if(checking)return;
  checking=true;
  const request=http.get({host:'127.0.0.1',port:8736,path:'/health',headers:{Origin:'http://127.0.0.1:8735'},timeout:2000},res=>{
    res.resume();checking=false;
    if(res.statusCode!==200)console.error('MP4保存係の準備を確認してください（FFmpegが必要です）');
  });
  request.on('timeout',()=>request.destroy());
  request.on('error',()=>{
    checking=false;
    if(child)return;
    child=cp.spawn(process.execPath,[path.join(__dirname,'record-server.js')],{windowsHide:true,stdio:'inherit'});
    child.on('error',e=>{console.error('MP4保存係を起動できません：'+e.message);child=null;});
    child.on('exit',()=>{child=null;});
  });
}
ensureRecorder();
setInterval(ensureRecorder,5000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.wav':'audio/wav','.mp4':'video/mp4','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{
  try{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    let file=path.resolve(root,'.'+pathname);
    const inside=p=>p.startsWith(root+path.sep);
    if((file!==root&&!inside(file))||pathname.split(/[\\/]/).some(p=>p.startsWith('.'))){res.writeHead(403);res.end();return;}
    if((await fs.promises.stat(file)).isDirectory())file=path.join(file,'index.html');
    file=await fs.promises.realpath(file);
    if(!inside(file)){res.writeHead(403);res.end();return;}
    const data=await fs.promises.readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:data);
  }catch(e){res.writeHead(e.code==='ENOENT'?404:400);res.end();}
});
server.on('error',e=>{
  if(e.code==='EADDRINUSE')console.log('8735番の既存配信を使います。MP4保存係も確認中です。');
  else{console.error(e);process.exitCode=1;}
});
server.listen(8735,'127.0.0.1',()=>console.log('ローカルプレビューとMP4保存係を起動しました：http://127.0.0.1:8735/'));
