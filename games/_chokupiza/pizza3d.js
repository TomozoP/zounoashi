/* 直ピザ配達の場面を立体で描き、主画面（2Dのcanvas）へ写す。
   動きの計算はゲーム側。ここは見た目だけ。座標はメートル（x 横、y 高さ、z 店から奥へ）。
   模型はすべて基本図形と自作の絵。three.js は random-bowling の既存配布物（MIT）を使う。 */
(function (global) {
  "use strict";
  var T;

  function rng(seed) {
    var s = seed % 2147483647; if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  function tex(w, h, fn) {
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    fn(c.getContext("2d"), w, h);
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  function std(color, extra) {
    var o = { color: color, roughness: 0.8 };
    for (var k in extra) o[k] = extra[k];
    return new T.MeshStandardMaterial(o);
  }

  function PizzaScene() {
    T = global.THREE;
    this.renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.setClearColor(0x9fd3f2, 1);
    this.scene = new T.Scene();
    this.scene.fog = new T.Fog(0xbfe0f2, 60, 170);
    this.camera = new T.PerspectiveCamera(50, 0.5, 0.1, 400);
    this.scene.add(new T.HemisphereLight(0xdff1ff, 0x6a5a48, 1.1));
    var sun = new T.DirectionalLight(0xfff1d8, 2.4);
    sun.position.set(-20, 40, -10);
    this.scene.add(sun);
    this.w = 0; this.h = 0;
    this.camPos = new T.Vector3(0, 1.65, -0.2);
    this.camLook = new T.Vector3(0, 1.4, 14);
    this.pieces = [];
    this.makeTown();
    this.makeChef();
    this.makePizza();
    this.makeCustomer();
  }

  /* 道と両側の建物 */
  PizzaScene.prototype.makeTown = function () {
    var s = this.scene;
    var ground = new T.Mesh(new T.PlaneGeometry(200, 400), std(0x8a8f86));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.01, 150); s.add(ground);
    var roadTex = tex(64, 256, function (g, w, h) {
      g.fillStyle = "#4b4f57"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#f2f2ea"; g.fillRect(w / 2 - 2, 0, 4, h * 0.5);
      g.fillStyle = "#e8e2c8"; g.fillRect(2, 0, 3, h); g.fillRect(w - 5, 0, 3, h);
    });
    roadTex.wrapT = T.RepeatWrapping; roadTex.repeat.set(1, 60);
    var road = new T.Mesh(new T.PlaneGeometry(9, 400), std(0xffffff, { map: roadTex }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, 150); s.add(road);
    var walk = std(0xc9c0ae);
    [-1, 1].forEach(function (sd) {
      var w = new T.Mesh(new T.BoxGeometry(3, 0.15, 400), walk);
      w.position.set(sd * 6, 0.07, 150); s.add(w);
    });
    /* 建物：窓の絵を貼った箱 */
    var r = rng(11);
    var colors = ["#e9d6b8", "#d98f6b", "#b9c7cf", "#f0e6d2", "#c7a27a", "#9fb59a", "#e7b9a6"];
    var winTexs = colors.map(function (c) {
      return tex(128, 256, function (g, w, h) {
        g.fillStyle = c; g.fillRect(0, 0, w, h);
        for (var y = 0; y < 4; y++) for (var x = 0; x < 2; x++) {
          g.fillStyle = "#2e4157"; g.fillRect(16 + x * 60, 20 + y * 60, 36, 40);
          g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(18 + x * 60, 22 + y * 60, 12, 36);
        }
      });
    });
    this.buildings = [];
    for (var sd = -1; sd <= 1; sd += 2) {
      var z = -6;
      while (z < 230) {
        var d = 7 + r() * 6, hgt = 7 + r() * 10, ci = Math.floor(r() * colors.length);
        var t = winTexs[ci].clone(); t.needsUpdate = true;
        t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(Math.round(d / 4), Math.round(hgt / 7));
        var m = new T.Mesh(new T.BoxGeometry(8, hgt, d - 0.4), std(0xffffff, { map: t }));
        m.position.set(sd * (7.5 + 4), hgt / 2, z + d / 2); s.add(m);
        z += d;
      }
    }
  };

  /* 後ろ姿のピザ職人：白い服とコック帽、片手を上げる */
  PizzaScene.prototype.makeChef = function () {
    var g = new T.Group(), white = std(0xf6f4ee), skin = std(0xe9b48f);
    var body = new T.Mesh(new T.CylinderGeometry(0.3, 0.36, 0.9, 16), white); body.position.y = 1.05; g.add(body);
    var legs = new T.Mesh(new T.CylinderGeometry(0.3, 0.26, 0.6, 16), std(0x2c2c34)); legs.position.y = 0.3; g.add(legs);
    var head = new T.Mesh(new T.SphereGeometry(0.2, 16, 12), skin); head.position.y = 1.72; g.add(head);
    var hair = new T.Mesh(new T.SphereGeometry(0.205, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), std(0x3a2a20));
    hair.position.y = 1.73; hair.rotation.x = 0.3; g.add(hair);
    var hat = new T.Mesh(new T.CylinderGeometry(0.2, 0.17, 0.26, 16), white); hat.position.y = 1.98; g.add(hat);
    var puff = new T.Mesh(new T.SphereGeometry(0.25, 16, 12), white); puff.position.y = 2.15; puff.scale.y = 0.7; g.add(puff);
    var arm = this.arm = new T.Group();
    var a1 = new T.Mesh(new T.CylinderGeometry(0.07, 0.08, 0.7, 10), white); a1.position.y = 0.35; arm.add(a1);
    var hand = new T.Mesh(new T.SphereGeometry(0.08, 10, 8), skin); hand.position.y = 0.72; arm.add(hand);
    arm.position.set(0.32, 1.42, 0.05); arm.rotation.z = -0.15; g.add(arm);
    var arm2 = new T.Mesh(new T.CylinderGeometry(0.07, 0.08, 0.6, 10), white);
    arm2.position.set(-0.36, 1.15, 0); arm2.rotation.z = -0.25; g.add(arm2);
    g.position.x = -0.6; this.chef = g;   /* 自分の目線なので場面には置かない */
  };

  /* ピザ：生地の縁と、具の絵を貼った円盤 */
  PizzaScene.prototype.makePizza = function () {
    var top = tex(256, 256, function (g, w, h) {
      var c = w / 2;
      g.fillStyle = "#d9a65a"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#e8c07a"; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#c8381f"; g.beginPath(); g.arc(c, c, c * 0.84, 0, Math.PI * 2); g.fill();
      var r = rng(5);
      for (var i = 0; i < 26; i++) {
        var a = r() * Math.PI * 2, d = Math.sqrt(r()) * c * 0.72;
        g.fillStyle = "rgba(255,226,120,.9)";
        g.beginPath(); g.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, 14 + r() * 12, 9 + r() * 8, r() * 3, 0, Math.PI * 2); g.fill();
      }
      for (i = 0; i < 9; i++) {
        a = i / 9 * Math.PI * 2 + r(); d = (i % 3 === 0 ? 0.25 : 0.58) * c;
        g.fillStyle = "#9e2318"; g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 15, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#b8352a"; g.beginPath(); g.arc(c + Math.cos(a) * d - 3, c + Math.sin(a) * d - 3, 9, 0, Math.PI * 2); g.fill();
      }
      for (i = 0; i < 6; i++) {
        a = r() * Math.PI * 2; d = r() * c * 0.6;
        g.fillStyle = "#3f8a2e"; g.beginPath(); g.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, 10, 5, a, 0, Math.PI * 2); g.fill();
      }
    });
    var crust = std(0xd9a65a, { roughness: 0.9 });
    this.pizzaMats = [crust, std(0xffffff, { map: top, roughness: 0.7 }), crust];
    this.pizzaGeo = new T.CylinderGeometry(1, 1, 0.05, 40);
    this.pizza = new T.Group();
    this.disk = new T.Mesh(this.pizzaGeo, this.pizzaMats);
    this.pizza.add(this.disk);
    this.scene.add(this.pizza);
    /* 破れたときのかけら */
    this.pieceGeo = new T.CylinderGeometry(1, 1, 0.05, 5, 1, false, 0, Math.PI / 3);
    /* 地面に落ちたピザの跡 */
    this.splat = new T.Mesh(new T.CircleGeometry(1, 24), std(0xc8381f, { roughness: 1 }));
    this.splat.rotation.x = -Math.PI / 2; this.splat.visible = false;
    this.scene.add(this.splat);
  };

  /* お客：両手を上げて待つ人。目印に頭の上で下向きの矢印が跳ねる */
  PizzaScene.prototype.makeCustomer = function () {
    var g = new T.Group();
    this.shirt = std(0x3b7bd6);
    var body = new T.Mesh(new T.CylinderGeometry(0.28, 0.32, 0.8, 14), this.shirt); body.position.y = 1.0; g.add(body);
    var legs = new T.Mesh(new T.CylinderGeometry(0.28, 0.22, 0.62, 14), std(0x35394a)); legs.position.y = 0.31; g.add(legs);
    var head = new T.Mesh(new T.SphereGeometry(0.2, 16, 12), std(0xe9b48f)); head.position.y = 1.62; g.add(head);
    this.hair = std(0x2a1d16);
    var hair = new T.Mesh(new T.SphereGeometry(0.21, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), this.hair);
    hair.position.y = 1.64; g.add(hair);
    /* 顔は店のほう（-z）を向く */
    var eye = std(0x1a1a1a);
    for (var e = -1; e <= 1; e += 2) {
      var ey = new T.Mesh(new T.SphereGeometry(0.03, 8, 6), eye); ey.position.set(e * 0.07, 1.65, -0.18); g.add(ey);
    }
    var mouth = new T.Mesh(new T.TorusGeometry(0.06, 0.015, 6, 12, Math.PI), eye);
    mouth.position.set(0, 1.56, -0.185); mouth.rotation.z = Math.PI; g.add(mouth);
    this.cArms = [];
    for (var i = -1; i <= 1; i += 2) {
      var a = new T.Group();
      var m = new T.Mesh(new T.CylinderGeometry(0.06, 0.07, 0.7, 10), this.shirt); m.position.y = 0.35; a.add(m);
      var h = new T.Mesh(new T.SphereGeometry(0.075, 10, 8), std(0xe9b48f)); h.position.y = 0.72; a.add(h);
      a.position.set(i * 0.3, 1.3, 0); a.rotation.z = -i * 0.5;
      g.add(a); this.cArms.push(a);
    }
    var ring = this.ring = new T.Mesh(new T.ConeGeometry(0.35, 0.7, 4), new T.MeshBasicMaterial({ color: 0xffd23a, fog: false }));
    ring.rotation.x = Math.PI; ring.position.y = 2.9; g.add(ring);
    this.customer = g; this.scene.add(g);
    /* ベランダ（2階のお客用） */
    var bal = this.balcony = new T.Group();
    var floor = new T.Mesh(new T.BoxGeometry(1.8, 0.15, 2.4), std(0xd8d2c6)); bal.add(floor);
    var rail = new T.Mesh(new T.BoxGeometry(0.06, 0.9, 2.4), std(0x5c6670)); rail.position.set(0, 0.5, 0); bal.add(rail);
    this.scene.add(bal);
  };

  PizzaScene.prototype.setCustomer = function (c) {
    var r = rng(c.seed * 31 + 7);
    this.shirt.color.setHSL(r(), 0.55 + r() * 0.3, 0.45 + r() * 0.15);
    this.hair.color.setHSL(0.07, 0.4, 0.08 + r() * 0.25);
    this.customer.position.set(c.x, c.y, c.z);
    this.customer.rotation.y = 0;
    this.balcony.visible = c.y > 0.5;
    if (c.y > 0.5) {
      var sd = c.x > 0 ? 1 : -1;
      this.balcony.position.set(c.x - sd * 0.1, c.y - 0.08, c.z);
      this.balcony.children[1].position.x = -sd * 0.85;
    }
  };

  PizzaScene.prototype.render = function (ctx, W, H, st, dt) {
    var dpr = Math.min(1.5, global.devicePixelRatio || 1);
    var w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (!(w >= 2 && h >= 2)) return false;
    if (w !== this.w || h !== this.h) {
      this.renderer.setSize(w, h, false);
      this.w = w; this.h = h;
      this.camera.aspect = W / H; this.camera.updateProjectionMatrix();
    }
    var c = st.customer;
    if (c && c !== this.lastC) { this.setCustomer(c); this.lastC = c; }
    this.ring.rotation.y += dt * 2; this.ring.position.y = 2.9 + Math.abs(Math.sin(st.T * 4)) * 0.3;
    this.ring.visible = st.phase !== "after" || !st.caught;
    /* お客の腕：待つ間は手を振る、取ったら頭の上 */
    var t = st.T;
    this.cArms.forEach(function (a, i) {
      var sd = i ? 1 : -1;
      a.rotation.z = st.caught ? -sd * 0.15 : -sd * (0.45 + 0.25 * Math.sin(t * 6 + i * 2));
    });
    this.customer.position.y = c ? c.y + (st.caught ? Math.abs(Math.sin(st.afterT * 9)) * 0.35 : 0) : 0;
    /* ピザ */
    var p = st.pizza;
    this.pizza.visible = !!p && !p.torn && !p.splat;
    if (p) {
      this.pizza.position.set(p.x, p.y, p.z);
      this.pizza.scale.set(p.r, 1, p.r);
      this.disk.rotation.y = p.rot;
      this.pizza.rotation.set(p.tiltX, 0, p.tiltZ);
      this.splat.visible = !!p.splat;
      if (p.splat) { this.splat.position.set(p.x, 0.02, p.z); this.splat.scale.set(p.r * 1.3, p.r * 1.0, 1); }
    }
    /* 破れたかけら */
    var self = this;
    while (this.pieces.length > st.pieces.length) this.scene.remove(this.pieces.pop());
    while (this.pieces.length < st.pieces.length) {
      var m = new T.Mesh(this.pieceGeo, this.pizzaMats);
      this.scene.add(m); this.pieces.push(m);
    }
    st.pieces.forEach(function (q, i) {
      var m = self.pieces[i];
      m.position.set(q.x, q.y, q.z); m.scale.set(q.r, 1, q.r);
      m.rotation.set(q.rx, q.ry, q.rz);
    });
    /* カメラ */
    var k = 1 - Math.exp(-dt * (st.phase === "fly" ? 5 : 3));
    var tp, tl;
    if (st.phase === "fly" || st.phase === "after") {
      var px = p ? p.x : 0, py = p ? p.y : 2, pz = p ? p.z : 0;
      if (st.caught && c) { px = c.x; py = c.y + 1.6; pz = c.z; }
      tp = new T.Vector3(px * 0.7, Math.max(1.6, py + 1.3), pz - 5);
      tl = new T.Vector3(px, py, pz + 6);
      if (c) tl.lerp(new T.Vector3(c.x, c.y + 1.4, c.z), 0.35);
    } else {
      tp = new T.Vector3(0, 1.65, -0.2);
      tl = new T.Vector3(c ? c.x * 0.3 : 0, 1.05, c ? Math.min(c.z, 30) : 14);
    }
    if (st.snap) { this.camPos.copy(tp); this.camLook.copy(tl); }
    else { this.camPos.lerp(tp, k); this.camLook.lerp(tl, k); }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
    return true;
  };

  global.PizzaScene = PizzaScene;
})(window);
