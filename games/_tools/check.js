/* ゲーム名ひとつで参照先・共通処理・ゲーム固有の確認をまとめて実行する。 */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const w = require('./workflow');
try {
  const id = process.argv[2], dir = w.game(id), config = w.read(dir);
  if (process.argv.length !== 3) throw Error('使い方: node games/_tools/check.js <id>');
  const refs = w.references(w.root, [path.join(dir, 'index.html')]);
  let bad = refs.missing.length;
  refs.missing.forEach(f => console.error('参照先なし: ' + f));
  refs.external.forEach(f => console.log('外部参照（実機でも確認）: ' + f));
  const issues = w.materials(dir, config);
  issues.forEach(f => console.log('公開前の要確認: ' + f));
  if (config.expressionReviewed !== true) console.log('公開前の要確認: 表現の確認が未記録');
  const names = fs.readdirSync(path.join(__dirname, 'tests'));
  const own = names.filter(n => n === id + '.js' || n.startsWith(id + '-') && n.endsWith('.js'));
  const common = ['action-icons.js', 'audio-start.js', 'common-view-start.js', 'result-actions.js', 'share.js'];
  const commands = [...new Set(common.concat(own))].map(n => ['tests/' + n]);
  if (fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes('../pad.js')) commands.push(['tests/pad.js', path.basename(dir)]);
  /* 専用確認があるものはそれを使い、時間切れのないゲームへ汎用の結果画面判定を強制しない。 */
  if (!own.length) {
    console.log('ゲーム固有の確認がありません。汎用確認と手動の遊び確認が必要です。');
    commands.push(['smoke.js', path.join(dir, 'index.html')]);
  }
  for (const args of commands) {
    console.log('\n確認: ' + args.join(' '));
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, args[0]), ...args.slice(1)], {
      cwd: w.root, stdio: 'inherit', timeout: 120000, windowsHide: true
    });
    if (r.error || r.status !== 0) { bad++; console.error('失敗: ' + (r.error ? r.error.message : r.status)); }
  }
  console.log('\n自動確認: ' + (bad ? bad + '件失敗' : '通過') + '。操作感・スマホ音声・見た目は実機で確認してください。');
  process.exitCode = bad ? 1 : 0;
} catch (e) { console.error(e.message); process.exitCode = 1; }
