/* 歯車機関の立体（three.js）。games/three-base.js の Z3 を土台にする。
   遊びの計算（噛み合い・向き・置ける場所）はゲーム側（index.html）の2Dの箱の座標でやり、
   ここは見た目だけ。箱の座標 (x, y) は立体では (x - 270, 0, y - 400) の床の上に置く。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var CX = 270, CZ = 400, TH = 28;            /* 箱の中心と歯車の厚み */

  function GearScene(PITCH) {
    T = global.THREE;
    this.PITCH = PITCH;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 1.05 }, camera: { fov: 30, near: 50, far: 8000 }, finish: { vignette: 0.38, grain: 0.02 } });
    this.scene = st.scene;
    this.camera = st.camera;
    this.scene.background = new T.Color(0x1c1612);
    var L = Z3.lights(this.scene, { shadows: true, shadowSize: 10 });
    L.key.position.set(-260, 900, 380);
    L.key.target.position.set(0, 0, 0); this.scene.add(L.key.target);
    var sc = L.key.shadow.camera; sc.left = -480; sc.right = 480; sc.top = 560; sc.bottom = -560; sc.near = 100; sc.far = 2400;
    L.key.shadow.bias = -0.0008;
    L.rim.position.set(500, 300, -600);
    L.fill.position.set(400, 200, 600);

    /* 床の鉄板 */
    var tex = Z3.canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = "#3a3029"; g.fillRect(0, 0, w, h);
      var r = Z3.rng(3);
      for (var i = 0; i < 2600; i++) { g.fillStyle = "rgba(" + (r() < 0.5 ? "0,0,0," : "255,220,180,") + (r() * 0.03) + ")"; g.fillRect(r() * w, r() * h, 2 + r() * 6, 1 + r() * 2); }
      g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 3;
      g.strokeRect(2, 2, w - 4, h - 4);
      g.fillStyle = "rgba(190,160,120,.12)";
      for (var k = 0; k < 8; k++) {
        [[16 + k * 68, 16], [16 + k * 68, h - 16], [16, 16 + k * 68], [w - 16, 16 + k * 68]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 5, 0, 7); g.fill(); });
      }
    });
    tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(4, 6);
    var floor = new T.Mesh(new T.PlaneGeometry(1200, 1800), Z3.std(0xffffff, { map: tex, roughness: 0.75, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    this.scene.add(floor);

    /* 金属に映り込む周り（暗い部屋に、上の明かりが何本か） */
    var es = new T.Scene();
    es.add(new T.Mesh(new T.BoxGeometry(30, 14, 30), new T.MeshBasicMaterial({ color: 0x2a241f, side: T.BackSide })));
    function panel(w, h, x, y, z, color) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: color, side: T.DoubleSide }));
      m.position.set(x, y, z); m.rotation.x = Math.PI / 2; es.add(m);
    }
    panel(14, 1.6, -3, 6.8, -4, 0xffffff);
    panel(2.2, 12, 5, 6.8, 1, 0xfff0d8);
    panel(9, 1.2, 1, 6.8, 6, 0xffffff);
    panel(30, 30, 0, 6.9, 0, 0x5a5048);
    var pm = new T.PMREMGenerator(st.renderer);
    this.scene.environment = pm.fromScene(es, 0.04).texture;
    this.scene.environmentIntensity = 1.45;
    pm.dispose();

    /* 旋盤で削ったような細かい同心円の筋（歯車の上の面のつや） */
    var lathe = Z3.canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = "#808080"; g.fillRect(0, 0, w, h);
      var r = Z3.rng(9);
      for (var k = 2; k < 256; k += 1.5) {
        g.strokeStyle = "rgba(" + (r() < 0.5 ? "255,255,255," : "0,0,0,") + (0.08 + r() * 0.22) + ")";
        g.lineWidth = 0.6 + r(); g.beginPath(); g.arc(256, 256, k, 0, Math.PI * 2); g.stroke();
      }
    });
    lathe.colorSpace = T.NoColorSpace;
    lathe.repeat.set(1 / 270, 1 / 270); lathe.offset.set(0.5, 0.5);
    function metal(color, rough, metalness) {
      return Z3.std(color, { roughness: rough, metalness: metalness, bumpMap: lathe, bumpScale: 0.6, roughnessMap: lathe });
    }
    this.mat = {
      my: metal(0xe0b04c, 0.42, 0.9),
      drv: metal(0xd2d8de, 0.36, 0.92),
      tg: metal(0xd07a48, 0.44, 0.88),
      fix: metal(0x6a655e, 0.7, 0.85),
      stop: metal(0x9aa6b2, 0.4, 0.88),
      ok: Z3.std(0x8be070, { roughness: 0.5, transparent: true, opacity: 0.7 }),
      bad: Z3.std(0xe0503c, { roughness: 0.5, transparent: true, opacity: 0.7 }),
      plain: Z3.std(0xd6a640, { roughness: 0.5, transparent: true, opacity: 0.7 }),
      hub: Z3.std(0x2c241e, { roughness: 0.5, metalness: 0.4 }),
      iron: Z3.std(0x4e463f, { roughness: 0.55, metalness: 0.45 }),
      boiler: Z3.std(0x7d8a94, { roughness: 0.3, metalness: 0.85 }),
      brassBand: Z3.std(0xc8a046, { roughness: 0.3, metalness: 0.7 }),
      dark: Z3.std(0x26201b, { roughness: 0.7 }),
      fire: new T.MeshBasicMaterial({ color: 0xff8a2a }),
      blade: Z3.std(0xeee4cf, { roughness: 0.5 }),
      glass: new T.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.45 }),
      liquid: Z3.std(0x58e0b0, { roughness: 0.2, emissive: 0x1a6050, transparent: true, opacity: 0.85 }),
      bulbOff: Z3.std(0xcfd6da, { roughness: 0.1, transparent: true, opacity: 0.55 }),
      bulbOn: new T.MeshBasicMaterial({ color: 0xfff3b0 }),
      peg: Z3.std(0xb8923e, { roughness: 0.3, metalness: 0.7 })
    };
    this.arrowMat = {
      need: new T.MeshBasicMaterial({ color: 0xf2c14e }),
      ok: new T.MeshBasicMaterial({ color: 0x7be07b }),
      bad: new T.MeshBasicMaterial({ color: 0xff5a4a })
    };
    this.geoCache = {};
    this.root = new T.Group(); this.scene.add(this.root);       /* 面ごとの物 */
    this.gearRoot = new T.Group(); this.scene.add(this.gearRoot);
    this.gearMesh = new Map();
    this.preview = null; this.previewKey = "";

    /* 湯気の粒 */
    var puffTex = Z3.canvasTex(64, 64, function (g) {
      var gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    this.puffs = [];
    for (var i = 0; i < 60; i++) {
      var sp = new T.Sprite(new T.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 }));
      sp.visible = false; this.scene.add(sp);
      this.puffs.push({ s: sp, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 20 });
    }
    var glowTex = Z3.canvasTex(64, 64, function (g) {
      var gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
      gr.addColorStop(0, "rgba(255,230,140,1)"); gr.addColorStop(0.35, "rgba(255,200,90,.5)"); gr.addColorStop(1, "rgba(255,180,60,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    this.glowMat = new T.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
    this.camKey = "";
  }

  /* 歯車の形（歯の数ごとに使い回す） */
  GearScene.prototype.gearGeo = function (n) {
    if (this.geoCache[n]) return this.geoCache[n];
    var P = this.PITCH, r = n * P / (2 * Math.PI);
    var ro = r + P * 0.32, ri = r - P * 0.36, step = 2 * Math.PI / n;
    var s = new T.Shape();
    for (var k = 0; k < n; k++) {
      var b = k * step;
      var pts = [[b - step * 0.32, ri], [b - step * 0.17, ro], [b + step * 0.17, ro], [b + step * 0.32, ri]];
      pts.forEach(function (p, i) {
        var x = Math.cos(p[0]) * p[1], y = Math.sin(p[0]) * p[1];
        if (k === 0 && i === 0) s.moveTo(x, y); else s.lineTo(x, y);
      });
    }
    s.closePath();
    var hub = Math.max(7, r * 0.22);
    if (r > 34) {
      /* 穴どうし・縁と重ならない大きさにする（重なると面が崩れる） */
      var holes = r > 70 ? 6 : 4, m = (hub + r - P * 0.6) / 2;
      var hr = Math.min((r - P * 0.6 - hub) * 0.36, m * Math.sin(Math.PI / holes) * 0.78);
      for (var j = 0; j < holes; j++) {
        var a = j * 2 * Math.PI / holes, h = new T.Path();
        h.absarc(Math.cos(a) * m, Math.sin(a) * m, hr, 0, Math.PI * 2, true);
        s.holes.push(h);
      }
    }
    var g = new T.ExtrudeGeometry(s, { depth: TH, bevelEnabled: true, bevelThickness: 2.5, bevelSize: 1.8, bevelSegments: 2, curveSegments: 10 });
    g.rotateX(Math.PI / 2); g.translate(0, TH + 1.5, 0);
    this.geoCache[n] = g;
    return g;
  };

  function hubMesh(r, mat) {
    var hub = Math.max(7, r * 0.22);
    var m = new T.Mesh(new T.CylinderGeometry(hub, hub, TH + 8, 20), mat);
    m.position.y = (TH + 8) / 2; m.castShadow = true;
    return m;
  }

  /* 機械の付属物 */
  GearScene.prototype.machine = function (g) {
    var M = this.mat, grp = new T.Group();
    if (g.kind === "fan") {
      var spin = new T.Group(); spin.position.y = TH + 18;
      for (var k = 0; k < 3; k++) {
        var bl = new T.Mesh(new T.BoxGeometry(g.r * 0.85, 3, g.r * 0.32), M.blade);
        bl.geometry.translate(g.r * 0.45, 0, 0);
        bl.rotation.y = k * Math.PI * 2 / 3; bl.rotation.x = 0.35;
        bl.castShadow = true; spin.add(bl);
      }
      var cap = new T.Mesh(new T.SphereGeometry(8, 12, 8), M.hub); spin.add(cap);
      grp.add(spin); grp.userData.spin = spin;
    } else if (g.kind === "lamp") {
      var post = new T.Mesh(new T.CylinderGeometry(4, 4, 46, 10), M.iron); post.position.y = 23; grp.add(post);
      var sock = new T.Mesh(new T.CylinderGeometry(9, 9, 10, 14), M.brassBand); sock.position.y = 50; grp.add(sock);
      var bulb = new T.Mesh(new T.SphereGeometry(17, 18, 14), M.bulbOff); bulb.position.y = 68; bulb.castShadow = true; grp.add(bulb);
      var glow = new T.Sprite(this.glowMat); glow.scale.set(220, 220, 1); glow.position.y = 68; glow.visible = false; grp.add(glow);
      grp.userData.bulb = bulb; grp.userData.glow = glow;
    } else if (g.kind === "whistle") {
      var pipe = new T.Mesh(new T.CylinderGeometry(9, 11, 60, 14), M.brassBand); pipe.position.y = 30 + TH; pipe.castShadow = true; grp.add(pipe);
      var bell = new T.Mesh(new T.CylinderGeometry(14, 10, 22, 14), M.brassBand); bell.position.y = 70 + TH; bell.castShadow = true; grp.add(bell);
      grp.userData.top = 82 + TH;
    } else if (g.kind === "glass") {
      var flask = new T.Mesh(new T.SphereGeometry(26, 18, 14), M.glass); flask.position.y = 46 + TH; grp.add(flask);
      var neck = new T.Mesh(new T.CylinderGeometry(8, 9, 30, 12), M.glass); neck.position.y = 80 + TH; grp.add(neck);
      var liq = new T.Mesh(new T.SphereGeometry(20, 16, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), M.liquid); liq.position.y = 46 + TH; grp.add(liq);
      var stand = new T.Mesh(new T.CylinderGeometry(14, 18, 20, 14), M.iron); stand.position.y = 14 + TH; grp.add(stand);
      grp.userData.flask = grp;
    }
    return grp;
  };

  /* 回す向きの矢印（機械の歯車のまわりの弧と先端）。need=0 は「回すな」の輪と斜線 */
  GearScene.prototype.arrow = function (g) {
    var grp = new T.Group(), R = g.r + 22, mat = this.arrowMat.need;
    if (g.need === 0) {
      var ring = new T.Mesh(new T.TorusGeometry(R, 5, 8, 48), mat);
      ring.rotation.x = Math.PI / 2; grp.add(ring);
      var bar = new T.Mesh(new T.BoxGeometry(R * 2, 6, 10), mat); bar.rotation.y = Math.PI / 4; grp.add(bar);
    } else {
      var arc = Math.PI * 0.7;
      var tor = new T.Mesh(new T.TorusGeometry(R, 5, 8, 32, arc), mat);
      tor.rotation.x = Math.PI / 2;
      /* 画面の上側（奥）に弧を置く。床の上で見て2Dの角度 -0.85π〜-0.15π */
      tor.rotation.z = -Math.PI * 0.85;
      grp.add(tor);
      var e = g.need > 0 ? -Math.PI * 0.15 : -Math.PI * 0.85, d = g.need > 0 ? 1 : -1;
      var cone = new T.Mesh(new T.ConeGeometry(11, 24, 12), mat);
      cone.position.set(Math.cos(e) * R, 0, Math.sin(e) * R);
      /* 先端を進む向き（接線）へ */
      var tx = -Math.sin(e) * d, tz = Math.cos(e) * d;
      cone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(tx, 0, tz));
      cone.position.x += tx * 8; cone.position.z += tz * 8;
      grp.add(cone);
    }
    grp.position.set(g.x - CX, TH + 40, g.y - CZ);
    grp.userData.parts = grp.children;
    return grp;
  };

  /* 面が変わったら置き物を作り直す */
  GearScene.prototype.load = function (st, obs, pegs) {
    var M = this.mat, self = this;
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    this.gearMesh.forEach(function (o) { self.gearRoot.remove(o.grp); });
    this.gearMesh.clear();
    this.arrows = [];
    obs.forEach(function (o) {
      if (o.boiler) {
        /* 釜：横倒しの円筒と焚き口、煙突 */
        var len = Math.max(140, 860 - o.y);
        /* 歯車を隠さないよう、低くつぶした円筒にする */
        var bg = new T.Group(); bg.scale.y = 0.42; self.root.add(bg);
        var b = new T.Mesh(new T.CylinderGeometry(o.w / 2, o.w / 2, len, 28), M.boiler);
        b.rotation.x = Math.PI / 2; b.position.set(o.x + o.w / 2 - CX, 0, o.y + len / 2 - 10 - CZ);
        b.castShadow = b.receiveShadow = true; bg.add(b);
        for (var k = 0; k * 46 + 34 < len - 20; k++) {
          var band = new T.Mesh(new T.CylinderGeometry(o.w / 2 + 2, o.w / 2 + 2, 6, 28), M.brassBand);
          band.rotation.x = Math.PI / 2; band.position.set(b.position.x, 0, o.y + 24 + k * 46 - CZ);
          bg.add(band);
        }
        var top = o.w / 2 * 0.42;
        var fireBox = new T.Mesh(new T.BoxGeometry(46, 6, 34), M.dark);
        fireBox.position.set(b.position.x, top + 1, Math.min(o.y + 110, 760) - CZ); self.root.add(fireBox);
        var fire = new T.Mesh(new T.BoxGeometry(36, 4, 22), M.fire);
        fire.position.set(b.position.x, top + 4, fireBox.position.z); self.root.add(fire);
        o.fire = fire;
        /* 煙突は歯車の横 */
        var dr = o.drv, cxp = dr.x + dr.r + 26 > 520 ? dr.x - dr.r - 26 : dr.x + dr.r + 26;
        var ch = new T.Mesh(new T.CylinderGeometry(12, 14, 70, 16), M.iron);
        ch.position.set(cxp - CX, 35, dr.y + 20 - CZ); ch.castShadow = true; self.root.add(ch);
        var lip = new T.Mesh(new T.CylinderGeometry(17, 17, 10, 16), M.iron); lip.position.set(ch.position.x, 72, ch.position.z); self.root.add(lip);
        o.chimney = new T.Vector3(ch.position.x, 78, ch.position.z);
      } else {
        var h = 46;
        var m = new T.Mesh(new T.BoxGeometry(o.w, h, o.h), M.iron);
        m.position.set(o.x + o.w / 2 - CX, h / 2, o.y + o.h / 2 - CZ);
        m.castShadow = m.receiveShadow = true; self.root.add(m);
        /* 鋲 */
        var cols = Math.max(1, Math.floor(o.w / 40));
        for (var i = 0; i <= cols; i++) {
          [o.y + 7, o.y + o.h - 7].forEach(function (yy) {
            var rv = new T.Mesh(new T.SphereGeometry(3, 6, 4), M.brassBand);
            rv.position.set(o.x + 8 + (o.w - 16) * i / cols - CX, h, yy - CZ); self.root.add(rv);
          });
        }
      }
    });
    (pegs || []).forEach(function (p) {
      var m = new T.Mesh(new T.CylinderGeometry(9, 12, 10, 16), M.peg);
      m.position.set(p[0] - CX, 5, p[1] - CZ); m.castShadow = true; self.root.add(m);
      var ring = new T.Mesh(new T.TorusGeometry(16, 2, 6, 24), M.peg); ring.rotation.x = Math.PI / 2;
      ring.position.set(p[0] - CX, 1, p[1] - CZ); self.root.add(ring);
    });
    this.obs = obs;
  };

  GearScene.prototype.ensure = function (g) {
    var o = this.gearMesh.get(g);
    if (o) return o;
    var grp = new T.Group();
    var key = g.type === "tg" && g.need === 0 ? "stop" : g.type;
    var body = new T.Mesh(this.gearGeo(g.n), this.mat[key]);
    body.castShadow = true; body.receiveShadow = true;
    grp.add(body);
    grp.add(hubMesh(g.r, this.mat.hub));
    var mach = null, arrow = null;
    if (g.type === "tg") {
      mach = this.machine(g); grp.add(mach);
      arrow = this.arrow(g); this.root.add(arrow);
    }
    grp.position.set(g.x - CX, 0, g.y - CZ);
    this.gearRoot.add(grp);
    o = { grp: grp, body: body, mach: mach, arrow: arrow };
    this.gearMesh.set(g, o);
    return o;
  };

  GearScene.prototype.puff = function (p, size, up, spread) {
    for (var i = 0; i < this.puffs.length; i++) {
      var q = this.puffs[i];
      if (q.life > 0) continue;
      q.life = q.max = 1.2 + Math.random() * 0.6;
      q.s.position.copy(p);
      q.vx = (Math.random() - 0.5) * spread; q.vz = (Math.random() - 0.5) * spread - 10; q.vy = up;
      q.size = size; q.s.visible = true;
      return;
    }
  };

  /* s: { t, dt, gears:[{g, angle, shake}], running, preview:{x,y,n,ok,mesh}|null, jam } */
  GearScene.prototype.sync = function (s) {
    var self = this, live = new Set();
    s.gears.forEach(function (it) {
      var g = it.g, o = self.ensure(g);
      live.add(g);
      var sx = 0, sz = 0;
      if (it.shake) { sx = (Math.random() - 0.5) * 3; sz = (Math.random() - 0.5) * 3; }
      o.grp.position.set(g.x - CX + sx, 0, g.y - CZ + sz);
      var pop = it.born < 1 ? 0.85 + 0.15 * it.born : 1;
      o.grp.scale.set(pop, 1, pop);
      o.body.rotation.y = -it.angle;
      o.grp.children[1].rotation.y = -it.angle;
      if (o.mach) {
        var u = o.mach.userData, run = it.turning && g.need !== 0 && g.dir === g.need;
        if (u.spin) u.spin.rotation.y = -it.angle * 1;
        if (u.bulb) { u.bulb.material = run ? self.mat.bulbOn : self.mat.bulbOff; u.glow.visible = run; if (run) { var f = 1 + 0.05 * Math.sin(s.t * 20); u.glow.scale.set(240 * f, 240 * f, 1); } }
        if (u.top && run && Math.random() < s.dt * 22) self.puff(new T.Vector3(g.x - CX, u.top, g.y - CZ), 26, 160, 50);
        if (g.need === 0) {
          var w = it.turning ? Math.sin(s.t * 40) * 0.12 : 0;
          o.mach.rotation.z = w;
        }
      }
      if (o.arrow) {
        o.arrow.visible = s.showArrows;
        var m = g.need === 0 ? (it.turning ? (Math.floor(s.t * 4) % 2 ? self.arrowMat.bad : self.arrowMat.need) : self.arrowMat.ok)
          : (!it.jam && g.dir === g.need) ? self.arrowMat.ok : (g.dir !== 0 || it.jam) ? (Math.floor(s.t * 4) % 2 ? self.arrowMat.bad : self.arrowMat.need) : self.arrowMat.need;
        o.arrow.children.forEach(function (c) { c.material = m; });
        o.arrow.position.y = TH + 40 + Math.sin(s.t * 3 + g.x) * 3;
      }
    });
    this.gearMesh.forEach(function (o, g) {
      if (live.has(g)) return;
      self.gearRoot.remove(o.grp);
      if (o.arrow) self.root.remove(o.arrow);
      self.gearMesh.delete(g);
    });
    /* 描いている途中の歯車 */
    var pv = s.preview;
    if (pv) {
      var key = pv.n + (pv.ok ? (pv.mesh ? "m" : "p") : "b");
      if (key !== this.previewKey) {
        if (this.preview) this.scene.remove(this.preview);
        this.preview = new T.Mesh(this.gearGeo(pv.n), !pv.ok ? this.mat.bad : pv.mesh ? this.mat.ok : this.mat.plain);
        this.scene.add(this.preview); this.previewKey = key;
      }
      this.preview.position.set(pv.x - CX, 6, pv.y - CZ);
      this.preview.visible = true;
    } else if (this.preview) { this.preview.visible = false; this.previewKey = ""; this.scene.remove(this.preview); this.preview = null; }
    /* 釜の火と煙 */
    (this.obs || []).forEach(function (o) {
      if (!o.boiler) return;
      if (o.fire) { var fl = 0.7 + 0.3 * Math.sin(s.t * 13) * Math.sin(s.t * 7.3); o.fire.scale.set(1, 1, fl); }
      if (Math.random() < s.dt * (s.running ? 18 : 4)) self.puff(o.chimney, s.running ? 34 : 22, s.running ? 220 : 110, 30);
    });
    this.puffs.forEach(function (q) {
      if (q.life <= 0) return;
      q.life -= s.dt;
      if (q.life <= 0) { q.s.visible = false; return; }
      var k = 1 - q.life / q.max;
      q.s.position.x += q.vx * s.dt; q.s.position.y += q.vy * s.dt; q.s.position.z += q.vz * s.dt;
      var sz = q.size * (1 + k * 2.2);
      q.s.scale.set(sz, sz, 1);
      q.s.material.opacity = 0.6 * (1 - k);
    });
  };

  /* カメラ：少し手前から見下ろす。箱の幅がちょうど収まる距離に置く */
  GearScene.prototype.fit = function (W, H) {
    var key = W + "x" + H;
    if (key === this.camKey) return;
    this.camKey = key;
    var aspect = W / H, t = Math.tan(15 * Math.PI / 180);
    var D = Math.max(292 / (t * aspect), 470 / t);
    var tilt = 0.5 * Math.PI / 180;            /* 2Dのときと同じく、ほぼ真上から */
    var look = new T.Vector3(0, 0, -10);
    this.camera.position.set(0, Math.cos(tilt) * D, look.z + Math.sin(tilt) * D);
    this.camera.lookAt(look);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  };

  /* 画面の点（ゲームの canvas 座標）→ 床の上の箱の座標 */
  GearScene.prototype.pick = function (px, py, W, H) {
    this.fit(W, H);
    var v = new T.Vector3(px / W * 2 - 1, -(py / H * 2 - 1), 0.5).unproject(this.camera);
    var o = this.camera.position, d = v.sub(o).normalize();
    var k = -o.y / d.y;
    return { x: o.x + d.x * k + CX, y: o.z + d.z * k + CZ };
  };
  /* 箱の座標 → 画面の点 */
  GearScene.prototype.toScreen = function (x, y, h, W, H) {
    this.fit(W, H);
    var v = new T.Vector3(x - CX, h || 0, y - CZ).project(this.camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
  };

  GearScene.prototype.draw = function (ctx, W, H) { this.fit(W, H); return this.stage.draw(ctx, W, H); };

  global.GearScene = GearScene;
})(window);
