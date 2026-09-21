/* 一覧に出さない公開から正式公開へ移し、他の下書きを保つことを確認する。 */
var assert = require("assert");
var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");
var vm = require("vm");
var root = fs.mkdtempSync(path.join(os.tmpdir(), "zounoashi-publish-"));
fs.mkdirSync(path.join(root, "games/_tools"), { recursive: true });
["publish.js", "ogp.js", "ogp-render.js", "transaction.js", "workflow.js"].forEach(function (name) {
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
var record = {expressionReviewed: true, materials: [{file: "img/thumb.webp", source: "確認用の自作データ", license: "自作", redistribution: true}]};
fs.writeFileSync(path.join(root, "games/_sample/_制作.json"), JSON.stringify(record));
var before = read("games/_local.js");
fs.writeFileSync(path.join(root, "games/_sample/_制作.json"), JSON.stringify({expressionReviewed:false, materials:[]}));
assert.notEqual(run(["sample", "--check"]).status, 0);
assert.notEqual(run(["sample"]).status, 0);
assert.equal(read("games/_local.js"), before);
assert(!fs.existsSync(path.join(root, "games/sample")));
fs.writeFileSync(path.join(root, "games/_sample/_制作.json"), JSON.stringify(record));
var r = run(["sample", "--check"]);
assert.equal(r.status, 0, r.stderr);
assert.equal(read("games/_local.js"), before);
assert(fs.existsSync(path.join(root, "games/_sample/index.html")));
assert(!fs.existsSync(path.join(root, "share/sample")));
r = run(["sample", "--unlisted"]);
assert.equal(r.status, 0, r.stderr);
assert.equal(read("index.html"), original);
assert(read("games/sample/index.html").includes('content="noindex, nofollow"'));
assert.equal(drafts()[0].id, "other");
assert.equal(drafts()[1].play, "games/sample/index.html");
assert(!fs.existsSync(path.join(root, "share/sample")));
assert.equal(run(["sample", "--unlisted"]).status, 0);
fs.writeFileSync(path.join(root, "games/sample/index.html"), read("games/sample/index.html").replace(/\r?\n/g, '\r\n'));
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
fs.writeFileSync(path.join(root, "games/_direct/_制作.json"), JSON.stringify(record));
r = run(["direct"]);
assert.equal(r.status, 0, r.stderr);
assert(read("share/direct/index.html").includes("/#/game/direct"));
var directGame = read("games/direct/index.html"), directShare = read("share/direct/index.html");
r = cp.spawnSync(process.execPath, [path.join(root, "games/_tools/ogp.js"), "direct"], {encoding:"utf8"});
assert.equal(r.status, 0, r.stderr);
assert.equal(read("games/direct/index.html"), directGame);
assert.equal(read("share/direct/index.html"), directShare);
console.log("制作中の公開・正式公開への切り替え・直接公開・他の下書きの保持を確認しました");

/* 生成できない場合は一覧も本体も動かない。 */
fs.mkdirSync(path.join(root, "games/_broken/img"), {recursive:true});
fs.writeFileSync(path.join(root, "games/_broken/index.html"), "<html><head></head></html>");
fs.writeFileSync(path.join(root, "games/_broken/img/thumb.svg"), "<svg/>");
fs.writeFileSync(path.join(root, "games/_local.js"), 'window.DRAFT_GAMES = [{id:"broken", title:"失敗確認", play:"games/_broken/index.html", img:"games/_broken/img/thumb.svg"}];');
var oldIndex = read("index.html"), oldLocal = read("games/_local.js");
assert.notEqual(run(["broken"]).status, 0);
assert.equal(read("index.html"), oldIndex);
assert.equal(read("games/_local.js"), oldLocal);
assert(fs.existsSync(path.join(root, "games/_broken/index.html")));
assert(!fs.existsSync(path.join(root, "games/broken")));
console.log("書き込みなしの事前確認・生成失敗時の保持を確認しました");
