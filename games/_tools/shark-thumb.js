/* 本体は変えず、撮影する画面だけ脚二本と車輪二個の構成にする。 */
const fs=require('fs'),path=require('path'),read=fs.readFileSync;
fs.readFileSync=function(file,...args){let s=read.call(fs,file,...args);if(typeof s==='string'&&/games[\\/]_?shark-walk[\\/]index\.html$/.test(String(file))){s=s.replace('leftArm:"arm",rightArm:"arm"','leftArm:"wheel",rightArm:"wheel"').replace('ctx.globalAlpha=.7;leg(1);arm(1);ctx.globalAlpha=1;','ctx.save();ctx.translate(35,-8);ctx.globalAlpha=.85;leg(1);arm(1);ctx.restore();');s=s.replace('leg(0);arm(0);ctx.restore();','leg(0);arm(0);ctx.restore();return;');}return s;};
process.argv=[process.argv[0],path.join(__dirname,'thumb.js'),'shark-walk','-k','なし','-t','1','--top','290','--toph','540'];
// 画面の中央付近を正方形で切り取り、操作列を含めない。
const toolPath=path.join(__dirname,'thumb.js');
const source=read.call(fs,toolPath,'utf8').replace(
  'c.drawImage(s, 0, top.y * k, 540 * k, top.h * k, 0, 0, 600, top.h * 600 / 540);',
  'c.drawImage(s, 15*k, (s.height/k*.64-300)*k, 430*k, 430*k, 0, 0, 600, 600);'
);
new Function('require','__dirname',source)(require,__dirname);
