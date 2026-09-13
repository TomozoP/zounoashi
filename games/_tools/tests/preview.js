/* 自動更新が必要なときだけ読み直し、圏外や画面復帰にも対応することを確認する。 */
var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var script = fs.readFileSync(path.resolve(__dirname, "../../../preview/auto-reload.js"), "utf8");
var page = fs.readFileSync(path.resolve(__dirname, "../../../preview/index.html"), "utf8");
assert(page.includes('name="preview-version"'));
assert(page.includes('./auto-reload.js?'));

async function main() {
  var next = "1", ok = true, offline = false, requests = [], moves = [], events = {};
  var interval, seconds;
  var doc = {
    hidden: false,
    querySelector: function () { return { content: "1" }; },
    addEventListener: function (name, fn) { events[name] = fn; }
  };
  vm.runInNewContext(script, {
    document: doc,
    window: { addEventListener: function (name, fn) { events[name] = fn; } },
    location: { href: "https://www.zounoashi.com/preview/?r=abc#test", replace: function (url) { moves.push(url); } },
    URL: URL, AbortController: AbortController, Date: Date,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    setInterval: function (fn, ms) { interval = fn; seconds = ms; },
    DOMParser: function () {
      this.parseFromString = function () { return { querySelector: function () { return next ? { content: next } : null; } }; };
    },
    fetch: async function (url, options) {
      requests.push({ url: url, options: options });
      if (offline) throw new Error("圏外");
      return { ok: ok, text: async function () { return "確認用"; } };
    }
  });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.equal(seconds, 30000);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.cache, "no-store");
  assert.equal(new URL(requests[0].url).hash, "");
  assert.equal(moves.length, 0);
  doc.hidden = true;
  await interval();
  assert.equal(requests.length, 1);
  doc.hidden = false;
  await events.visibilitychange();
  assert.equal(requests.length, 2);
  offline = true;
  await interval();
  offline = false;
  ok = false;
  next = "2";
  await events.online();
  assert.equal(moves.length, 0);
  ok = true;
  next = "";
  await interval();
  assert.equal(moves.length, 0);
  next = "2";
  await events.pageshow();
  assert.equal(moves.length, 1);
  var target = new URL(moves[0]);
  assert.equal(target.searchParams.get("_preview"), "2");
  assert.equal(target.searchParams.get("r"), "abc");
  assert.equal(target.hash, "#test");
  await interval();
  assert.equal(moves.length, 1);
  console.log("更新時だけの読み直し・画面復帰・圏外・配信失敗・URLの保持を確認しました");
}
main().catch(function (error) { console.error(error); process.exitCode = 1; });
