/* 立体の場面（three.js）。机の上のゲーム機と、邪魔しにくるネコ。
   ゲームの進行（当たり・時間・ネコがいつ何をするか）は index.html に置き、ここは見た目と、
   ボタン・ネコが画面のどこに写っているか（タップの当たり）だけを受け持つ。模型はすべて基本図形から自作。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;

  /* ゲーム機の寸法（机の上に寝かせて置く。x 横、z 手前、y 上） */
  var BW = 9.2, BL = 14.6, BH = 1.4;           /* 本体 */
  var SW = 6.6, SL = 5.28, SZ = -3.1;           /* 画面（160:128）。中心の z */
  var BTN = { L: [-2.85, 3.3, 0.62], R: [-1.25, 3.3, 0.62], A: [2.55, 3.1, 0.72] };

  function GameScene(lcd) {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 1.05 }, camera: { fov: 38 }, finish: { vignette: 0.25, grain: 0.015 } });
    this.scene = st.scene;
    this.camera = st.camera;
    this.scene.background = new T.Color(0x3a2a20);
    Z3.lights(this.scene, { shadows: true, shadowSize: 12 });

    /* 机 */
    var wood = Z3.canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = "#9a6a43"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 60; i++) {
        g.strokeStyle = "rgba(60,30,10," + (0.05 + Math.random() * 0.1) + ")"; g.lineWidth = 1 + Math.random() * 2;
        var y = Math.random() * h; g.beginPath(); g.moveTo(0, y);
        g.bezierCurveTo(w * 0.3, y + Math.random() * 10 - 5, w * 0.7, y + Math.random() * 10 - 5, w, y); g.stroke();
      }
    }, 3);
    var desk = new T.Mesh(new T.PlaneGeometry(40, 40), Z3.std(0xffffff, { map: wood, roughness: 0.8 }));
    desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true;
    this.scene.add(desk);

    /* 本体：角の丸い板 */
    var shape = new T.Shape(), r = 1.0, x0 = -BW / 2, z0 = -BL / 2;
    shape.moveTo(x0 + r, z0); shape.lineTo(x0 + BW - r, z0); shape.quadraticCurveTo(x0 + BW, z0, x0 + BW, z0 + r);
    shape.lineTo(x0 + BW, z0 + BL - 2.2); shape.quadraticCurveTo(x0 + BW, z0 + BL, x0 + BW - 2.2, z0 + BL);
    shape.lineTo(x0 + r, z0 + BL); shape.quadraticCurveTo(x0, z0 + BL, x0, z0 + BL - r);
    shape.lineTo(x0, z0 + r); shape.quadraticCurveTo(x0, z0, x0 + r, z0);
    var body = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: BH, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 3, curveSegments: 10 }), Z3.std(0xf0c85a, { roughness: 0.55 }));
    body.rotation.x = Math.PI / 2; body.position.y = BH + 0.25;
    body.castShadow = true; body.receiveShadow = true;
    this.scene.add(body);
    var top = BH + 0.5;
    this.top = top;

    /* 画面の縁と画面 */
    var bez = new T.Mesh(new T.BoxGeometry(SW + 1.1, 0.12, SL + 1.3), Z3.std(0x2f3550, { roughness: 0.4 }));
    bez.position.set(0, top + 0.02, SZ + 0.1); this.scene.add(bez);
    this.tex = new T.CanvasTexture(lcd);
    this.tex.magFilter = T.NearestFilter; this.tex.minFilter = T.LinearFilter;
    this.tex.colorSpace = T.SRGBColorSpace;
    var scr = new T.Mesh(new T.PlaneGeometry(SW, SL), new T.MeshBasicMaterial({ map: this.tex }));
    scr.rotation.x = -Math.PI / 2; scr.position.set(0, top + 0.09, SZ);
    this.scene.add(scr);
    var lamp = new T.Mesh(new T.CircleGeometry(0.12, 12), new T.MeshBasicMaterial({ color: 0x6ee07a }));
    lamp.rotation.x = -Math.PI / 2; lamp.position.set(-SW / 2 - 0.3, top + 0.1, SZ - 0.8); this.scene.add(lamp);
    /* 下の小さな穴（スピーカー） */
    var holeM = Z3.std(0x8a6a20);
    for (var i = 0; i < 4; i++) for (var j = 0; j < 3; j++) {
      var h = new T.Mesh(new T.CircleGeometry(0.12, 10), holeM);
      h.rotation.x = -Math.PI / 2; h.position.set(2.2 + i * 0.42 - j * 0.0, top + 0.01, 5.4 + j * 0.42); this.scene.add(h);
    }

    /* ボタン */
    this.btn = {};
    var self = this;
    Object.keys(BTN).forEach(function (id) {
      var b = BTN[id], g = new T.Group();
      var m = new T.Mesh(new T.CylinderGeometry(b[2], b[2], 0.45, 28), Z3.std(id === "A" ? 0xe2574c : 0x3a3f52, { roughness: 0.35 }));
      m.castShadow = true; g.add(m);
      if (id !== "A") {
        var tri = new T.Shape(), d = id === "L" ? -1 : 1;
        tri.moveTo(d * 0.3, 0); tri.lineTo(-d * 0.18, -0.26); tri.lineTo(-d * 0.18, 0.26); tri.closePath();
        var tm = new T.Mesh(new T.ShapeGeometry(tri), new T.MeshBasicMaterial({ color: 0xf4f1e8 }));
        tm.rotation.x = -Math.PI / 2; tm.position.y = 0.23; g.add(tm);
      } else {
        var ac = Z3.canvasTex(64, 64, function (c, w, hh) { c.fillStyle = "#f4f1e8"; c.font = "bold 44px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("A", w / 2, hh / 2 + 2); });
        var am = new T.Mesh(new T.PlaneGeometry(0.8, 0.8), new T.MeshBasicMaterial({ map: ac, transparent: true }));
        am.rotation.x = -Math.PI / 2; am.position.y = 0.231; g.add(am);
      }
      g.position.set(b[0], top + 0.2, b[1]);
      self.scene.add(g);
      self.btn[id] = g;
    });

    this.cat = this.makeCat();
    this.paw = this.makePaw();

    this.camera.position.set(0, 21, 9.5);
    this.camera.lookAt(0, 0, 0.6);
    this.v = new T.Vector3();
  }

  /* ============ ネコ ============
     大きさは本物どおり（1 = 1cm。ゲーム機は横9cm・縦15cm、ネコは胴が40cmほど）。
     毛は「殻」を重ねて描く：同じ形を少しずつ大きくして何枚も重ね、外側ほど毛の点がまばらになる。
     スマホで重くならないよう、殻は6枚まで */
  var SHELLS = 6;
  function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
  /* 毛の色の絵。tabby は茶トラのしま（球の縦方向＝胴の前後にしまが並ぶ） */
  function coatTex(kind) {
    var r = rnd(kind === "tabby" ? 11 : 23), side = kind === "tabbyV";
    if (side) kind = "tabby";
    return Z3.canvasTex(256, 256, function (g, w, h) {
      if (side) { g.translate(w / 2, h / 2); g.rotate(Math.PI / 2); g.translate(-w / 2, -h / 2); }
      g.fillStyle = kind === "tabby" ? "#d8873e" : kind === "pink" ? "#e9a3a0" : "#f2e9de"; g.fillRect(0, 0, w, h);
      if (kind === "tabby") {
        for (var y = 0; y < h; y += 14 + r() * 10) {
          g.fillStyle = "rgba(140,62,18," + (0.45 + r() * 0.3) + ")";
          g.beginPath(); g.moveTo(0, y);
          for (var x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 3 + r() * 2);
          for (x = w; x >= 0; x -= 16) g.lineTo(x, y + 5 + r() * 4 + Math.sin(x * 0.04) * 2);
          g.fill();
        }
      }
      for (var i = 0; i < 2500; i++) {
        var l = r();
        g.fillStyle = kind === "tabby" ? (l < 0.5 ? "rgba(120,55,15,.15)" : "rgba(255,210,150,.15)") : (l < 0.5 ? "rgba(200,180,160,.15)" : "rgba(255,255,255,.2)");
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 3 + r() * 5);
      }
    });
  }
  var hairTex = null;
  function hair() {
    if (hairTex) return hairTex;
    var r = rnd(7);
    hairTex = Z3.canvasTex(128, 128, function (g, w, h) {
      var d = g.createImageData(w, h);
      for (var i = 0; i < w * h; i++) { var v = Math.floor(r() * 255); d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
      g.putImageData(d, 0, 0);
    });
    hairTex.colorSpace = T.NoColorSpace;
    hairTex.wrapS = hairTex.wrapT = T.RepeatWrapping; hairTex.repeat.set(18, 18);
    hairTex.magFilter = T.NearestFilter;
    return hairTex;
  }
  function coat(kind) {
    var map = coatTex(kind);
    if (kind === "tabbyV") map.repeat.set(3, 1);
    var base = new T.MeshStandardMaterial({ map: map, color: 0x9a8a80, roughness: 1 });
    var shells = [];
    for (var i = 0; i < SHELLS; i++) {
      var k = (i + 1) / SHELLS, c = 0.62 + 0.38 * k;
      shells.push(new T.MeshStandardMaterial({ map: map, alphaMap: hair(), alphaTest: 0.12 + 0.8 * k, color: new T.Color(c, c, c), roughness: 1 }));
    }
    return { base: base, shells: shells };
  }
  /* 毛を生やす。len は毛の長さ(cm) */
  function furry(mesh, co, len) {
    for (var i = 0; i < SHELLS; i++) {
      var h = len * (i + 1) / SHELLS, s = mesh.scale;
      var sh = new T.Mesh(mesh.geometry, co.shells[i]);
      sh.scale.set(1 + h / s.x, 1 + h / s.y, 1 + h / s.z);
      mesh.add(sh);
    }
    return mesh;
  }

  GameScene.prototype.makeCat = function () {
    var g = new T.Group(), tabby = coat("tabby"), white = coat("white"), pinkC = coat("pink");
    var ball = new T.SphereGeometry(1, 28, 18);
    var ballZ = new T.SphereGeometry(1, 28, 18); ballZ.rotateX(Math.PI / 2);   /* 前後に長い胴用：しまが胴を巻く */
    function m(geo, co, x, y, z, sx, sy, sz, parent, len) {
      var o = new T.Mesh(geo, co.base || co); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true;
      (parent || g).add(o);
      if (co.shells && len) furry(o, co, len);
      return o;
    }
    var c = { g: g };
    c.body = m(ballZ, tabby, 0, 13, -1, 9.5, 8, 20, null, 1.2);
    c.hips = [-1, 1].map(function (s) { return m(ball, tabby, s * 4.8, 11, -12, 5.5, 7, 8, null, 1.2); });
    c.chest = m(ballZ, white, 0, 14, 14, 6.5, 7.5, 7, null, 1.4);
    c.head = new T.Group(); c.head.position.set(0, 21, 21); g.add(c.head);
    m(ballZ, tabby, 0, 0, 0, 5.8, 5, 5.4, c.head, 0.9);
    m(ball, white, 0, -1.9, 3.6, 3.2, 2.1, 2.4, c.head, 0.6);
    m(ball, pinkC.base, 0, -0.5, 5.6, 0.7, 0.45, 0.4, c.head);
    var ear = new T.ConeGeometry(2.3, 4.6, 16);
    c.ears = [-1, 1].map(function (s) {
      var e = m(ear, tabby, s * 3.4, 4.4, -0.6, 1, 1, 0.55, c.head, 0.4); e.rotation.z = -s * 0.32;
      m(ear, pinkC.base, 0, -0.2, 0.5, 0.65, 0.75, 0.4, e);
      return e;
    });
    var amber = new T.MeshStandardMaterial({ color: 0xc9a23a, roughness: 0.15, metalness: 0 });
    var black = new T.MeshBasicMaterial({ color: 0x111111 });
    c.eyes = [-1, 1].map(function (s) {
      var e = m(ball, amber, s * 2.2, 1.0, 4.4, 1.15, 1.15, 0.8, c.head);
      m(ball, black, 0, 0, 0.55, 0.28, 0.85, 0.5, e);
      return e;
    });
    var legGeo = new T.CapsuleGeometry(1.9, 10, 6, 12);
    c.legs = [[-4.6, 15], [4.6, 15], [-4.8, -13], [4.8, -13]].map(function (p) {
      var pivot = new T.Group(); pivot.position.set(p[0], 12, p[1]); g.add(pivot);
      m(legGeo, p[1] > 0 ? white : tabby, 0, -6, 0, 1, 1, 1, pivot, 0.8);
      m(ball, white, 0, -11.2, 0.8, 2.3, 1.4, 2.9, pivot, 0.6);
      return pivot;
    });
    /* しっぽ：曲線に沿った管。形は毎コマ作り直す（毛の殻も同じ曲線で太さだけ変える） */
    var tailCo = coat("tabbyV");
    c.tail = [new T.Mesh(new T.BufferGeometry(), tailCo.base)].concat(tailCo.shells.map(function (mt) { return new T.Mesh(new T.BufferGeometry(), mt); }));
    c.tail[0].castShadow = true;
    c.tail.forEach(function (t) { g.add(t); });
    c.tailPts = [];
    for (var i = 0; i < 12; i++) c.tailPts.push(new T.Vector3());
    g.visible = false;
    this.scene.add(g);
    return c;
  };
  GameScene.prototype.makePaw = function () {
    var g = new T.Group(), tabby = coat("tabby"), white = coat("white"), pinkC = coat("pink");
    /* 腕：前後に長い球を横に寝かせる（しまが腕を巻く） */
    var armGeo = new T.SphereGeometry(1, 24, 16); armGeo.rotateZ(Math.PI / 2);
    var arm = new T.Mesh(armGeo, tabby.base);
    arm.scale.set(16, 2.1, 2.3); arm.position.set(15, 0.6, 0); arm.castShadow = true; g.add(arm);
    furry(arm, tabby, 1.0);
    var hand = new T.Mesh(new T.SphereGeometry(1, 24, 16), white.base); hand.scale.set(2.2, 1.4, 2.0); hand.castShadow = true; g.add(hand);
    furry(hand, white, 0.7);
    [[-1.4, -1.0], [-1.9, 0], [-1.4, 1.0], [-0.3, -1.5]].forEach(function (p) {
      var b = new T.Mesh(new T.SphereGeometry(0.38, 10, 8), pinkC.base); b.scale.y = 0.4; b.position.set(p[0], -1.1, p[1]); g.add(b);
    });
    g.visible = false;
    this.scene.add(g);
    return { g: g };
  };

  GameScene.prototype.reset = function () { this.cat.g.visible = false; this.paw.g.visible = false; };

  /* s: { t, pressed: {L,R,A}, cat: {x, y, z, rot, lie, walking, swish, flinch} または null, paw: {x, z, rot} または null } */
  GameScene.prototype.sync = function (s) {
    var self = this;
    this.tex.needsUpdate = true;
    Object.keys(this.btn).forEach(function (id) { self.btn[id].position.y = self.top + (s.pressed[id] ? 0.04 : 0.2); });
    var c = this.cat, k = s.cat;
    c.g.visible = !!k;
    if (k) {
      c.g.position.set(k.x, k.y, k.z);
      c.g.rotation.y = k.rot;
      var lie = k.lie || 0, fl = k.flinch || 0, sit = k.swish ? 1 : 0;
      /* 寝そべると低く平たく。座ると後ろが下がる */
      c.body.position.y = 13 - lie * 6 - sit * 3;
      c.body.scale.set(9.5 + lie * 2, 8 - lie * 1.5, 20);
      c.body.rotation.x = -sit * 0.35;
      c.hips.forEach(function (h) { h.position.y = 11 - lie * 5 - sit * 5; });
      c.chest.position.y = 14 - lie * 6 + sit * 3;
      c.head.position.y = 21 - lie * 11 + sit * 5 + fl * 2;
      c.head.position.z = 21 + lie * 2;
      c.head.rotation.y = Math.sin(s.t * 0.9) * 0.25 * (1 - lie) + fl * 0.4;
      c.head.rotation.z = lie * 0.4;
      c.legs.forEach(function (l, i) {
        var walk = k.walking ? Math.sin(s.t * 9 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.45 : 0;
        l.rotation.x = walk;
        l.position.y = 12 - lie * 8;
        l.scale.y = 1 - lie * 0.6;
      });
      c.eyes.forEach(function (e) { e.scale.y = lie > 0.8 ? 0.15 : 1.15; });
      c.tailPts.forEach(function (b, i) {
        var ang = Math.sin(s.t * (k.swish ? 1.6 : 1.1) - i * 0.25) * (k.swish ? 1.1 : 0.3) * (i / 11);
        b.set(Math.sin(ang * 1.5) * i * 2.3, k.swish ? self.top + 2 - k.y : 12 - lie * 8 - i * 0.6 * (1 - lie), -18 - Math.cos(ang) * i * 2.3);
      });
      var curve = new T.CatmullRomCurve3(c.tailPts);
      c.tail.forEach(function (t, i) {
        t.geometry.dispose();
        t.geometry = new T.TubeGeometry(curve, 28, 1.6 + i * 1.0 / SHELLS, 10, false);
      });
    }
    var p = s.paw;
    this.paw.g.visible = !!p;
    if (p) { this.paw.g.position.set(p.x, this.top + 2.2, p.z); this.paw.g.rotation.y = p.rot || 0; }
  };

  /* 画面の形に合わせて、本体がちょうど収まる距離にカメラを置く */
  GameScene.prototype.fit = function (W, H) {
    if (this.fitW === W && this.fitH === H) return;
    this.fitW = W; this.fitH = H;
    var cam = this.camera, v = cam.fov * Math.PI / 360, hz = Math.atan(Math.tan(v) * W / H);
    var d = Math.max((BW / 2 + 0.7) / Math.tan(hz), (BL / 2 + 1.6) / Math.tan(v)) + this.top;
    /* 真上から。画面の上が奥（-z） */
    cam.aspect = W / H; cam.updateProjectionMatrix();
    cam.up.set(0, 0, -1);
    cam.position.set(0, d, 0.3);
    cam.lookAt(0, 0, 0.3);
    cam.updateMatrixWorld();
  };
  /* 立体の点(x, y, z)が、ゲームの画面（横W×縦H）のどこに写るか */
  GameScene.prototype.screen = function (x, y, z, W, H) {
    this.fit(W, H);
    this.v.set(x, y, z).project(this.camera);
    return { x: (this.v.x + 1) / 2 * W, y: (1 - this.v.y) / 2 * H };
  };
  /* ボタンの写っている場所と大きさ */
  GameScene.prototype.buttonAt = function (id, W, H) {
    var b = BTN[id], c = this.screen(b[0], this.top, b[1], W, H), e = this.screen(b[0] + b[2], this.top, b[1], W, H);
    return { x: c.x, y: c.y, r: Math.abs(e.x - c.x) };
  };
  GameScene.prototype.draw = function (ctx, W, H) {
    this.fit(W, H);
    return this.stage.draw(ctx, W, H);
  };

  GameScene.SCREEN = { w: SW, l: SL, z: SZ };
  GameScene.TOP = BH + 0.5;
  GameScene.BODY = { w: BW, l: BL };
  GameScene.BTN = BTN;
  global.GameScene = GameScene;
})(window);
