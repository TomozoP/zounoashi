/* 制作中のページだけ、公開された版が変わったら読み直す。 */
(function () {
  "use strict";
  var current = document.querySelector('meta[name="preview-version"]');
  if (!current) return;
  var version = current.content;
  var busy = false;
  var moving = false;

  async function check() {
    if (document.hidden || busy || moving) return;
    busy = true;
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 10000);
    try {
      var url = new URL(location.href);
      url.hash = "";
      url.searchParams.set("_preview", String(Date.now()));
      var response = await fetch(url.href, { cache: "no-store", signal: controller.signal });
      if (!response.ok) return;
      var html = new DOMParser().parseFromString(await response.text(), "text/html");
      var next = html.querySelector('meta[name="preview-version"]');
      if (!next || !next.content || next.content === version) return;
      /* 戻る履歴を増やさず、古いページの保存も避ける。 */
      var target = new URL(location.href);
      target.searchParams.set("_preview", next.content);
      moving = true;
      location.replace(target.href);
    } catch (e) {
      /* 圏外や公開の切り替え中は、そのまま遊べるよう次の確認を待つ。 */
    } finally {
      clearTimeout(timeout);
      busy = false;
    }
  }

  setInterval(check, 30000);
  document.addEventListener("visibilitychange", check);
  window.addEventListener("pageshow", check);
  window.addEventListener("online", check);
  check();
})();
