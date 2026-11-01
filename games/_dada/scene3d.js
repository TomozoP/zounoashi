/* ガチ駄々の立体（three.js）。games/three-base.js の Z3 を土台にする。
   形と位置は physics.js（ZDadaPhysics）の剛体から写す。ここは見た目だけ。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;

  /* カメラの案。子供を追いかける（x,y,z は子供からのずれ） */
  var CAMS = {
    a: { x: 0, y: 7.4, z: 6.4, fov: 40 },      /* 斜め上 */
    b: { x: 0, y: 8.5, z: 1.2, fov: 40 },      /* ほぼ真上 */
    c: { x: 0, y: 2.4, z: 3.6, fov: 46 }       /* 低め・寄り */
  };

  function hsl(h, s, l) { return new T.Color().setHSL(h, s, l); }

  /* 箱の包装の絵（色・柄ごとに作り置き） */
  var boxTexCache = {};
  function boxTex(hue, pat) {
    var key = Math.round(hue * 12) + ":" + pat;
    if (boxTexCache[key]) return boxTexCache[key];
    var c = hsl(Math.round(hue * 12) / 12, 0.75, 0.55).getStyle(), c2 = hsl((Math.round(hue * 12) / 12 + 0.5) % 1, 0.8, 0.6).getStyle();
    var tex = Z3.canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = c; g.fillRect(0, 0, w, h);
      g.fillStyle = "#fff"; g.fillRect(10, 10, w - 20, h - 20);
      g.fillStyle = c; g.fillRect(16, 16, w - 32, h - 32);
      g.fillStyle = c2;
      if (pat === 0) { g.beginPath(); for (var i = 0; i < 5; i++) { var a = -Math.PI / 2 + i * Math.PI * 4 / 5; g.lineTo(64 + Math.cos(a) * 38, 64 + Math.sin(a) * 38); } g.closePath(); g.fill(); }
      else if (pat === 1) { g.beginPath(); g.arc(64, 64, 32, 0, 7); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(64, 64, 14, 0, 7); g.fill(); }
      else if (pat === 2) { for (var k = 0; k < 4; k++) g.fillRect(24, 26 + k * 20, 80, 9); }
      else if (pat === 3) { g.fillRect(34, 40, 60, 46); g.fillStyle = "#fff"; g.fillRect(44, 52, 12, 12); g.fillRect(72, 52, 12, 12); }
      else { g.font = "bold 70px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText("ABCDEFGH"[Math.round(hue * 7)], 64, 68); }
    });
    boxTexCache[key] = tex;
    return tex;
  }

  function GameScene(phys) {
    T = global.THREE;
    var P = global.ZDadaPhysics;
    this.phys = phys;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: !Z3.mobile, tone: "aces", exposure: 1.25 }, camera: { fov: 40, near: 0.1, far: 60 }, finish: { vignette: 0.12, grain: 0 } });
    var sc = this.scene = st.scene;
    this.camera = st.camera;
    sc.background = new T.Color(0xf3efe6);
    Z3.lights(sc, { shadows: !Z3.mobile, shadowSize: 9 });
    sc.add(new T.HemisphereLight(0xffffff, 0xd8c8b0, 0.6));
    this.cam = CAMS[(/[?&]cam=([abc])/.exec(global.location.search) || [])[1] || "a"];
    this.camPos = null;

    /* 床（市松のタイル） */
    var floorTex = Z3.canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#e3dccf"; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
      g.strokeStyle = "rgba(0,0,0,.06)"; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
    }, true);
    floorTex.repeat.set(P.STORE.w / 1.2, P.STORE.d / 1.2);
    var floor = new T.Mesh(new T.PlaneGeometry(P.STORE.w, P.STORE.d), new T.MeshStandardMaterial({ map: floorTex, roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    sc.add(floor);

    var wallMat = Z3.std(0xffe7a8, { roughness: 0.9 }), metal = Z3.std(0xd9dde3, { roughness: 0.45, metalness: 0.2 }), back = Z3.std(0xfafafa, { roughness: 0.8 });
    var self = this;
    phys.statics.forEach(function (s) {
      if (s.kind === "floor" || s.kind === "front") return;
      var m = s.kind === "wall" ? wallMat : (s.kind === "back" ? back : metal);
      var mesh = new T.Mesh(new T.BoxGeometry(s.hx * 2, s.hy * 2, s.hz * 2), m);
      mesh.position.set(s.x, s.y, s.z);
      mesh.castShadow = s.kind !== "wall"; mesh.receiveShadow = true;
      sc.add(mesh);
    });
    /* 棚の天板の値札の帯 */
    P.SHELVES.forEach(function (s) {
      P.LEVELS.forEach(function (y) {
        var band = new T.Mesh(new T.BoxGeometry(s.len, 0.05, 0.01), Z3.std(0xf2c230));
        band.position.set(s.x, y - 0.03, s.z + P.SHELF_D / 2 + 0.005);
        sc.add(band);
      });
    });

    /* おもちゃ */
    this.toyMeshes = phys.toys.map(function (t) {
      var d = t.d, m;
      if (d.kind === "ball") {
        m = new T.Mesh(new T.SphereGeometry(d.h[0], 16, 12), Z3.std(hsl(d.hue, 0.8, 0.55), { roughness: 0.35 }));
      } else if (d.kind === "bear") {
        m = new T.Group();
        var fur = Z3.std(hsl(0.07 + d.hue * 0.04, 0.5, 0.45 + d.hue * 0.2), { roughness: 1 });
        var body = new T.Mesh(new T.SphereGeometry(0.12, 14, 10), fur); body.scale.set(1, 0.9, 0.85); body.position.y = -0.06; m.add(body);
        var head = new T.Mesh(new T.SphereGeometry(0.09, 14, 10), fur); head.position.y = 0.1; m.add(head);
        [-1, 1].forEach(function (sx) { var ear = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), fur); ear.position.set(sx * 0.065, 0.17, 0); m.add(ear); });
        var snout = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), Z3.std(0xf2e0c8)); snout.position.set(0, 0.08, 0.075); m.add(snout);
        m.children.forEach(function (c) { c.castShadow = true; });
      } else {
        var tex = boxTex(d.hue, d.pat);
        m = new T.Mesh(new T.BoxGeometry(d.h[0] * 2, d.h[1] * 2, d.h[2] * 2), new T.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
      }
      m.castShadow = true;
      sc.add(m);
      return m;
    });

    /* 子供 */
    var skin = Z3.std(0xffd2b0, { roughness: 0.7 }), shirt = Z3.std(0xff5a4a, { roughness: 0.75 }), shorts = Z3.std(0x2f5fb8, { roughness: 0.8 }), shoe = Z3.std(0xffffff, { roughness: 0.6 });
    var hair = Z3.std(0x2a1a12, { roughness: 0.9 });
    this.kidMeshes = {};
    P.PARTS.forEach(function (p) {
      var g = new T.Group(), mesh;
      if (p.id === "head") {
        /* 四角い頭（顔は描かない） */
        mesh = new T.Mesh(new T.BoxGeometry(p.h[0] * 2, p.h[1] * 2, p.h[2] * 2), skin);
        g.add(mesh);
        var top = new T.Mesh(new T.BoxGeometry(p.h[0] * 2.08, p.h[1] * 0.6, p.h[2] * 2.08), hair);
        top.position.y = p.h[1] * 0.74; g.add(top);
        var backHair = new T.Mesh(new T.BoxGeometry(p.h[0] * 2.08, p.h[1] * 1.3, p.h[2] * 0.3), hair);
        backHair.position.set(0, p.h[1] * 0.3, -p.h[2] * 0.9); g.add(backHair);
      } else {
        var mat = p.id === "torso" ? shirt : p.id === "pelvis" ? shorts : /legU/.test(p.id) ? shorts : /armU/.test(p.id) ? shirt : skin;
        mesh = new T.Mesh(new T.BoxGeometry(p.h[0] * 2, p.h[1] * 2, p.h[2] * 2), mat);
        g.add(mesh);
        if (/legL/.test(p.id)) { var sh = new T.Mesh(new T.BoxGeometry(p.h[0] * 2.3, 0.06, p.h[2] * 2.8), shoe); sh.position.set(0, -p.h[1] + 0.02, 0.03); g.add(sh); }
        if (/armL/.test(p.id)) { var hand = new T.Mesh(new T.SphereGeometry(0.05, 10, 8), skin); hand.position.y = -p.h[1]; g.add(hand); }
      }
      g.traverse(function (c) { if (c.isMesh) c.castShadow = true; });
      sc.add(g);
      self.kidMeshes[p.id] = g;
    });
  }

  GameScene.prototype.sync = function (s) {
    var phys = this.phys;
    phys.toys.forEach(function (t, i) { var m = this.toyMeshes[i], b = t.body; m.position.copy(b.position); m.quaternion.copy(b.quaternion); }, this);
    var km = this.kidMeshes;
    Object.keys(km).forEach(function (id) { var b = phys.kid.map[id]; km[id].position.copy(b.position); km[id].quaternion.copy(b.quaternion); });
    /* 見た目だけの上乗せの回転：体の長い軸まわりに、重心を中心に全身を回して描く。
       回し終わりは次のちょうど1回転まで回してから 0 に戻す（物理の姿勢とずれたまま止まらないよう） */
    var dt = s.dt || 1 / 60, rate = phys.spinVis || 0;
    if (this.vis == null) this.vis = { a: 0, rate: 0 };
    var vs = this.vis;
    if (rate) vs.rate = rate;
    else if (vs.rate) {
      var full = Math.PI * 2, next = (vs.rate > 0 ? Math.ceil(vs.a / full) : Math.floor(vs.a / full)) * full;
      if (Math.abs(next - vs.a) < Math.abs(vs.rate) * dt) { vs.a = 0; vs.rate = 0; }
    }
    if (vs.rate) {
      vs.a += vs.rate * dt;
      var tq = phys.kid.map.torso.quaternion, ax = new T.Vector3(0, 1, 0).applyQuaternion(new T.Quaternion(tq.x, tq.y, tq.z, tq.w)).normalize();
      var q = new T.Quaternion().setFromAxisAngle(ax, vs.a), com = new T.Vector3(), M = 0;
      phys.kid.list.forEach(function (b) { com.x += b.position.x * b.mass; com.y += b.position.y * b.mass; com.z += b.position.z * b.mass; M += b.mass; });
      com.multiplyScalar(1 / M);
      Object.keys(km).forEach(function (id) {
        var m = km[id];
        m.position.sub(com).applyQuaternion(q).add(com);
        m.quaternion.premultiply(q);
      });
    }
    /* カメラは子供を追う（少し遅れて） */
    var c = phys.center(), cam = s.cam ? CAMS[s.cam] : this.cam;
    if (this.camera.fov !== cam.fov) { this.camera.fov = cam.fov; this.camera.updateProjectionMatrix(); }
    var tx = Math.max(-3.2, Math.min(3.2, c.x)), tz = Math.max(-6.2, Math.min(5.5, c.z));
    if (!this.camPos || s.snap) this.camPos = { x: tx, z: tz };
    var k = Math.min(1, (s.dt || 1 / 60) * 4);
    this.camPos.x += (tx - this.camPos.x) * k; this.camPos.z += (tz - this.camPos.z) * k;
    var shake = s.shake || 0;
    /* スローのときは寄る（zoom<1） */
    this.zoom = this.zoom == null ? 1 : this.zoom + ((s.zoom || 1) - this.zoom) * Math.min(1, (s.dt || 1 / 60) * 7);
    var zm = this.zoom;
    this.camera.position.set(this.camPos.x + cam.x * zm + (Math.random() - 0.5) * shake, cam.y * zm + (Math.random() - 0.5) * shake, this.camPos.z + cam.z * zm);
    this.camera.lookAt(this.camPos.x, 0.35, this.camPos.z);
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
