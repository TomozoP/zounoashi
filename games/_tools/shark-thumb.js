/* 本体は変えず、撮影する画面だけ脚二本と車輪二個の構成にする。 */
const fs=require('fs'),path=require('path'),read=fs.readFileSync;
fs.readFileSync=function(file,...args){let s=read.call(fs,file,...args);if(typeof s==='string'&&/games[\\/]_?shark-walk[\\/]index\.html$/.test(String(file))){s=s.replace('leftArm:"arm",rightArm:"arm"','leftArm:"wheel",rightArm:"wheel"').replace('ctx.globalAlpha=.7;leg(1);arm(1);ctx.globalAlpha=1;','ctx.save();ctx.translate(35,-8);ctx.globalAlpha=.85;leg(1);arm(1);ctx.restore();');}return s;};
process.argv=[process.argv[0],path.join(__dirname,'thumb.js'),'shark-walk','-k','なし','-t','1','--top','290','--toph','540'];
require('./thumb');
