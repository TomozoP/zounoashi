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
  /* 奥の窓。夜の街の明かり */
  function windowTex() {
    return canvasTex(1024, 512, function (g, w, h) {
      var sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#0b1224"); sky.addColorStop(1, "#1d2a44");
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      for (var b = 0; b < 26; b++) {
        var bx = Math.random() * w, bw = 30 + Math.random() * 90, bh = 120 + Math.random() * 300;
        g.fillStyle = "#0a0f1b"; g.fillRect(bx, h - bh, bw, bh);
        for (var wy = h - bh + 8; wy < h - 6; wy += 12)
          for (var wx = bx + 5; wx < bx + bw - 6; wx += 10)
            if (Math.random() < .3) { g.fillStyle = Math.random() < .8 ? "rgba(255,214,140,.8)" : "rgba(180,220,255,.8)"; g.fillRect(wx, wy, 4, 6); }
      }
      /* ブラインド */
      g.fillStyle = "rgba(200,205,215,.18)";
      for (var y = 0; y < h; y += 22) g.fillRect(0, y, w, 9);
    });
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
    this.camera = new T.PerspectiveCamera(38, 540 / 960, .1, 80);
    this.dirty = true;
    this.glow = 0;
    this.build();
  }

  Scene.prototype.build = function () {
    var s = this.scene;

    /* 天板と奥の壁・窓 */
    var desk = new T.Mesh(new T.BoxGeometry(16, .4, 16), new T.MeshStandardMaterial({ map: woodTex(), roughness: .55 }));
    desk.position.y = -.2; desk.receiveShadow = true; s.add(desk);
    var wall = new T.Mesh(new T.PlaneGeometry(30, 14), mat(0x2a2d36, .95));
    wall.position.set(0, 5, -8.5); s.add(wall);
    var win = new T.Mesh(new T.PlaneGeometry(12, 6), new T.MeshBasicMaterial({ map: windowTex() }));
    win.position.set(0, 3.2, -8.45); s.add(win);

    /* 光：暖かい電気スタンドと、窓からの青い明かり */
    s.add(new T.HemisphereLight(0x9fb4d8, 0x2a1d14, .9));
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
    this.dirty = true;
  };

  /* glow: 完成したときの明るさ（0〜1） */
  Scene.prototype.draw = function (ctx, W, H, glow) {
    glow = Math.round((glow || 0) * 20) / 20;
    if (glow !== this.glow) { this.glow = glow; this.dirty = true; }
    if (this.dirty) {
      this.lampLight.intensity = 90 + glow * 120;
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
  };

  return Scene;
})();
