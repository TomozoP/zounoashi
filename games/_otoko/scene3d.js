/* 男磨き の立体。games/three-base.js の Z3 を土台にする。
   「男」の字は筆画ごとの板を押し出して作る。表の面には磨きの状態（index.html の grid）から作った絵を貼る。
   ゲームの進行（磨きの量・点数・時間）は index.html に置き、ここは見た目だけ。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;

  /* 「男」の筆画（字の座標。横 -0.82〜0.71、縦 -0.98〜0.95） */
  function rect(x0, x1, y0, y1) { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; }
  var STROKES = [
    rect(-0.62, 0.62, 0.80, 0.95),     /* 田: 上 */
    rect(-0.62, 0.62, 0.06, 0.21),     /* 田: 下 */
    rect(-0.62, -0.47, 0.06, 0.95),    /* 田: 左 */
    rect(0.47, 0.62, 0.06, 0.95),      /* 田: 右 */
    rect(-0.47, 0.47, 0.43, 0.58),     /* 田: 中の横 */
    rect(-0.075, 0.075, 0.21, 0.80),   /* 田: 中の縦 */
    rect(-0.82, 0.70, -0.30, -0.15),   /* 力: 横 */
    /* 力: 右の縦とはね */
    [[0.555, -0.15], [0.705, -0.15], [0.69, -0.55], [0.665, -0.88], [0.62, -0.95], [0.58, -0.965], [0.28, -0.83], [0.30, -0.775], [0.50, -0.80], [0.53, -0.55]],
    /* 力: ノ */
    [[-0.07, 0.0], [0.08, 0.0], [0.075, -0.34], [0.0, -0.58], [-0.22, -0.80], [-0.50, -0.94], [-0.80, -0.99], [-0.50, -0.85], [-0.29, -0.71], [-0.12, -0.51], [-0.065, -0.32]]
  ];
  global.OTOKO_STROKES = STROKES;
  var BOX = 1.1;                     /* 貼り絵は字の座標 -1.1〜1.1 を覆う */
  var TEX = 256;
  var SCALE = 1.6, DEPTH = 0.28;

  /* 金属の映り込みに使う撮影所の景色（横長の絵を周りに貼る） */
  function paintStudio(g, w, h) {
    /* 磨いた面には地平線の少し下が映る。上は白、真ん中にくっきりした暗い線を入れてクロームらしく */
    var gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#9aa0aa"); gr.addColorStop(0.36, "#b4b9c4"); gr.addColorStop(0.5, "#eef0f4");
    gr.addColorStop(0.535, "#e8ecf2"); gr.addColorStop(0.545, "#30323a"); gr.addColorStop(0.6, "#4a4c54");
    gr.addColorStop(0.7, "#8a8c94"); gr.addColorStop(1, "#3a2a1e");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    function box(x, y, bw, bh, c) {
      var r = g.createRadialGradient(x + bw / 2, y + bh / 2, 0, x + bw / 2, y + bh / 2, Math.max(bw, bh) * 0.7);
      r.addColorStop(0, c); r.addColorStop(0.6, c); r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r; g.fillRect(x - bw * 0.2, y - bh * 0.2, bw * 1.4, bh * 1.4);
    }
    for (var i = 0; i < 6; i++) box(w * (i / 6 + 0.04), h * 0.14, w * 0.06, h * 0.3, "#ffffff");
  }

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 1.05 }, camera: { fov: 32 }, finish: { vignette: 0.36, grain: 0.02 } });
    this.scene = st.scene;
    this.camera = st.camera;
    this.scene.background = new T.Color(0x1c1a19);
    try {
      var env = Z3.canvasTex(256, 128, paintStudio);
      env.mapping = T.EquirectangularReflectionMapping;
      var pm = new T.PMREMGenerator(st.renderer);
      this.scene.environment = pm.fromEquirectangular(env).texture;
      pm.dispose();
    } catch (e) {}
    var L = Z3.lights(this.scene, { shadows: true, shadowSize: 4, scale: 0.8 });
    L.key.position.set(-3, 7, 6);
    this.camera.position.set(1.3, 3.0, 11.6);
    this.camera.lookAt(0, 1.45, 0);

    /* 背景の壁（ぼんやり照らす） */
    var wall = new T.Mesh(new T.PlaneGeometry(14, 10), new T.MeshBasicMaterial({
      map: Z3.canvasTex(64, 64, function (g, w, h) {
        var r = g.createRadialGradient(w * 0.5, h * 0.45, 2, w * 0.5, h * 0.5, w * 0.7);
        r.addColorStop(0, "#4a4038"); r.addColorStop(1, "#141211");
        g.fillStyle = r; g.fillRect(0, 0, w, h);
      })
    }));
    wall.position.set(0, 3, -4);
    this.scene.add(wall);

    /* 作業台（木の板） */
    var wood = Z3.canvasTex(256, 128, function (g, w, h) {
      g.fillStyle = "#7a5232"; g.fillRect(0, 0, w, h);
      var r = Z3.rng(5);
      for (var i = 0; i < 90; i++) {
        g.strokeStyle = "rgba(" + (r() < 0.5 ? "40,24,12," : "150,104,64,") + (0.08 + r() * 0.18) + ")";
        g.lineWidth = 1 + r() * 2;
        var y = r() * h;
        g.beginPath(); g.moveTo(0, y);
        for (var x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 3);
        g.stroke();
      }
    });
    var bench = new T.Mesh(new T.BoxGeometry(7, 0.4, 3.4), Z3.std(0xffffff, { map: wood, roughness: 0.7 }));
    bench.position.set(0, -0.2, 0.3); bench.receiveShadow = true;
    this.scene.add(bench);

    /* 「男」の字 */
    var cv = this.texCanvas = document.createElement("canvas"); cv.width = cv.height = TEX;
    var cvM = this.matCanvas = document.createElement("canvas"); cvM.width = cvM.height = TEX;
    this.colTex = new T.CanvasTexture(cv); this.colTex.colorSpace = T.SRGBColorSpace;
    this.matTex = new T.CanvasTexture(cvM);
    [this.colTex, this.matTex].forEach(function (t) { t.repeat.set(1 / (2 * BOX), 1 / (2 * BOX)); t.offset.set(0.5, 0.5); t.anisotropy = 4; });
    this.face = new T.MeshStandardMaterial({ map: this.colTex, roughnessMap: this.matTex, metalnessMap: this.matTex, roughness: 1, metalness: 1, envMapIntensity: 1.3 });
    this.side = new T.MeshStandardMaterial({ color: 0x6a3a1c, roughness: 0.9, metalness: 0.2, envMapIntensity: 1.3 });
    var glyph = this.glyph = new T.Group();
    var seg = Z3.mobile ? 2 : 3;
    var self = this;
    STROKES.forEach(function (pts) {
      var sh = new T.Shape();
      pts.forEach(function (p, i) { if (i) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); });
      sh.closePath();
      var geo = new T.ExtrudeGeometry(sh, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.03, bevelSegments: seg, curveSegments: 4 });
      geo.translate(0, 0, -DEPTH / 2);
      var m = new T.Mesh(geo, [self.face, self.side]);
      m.castShadow = true; m.receiveShadow = true;
      glyph.add(m);
    });
    this.FRONT = DEPTH / 2 + 0.045;
    /* 指の位置を字の座標に直すための見えない板（字の表の面） */
    this.pick = new T.Mesh(new T.PlaneGeometry(6, 6), new T.MeshBasicMaterial({ visible: false }));
    this.pick.position.z = this.FRONT;
    glyph.add(this.pick);
    glyph.scale.setScalar(SCALE);
    this.baseY = 0.99 * SCALE;
    glyph.position.set(0, this.baseY, 0);
    this.scene.add(glyph);

    this.tools = [makeBrush(), makeSand(), makePad(), makeCloth()];
    this.tools.forEach(function (t) { t.visible = false; self.scene.add(t); });
    this.ray = new T.Raycaster();
    this.noise = makeNoise();
    this.v = new T.Vector3();
  }

  /* ---- 道具の形（磨く面が -z を向く） ---- */
  function makeBrush() {
    var g = new T.Group();
    var handle = new T.Mesh(new T.BoxGeometry(0.22, 0.95, 0.14), Z3.std(0xa0683a, { roughness: 0.6 }));
    handle.position.set(0, -0.62, 0.16); g.add(handle);
    var base = new T.Mesh(new T.BoxGeometry(0.42, 0.42, 0.12), Z3.std(0x8a5530, { roughness: 0.6 }));
    base.position.z = 0.14; g.add(base);
    var bristle = Z3.canvasTex(64, 64, function (c, w, h) {
      c.fillStyle = "#3a3c40"; c.fillRect(0, 0, w, h);
      var r = Z3.rng(9);
      for (var i = 0; i < 260; i++) { c.fillStyle = r() < 0.5 ? "#c8ccd2" : "#8a9098"; c.fillRect(r() * w, r() * h, 2, 2); }
    });
    var br = new T.Mesh(new T.BoxGeometry(0.38, 0.38, 0.14), Z3.std(0xffffff, { map: bristle, metalness: 0.8, roughness: 0.35 }));
    br.position.z = 0.02; g.add(br);
    return g;
  }
  function makeSand() {
    var g = new T.Group();
    var block = new T.Mesh(new T.BoxGeometry(0.62, 0.36, 0.22), Z3.std(0x3d6fb0, { roughness: 0.55 }));
    block.position.z = 0.15; g.add(block);
    var paper = Z3.canvasTex(64, 32, function (c, w, h) {
      c.fillStyle = "#c79a5a"; c.fillRect(0, 0, w, h);
      var r = Z3.rng(4);
      for (var i = 0; i < 500; i++) { c.fillStyle = r() < 0.5 ? "#8a6232" : "#e6c48c"; c.fillRect(r() * w, r() * h, 1, 1); }
    });
    var p = new T.Mesh(new T.BoxGeometry(0.66, 0.40, 0.04), Z3.std(0xffffff, { map: paper, roughness: 1 }));
    p.position.z = 0.02; g.add(p);
    return g;
  }
  function makePad() {
    var g = new T.Group();
    var pad = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.14, 24), Z3.std(0xf2c230, { roughness: 0.95 }));
    pad.rotation.x = Math.PI / 2; pad.position.z = 0.06; g.add(pad);
    var disk = new T.Mesh(new T.CylinderGeometry(0.24, 0.24, 0.06, 24), Z3.std(0x2a2c30, { metalness: 0.5, roughness: 0.4 }));
    disk.rotation.x = Math.PI / 2; disk.position.z = 0.16; g.add(disk);
    var knob = new T.Mesh(new T.CylinderGeometry(0.09, 0.11, 0.3, 16), Z3.std(0xd23a2a, { roughness: 0.45 }));
    knob.rotation.x = Math.PI / 2; knob.position.z = 0.33; g.add(knob);
    g.userData.spin = pad;
    return g;
  }
  function makeCloth() {
    var g = new T.Group();
    var geo = new T.SphereGeometry(0.3, 20, 14);
    var p = geo.attributes.position, r = Z3.rng(12);
    for (var i = 0; i < p.count; i++) {
      var k = 1 + (r() - 0.5) * 0.18;
      p.setXYZ(i, p.getX(i) * k * 1.1, p.getY(i) * k, p.getZ(i) * k * 0.55);
    }
    geo.computeVertexNormals();
    var c = new T.Mesh(geo, Z3.std(0x3b8fd6, { roughness: 1 }));
    c.position.z = 0.14; g.add(c);
    return g;
  }

  /* 錆のむらと細かい粒（毎回同じ） */
  function makeNoise() {
    var r = Z3.rng(21), N = TEX, lo = new Float32Array(N * N), hi = new Float32Array(N * N);
    var G = 12, base = [];
    for (var i = 0; i < (G + 1) * (G + 1); i++) base.push(r());
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var fx = x / N * G, fy = y / N * G, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      var a = base[iy * (G + 1) + ix], b = base[iy * (G + 1) + ix + 1], c = base[(iy + 1) * (G + 1) + ix], d = base[(iy + 1) * (G + 1) + ix + 1];
      lo[y * N + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
      hi[y * N + x] = r();
    }
    return { lo: lo, hi: hi };
  }

  /* 磨きの状態 grid（index.html の形: n×n、dirt/rough/shine/fin の Float32Array）から貼り絵を作り直す */
  GameScene.prototype.paint = function (grid) {
    var N = TEX, n = grid.n, k = n / N;
    var gc = this.texCanvas.getContext("2d"), gm = this.matCanvas.getContext("2d");
    var ic = this._ic || (this._ic = gc.createImageData(N, N)), im = this._im || (this._im = gm.createImageData(N, N));
    var C = ic.data, M = im.data, lo = this.noise.lo, hi = this.noise.hi;
    var D = grid.dirt, R = grid.rough, S = grid.shine, F = grid.fin;
    for (var y = 0; y < N; y++) {
      var gy = Math.min(n - 1.001, Math.max(0, (y + 0.5) * k - 0.5)), y0 = gy | 0, ty = gy - y0;
      for (var x = 0; x < N; x++) {
        var gx = Math.min(n - 1.001, Math.max(0, (x + 0.5) * k - 0.5)), x0 = gx | 0, tx = gx - x0;
        var i00 = y0 * n + x0, i10 = i00 + 1, i01 = i00 + n, i11 = i01 + 1;
        var w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
        var d = D[i00] * w00 + D[i10] * w10 + D[i01] * w01 + D[i11] * w11;
        var ro = R[i00] * w00 + R[i10] * w10 + R[i01] * w01 + R[i11] * w11;
        var s = S[i00] * w00 + S[i10] * w10 + S[i01] * w01 + S[i11] * w11;
        var f = F[i00] * w00 + F[i10] * w10 + F[i01] * w01 + F[i11] * w11;
        var p = y * N + x, nl = lo[p], nh = hi[p];
        /* 錆は境目をくっきり（むらで早く消える所と残る所） */
        var dd = Math.max(0, Math.min(1, (d - 0.15 * nl) * 1.25));
        var haze = s * (1 - f);
        /* 金属の地: ざらざらは暗く粒っぽい、磨くほど明るく均一 */
        var mc = 0.5 + (nh - 0.5) * 0.22 * ro + (1 - ro) * 0.18 + s * 0.12 + f * 0.06;
        var cr = mc, cg = mc, cb = mc * 1.03;
        cr += (0.95 - cr) * haze * 0.55; cg += (0.94 - cg) * haze * 0.55; cb += (0.9 - cb) * haze * 0.55;
        var rr = (0.30 + 0.5 * nl) * (0.85 + nh * 0.3), rg = (0.15 + 0.2 * nl) * (0.85 + nh * 0.3), rb = 0.07 + 0.06 * nl;
        cr += (rr - cr) * dd; cg += (rg - cg) * dd; cb += (rb - cb) * dd;
        var rough = ro * (0.62 + nh * 0.2) + (1 - ro) * (0.34 - s * 0.24 - f * 0.08);
        rough = Math.max(0.03, rough + haze * 0.3);
        rough += (0.95 - rough) * dd;
        var metal = (1 - dd) * (1 - haze * 0.4);
        var q = p * 4;
        C[q] = cr * 255; C[q + 1] = cg * 255; C[q + 2] = cb * 255; C[q + 3] = 255;
        M[q] = 0; M[q + 1] = rough * 255; M[q + 2] = metal * 255; M[q + 3] = 255;
      }
    }
    gc.putImageData(ic, 0, 0); gm.putImageData(im, 0, 0);
    this.colTex.needsUpdate = true; this.matTex.needsUpdate = true;
    /* 側面は全体の進み具合で色を変える */
    var a = grid.avg || { dirt: 1, rough: 1, shine: 0, fin: 0 };
    var sd = Math.max(0, Math.min(1, a.dirt * 1.3));
    var sc = new T.Color(0x5e3418).lerp(new T.Color(0x8a8c92).lerp(new T.Color(0xc8cacc), a.shine), 1 - sd);
    this.side.color.copy(sc);
    this.side.roughness = sd * 0.9 + (1 - sd) * (0.55 - a.shine * 0.4 - a.fin * 0.1);
    this.side.metalness = (1 - sd) * 0.95;
  };

  /* 画面の点（ゲームの座標）→ 字の座標 {x, y}。外れたら null */
  GameScene.prototype.toGlyph = function (sx, sy, W, H) {
    this.glyph.updateMatrixWorld(true);
    this.ray.setFromCamera(new T.Vector2(sx / W * 2 - 1, -(sy / H * 2 - 1)), this.camera);
    var hit = this.ray.intersectObject(this.pick, false)[0];
    if (!hit) return null;
    var p = this.glyph.worldToLocal(hit.point.clone());
    return { x: p.x, y: p.y };
  };
  /* 字の座標 → 画面の点 */
  GameScene.prototype.toScreen = function (x, y, W, H) {
    var v = this.v.set(x, y, this.FRONT);
    this.glyph.localToWorld(v);
    v.project(this.camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
  };

  GameScene.prototype.reset = function () {};

  /* s: { t, state, tool, toolAt: {x,y}|null, rubbing, sway, spin } */
  GameScene.prototype.sync = function (s) {
    var g = this.glyph;
    g.rotation.y = s.state === "result" ? Math.sin(s.t * 0.9) * 0.55 : Math.sin(s.t * 0.7) * 0.1;
    g.rotation.x = 0;
    for (var i = 0; i < this.tools.length; i++) {
      var tl = this.tools[i];
      tl.visible = !!s.toolAt && s.tool === i && s.state === "play";
      if (!tl.visible) continue;
      var j = s.rubbing ? Math.sin(s.t * 60) * 0.02 : 0;
      this.v.set(s.toolAt.x + j, s.toolAt.y + j * 0.5, this.FRONT + 0.02);
      g.localToWorld(this.v);
      tl.position.copy(this.v);
      tl.quaternion.copy(g.quaternion);
      tl.rotateZ(i === 0 ? -0.5 : i === 1 ? -0.2 + j * 3 : 0);
      tl.rotateY(0.15); tl.rotateX(-0.1);
      if (tl.userData.spin) tl.userData.spin.rotation.y = s.t * (s.rubbing ? 30 : 3);
      if (i === 3) tl.rotation.z += Math.sin(s.t * 20) * (s.rubbing ? 0.15 : 0.02);
    }
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
