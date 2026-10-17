/* スマホ歩きの立体（three.js）。games/three-base.js の Z3 を土台にする。
   床の上を、人の脚が生えたスマホが歩く。動きはゲーム側（index.html）が決め、ここは見た目だけ。
   脚の長さが1。スマホは +x の向きに画面を向けて歩く。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;
  var THIGH = 0.53, SHIN = 0.53, ANK = 0.08, PH = 1.5, PW = 0.75, PD = 0.09, HIPZ = 0.2;

  function canvasTex(w, h, paint) {
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    paint(c.getContext("2d"), w, h);
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  /* 待ち受け画面：色のついたアプリの四角だけ（文字なし） */
  function paintScreen(g, w, h) {
    var gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, "#5b7cfa"); gr.addColorStop(0.55, "#a35bf0"); gr.addColorStop(1, "#ff8a6b");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    var cols = ["#ffffff", "#34c759", "#ff3b30", "#ffcc00", "#0a84ff", "#ff9f0a", "#5ac8fa", "#af52de", "#ff2d55", "#30d158"];
    var n = 0, s = w * 0.17, gap = (w - s * 4) / 5;
    for (var r = 0; r < 5; r++) for (var c = 0; c < 4; c++) {
      g.fillStyle = cols[(n++ * 7) % cols.length];
      rr(g, gap + c * (s + gap), h * 0.1 + r * (s + gap * 1.6), s, s, s * 0.24); g.fill();
    }
    g.fillStyle = "rgba(255,255,255,.35)"; rr(g, w * 0.06, h * 0.84, w * 0.88, s * 1.3, s * 0.4); g.fill();
    for (var k = 0; k < 4; k++) { g.fillStyle = cols[(k * 3 + 1) % cols.length]; rr(g, gap + k * (s + gap), h * 0.84 + s * 0.15, s, s, s * 0.24); g.fill(); }
  }

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces" }, camera: { fov: 40, near: 0.1, far: 80 } });
    var sc = this.scene = st.scene;
    this.camera = st.camera;
    sc.background = new T.Color(0xcfd8e0);
    sc.fog = new T.Fog(0xcfd8e0, 14, 34);
    this.lights = Z3.lights(sc, { shadows: true, shadowSize: 6 });
    sc.add(this.lights.key.target);
    this.camX = null; this.camGoal = 0; this.camV = 0; this.camVel = 0; this.lastMid = 0; this.lastT = 0;

    /* 床（板張り）。カメラについて動かし、模様だけずらす */
    /* 板は進む向きと直角に並べる（継ぎ目が流れて、進んでいるのが分かるように） */
    var wood = canvasTex(512, 512, function (g, w, h) {
      var cols = ["#8f8a84", "#857f79", "#98938c", "#8a847d"];   /* 灰色寄りの木（肌色の脚が溶けないように） */
      for (var b = 0; b < 8; b++) {
        var x0 = b * w / 8;
        g.fillStyle = cols[b % cols.length]; g.fillRect(x0, 0, w / 8, h);
        for (var i = 0; i < 9; i++) {
          var x = x0 + Math.random() * w / 8, a = 0.05 + Math.random() * 0.1;
          g.strokeStyle = "rgba(40,36,32," + a + ")"; g.lineWidth = 1 + Math.random() * 2;
          g.beginPath(); g.moveTo(x, 0);
          for (var y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y * 0.02 + i + b) * 3, y);
          g.stroke();
        }
        g.fillStyle = "rgba(30,28,26,.45)"; g.fillRect(x0, 0, 3, h);
        g.fillRect(x0, (b * 0.37 % 1) * h, w / 8, 3);
      }
    });
    wood.wrapS = wood.wrapT = T.RepeatWrapping; wood.repeat.set(2, 1);
    this.wood = wood;
    var floor = this.floor = new T.Mesh(new T.PlaneGeometry(30, 17), Z3.std(0xffffff, { map: wood, roughness: 0.65 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.position.z = -2;
    sc.add(floor);

    /* 奥の壁と幅木（進んだ感じを出す縦の継ぎ目） */
    var wallTex = canvasTex(512, 256, function (g, w, h) {
      g.fillStyle = "#eef0ea"; g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(0, 0, 4, h); g.fillRect(w / 2, 0, 4, h);
      g.fillStyle = "#f6f4ee"; g.fillRect(w * 0.2, h * 0.62, 26, 36); g.strokeStyle = "rgba(0,0,0,.25)"; g.strokeRect(w * 0.2, h * 0.62, 26, 36);
      g.fillStyle = "#d8d2c4"; g.fillRect(0, h - 22, w, 22);
    });
    wallTex.wrapS = T.RepeatWrapping; wallTex.repeat.set(5, 1);
    this.wallTex = wallTex;
    var wall = this.wall = new T.Mesh(new T.PlaneGeometry(26, 6), Z3.std(0xffffff, { map: wallTex, roughness: 0.9 }));
    wall.position.set(0, 3, -3.5); wall.receiveShadow = true;
    sc.add(wall);

    /* スタートとゴールの線（床に貼ったテープ）。ゴールは市松模様 */
    var checker = canvasTex(64, 512, function (g, w, h) {
      for (var y = 0; y < 16; y++) for (var x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? "#1b1b1f" : "#ffffff"; g.fillRect(x * 32, y * 32, 32, 32); }
    });
    checker.wrapS = checker.wrapT = T.RepeatWrapping; checker.repeat.set(1, 10 / 2.4);
    /* 線は奥の壁から手前の床の端まで、横いっぱい */
    this.goalLine = new T.Mesh(new T.PlaneGeometry(0.3, 10), Z3.std(0xffffff, { map: checker, roughness: 0.7 }));
    this.goalLine.rotation.x = -Math.PI / 2; this.goalLine.position.set(10, 0.004, 1.5); this.goalLine.receiveShadow = true;
    sc.add(this.goalLine);
    var startLine = new T.Mesh(new T.PlaneGeometry(0.08, 10), Z3.std(0xf4f4f0, { roughness: 0.7 }));
    startLine.rotation.x = -Math.PI / 2; startLine.position.set(0, 0.004, 1.5); startLine.receiveShadow = true;
    sc.add(startLine);
    this.buildProps();
    this.buildPhone();
    this.shardMeshes = [];
    var shardGeo = new T.BufferGeometry();
    shardGeo.setAttribute("position", new T.Float32BufferAttribute([0, 1, 0, -0.8, -0.6, 0, 0.9, -0.4, 0], 3));
    shardGeo.computeVertexNormals();
    this.shardGeo = shardGeo;
    this.shardMat = new T.MeshStandardMaterial({ color: 0xe8f4ff, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.8, side: T.DoubleSide });
  }

  /* 道の途中の物：重ねた漫画2冊（段差）と、寝かせた歯みがき粉の箱（蹴ると転がる） */
  GameScene.prototype.buildProps = function () {
    var sc = this.scene;
    this.books = new T.Group(); sc.add(this.books);
    var pages = Z3.std(0xf3eedf, { roughness: 0.9 });
    var covers = [[0xd8473a, 0xf1d24a], [0x2f6fb5, 0xffffff]];
    for (var i = 0; i < 2; i++) {
      var cov = canvasTex(256, 384, function (g, w, h) {
        g.fillStyle = "#" + covers[i][0].toString(16).padStart(6, "0"); g.fillRect(0, 0, w, h);
        g.fillStyle = "#" + covers[i][1].toString(16).padStart(6, "0"); g.fillRect(0, h * 0.08, w, h * 0.16);
        g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.arc(w * 0.5, h * 0.6, w * 0.26, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(0,0,0,.15)"; g.fillRect(0, h * 0.9, w, h * 0.1);
      });
      var cm = Z3.std(0xffffff, { map: cov, roughness: 0.6 }), sp = Z3.std(covers[i][0], { roughness: 0.6 });
      /* 背の面だけ表紙の色、ほかの3面は紙の色 */
      var b = new T.Mesh(new T.BoxGeometry(1.1, 0.13, 1.7), [pages, pages, cm, cm, sp, pages]);
      b.position.set(0, 0.065 + i * 0.13, 0); b.rotation.y = i ? 0.06 : -0.03;
      b.castShadow = b.receiveShadow = true; this.books.add(b);
    }
    var side = canvasTex(512, 128, function (g, w, h) {
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#1f62c9"; g.fillRect(0, h * 0.62, w, h * 0.38);
      g.fillStyle = "#e23b3b"; g.fillRect(0, h * 0.5, w, h * 0.12);
      g.fillStyle = "#1f62c9"; g.beginPath(); g.ellipse(w * 0.3, h * 0.3, w * 0.12, h * 0.14, 0, 0, Math.PI * 2); g.fill();
    });
    var end = Z3.std(0xffffff, { roughness: 0.7 }), sm = Z3.std(0xffffff, { map: side, roughness: 0.55 });
    this.box = new T.Mesh(new T.BoxGeometry(0.42, 0.42, 1.8), [end, end, sm, sm, sm, sm]);
    this.box.castShadow = this.box.receiveShadow = true; sc.add(this.box);
  };

  GameScene.prototype.buildPhone = function () {
    var sc = this.scene;
    /* 体全体の入れ物 */
    var pivot = this.pivot = new T.Group(); sc.add(pivot);
    var body = this.body = new T.Group(); pivot.add(body);

    /* スマホ：画面は +x の面 */
    var screenTex = canvasTex(256, 512, paintScreen);
    var crackTex = canvasTex(256, 512, function (g, w, h) {
      paintScreen(g, w, h);
      g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 2.2;
      var cx = w * 0.42, cy = h * 0.36;
      for (var i = 0; i < 14; i++) {
        var a = i / 14 * 6.283 + Math.random() * 0.4, x = cx, y = cy;
        g.beginPath(); g.moveTo(x, y);
        for (var k = 0; k < 8; k++) { a += (Math.random() - 0.5) * 0.5; x += Math.cos(a) * 36; y += Math.sin(a) * 36; g.lineTo(x, y); }
        g.stroke();
      }
      for (var r = 22; r < 160; r += 34) { g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.stroke(); }
    });
    this.screenMat = new T.MeshStandardMaterial({ map: screenTex, roughness: 0.12, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.35 });
    this.crackMat = new T.MeshStandardMaterial({ map: crackTex, roughness: 0.2 });
    /* 本体：角の丸い板に、縁の丸み（面取り）。外枠は金属、背面はつや消しのガラス */
    var R = 0.11, BV = 0.02, D = PD - BV * 2;
    function rounded(w, h, r) {
      var sh = new T.Shape(), x = -w / 2, y = -h / 2;
      sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r);
      sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r);
      sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
      return sh;
    }
    function flat(w, h, r, mat, x) {   /* +x を向いた角丸の板。絵が全面に貼れるよう UV を 0〜1 にする */
      var g = new T.ShapeGeometry(rounded(w, h, r), 6), uv = g.attributes.uv, pos = g.attributes.position;
      for (var i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
      g.rotateY(Math.PI / 2);
      var m = new T.Mesh(g, mat); m.position.x = x; return m;
    }
    var bodyGeo = new T.ExtrudeGeometry(rounded(PW - BV * 2, PH - BV * 2, R), { depth: D, bevelEnabled: true, bevelThickness: BV, bevelSize: BV, bevelSegments: 3, curveSegments: 8 });
    bodyGeo.translate(0, 0, -D / 2); bodyGeo.rotateY(Math.PI / 2);
    var frameMat = Z3.std(0x9aa0a8, { roughness: 0.25, metalness: 0.85 });
    var phone = this.phone = new T.Mesh(bodyGeo, frameMat);
    phone.position.y = PH / 2 + 0.03; phone.castShadow = true;
    var glass = new T.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.08, metalness: 0.2 });
    phone.add(flat(PW - 0.03, PH - 0.03, R, glass, PD / 2 + 0.001));                    /* 表の黒いガラス（縁） */
    var scr = this.screen = flat(PW - 0.08, PH - 0.08, R - 0.03, this.screenMat, PD / 2 + 0.003);
    phone.add(scr);
    var island = new T.Mesh(new T.CapsuleGeometry(0.022, 0.09, 4, 8), glass);            /* 画面上の黒い切り欠き */
    island.rotation.x = Math.PI / 2; island.position.set(PD / 2 + 0.005, PH / 2 - 0.09, 0); island.scale.set(1, 1, 0.5);
    phone.add(island);
    this.backMat = Z3.std(0x4a5260, { roughness: 0.45, metalness: 0.2 });
    var back = flat(PW - 0.03, PH - 0.03, R, this.backMat, 0);
    back.rotation.y = Math.PI; back.position.x = -PD / 2 - 0.001; phone.add(back);
    /* 背面のカメラ：角丸の台にレンズ3つ */
    var bump = new T.Mesh(new T.ExtrudeGeometry(rounded(0.3, 0.3, 0.07), { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 6 }), this.backMat);
    bump.geometry.rotateY(-Math.PI / 2); bump.position.set(-PD / 2, PH / 2 - 0.2, -PW / 2 + 0.2); phone.add(bump);
    var lensRing = Z3.std(0x8a9098, { roughness: 0.2, metalness: 0.9 }), lensGlass = new T.MeshStandardMaterial({ color: 0x05070a, roughness: 0.05, metalness: 0.5 });
    [[0.065, 0.065], [-0.065, 0.065], [0.065, -0.065]].forEach(function (o) {
      var ring = new T.Mesh(new T.CylinderGeometry(0.048, 0.05, 0.02, 16), lensRing);
      ring.rotation.z = Math.PI / 2; ring.position.set(-PD / 2 - 0.025, PH / 2 - 0.2 + o[1], -PW / 2 + 0.2 + o[0]); phone.add(ring);
      var lens = new T.Mesh(new T.CircleGeometry(0.034, 16), lensGlass);
      lens.rotation.y = -Math.PI / 2; lens.position.set(-PD / 2 - 0.036, ring.position.y, ring.position.z); phone.add(lens);
    });
    /* 横のボタン（音量2つと電源） */
    [[PH / 2 - 0.32, 0.12, -1], [PH / 2 - 0.48, 0.12, -1], [PH / 2 - 0.38, 0.2, 1]].forEach(function (o) {
      var bt = new T.Mesh(new T.CapsuleGeometry(0.012, o[1], 3, 6), frameMat);
      bt.position.set(0, o[0], o[2] * (PW / 2 + 0.004)); phone.add(bt);
    });
    var tilt = this.tilt = new T.Group(); body.add(tilt);
    tilt.add(phone);

    /* 脚：回転体で太さを変える（太ももは付け根が太く膝へ細く、すねはふくらはぎでふくらみ足首で締まる） */
    var skin = new T.MeshStandardMaterial({ color: 0xe6b48f, roughness: 0.62 });
    var sock = Z3.std(0xf4f4f0, { roughness: 0.9 });
    var shoe = Z3.std(0x2d3a52, { roughness: 0.55 });
    var sole = Z3.std(0xf2f2f2, { roughness: 0.8 });
    var lace = Z3.std(0xffffff, { roughness: 0.8 });
    function limb(len, prof) {   /* prof: [下からの割合, 太さ] の並び。+y の端が先（膝・足首） */
      var pts = prof.map(function (q) { return new T.Vector2(q[1], -len / 2 + q[0] * len); });
      return new T.LatheGeometry(pts, 14);
    }
    var thighGeo = limb(THIGH + 0.04, [[0, 0], [0.02, 0.1], [0.2, 0.112], [0.5, 0.1], [0.8, 0.08], [0.96, 0.068], [1, 0]]);
    var shinGeo = limb(SHIN, [[0, 0], [0.03, 0.068], [0.18, 0.075], [0.35, 0.078], [0.6, 0.06], [0.85, 0.045], [0.97, 0.043], [1, 0]]);
    this.legs = [];
    for (var i = 0; i < 2; i++) {
      var leg = {};
      leg.thigh = new T.Mesh(thighGeo, skin);
      leg.shin = new T.Mesh(shinGeo, skin);
      leg.knee = new T.Mesh(new T.SphereGeometry(0.068, 12, 10), skin);   /* 膝のお皿 */
      leg.knee.scale.set(1, 1.1, 0.95);
      leg.sock = new T.Mesh(new T.CylinderGeometry(0.05, 0.047, 0.1, 12), sock);
      leg.foot = new T.Group();
      /* スニーカー：平たい底、丸いつま先、かかと、ひも */
      var sl = new T.Mesh(new T.CapsuleGeometry(0.028, 0.27, 4, 10), sole); sl.rotation.z = Math.PI / 2; sl.scale.set(1, 1, 2.6); sl.position.set(0.06, 0.028, 0);
      var up = new T.Mesh(new T.SphereGeometry(1, 14, 10), shoe); up.scale.set(0.16, 0.065, 0.068); up.position.set(0.07, 0.07, 0);
      var heel = new T.Mesh(new T.SphereGeometry(1, 10, 8), shoe); heel.scale.set(0.07, 0.07, 0.066); heel.position.set(-0.03, 0.08, 0);
      var tie = new T.Mesh(new T.BoxGeometry(0.09, 0.012, 0.06), lace); tie.position.set(0.1, 0.128, 0); tie.rotation.z = -0.35;
      [sl, up, heel, tie].forEach(function (m) { m.castShadow = true; leg.foot.add(m); });
      [leg.thigh, leg.shin, leg.knee, leg.sock].forEach(function (m) { m.castShadow = true; });
      body.add(leg.thigh); body.add(leg.shin); body.add(leg.knee); body.add(leg.sock); body.add(leg.foot);
      leg.z = i === 0 ? HIPZ : -HIPZ;     /* 左脚は手前 */
      this.legs.push(leg);
    }
  };

  function bone(m, a, b, z) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z);
    m.rotation.set(0, 0, Math.atan2(dy, dx) - Math.PI / 2);
  }

  GameScene.prototype.reset = function () {};

  GameScene.prototype.sync = function (s) {
    var P = s.pts, hip = P[0], top = P[1];
    if (s.goal != null) this.goalLine.position.x = s.goal;
    if (s.step) this.books.position.x = (s.step.x0 + s.step.x1) / 2;
    if (s.box) {
      var c = s.box, bx = (c[0][0] + c[2][0]) / 2, by = (c[0][1] + c[2][1]) / 2;
      this.box.position.set(bx, by, 0); this.box.rotation.set(0, 0, Math.atan2(c[1][1] - c[0][1], c[1][0] - c[0][0]));
    }
    var mid = (hip[0] + top[0]) / 2;
    /* カメラ：ゆるいばねでなめらかに追う（一歩ごとの腰の揺れは拾わない） */
    var dt = Math.max(0, Math.min(0.1, (s.t || 0) - this.lastT)); this.lastT = s.t || 0;
    if (this.camX == null || s.intro || Math.abs(this.camX - mid) > 3) { this.camX = this.camGoal = this.lastMid = mid; this.camV = this.camVel = 0; }
    /* 進む速さをならして、その分だけ先を狙う（速く歩いても置いていかれない） */
    if (dt > 0) { var v = (mid - this.lastMid) / dt; this.camVel += (v - this.camVel) * (1 - Math.exp(-dt * 2)); }
    this.lastMid = mid;
    var kc = 30;
    this.camGoal = mid + (s.broken ? 0 : Math.max(0, Math.min(1, this.camVel * 2 / Math.sqrt(kc))));   /* 先を狙うのは前へ進むときだけ、少しまで */
    this.camV += (kc * (this.camGoal - this.camX) - 2 * Math.sqrt(kc) * this.camV) * dt;
    this.camX += this.camV * dt;
    var x = this.camX;
    this.lights.key.position.set(x - 4, 8, 6); this.lights.key.target.position.set(x, 0, 0);
    this.camera.position.set(x + 6.0, 2.5, 7.2);
    this.camera.lookAt(x + 0.6, 1.15, 0);
    this.floor.position.x = x; this.wood.offset.x = x / 13;
    this.wall.position.x = x; this.wallTex.offset.x = x / 5.2;

    /* スマホ：腰から上の端へ向ける（ねじらない） */
    var a = Math.atan2(top[0] - hip[0], top[1] - hip[1]);
    this.tilt.position.set(hip[0], hip[1], 0);
    this.tilt.rotation.set(0, 0, -a);

    for (var i = 0; i < 2; i++) {
      var lg = this.legs[i], knee = P[2 + i], ankle = P[4 + i], z = lg.z;
      bone(lg.thigh, hip, knee, z);
      bone(lg.shin, knee, ankle, z);
      var kd = Math.atan2(knee[1] - hip[1], knee[0] - hip[0]);
      lg.knee.position.set(knee[0] + 0.02 * Math.cos(kd + Math.PI / 2), knee[1] + 0.02 * Math.sin(kd + Math.PI / 2), z);
      lg.sock.position.set(ankle[0], ankle[1] + 0.05, z);
      lg.foot.position.set(ankle[0], Math.max(0, ankle[1] - 0.06), z);
    }
    this.screen.material = s.broken ? this.crackMat : this.screenMat;

    /* 破片 */
    while (this.shardMeshes.length < s.shards.length) {
      var m = new T.Mesh(this.shardGeo, this.shardMat); this.scene.add(m); this.shardMeshes.push(m);
    }
    for (var j = 0; j < this.shardMeshes.length; j++) {
      var mm = this.shardMeshes[j], p = s.shards[j];
      mm.visible = !!p;
      if (!p) continue;
      mm.position.set(p.x, p.y, p.z); mm.rotation.set(p.r, p.r * 0.7, p.r * 0.3); mm.scale.setScalar(p.s);
    }
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
