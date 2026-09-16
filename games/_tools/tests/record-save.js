/* 保存先の権限がなくても、変換済みの動画の場所を返すことを確認する。 */
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'../record-server.js'),'utf8');
async function check(code){
  let handler,body,status=200;
  const fakeFs={mkdirSync(){},existsSync(){return true;},writeFileSync(){},constants:{COPYFILE_EXCL:1},copyFileSync(){if(code)throw Object.assign(Error('保存先に書けません'),{code});}};
  const context={__dirname:path.resolve(__dirname,'..'),Buffer,URL,console:{log(){}},require(name){
    if(name==='fs')return fakeFs;
    if(name==='path')return path;
    if(name==='./record-folder')return ()=>path.resolve('desktop-test');
    if(name==='http')return {createServer(fn){handler=fn;return {listen(){}};}};
    if(name==='child_process')return {spawn(){return {on(event,fn){if(event==='exit')queueMicrotask(()=>fn(0));}};}};
    throw Error(name);
  }};
  vm.runInNewContext(source,context);
  await handler({headers:{origin:'http://127.0.0.1:8735'},method:'POST',url:'/convert?game=slot',async *[Symbol.asyncIterator](){yield Buffer.from('録画');}}, {setHeader(){},writeHead(n){status=n;},end(value){body=JSON.parse(value);}});
  assert.equal(status,200);
  assert.ok(body.saved.endsWith('.mp4'));
  if(code){assert.ok(body.saved.includes('_recordings'));assert.ok(body.message.includes(body.saved));}
  else {assert.ok(body.saved.includes('desktop-test'));assert.equal(body.message,undefined);}
}
(async()=>{for(const code of [null,'EPERM','EACCES','ENOENT','ENOSPC','EEXIST'])await check(code);console.log('通常保存と保存先エラー時の動画保全を確認。');})().catch(e=>{console.error(e);process.exitCode=1;});
