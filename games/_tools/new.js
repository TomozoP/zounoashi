/* あたらしいゲームの置き場所を作る。

     node games/_tools/new.js hoge "ほげゲーム" "ひとこと説明"

   やること
     1. games/_template を games/_hoge に写して、題名を入れる
     2. games/_local.js に一覧用の1行を足す（手元でだけ実験場に出る）
   これで http://localhost:8735/ の実験場タブに、すぐカードが出る。 */

var fs = require("fs");
var path = require("path");

var id = process.argv[2];
var title = process.argv[3];
var note = process.argv[4] || "";
if (!id || !title) {
  console.log('使い方: node games/_tools/new.js <id> "<題名>" "<ひとこと>"');
  console.log('  id は半角小文字の英数字・ハイフン（URLとプレイ数の集計に使う）');
  process.exit(1);
}
if (!/^[a-z0-9_-]{1,40}$/.test(id)) {
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
fs.writeFileSync(path.join(dir, "index.html"), tpl.split("__TITLE__").join(title));

/* 一覧用の1行を games/_local.js に足す */
var localPath = path.join(root, "games", "_local.js");
var today = new Date();
var date = today.getFullYear() + "-" +
           String(today.getMonth() + 1).padStart(2, "0") + "-" +
           String(today.getDate()).padStart(2, "0");
var entry = '  { type: "lab", tags: [], id: "' + id + '", title: "' + title + '", year: ' + today.getFullYear() +
            ', date: "' + date + '",\n' +
            '    plays: null, url: "", img: "games/_' + id + '/img/thumb.webp",\n' +
            '    play: "games/_' + id + '/index.html", full: true,\n' +
            '    catch: "' + note + '" },\n';

var local = fs.existsSync(localPath) ? fs.readFileSync(localPath, "utf8") : null;
if (!local) {
  local = '/* 手元でだけ実験場に出す、作りかけのゲーム。\n' +
          '   _ で始まるので GitHub Pages には出ません。index.html が localhost のときだけ読みます。\n' +
          '   公開するときは games/_tools/publish.js を使います。 */\n' +
          'window.DRAFT_GAMES = [\n];\n';
}
/* 空の一覧（= [];）にも足せるように、閉じかっこの手前に入れる */
fs.writeFileSync(localPath, local.replace(/\n?\];\s*$/, "\n" + entry + "];\n"));

console.log("できました:");
console.log("  games/_" + id + "/index.html   ← ここを書く（▼UPDATE ▼DRAW ▼SHARE）");
console.log("  games/_local.js               ← 一覧に足しました");
console.log("");
console.log("次にやること:");
console.log("  1. プレビューを開く（実験場タブの先頭に出ます）");
console.log("  2. node games/_tools/smoke.js games/_" + id + "/index.html   で壊れていないか確認");
console.log("  3. サムネを games/_" + id + "/img/thumb.webp に置く");
console.log("     （node games/_tools/thumb.js " + id + " で画面から作れます）");
console.log("  4. 公開するとき: node games/_tools/publish.js " + id);
