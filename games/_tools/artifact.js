/* 確認用ページ（Claude の非公開ページ）に載せる一式を、1つのフォルダにまとめる。

     node games/_tools/artifact.js hoge

   games/_tools/_bin/artifact/hoge/ に、ゲーム本体と、使っている共通の部品・絵・3Dの部品を集める。
   `../start.js` のような上の階層の参照は `shared/start.js` に書き換え、
   古いものが残らないよう、手元の参照にはすべて同じ版の `?v=` を付ける。
   最後に、載せるときに渡すページと files の対応表を出す。
   ゲームの原本（games/_hoge/）は書き換えない。 */
var fs = require("fs");
var path = require("path");
var workflow = require("./workflow");
var refs = require("./refs");

var id = process.argv[2];
var gameDir;
try { gameDir = workflow.game(id); } catch (e) { console.error(e.message); process.exit(1); }
var root = workflow.root;
var out = path.join(__dirname, "_bin", "artifact", id);
var version = Date.now().toString(36);
fs.rmSync(out, { recursive: true, force: true });

/* 載せたときの置き場所。ゲームの外の部品は shared/ の下（games/ からの位置のまま） */
function placed(file) {
  var rel = path.relative(gameDir, file);
  if (rel.startsWith("..")) rel = "shared/" + path.relative(root, file).replace(/\\/g, "/").replace(/^games\//, "");
  return rel.replace(/\\/g, "/");
}
/* ゲームのフォルダの中身（_ で始まる記録やテストは載せない）と、参照している外の部品 */
var own = workflow.files(gameDir).filter(function (f) {
  return !path.relative(gameDir, f).split(path.sep).some(function (p) { return p.startsWith("_"); });
});
var shared = refs.collect(root, path.join(gameDir, "index.html")).filter(function (f) { return placed(f).startsWith("shared/"); });

var map = {};
own.concat(shared).forEach(function (src) {
  var rel = placed(src), dest = path.join(out, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (/\.(html|css|js)$/i.test(src) && !rel.startsWith("shared/")) {
    var text = refs.rewrite(fs.readFileSync(src, "utf8"), path.dirname(src), function (target) {
      return path.relative(path.dirname(dest), path.join(out, placed(target))).replace(/\\/g, "/") + "?v=" + version;
    });
    fs.writeFileSync(dest, text);
  } else fs.copyFileSync(src, dest);
  if (rel !== "index.html") map[rel] = path.relative(root, dest).replace(/\\/g, "/");
});

var page = path.relative(root, path.join(out, "index.html")).replace(/\\/g, "/");
console.log("OK  " + page + "  （部品 " + Object.keys(map).length + " 個、版 " + version + "）");
console.log("載せるときは Artifact に次を渡す（2回目からは同じページの場所で上書きすると、同じリンクのまま更新される）:");
console.log(JSON.stringify({ file_path: page, files: map }, null, 2));
