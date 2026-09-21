/* 実ブラウザで撮影条件の保存と再利用、未対応条件での失敗を確認する。 */
const assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zounoashi-thumb-'));
fs.mkdirSync(path.join(root, 'games/_tools'), {recursive:true});
fs.mkdirSync(path.join(root, 'games/_sample'), {recursive:true});
for (const name of ['thumb.js','thumb-options.js','workflow.js','browser-stop.js']) fs.copyFileSync(path.join(__dirname, '..', name), path.join(root, 'games/_tools', name));
const page = path.join(root, 'games/_sample/index.html'), record = path.join(root, 'games/_sample/_制作.json');
fs.writeFileSync(page, '<html><head></head><body><canvas width="540" height="900"></canvas><script>window.__thumbnail=function(p){if(p.camera!=="front"||p.numbers!==false)throw Error("条件の不一致");var c=document.querySelector("canvas").getContext("2d");c.fillStyle="#2a6";c.fillRect(0,0,540,900);c.fillStyle="#fd5";c.fillRect(180,90,180,170);};</script></body></html>');
fs.writeFileSync(record, JSON.stringify({materials:[], thumbnail:{setup:{camera:'front',numbers:false}}}));
function run(args) {return cp.spawnSync(process.execPath, [path.join(root, 'games/_tools/thumb.js'), 'sample', ...args], {encoding:'utf8', timeout:60000, windowsHide:true});}
let r = run(['-t','0','-k','なし','--save-preset']);
assert.equal(r.status, 0, r.stdout + r.stderr);
const preset = JSON.parse(fs.readFileSync(record)).thumbnail;
assert.equal(preset.seconds, 0); assert.equal(preset.key, null); assert.equal(preset.setup.camera, 'front');
const output = path.join(root, 'games/_sample/img/thumb.webp');
const first = fs.readFileSync(output);
assert.equal(first.subarray(0,4).toString(), 'RIFF'); assert.equal(first.subarray(8,12).toString(), 'WEBP');
r = run([]); assert.equal(r.status, 0, r.stdout + r.stderr); assert.deepEqual(fs.readFileSync(output), first);
fs.writeFileSync(page, '<html><head></head><body><canvas width="540" height="900"></canvas></body></html>');
const before = fs.readFileSync(record, 'utf8');
r = run(['-t','1','--save-preset']); assert.notEqual(r.status, 0); assert(r.stdout.includes('__thumbnail'));
assert.equal(fs.readFileSync(record, 'utf8'), before); assert.deepEqual(fs.readFileSync(output), first);
console.log('撮影・条件の保存と再利用・未対応条件の拒否・失敗時の保持: 通過');
console.log(output);
