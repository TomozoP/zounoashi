/* あたらしいゲームの置き場所を作る。

     node games/_tools/new.js hoge "ほげゲーム" "ひとこと説明"
     node games/_tools/new.js hoge "ほげゲーム" "ひとこと説明" --3d   立体（three.js）で描く

   やること
     1. games/_template を games/_hoge に写して、題名を入れる
     2. games/_local.js に一覧用の1行を足す（手元でだけ実験場に出る）
   これで http://localhost:8735/ の実験場タブに、すぐカードが出る。 */

var fs = require("fs");
var path = require("path");

var three = process.argv.includes("--3d");
var args = process.argv.slice(2).filter(function (a) { return a !== "--3d"; });
var id = args[0];
var title = args[1];
var note = args[2] || "";
if (!id || !title) {
  console.log('使い方: node games/_tools/new.js <id> "<題名>" "<ひとこと>"');
  console.log('  id は半角小文字の英数字・ハイフン（URLとプレイ数の集計に使う）');
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(id)) {
  console.log("id は半角小文字の英数字・ハイフン・アンダースコア（40文字まで）にしてください");
  process.exit(1);
}

var root = path.join(__dirname, "..", "..");
var dir = path.join(root, "games", "_" + id);
if (fs.existsSync(dir) || fs.existsSync(path.join(root, "games", id))) {
  console.log("もうあります: " + dir);
  process.exit(1);
}

fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(path.join(dir, "img"), { recursive: true });
var tpl = fs.readFileSync(path.join(root, "games", "_template", "index.html"), "utf8");
var htmlTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var safeTitle = JSON.stringify(title).slice(1, -1).replace(/</g, "\\u003c");
tpl = tpl.replace("<title>__TITLE__</title>", () => "<title>" + htmlTitle + "</title>").replace("/* __TITLE__", () => "/* " + title.replace(/\*\//g, "＊／").replace(/</g, "＜"));
tpl = tpl.split("__TITLE__").join(safeTitle);
/* 立体で描くとき：three.js と共通の土台（games/three-base.js）と、場面の見本（scene3d.js）を足す */
if (three) {
  var pad = '<script src="../pad.js"></script>   <!-- ジョイパッドと、絵の外のタップ -->\n';
  var drawHead = '    /* ▼DRAW: ここに絵 */\n    ctx.fillStyle = "#1d1714";\n    ctx.fillRect(0, 0, W, H);\n';
  if (tpl.indexOf(pad) < 0 || tpl.indexOf(drawHead) < 0 || tpl.indexOf("  function draw() {") < 0) { console.log("雛形の形が変わっていて、立体の準備を入れられません"); process.exit(1); }
  tpl = tpl.replace(pad, function () {
    return pad + '<script src="../random-bowling/vendor/three.min.js"></script>\n<script src="../three-base.js"></script>\n<script src="scene3d.js"></script>\n';
  });
  tpl = tpl.replace("  function draw() {", function () {
    return "  /* 立体の場面。three.js が使えないときは平面の絵のまま */\n" +
      "  var scene3d = window.Z3 ? window.Z3.lazy(function () { return new window.GameScene(); }) : function () { return null; };\n\n" +
      "  function draw() {";
  });
  tpl = tpl.replace(drawHead, function () {
    return '    /* ▼DRAW: ここに絵。立体の上に、文字やボタンを2Dで描く */\n' +
      '    var s3 = scene3d(), drew = false;\n' +
      '    if (s3) { try { s3.sync({ t: T || 0, state: state }); drew = s3.draw(ctx, W, H); } catch (e) { scene3d.drop(); } }\n' +
      '    if (!drew) { ctx.fillStyle = "#1d1714"; ctx.fillRect(0, 0, W, H); }\n';
  });
  fs.copyFileSync(path.join(root, "games", "_template", "scene3d.js"), path.join(dir, "scene3d.js"));
}
fs.writeFileSync(path.join(dir, "index.html"), tpl);

/* 一覧用の1行を games/_local.js に足す */
var localPath = path.join(root, "games", "_local.js");
var today = new Date();
var date = today.getFullYear() + "-" +
           String(today.getMonth() + 1).padStart(2, "0") + "-" +
           String(today.getDate()).padStart(2, "0");
var entry = '  ' + JSON.stringify({type: "lab", tags: [], id: id, title: title, year: today.getFullYear(), date: date, plays: null, url: "", img: "games/_" + id + "/img/thumb.webp", play: "games/_" + id + "/index.html", full: true, catch: note}) + ',\n';
fs.writeFileSync(path.join(dir, "_制作.json"), JSON.stringify({expressionReviewed: false, materials: [], thumbnail: {seconds: 3, key: " ", top: 90, topHeight: 170, quality: 90, query: "", width: 430, height: 900, setup: null}}, null, 2) + "\n");

var local = fs.existsSync(localPath) ? fs.readFileSync(localPath, "utf8") : null;
if (!local) {
  local = '/* 手元でだけ実験場に出す、作りかけのゲーム。\n' +
          '   _ で始まるので GitHub Pages には出ません。index.html が localhost のときだけ読みます。\n' +
          '   公開するときは games/_tools/publish.js を使います。 */\n' +
          'window.DRAFT_GAMES = [\n];\n';
}
/* 空の一覧（= [];）にも足せるように、閉じかっこの手前に入れる。
   前の項目の終わりにカンマが無ければ付ける（無いまま足すと一覧全体が読めなくなる） */
var body = local.replace(/\n?\];\s*$/, "").replace(/\}\s*$/, "},");
fs.writeFileSync(localPath, body + "\n" + entry + "];\n");

console.log("できました:");
console.log("  games/_" + id + "/index.html   ← ここを書く（▼UPDATE ▼DRAW ▼SHARE）");
if (three) console.log("  games/_" + id + "/scene3d.js    ← 立体の見た目（▼3D）。土台は games/three-base.js");
console.log("  games/_local.js               ← 一覧に足しました");
console.log("");
console.log("次にやること:");
console.log("  1. プレビューを開く（実験場タブの先頭に出ます）");
console.log("  2. node games/_tools/check.js " + id + "   で壊れていないか確認");
console.log("  3. サムネを games/_" + id + "/img/thumb.webp に置く");
console.log("     （node games/_tools/thumb.js " + id + " で画面から作れます）");
console.log("  4. 素材記録: node games/_tools/materials.js " + id);
console.log("  5. 公開前の確認: node games/_tools/publish.js " + id + " --check");
console.log("     正式公開の指示を受けてから --check を外して実行");
