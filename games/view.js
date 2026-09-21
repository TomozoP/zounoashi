/* 縦画面の寸法と入力座標。ゲーム内の配置や3D画面の更新は各ゲームに残す。 */
(function () {
  "use strict";
  window.zGameView = {
    measure: function (wrap, width) {
      var host = wrap.parentNode;
      var vw = host.clientWidth || window.innerWidth;
      var vh = host.clientHeight || window.innerHeight;
      return { width: vw, height: vh,
        gameHeight: Math.max(780, Math.min(1700, Math.round(width * vh / vw))) };
    },
    fit: function (canvas, wrap, ctx, width, height, view) {
      var scale = Math.min(view.width / width, view.height / height);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      wrap.style.width = canvas.style.width = Math.round(width * scale) + "px";
      wrap.style.height = canvas.style.height = Math.round(height * scale) + "px";
      canvas.width = Math.round(width * scale * dpr);
      canvas.height = Math.round(height * scale * dpr);
      var k = canvas.width / width;
      ctx.setTransform(k, 0, 0, k, 0, 0);
    },
    point: function (canvas, event, width, height) {
      var r = canvas.getBoundingClientRect();
      return { x: (event.clientX - r.left) / r.width * width,
        y: (event.clientY - r.top) / r.height * height };
    }
  };
})();
