/* 「公開して」を1回で済ませる。正式公開の指示を受けてから使う。

     node games/_tools/release.js hoge 10/26 --check   何が変わるかを見るだけ（何も書かない）
     node games/_tools/release.js hoge 10/26           サムネ → 公開の形 → 固定リンクの差し替え
   10/26 は担当日（「〇/〇のゲーム」の日）。一覧の日付をこの日にする

   1. サムネ（img/thumb.webp）がなければ thumb.js で撮る（_制作.json に保存した撮影条件を使う）。
      あれば撮り直さない。撮り直すときは先に thumb.js を単独で使う
   2. publish.js で一覧・共有ページ・公開用のOGPを作る（素材と表現の確認が記録済みであること）
   3. preview-link.js で制作中の固定リンク（Cake Cut）も同じゲームに差し替える
   commit・push は最後に自分で行い、反映後に verify-deploy.js で照合する。 */
var cp = require("child_process");
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var workflow = require("./workflow");

var id = process.argv[2], options = process.argv.slice(3);
var check = options.includes("--check");
var day = options.filter(function (o) { return o !== "--check"; });
if (!id || day.length > 1 || (!check && day.length !== 1)) { console.error("使い方: node games/_tools/release.js <id> <担当日 例 10/26> [--check]"); process.exit(1); }
var dateArg = day.length ? ["--date=" + day[0]] : [];
try { workflow.game(id); } catch (e) { console.error(e.message); process.exit(1); }

function run(tool, args) {
  console.log("\n▶ " + tool + " " + args.join(" "));
  var r = cp.spawnSync(process.execPath, [path.join(__dirname, tool)].concat(args), { stdio: "inherit", cwd: workflow.root });
  if (r.status !== 0) { console.error("\nNG  " + tool + " で止まりました。上の表示を見て直してから、もう一度実行してください。"); process.exit(1); }
}

/* サムネの場所は下書き一覧の登録から読む */
var context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(workflow.root, "games/_local.js"), "utf8"), context);
var entry = (context.window.DRAFT_GAMES || []).find(function (g) { return g.id === id; });
if (!entry) { console.error("games/_local.js に登録がありません: " + id); process.exit(1); }
var thumb = entry.img && path.join(workflow.root, entry.img);
var hasThumb = thumb && fs.existsSync(thumb);

if (check) {
  console.log("サムネ: " + (hasThumb ? "あり（" + entry.img + "）" : "なし → 実行時に thumb.js で撮ります"));
  if (hasThumb) run("publish.js", [id, "--check"].concat(dateArg));
  else console.log("（publish.js の確認はサムネが要るので、サムネを撮ったあとの本番で行います）");
  console.log("\n固定リンク（Cake Cut）も " + id + " に差し替えます。");
  process.exit(0);
}
if (!hasThumb) {
  run("thumb.js", [id]);
  /* いま道具で撮ったサムネは自作の撮影なので、その事実だけを素材の記録に足す（他の欄は埋めない） */
  var dir = workflow.game(id), config = workflow.read(dir), rel = path.relative(dir, thumb).replace(/\\/g, "/");
  config.materials = config.materials || [];
  if (!config.materials.some(function (r) { return r.file === rel; })) {
    config.materials.push({ file: rel, source: "自作。thumb.js でヘッドレスのブラウザにゲーム画面を映して撮り、正方形に切り出してwebpに書き出した（600x600）",
      license: "自作（ゾウノアシゲームズ）。画面に写る素材の条件は各素材の記録に従う", redistribution: true });
    fs.writeFileSync(path.join(dir, "_制作.json"), JSON.stringify(config, null, 2) + "\n");
  }
} else console.log("サムネ: 既存の " + entry.img + " を使います");
run("publish.js", [id].concat(dateArg));
run("preview-link.js", [id]);
console.log("\nOK  公開の形にしました。サムネを目で確かめ、差分を見て commit・push してください。");
console.log("    push のあと: node games/_tools/verify-deploy.js " + id);
