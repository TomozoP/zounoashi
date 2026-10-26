/* 結果画面の操作。見た目はゲーム側、共有と保存・クリックの受け口はここに集める。 */
(function (global) {
  'use strict';
  var placements = new WeakMap();
  function placeStyle(button, key, value, previous) {
    // ブラウザが小数を丸めても、同じ指定を繰り返し書き込まない。
    if (previous[key] === value && previous[key + 'Applied'] === button.style[key]) return;
    button.style[key] = value;
    previous[key] = value;
    previous[key + 'Applied'] = button.style[key];
  }
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
    /* 結果ボタンの横並び。ids は左から（"retry" "share" "next" など）。y はボタンの上端。 */
    row: function (W, y, ids) {
      ids = ids || ['retry', 'share'];
      var h = 54, gap = 16, label = { retry: 'もう一度', share: 'Xでシェア', next: '次' };
      var ws = ids.map(function (id) { return id === 'share' ? 224 : 170; });
      if (ids.length > 2) ws = ws.map(function () { return 120; });
      var total = ws.reduce(function (a, b) { return a + b; }, 0) + gap * (ws.length - 1), x = W / 2 - total / 2;
      return ids.map(function (id, i) {
        var b = { id: id, x: x, y: y, w: ws[i], h: h, label: label[id] || id };
        x += ws[i] + gap;
        return b;
      });
    },
    /* 作品を見せる結果画面の並び（アフロ盆栽・スキー炒飯の形）。暗くせず、
       文字は上端から順に積み、ボタンは下、その間を作品の枠にする。
       sizes は上から各行の文字の大きさ。返す lines[i].y は textBaseline "top" で使う。 */
    showcase: function (W, H, opt) {
      opt = opt || {};
      var sizes = opt.sizes || [96, 30], y = Math.max(18, H * 0.03), lines = [];
      sizes.forEach(function (s) { lines.push({ y: y, size: s }); y += Math.round(s * 1.12); });
      var by = H - 54 - Math.max(24, H * 0.05), pad = 12;
      var top = y + pad, bottom = by - pad;
      return {
        lines: lines,
        subject: { x: 0, y: top, w: W, h: Math.max(0, bottom - top), cx: W / 2, cy: (top + bottom) / 2 },
        buttons: actions.row(W, by, opt.buttons)
      };
    },
    /* ボタン列の下の控えめな「作者をフォロー」。ほかのボタンと同じ白地・濃い縁で小さめ。
       link(parent) で透明のリンクを作って重ね、place(link, followBox(...), ...) で位置を合わせる。 */
    follow: {
      url: 'https://x.com/intent/follow?screen_name=TomozoP',
      text: function () { return global.zT ? global.zT('作者をフォロー', 'Follow the creator', '제작자 팔로우', '关注作者', '追蹤作者') : '作者をフォロー'; },
      /* self を true にすると、リンク自体がボタンの絵を持つ（キャンバスに描かない過去作用。at で位置を合わせる） */
      link: function (parent, self) {
        var a = document.createElement('a');
        a.href = actions.follow.url; a.target = '_blank'; a.rel = 'noopener';
        a.setAttribute('aria-label', actions.follow.text()); a.hidden = true;
        a.style.cssText = 'position:absolute;border-radius:999px;touch-action:manipulation;';
        if (self) {
          try {
            var m = document.createElement('canvas').getContext('2d'), f = actions.follow.box(m, [{ y: 0, h: 0 }], 0), k = 3;
            var c = document.createElement('canvas'); c.width = Math.ceil(f.w * k + 6); c.height = Math.ceil(f.h * k + 6);
            var g = c.getContext('2d'); g.scale(k, k); actions.follow.draw(g, { x: 1, y: 1, w: f.w, h: f.h });
            a.style.backgroundImage = 'url(' + c.toDataURL() + ')';
            a.style.backgroundSize = '100% 100%';
            a.style.backgroundRepeat = 'no-repeat';
            a.style.zIndex = '3';
            a._followSize = { w: f.w + 2, h: f.h + 2 };
          } catch (e) {}
        }
        if (parent && parent.appendChild) parent.appendChild(a);
        return a;
      },
      /* 結果ボタンを自前で描く過去作用：結果画面を描くたびに show(canvas, ボタン, W, H) を呼ぶ。
         呼ばれなくなると自動で隠れる。ボタン {x,y,w,h} でも円 {x,y,r} でもよい */
      show: function (canvas, button, W, H) {
        if (!canvas || !button) return;
        var f = actions.follow, a = f._shown;
        if (!a) {
          if (!document.body || !canvas.getBoundingClientRect) return;
          a = f._shown = f.link(document.body, true);
          a.style.position = 'fixed';
        }
        /* 次のコマまでに show が呼ばれなければ隠す（時間でなくコマで見る） */
        a._mark = true;
        if (!a._watch && global.requestAnimationFrame) {
          a._watch = true;
          global.requestAnimationFrame(function check() {
            global.requestAnimationFrame(function () {
              if (!a._mark) { a.hidden = true; a._watch = false; return; }
              a._mark = false; check();
            });
          });
        }
        var b = button.r != null ? { x: button.x - button.r, y: button.y - button.r, w: button.r * 2, h: button.r * 2 } : button;
        var r = canvas.getBoundingClientRect(), k = r.width / W, s = a._followSize;
        if (!s || !k) return;
        var y = b.y + b.h + 40;
        if (y + s.h > H - 8) y = Math.max(b.y + b.h + 8, H - 8 - s.h);
        if (y + s.h > H - 2) y = b.y - 12 - s.h;
        a.style.left = (r.left + (W / 2 - s.w / 2) * k) + 'px'; a.style.top = (r.top + y * (r.height / H)) + 'px';
        a.style.width = s.w * k + 'px'; a.style.height = s.h * (r.height / H) + 'px';
        a.hidden = false;
      },
      /* 過去作用：button（結果ボタンのどれか）の下に置く。画面の下に入らなければ間を詰め、それでも無理ならボタンの上に置く */
      at: function (link, button, W, H, visible) {
        if (!link) return;
        if (!visible || !button || !link._followSize) { actions.place(link, { x: 0, y: 0, w: 0, h: 0 }, W, H, false); return; }
        var s = link._followSize, y = button.y + button.h + 40;
        if (y + s.h > H - 8) y = Math.max(button.y + button.h + 8, H - 8 - s.h);
        if (y + s.h > H - 2) y = button.y - 12 - s.h;
        actions.place(link, { x: W / 2 - s.w / 2, y: y, w: s.w, h: s.h }, W, H, true);
      },
      box: function (ctx, buttons, W) {
        var b = buttons[0];
        ctx.save(); ctx.font = '700 18px sans-serif';
        var w = ctx.measureText(actions.follow.text()).width + 56;
        ctx.restore();
        return { x: W / 2 - w / 2, y: b.y + b.h + 40, w: w, h: 34 };
      },
      draw: function (ctx, f) {
        var r = f.h / 2;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(f.x + r, f.y); ctx.lineTo(f.x + f.w - r, f.y);
        ctx.arc(f.x + f.w - r, f.y + r, r, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(f.x + r, f.y + f.h);
        ctx.arc(f.x + r, f.y + r, r, Math.PI / 2, Math.PI * 1.5);
        ctx.closePath();
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#16202e'; ctx.stroke();
        ctx.fillStyle = '#16202e'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        if (!global.zActionIcon || !global.zActionIcon(ctx, 'Xでシェア', f.x + 22, f.y + r, 18)) { ctx.font = '900 17px sans-serif'; ctx.fillText('X', f.x + 14, f.y + r + 1); }
        ctx.font = '700 18px sans-serif'; ctx.fillText(actions.follow.text(), f.x + 38, f.y + r + 1);
        ctx.restore();
      }
    },
    hit: function (buttons, x, y) {
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
      }
      return null;
    },
    /* 白地・濃い縁・丸い両端のボタンにアイコンだけを描く（決めごとの形）。 */
    drawButtons: function (ctx, buttons) {
      buttons.forEach(function (b) {
        var r = b.h / 2;
        ctx.save();
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
        ctx.beginPath();
        ctx.moveTo(-b.w / 2 + r, -r); ctx.lineTo(b.w / 2 - r, -r);
        ctx.arc(b.w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-b.w / 2 + r, r);
        ctx.arc(-b.w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5);
        ctx.closePath();
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#16202e'; ctx.stroke();
        ctx.fillStyle = '#16202e';
        ctx.font = '800 24px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (!global.zActionIcon || !global.zActionIcon(ctx, b.label, 0, 1, 30)) ctx.fillText(b.label, 0, 1);
        ctx.restore();
      });
    },
    place: function (button, box, width, height, visible) {
      if (button.hidden !== !visible) button.hidden = !visible;
      if (!visible) return;
      // 動かない結果画面では、同じ表示指定を毎コマ書き直さない。
      var left = box.x / width * 100 + '%', top = box.y / height * 100 + '%';
      var w = box.w / width * 100 + '%', h = box.h / height * 100 + '%';
      var previous = placements.get(button);
      if (!previous) { previous = {}; placements.set(button, previous); }
      placeStyle(button, 'left', left, previous);
      placeStyle(button, 'top', top, previous);
      placeStyle(button, 'width', w, previous);
      placeStyle(button, 'height', h, previous);
    }
  };
  global.zResultActions = actions;
})(window);
