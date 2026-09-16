/* F9の録画を手元でMP4へ変換する。node games/_tools/record-server.js */
const http=require('http'),fs=require('fs'),path=require('path'),cp=require('child_process');
const folder=path.resolve(__dirname,'../_recordings');
fs.mkdirSync(folder,{recursive:true});
const exe=path.join(__dirname,'_bin/ffmpeg.exe');
const desktop=require('./record-folder')();
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
  const audioOnly=url.searchParams.get('audio')==='1';
  const take=url.searchParams.get('take');
  if(take&&!/^[a-z0-9-]{1,80}$/.test(take)){res.writeHead(400);res.end('録画番号が不正です');return;}
  const stem=path.join(folder,'capture-'+(take||Date.now()+'-'+Math.random().toString(16).slice(2))+(audioOnly?'-audio':''));
  const input=stem+'.webm',extension=audioOnly?'.wav':'.mp4',output=stem+extension;
  if(fs.existsSync(input)||fs.existsSync(output)){res.writeHead(409);res.end('同じ録画番号のファイルが存在します');return;}
  try{
    let total=0;const parts=[];
    for await(const part of req){total+=part.length;if(total>512*1024*1024)throw Error('録画が大きすぎます');parts.push(part);}
    fs.writeFileSync(input,Buffer.concat(parts));
    await new Promise(function(resolve,reject){
      // 録画の相対時刻を保ち、音声の隙間だけを補う。
      const videoArgs=['-y','-i',input,'-af','aresample=async=1','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r','60','-fps_mode','cfr','-c:a','aac','-b:a','192k','-movflags','+faststart',output];
      const audioArgs=['-y','-i',input,'-vn','-af','aresample=async=1','-c:a','pcm_s16le',output];
      const child=cp.spawn(exe,audioOnly?audioArgs:videoArgs,{windowsHide:true,stdio:'ignore'});
      child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('録画ファイルの変換に失敗しました')));
    });
    const id=(url.searchParams.get('game')||'game').replace(/[^a-z0-9-]/gi,'').slice(0,40)||'game';
    const saved=path.join(desktop,id+'-'+path.basename(stem)+extension);
    let result={saved:saved};
    try { fs.copyFileSync(output,saved,fs.constants.COPYFILE_EXCL); }
    catch(e) {
      // 変換済みの動画は残っている。複製先の失敗で録画全体を失敗扱いにしない。
      if(!['EPERM','EACCES','ENOENT','ENOSPC','EEXIST'].includes(e.code))throw e;
      result={saved:output,message:'デスクトップに保存できなかったため、ファイルを次の場所に保存しました：'+output};
    }
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify(result));
  }catch(e){res.writeHead(500);res.end(e.message);}
}).listen(8736,'127.0.0.1',()=>console.log('F9のMP4保存を受付中（8736）'));
