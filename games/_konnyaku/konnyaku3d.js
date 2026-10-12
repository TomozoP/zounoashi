/* こんにゃく10等分の立体の見た目（three.js）。games/three-base.js の Z3 を土台にする。
   動き・切る判定はゲーム側（index.html）の2Dのまま。ここはそれを、まな板の上に写すだけ。
   ゲームの座標（横540の画面座標）を、1単位＝100 の立体の床（x-z）に置く。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var S = 0.01;           /* ゲーム座標 → 立体 */
  var THICK = 0.62;       /* こんにゃくの厚み */
  var CUT_Y = THICK * 0.6;/* 指が指す高さ（こんにゃくの上の面の近く） */
  var TILT = 0.30;        /* 真上から手前へ倒す角度（ラジアン） */

  function KonScene(o) {
    T = global.THREE;
    this.KW = o.KW; this.KH = o.KH; this.specks = o.specks;
    var st = this.stage = new Z3.Stage({
      renderer: { shadows: true, tone: "aces", exposure: 1.05 },
      camera: { fov: 30, near: 1, far: 60 },
      finish: Z3.mobile ? null : { contrast: 0.12, vignette: 0.3, grain: 0.02 }
    });
    this.scene = st.scene; this.camera = st.camera;
    this.scene.background = new T.Color(0x1d1a18);
    var L = Z3.lights(this.scene, { shadows: true, shadowSize: 6, scale: 0.9 });
    L.key.position.set(1, 9, -4);
    L.key.shadow.radius = 4;
    L.rim.intensity = 0.3;
    this.makeEnv();
    this.makeMaterials();
    this.meshes = new Map();
    this.board = null; this.bkey = "";
    this.makeKnife();
    this.ray = new T.Raycaster();
    this.plane = new T.Plane(new T.Vector3(0, 1, 0), -CUT_Y);
  }

  /* 映り込み用の部屋：台所の天井の明かりと窓 */
  KonScene.prototype.makeEnv = function () {
    var es = new T.Scene();
    es.add(new T.Mesh(new T.BoxGeometry(30, 14, 30), new T.MeshBasicMaterial({ color: 0x34302c, side: T.BackSide })));
    function panel(w, h, x, y, z, rx, ry, color) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: color, side: T.DoubleSide }));
      m.position.set(x, y, z); m.rotation.set(rx, ry, 0); es.add(m);
    }
    panel(8, 2.2, -2, 6.8, -2, Math.PI / 2, 0, 0xffffff);     /* 天井の蛍光灯 */
    panel(3, 1.2, 4, 6.8, 3, Math.PI / 2, 0, 0xfff1dc);
    panel(10, 5, 0, 4, -14.8, 0, 0, 0xcfe0ff);                 /* 窓 */
    panel(5, 3, 1.5, 6.8, 6, Math.PI / 2, 0, 0xffffff);        /* カメラ側の明かり（上の面のつやになる） */
    panel(1.2, 6, -4, 6.8, 2, Math.PI / 2, 0, 0xffffff);
    var pm = new T.PMREMGenerator(this.stage.renderer);
    this.scene.environment = pm.fromScene(es, 0.03).texture;
    this.scene.environmentIntensity = 1.0;
    pm.dispose();
  };

  KonScene.prototype.makeMaterials = function () {
    var KW = this.KW, KH = this.KH, specks = this.specks;
    var r = Z3.rng(31);
    var PX = 2;   /* 貼り物の細かさ（ゲーム座標1あたり） */
    /* 色：灰色がかった茶色のむら＋ひじきの黒いつぶ */
    var col = Z3.canvasTex(KW * PX, KH * PX, function (g, w, h) {
      g.fillStyle = "#5f5852"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 260; i++) {
        var x = r() * w, y = r() * h, rr = 10 + r() * 50;
        var gr = g.createRadialGradient(x, y, 0, x, y, rr);
        var d = r() < 0.5 ? "rgba(60,54,50," : "rgba(150,142,132,";
        gr.addColorStop(0, d + (0.08 + r() * 0.1) + ")"); gr.addColorStop(1, d + "0)");
        g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
      specks.forEach(function (s) {
        g.fillStyle = "rgba(22,19,18," + Math.min(1, s.a + 0.25) + ")";
        g.beginPath(); g.ellipse((s.x + KW / 2) * PX, (s.y + KH / 2) * PX, s.r * PX, s.r * PX * (0.6 + 0.4 * ((s.x * 7) % 1 + 1) % 1), s.x, 0, Math.PI * 2); g.fill();
      });
    });
    col.wrapS = col.wrapT = T.MirroredRepeatWrapping;
    /* でこぼこ：つぶは少しへこみ、全体に細かいざらつき */
    var bump = Z3.canvasTex(KW * PX / 2, KH * PX / 2, function (g, w, h) {
      g.fillStyle = "#808080"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 2600; i++) {
        var v = 110 + Math.floor(r() * 40);
        g.fillStyle = "rgba(" + v + "," + v + "," + v + ",.5)";
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
      }
      specks.forEach(function (s) {
        g.fillStyle = "rgba(40,40,40,.8)";
        g.beginPath(); g.arc((s.x + KW / 2) * PX / 2, (s.y + KH / 2) * PX / 2, s.r * PX / 2, 0, Math.PI * 2); g.fill();
      });
    });
    bump.colorSpace = T.NoColorSpace;
    bump.wrapS = bump.wrapT = T.MirroredRepeatWrapping;
    /* ぬれたつや：上に透明な層（clearcoat）をのせる */
    this.konMat = new T.MeshPhysicalMaterial({
      map: col, bumpMap: bump, bumpScale: 0.6,
      color: 0x9a948e, roughness: 0.45, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.22,
      sheen: 0.3, sheenColor: new T.Color(0x9a948c), sheenRoughness: 0.5
    });
    /* 切り口：中も同じ色。つぶが少し大きく見える */
    this.cutMat = this.konMat.clone();
    this.cutMat.clearcoat = 0.7; this.cutMat.clearcoatRoughness = 0.2;
  };

  /* まな板（ゲームの壁の内側＋縁14） */
  KonScene.prototype.makeBoard = function (b, W, CY) {
    var key = [b.x0, b.x1, b.y0, b.y1, W, CY].join(",");
    if (key === this.bkey) return;
    this.bkey = key;
    if (this.board) { this.scene.remove(this.board); this.board.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
    var g = this.board = new T.Group();
    var m = 14, bw = (b.x1 - b.x0 + m * 2) * S, bd = (b.y1 - b.y0 + m * 2) * S;
    var cx = ((b.x0 + b.x1) / 2 - W / 2) * S, cz = ((b.y0 + b.y1) / 2 - CY) * S;
    var r = Z3.rng(77);
    if (!this.woodTex) {
      this.woodTex = Z3.canvasTex(512, 1024, function (c, w, h) {
        var gr = c.createLinearGradient(0, 0, w, h);
        gr.addColorStop(0, "#e9d0a2"); gr.addColorStop(1, "#d6b47e");
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        for (var i = 0; i < 120; i++) {
          var x = r() * w, a = 0.03 + r() * 0.08, k = r() * 6, lw = 0.6 + r() * 2.4;
          c.strokeStyle = "rgba(125,80,32," + a + ")"; c.lineWidth = lw;
          c.beginPath();
          for (var y = 0; y <= h; y += 16) {
            var ox = Math.sin(y / 90 + k) * 6 + Math.sin(y / 27 + k * 2) * 1.8;
            if (y === 0) c.moveTo(x + ox, y); else c.lineTo(x + ox, y);
          }
          c.stroke();
        }
        /* 包丁の細かい傷 */
        for (var j = 0; j < 160; j++) {
          var x0 = r() * w, y0 = r() * h, an = r() * Math.PI, l = 8 + r() * 40;
          c.strokeStyle = "rgba(90,60,30," + (0.05 + r() * 0.08) + ")"; c.lineWidth = 0.8;
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + Math.cos(an) * l, y0 + Math.sin(an) * l); c.stroke();
        }
      });
      /* ぬれたところだけ、つやを強くする（粗さの貼り物） */
      this.wetTex = Z3.canvasTex(256, 512, function (c, w, h) {
        c.fillStyle = "#a8a8a8"; c.fillRect(0, 0, w, h);
        for (var i = 0; i < 40; i++) {
          var x = r() * w, y = r() * h, rr = 6 + r() * 30;
          var gr = c.createRadialGradient(x, y, 0, x, y, rr);
          gr.addColorStop(0, "rgba(40,40,40,.6)"); gr.addColorStop(1, "rgba(40,40,40,0)");
          c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, rr, rr * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * 2); c.fill();
        }
      });
      this.wetTex.colorSpace = T.NoColorSpace;
      this.boardMat = new T.MeshPhysicalMaterial({ map: this.woodTex, roughnessMap: this.wetTex, roughness: 1, clearcoat: 0.35, clearcoatRoughnessMap: this.wetTex, clearcoatRoughness: 0.6 });
    }
    var top = new T.Mesh(new T.BoxGeometry(bw, 0.3, bd), [Z3.std(0xc9a46e), Z3.std(0xc9a46e), this.boardMat, Z3.std(0xb38d58), Z3.std(0xc9a46e), Z3.std(0xc9a46e)]);
    top.position.set(cx, -0.15, cz);
    top.receiveShadow = true;
    g.add(top);
    /* 台所の台（まな板より少し広いだけにする） */
    var counter = new T.Mesh(new T.BoxGeometry(bw + 6, 0.2, bd + 4), Z3.std(0x3a3632, { roughness: 0.4, metalness: 0.2 }));
    counter.position.set(cx, -0.4, cz);
    counter.receiveShadow = true;
    g.add(counter);
    this.scene.add(g);
    this.fit(bw, bd, cx, cz);
  };

  /* まな板が横いっぱいに収まるようにカメラを置く */
  KonScene.prototype.fit = function (bw, bd, cx, cz) {
    var cam = this.camera;
    var aspect = this.aspect || 540 / 960;
    var vf = cam.fov * Math.PI / 180;
    var hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    var dW = (bw / 2 * 1.04) / Math.tan(hf / 2);
    var dH = (bd / 2 * 1.06) / Math.tan(vf / 2);
    var d = Math.max(dW, dH) + THICK;
    cam.position.set(cx, Math.cos(TILT) * d, cz + Math.sin(TILT) * d);
    cam.lookAt(cx, 0, cz - 0.15);
    cam.updateMatrixWorld();
  };

  /* こんにゃく1切れの形。p.poly はゲーム座標（重心が原点）、p.c は元のこんにゃくでの重心 */
  KonScene.prototype.pieceMesh = function (p) {
    var KW = this.KW, KH = this.KH;
    var shape = new T.Shape();
    p.poly.forEach(function (v, i) { if (i) shape.lineTo(v.x * S, -v.y * S); else shape.moveTo(v.x * S, -v.y * S); });
    shape.closePath();
    var cx = p.c.x, cy = p.c.y;
    function uvTop(x, y) { return new T.Vector2((x / S + cx) / KW + 0.5, 1 - ((-y / S + cy) / KH + 0.5)); }
    var gen = {
      generateTopUV: function (geo, v, a, b, c) {
        return [uvTop(v[a * 3], v[a * 3 + 1]), uvTop(v[b * 3], v[b * 3 + 1]), uvTop(v[c * 3], v[c * 3 + 1])];
      },
      generateSideWallUV: function (geo, v, a, b, c, d) {
        function u(i) { return ((v[i * 3] / S + cx) - (v[i * 3 + 1] / S - cy)) / KW; }
        function w(i) { return 0.3 + v[i * 3 + 2] * 0.5; }
        return [new T.Vector2(u(a), w(a)), new T.Vector2(u(b), w(b)), new T.Vector2(u(c), w(c)), new T.Vector2(u(d), w(d))];
      }
    };
    var bev = 0.05;
    var geo = new T.ExtrudeGeometry(shape, {
      depth: THICK - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelOffset: -bev * 0.9,
      bevelSegments: Z3.mobile ? 2 : 3, curveSegments: 1, UVGenerator: gen
    });
    var mesh = new T.Mesh(geo, [this.konMat, this.cutMat]);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = bev;
    mesh.castShadow = true; mesh.receiveShadow = true;
    var grp = new T.Group();
    grp.add(mesh);
    this.scene.add(grp);
    return grp;
  };

  KonScene.prototype.makeKnife = function () {
    var k = this.knife = new T.Group();
    var inner = this.knifeInner = new T.Group();
    inner.position.x = -1.15;
    inner.rotation.x = 0.55;     /* 刃の腹が少し見えるよう寝かせる */
    k.add(inner);
    /* 刃：薄い鋼の板。刃先が下 */
    var sh = new T.Shape();
    sh.moveTo(0, 0); sh.lineTo(1.55, 0); sh.quadraticCurveTo(1.62, 0.6, 1.4, 0.82); sh.lineTo(0, 0.82); sh.closePath();
    var blade = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: false }),
      new T.MeshPhysicalMaterial({ color: 0xe4e8ec, metalness: 0.85, roughness: 0.32 }));
    blade.position.set(0, 0, -0.009);
    blade.castShadow = true;
    inner.add(blade);
    var handle = new T.Mesh(new T.BoxGeometry(0.85, 0.2, 0.12), Z3.std(0x4a3222, { roughness: 0.6 }));
    handle.position.set(-0.42, 0.68, 0);
    handle.castShadow = true;
    inner.add(handle);
    var pin = Z3.std(0xc0c4c8, { metalness: 1, roughness: 0.3 });
    [-0.2, -0.62].forEach(function (x) {
      var m = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.13, 8), pin);
      m.rotation.x = Math.PI / 2; m.position.set(x, 0.68, 0); inner.add(m);
    });
    k.visible = false;
    this.scene.add(k);
  };

  /* 画面の点 → まな板の上のゲーム座標 */
  KonScene.prototype.pick = function (x, y, W, H, CY) {
    this.ray.setFromCamera(new T.Vector2(x / W * 2 - 1, -(y / H * 2 - 1)), this.camera);
    var hit = new T.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, hit)) return null;
    return { x: hit.x / S + W / 2, y: hit.z / S + CY };
  };
  /* ゲーム座標 → 画面の点 */
  KonScene.prototype.project = function (gx, gy, W, H, CY) {
    var v = new T.Vector3((gx - W / 2) * S, CUT_Y, (gy - CY) * S).project(this.camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
  };

  KonScene.prototype.sync = function (s) {
    var self = this;
    this.aspect = s.W / s.H;
    this.makeBoard(s.board, s.W, s.CY);
    var alive = new Set();
    (s.pieces || []).forEach(function (p) {
      alive.add(p);
      var g = self.meshes.get(p);
      if (!g) { g = self.pieceMesh(p); self.meshes.set(p, g); }
      g.position.set((p.x - s.W / 2) * S, 0, (p.y - s.CY) * S);
      g.rotation.y = -p.a;
      var wb = p.wob * Math.sin(s.t * 38 + p.c.x * 0.1) * 0.05;
      g.scale.set(1 + wb, 1 - wb * 1.5, 1 - wb);
    });
    this.meshes.forEach(function (g, p) {
      if (alive.has(p)) return;
      self.scene.remove(g);
      g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      self.meshes.delete(p);
    });
    var k = s.knife;
    this.knife.visible = !!k;
    if (k) {
      /* 刃先の少し後ろが指の場所。進む向きに刃を向け、刃はこんにゃくに沈める */
      var ang = k.dir == null ? -Math.PI / 2 : k.dir;
      this.knife.position.set((k.x - s.W / 2) * S, -0.02, (k.y - s.CY) * S);
      this.knife.rotation.set(0, -ang, 0);
    }
  };

  KonScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.KonScene = KonScene;
})(window);
