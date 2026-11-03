/* 肉体言語の立体（マッチョ）。games/three-base.js の Z3 を土台にする。
   関節の位置はゲーム側（index.html の joints()）で計算して sync で渡す。ここは見た目だけ。
   単位はだいたい cm（身長 180 くらい）。x は画面の右がプラス、y は上、z は手前。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var UP;

  function GameScene() {
    T = global.THREE;
    UP = new T.Vector3(0, 1, 0);
    var st = this.stage = new Z3.Stage({ renderer: { alpha: true, tone: "aces", exposure: 1.05 }, camera: { fov: 30, near: 20, far: 4000 } });
    this.scene = st.scene;
    this.camera = st.camera;
    var sc = this.scene;
    sc.add(new T.HemisphereLight(0xfff1e0, 0x3a2c24, 1.0));
    var key = new T.DirectionalLight(0xfff4e6, 2.8); key.position.set(-160, 260, 320); sc.add(key);
    var rimA = new T.DirectionalLight(0xffc98a, 2.2); rimA.position.set(260, 140, -220); sc.add(rimA);
    var rimB = new T.DirectionalLight(0x9cc4ff, 1.4); rimB.position.set(-280, 120, -180); sc.add(rimB);
    var fill = new T.DirectionalLight(0xffffff, 0.6); fill.position.set(200, 40, 300); sc.add(fill);

    var skin = this.skin = new T.MeshStandardMaterial({ color: 0xc07f55, roughness: 0.36, metalness: 0.04 });
    var trunks = new T.MeshStandardMaterial({ color: 0x1d3f9a, roughness: 0.45 });
    var hair = new T.MeshStandardMaterial({ color: 0x17110d, roughness: 0.7 });
    var dark = new T.MeshStandardMaterial({ color: 0x1a120e, roughness: 0.5 });
    var white = new T.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.3 });
    function ball(parent, r, x, y, z, sx, sy, sz, mat, seg) {
      var m = new T.Mesh(new T.SphereGeometry(r, seg || 20, Math.round((seg || 20) * 0.75)), mat || skin);
      m.position.set(x, y, z); m.scale.set(sx || 1, sy || 1, sz || 1); parent.add(m); return m;
    }
    function tube(parent, r0, r1, y0, y1, mat, x, z) {
      var m = new T.Mesh(new T.CylinderGeometry(r1, r0, y1 - y0, 18), mat || skin);
      m.position.set(x || 0, (y0 + y1) / 2, z || 0); parent.add(m); return m;
    }

    /* 胴体（骨盤の位置が原点） */
    var torso = this.torso = new T.Group(); sc.add(torso);
    ball(torso, 1, 0, 0, 0, 17.5, 11, 12.5, trunks);
    tube(torso, 14.5, 15.5, 4, 30);
    for (var r = 0; r < 3; r++) for (var c = -1; c <= 1; c += 2) ball(torso, 1, c * 4.6, 10 + r * 7.2, 12.3, 4.4, 3.5, 2.4, skin, 14);
    ball(torso, 1, 0, 44, 0, 25, 18, 15);                     /* 胸郭 */
    [-1, 1].forEach(function (d) {
      ball(torso, 1, d * 9.8, 46, 9.5, 11.5, 8.6, 6.2);         /* 大胸筋 */
      ball(torso, 1, d * 17.5, 35, -2, 9.5, 17, 8);             /* 広背筋 */
      ball(torso, 1, d * 15, 18, 6, 4.5, 7, 4);                 /* 腹斜筋 */
      ball(torso, 1, d * 23.5, 55, 0, 10.5, 10, 10);            /* 三角筋 */
    });
    ball(torso, 1, 0, 59, -4, 16, 7.5, 9);                      /* 僧帽筋 */
    tube(torso, 7, 6.5, 56, 70);
    var head = this.head = new T.Group(); head.position.set(0, 78, 1); torso.add(head);
    ball(head, 10.5, 0, 0, 0, 1, 1.15, 1.05, skin, 24);
    ball(head, 1, 0, -6.5, 2.5, 8.6, 5.5, 8);                   /* あご */
    var cap = new T.Mesh(new T.SphereGeometry(11.2, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), hair);
    cap.position.set(0, 1.5, -0.6); cap.scale.set(1, 1.08, 1.05); cap.rotation.x = -0.25; head.add(cap);
    [-1, 1].forEach(function (d) {
      ball(head, 1.35, d * 3.7, 1.2, 10, 1, 1, 0.6, dark, 10);
      var brow = new T.Mesh(new T.BoxGeometry(4.8, 1.2, 1.4), hair);
      brow.position.set(d * 3.8, 4, 10.1); brow.rotation.z = d * -0.18; head.add(brow);
      ball(head, 1, d * 10.4, 0, 0, 1.6, 3, 2.2);                /* 耳 */
    });
    ball(head, 1.6, 0, -1.5, 11.2, 1, 1, 1, skin, 10);           /* 鼻 */
    var teeth = new T.Mesh(new T.BoxGeometry(6.4, 1.7, 1.2), white); teeth.position.set(0, -5.4, 10.4); head.add(teeth);

    /* 手足：始点から +Y に伸びる。向きは毎回、関節の位置から決める */
    var self = this;
    function limb(len, r0, r1, extra) {
      var g = new T.Group(); sc.add(g);
      tube(g, r0, r1, 0, len);
      ball(g, r1 * 1.02, 0, len, 0);
      if (extra) extra(g, len);
      return g;
    }
    this.limbs = [];
    for (var i = 0; i < 2; i++) {
      var L = {};
      L.upper = limb(30, 7.2, 6, function (g, len) {
        ball(g, 1, 0, len * 0.52, 3.6, 6.6, 11, 6.4);           /* 力こぶ */
        ball(g, 1, 0, len * 0.4, -2.8, 6.4, 12, 6);              /* 三頭筋 */
      });
      L.fore = limb(27, 6, 4.4, function (g, len) {
        ball(g, 1, 0, len * 0.25, 0.6, 6.4, 10, 5.8);
      });
      L.hand = ball(sc, 1, 0, 0, 0, 5.2, 6.4, 4.6);
      L.thigh = limb(44, 10.5, 7.2, function (g, len) {
        ball(g, 1, 0, len * 0.55, 3.4, 9.6, 18, 8.6);           /* 太もも前 */
        ball(g, 1, 1, len * 0.3, -2, 9, 14, 8.6);
      });
      L.thighTrunks = ball(L.thigh, 1, 0, 3, 0, 11, 7, 11.5, trunks);
      L.shin = limb(42, 7, 4.8, function (g, len) {
        ball(g, 1, 0, len * 0.28, -3, 6.8, 11, 6.4);            /* ふくらはぎ */
      });
      L.foot = new T.Mesh(new T.BoxGeometry(9, 6, 22), skin); sc.add(L.foot);
      this.limbs.push(L);
    }
    /* 床の影 */
    var sh = new T.Mesh(new T.CircleGeometry(1, 32), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.scale.set(55, 26, 1); sh.position.y = 0.2; sc.add(sh); this.shadow = sh;
    this.tmp = new T.Vector3();
  }

  function aim(g, a, b) {
    g.position.set(a[0], a[1], a[2]);
    var d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    g.quaternion.setFromUnitVectors(UP, d);
  }

  GameScene.prototype.reset = function () {};

  /* s.j: 関節（index.html の joints）、s.cam: { x, y, d, ty, fov }、s.flex: 力み 0〜1 */
  GameScene.prototype.sync = function (s) {
    var j = s.j;
    this.torso.position.set(j.pelvis[0], j.pelvis[1], j.pelvis[2]);
    var fl = 1 + (s.flex || 0) * 0.06;
    this.torso.scale.set(fl, 1, fl);
    this.head.rotation.set(-0.05, 0, (s.tilt || 0));
    for (var i = 0; i < 2; i++) {
      var L = this.limbs[i], q = j.side[i];
      aim(L.upper, q.shoulder, q.elbow); L.upper.scale.set(fl, 1, fl);
      aim(L.fore, q.elbow, q.hand);
      L.hand.position.set(q.hand[0], q.hand[1], q.hand[2]);
      aim(L.thigh, q.hip, q.knee);
      aim(L.shin, q.knee, q.ankle);
      L.foot.position.set(q.ankle[0], q.ankle[1] - 1, q.ankle[2] + 6);
    }
    this.shadow.position.x = j.pelvis[0];
    var c = s.cam, cam = this.camera;
    cam.fov = c.fov; cam.updateProjectionMatrix();
    cam.position.set(c.x, c.y, c.z);
    cam.lookAt(c.tx, c.ty, 0);
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
