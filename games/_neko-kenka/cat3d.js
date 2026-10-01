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
    this.scene.add(new T.HemisphereLight(0xdfe6ff, 0x3a3048, 1.7));
    var moon = new T.DirectionalLight(0xfff2d8, 2.2); moon.position.set(250, 450, 600); this.scene.add(moon);
    var rim = new T.DirectionalLight(0x9fb8ff, 1.4); rim.position.set(-300, 250, -400); this.scene.add(rim);
    this.ball = new T.SphereGeometry(1, 32, 20);
    this.leg = new T.CapsuleGeometry(5.5, 38, 6, 12);
    this.torso = new T.CapsuleGeometry(1, 1.9, 10, 20);
    this.ear = new T.ConeGeometry(1, 1, 16);
    this.fang = new T.ConeGeometry(1, 1, 8);
    this.mats = {};
    this.mat = function (color, glow) {
      var key = color + "-" + !!glow;
      if (!self.mats[key]) {
        self.mats[key] = glow
          ? new T.MeshBasicMaterial({ color: color })
          : new T.MeshToonMaterial({ color: color });
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
    /* 胴：横に寝かせたカプセル */
    c.torso = part(g, new T.CapsuleGeometry(1, 1.9, 16, 40), 0, 64, 0, 22, 30, 21);
    c.torso.rotation.z = Math.PI / 2;
    c.bib = part(g, this.ball, 34, 60, 0, 16, 19, 17, "light");
    /* 脚：細いカプセルと白い足先 */
    c.legs = [[-34, 10], [-28, -10], [30, 10], [36, -10]].map(function (p) {
      var pivot = new T.Group(); pivot.position.set(p[0], 52, p[1]); g.add(pivot);
      pivot.userData.leg = part(pivot, new T.CapsuleGeometry(5.5, 38, 8, 20), 0, -24, 0, 1, 1, 1);
      part(pivot, self.ball, 2, -49, 0, 8, 4.5, 7, "light");
      return pivot;
    });
    /* しっぽ：曲線に沿った管（毎コマ作り直す） */
    c.tailMesh = null;
    c.tailTip = part(g, this.ball, 0, 0, 0, 7, 7, 7);
    /* 頭 */
    c.head = new T.Group(); c.head.position.set(66, 92, 0); g.add(c.head);
    c.skull = part(c.head, new T.SphereGeometry(1, 48, 32), 0, 0, 0, 24, 24, 24);   /* 頭は球ひとつ */
    /* 毛の逆立ち：胴と頭の頂点を、表面の向きへばらばらに押し出す。
       胴は上側ほど、頭は顔の正面を避けて立てる */
    c.shag = [
      shaggy(c.torso, function (n) { return Math.max(0, Math.min(1, (n.x + 0.3) / 0.8)); }),
      shaggy(c.skull, function (n) { return Math.max(0, Math.min(1, (0.4 - n.x) / 0.6)) * Math.max(0, Math.min(1, (n.y + 0.6) / 0.6)); })
    ].concat(c.legs.map(function (l) {
      /* 脚は実寸の形なので押し出しも実寸で。足先近くは控えめに */
      var sh = shaggy(l.userData.leg, function () { return 1; }, 7);
      var pa = l.userData.leg.geometry.attributes.position;
      for (var q = 0; q < pa.count; q++) sh.w[q] = Math.max(0, Math.min(1, (pa.getY(q) + 18) / 20));
      return sh;
    }));
    /* 口：頭の表面に貼った薄い楕円。上のふちを固定して下へ開き、牙はそのふちに付ける */
    var ma = -0.4;
    c.mouthG = new T.Group(); c.mouthG.position.set(24 * Math.cos(ma), 24 * Math.sin(ma), 0); c.mouthG.rotation.z = ma; c.head.add(c.mouthG);
    c.mouth = part(c.mouthG, this.ball, 0, 0, 0, 2, 1, 7, "mouth");
    c.tongue = part(c.mouthG, this.ball, 0.8, 0, 0, 1.2, 1.5, 4.5, "nose");
    c.fangs = [-3.6, 3.6].map(function (z) { var f = part(c.mouthG, self.fang, 1.6, 0, z, 1.3, 4, 1.3, "fang"); f.rotation.z = Math.PI; return f; });
    c.ears = [-11, 11].map(function (z) {
      var pivot = new T.Group(); pivot.position.set(-3, 17, z); pivot.rotation.x = z > 0 ? 0.25 : -0.25; c.head.add(pivot);
      part(pivot, self.ear, 0, 11, 0, 10, 22, 5);
      part(pivot, self.ear, 1.5, 9, 0, 6, 15, 3, "nose");
      return pivot;
    });
    c.eyes = [-9.5, 9.5].map(function (z) {
      var eye = new T.Group(); eye.position.set(20, 5, z); c.head.add(eye);
      part(eye, self.ball, 0, 0, 0, 3.5, 5.5, 3.5, "pupil");   /* 黒い丸ひとつ */
      return eye;
    });
    /* ひげ：ほおから横へ広げる */
    var wm = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
    [-1, 1].forEach(function (side) {
      for (var k = -1; k <= 1; k++) {
        var geo = new T.BufferGeometry().setFromPoints([new T.Vector3(19, -4, side * 10), new T.Vector3(24, -2 + k * 7, side * 36)]);
        c.head.add(new T.Line(geo, wm));
      }
    });
    return c;
  };

  function shaggy(mesh, weightOf, unit) {
    var T = global.THREE, geo = mesh.geometry, pos = geo.attributes.position, nrm = geo.attributes.normal;
    var base = new Float32Array(pos.array), w = new Float32Array(pos.count), h = new Float32Array(pos.count), n = new T.Vector3();
    var seen = {};
    for (var i = 0; i < pos.count; i++) {
      n.fromBufferAttribute(nrm, i);
      w[i] = weightOf(n);
      /* 継ぎ目で同じ位置の頂点が裂けないよう、位置から乱数を決める */
      var key = base[i * 3].toFixed(3) + "," + base[i * 3 + 1].toFixed(3) + "," + base[i * 3 + 2].toFixed(3);
      if (seen[key] == null) { var r = Math.sin(i * 12.9898 + 78.233) * 43758.5453; seen[key] = r - Math.floor(r); }
      h[i] = seen[key];
    }
    return { mesh: mesh, base: base, w: w, h: h, nrm: new Float32Array(nrm.array), level: -1, unit: unit || 1 };
  }
  function ruffle(sh, amount, t) {
    if (amount < 0.01 && sh.level === 0) return;
    var pos = sh.mesh.geometry.attributes.position, a = pos.array, b = sh.base, nr = sh.nrm;
    for (var i = 0; i < pos.count; i++) {
      var h = sh.h[i], spike = 0.1 + 0.85 * h * h * h;
      var d = amount * sh.w[i] * spike * sh.unit * (1 + 0.12 * Math.sin(t * 35 + h * 40));
      a[i * 3] = b[i * 3] + nr[i * 3] * d;
      a[i * 3 + 1] = b[i * 3 + 1] + nr[i * 3 + 1] * d;
      a[i * 3 + 2] = b[i * 3 + 2] + nr[i * 3 + 2] * d;
    }
    pos.needsUpdate = true;
    sh.mesh.geometry.computeVertexNormals();
    sh.level = amount < 0.01 ? 0 : 1;
  }

  function lighten(hex, k) {
    var r = hex >> 16, g = (hex >> 8) & 255, b = hex & 255;
    return (Math.round(r + (255 - r) * k) << 16) | (Math.round(g + (255 - g) * k) << 8) | Math.round(b + (255 - b) * k);
  }

  CatScene.prototype.paint = function (c, col) {
    if (c.color === col) return;
    c.color = col;
    var self = this, body = parseInt(col.body.slice(1), 16), eye = parseInt(col.eye.slice(1), 16);
    var light = lighten(body, 0.55);
    var dark = ((body >> 16) + ((body >> 8) & 255) + (body & 255)) / 3 < 80;
    var dot = dark ? eye : 0x0c0c0c;                       /* 黒い猫は目を明るい色に */
    c.bodyHex = body;
    c.parts.forEach(function (m) {
      var r = m.userData.role;
      m.material = r === "mouth" ? self.mat(0x2a0a10) : r === "fang" || r === "shine" ? self.mat(0xffffff, true)
        : r === "nose" ? self.mat(0xe48a96) : r === "eye" ? self.mat(eye, true) : r === "pupil" ? self.mat(dot, true)
        : r === "light" ? self.mat(light) : self.mat(body);
    });
    if (c.tailMesh) c.tailMesh.material = self.mat(body);
  };

  /* s: {x, y, face(1:右), size, puff, open, run, t, col} */
  CatScene.prototype.pose = function (c, s) {
    var T = global.THREE;
    this.paint(c, s.col);
    var g = c.g, run = s.run > 0;
    g.visible = true;
    g.position.set(s.x, -s.y, 0);
    g.scale.setScalar(s.size);
    var face = run ? -s.face : s.face;
    g.rotation.set(0, face > 0 ? -0.45 : Math.PI + 0.45, 0);
    var bt = s.brawl || 0, sd = s.seed || 0;
    if (bt) {
      /* 取っ組み合い：全身がぐるぐる転げ回る */
      g.rotation.set(Math.sin(bt * 17 + sd) * 1.3, g.rotation.y + bt * 11 * (sd ? 1 : -1), Math.sin(bt * 13 + sd * 2) * 1.6);
      g.position.y += Math.abs(Math.sin(bt * 11 + sd)) * 45;
    }
    var puff = s.puff, arch = run ? 0 : puff;
    var bristle = run ? 0 : (s.fur || 0);
    /* 0:胴（強め） 1:頭（立てない） 2〜:脚 */
    c.shag.forEach(function (sh, i) { ruffle(sh, bristle * (i === 0 ? 1.8 : i === 1 ? 0 : 1), s.t); });
    c.torso.position.y = 62 + arch * 4;
    c.torso.scale.set(21 + puff * 4, 30, 20 + puff * 4);
    var legPh = run ? Math.sin(s.run * 30) : 0;
    c.legs.forEach(function (l, i) {
      l.position.y = 52 + arch * 3;
      l.rotation.z = bt ? Math.sin(bt * 40 + i * 2 + sd) * 1.6 : legPh * 0.8 * (i % 2 ? 1 : -1);
      l.rotation.x = bt ? Math.cos(bt * 33 + i + sd) * 1.2 : 0;
    });
    /* しっぽ：逃げるときは後ろへ流し、威嚇中は高く立てて太らせる */
    var pts = [];
    for (var k = 0; k < 7; k++) {
      var u2 = k / 6, x, y;
      if (run) { x = -50 - u2 * 70; y = 66 - u2 * 6 + Math.sin(s.t * 20 + u2 * 4) * 6; }
      else { x = -52 - Math.sin(u2 * 1.7) * 30 + u2 * u2 * 14; y = 70 + u2 * (78 + puff * 18) + Math.sin(s.t * 3 + u2 * 3) * 3; }
      if (bt) { x += Math.sin(bt * 25 + u2 * 5 + sd) * 35 * u2; y += Math.cos(bt * 21 + u2 * 4 + sd) * 35 * u2; }
      pts.push(new T.Vector3(x, y, 0));
    }
    var rad = 5.5 + puff * 5;
    if (c.tailMesh) { c.tailMesh.geometry.dispose(); g.remove(c.tailMesh); }
    c.tailMesh = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 24, rad, 10, false), this.mat(c.bodyHex));
    g.add(c.tailMesh);
    /* しっぽも毛羽立たせる（毎コマ作り直すので、その都度押し出す） */
    if (bristle > 0.01) ruffle(shaggy(c.tailMesh, function () { return 1; }, rad * 1.1), bristle, s.t);
    c.tailTip.position.copy(pts[6]); c.tailTip.scale.setScalar(rad);
    c.head.position.y = run ? 80 : 90 + arch * 4;
    c.head.scale.setScalar(s.head || 1);          /* 有利不利は顔の大きさで見せる */
    c.head.rotation.z = run ? -0.15 : s.open * 0.22;
    c.head.rotation.y = run ? 0 : (face > 0 ? -0.35 : 0.35);   /* 顔を少しこちらへ向ける */
    c.head.position.x = 66;
    if (bt) {
      /* 部品がばらけたように頭が跳ね回る */
      c.head.position.x = 66 + Math.sin(bt * 29 + sd) * 18;
      c.head.position.y += Math.cos(bt * 23 + sd) * 16;
      c.head.rotation.x = Math.sin(bt * 31 + sd) * 1.5;
      c.head.rotation.z = Math.cos(bt * 27 + sd) * 1.2;
    } else c.head.rotation.x = 0;
    var my = 1 + s.open * 7;
    c.mouth.scale.set(2, my, 7);
    c.mouth.position.y = 3 - my;                  /* 上のふち（y=3）は動かさない */
    c.tongue.visible = s.open > 0.2;
    c.tongue.position.y = 3 - my * 1.6;
    c.fangs.forEach(function (f) { f.visible = s.open > 0.3; f.position.y = 1; });
    c.ears.forEach(function (e) { e.rotation.z = s.open > 0.05 || puff > 0.6 ? 0.55 : 0.1; });
    c.eyes.forEach(function (e) { e.scale.y = 1 - s.open * 0.35; });
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
