/* 一覧に出さない公開から正式公開へ移し、他の下書きを保つことを確認する。 */
var assert = require("assert");
var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");
var vm = require("vm");
var root = fs.mkdtempSync(path.join(os.tmpdir(), "zounoashi-publish-"));
fs.mkdirSync(path.join(root, "games/_tools"), { recursive: true });
["publish.js", "ogp.js"].forEach(function (name) {
  fs.copyFileSync(path.join(__dirname, "..", name), path.join(root, "games/_tools", name));
});
var original = 'var GAMES = [\n  { type: "lab", id: "existing" },\n];';
fs.writeFileSync(path.join(root, "index.html"), original);
fs.mkdirSync(path.join(root, "games/_sample/img"), { recursive: true });
fs.writeFileSync(path.join(root, "games/_sample/index.html"), '<html><head><title>確認</title></head><body></body></html>');
fs.writeFileSync(path.join(root, "games/_sample/img/thumb.webp"), "画像の存在確認用");
fs.writeFileSync(path.join(root, "games/_local.js"), 'window.DRAFT_GAMES = [\n' +
  '  { id: "other", title: "別の下書き" },\n' +
  '  { type: "lab", id: "sample", title: "確認", play: "games/_sample/index.html", img: "games/_sample/img/thumb.webp", full: true },\n];\n');
function run(args) { return cp.spawnSync(process.execPath, [path.join(root, "games/_tools/publish.js")].concat(args), { encoding: "utf8" }); }
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
function drafts() { var c = { window: {} }; vm.runInNewContext(read("games/_local.js"), c); return c.window.DRAFT_GAMES; }
var r = run(["sample", "--unlisted"]);
assert.equal(r.status, 0, r.stderr);
assert.equal(read("index.html"), original);
assert(read("games/sample/index.html").includes('content="noindex, nofollow"'));
assert.equal(drafts()[0].id, "other");
assert.equal(drafts()[1].play, "games/sample/index.html");
assert(!fs.existsSync(path.join(root, "share/sample")));
assert.equal(run(["sample", "--unlisted"]).status, 0);
r = run(["sample"]);
assert.equal(r.status, 0, r.stderr);
assert(!read("games/sample/index.html").includes("noindex"));
assert(!read("games/sample/index.html").includes("zounoashi-unlisted"));
assert(read("index.html").includes('id: "sample"'));
assert(read("share/sample/index.html").includes("/#/game/sample"));
assert.equal(drafts().length, 1);
assert.equal(drafts()[0].id, "other");
assert.notEqual(run(["sample", "--unlisted"]).status, 0);
assert.notEqual(run(["../sample", "--unlisted"]).status, 0);
/* 従来どおり、下書きから直接正式公開もできる。 */
fs.mkdirSync(path.join(root, "games/_direct/img"), { recursive: true });
fs.writeFileSync(path.join(root, "games/_direct/index.html"), '<html><head></head></html>');
fs.writeFileSync(path.join(root, "games/_direct/img/thumb.webp"), "画像の存在確認用");
fs.writeFileSync(path.join(root, "games/_local.js"), 'window.DRAFT_GAMES = [{ type: "lab", id: "direct", title: "直接公開", play: "games/_direct/index.html", img: "games/_direct/img/thumb.webp" }];');
r = run(["direct"]);
assert.equal(r.status, 0, r.stderr);
assert(read("share/direct/index.html").includes("/#/game/direct"));
console.log("制作中の公開・正式公開への切り替え・直接公開・他の下書きの保持を確認しました");
