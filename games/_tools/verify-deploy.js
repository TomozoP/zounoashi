/* push と配信完了を分け、コミット済みの本体・素材・共有ページと配信内容を照合する。 */
const path = require('path'), cp = require('child_process'), crypto = require('crypto');
const w = require('./workflow');
function hash(data, name) {
  if (/\.(html|css|js|json|svg|txt)$/i.test(name)) data = Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n'));
  return crypto.createHash('sha256').update(data).digest('hex');
}
async function verify(expected, base, attempts = 1, pause = 5000) {
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol)) throw Error('確認先はHTTPのURLにしてください');
  let pending = expected.slice(), failures = [];
  for (let i = 0; i < attempts && pending.length; i++) {
    failures = [];
    /* 大量の素材で同時接続を増やさない。 */
    for (const item of pending) {
      try {
        const target = new URL(item.name.split('/').map(encodeURIComponent).join('/'), url);
        target.searchParams.set('verify', Date.now().toString());
        const res = await fetch(target, {signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store'});
        if (!res.ok) throw Error('HTTP ' + res.status);
        if (hash(Buffer.from(await res.arrayBuffer()), item.name) !== hash(item.data, item.name)) throw Error('コミットした内容と一致しません');
      } catch (e) { failures.push({item, reason: e.message}); }
    }
    pending = failures.map(f => f.item);
    if (pending.length && i + 1 < attempts) await new Promise(r => setTimeout(r, pause));
  }
  return failures.map(f => f.item.name + ': ' + f.reason);
}
module.exports = {verify, hash};
if (require.main === module) (async function() {
  const id = process.argv[2];
  w.game(id);
  let base = 'https://www.zounoashi.com/', attempts = 1;
  for (let i = 3; i < process.argv.length; i++) {
    if (process.argv[i] === '--base') base = process.argv[++i];
    else if (process.argv[i] === '--attempts') attempts = Number(process.argv[++i]);
    else throw Error('使い方: node games/_tools/verify-deploy.js <id> [--attempts 1〜6] [--base URL]');
  }
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 6) throw Error('確認回数は1〜6回です');
  function git(args, encoding) {
    const r = cp.spawnSync('git', ['-c', 'safe.directory=' + w.root.replace(/\\/g, '/'), ...args], {cwd: w.root, encoding, maxBuffer: 64 * 1024 * 1024, windowsHide: true});
    if (r.status !== 0) throw Error('コミットを読めません: ' + String(r.stderr));
    return r.stdout;
  }
  const rev = git(['rev-parse', 'HEAD'], 'utf8').trim();
  const tracked = git(['ls-tree', '-r', '-z', '--name-only', rev], 'utf8').split('\0').filter(Boolean);
  const main = 'games/' + id + '/index.html';
  if (!tracked.includes(main)) throw Error('公開用のゲームがコミットされていません');
  const names = new Set(['index.html', main]);
  tracked.filter(n => (n.startsWith('games/' + id + '/') || n.startsWith('share/' + id + '/')) && !n.split('/').some(p => p.startsWith('_'))).forEach(n => names.add(n));
  /* 参照の走査にも同じコミットを使い、未コミットの変更を混ぜない。 */
  const cache = new Map();
  function data(name) { if (!cache.has(name)) cache.set(name, git(['show', rev + ':' + name])); return cache.get(name); }
  if (!data(main).toString('utf8').includes('name="zounoashi-unlisted"') && !tracked.includes('share/' + id + '/index.html')) throw Error('正式公開用の共有ページがコミットされていません');
  const visited = new Set();
  function follow(name) {
    if (visited.has(name)) return;
    visited.add(name);
    if (!/\.(html|js|css)$/.test(name)) return;
    const text = data(name).toString('utf8');
    for (const raw of w.resourceRefs(text)) {
      const ref = decodeURIComponent(raw.split(/[?#]/)[0]);
      if (!ref || /^(?:[a-z]+:|\/\/)/i.test(ref) || /[${}<>]/.test(ref)) continue;
      const target = path.posix.normalize(ref.startsWith('/') ? ref.slice(1) : path.posix.join(path.posix.dirname(name), ref));
      if (target.split('/').some(p => p.startsWith('_'))) continue;
      if (!tracked.includes(target)) throw Error('参照先がコミットにありません: ' + target);
      names.add(target); follow(target);
    }
  }
  [...names].forEach(follow);
  const expected = [...names].map(name => ({name, data: data(name)}));
  console.log('配信確認: ' + id + ' / ' + rev.slice(0, 10) + ' / ' + expected.length + 'ファイル');
  const failures = await verify(expected, base, attempts);
  failures.forEach(f => console.error('未確認: ' + f));
  console.log(failures.length ? 'まだ配信完了を確認できません。push済みか、配信待ちかも確認してください。' : 'コミットした本体・素材・共有ページの配信を確認しました。');
  process.exitCode = failures.length ? 1 : 0;
})().catch(e => { console.error(e.message); process.exitCode = 1; });
