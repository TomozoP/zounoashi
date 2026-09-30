/* 制作中の固定リンクだけ。上部の「プレビュー」表示に、
   ハッシュタグと本番の共有ページのURLをまとめて写すボタンと、録画パネルを開くボタンを付ける。
   タグは題名から「【プレビュー】」と空白・中黒などを除いて作る。 */
(function () {
  "use strict";
  var label = document.getElementById("preview-label");
  if (!label) return;

  function tag() {
    var name = document.title.replace(/【プレビュー】/g, "").replace(/[\s・･·•、，,.。]/g, "");
    return name ? "#" + name : "";
  }
  function link() {
    if (window.zShare && window.zShare.pageUrl) return window.zShare.pageUrl();
    var version = document.querySelector('meta[name="preview-version"]');
    var id = version && /^([a-z0-9-]+?)-\d+$/.exec(version.content || "");
    return id ? location.origin + "/share/" + id[1] + "/?card=square2" : "";
  }
  function text() { return [tag(), link()].filter(Boolean).join("\n"); }

  /* 使えない端末では、選んだ文字を写す古い方法に下りる */
  function copy(value) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(value).catch(function () { return old(value); });
    }
    return Promise.resolve().then(function () { return old(value); });
  }
  function old(value) {
    var area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, value.length);
    var done = false;
    try { done = document.execCommand("copy"); } catch (e) {}
    area.remove();
    if (!done) throw new Error("copy");
  }

  var style = document.createElement("style");
  style.textContent =
    "#preview-copy{position:absolute;right:6px;top:50%;transform:translateY(-50%);pointer-events:auto;" +
    "padding:2px 10px;border:0;border-radius:999px;background:#fff;color:#e8443a;" +
    "font:bold 12px sans-serif;letter-spacing:0;cursor:pointer;touch-action:manipulation}" +
    "#preview-copy:focus-visible,#preview-rec:focus-visible{outline:2px solid #16202e;outline-offset:2px}" +
    "#preview-rec{position:absolute;left:6px;top:50%;transform:translateY(-50%);pointer-events:auto;" +
    "padding:2px 10px;border:0;border-radius:999px;background:#fff;color:#e8443a;" +
    "font:bold 12px sans-serif;letter-spacing:0;cursor:pointer;touch-action:manipulation}";
  document.head.appendChild(style);

  var button = document.createElement("button");
  button.id = "preview-copy";
  button.type = "button";
  button.textContent = "コピー";
  button.setAttribute("aria-label", "ハッシュタグと共有リンクをコピー");
  label.appendChild(button);

  var rec = document.createElement("button");
  rec.id = "preview-rec";
  rec.type = "button";
  rec.textContent = "録画";
  rec.setAttribute("aria-label", "録画パネルを開く");
  label.appendChild(rec);
  rec.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (window.zRecorder) window.zRecorder.toggle();
    rec.blur();
  });

  /* 開始待ちのタップやゲームの操作に流さない。window で先に受け止める */
  ["pointerdown", "pointerup", "touchstart", "touchend", "mousedown", "mouseup"].forEach(function (name) {
    window.addEventListener(name, function (e) {
      if (e.target === button || e.target === rec) e.stopImmediatePropagation();
    }, true);
  });

  var timer = null;
  function show(word) {
    button.textContent = word;
    clearTimeout(timer);
    timer = setTimeout(function () { button.textContent = "コピー"; }, 1500);
  }
  button.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    copy(text()).then(function () { show("コピーしました"); }, function () { show("コピーできません"); });
    button.blur();
  });

  window.zPreviewCopy = { text: text };
})();
