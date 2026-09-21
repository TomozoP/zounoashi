/* 素材の追加時に未確認の記録を作る。既存の記録は上書きしない。 */
const fs = require('fs'), path = require('path'), w = require('./workflow');
try {
  const dir = w.game(process.argv[2]);
  if (process.argv.length !== 3) throw Error('使い方: node games/_tools/materials.js <id>');
  const config = w.read(dir);
  config.materials = config.materials || [];
  if (config.expressionReviewed === undefined) config.expressionReviewed = false;
  for (const file of w.files(dir).filter(f => /\.(webp|png|jpe?g|svg|gif|mp3|wav|ogg|mp4|woff2?|ttf|glb|gltf)$/i.test(f))) {
    const rel = path.relative(dir, file).replace(/\\/g, '/');
    if (!config.materials.some(r => r.file === rel)) config.materials.push({file: rel, source: '', license: '', redistribution: false});
  }
  const file = path.join(dir, '_制作.json');
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
  console.log('素材の記録: ' + path.relative(w.root, file));
  console.log('出典・利用条件・公開リポジトリへの再配布可否を確認して記入してください。自作・生成素材も作成方法を残します。');
} catch (e) { console.error(e.message); process.exitCode = 1; }
