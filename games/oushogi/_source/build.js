/* Blenderから取り出した立体を本体に埋め込む。遊ぶときのビルドは不要。 */
var fs = require('fs'), path = require('path');
var root = __dirname;
var template = fs.readFileSync(path.join(root, '../../_template/index.html'), 'utf8');
var head = template.split('  /* ============ 状態 ============ */')[0].replaceAll('__TITLE__', '王将棋');
head = head.replace('<!-- ジョイパッドと、絵の外のタップ -->', '<!-- ジョイパッドの受け口 -->')
  .replace(/\/\* 王将棋[\s\S]*?\*\//, '/* 王将棋。二マス、一手、三つの視点。 */');
var code = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
var meshes = fs.readFileSync(path.join(root, 'meshes.json'), 'utf8');
fs.writeFileSync(path.join(root, '../index.html'), head + code.replace('__MODEL__', meshes));
