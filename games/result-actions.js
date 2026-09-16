/* 結果画面の操作。見た目はゲーム側、共有と保存・クリックの受け口はここに集める。 */
(function (global) {
  'use strict';
  function done(opt, result) { if (opt.done) opt.done(result); }
  function phone() {
    var n = global.navigator || {};
    return /Android|iPhone|iPad|iPod/i.test(n.userAgent || '') ||
      ((n.maxTouchPoints || 0) > 1 && /Mac/i.test(n.platform || ''));
  }
  function download(file, name, opt) {
    var url, a;
    try {
      url = URL.createObjectURL(file);
      a = document.createElement('a');
      a.href = url; a.download = name; a.style.display = 'none';
      document.body.appendChild(a); a.click();
      done(opt, 'saved');
    } catch (e) { done(opt, 'error'); }
    finally {
      if (a && a.parentNode) a.parentNode.removeChild(a);
      if (url) setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }
  }
  var actions = {
    x: function (opt) {
      opt = opt || {};
      zShare({ text: opt.text || '', native: false, done: opt.done });
    },
    canShare: function () { return !!(global.navigator && global.navigator.share); },
    share: function (opt) {
      opt = opt || {};
      if (!actions.canShare()) { done(opt, 'unsupported'); return; }
      var data = { text: opt.text || '', url: global.zShare.pageUrl() };
      try {
        // 非同期の画像生成を挟まず、クリックの中で直接呼ぶ。
        Promise.resolve(global.navigator.share(data)).then(function () { done(opt, 'shared'); },
          function (e) { done(opt, e && e.name === 'AbortError' ? 'cancel' : 'error'); });
      } catch (e) { done(opt, e && e.name === 'AbortError' ? 'cancel' : 'error'); }
    },
    saveImage: function (opt) {
      opt = opt || {};
      var name = opt.name || '結果.png', file;
      try {
        var blob = opt.blob;
        if (!blob) {
          // 画像揚げ・シャークレースの方式。スマホの共有権限を維持する。
          var encoded = atob(opt.canvas.toDataURL('image/png').split(',')[1]);
          var bytes = new Uint8Array(encoded.length);
          for (var i = 0; i < encoded.length; i++) bytes[i] = encoded.charCodeAt(i);
          blob = new Blob([bytes], { type: 'image/png' });
        }
        file = typeof File === 'function' ? new File([blob], name, { type: blob.type || 'image/png' }) : blob;
      } catch (e) { done(opt, 'error'); return; }
      var nav = global.navigator || {}, supported = false;
      try { supported = opt.native !== false && phone() && nav.share && nav.canShare && nav.canShare({ files: [file] }); } catch (e) {}
      if (!supported) { download(file, name, opt); return; }
      try {
        Promise.resolve(nav.share({ files: [file] })).then(function () { done(opt, 'shared'); }, function (e) {
          if (e && e.name === 'AbortError') done(opt, 'cancel');
          else download(file, name, opt);
        });
      } catch (e) {
        if (e && e.name === 'AbortError') done(opt, 'cancel');
        else download(file, name, opt);
      }
    },
    bind: function (button, action) {
      function stop(e) { e.stopPropagation(); }
      function click(e) {
        e.stopPropagation();
        if (!button.hidden && !button.disabled) action();
      }
      // preventDefault はしない。指離しから生じる通常のクリックを残す。
      var events = ['pointerdown', 'pointerup', 'pointercancel', 'keydown', 'keyup'];
      events.forEach(function (name) { button.addEventListener(name, stop); });
      button.addEventListener('click', click);
      return function () {
        events.forEach(function (name) { button.removeEventListener(name, stop); });
        button.removeEventListener('click', click);
      };
    },
    place: function (button, box, width, height, visible) {
      button.hidden = !visible;
      if (!visible) return;
      button.style.left = box.x / width * 100 + '%';
      button.style.top = box.y / height * 100 + '%';
      button.style.width = box.w / width * 100 + '%';
      button.style.height = box.h / height * 100 + '%';
    }
  };
  global.zResultActions = actions;
})(window);
