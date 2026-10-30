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
  var TEX = Z3 && Z3.mobile ? 384 : 512;
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
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 1.25 }, camera: { fov: 32 }, finish: { vignette: 0.36, grain: 0.02 } });
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
    L.key.position.set(-6, 6, 3);
    this.camera.position.set(1.3, 3.0, 11.6);
    this.camera.lookAt(0, 1.15, 0);

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
    /* 貼り絵は3枚: 色 / 粗さ(緑)と金属らしさ(青) / 凹凸(赤) */
    var self = this;
    this.cv = [0, 1, 2].map(function () { var c = document.createElement("canvas"); c.width = c.height = TEX; return c; });
    this.img = this.cv.map(function (c) { return c.getContext("2d").createImageData(TEX, TEX); });
    this.tex = this.cv.map(function (c, i) {
      var t = new T.CanvasTexture(c);
      if (i === 0) t.colorSpace = T.SRGBColorSpace;
      t.repeat.set(1 / (2 * BOX), 1 / (2 * BOX)); t.offset.set(0.5, 0.5); t.anisotropy = 8;
      return t;
    });
    this.face = new T.MeshStandardMaterial({ map: this.tex[0], roughnessMap: this.tex[1], metalnessMap: this.tex[1], bumpMap: this.tex[2], bumpScale: 2.2, roughness: 1, metalness: 1, envMapIntensity: 1.15 });
    var glyph = this.glyph = new T.Group();
    var seg = Z3.mobile ? 2 : 3;
    STROKES.forEach(function (pts) {
      var sh = new T.Shape();
      pts.forEach(function (p, i) { if (i) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); });
      sh.closePath();
      var geo = new T.ExtrudeGeometry(sh, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.03, bevelSegments: seg, curveSegments: 4 });
      geo.translate(0, 0, -DEPTH / 2);
      /* 側面も「その場所の字の座標」で貼る（ふちをこすれば側面も磨ける） */
      var pos = geo.attributes.position, uv = geo.attributes.uv;
      for (var i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i));
      geo.clearGroups();
      var m = new T.Mesh(geo, self.face);
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

    this.tools = [makeChisel(), makeHake(), makeBrush(), makeSand(), makeSpray(), makePad(), makeCloth()];
    this.tools.forEach(function (t) { t.visible = false; self.scene.add(t); });
    this.ray = new T.Raycaster();
    this.noise = makeNoise();
    this.v = new T.Vector3();
  }

  /* ---- 道具の形（磨く面が -z を向く） ---- */
  function makeChisel() {
    var g = new T.Group();
    var steel = Z3.std(0x9aa0a8, { metalness: 0.9, roughness: 0.3 });
    var rod = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.8, 6), steel);
    rod.rotation.x = Math.PI / 2; rod.position.z = 0.55; g.add(rod);
    var tip = new T.Mesh(new T.CylinderGeometry(0.07, 0.01, 0.18, 6), steel);
    tip.rotation.x = -Math.PI / 2; tip.position.z = 0.07; g.add(tip);
    var grip = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.3, 8), Z3.std(0xd23a2a, { roughness: 0.5 }));
    grip.rotation.x = Math.PI / 2; grip.position.z = 0.75; g.add(grip);
    return g;
  }
  function makeHake() {
    var g = new T.Group();
    var handle = new T.Mesh(new T.BoxGeometry(0.1, 0.8, 0.07), Z3.std(0xc08a50, { roughness: 0.6 }));
    handle.position.set(0, -0.62, 0.2); g.add(handle);
    var ferrule = new T.Mesh(new T.BoxGeometry(0.46, 0.12, 0.1), Z3.std(0xb8bcc2, { metalness: 0.9, roughness: 0.3 }));
    ferrule.position.set(0, -0.18, 0.16); g.add(ferrule);
    var hair = new T.Mesh(new T.BoxGeometry(0.44, 0.34, 0.08), Z3.std(0xe8d4a8, { roughness: 1 }));
    hair.position.set(0, 0.04, 0.08); hair.rotation.x = 0.5; g.add(hair);
    return g;
  }
  function makeSpray() {
    var g = new T.Group();
    var bottle = new T.Mesh(new T.CylinderGeometry(0.2, 0.22, 0.6, 16), new T.MeshStandardMaterial({ color: 0xeef4f8, roughness: 0.2, transparent: true, opacity: 0.75 }));
    bottle.position.set(0, -0.35, 0.55); g.add(bottle);
    var water = new T.Mesh(new T.CylinderGeometry(0.17, 0.19, 0.35, 16), new T.MeshStandardMaterial({ color: 0x7cc4f4, roughness: 0.1, transparent: true, opacity: 0.6 }));
    water.position.set(0, -0.47, 0.55); g.add(water);
    var head = new T.Mesh(new T.BoxGeometry(0.2, 0.2, 0.4), Z3.std(0x3b8fd6, { roughness: 0.4 }));
    head.position.set(0, 0.04, 0.45); g.add(head);
    var trig = new T.Mesh(new T.BoxGeometry(0.06, 0.24, 0.06), Z3.std(0x2a6aa6, { roughness: 0.4 }));
    trig.position.set(0, -0.12, 0.3); trig.rotation.x = 0.3; g.add(trig);
    return g;
  }
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

  /* 錆のむら・穴・削り跡のもと（毎回同じ） */
  function valueNoise(r, N, G) {
    var base = [], out = new Float32Array(N * N);
    for (var i = 0; i < (G + 1) * (G + 1); i++) base.push(r());
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var fx = x / N * G, fy = y / N * G, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      var a = base[iy * (G + 1) + ix], b = base[iy * (G + 1) + ix + 1], c = base[(iy + 1) * (G + 1) + ix], d = base[(iy + 1) * (G + 1) + ix + 1];
      out[y * N + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
    return out;
  }
  function makeNoise() {
    var r = Z3.rng(21), N = TEX;
    var n1 = valueNoise(r, N, 6), n2 = valueNoise(r, N, 18), n3 = valueNoise(r, N, 54), n4 = valueNoise(r, N, 140);
    var fbm = new Float32Array(N * N), pit = new Float32Array(N * N), streak = new Float32Array(N * N), hi = new Float32Array(N * N);
    var row = [], rowSlow = [];
    for (var y = 0; y < N; y++) { row.push(r()); }
    for (var i = 0; i < N * N; i++) {
      fbm[i] = n1[i] * 0.45 + n2[i] * 0.3 + n3[i] * 0.17 + n4[i] * 0.08;
      var p = n4[i] * 0.6 + n3[i] * 0.4;
      pit[i] = Math.max(0, (p - 0.62) / 0.38);          /* 小さな腐食の穴 */
      hi[i] = r();
    }
    /* 紙やすりの横向きの細い削り跡 */
    for (y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var k = y * N + x;
      streak[k] = (row[y] - 0.5) * (0.6 + 0.8 * n2[k]) + (hi[k] - 0.5) * 0.25;
    }
    return { fbm: fbm, pit: pit, streak: streak, hi: hi };
  }
  function mix(a, b, t) { return a + (b - a) * t; }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* 磨きの状態 grid（index.html の形: n×n、dirt/rough/shine/fin）から貼り絵を作り直す。
     grid.rect（{i0, j0, i1, j1} マス）があればそこだけ */
  GameScene.prototype.paint = function (grid) {
    var N = TEX, n = grid.n, k = n / N, R0 = grid.rect;
    var x0p = 0, y0p = 0, x1p = N, y1p = N;
    if (R0) {
      x0p = Math.max(0, Math.floor((R0.i0 - 1) / k)); x1p = Math.min(N, Math.ceil((R0.i1 + 2) / k));
      y0p = Math.max(0, Math.floor((R0.j0 - 1) / k)); y1p = Math.min(N, Math.ceil((R0.j1 + 2) / k));
    }
    var C = this.img[0].data, M = this.img[1].data, B = this.img[2].data, nz = this.noise;
    var D = grid.dirt, RO = grid.rough, S = grid.shine, F = grid.fin, DU = grid.dust, GR = grid.grit;
    for (var y = y0p; y < y1p; y++) {
      var gy = Math.min(n - 1.001, Math.max(0, (y + 0.5) * k - 0.5)), yy = gy | 0, ty = gy - yy;
      for (var x = x0p; x < x1p; x++) {
        var gx = Math.min(n - 1.001, Math.max(0, (x + 0.5) * k - 0.5)), xx = gx | 0, tx = gx - xx;
        var i00 = yy * n + xx, i10 = i00 + 1, i01 = i00 + n, i11 = i01 + 1;
        var w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
        var d = D[i00] * w00 + D[i10] * w10 + D[i01] * w01 + D[i11] * w11;
        var ro = RO[i00] * w00 + RO[i10] * w10 + RO[i01] * w01 + RO[i11] * w11;
        var s = S[i00] * w00 + S[i10] * w10 + S[i01] * w01 + S[i11] * w11;
        var f = F[i00] * w00 + F[i10] * w10 + F[i01] * w01 + F[i11] * w11;
        var du = DU[i00] * w00 + DU[i10] * w10 + DU[i01] * w01 + DU[i11] * w11;
        var gr = GR[i00] * w00 + GR[i10] * w10 + GR[i01] * w01 + GR[i11] * w11;
        var p = y * N + x, fb = nz.fbm[p], pt = nz.pit[p], st = nz.streak[p], h = nz.hi[p];
        /* 錆は穴の中ほど遅くまで残る */
        var dd = clamp((d - 0.3 * (1 - pt) - 0.1 * fb + 0.12) * 1.6);
        var haze = s * (1 - f);
        var pitVis = pt * ro;                               /* 削ると穴も消える */
        var sanded = (1 - ro);
        /* 鉄の地: 黒っぽい黒皮 → 削った灰色（横の削り跡） → 磨いた明るい鋼 */
        var g = mix(0.24 + fb * 0.1, 0.5 + st * 0.12 * (1 - s), sanded);
        g = mix(g, 0.66 + st * 0.02, s * 0.8 + f * 0.2);
        g *= 1 - pitVis * 0.55;
        var cr = g * 0.98, cg = g, cb = g * 1.04;
        cr = mix(cr, 0.78, haze * 0.45); cg = mix(cg, 0.77, haze * 0.45); cb = mix(cb, 0.74, haze * 0.45);
        var rough = mix(0.62 + fb * 0.15 + h * 0.08, 0.36 + Math.abs(st) * 0.2, sanded);
        rough = mix(rough, 0.05 + Math.abs(st) * 0.03, s * 0.6 + f * 0.4);
        rough = clamp(rough + haze * 0.4 + pitVis * 0.2);
        var metal = 0.85 + sanded * 0.15 - haze * 0.3;
        var hgt = 0.5 - pitVis * 0.35 + (st * 0.12 + (h - 0.5) * 0.05) * ro * (1 - s);
        /* 錆: こげ茶〜橙〜黄土のむら、ところどころ黒い斑点。ふくらんだ凹凸 */
        var t = clamp((fb - 0.28) * 1.9 + (h - 0.5) * 0.18), rr, rg, rb;
        if (t < 0.5) { rr = mix(0.13, 0.33, t / 0.5); rg = mix(0.065, 0.13, t / 0.5); rb = mix(0.045, 0.05, t / 0.5); }
        else { var u = (t - 0.5) / 0.5; rr = mix(0.33, 0.62, u); rg = mix(0.13, 0.29, u); rb = mix(0.05, 0.1, u); }
        var spot = clamp((pt - 0.3) * 2);
        rr *= 1 - spot * 0.6; rg *= 1 - spot * 0.6; rb *= 1 - spot * 0.6;
        cr = mix(cr, rr, dd); cg = mix(cg, rg, dd); cb = mix(cb, rb, dd);
        rough = mix(rough, 0.92 + h * 0.08, dd);
        metal = mix(metal, 0.05, dd);
        hgt = mix(hgt, 0.55 + fb * 0.3 + (h - 0.5) * 0.12 - spot * 0.2, dd);
        /* 削りかす: 黒っぽい泥が削り跡に沿ってたまる */
        var gv = clamp(gr * 1.4 + st * 0.4 * gr - 0.05);
        cr = mix(cr, 0.17, gv); cg = mix(cg, 0.165, gv); cb = mix(cb, 0.16, gv);
        rough = mix(rough, 0.75, gv); metal = mix(metal, 0.2, gv); hgt = mix(hgt, 0.53 + h * 0.05, gv);
        /* 岩の粉: 白っぽい粉が全体にかぶる（払うとむらに減る） */
        var uv2 = clamp(du * 1.3 - h * 0.25 - fb * 0.15);
        var pc = 0.66 + h * 0.1;
        cr = mix(cr, pc, uv2); cg = mix(cg, pc * 0.97, uv2); cb = mix(cb, pc * 0.92, uv2);
        rough = mix(rough, 1, uv2); metal = mix(metal, 0, uv2); hgt = mix(hgt, 0.58 + h * 0.12, uv2);
        var q = p * 4;
        C[q] = cr * 255; C[q + 1] = cg * 255; C[q + 2] = cb * 255; C[q + 3] = 255;
        M[q] = 0; M[q + 1] = rough * 255; M[q + 2] = clamp(metal) * 255; M[q + 3] = 255;
        B[q] = B[q + 1] = B[q + 2] = clamp(hgt) * 255; B[q + 3] = 255;
      }
    }
    for (var c = 0; c < 3; c++) {
      this.cv[c].getContext("2d").putImageData(this.img[c], 0, 0, x0p, y0p, x1p - x0p, y1p - y0p);
      this.tex[c].needsUpdate = true;
    }
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

  GameScene.prototype.reset = function () {
    if (this.shards) this.shards.forEach(function (m) { m.visible = false; m.userData.life = 0; });
  };

  /* ---- 岩 ----
     字の座標の格子（rn×rn の頂点）の高さ grid.rockH（0〜1）で、角ばった岩の表面を作る。
     高さ0の頂点だけでできた三角は描かない（削り切った穴）。字は岩の奥から出てくる。 */
  var ROCK_BASE = -0.25, ROCK_TOP = 0.55;
  GameScene.prototype.rockZ = function (h) { return ROCK_BASE + h * (ROCK_TOP - ROCK_BASE); };
  GameScene.prototype.paintRock = function (grid) {
    var rn = grid.rn, H = grid.rockH, H0 = grid.rockInit, i, j;
    if (!this.rock) {
      var geo = new T.BufferGeometry(), pos = new Float32Array(rn * rn * 3), col = new Float32Array(rn * rn * 3);
      var r = Z3.rng(33);
      this.rockJit = new Float32Array(rn * rn * 2);
      for (j = 0; j < rn; j++) for (i = 0; i < rn; i++) {
        var k = j * rn + i;
        /* 頂点を少しずらして、格子に見えないようにする */
        var edge = i === 0 || j === 0 || i === rn - 1 || j === rn - 1;
        this.rockJit[k * 2] = edge ? 0 : (r() - 0.5) * 0.35;
        this.rockJit[k * 2 + 1] = edge ? 0 : (r() - 0.5) * 0.35;
        this.rockShade = this.rockShade || new Float32Array(rn * rn);
        this.rockShade[k] = 0.8 + r() * 0.35;
      }
      geo.setAttribute("position", new T.BufferAttribute(pos, 3));
      geo.setAttribute("color", new T.BufferAttribute(col, 3));
      geo.setIndex(new T.BufferAttribute(new Uint32Array((rn - 1) * (rn - 1) * 6), 1));
      var tex = Z3.canvasTex(128, 128, function (g, w, h) {
        g.fillStyle = "#8a8580"; g.fillRect(0, 0, w, h);
        var q = Z3.rng(8);
        for (var n = 0; n < 1400; n++) { var v = 90 + q() * 90 | 0; g.fillStyle = "rgb(" + v + "," + (v - 4) + "," + (v - 10) + ")"; g.fillRect(q() * w, q() * h, 1 + q() * 2, 1 + q() * 2); }
      }, 1);
      tex.repeat.set(3, 3);
      this.rockUvTex = tex;
      var uv = new Float32Array(rn * rn * 2);
      for (k = 0; k < rn * rn; k++) { uv[k * 2] = (k % rn) / (rn - 1); uv[k * 2 + 1] = 1 - Math.floor(k / rn) / (rn - 1); }
      geo.setAttribute("uv", new T.BufferAttribute(uv, 2));
      this.rock = new T.Mesh(geo, new T.MeshStandardMaterial({ map: tex, vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0, side: T.DoubleSide }));
      this.rock.castShadow = true; this.rock.receiveShadow = true;
      this.glyph.add(this.rock);
    }
    var g2 = this.rock.geometry, P = g2.attributes.position.array, Cc = g2.attributes.color.array, step = 2 * BOX / (rn - 1);
    for (j = 0; j < rn; j++) for (i = 0; i < rn; i++) {
      var k = j * rn + i, h = H[k];
      P[k * 3] = -BOX + (i + this.rockJit[k * 2]) * step;
      P[k * 3 + 1] = BOX - (j + this.rockJit[k * 2 + 1]) * step;
      P[k * 3 + 2] = this.rockZ(h);
      /* 削った新しい面は白っぽく */
      var fresh = Math.min(1, Math.max(0, (H0[k] - h) * 3)), sh = this.rockShade[k];
      Cc[k * 3] = sh * (1 + fresh * 0.25); Cc[k * 3 + 1] = sh * (1 + fresh * 0.22); Cc[k * 3 + 2] = sh * (1 + fresh * 0.18);
    }
    var idx = g2.index.array, n = 0;
    for (j = 0; j < rn - 1; j++) for (i = 0; i < rn - 1; i++) {
      var a = j * rn + i, b = a + 1, c = a + rn, d = c + 1, e = 0.004;
      if (H[a] > e || H[b] > e || H[c] > e) { idx[n++] = a; idx[n++] = c; idx[n++] = b; }
      if (H[b] > e || H[c] > e || H[d] > e) { idx[n++] = b; idx[n++] = c; idx[n++] = d; }
    }
    g2.setDrawRange(0, n);
    g2.index.needsUpdate = true; g2.attributes.position.needsUpdate = true; g2.attributes.color.needsUpdate = true;
    g2.computeBoundingSphere();
    this.rock.visible = n > 0;
  };

  /* 削った破片（角ばったかけら）を飛ばす。x, y は字の座標、z は岩の表面 */
  GameScene.prototype.chip = function (x, y, z, n) {
    if (!this.shards) return;
    for (var i = 0; i < n; i++) {
      var m = this.shards[this.shardNext++ % this.shards.length];
      this.v.set(x, y, z); this.glyph.localToWorld(this.v);
      m.position.copy(this.v);
      var sc = 0.5 + Math.random() * 1.2;
      m.scale.set(sc, sc * (0.5 + Math.random() * 0.6), sc * (0.6 + Math.random() * 0.5));
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      m.userData.vel = new T.Vector3((Math.random() - 0.5) * 3.2, 1.2 + Math.random() * 2.6, 1.5 + Math.random() * 2.5);
      m.userData.spin = new T.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, 0);
      m.userData.life = 2.5;
      m.visible = true;
    }
  };
  GameScene.prototype.stepShards = function (dt) {
    if (!this.shards) {
      var geo = new T.IcosahedronGeometry(0.07, 0), mat = new T.MeshStandardMaterial({ color: 0xa8a29a, flatShading: true, roughness: 0.9 });
      this.shards = []; this.shardNext = 0;
      for (var i = 0; i < 48; i++) { var m = new T.Mesh(geo, mat); m.visible = false; m.castShadow = true; m.userData.life = 0; this.scene.add(m); this.shards.push(m); }
    }
    this.shards.forEach(function (m) {
      var u = m.userData;
      if (!m.visible) return;
      u.life -= dt;
      if (u.life <= 0) { m.visible = false; return; }
      u.vel.y -= 9.8 * dt;
      m.position.addScaledVector(u.vel, dt);
      m.rotation.x += u.spin.x * dt; m.rotation.y += u.spin.y * dt;
      if (m.position.y < 0.04 && m.position.z > -1.4 && m.position.z < 2) {   /* 作業台の上で跳ねて止まる */
        m.position.y = 0.04; u.vel.y *= -0.3; u.vel.x *= 0.6; u.vel.z *= 0.6; u.spin.multiplyScalar(0.5);
      }
      if (u.life < 0.4) m.scale.multiplyScalar(0.92);
    });
  };

  /* s: { t, state, tool, toolAt: {x,y}|null, rubbing, sway, spin } */
  GameScene.prototype.sync = function (s) {
    var g = this.glyph;
    var dt = this.lastT == null ? 0 : Math.max(0, Math.min(0.1, s.t - this.lastT));
    this.lastT = s.t;
    this.stepShards(dt);
    g.rotation.y = s.state === "result" ? Math.sin(s.t * 0.9) * 0.55 : Math.sin(s.t * 0.7) * 0.1;
    g.rotation.x = 0;
    for (var i = 0; i < this.tools.length; i++) {
      var tl = this.tools[i];
      tl.visible = !!s.toolAt && s.tool === i && s.state === "play";
      if (!tl.visible) continue;
      var j = s.rubbing ? Math.sin(s.t * 60) * 0.02 : 0;
      this.v.set(s.toolAt.x + j, s.toolAt.y + j * 0.5, Math.max(this.FRONT, s.toolZ == null ? -9 : s.toolZ) + 0.02);
      g.localToWorld(this.v);
      tl.position.copy(this.v);
      tl.quaternion.copy(g.quaternion);
      tl.rotateZ(i === 1 ? -0.3 + j * 4 : i === 2 ? -0.5 : i === 3 ? -0.2 + j * 3 : 0);
      if (i === 0) { tl.rotateX(-0.35); tl.rotateY(0.3); tl.translateZ(s.hit * 0.25); }
      tl.rotateY(0.15); tl.rotateX(-0.1);
      if (tl.userData.spin) tl.userData.spin.rotation.y = s.t * (s.rubbing ? 30 : 3);
      if (i === 6) tl.rotation.z += Math.sin(s.t * 20) * (s.rubbing ? 0.15 : 0.02);
    }
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
