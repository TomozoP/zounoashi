/* 制作の道具で使う、対象と記録の読み取り。 */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../..');
function inside(base, name) {
  const file = path.resolve(base, name), rel = path.relative(base, file);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw Error('置き場所の外は指定できません: ' + name);
  return file;
}
function game(id, base = root) {
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(id || '')) throw Error('ゲーム名を指定してください');
  const draft = path.join(base, 'games', '_' + id), live = path.join(base, 'games', id);
  if (fs.existsSync(draft) && fs.existsSync(live)) throw Error('下書きと公開用が両方あります: ' + id);
  const dir = fs.existsSync(draft) ? draft : live;
  if (!fs.existsSync(path.join(dir, 'index.html'))) throw Error('ゲームがありません: ' + id);
  return dir;
}
function read(dir) {
  const file = path.join(dir, '_制作.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
function resourceRefs(text) {
  text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  const re = /(?:\b(?:src|poster)\s*=\s*["']([^"']+)["']|\bhref\s*=\s*["']([^"']+\.(?:css|ico)(?:\?[^"']*)?)["']|url\(\s*["']?([^\s)'";]+)["']?\s*\)|(?:\bimport\s*(?:[^;\n]*?\bfrom\s*)?|\bimportScripts\s*\()\s*["']([^"']+)["'])/g;
  return [...text.matchAll(re)].map(m => m[1] || m[2] || m[3] || m[4]);
}
function references(base, initial) {
  const found = new Set(), missing = new Set(), external = new Set();
  function visit(file) {
    if (found.has(file)) return;
    if (!fs.existsSync(file)) { missing.add(path.relative(base, file)); return; }
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { missing.add(path.relative(base, file)); return; }
    found.add(file);
    if (!/\.(html|css|js)$/i.test(file)) return;
    for (const raw of resourceRefs(fs.readFileSync(file, 'utf8'))) {
      if (/^(?:https?:)?\/\//.test(raw)) { external.add(raw); continue; }
      if (/^(?:data:|blob:|#)/.test(raw) || /[${}<>]/.test(raw)) continue;
      const clean = decodeURIComponent(raw.split(/[?#]/)[0]);
      if (!clean) continue;
      const target = clean.startsWith('/') ? inside(base, '.' + clean) : inside(base, path.relative(base, path.resolve(path.dirname(file), clean)));
      visit(target);
    }
  }
  initial.forEach(visit);
  return { files: [...found], missing: [...missing], external: [...external] };
}
function materials(dir, config) {
  const rows = config.materials || [];
  const actual = files(dir).filter(f => /\.(webp|png|jpe?g|svg|gif|mp3|wav|ogg|mp4|woff2?|ttf|glb|gltf)$/i.test(f));
  const issues = [];
  for (const file of actual) {
    const rel = path.relative(dir, file).replace(/\\/g, '/');
    const row = rows.find(r => r.file === rel);
    if (!row || !row.source || !row.license || row.redistribution !== true) issues.push(rel + ': 出典・利用条件・再配布の確認が未記録');
  }
  for (const row of rows) if (!fs.existsSync(inside(dir, row.file))) issues.push(row.file + ': 記録に対応するファイルがありません');
  return issues;
}
module.exports = { root, inside, game, read, files, references, materials, resourceRefs };
