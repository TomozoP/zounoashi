/* ぷるぷる落ち物の立体（three.js）。土台は games/three-base.js の Z3。
   物理は index.html の2D断面。ここは各ブロックの外周の点の輪に厚みと丸い縁を付けて、ゼリーの塊として描く。
   座標は物理と同じ（x 0〜BW、y が上、床 y=0）。手前が +z。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var DEPTH = 0.42;              /* 厚みの半分 */
  /* 硬さごとの縁：やわらかいほど丸く（スライム）、かたいほど段が少なく角ばる（宝石のカット面） */
  var EDGES = [0.24, 0.22, 0.18, 0.14, 0.16];
  var KLS = [11, 9, 7, 5, 3];

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: !Z3.mobile, tone: "aces", exposure: 1.25 }, camera: { fov: 30, near: 0.5, far: 80 }, dpr: 1.5 });   /* 仕上げ(Finish)は使わない：半精度の描画先でつやの強い所が溢れて黒い点になる */
    var sc = this.scene = st.scene;
    this.camera = st.camera;
    var BW = 5;

    /* 背景：深い藍から紫へ。箱の後ろだけ、ほんのり明るい */
    sc.background = Z3.canvasTex(64, 512, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#14122a"); gr.addColorStop(0.55, "#3a2550"); gr.addColorStop(1, "#5a2f52");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    var glowTex = Z3.canvasTex(256, 256, function (g, w, h) {
      var gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, "rgba(255,220,250,.55)"); gr.addColorStop(0.5, "rgba(190,140,255,.18)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    this.glowTex = glowTex;
    var glow = new T.Mesh(new T.PlaneGeometry(16, 18), new T.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    glow.position.set(BW / 2, 5, -4); sc.add(glow);

    /* 映り込み用の部屋。白い天井の照明と、左にピンク・右に水色のやわらかい光 */
    var env = new T.Scene();
    env.add(new T.Mesh(new T.SphereGeometry(30, 32, 16), new T.MeshBasicMaterial({ side: T.BackSide, map: Z3.canvasTex(256, 128, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#d9d4ff"); gr.addColorStop(0.5, "#3a2d55"); gr.addColorStop(1, "#120f22");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }) })));
    function softbox(x, y, z, w, h, c) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    }
    softbox(-4, 14, 10, 12, 5, "#ffffff");
    softbox(-14, 4, 4, 3, 12, "#ff7ac8");
    softbox(14, 4, 4, 3, 12, "#6fe3ff");
    softbox(0, 3, 16, 14, 2, "#fff0e0");
    var pm = new T.PMREMGenerator(st.renderer);
    sc.environment = pm.fromScene(env, 0.02).texture;

    /* 明かり：上からやわらかい白、後ろの左右から色つきの縁の光（ゼリーのふちが光る） */
    var key = new T.DirectionalLight("#fff4ec", 2.0);
    key.position.set(-3, 15, 9);
    if (!Z3.mobile) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      var c = key.shadow.camera; c.left = -6; c.right = 6; c.top = 9; c.bottom = -3; c.near = 1; c.far = 40;
      key.shadow.radius = 6; key.shadow.bias = -0.002;
    }
    key.target.position.set(BW / 2, 3, 0);
    sc.add(key); sc.add(key.target);
    var rimL = new T.DirectionalLight("#ff6ec0", 2.2); rimL.position.set(-6, 4, -6); sc.add(rimL);
    var rimR = new T.DirectionalLight("#5fd8ff", 2.2); rimR.position.set(12, 4, -6); sc.add(rimR);
    sc.add(new T.HemisphereLight("#d8d0ff", "#2a1d33", 0.8));
    sc.add(new T.AmbientLight("#fff8f0", 0.9));   /* 正面の補助は向きのない光で（正面からの光だと真ん中のつやが強すぎて黒い点になる） */

    /* 壁と床は描かない（シンプルに）。床には影と、ぼんやりした接地の暗がりだけ */
    var self = this;
    var shadowFloor = new T.Mesh(new T.PlaneGeometry(BW + 6, 6), new T.ShadowMaterial({ opacity: 0.35 }));
    shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.position.set(BW / 2, 0, 0); shadowFloor.receiveShadow = true; sc.add(shadowFloor);
    var dark = new T.Mesh(new T.PlaneGeometry(BW + 3, 1.6), new T.MeshBasicMaterial({ map: Z3.canvasTex(128, 32, function (g, w, h) {
      var gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, "rgba(10,6,20,.55)"); gr.addColorStop(1, "rgba(10,6,20,0)");
      g.setTransform(1, 0, 0, h / w, 0, h / 2 - h / 2 * h / w); g.fillStyle = gr; g.fillRect(0, 0, w, w);
    }), transparent: true, depthWrite: false }));
    dark.rotation.x = -Math.PI / 2; dark.position.set(BW / 2, 0.002, 0); sc.add(dark);

    /* あふれの線 */
    this.line = new T.Mesh(new T.BoxGeometry(BW, 0.035, 0.035), new T.MeshBasicMaterial({ color: "#ff6a8a", transparent: true, opacity: 0.5 }));
    this.line.position.set(BW / 2, 9, 1.0); sc.add(this.line);
    /* 落とす位置の目安 */
    this.guide = new T.Mesh(new T.BoxGeometry(0.025, 10, 0.025), new T.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.3 }));
    sc.add(this.guide);

    /* はじけの粒（しずく・かけら）と波紋とキラキラ。数を決めて使い回す */
    this.drop = new T.SphereGeometry(1, 12, 8);
    this.shard = new T.OctahedronGeometry(1, 0);
    this.parts = [];
    this.rings = [];
    this.spark = new T.MeshBasicMaterial({ map: Z3.canvasTex(64, 64, function (g, w, h) {
      var gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.6)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(255,255,255,.9)"; g.fillRect(w / 2 - 1, 4, 2, h - 8); g.fillRect(4, h / 2 - 1, w - 8, 2);
    }), transparent: true, depthWrite: false, blending: T.AdditiveBlending });

    this.mats = [];
    this.meshes = new Map();
    this.holdMesh = null;
    this.t = 0;
  }

  /* 角の丸い箱（壁の柱） */
  function roundBox(w, h, d, r) {
    var sh = new T.Shape(), x = -w / 2, y = -d / 2;
    sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r);
    sh.lineTo(x + w, y + d - r); sh.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    sh.lineTo(x + r, y + d); sh.quadraticCurveTo(x, y + d, x, y + d - r);
    sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
    var g = new T.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 6 });
    g.rotateX(-Math.PI / 2); g.translate(0, -h / 2, 0);
    return g;
  }

  /* 硬さごとの材質。やわらかいほど透けて、かたいほど詰まったグミ */
  GameScene.prototype.mat = function (lv, LV) {
    if (!this.mats[lv]) {
      var col = new T.Color(LV[lv].color);
      var u = lv / 4;                                 /* 0=スライム 1=宝石 */
      this.mats[lv] = new T.MeshPhysicalMaterial({
        color: col, roughness: 0.16 - u * 0.08, metalness: 0,   /* つるつるにしすぎると光が強すぎて黒い点になる */
        transmission: 0.3 + u * 0.45, thickness: 0.6 + u * 1.2, ior: 1.3 + u * 0.45,
        attenuationColor: col, attenuationDistance: 0.15 + u * 0.2,
        clearcoat: 1, clearcoatRoughness: 0.12,
        sheen: 0.5 * (1 - u), sheenColor: new T.Color("#ffffff"), sheenRoughness: 0.3,
        iridescence: u > 0.7 ? 0.35 : 0, iridescenceIOR: 1.6,
        specularIntensity: 1, envMapIntensity: 1.0 + u * 0.6,
        flatShading: lv >= 3
      });
    }
    return this.mats[lv];
  };

  /* 外周 n 点の輪から、厚みと丸い縁のある塊の形を作る（点の数は毎回同じ、位置だけ書き換える） */
  /* ふたの内側の輪の数。やわらかいものは輪を重ねてなめらかな丸いふくらみに（中心1点だと×のしわが出る）。宝石は1点でカット面に */
  var CAPR = [5, 5, 4, 0, 0];
  GameScene.prototype.blob = function (n, lv) {
    var g = new T.BufferGeometry(), KL = KLS[lv], R = CAPR[lv];
    var vcount = n * KL + 2 * n * R + 2;
    g.setAttribute("position", new T.BufferAttribute(new Float32Array(vcount * 3), 3));
    var idx = [];
    function band(r0, r1, flip) {               /* 2つの輪のあいだを帯でつなぐ */
      for (var i = 0; i < n; i++) {
        var a = r0 + i, b = r0 + (i + 1) % n, c = r1 + i, d = r1 + (i + 1) % n;
        if (flip) idx.push(a, d, b, a, c, d); else idx.push(a, b, d, a, d, c);
      }
    }
    for (var k = 0; k < KL - 1; k++) band(k * n, (k + 1) * n, false);
    var base = n * KL, front = base + 2 * n * R, backC = front + 1;
    /* 手前：外の輪 → 内の輪… → 中心 */
    var prev = (KL - 1) * n;
    for (var j = 0; j < R; j++) { band(prev, base + j * n, false); prev = base + j * n; }
    for (var i = 0; i < n; i++) idx.push(front, prev + i, prev + (i + 1) % n);
    /* 奥 */
    prev = 0;
    for (j = 0; j < R; j++) { band(prev, base + (R + j) * n, true); prev = base + (R + j) * n; }
    for (i = 0; i < n; i++) idx.push(backC, prev + (i + 1) % n, prev + i);
    g.setIndex(idx);
    g.userData.n = n; g.userData.lv = lv; g.userData.R = R;
    g.userData.sm = [];
    return g;
  };
  GameScene.prototype.shape = function (g, raw, cx, cy, swell, flat) {
    var n = g.userData.n, lv = g.userData.lv, pos = g.attributes.position.array, KL = KLS[lv], EDGE = EDGES[lv], R = g.userData.R;
    /* 表示用に外周をならす（物理の細かいガタつきで面が折れて、黒い点やしわが出ないように） */
    var pts = g.userData.sm, it, i;
    for (i = 0; i < n; i++) pts[i] = { x: raw[i].x, y: raw[i].y };
    var pass = lv >= 3 ? 0 : 3;
    for (it = 0; it < pass; it++) {
      var cp = pts.map(function (p) { return { x: p.x, y: p.y }; });
      for (i = 0; i < n; i++) {
        var a0 = cp[(i + n - 1) % n], a1 = cp[(i + 1) % n];
        pts[i].x = cp[i].x * 0.5 + (a0.x + a1.x) * 0.25; pts[i].y = cp[i].y * 0.5 + (a0.y + a1.y) * 0.25;
      }
    }
    /* 外向きの向き（ならした点から） */
    var nrm = [];
    for (i = 0; i < n; i++) {
      var q0 = pts[(i + n - 1) % n], q1 = pts[(i + 1) % n];
      var nx = q1.y - q0.y, ny = -(q1.x - q0.x), l = Math.hypot(nx, ny) || 1;
      nrm.push(nx / l, ny / l);
    }
    var D = DEPTH * swell;
    for (var k = 0; k < KL; k++) {
      var ang = -Math.PI / 2 + Math.PI * k / (KL - 1);           /* 奥 → 手前 */
      var z = Math.sin(ang) * D, inset = EDGE * (1 - Math.cos(ang));
      for (i = 0; i < n; i++) {
        var o = (k * n + i) * 3;
        pos[o] = pts[i].x - nrm[i * 2] * inset; pos[o + 1] = pts[i].y - nrm[i * 2 + 1] * inset; pos[o + 2] = z;
      }
    }
    /* ふた：外の縁（内側へ EDGE 入った輪）から中心へ、なだらかにふくらむ */
    var base = n * KL;
    for (var side = 0; side < 2; side++) {
      var sg = side === 0 ? 1 : -1;
      for (var j = 0; j < R; j++) {
        var f = 1 - (j + 1) / (R + 1);                            /* 1=縁 0=中心 */
        var zz = sg * D * (1 + (flat ? 0 : 0.09) * (1 - f * f));   /* くっついた塊は平らなふた（くびれで折れ目が出ないように） */
        for (i = 0; i < n; i++) {
          var ex = pts[i].x - nrm[i * 2] * EDGE, ey = pts[i].y - nrm[i * 2 + 1] * EDGE;
          var oo = (base + (side * R + j) * n + i) * 3;
          pos[oo] = cx + (ex - cx) * f; pos[oo + 1] = cy + (ey - cy) * f; pos[oo + 2] = zz;
        }
      }
    }
    var fi = (base + 2 * n * R) * 3, dome = flat ? 1 : R ? 1.09 : 1.08;
    pos[fi] = cx; pos[fi + 1] = cy; pos[fi + 2] = D * dome;
    pos[fi + 3] = cx; pos[fi + 4] = cy; pos[fi + 5] = -D * dome;
    g.attributes.position.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  };

  GameScene.prototype.reset = function () {
    var self = this;
    this.meshes.forEach(function (m) { self.scene.remove(m); m.geometry.dispose(); });
    this.meshes.clear();
    if (this.gmeshes) { this.gmeshes.forEach(function (m) { self.scene.remove(m); m.geometry.dispose(); }); this.gmeshes.clear(); }
    if (this.parts) this.reset2();
  };

  /* ============ くっついた同じ色を1つの塊として描く ============
     それぞれの輪の「内側からの距離」をなめらかに合わせ（くびれが埋まる）、
     まとまりの中心から放射状に境目を探して、1本の外周にする */
  function sdPoly(pts, x, y) {
    var n = pts.length, best = 1e9, c = false;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var a = pts[j], b = pts[i], ex = b.x - a.x, ey = b.y - a.y, l2 = ex * ex + ey * ey || 1e-9;
      var t = Math.max(0, Math.min(1, ((x - a.x) * ex + (y - a.y) * ey) / l2));
      var dx = a.x + ex * t - x, dy = a.y + ey * t - y, d = dx * dx + dy * dy;
      if (d < best) best = d;
      if ((b.y > y) !== (a.y > y) && x < (a.x - b.x) * (y - b.y) / (a.y - b.y) + b.x) c = !c;
    }
    best = Math.sqrt(best);
    return c ? -best : best;
  }
  function smin(a, b, k) { var h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
  function mergedOutline(group, M) {
    var cx = 0, cy = 0, all = 0, rmax = 0;
    group.forEach(function (b) { b.pts.forEach(function (p) { cx += p.x; cy += p.y; all++; }); });
    cx /= all; cy /= all;
    group.forEach(function (b) { b.pts.forEach(function (p) { rmax = Math.max(rmax, Math.hypot(p.x - cx, p.y - cy)); }); });
    rmax += 0.15;
    function f(x, y) { var v = 1e9; for (var i = 0; i < group.length; i++) v = smin(v, sdPoly(group[i].pts, x, y), 0.3); return v; }
    var out = [];
    for (var i = 0; i < M; i++) {
      var a = i / M * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a), r = rmax, st = 0.06;
      while (r > 0 && f(cx + dx * r, cy + dy * r) > 0) r -= st;
      var lo = Math.max(0, r), hi = r + st;
      for (var k = 0; k < 6; k++) { var mid = (lo + hi) / 2; if (f(cx + dx * mid, cy + dy * mid) > 0) hi = mid; else lo = mid; }
      r = (lo + hi) / 2;
      out.push({ x: cx + dx * r, y: cy + dy * r });
    }
    return { pts: out, cx: cx, cy: cy };
  }
  /* くっつきでつながったまとまり（はじけ中のものは外す） */
  function groupsOf(bodies) {
    var seen = new Set(), res = [];
    bodies.forEach(function (b) {
      if (seen.has(b)) return;
      var g = [], st = [b]; seen.add(b);
      while (st.length) {
        var x = st.pop(); g.push(x);
        for (var id in x.glue) { var o = x.glue[id]; if (!o.dead && !seen.has(o) && bodies.indexOf(o) >= 0) { seen.add(o); st.push(o); } }
      }
      if (g.length > 1) res.push(g);
    });
    return res;
  }

  GameScene.prototype.sync = function (s) {
    var self = this, used = new Set(), merged = new Set(), gUsed = new Set();
    if (!this.gmeshes) this.gmeshes = new Map();
    groupsOf(s.bodies).forEach(function (g) {
      var key = g.map(function (b) { return b.id; }).sort(function (a, b) { return a - b; }).join(",");
      var M = Math.min(72, 32 * g.length);
      var m = self.gmeshes.get(key);
      if (!m) {
        m = new T.Mesh(self.blob(M, g[0].lv), self.mat(g[0].lv, s.LV));
        m.castShadow = true; m.receiveShadow = true;
        self.scene.add(m); self.gmeshes.set(key, m);
      }
      gUsed.add(key);
      var o = mergedOutline(g, M);
      /* そろった塊は、はじける前にまとめてぶるぶるふくらむ */
      var pop = 0, ripe = 0;
      g.forEach(function (b) { pop = Math.max(pop, b.pop || 0); ripe = Math.max(ripe, b.ripe || 0); });
      var k = 1, kx = 1, ky = 1;
      if (pop) {
        var u = Math.min(1, pop / 0.32); k = 1 + u * u * 0.25;
        var w = Math.sin(pop * 70) * 0.07 * u; kx = k * (1 + w); ky = k * (1 - w);
      } else if (ripe > 0) {
        var w2 = Math.sin(ripe * 22) * 0.025 * Math.min(1, ripe * 3); kx = 1 + w2; ky = 1 - w2;   /* つながった、のぷるん */
      }
      var pts = (kx === 1 && ky === 1) ? o.pts : o.pts.map(function (p) { return { x: o.cx + (p.x - o.cx) * kx, y: o.cy + (p.y - o.cy) * ky }; });
      self.shape(m.geometry, pts, o.cx, o.cy, k, true);
      g.forEach(function (b) { merged.add(b); });
    });
    this.gmeshes.forEach(function (m, key) { if (!gUsed.has(key)) { self.scene.remove(m); m.geometry.dispose(); self.gmeshes.delete(key); } });
    s.bodies.forEach(function (b) {
      var m = self.meshes.get(b);
      if (!m) {
        m = new T.Mesh(self.blob(b.pts.length, b.lv), self.mat(b.lv, s.LV));
        m.castShadow = true; m.receiveShadow = true;
        self.scene.add(m); self.meshes.set(b, m);
      }
      used.add(b);
      var cx = 0, cy = 0;
      b.pts.forEach(function (p) { cx += p.x; cy += p.y; });
      cx /= b.pts.length; cy /= b.pts.length;
      m.userData.c = { x: cx, y: cy, lv: b.lv };
      /* はじける前：ぶるぶる震えながらふくらむ */
      var k = 1, kx = 1, ky = 1;
      if (b.pop) {
        var u = Math.min(1, b.pop / 0.32);
        k = 1 + u * u * 0.32;
        var w = Math.sin(b.pop * 70) * 0.09 * u;
        kx = k * (1 + w); ky = k * (1 - w);
      }
      var pts = k === 1 ? b.pts : b.pts.map(function (p) { return { x: cx + (p.x - cx) * kx, y: cy + (p.y - cy) * ky }; });
      m.visible = !merged.has(b);                   /* くっついている間は、まとまりの塊のほうを見せる */
      if (m.visible) self.shape(m.geometry, pts, cx, cy, k);
    });
    this.meshes.forEach(function (m, b) {
      if (used.has(b)) return;
      if (b.pop && m.userData.c) self.burst(m.userData.c, s.LV);
      self.scene.remove(m); m.geometry.dispose(); self.meshes.delete(b);
    });
    var dt = Math.max(0, Math.min(0.05, s.t - this.t)); this.t = s.t;
    this.stepFx(dt);

    /* 持っているブロック */
    if (s.hold) {
      if (this.holdMesh && this.holdMesh.geometry.userData.lv !== s.hold.lv) { this.scene.remove(this.holdMesh); this.holdMesh.geometry.dispose(); this.holdMesh = null; }
      if (!this.holdMesh) { this.holdMesh = new T.Mesh(this.blob(s.RESTS[s.hold.lv].length, s.hold.lv), this.mat(s.hold.lv, s.LV)); this.holdMesh.castShadow = true; this.scene.add(this.holdMesh); }
      var hm = this.holdMesh, wob = Math.sin(s.t * 5) * 0.03 * (1 - s.hold.lv / 4);
      hm.visible = true;
      this.shape(hm.geometry, s.RESTS[s.hold.lv].map(function (r) { return { x: s.hold.x + r.x * (1 + wob), y: s.hold.y + r.y * (1 - wob) }; }), s.hold.x, s.hold.y, 1);
      this.guide.visible = true;
      this.guide.position.set(s.hold.x, s.hold.y - 5.6, 0);
    } else {
      if (this.holdMesh) this.holdMesh.visible = false;
      this.guide.visible = false;
    }
    this.line.material.opacity = 0.35 + s.danger * 0.5;

    /* カメラ：正面やや上から箱全体 */
    var kk = s.kick || 0, sh = Math.sin(s.t * 60) * kk * 0.12;
    this.camera.position.set(s.BW / 2 + sh, 6.6 - kk * 0.25, 23.5 - kk * 0.6);
    this.camera.lookAt(s.BW / 2 + sh * 0.5, 5.3 - kk * 0.25, 0);
    this.camera.updateMatrixWorld();
  };

  /* はじけ：しずく（スライム）かかけら（宝石）が飛び散り、波紋が広がって、キラキラが残る */
  GameScene.prototype.burst = function (c, LV) {
    var lv = c.lv, gem = lv >= 3, mat = this.mat(lv, LV), col = new T.Color(LV[lv].color);
    var n = Z3.mobile ? 10 : 16;
    for (var i = 0; i < n; i++) {
      var m = new T.Mesh(gem ? this.shard : this.drop, mat);
      var a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 5;
      var r = gem ? 0.08 + Math.random() * 0.12 : 0.06 + Math.random() * 0.16;
      m.position.set(c.x, c.y, (Math.random() - 0.5) * 0.4);
      m.scale.setScalar(r);
      this.scene.add(m);
      this.parts.push({ m: m, r: r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 3, vz: (Math.random() - 0.2) * 4, life: 0.9 + Math.random() * 0.5, t: 0, gem: gem,
        spin: new T.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14) });
    }
    /* 波紋 */
    var ring = new T.Mesh(new T.RingGeometry(0.85, 1, 48), new T.MeshBasicMaterial({ color: col.clone().lerp(new T.Color("#ffffff"), 0.4), transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
    ring.position.set(c.x, c.y, 0.6); this.scene.add(ring);
    this.rings.push({ m: ring, t: 0 });
    /* やわらかい光の玉（その場で一度ふくらんで消える） */
    var bloom = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: this.glowTex, color: col, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    bloom.position.set(c.x, c.y, 0.7); this.scene.add(bloom);
    this.rings.push({ m: bloom, t: 0, bloom: true });
    /* キラキラ */
    for (i = 0; i < (gem ? 8 : 4); i++) {
      var sp2 = new T.Mesh(new T.PlaneGeometry(1, 1), this.spark.clone());
      sp2.material.color = col.clone().lerp(new T.Color("#ffffff"), 0.6);
      sp2.position.set(c.x + (Math.random() - 0.5) * 1.4, c.y + (Math.random() - 0.5) * 1.4, 0.8);
      this.scene.add(sp2);
      this.rings.push({ m: sp2, t: -Math.random() * 0.25, spark: true, s: 0.4 + Math.random() * 0.5 });
    }
  };
  GameScene.prototype.stepFx = function (dt) {
    var self = this;
    this.parts = this.parts.filter(function (p) {
      p.t += dt;
      p.vy -= 18 * dt; p.vx *= 0.99;
      var m = p.m;
      m.position.x += p.vx * dt; m.position.y += p.vy * dt; m.position.z += p.vz * dt;
      if (m.position.y < p.r * 0.5) { m.position.y = p.r * 0.5; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
      var u = p.t / p.life, k = u < 0.7 ? 1 : Math.max(0.001, 1 - (u - 0.7) / 0.3);
      if (p.gem) { m.rotation.x += p.spin.x * dt; m.rotation.y += p.spin.y * dt; m.scale.setScalar(p.r * k); }
      else {
        /* しずくは飛ぶ向きに少し伸びる */
        var v = Math.hypot(p.vx, p.vy), st = 1 + Math.min(0.8, v * 0.06);
        m.rotation.z = Math.atan2(p.vy, p.vx);
        m.scale.set(p.r * k * st, p.r * k / Math.sqrt(st), p.r * k);
      }
      if (p.t >= p.life) { self.scene.remove(m); return false; }
      return true;
    });
    this.rings = this.rings.filter(function (r) {
      r.t += dt;
      var m = r.m;
      if (r.t < 0) { m.visible = false; return true; }
      m.visible = true;
      if (r.spark) {
        var u = r.t / 0.5, sc = r.s * Math.sin(Math.min(1, u) * Math.PI);
        m.scale.setScalar(Math.max(0.001, sc)); m.rotation.z += dt * 3;
        if (u >= 1) { self.scene.remove(m); m.material.dispose(); return false; }
        return true;
      }
      if (r.bloom) {
        var ub = r.t / 0.35;
        m.scale.setScalar(1.5 + ub * 2.5); m.material.opacity = Math.max(0, 0.9 * (1 - ub));
        if (ub >= 1) { self.scene.remove(m); m.material.dispose(); return false; }
        return true;
      }
      var uu = r.t / 0.45;
      m.scale.setScalar(0.4 + uu * 1.8); m.material.opacity = Math.max(0, 0.9 * (1 - uu));
      if (uu >= 1) { self.scene.remove(m); m.geometry.dispose(); m.material.dispose(); return false; }
      return true;
    });
  };
  GameScene.prototype.reset2 = function () {
    var self = this;
    this.parts.forEach(function (p) { self.scene.remove(p.m); });
    this.rings.forEach(function (r) { self.scene.remove(r.m); });
    this.parts = []; this.rings = [];
  };

  /* 場面の点（手前の面 z=0）を画面の座標へ */
  GameScene.prototype.project = function (x, y) {
    var v = new T.Vector3(x, y, 0.5).project(this.camera);
    return { x: (v.x + 1) / 2 * this.W0, y: (1 - v.y) / 2 * this.H0 };
  };

  /* 画面の x を、高さ y の手前の面の x へ */
  GameScene.prototype.worldX = function (sx, W, H, y) {
    var v = new T.Vector3((sx / W) * 2 - 1, 0, 0.5).unproject(this.camera);
    var o = this.camera.position, d = v.sub(o);
    var t = (0 - o.z) / d.z;
    return o.x + d.x * t;
  };

  GameScene.prototype.draw = function (ctx, W, H) { this.W0 = W; this.H0 = H; return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
