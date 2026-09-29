/* シュレッダー復元の机。
   夜の事務所の机を上から少し斜めに見下ろす。紙片は本体が2Dで上に重ねるので、
   ここは机と小物だけ。小物は画面の余白（上の帯・下の帯）に来るよう、
   画面上の位置から机の面へ投影して置く。絵が変わるときだけ描き直す。 */
var ZShredScene = (function () {
  'use strict';

  var T;

  function mat(color, rough, metal) {
    return new T.MeshStandardMaterial({ color: color, roughness: rough == null ? .7 : rough, metalness: metal || 0 });
  }
  function canvasTex(w, h, paint) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    paint(c.getContext("2d"), w, h);
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  /* 木目の天板 */
  function woodTex() {
    return canvasTex(1024, 1024, function (g, w, h) {
      g.fillStyle = "#6b4a33"; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 260; i++) {
        var y = Math.random() * h, a = Math.random() * .12;
        g.strokeStyle = (Math.random() < .5 ? "rgba(40,22,10," : "rgba(150,105,70,") + a + ")";
        g.lineWidth = 1 + Math.random() * 4;
        g.beginPath(); g.moveTo(0, y);
        for (var x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * .01 + i) * 6 + (Math.random() - .5) * 3);
        g.stroke();
      }
      /* 板の継ぎ目 */
      g.fillStyle = "rgba(30,16,8,.5)";
      for (var k = 1; k < 4; k++) g.fillRect(0, k * h / 4, w, 2);
    });
  }
  /* 窓の外の街並み。空の部分は透明 */
  function cityTex() {
    return canvasTex(2048, 512, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      for (var layer = 0; layer < 2; layer++) {
        for (var b = 0; b < 70; b++) {
          var bx = Math.random() * w, bw = 20 + Math.random() * 70, bh = (layer ? 60 : 120) + Math.random() * (layer ? 160 : 260);
          g.fillStyle = layer ? "#0b1020" : "#070a14"; g.fillRect(bx, h - bh, bw, bh);
          for (var wy = h - bh + 8; wy < h - 6; wy += 10)
            for (var wx = bx + 4; wx < bx + bw - 5; wx += 8)
              if (Math.random() < (layer ? .35 : .22)) { g.fillStyle = Math.random() < .8 ? "rgba(255,210,140,.85)" : "rgba(170,215,255,.85)"; g.fillRect(wx, wy, 3, 5); }
        }
      }
    });
  }
  /* 星 */
  function stars() {
    var n = 1600, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var az = (Math.random() - .5) * Math.PI * 1.2, el = Math.random() * 1.1 + .02, r = 300;
      pos[i * 3] = Math.sin(az) * Math.cos(el) * r;
      pos[i * 3 + 1] = Math.sin(el) * r;
      pos[i * 3 + 2] = -Math.cos(az) * Math.cos(el) * r;
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    return new T.Points(geo, new T.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: .9 }));
  }
  function glowTex(inner, outer) {
    return canvasTex(128, 128, function (g, w, h) {
      var r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, inner); r.addColorStop(.35, outer); r.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    });
  }
  function sprite(tex, add) {
    var m = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending });
    return new T.Sprite(m);
  }

  function Scene() {
    T = window.THREE;
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x0c0e14);
    this.camera = new T.PerspectiveCamera(38, 540 / 960, .1, 500);
    this.ending = null;
    this.dirty = true;
    this.glow = 0;
    this.build();
  }

  Scene.prototype.build = function () {
    var s = this.scene;

    /* 天板と奥の壁・窓 */
    var desk = new T.Mesh(new T.BoxGeometry(16, .4, 16), new T.MeshStandardMaterial({ map: woodTex(), roughness: .55 }));
    desk.position.y = -.2; desk.receiveShadow = true; s.add(desk);
    /* 壁は窓の穴をあけて4枚で組む。窓の外は街と星空 */
    var wm = mat(0x3b3f4a, .95);
    [[-10.5, 5, 9, 14], [10.5, 5, 9, 14], [0, -1.9, 12, 4.2], [0, 10.1, 12, 5.8]].forEach(function (p) {
      var m = new T.Mesh(new T.PlaneGeometry(p[2], p[3]), wm);
      m.position.set(p[0], p[1], -8.5); s.add(m);
    });
    var fm = mat(0x15171c, .6, .4);
    [[0, 1.2, 12.3, .25], [0, 7.2, 12.3, .25], [-6, 4.2, .25, 6.2], [6, 4.2, .25, 6.2], [-3, 4.2, .08, 6], [3, 4.2, .08, 6]].forEach(function (p) {
      var m = new T.Mesh(new T.BoxGeometry(p[2], p[3], .2), fm);
      m.position.set(p[0], p[1], -8.45); s.add(m);
    });
    var city = new T.Mesh(new T.PlaneGeometry(140, 35), new T.MeshBasicMaterial({ map: cityTex(), transparent: true }));
    city.position.set(0, 3.5, -45); s.add(city);
    s.add(stars());
    this.buildWeapon();
    this.buildBoom();

    /* 光：暖かい電気スタンドと、窓からの青い明かり */
    s.add(this.hemi = new T.HemisphereLight(0x9fb4d8, 0x2a1d14, .9));
    var moon = new T.DirectionalLight(0x9db8ff, .8);
    moon.position.set(-3, 8, -6); s.add(moon);
    var front = new T.DirectionalLight(0xffe6c8, 1.1);
    front.position.set(1, 7, 10); s.add(front);
    var lamp = this.lampLight = new T.SpotLight(0xffd9a0, 90, 30, .75, .55, 1.6);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    lamp.shadow.bias = -.0005;
    s.add(lamp); s.add(lamp.target);

    this.items = {};

    /* シュレッダー本体。口から細い紙が出ている */
    var sh = new T.Group();
    var body = new T.Mesh(new T.BoxGeometry(2.2, 1.5, 1.3), mat(0x8d9199, .4, .35));
    body.position.y = .75; body.castShadow = true; sh.add(body);
    var lid = new T.Mesh(new T.BoxGeometry(2.3, .14, 1.4), mat(0x3a3d44, .45, .3));
    lid.position.y = 1.55; lid.castShadow = true; sh.add(lid);
    var slot = new T.Mesh(new T.BoxGeometry(1.7, .02, .08), mat(0x050505, 1));
    slot.position.set(0, 1.63, 0); sh.add(slot);
    var led = new T.Mesh(new T.SphereGeometry(.04, 10, 8), new T.MeshBasicMaterial({ color: 0x4dff88 }));
    led.position.set(.85, 1.63, .5); sh.add(led);
    var paperM = mat(0xf2f0e8, .9);
    for (var i = 0; i < 16; i++) {
      var st = new T.Mesh(new T.BoxGeometry(.075, .5 + Math.random() * .3, .006), paperM);
      st.position.set(-.8 + i * .105, 1.85, (Math.random() - .5) * .02);
      st.rotation.x = (Math.random() - .5) * .3; st.rotation.z = (Math.random() - .5) * .15;
      st.castShadow = true; sh.add(st);
    }
    s.add(sh); this.items.shredder = sh;

    /* 電気スタンド */
    var lp = new T.Group();
    var base = new T.Mesh(new T.CylinderGeometry(.45, .5, .12, 28), mat(0x1b1d22, .35, .6));
    base.position.y = .06; base.castShadow = true; lp.add(base);
    var arm = new T.Mesh(new T.CylinderGeometry(.04, .04, 2.4, 10), mat(0x2b2e34, .3, .7));
    arm.position.set(0, 1.2, 0); arm.rotation.z = .35; arm.castShadow = true; lp.add(arm);
    var shade = new T.Mesh(new T.ConeGeometry(.45, .6, 24, 1, true), mat(0x0f4d3a, .4, .3));
    shade.material.side = T.DoubleSide;
    shade.position.set(-.45, 2.35, 0); shade.rotation.z = -.9; shade.castShadow = true; lp.add(shade);
    var bulb = new T.Mesh(new T.SphereGeometry(.14, 14, 10), new T.MeshBasicMaterial({ color: 0xfff1cf }));
    bulb.position.set(-.62, 2.2, 0); lp.add(bulb);
    s.add(lp); this.items.lamp = lp;

    /* マグカップ */
    var mug = new T.Group();
    var cup = new T.Mesh(new T.CylinderGeometry(.42, .38, .9, 32, 1, true), mat(0xe9e4da, .35));
    cup.material.side = T.DoubleSide;
    cup.position.y = .45; cup.castShadow = true; mug.add(cup);
    var bottom = new T.Mesh(new T.CircleGeometry(.38, 32), mat(0xe9e4da, .35));
    bottom.rotation.x = -Math.PI / 2; bottom.position.y = .01; mug.add(bottom);
    var coffee = new T.Mesh(new T.CircleGeometry(.4, 32), mat(0x5a3218, .2));
    coffee.rotation.x = -Math.PI / 2; coffee.position.y = .72; mug.add(coffee);
    var handle = new T.Mesh(new T.TorusGeometry(.22, .06, 10, 20, Math.PI), mat(0xe9e4da, .35));
    handle.position.set(.42, .45, 0); handle.rotation.z = -Math.PI / 2; handle.castShadow = true; mug.add(handle);
    s.add(mug); this.items.mug = mug;

    /* セロハンテープ台 */
    var tp = new T.Group();
    var tb = new T.Mesh(new T.BoxGeometry(1.2, .35, .55), mat(0x9a1f2a, .4));
    tb.position.y = .18; tb.castShadow = true; tp.add(tb);
    var roll = new T.Mesh(new T.TorusGeometry(.3, .09, 12, 28), mat(0xd9c98f, .3));
    roll.position.set(-.1, .5, 0); roll.castShadow = true; tp.add(roll);
    var cutter = new T.Mesh(new T.BoxGeometry(.08, .18, .5), mat(0x777a80, .3, .8));
    cutter.position.set(.55, .42, 0); tp.add(cutter);
    s.add(tp); this.items.tape = tp;

    /* ペン */
    var pen = new T.Group();
    var barrel = new T.Mesh(new T.CylinderGeometry(.05, .05, 1.5, 12), mat(0x14244d, .35, .3));
    barrel.rotation.z = Math.PI / 2; barrel.position.y = .05; barrel.castShadow = true; pen.add(barrel);
    var tip = new T.Mesh(new T.ConeGeometry(.05, .16, 12), mat(0xb8b8b8, .3, .9));
    tip.rotation.z = -Math.PI / 2; tip.position.set(.83, .05, 0); pen.add(tip);
    s.add(pen); this.items.pen = pen;

    /* 床に散った紙くず */
    var bits = new T.Group();
    for (var k = 0; k < 40; k++) {
      var b = new T.Mesh(new T.BoxGeometry(.07, .005, .5 + Math.random() * .8), paperM);
      b.position.set((Math.random() - .5) * 2.4, .01 + k * .002, (Math.random() - .5) * 1);
      b.rotation.y = (Math.random() - .5) * 2.4;
      b.castShadow = true; b.receiveShadow = true; bits.add(b);
    }
    s.add(bits); this.items.bits = bits;
  };

  /* 兵器 Project Z。軌道から落ちてくる機械の象の足 */
  Scene.prototype.buildWeapon = function () {
    var g = this.weapon = new T.Group();
    var metal = mat(0xaab1bc, .35, .6), dark = mat(0x5a606b, .4, .5);
    metal.emissive = new T.Color(0x1c2230); dark.emissive = new T.Color(0x10141c);
    var key = new T.DirectionalLight(0xbcd0ff, 1.6);
    key.position.set(-20, 60, 40); key.target = g; this.scene.add(key);
    var body = new T.Mesh(new T.CylinderGeometry(3, 3.8, 9, 32), metal);
    g.add(body);
    for (var i = 0; i < 6; i++) {
      var ring = new T.Mesh(new T.TorusGeometry(3.1 + i * .12, .08, 8, 40), dark);
      ring.rotation.x = Math.PI / 2; ring.position.y = 3.2 - i * 1.3; g.add(ring);
    }
    var nail = mat(0xe8e2d0, .3, .1);
    for (i = 0; i < 5; i++) {
      var a = -.9 + i * .45;
      var n = new T.Mesh(new T.SphereGeometry(.85, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), nail);
      n.position.set(Math.sin(a) * 3.6, -4.5, Math.cos(a) * 3.6); n.rotation.x = Math.PI; n.scale.y = 1.3; g.add(n);
    }
    var top = new T.Mesh(new T.BoxGeometry(6.5, 1.6, 5), dark);
    top.position.y = 5.3; g.add(top);
    this.flames = [];
    var flameTex = glowTex("rgba(255,255,230,1)", "rgba(255,140,40,.8)");
    for (i = 0; i < 4; i++) {
      var x = -2.3 + i * 1.53;
      var cone = new T.Mesh(new T.CylinderGeometry(.35, .7, 1.2, 16, 1, true), dark);
      cone.material.side = T.DoubleSide;
      cone.position.set(x, 6.7, 0); g.add(cone);
      var f = sprite(flameTex, true);
      f.position.set(x, 8.2, 0); f.scale.set(1.6, 3.2, 1); g.add(f); this.flames.push(f);
    }
    /* 落下の熱で光る足の裏 */
    var heat = this.heat = sprite(glowTex("rgba(255,230,200,.9)", "rgba(255,90,30,.6)"), true);
    heat.position.y = -5.5; heat.scale.set(12, 5, 1); g.add(heat);
    g.visible = false;
    g.rotation.set(.15, .5, -.12);
    this.scene.add(g);
    this.weaponLight = new T.PointLight(0xff9a50, 0, 400, 1);
    this.scene.add(this.weaponLight);
  };
  /* 爆発：光・火の玉・衝撃波の輪・破片・煙 */
  Scene.prototype.buildBoom = function () {
    var b = this.boom = { group: new T.Group(), balls: [], bits: [], smoke: [] };
    b.flash = sprite(glowTex("rgba(255,255,255,1)", "rgba(255,210,150,.8)"), true);
    b.group.add(b.flash);
    var fire = glowTex("rgba(255,250,210,1)", "rgba(255,120,30,.85)");
    for (var i = 0; i < 9; i++) {
      var s = sprite(fire, true);
      s.userData = { off: new T.Vector3((Math.random() - .5) * 9, (Math.random() - .5) * 9, (Math.random() - .5) * 4), r: 8 + Math.random() * 10, delay: Math.random() * .35 };
      b.group.add(s); b.balls.push(s);
    }
    var ring = b.ring = new T.Mesh(new T.RingGeometry(.9, 1, 64), new T.MeshBasicMaterial({ color: 0xffa860, transparent: true, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = Math.PI / 2 - .25; b.group.add(ring);
    var metal = mat(0x8a9099, .4, .7), hot = new T.MeshBasicMaterial({ color: 0xff8a3a }), nail = mat(0xe8e2d0, .3);
    for (i = 0; i < 70; i++) {
      var m = new T.Mesh(i < 5 ? new T.SphereGeometry(.7, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2) : new T.BoxGeometry(.3 + Math.random() * .9, .2 + Math.random() * .6, .3 + Math.random() * .7), i < 5 ? nail : (i % 4 ? metal : hot));
      var d = new T.Vector3(Math.random() - .5, Math.random() - .3, Math.random() - .5).normalize();
      m.userData = { v: d.multiplyScalar(14 + Math.random() * 22), spin: new T.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6) };
      b.group.add(m); b.bits.push(m);
    }
    var smokeTex = glowTex("rgba(120,110,105,.8)", "rgba(60,55,55,.45)");
    for (i = 0; i < 10; i++) {
      var sm = sprite(smokeTex, false);
      sm.userData = { off: new T.Vector3((Math.random() - .5) * 12, (Math.random() - .3) * 10, (Math.random() - .5) * 4) };
      b.group.add(sm); b.smoke.push(sm);
    }
    b.group.visible = false;
    this.scene.add(b.group);
  };

  /* 最後の演出。t はカメラが動き始めてからの秒数（null で元に戻す） */
  var CAM_DUR = 1.8, BOOM_T = 3.0, SKY_POS = [0, 30, -110];
  Scene.prototype.pose = function (t) {
    var cam = this.camera, w = this.weapon, b = this.boom;
    if (t == null) {
      cam.position.copy(this.base.pos); cam.lookAt(this.base.at);
      w.visible = false; b.group.visible = false; this.weaponLight.intensity = 0;
      this.hemi.intensity = .9;
      return;
    }
    var k = Math.min(1, t / CAM_DUR); k = k * k * (3 - 2 * k);
    var endPos = new T.Vector3(0, 4.2, -3), endAt = new T.Vector3(0, 10, -60);
    cam.position.lerpVectors(this.base.pos, endPos, k);
    cam.position.y += Math.sin(k * Math.PI) * 2.5;
    cam.lookAt(new T.Vector3().lerpVectors(this.base.at, endAt, k));

    var boomT = t - BOOM_T;
    w.visible = boomT < 0;
    w.position.set(SKY_POS[0] - 6 + t * 1.2, SKY_POS[1] + 6 - t * 2.4, SKY_POS[2]);
    w.rotation.z = -.12 + t * .03;
    this.flames.forEach(function (f, i) { var s = 1 + Math.sin(t * 40 + i * 2) * .25; f.scale.set(1.6 * s, 3.2 * s, 1); });
    this.heat.material.opacity = .6 + Math.sin(t * 23) * .2;
    this.weaponLight.position.copy(w.position);
    this.weaponLight.intensity = boomT < 0 ? 0 : 60000 * Math.max(0, 1 - boomT / 1.6);

    b.group.visible = boomT >= 0;
    this.hemi.intensity = .9 + (boomT >= 0 ? Math.max(0, 1.6 - boomT) * 1.2 : 0);
    if (boomT < 0) return;
    b.group.position.copy(w.position);
    var fl = Math.min(1, boomT / .12);
    b.flash.scale.setScalar(10 + fl * 70);
    b.flash.material.opacity = Math.max(0, 1 - boomT / .9);
    b.balls.forEach(function (s) {
      var u = s.userData, bt = Math.max(0, boomT - u.delay);
      var g = 1 - Math.exp(-bt * 3.5);
      s.position.copy(u.off).multiplyScalar(g * 1.4);
      s.position.y += bt * 1.5;
      s.scale.setScalar(u.r * g + .01);
      s.material.opacity = Math.max(0, 1 - bt / 2.4);
      s.material.color.setRGB(1, Math.max(.35, 1 - bt * .4), Math.max(.2, 1 - bt * .7));
    });
    b.ring.scale.setScalar(boomT * 45 + .01);
    b.ring.material.opacity = .55 * Math.max(0, 1 - boomT / 1.4);
    b.bits.forEach(function (m) {
      var u = m.userData;
      m.position.copy(u.v).multiplyScalar(boomT);
      m.position.y -= 4 * boomT * boomT;
      m.rotation.set(u.spin.x * boomT, u.spin.y * boomT, u.spin.z * boomT);
    });
    b.smoke.forEach(function (sm, i) {
      var u = sm.userData, st = Math.max(0, boomT - .3);
      sm.position.copy(u.off).multiplyScalar(.6 + st * .35);
      sm.position.y += st * 1.2;
      sm.scale.setScalar(6 + st * 7);
      sm.material.opacity = Math.min(.55, st * 1.5) * Math.max(0, 1 - st / 5);
    });
  };

  /* 画面上の点(ゲーム座標)から、机の面(y=0)の位置へ */
  Scene.prototype.onDesk = function (sx, sy, W, H) {
    var v = new T.Vector3(sx / W * 2 - 1, -(sy / H * 2 - 1), .5).unproject(this.camera);
    var o = this.camera.position, d = v.sub(o).normalize();
    var t = -o.y / d.y;
    return new T.Vector3(o.x + d.x * t, 0, o.z + d.z * t);
  };

  /* doc: 書類の置き場 { x, y, w, h }（ゲーム座標） */
  Scene.prototype.resize = function (w, h, W, H, doc) {
    this.renderer.setSize(w, h, false);
    var cam = this.camera;
    cam.aspect = W / H;
    cam.position.set(0, 10.5, 8.5);
    cam.lookAt(0, 0, -1.2);
    this.base = { pos: cam.position.clone(), at: new T.Vector3(0, 0, -1.2) };
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    var it = this.items, self = this;
    function put(obj, sx, sy, ry) { obj.position.copy(self.onDesk(sx, sy, W, H)); obj.rotation.y = ry || 0; }
    var top = doc.y, bot = doc.y + doc.h;
    put(it.shredder, W * 0.26, top + 40, .1);
    put(it.lamp, W * 0.84, top + 30, -.5);
    put(it.mug, W * 0.13, bot + (H - bot) * 0.55, 0);
    put(it.tape, W * 0.84, bot + (H - bot) * 0.5, -.35);
    put(it.pen, W * 0.52, bot + (H - bot) * 0.62, .25);
    put(it.bits, W * 0.5, bot + (H - bot) * 0.3, 0);

    /* スタンドの光は書類の真ん中へ */
    var lp = it.lamp.position, mid = this.onDesk(W / 2, (top + bot) / 2, W, H);
    this.lampLight.position.set(lp.x - .6, 3.2, lp.z);
    this.lampLight.target.position.copy(mid);
    this.pose(this.ending);
    this.dirty = true;
  };

  /* glow: 完成したときの明るさ（0〜1）。ending: 最後の演出の秒数（なければ null） */
  Scene.prototype.draw = function (ctx, W, H, glow, ending) {
    glow = Math.round((glow || 0) * 20) / 20;
    if (glow !== this.glow) { this.glow = glow; this.dirty = true; }
    if (ending !== this.ending) { this.ending = ending; this.pose(ending); this.dirty = true; }
    if (this.dirty) {
      this.lampLight.intensity = 90 + glow * 120;
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
  };

  return Scene;
})();
