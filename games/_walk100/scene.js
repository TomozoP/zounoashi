/* 100歳まで歩く。three.js で野の道と歩く人を描く。体の位置と向きは walk.js の剛体をそのまま写す。 */
var ZLifeScene = (function () {
  "use strict";
  var T;

  function mat(color, rough) { return new T.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.85 : rough, metalness: 0 }); }
  function shade(color, k) { return new T.Color(color).multiplyScalar(k); }
  // 長さ len の棒。中心が原点、y 方向に伸びる。
  function capsule(r, len, m) {
    var g = new T.Mesh(new T.CapsuleGeometry(r, Math.max(0.001, len), 6, 12), m);
    g.castShadow = true;
    return g;
  }
  function ball(r, m) { var s = new T.Mesh(new T.SphereGeometry(r, 18, 14), m); s.castShadow = true; return s; }
  function box(w, h, d, m) { var b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.castShadow = true; return b; }

  // 年齢ごとの色と、手足を左右へずらす幅。右は手前（カメラ側）。
  var BABY_LOOK = { skin: 0xffd3b5, body: 0xfff0a0, leg: 0xfff0a0, shin: 0xffd3b5, shoe: null, hair: 0x6b4a2b, hairSize: 0.45, diaper: 1, chest: 1, legZ: 0.06, armZ: 0.08 };
  // 服は子ども・大人・老人の色を年齢で混ぜる。
  var CLOTHES = [
    { age: 1, body: 0xfff0a0, leg: 0xfff0a0, shoe: 0xffd3b5, skin: 0xffd3b5 },
    { age: 4, body: 0xf2a33a, leg: 0x3b6fb6, shoe: 0xd8322e, skin: 0xffcfae },
    { age: 12, body: 0xe8584a, leg: 0x2f4f86, shoe: 0x33383f, skin: 0xf4c29c },
    { age: 25, body: 0x3f7fd0, leg: 0x2c3344, shoe: 0x3a2a20, skin: 0xe9b38c },
    { age: 55, body: 0x4f7a5a, leg: 0x3a3a40, shoe: 0x3a2a20, skin: 0xe6b394 },
    { age: 80, body: 0x8a6a4c, leg: 0x6d7076, shoe: 0x3b2c22, skin: 0xe6b394 }
  ];
  var HAIR = [[0, 0x6b4a2b], [20, 0x2d2118], [45, 0x2d2118], [65, 0x8d8a86], [85, 0xeeeeea]];
  function lerpTable(t, x, k) {
    if (x <= t[0].age) return new T.Color(t[0][k]);
    for (var i = 1; i < t.length; i++) if (x <= t[i].age) return new T.Color(t[i - 1][k]).lerp(new T.Color(t[i][k]), (x - t[i - 1].age) / (t[i].age - t[i - 1].age));
    return new T.Color(t[t.length - 1][k]);
  }
  function smooth(a, b, x) { var u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); }
  function looks(walker) {
    if (walker.form === "baby") return BABY_LOOK;
    var age = walker.age, s = walker.scale;
    function c(k) { return lerpTable(CLOTHES, age, k).getHex(); }
    return {
      skin: c("skin"), body: c("body"), leg: c("leg"), shoe: c("shoe"),
      // 幼いうちは素足。すねの色を肌から服へ少しずつ移す。
      shin: new T.Color(c("skin")).lerp(new T.Color(c("leg")), smooth(1, 4, age)).getHex(),
      diaper: 1 - smooth(1.5, 3, age), chest: 1 + 0.35 * smooth(1, 6, age),
      hair: lerpTable(HAIR.map(function (h) { return { age: h[0], v: h[1] }; }), age, "v").getHex(),
      hairSize: age < 6 ? 0.45 + 0.11 * (age - 1) : age > 75 ? 1 - Math.min(0.25, (age - 75) / 60) : 1,
      legZ: 0.1 * s, armZ: 0.2 * s
    };
  }

  // from に前の姿（各部位の位置と角度）を渡すと、dur 秒かけてそこから今の体へ移る。
  function Figure(walker, scene, from, dur) {
    this.walker = walker;
    this.form = walker.form;
    this.from = from || null;
    this.dur = dur || 0;
    this.t = 0;
    var L = looks(walker), c = walker.cfg, self = this, sc = walker.scale || 0.5;
    this.root = new T.Group();
    scene.add(this.root);
    this.meshes = [];
    Object.keys(walker.parts).forEach(function (name) {
      var b = walker.parts[name], g = new T.Group(), side = name.slice(-1), far = side === "L" && name !== "trunk";
      var z = 0;
      if (/^(arm|cane)/.test(name)) z = (side === "L" ? -1 : 1) * L.armZ;
      if (/^(thigh|shin|foot)/.test(name)) z = (side === "L" ? -1 : 1) * L.legZ;
      if (name === "cane") z = L.armZ + 0.03 * sc;
      var k = far ? 0.78 : 1;
      if (name === "trunk") self.trunk(g, b, L, c);
      else if (/^arm/.test(name)) {
        var up = capsule(b.r * 1.15, b.len * 0.45, mat(shade(L.body, k)));
        up.position.y = b.len * 0.22;
        var low = capsule(b.r, b.len * 0.5, mat(shade(L.skin, k)));
        low.position.y = -b.len * 0.2;
        var hand = ball(b.r * 1.35, mat(shade(L.skin, k)));
        hand.position.y = -b.len / 2;
        g.add(up, low, hand);
      } else if (/^thigh/.test(name)) {
        g.add(capsule(b.r, b.len, mat(shade(L.leg, k))));
      } else if (/^shin/.test(name)) {
        g.add(capsule(b.r * (walker.form === "baby" ? 1 : 0.95), b.len, mat(shade(L.shin, k))));
        if (walker.form === "baby") { var foot = ball(b.r * 1.3, mat(shade(L.skin, k))); foot.position.y = -b.len / 2; foot.scale.set(1, 1.4, 1); g.add(foot); }
      } else if (/^foot/.test(name)) {
        var f = box(b.len, 0.07 * sc, 0.11 * sc, mat(shade(L.shoe, k), 0.6));
        f.position.y = 0.005 * sc;
        g.add(f);
      } else if (name === "cane") {
        var wood = mat(0x6b3f1f, 0.5);
        // 杖を持ち始めたときは、すっと現れる。
        if (self.from && !self.from.cane) { wood.transparent = true; wood.opacity = 0; self.fade = wood; }
        g.add(capsule(0.018 * sc, b.len, wood));
        // 握りの曲がり。
        var crook = new T.Mesh(new T.TorusGeometry(0.05 * sc, 0.016 * sc, 8, 16, Math.PI), wood);
        crook.position.set(0.05 * sc, b.len / 2, 0);
        crook.castShadow = true;
        g.add(crook);
      }
      g.position.z = z;
      self.root.add(g);
      self.meshes.push({ body: b, group: g, z: z });
    });
    this.update();
  }
  Figure.prototype.trunk = function (g, b, L, c) {
    var baby = this.form === "baby", len = b.len, half = b.half, sc = this.walker.scale || 0.5;
    var torso = capsule(half, len - half * 0.6, mat(L.body));
    torso.scale.z = L.chest;
    g.add(torso);
    if (L.diaper > 0.02) {
      // おむつのふくらみ。育つにつれて小さくなる。
      var diaper = ball(half * (0.95 + 0.2 * L.diaper), mat(0xffffff));
      diaper.scale.setScalar(L.diaper);
      diaper.position.y = -len / 2 + half * 0.5;
      g.add(diaper);
    }
    var neck = capsule(0.045 * sc, 0.06 * sc, mat(L.skin));
    neck.position.y = len / 2 + 0.02 * sc;
    if (!baby) g.add(neck);
    var head = new T.Group(), r = b.headR;
    head.position.y = b.headOffset;
    this.head = head;
    head.add(ball(r, mat(L.skin)));
    // 顔は進む向き（大人は体の前、赤ちゃんは頭の先）。
    var ahead = baby ? new T.Vector3(0.35, 0.94, 0).normalize() : new T.Vector3(1, 0.05, 0).normalize();
    var eyeM = new T.MeshBasicMaterial({ color: 0x1d1a18 });
    [-1, 1].forEach(function (s) {
      var e = new T.Mesh(new T.SphereGeometry(r * 0.1, 8, 6), eyeM);
      var side = new T.Vector3(0, 0, s * r * 0.36);
      e.position.copy(ahead.clone().multiplyScalar(r * 0.92)).add(side);
      if (!baby) e.position.y += r * 0.12;
      head.add(e);
    });
    var ear = ball(r * 0.22, mat(L.skin));
    ear.position.set(baby ? 0.02 : -0.01, baby ? 0 : 0.01, r * 0.95);
    head.add(ear);
    // 髪。赤ちゃんは頭頂に少し、大人は後頭部を覆う。
    var hair = new T.Mesh(new T.SphereGeometry(r * 1.06, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55 * L.hairSize), mat(L.hair, 1));
    hair.castShadow = true;
    hair.rotation.z = baby ? 1.9 : 0.38;
    head.add(hair);
    g.add(head);
  };
  Figure.prototype.update = function (dt) {
    var from = this.from, e = 1;
    if (from) {
      this.t += dt || 0;
      var u = Math.min(1, this.t / this.dur);
      e = u * u * (3 - 2 * u);
      if (u >= 1) this.from = null;
    }
    // ハイハイの顔は頭の先を向くので、起き上がる間に顔を前へ回す。
    if (this.head) this.head.rotation.z = from && from.baby ? 1.16 * (1 - e) : 0;
    if (this.fade) { this.fade.opacity = e; if (e >= 1) { this.fade.transparent = false; this.fade = null; } }
    this.meshes.forEach(function (m) {
      var b = m.body, x = b.position.x, y = b.position.y, a = 2 * Math.atan2(b.quaternion.z, b.quaternion.w);
      var f = from && from.parts[m.body.part], k = 1;
      if (f && e < 1) {
        x = f.x + (x - f.x) * e;
        y = f.y + (y - f.y) * e;
        a = f.a + Math.atan2(Math.sin(a - f.a), Math.cos(a - f.a)) * e;
        // 大きさも前の部位の長さから寄せる。
        if (f.len && b.len) k = f.len / b.len + (1 - f.len / b.len) * e;
      }
      m.group.scale.setScalar(k);
      m.group.position.x = x;
      m.group.position.y = y;
      m.group.rotation.z = a;
    });
  };
  // 今の姿を写しておく（次の体へ移るときの出発点）。
  Figure.prototype.pose = function () {
    var parts = {}, w = this.walker;
    this.meshes.forEach(function (m) { parts[m.body.part] = { x: m.group.position.x, y: m.group.position.y, a: m.group.rotation.z, len: m.body.len * m.group.scale.x }; });
    // ハイハイには足がないので、すねの先から始める。
    ["L", "R"].forEach(function (k) {
      var sh = parts["shin" + k], b = w.parts["shin" + k];
      if (sh && !parts["foot" + k]) parts["foot" + k] = { x: sh.x + Math.sin(sh.a) * b.len / 2, y: sh.y - Math.cos(sh.a) * b.len / 2, a: 0 };
    });
    return { parts: parts, cane: w.cane, baby: w.form === "baby" };
  };
  Figure.prototype.dispose = function () {
    this.root.parent && this.root.parent.remove(this.root);
    this.root.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  };

  // 空の色。朝・昼・夕を年齢で移る（0歳が朝、100歳が夕方）。
  var SKY = [
    { p: 0, sky: 0xf6c7a2, sun: 0xffc27a, light: 0xffd2a8, amb: 1.3 },
    { p: 0.18, sky: 0xbfe0f2, sun: 0xfff2c8, light: 0xfff0dc, amb: 1.45 },
    { p: 0.5, sky: 0x86c8f0, sun: 0xfffbe8, light: 0xffffff, amb: 1.6 },
    { p: 0.78, sky: 0xf2b37a, sun: 0xffa050, light: 0xffc890, amb: 1.35 },
    { p: 1, sky: 0xc9728a, sun: 0xff6a3a, light: 0xff9a70, amb: 1.15 }
  ];
  function skyAt(p) {
    for (var i = 1; i < SKY.length; i++) if (p <= SKY[i].p) break;
    var a = SKY[Math.max(0, i - 1)], b = SKY[Math.min(SKY.length - 1, i)], u = b.p === a.p ? 0 : (p - a.p) / (b.p - a.p);
    function mix(k) { return new T.Color(a[k]).lerp(new T.Color(b[k]), u); }
    return { sky: mix("sky"), sun: mix("sun"), light: mix("light"), amb: a.amb + (b.amb - a.amb) * u };
  }

  function Scene(course) {
    T = THREE;
    this.course = course;
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.scene = new T.Scene();
    this.scene.fog = new T.Fog(0xf6c7a2, 30, 150);
    this.camera = new T.PerspectiveCamera(46, 540 / 960, 0.05, 400);
    this.hemi = new T.HemisphereLight(0xfff6ea, 0x7fa05a, 1.5);
    this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight(0xffffff, 2.8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    var sc = this.sun.shadow.camera;
    sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3; sc.near = 1; sc.far = 60;
    this.scene.add(this.sun, this.sun.target);
    this.sunBall = new T.Mesh(new T.SphereGeometry(7, 24, 16), new T.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    this.scene.add(this.sunBall);

    var end = course.length;
    var field = new T.Mesh(new T.PlaneGeometry(end + 400, 400), mat(0x9cc47a, 1));
    field.rotation.x = -Math.PI / 2;
    field.position.set(end / 2, 0, -100);
    field.receiveShadow = true;
    this.scene.add(field);
    // 踏み固めた土の道。
    var path = new T.Mesh(new T.PlaneGeometry(end + 40, 1.3), mat(0xd6bf93, 1));
    path.rotation.x = -Math.PI / 2;
    path.position.set(end / 2, 0.006, 0);
    path.receiveShadow = true;
    this.scene.add(path);

    // 小石と草。同じ並びを毎回作る。
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var stoneM = mat(0xa8a090, 1), tuftM = mat(0x6f9a4a, 1);
    for (var x = -6; x < end + 12; x += 0.35 + rnd() * 0.5) {
      var z = (rnd() < 0.5 ? -1 : 1) * (0.8 + rnd() * 4);
      if (rnd() < 0.75) {
        var s = new T.Mesh(new T.DodecahedronGeometry(0.03 + rnd() * 0.07, 0), stoneM);
        s.position.set(x, 0.02, z); s.rotation.set(rnd() * 3, rnd() * 3, 0); s.scale.y = 0.6;
        s.receiveShadow = true;
        this.scene.add(s);
      } else {
        var tf = new T.Mesh(new T.ConeGeometry(0.06, 0.18, 5), tuftM);
        tf.position.set(x, 0.08, z);
        this.scene.add(tf);
      }
    }
    // 遠くの丘。
    var hillM = mat(0x86b36a, 1), hillFar = mat(0x9fbf8f, 1);
    [[-40, -170, 70, 0], [30, -220, 90, 1], [80, -180, 60, 0], [140, -230, 95, 1], [end + 20, -175, 70, 0]].forEach(function (p) {
      var h = new T.Mesh(new T.SphereGeometry(p[2], 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), p[3] ? hillFar : hillM);
      h.scale.y = 0.2;
      h.position.set(p[0], 0, p[1]);
      this.scene.add(h);
    }, this);

    // 境目と、ゴールの柱とテープ。
    var postM = mat(0xf2efe6, 0.7), tapeM = mat(0xd8322e, 0.6);
    this.goal = new T.Group();
    [-0.9, 0.9].forEach(function (z) { var p = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 1.3, 10), postM); p.position.set(0, 0.65, z); p.castShadow = true; this.goal.add(p); }, this);
    this.tape = new T.Mesh(new T.BoxGeometry(0.02, 0.05, 1.8), tapeM);
    this.tape.position.set(0, 1.0, 0);
    this.goal.add(this.tape);
    this.goal.position.x = end;
    this.scene.add(this.goal);

    this.figure = null;
    this.look = { x: 0, y: 0.3, d: 2.6 };
    this.w = 540; this.h = 960;
  }

  // morph 秒かけて、前の体の姿から新しい体へ移る（0 ならすぐ入れ替える）。
  Scene.prototype.setWalker = function (walker, morph) {
    var from = null;
    if (this.figure) {
      if (morph || (walker && walker.cane && !this.figure.walker.cane)) from = this.figure.pose();
      this.figure.dispose();
    }
    this.figure = walker ? new Figure(walker, this.scene, from, morph || 0.6) : null;
  };

  Scene.prototype.resize = function (w, h) {
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  // s = { x, form, scale, progress, snap, dt }
  Scene.prototype.draw = function (ctx, W, H, s) {
    if (this.figure) this.figure.update(s.dt);
    var sky = skyAt(s.progress);
    this.scene.background = sky.sky;
    this.scene.fog.color.copy(sky.sky);
    this.hemi.intensity = sky.amb;
    this.sun.color.copy(sky.light);
    this.sunBall.material.color.copy(sky.sun);
    // 体の大きさに合わせて寄る。
    var sc = s.form === "baby" ? 0 : s.scale, targetD = s.form === "baby" ? 2.1 : 1.3 + 3 * sc, targetY = s.form === "baby" ? 0.22 : 0.92 * sc;
    var a = s.snap ? 1 : Math.min(1, (s.dt || 0.016) * 3);
    this.look.x += (s.x - this.look.x) * a;
    this.look.y += (targetY - this.look.y) * Math.min(1, a * 0.6);
    this.look.d += (targetD - this.look.d) * Math.min(1, a * 0.6);
    var L = this.look, tall = Math.max(0, Math.min(1, (H / W - 1.45) / 0.9));
    this.camera.fov = 44 + tall * 10;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(L.x + L.d * 0.32, L.y + L.d * 0.2, L.d);
    this.camera.lookAt(L.x + L.d * 0.08, L.y * 0.85, 0);
    // 太陽は左の低い所から昇り、真上を通って右へ沈む。
    var ang = Math.PI * (0.06 + 0.88 * s.progress);
    var dir = new T.Vector3(-Math.cos(ang), Math.sin(ang) * 0.9 + 0.08, -0.45).normalize();
    this.sunBall.position.set(L.x - Math.cos(ang) * 160, 6 + Math.sin(ang) * 90, -200);
    this.sun.target.position.set(L.x, 0, 0);
    this.sun.position.set(L.x + dir.x * 20, Math.max(2, dir.y * 20), dir.z * 20 + 6);
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
  };

  return Scene;
})();
