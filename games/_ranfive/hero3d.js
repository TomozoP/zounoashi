/* 運任戦士ランダムファイブの立体（戦士と怪人だけ）。games/three-base.js の Z3 を土台にする。
   背景・文字・リール・ボタンは index.html の2Dのまま。
   2Dと同じ座標（横540・下向きがプラス）で置けるよう、正射影のカメラで canvas の画素＝立体の1単位にする。
   使い方: begin() → hero(...) / monster(...) を置く → flush(ctx, W, H) で一度に描いて2Dの上に写す。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var OL = 0x16202e;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function RF3D() {
    T = global.THREE;
    var r = this.renderer = Z3.renderer({ alpha: true, antialias: true });
    this.scene = new T.Scene();
    this.camera = new T.OrthographicCamera(0, 540, 0, -960, 1, 4000);
    this.camera.position.set(0, 0, 2000);
    this.scene.add(new T.HemisphereLight(0xffffff, 0x6a5a48, 1.4));
    var key = new T.DirectionalLight(0xffffff, 2.2);
    key.position.set(-0.6, 0.9, 1); this.scene.add(key);
    var rim = new T.DirectionalLight(0xdfe8ff, 0.8);
    rim.position.set(0.8, 0.3, -0.4); this.scene.add(rim);
    this.outlineMat = new T.MeshBasicMaterial({ color: OL, side: T.BackSide });
    this.rainbow = Z3.canvasTex(256, 16, function (g, w, h) {
      ["#e60012", "#ff7a00", "#ffd400", "#00a040", "#0068d9", "#7d2ccf"].forEach(function (c, i) { g.fillStyle = c; g.fillRect(i * w / 6, 0, w / 6 + 1, h); });
    });
    this.rainbow.wrapS = T.RepeatWrapping; this.rainbow.repeat.set(2, 1);
    this.heroes = []; this.used = 0;
    /* 怪人は消えていくときに透けるので、縁取りの材質を戦士と分ける */
    var heroOL = this.outlineMat;
    this.outlineMat = new T.MeshBasicMaterial({ color: OL, side: T.BackSide });
    this.boss = this.makeMonster(); this.boss.visible = false; this.scene.add(this.boss);
    this.outlineMat = heroOL;
    this.w = this.h = 0;
  }

  /* 部品に縁取り（裏返した少し大きい黒）を付けて足す */
  RF3D.prototype.part = function (parent, geo, mat, outline) {
    var m = new T.Mesh(geo, mat);
    parent.add(m);
    if (outline !== false) {
      var o = new T.Mesh(geo, this.outlineMat);
      o.scale.setScalar(1);
      o.userData.ol = outline || 3.2;
      m.add(o);
      m.userData.outline = o;
    }
    return m;
  };
  function fitOutline(m) {
    var o = m.userData.outline; if (!o) return;
    /* 部品の大きさに合わせて、だいたい同じ太さの縁にする */
    var g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    var rr = g.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z) || 1;
    o.scale.setScalar(1 + o.userData.ol / rr);
  }

  RF3D.prototype.makeHero = function () {
    var g = new T.Group(), self = this;
    var body = new T.MeshToonMaterial({ color: 0xd6d8dd, side: T.DoubleSide });
    var acc = new T.MeshToonMaterial({ color: 0xffffff, side: T.DoubleSide });
    var dark = new T.MeshToonMaterial({ color: 0x1b2230 });
    var gold = new T.MeshToonMaterial({ color: 0xe9c341 });
    var h = { g: g, body: body, acc: acc, segs: [], hands: [], boots: [] };
    /* 手足は高さ1の円柱を長さぶん伸ばす。関節は球でつなぐ */
    h.joints = [];
    for (var i = 0; i < 8; i++) {
      var rad = i < 4 ? 9.5 : 12;
      var s = this.part(g, new T.CylinderGeometry(rad, rad, 1, 12), body, 3);
      s.userData.r = rad;
      h.segs.push(s);
    }
    for (var k = 0; k < 6; k++) {
      var jr = k < 4 ? 9.5 : 12;
      var jt = this.part(g, new T.SphereGeometry(jr, 12, 10), body, 3); fitOutline(jt);
      h.joints.push(jt);
    }
    h.torso = this.part(g, new T.CapsuleGeometry(30, 34, 6, 14), body, 3);
    h.torso.scale.set(1.12, 1, 0.72);
    h.torso.position.set(0, 133, 0);
    h.head = this.part(g, new T.SphereGeometry(27, 18, 14), body, 3);
    h.head.position.set(0, 205, 0);
    /* ヘルメットの目（T字） */
    var v1 = new T.Mesh(new T.BoxGeometry(44, 14, 10), dark); v1.position.set(0, 7, 23); h.head.add(v1);
    var v2 = new T.Mesh(new T.BoxGeometry(11, 26, 10), dark); v2.position.set(0, -10, 22); h.head.add(v2);
    /* ベルトとバックル */
    h.belt = this.part(g, new T.CylinderGeometry(33, 33, 12, 18), acc, 2.5);
    h.belt.scale.set(1.05, 1, 0.74); h.belt.position.set(0, 98, 0);
    var bk = new T.Mesh(new T.BoxGeometry(18, 15, 8), gold); bk.position.set(0, 98, 25); g.add(bk);
    /* 胸のV */
    [-1, 1].forEach(function (d) {
      var vb = new T.Mesh(new T.BoxGeometry(34, 7, 6), acc);
      vb.position.set(d * 13, 154, 22); vb.rotation.z = d * 0.85; g.add(vb);
    });
    for (var j = 0; j < 2; j++) {
      var hd = this.part(g, new T.SphereGeometry(13, 12, 10), acc, 2.5); h.hands.push(hd);
      var bt = this.part(g, new T.BoxGeometry(30, 28, 38), acc, 2.5); h.boots.push(bt);
    }
    [h.torso, h.head, h.belt].concat(h.hands, h.boots).forEach(fitOutline);
    this.scene.add(g);
    return h;
  };

  function place(seg, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
    seg.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
    seg.rotation.set(0, 0, Math.atan2(dy, dx) - Math.PI / 2);
    seg.scale.set(1, len, 1);
    var o = seg.userData.outline, rr = seg.userData.r || 10;
    if (o) o.scale.set(1 + 3 / rr, 1, 1 + 3 / rr);
  }

  RF3D.prototype.begin = function () { this.used = 0; this.boss.visible = false; };

  /* 戦士を1人置く。x,y は2Dの足元、s は2Dの大きさ。col は "#rrggbb" か "rainbow"、acc は手袋などの色 */
  RF3D.prototype.hero = function (x, y, s, col, acc, p, rot, flip, both) {
    var h = this.heroes[this.used];
    if (!h) { h = this.makeHero(); this.heroes.push(h); }
    this.used++;
    h.g.visible = true;
    if (col === "rainbow") { if (h.body.map !== this.rainbow) { h.body.map = this.rainbow; h.body.color.set(0xffffff); h.body.needsUpdate = true; } }
    else { if (h.body.map) { h.body.map = null; h.body.needsUpdate = true; } h.body.color.set(col); }
    h.acc.color.set(acc);
    /* 関節（2Dの heroBody と同じ。上向きをプラスにする） */
    var sh = [[-30, 162], [30, 162]];
    var hand = [[lerp(-42, both ? -74 : -10, p), lerp(98, both ? 236 : 150, p)], [lerp(42, 74, p), lerp(98, 236, p)]];
    var elbow = [[lerp(-44, both ? -56 : -46, p), lerp(130, both ? 196 : 140, p)], [lerp(44, 56, p), lerp(130, 196, p)]];
    var hip = [[-15, 100], [15, 100]];
    var knee = [[lerp(-19, -30, p), 50], [lerp(19, 30, p), 50]];
    var foot = [[lerp(-21, -44, p), 14], [lerp(21, 44, p), 14]];
    for (var i = 0; i < 2; i++) {
      place(h.segs[i * 2], sh[i], elbow[i]); place(h.segs[i * 2 + 1], elbow[i], hand[i]);
      place(h.segs[4 + i * 2], hip[i], knee[i]); place(h.segs[4 + i * 2 + 1], knee[i], foot[i]);
      h.hands[i].position.set(hand[i][0], hand[i][1], 4);
      h.joints[i].position.set(elbow[i][0], elbow[i][1], 0);
      h.joints[2 + i].position.set(sh[i][0], sh[i][1], 0);
      h.joints[4 + i].position.set(knee[i][0], knee[i][1], 0);
      h.boots[i].position.set(foot[i][0], foot[i][1], 4);
    }
    h.g.position.set(x, -y, 400 + y * 0.6);
    h.g.scale.set(s * (flip ? -1 : 1), s, s);
    /* 少しだけ斜めにして立体に見せる */
    h.g.rotation.set(0.12, (x / 540 - 0.5) * -0.5, -(rot || 0));
  };

  RF3D.prototype.makeMonster = function () {
    var g = new T.Group();
    var purple = new T.MeshToonMaterial({ color: 0x7a36a8 });
    var arm = new T.MeshToonMaterial({ color: 0x5a2a7a });
    var bone = new T.MeshToonMaterial({ color: 0xe8e2cf });
    var eye = new T.MeshBasicMaterial({ color: 0xffe14d });
    var mouth = new T.MeshToonMaterial({ color: 0x2a0b33 });
    var white = new T.MeshToonMaterial({ color: 0xffffff });
    var body = this.part(g, new T.SphereGeometry(1, 28, 20), purple, 5);
    body.scale.set(110, 140, 90); body.userData.outline.scale.setScalar(1.04);
    [-1, 1].forEach(function (d) {
      var a = this.part(g, new T.SphereGeometry(1, 16, 12), arm, 4);
      a.scale.set(34, 70, 34); a.position.set(d * 122, 10, -10); a.rotation.z = -d * 0.5; a.userData.outline.scale.setScalar(1.08);
      var horn = this.part(g, new T.ConeGeometry(18, 90, 12), bone, 3);
      horn.position.set(d * 70, 160, 0); horn.rotation.z = -d * 0.45; fitOutline(horn);
      var e = new T.Mesh(new T.CircleGeometry(20, 3), eye);
      e.position.set(d * 38, 62, 86); e.rotation.z = d > 0 ? Math.PI / 2 + 0.3 : -Math.PI / 2 - 0.3; e.scale.set(1.4, 0.8, 1);
      g.add(e);
    }, this);
    var m = new T.Mesh(new T.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mouth);
    m.scale.set(58, 40, 20); m.position.set(0, -10, 80); g.add(m);
    for (var i = -3; i <= 3; i++) {
      var t = new T.Mesh(new T.ConeGeometry(5, 14, 4), white);
      t.position.set(i * 15, -16, 92 - Math.abs(i) * 3); t.rotation.x = Math.PI; g.add(t);
    }
    g.userData.mouth = m;
    return g;
  };

  /* 怪人。x,y は2Dの体の中心、s は2Dの大きさ、alpha は消えていくとき */
  RF3D.prototype.monster = function (x, y, s, hurt, alpha, t) {
    var g = this.boss;
    g.visible = true;
    g.position.set(x, -y, 300);
    g.scale.setScalar(s);
    g.rotation.set(0.1, Math.sin(t * 1.3) * 0.25, 0);
    g.userData.mouth.scale.y = hurt ? 22 : 40;
    var op = alpha == null ? 1 : alpha;
    g.traverse(function (o) {
      if (!o.material) return;
      o.material.transparent = op < 1; o.material.opacity = op;
    });
  };

  RF3D.prototype.flush = function (ctx, W, H) {
    for (var i = this.used; i < this.heroes.length; i++) this.heroes[i].g.visible = false;
    if (!this.used && !this.boss.visible) return true;
    var dpr = Z3.dpr(1.5), w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (!(w >= 2 && h >= 2)) return false;
    if (w !== this.w || h !== this.h) {
      this.renderer.setSize(w, h, false); this.w = w; this.h = h;
      this.camera.right = W; this.camera.bottom = -H; this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
    this.used = 0; this.boss.visible = false;
    return true;
  };

  global.RF3D = RF3D;
})(window);
