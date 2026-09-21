/* 一覧のタイトルとサムネから、共有ページとゲーム本体のOGPを更新する。
   node games/_tools/ogp.js。公開準備のときにも呼ばれる。 */
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var cp = require("child_process");
var root = path.resolve(__dirname, "../..");
var source = fs.readFileSync(path.join(root, "index.html"), "utf8");
var games = vm.runInNewContext(source.match(/var GAMES = (\[[\s\S]*?\n\]);/)[1], { UR: "", KY: "" });
var render = require("./ogp-render");
games.filter(function (g) { return g.id && g.play && (!process.argv[2] || g.id === process.argv[2]); }).forEach(function (g) {
  var img = g.img;
  if (/\.svg$/i.test(img)) {
    cp.execFileSync(process.execPath, [path.join(__dirname, "img.js"), path.join(root, img), "--png"], { stdio: "inherit" });
    img = img.replace(/\.svg$/i, ".png");
  }
  if (!fs.existsSync(path.join(root, img))) throw new Error("サムネがありません: " + img);
  var file = path.join(root, g.play);
  var generated = render(g, fs.readFileSync(file, "utf8"), img);
  var dir = path.join(root, "share", g.id);
  require("./transaction")([
    {file: file, data: generated.game},
    {file: path.join(dir, "index.html"), data: generated.share}
  ]);
  console.log("共有ページを更新: " + g.title);
});
