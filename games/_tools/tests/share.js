/* 共有先のOGPと、診断結果の引き継ぎを確認する。 */
var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var root = path.resolve(__dirname, "../../..");
var script = fs.readFileSync(path.join(root, "games/share.js"), "utf8");
function share(url, parent, native) {
  var result;
  var win = { location: new URL(url), navigator: {}, open: function (to) { result = new URL(to).searchParams.get("url"); return {}; } };
  win.parent = parent ? { location: new URL(parent) } : win;
  if (native) win.navigator = { userAgent: "iPhone", share: function (data) { result = data.url; return Promise.resolve(); } };
  vm.runInNewContext(script, { window: win, URL: URL, URLSearchParams: URLSearchParams });
  win.zShare({ text: "共有の確認", native: !!native });
  return result;
}
var origin = "https://www.zounoashi.com";
assert.equal(share(origin + "/games/wanko/index.html?v=1", origin + "/#/game/wanko"), origin + "/share/wanko/?card=square2");
assert.equal(share(origin + "/games/wanko/", null, true), origin + "/share/wanko/?card=square2");
assert.equal(share(origin + "/games/wanko/", origin + "/#/game/wanko?card=old"), origin + "/share/wanko/?card=square2");
var result = "A".repeat(30);
assert.equal(share(origin + "/games/type16oku/index.html", origin + "/#/game/type16oku?r=" + result), origin + "/share/type16oku/?r=" + result + "&card=square2");
assert.equal(share(origin + "/games/type16oku/index.html?r=" + result), origin + "/share/type16oku/?r=" + result + "&card=square2");
assert.equal(share("http://localhost/games/_new/index.html", "http://localhost/#/game/new"), "http://localhost/#/game/new");
var source = fs.readFileSync(path.join(root, "index.html"), "utf8");
var games = vm.runInNewContext(source.match(/var GAMES = (\[[\s\S]*?\n\]);/)[1], { UR: "", KY: "" }).filter(function (g) { return g.id && g.play; });
games.forEach(function (g) {
  var html = fs.readFileSync(path.join(root, "share", g.id, "index.html"), "utf8");
  var game = fs.readFileSync(path.join(root, g.play), "utf8");
  [html, game].forEach(function (text) {
    assert(text.includes('property="og:title" content="' + g.title + '"'));
    assert.equal((text.match(/property="og:title"/g) || []).length, 1);
    var image = text.match(/property="og:image" content="([^"]+)"/)[1];
    assert(!image.endsWith(".svg"));
    var file = path.join(root, new URL(image).pathname);
    assert(fs.existsSync(file));
    if (/\.svg$/.test(g.img)) {
      var png = fs.readFileSync(file);
      assert.equal(png.readUInt32BE(16), 600);
      assert.equal(png.readUInt32BE(20), 600);
    }
  });
  var to;
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], { location: { search: "?r=" + result, replace: function (url) { to = url; } } });
  assert.equal(to, "/#/game/" + g.id + "?r=" + result);
});
console.log("共有先・診断結果・下書きと、" + games.length + "本のOGPを確認しました");
