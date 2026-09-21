/* 新作の記録欄・題名の記号・素材記録の追記を、一時的な置き場所で確認する。 */
const assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), vm = require('vm');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zounoashi-creation-'));
fs.mkdirSync(path.join(root, 'games/_tools'), {recursive:true});
fs.mkdirSync(path.join(root, 'games/_template'), {recursive:true});
for (const name of ['new.js','materials.js','workflow.js']) fs.copyFileSync(path.join(__dirname, '..', name), path.join(root, 'games/_tools', name));
fs.copyFileSync(path.join(__dirname, '../../_template/index.html'), path.join(root, 'games/_template/index.html'));
const title = '題名 "引用" </script> */ $&', note = '説明 "引用"\n改行';
function run(name, args) { const r = cp.spawnSync(process.execPath, [path.join(root, 'games/_tools', name), ...args], {encoding:'utf8', windowsHide:true}); assert.equal(r.status, 0, r.stderr); }
run('new.js', ['sample', title, note]);
let c = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'games/_local.js'), 'utf8'), c);
assert.equal(c.window.DRAFT_GAMES[0].title, title); assert.equal(c.window.DRAFT_GAMES[0].catch, note);
const html = fs.readFileSync(path.join(root, 'games/_sample/index.html'), 'utf8');
assert(html.includes('&lt;/script&gt;'));
for (const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
const record = path.join(root, 'games/_sample/_制作.json');
assert.equal(JSON.parse(fs.readFileSync(record)).expressionReviewed, false);
fs.writeFileSync(path.join(root, 'games/_sample/img/sample.webp'), '確認用');
run('materials.js', ['sample']);
let config = JSON.parse(fs.readFileSync(record));
assert.equal(config.materials.length, 1); assert.equal(config.materials[0].redistribution, false);
config.materials[0].source = '自作の確認用'; fs.writeFileSync(record, JSON.stringify(config));
run('materials.js', ['sample']);
config = JSON.parse(fs.readFileSync(record));
assert.equal(config.materials.length, 1); assert.equal(config.materials[0].source, '自作の確認用');
console.log('新作の雛形・記号を含む題名と説明・素材記録の追記と保持: 通過');
