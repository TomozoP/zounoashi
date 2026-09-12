/* F9の録画を手元でMP4へ変換する。node games/_tools/record-server.js */
const http=require('http'),fs=require('fs'),path=require('path'),cp=require('child_process');
const folder=path.resolve(__dirname,'../_recordings');
fs.mkdirSync(folder,{recursive:true});
const exe=path.join(__dirname,'_bin/ffmpeg.exe');
http.createServer(async function(req,res){
  const origin=req.headers.origin||'';
  if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)){res.writeHead(403);res.end();return;}
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods','POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.end();return;}
  if(req.url==='/health'){res.writeHead(fs.existsSync(exe)?200:503);res.end('ok');return;}
  const url=new URL(req.url,'http://127.0.0.1');
  if(req.method!=='POST'||url.pathname!=='/convert'){res.writeHead(404);res.end();return;}
  const stem=path.join(folder,'capture-'+Date.now()+'-'+Math.random().toString(16).slice(2));
  const input=stem+'.webm',output=stem+'.mp4';
  try{
    let total=0;const parts=[];
    for await(const part of req){total+=part.length;if(total>512*1024*1024)throw Error('録画が大きすぎます');parts.push(part);}
    fs.writeFileSync(input,Buffer.concat(parts));
    await new Promise(function(resolve,reject){
      // 録画の相対時刻を保ち、音声の隙間だけを補う。
      const child=cp.spawn(exe,['-y','-i',input,'-af','aresample=async=1','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r','60','-fps_mode','cfr','-c:a','aac','-b:a','192k','-movflags','+faststart',output],{windowsHide:true,stdio:'ignore'});
      child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('MP4変換に失敗しました')));
    });
    res.setHeader('Content-Type','video/mp4');res.setHeader('Content-Length',fs.statSync(output).size);
    fs.createReadStream(output).pipe(res);
  }catch(e){res.writeHead(500);res.end(e.message);}
}).listen(8736,'127.0.0.1',()=>console.log('F9のMP4保存を受付中（8736）'));
