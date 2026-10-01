/* 猫を立体で描き、主画面（2Dのcanvas）へ重ねる。録画にもそのまま入る。
   模型はすべて基本図形から自作。three.js は random-bowling の既存配布物（MIT）を使う。 */
(function (global) {
  "use strict";
  function CatScene() {
    var T = global.THREE, self = this;
    this.renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(0, 0);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.scene = new T.Scene();
    this.camera = new T.OrthographicCamera(0, 540, 0, -960, 1, 3000);
    this.camera.position.set(0, 0, 1000);
    this.scene.add(new T.HemisphereLight(0xc8d4ff, 0x30283a, 1.6));
    var moon = new T.DirectionalLight(0xfff2d0, 2.4); moon.position.set(300, 500, 600); this.scene.add(moon);
    var rim = new T.DirectionalLight(0x8fb0ff, 1.2); rim.position.set(-400, 200, -300); this.scene.add(rim);
    this.ball = new T.SphereGeometry(1, 24, 16);
    this.tube = new T.CylinderGeometry(1, 0.8, 1, 12);
    this.cone = new T.ConeGeometry(1, 1, 4);
    this.mats = {};
    this.mat = function (color, emissive) {
      var key = color + "-" + !!emissive;
      if (!self.mats[key]) {
        self.mats[key] = new T.MeshStandardMaterial({ color: color, roughness: emissive ? 0.3 : 0.85, metalness: 0,
          emissive: emissive ? color : 0x000000, emissiveIntensity: emissive ? 0.8 : 0 });
      }
      return self.mats[key];
    };
    this.cats = [this.makeCat(), this.makeCat()];
  }

  CatScene.prototype.makeCat = function () {
    var T = global.THREE, self = this, g = new T.Group();
    this.scene.add(g);
    var c = { g: g, color: null, parts: [] };
    function part(parent, geo, x, y, z, sx, sy, sz, role) {
      var m = new T.Mesh(geo, self.mat(0xffffff));
      m.position.set(x, y, z); m.scale.set(sx, sy, sz);
      m.userData.role = role || "body";
      parent.add(m); c.parts.push(m); return m;
    }
    c.body = part(g, this.ball, 0, 62, 0, 58, 28, 26);
    c.back = part(g, this.ball, -4, 78, 0, 42, 20, 22);
    c.chest = part(g, this.ball, 36, 64, 0, 26, 28, 24);
    c.hips = part(g, this.ball, -38, 64, 0, 24, 26, 24);
    /* 逆立つ毛 */
    c.spikes = [];
    for (var i = 0; i < 9; i++) {
      var sp = part(g, this.cone, -48 + i * 12, 90, (i % 2 ? 6 : -6), 7, 16, 7);
      sp.userData.i = i; c.spikes.push(sp);
    }
    /* 脚 */
    c.legs = [[-38, 12], [-30, -12], [32, 12], [40, -12]].map(function (p) {
      var pivot = new T.Group(); pivot.position.set(p[0], 48, p[1]); g.add(pivot);
      part(pivot, self.tube, 0, -24, 0, 7, 48, 7);
      part(pivot, self.ball, 2, -48, 0, 9, 5, 8);
      return pivot;
    });
    /* しっぽ（球をつないだ鎖） */
    c.tail = [];
    for (i = 0; i < 18; i++) c.tail.push(part(g, this.ball, 0, 0, 0, 8, 8, 8));
    /* 頭 */
    c.head = new T.Group(); c.head.position.set(66, 82, 0); c.head.scale.setScalar(1.25); g.add(c.head);
    part(c.head, this.ball, 0, 0, 0, 27, 24, 25);
    part(c.head, this.ball, 18, -7, 0, 14, 11, 15);              /* 口もと */
    c.mouth = part(c.head, this.ball, 25, -10, 0, 9, 2, 10, "mouth");
    c.fangs = [-5, 5].map(function (z) { return part(c.head, self.cone, 29, -7, z, 2, -6, 2, "fang"); });
    c.nose = part(c.head, this.ball, 30, -2, 0, 3.5, 3, 4.5, "nose");
    c.ears = [-12, 12].map(function (z) {
      var pivot = new T.Group(); pivot.position.set(-2, 16, z); c.head.add(pivot);
      part(pivot, self.cone, 0, 12, 0, 13, 26, 9);
      return pivot;
    });
    c.eyes = [-11, 11].map(function (z) {
      var e = part(c.head, self.ball, 17, 7, z, 6, 7, 6, "eye");
      part(c.head, self.ball, 22.5, 7, z * 1.05, 1.4, 5.5, 2, "pupil");
      return e;
    });
    return c;
  };

  CatScene.prototype.paint = function (c, col) {
    if (c.color === col) return;
    c.color = col;
    var self = this, body = parseInt(col.body.slice(1), 16), eye = parseInt(col.eye.slice(1), 16);
    c.parts.forEach(function (m) {
      var r = m.userData.role;
      m.material = r === "mouth" ? self.mat(0x3a0e14) : r === "fang" ? self.mat(0xffffff)
        : r === "nose" ? self.mat(0xd07a80) : r === "eye" ? self.mat(eye, true) : r === "pupil" ? self.mat(0x111111) : self.mat(body);
    });
  };

  /* s: {x, y, face(1:右), size, puff, open, run, t, col} */
  CatScene.prototype.pose = function (c, s) {
    this.paint(c, s.col);
    var g = c.g, run = s.run > 0;
    g.visible = true;
    g.position.set(s.x, -s.y, 0);
    g.scale.setScalar(s.size);
    var face = run ? -s.face : s.face;
    g.rotation.y = face > 0 ? -0.5 : Math.PI + 0.5;
    var puff = s.puff, arch = run ? 0 : puff;
    c.back.position.y = 74 + arch * 14;
    c.back.scale.set(42, 18 + arch * 10, 22 + puff * 6);
    c.body.scale.set(58, 28 + puff * 4, 26 + puff * 6);
    c.spikes.forEach(function (sp) {
      var i = sp.userData.i, u = (i - 4) / 4;
      sp.visible = !run && puff > 0.35;
      sp.position.set(-48 + i * 12, 82 + arch * 14 * (1 - u * u) + 6, sp.position.z);
      sp.scale.set(6, 8 + puff * 16, 6);
      sp.rotation.z = -u * 0.5;
    });
    var legPh = run ? Math.sin(s.run * 30) : 0;
    c.legs.forEach(function (l, i) { l.rotation.z = legPh * 0.7 * (i % 2 ? 1 : -1); });
    /* しっぽ：逃げるときは後ろへ流し、威嚇中は高く立てて太らせる */
    for (var k = 0; k < c.tail.length; k++) {
      var u2 = k / (c.tail.length - 1), x, y;
      if (run) { x = -56 - u2 * 70; y = 70 - u2 * 10 + Math.sin(s.t * 20 + u2 * 4) * 6; }
      else { x = -58 - Math.sin(u2 * 1.6) * 26; y = 74 + u2 * (90 + puff * 20) + Math.sin(s.t * 3 + u2 * 3) * 3; }
      c.tail[k].position.set(x, y, 0);
      c.tail[k].scale.setScalar(7 + puff * 6 + (run ? 0 : 1));
    }
    c.head.position.y = run ? 74 : 82;
    c.head.rotation.z = run ? -0.2 : s.open * 0.25;
    c.mouth.scale.set(9, 2 + s.open * 12, 10);
    c.mouth.position.y = -10 - s.open * 5;
    c.fangs.forEach(function (f) { f.visible = s.open > 0.3; });
    c.ears.forEach(function (e, i) { e.rotation.x = 0; e.rotation.z = s.open > 0.05 || puff > 0.6 ? 1.1 : 0.1; });
    c.eyes.forEach(function (e) { e.scale.y = 7 - s.open * 3; });
    c.head.rotation.y = run ? 0 : (face > 0 ? -0.35 : 0.35);   /* 顔を少しこちらへ向ける */
  };

  CatScene.prototype.render = function (ctx, canvas, W, H, cats) {
    var w = canvas.width, h = canvas.height;
    if (this.renderer.domElement.width !== w || this.renderer.domElement.height !== h) this.renderer.setSize(w, h, false);
    this.camera.right = W; this.camera.bottom = -H; this.camera.updateProjectionMatrix();
    var self = this;
    this.cats.forEach(function (c, i) { if (cats[i]) self.pose(c, cats[i]); else c.g.visible = false; });
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
  };

  global.CatScene = CatScene;
})(window);
