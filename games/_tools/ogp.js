/* 一覧のタイトルとサムネから、共有ページとゲーム本体のOGPを更新する。
   node games/_tools/ogp.js。公開準備のときにも呼ばれる。 */
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var cp = require("child_process");
var root = path.resolve(__dirname, "../..");
var source = fs.readFileSync(path.join(root, "index.html"), "utf8");
var games = vm.runInNewContext(source.match(/var GAMES = (\[[\s\S]*?\n\]);/)[1], { UR: "", KY: "" });
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
games.filter(function (g) { return g.id && g.play; }).forEach(function (g) {
  var img = g.img;
  if (/\.svg$/i.test(img)) {
    cp.execFileSync(process.execPath, [path.join(__dirname, "img.js"), path.join(root, img), "--png"], { stdio: "inherit" });
    img = img.replace(/\.svg$/i, ".png");
  }
  if (!fs.existsSync(path.join(root, img))) throw new Error("サムネがありません: " + img);
  var url = "https://www.zounoashi.com/share/" + g.id + "/";
  var image = "https://www.zounoashi.com/" + img;
  var tags = '<!-- ゲームのOGP：道具で更新 -->\n' +
    '<meta property="og:type" content="website">\n' +
    '<meta property="og:site_name" content="ゾウノアシゲームズ">\n' +
    '<meta property="og:title" content="' + esc(g.title) + '">\n' +
    '<meta property="og:url" content="' + url + '">\n' +
    '<meta property="og:image" content="' + esc(image) + '">\n' +
    '<meta property="og:image:alt" content="' + esc(g.title) + '">\n' +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    '<meta name="twitter:title" content="' + esc(g.title) + '">\n' +
    '<meta name="twitter:image" content="' + esc(image) + '">\n' +
    '<!-- ゲームのOGPここまで -->';
  var file = path.join(root, g.play);
  var html = fs.readFileSync(file, "utf8");
  html = html.replace(/<!-- ゲームのOGP：道具で更新 -->[\s\S]*?<!-- ゲームのOGPここまで -->\r?\n?/g, "");
  fs.writeFileSync(file, html.replace(/<\/head>/i, tags + '\n</head>'));
  var dir = path.join(root, "share", g.id);
  fs.mkdirSync(dir, { recursive: true });
  var target = '/#/game/' + encodeURIComponent(g.id);
  fs.writeFileSync(path.join(dir, "index.html"), '<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="UTF-8">\n<title>' + esc(g.title) + '</title>\n' + tags + '\n</head>\n<body>\n<script>location.replace(' + JSON.stringify(target) + ' + location.search);</script>\n<noscript><a href="' + esc(target) + '">' + esc(g.title) + '</a></noscript>\n</body>\n</html>\n');
  console.log("共有ページを更新: " + g.title);
});
