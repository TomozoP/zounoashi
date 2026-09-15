/* 自作曲の波形と、再挑戦時に重複しないことを確認する。 */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const scope={SharkMusic:new Function(fs.readFileSync('games/shark-walk/music.js','utf8')+';return SharkMusic;')()};
let channels=[],sources=0,starts=0,stops=0,loop=false;
const ac={state:'running',destination:{},createBuffer(c,n,rate){assert.equal(c,2);assert.equal(n/rate,48);channels=Array.from({length:c},()=>new Float32Array(n));return{getChannelData(i){return channels[i];}};},createBufferSource(){sources++;return{connect(){},disconnect(){},start(){starts++;loop=this.loop;},stop(){stops++;}};}};
const music=scope.SharkMusic(ac);assert.equal(sources,0,'開始前には再生しない');
music.start();music.start();assert.equal(starts,1,'入力を重ねても曲を重複させない');assert(loop);
let peak=0;for(const data of channels){let energy=0;for(const x of data){assert(Number.isFinite(x));peak=Math.max(peak,Math.abs(x));energy+=x*x;}assert(energy/data.length>.00001,'無音になっていない');for(let i=0;i<48;i++){let e=0;for(let j=i*22050;j<(i+1)*22050;j++)e+=data[j]*data[j];assert(e>0.01,'途中で曲が途切れない');}assert(Math.abs(data[0]-data[data.length-1])<.05,'繰り返し境界で大きく飛ばない');}
assert(peak<=.281,'音割れを避ける');music.stop();assert.equal(stops,1);music.start();assert.equal(starts,2);music.stop();ac.state='closed';music.start();assert.equal(starts,2);
console.log('48秒・左右の音・波形・繰り返し・重複防止：確認済み、最大振幅 '+peak.toFixed(3));
