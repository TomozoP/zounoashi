/* 保存した撮影条件に、今回の指定だけを重ねる。 */
module.exports = function(saved, args) {
  const p = Object.assign({seconds: 3, key: ' ', top: 90, topHeight: 170, quality: 90, query: '', width: 430, height: 900, setup: null}, saved);
  const names = {'-t': 'seconds', '-k': 'key', '--top': 'top', '--toph': 'topHeight', '-q': 'quality', '--query': 'query', '--width': 'width', '--height': 'height'};
  let save = false, print = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--save-preset') { save = true; continue; }
    if (args[i] === '--print') { print = true; continue; }
    const name = names[args[i]];
    if (!name || args[i + 1] === undefined) throw Error('撮影条件の指定を確認してください: ' + args[i]);
    const value = args[++i];
    p[name] = ['key', 'query'].includes(name) ? value : Number(value);
  }
  if (p.key === 'なし' || p.key === 'none') p.key = null;
  for (const [name, min, max] of [['seconds', 0, 120], ['top', 0, 10000], ['topHeight', 1, 539], ['quality', 0, 100], ['width', 100, 4000], ['height', 100, 4000]]) {
    if (!Number.isFinite(p[name]) || p[name] < min || p[name] > max) throw Error('撮影条件の範囲外: ' + name);
  }
  if (typeof p.query !== 'string' || (p.key !== null && typeof p.key !== 'string')) throw Error('キー・検索条件は文字列で指定してください');
  if (p.setup !== null && (typeof p.setup !== 'object' || Array.isArray(p.setup))) throw Error('setup は撮影用の設定オブジェクトで指定してください');
  return {preset: p, save, print};
};
