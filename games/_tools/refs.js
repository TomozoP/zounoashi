/* HTML・CSS・JS の中の、手元のファイルへの参照を見つけて書き換える。
   src= / href= / url() / import のほか、JSの文字列 "img/aji.webp" のようなものも拾う。
   artifact.js（確認用ページ）と preview-link.js（制作中の固定リンク）で使う。 */
var fs = require("fs");
var path = require("path");
var REF = /((?:\bsrc|\bhref)\s*=\s*["']|url\(\s*["']?|\bimport\s*[^;\n]*?\bfrom\s*["']|["'])((?:\.\.\/|\.\/)?[A-Za-z0-9_\-./]+\.(?:js|css|webp|png|jpe?g|svg|gif|mp3|wav|ogg|mp4|woff2?|ttf|glb|gltf|json))(\?[^"')\s]*)?(?=["')\s])/g;

function isFile(f) { return fs.existsSync(f) && fs.statSync(f).isFile(); }

/* 参照をたどって、使っているファイルを全部集める（root の外は見ない） */
function collect(root, start) {
  var seen = new Set();
  (function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.(html|css|js)$/i.test(file)) return;
    for (var m of fs.readFileSync(file, "utf8").matchAll(REF)) {
      if (/^(?:https?:)?\/\//.test(m[2])) continue;
      var target = path.resolve(path.dirname(file), m[2]);
      if (!path.relative(root, target).startsWith("..") && isFile(target)) visit(target);
    }
  })(start);
  return [...seen];
}

/* 実在するファイルへの参照だけを、change(実体のパス, 元の書き方) の返す文字列に置き換える */
function rewrite(text, fromDir, change) {
  return text.replace(REF, function (all, head, ref) {
    if (/^(?:https?:)?\/\//.test(ref)) return all;
    var target = path.resolve(fromDir, ref);
    if (!isFile(target)) return all;
    var next = change(target, ref);
    return next == null ? all : head + next;
  });
}
module.exports = { REF: REF, collect: collect, rewrite: rewrite };
