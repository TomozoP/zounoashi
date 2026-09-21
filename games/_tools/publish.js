/* 下書きを公開できる形にする。commit・push は別に行う。
   node games/_tools/publish.js hoge --unlisted  一覧に出さない制作中の公開
   node games/_tools/publish.js hoge             正式に一覧へ載せる */
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var id = process.argv[2];
var options = process.argv.slice(3);
var unlisted = options.includes("--unlisted"), check = options.includes("--check");
var workflow = require("./workflow");
var render = require("./ogp-render");
var apply = require("./transaction");
function fail(message) { console.error(message); process.exit(1); }
if (!id || !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(id) || options.some(o => !["--unlisted", "--check"].includes(o))) fail("使い方: node games/_tools/publish.js <id> [--unlisted] [--check]");
var root = path.resolve(__dirname, "../..");
var from = path.join(root, "games", "_" + id);
var to = path.join(root, "games", id);
var localPath = path.join(root, "games/_local.js");
var idxPath = path.join(root, "index.html");
var local = fs.readFileSync(localPath, "utf8");
var idx = fs.readFileSync(idxPath, "utf8");
var context = { window: {} };
vm.runInNewContext(local, context);
var entries = context.window.DRAFT_GAMES;
var matches = entries.filter(function (g) { return g.id === id; });
if (matches.length !== 1) fail("games/_local.js に対象の行が1つ必要です: " + id);
var entry = matches[0];
var listed = vm.runInNewContext(idx.match(/var GAMES = (\[[\s\S]*?\n\]);/)[1], { UR: "", KY: "" });
if (listed.some(function (g) { return g.id === id; })) fail("すでに正式公開されています: " + id);
var anchor = idx.match(/^[ \t]*\{ type: "lab".*$/m);
if (!unlisted && !anchor) fail("index.html の実験場の行が見つかりません");
if (fs.existsSync(from) && fs.existsSync(to)) fail("移動先がすでにあります: " + to);
var source = fs.existsSync(from) ? from : to;
if (!fs.existsSync(path.join(source, "index.html"))) fail("ゲームが見つかりません: " + id);
var html = fs.readFileSync(path.join(source, "index.html"), "utf8");
if (!/<\/head>/i.test(html)) fail("ゲームの </head> が見つかりません");
var marker = '<meta name="zounoashi-unlisted" content="true">\n<meta name="robots" content="noindex, nofollow">\n';
var markerPattern = /<meta name="zounoashi-unlisted" content="true">\r?\n<meta name="robots" content="noindex, nofollow">\r?\n/;
if (source === to && !markerPattern.test(html)) fail("制作中の公開として登録されていません: " + id);
if (!unlisted && (!entry.img || !fs.existsSync(path.join(root, entry.img)))) fail("正式公開にはサムネが必要です: " + entry.img);

/* 生成をすべて済ませてからまとめて書く。確認だけなら一切書かない。 */
var config = workflow.read(source);
var materialIssues = workflow.materials(source, config);
console.log("対象: " + id + " / " + entry.title);
console.log("区分: " + (unlisted ? "一覧なし" : "正式公開"));
console.log("サムネ: " + (entry.img || "未指定"));
console.log("一覧の説明: " + (entry.catch || "なし"));
console.log("共有カードの題名: " + entry.title);
console.log("結果の共有文は得点で変わるため、ゲームの共有ボタンでも確認してください。");
console.log("移動: " + path.relative(root, source) + " → games/" + id);
materialIssues.forEach(m => console.log("素材の要確認: " + m));
if (config.expressionReviewed !== true) console.log("表現の確認: 未記録（_制作.json の expressionReviewed）");
var refs = workflow.references(root, [path.join(source, "index.html")]);
if (refs.missing.length) fail("参照先がありません: " + refs.missing.join(", "));
refs.external.forEach(url => console.log("外部参照の利用条件・稼働確認: " + url));
["play", "img"].forEach(function (key) {
  if (entry[key]) entry[key] = entry[key].split("games/_" + id + "/").join("games/" + id + "/");
});
if (entry.play !== "games/" + id + "/index.html") fail("ゲーム本体の登録先が対象と一致しません");
html = html.replace(markerPattern, "");
var changes = [];
if (unlisted) html = html.replace(/<\/head>/i, marker + "</head>");
else {
  var image = entry.img;
  workflow.inside(root, image);
  /* SVGの共有画像は先に用意する。確認だけの操作では変換もしない。 */
  if (/\.svg$/i.test(image)) {
    image = image.replace(/\.svg$/i, ".png");
    var sourceImage = image.replace("games/" + id + "/", "games/" + path.basename(source) + "/");
    if (!fs.existsSync(workflow.inside(root, sourceImage))) fail("共有用PNGを先に作ってください: " + sourceImage);
  }
  var generated = render(entry, html, image);
  html = generated.game;
  var shareFile = path.join(root, "share", id, "index.html");
  if (fs.existsSync(shareFile)) fail("未登録の共有ページがすでにあります: " + shareFile);
  changes.push({file: shareFile, data: generated.share});
  var line = JSON.stringify(entry).replace(/"([a-zA-Z]+)":/g, "$1: ");
  changes.push({file: idxPath, data: idx.replace(anchor[0], () => "  " + line.replace(/</g, "\\u003c") + ",\n" + anchor[0])});
  entries = entries.filter(function (g) { return g.id !== id; });
}
changes.push({file: path.join(source, "index.html"), data: html});
var start = local.indexOf("window.DRAFT_GAMES");
if (start < 0) fail("下書き一覧の開始位置が見つかりません");
changes.push({file: localPath, data: local.slice(0, start) + "window.DRAFT_GAMES = " + JSON.stringify(entries, null, 2) + ";\n"});
console.log("更新対象: " + changes.map(c => path.relative(root, c.file)).join(", "));
if (check) {
  console.log("確認のみ。ファイルは変更していません。正式公開は持ち主の指示を受けてから実行します。");
  if (materialIssues.length || config.expressionReviewed !== true) process.exitCode = 1;
} else {
  if (materialIssues.length || config.expressionReviewed !== true) fail("素材・表現の確認を記録してから実行してください。確認済みと推測して埋めないこと。");
  apply(changes, source === from ? {from: from, to: to} : null);
  console.log("公開の形にしました。変更内容を確認して commit・push すると反映されます。");
}
