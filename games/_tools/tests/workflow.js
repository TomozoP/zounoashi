/* 失敗時の保持・参照の検出・撮影条件・配信内容の不一致を確認する。 */
const assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const w = require('../workflow'), apply = require('../transaction'), options = require('../thumb-options'), {verify} = require('../verify-deploy');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zounoashi-workflow-'));
const file = path.join(dir, 'original.txt');
fs.writeFileSync(file, '元の内容');
assert.throws(() => apply([{file, data: '変更後'}, {file: path.join(dir, 'new/data.txt'), data: '追加'}], null, (f, d) => {
  if (f.endsWith('data.txt')) throw Error('書き込み失敗');
  fs.writeFileSync(f, d);
}));
assert.equal(fs.readFileSync(file, 'utf8'), '元の内容');
assert(!fs.existsSync(path.join(dir, 'new')));
assert.throws(() => apply([{file, data: '変更後'}], {from: path.join(dir, 'missing'), to: path.join(dir, 'destination')}));
assert.equal(fs.readFileSync(file, 'utf8'), '元の内容');
fs.writeFileSync(path.join(dir, 'index.html'), '<script src="shared.js"></script><img src="missing.webp">');
fs.writeFileSync(path.join(dir, 'shared.js'), '/* <script src="example.js"></script> */');
const refs = w.references(dir, [path.join(dir, 'index.html')]);
assert.deepEqual(refs.missing, ['missing.webp']);
assert.equal(refs.files.length, 2);
assert.throws(() => w.inside(dir, '../outside'));
assert.throws(() => w.game('../x', dir));
let p = options({seconds: 9, query: 'scene=3', setup: {numbers: false, camera: 'front'}}, ['-t', '4', '--save-preset']);
assert.equal(p.preset.seconds, 4); assert.equal(p.preset.query, 'scene=3'); assert.equal(p.preset.setup.numbers, false); assert(p.save);
assert.equal(options({}, ['-k', 'なし']).preset.key, null);
assert.throws(() => options({}, ['-t', 'NaN']));
assert.throws(() => options({}, ['--toph', '540']));
assert.throws(() => options({}, ['--query']));
assert.equal(w.materials(dir, {}).length, 0);
fs.writeFileSync(path.join(dir, 'image.webp'), '素材');
assert.equal(w.materials(dir, {}).length, 1);
assert.equal(w.materials(dir, {materials: [{file: 'image.webp', source: '自作', license: '自作', redistribution: true}]}).length, 0);
(async function() {
  let calls = 0;
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/good.html')) res.end('本文\r\n');
    else if (req.url.startsWith('/retry.html')) res.end(++calls === 1 ? '古い内容' : '本文\n');
    else if (req.url.startsWith('/old.html')) res.end('古い内容');
    else {res.writeHead(404); res.end();}
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const base = 'http://127.0.0.1:' + server.address().port + '/';
    assert.deepEqual(await verify([{name:'good.html', data:Buffer.from('本文\n')}], base), []);
    assert.equal((await verify([{name:'old.html', data:Buffer.from('本文\n')}], base)).length, 1);
    assert.equal((await verify([{name:'missing.webp', data:Buffer.from('画像')}], base)).length, 1);
    assert.deepEqual(await verify([{name:'retry.html', data:Buffer.from('本文\n')}], base, 2, 1), []);
    assert.equal(calls, 2);
    console.log('途中失敗の復旧・参照先・素材記録・撮影条件・配信の一致／古い内容／欠落／再確認: 通過');
  } finally {server.close();}
})().catch(e => {console.error(e); process.exitCode = 1;});
