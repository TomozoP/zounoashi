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

  // 年代ごとの服。age の間は前後の服を混ぜ、同じ服の間は変えない。
  // shorts: すねが素足（1）か服か（0）、long: 袖が長い（1）か半袖（0）、tie: ネクタイ、pack: ランドセル。
  var ERAS = [
    { age: 0, body: 0xfff0a0, leg: 0xfff0a0, shoe: 0xffd3b5, shorts: 1, long: 0, tie: 0, pack: 0 },     // ロンパース
    { age: 2.5, body: 0xfff0a0, leg: 0xfff0a0, shoe: 0xffd3b5, shorts: 1, long: 0, tie: 0, pack: 0 },
    { age: 3.5, body: 0x8fc7ea, leg: 0x2f4f86, shoe: 0xf2f2f2, shorts: 1, long: 1, tie: 0, pack: 0 },     // 園児のスモック
    { age: 5.5, body: 0x8fc7ea, leg: 0x2f4f86, shoe: 0xf2f2f2, shorts: 1, long: 1, tie: 0, pack: 0 },
    { age: 6.5, body: 0xe8584a, leg: 0x2f4f86, shoe: 0xf2f2f2, shorts: 1, long: 0, tie: 0, pack: 1 },     // 小学生とランドセル
    { age: 11.5, body: 0xe8584a, leg: 0x2f4f86, shoe: 0xf2f2f2, shorts: 1, long: 0, tie: 0, pack: 1 },
    { age: 12.5, body: 0x1e2430, leg: 0x1e2430, shoe: 0xf2f2f2, shorts: 0, long: 1, tie: 0, pack: 0 },    // 学生服
    { age: 18, body: 0x1e2430, leg: 0x1e2430, shoe: 0xf2f2f2, shorts: 0, long: 1, tie: 0, pack: 0 },
    { age: 19, body: 0x5f8f6a, leg: 0x3b5a8a, shoe: 0xd8d2c4, shorts: 0, long: 1, tie: 0, pack: 0 },     // 私服
    { age: 22, body: 0x5f8f6a, leg: 0x3b5a8a, shoe: 0xd8d2c4, shorts: 0, long: 1, tie: 0, pack: 0 },
    { age: 23, body: 0x27324a, leg: 0x27324a, shoe: 0x1e1a18, shorts: 0, long: 1, tie: 1, pack: 0 },     // 背広
    { age: 60, body: 0x27324a, leg: 0x27324a, shoe: 0x1e1a18, shorts: 0, long: 1, tie: 1, pack: 0 },
    { age: 62, body: 0xd7c49a, leg: 0x6b5a48, shoe: 0x3b2c22, shorts: 0, long: 0, tie: 0, pack: 0 },     // 退職後のポロシャツ
    { age: 75, body: 0xd7c49a, leg: 0x6b5a48, shoe: 0x3b2c22, shorts: 0, long: 0, tie: 0, pack: 0 },
    { age: 77, body: 0x8a6a4c, leg: 0x6d7076, shoe: 0x3b2c22, shorts: 0, long: 1, tie: 0, pack: 0 }      // カーディガン
  ];
  var SKIN = [{ age: 0, v: 0xffd3b5 }, { age: 6, v: 0xffcfae }, { age: 20, v: 0xe9b38c }, { age: 70, v: 0xe6b394 }];
  var HAIR = [{ age: 0, v: 0x6b4a2b }, { age: 20, v: 0x2d2118 }, { age: 45, v: 0x2d2118 }, { age: 65, v: 0x8d8a86 }, { age: 85, v: 0xeeeeea }];
  function at(t, x) {
    if (x <= t[0].age) return { a: t[0], b: t[0], u: 0 };
    for (var i = 1; i < t.length; i++) if (x <= t[i].age) return { a: t[i - 1], b: t[i], u: (x - t[i - 1].age) / (t[i].age - t[i - 1].age) };
    return { a: t[t.length - 1], b: t[t.length - 1], u: 0 };
  }
  function color(t, x, k) { var p = at(t, x); return new T.Color(p.a[k]).lerp(new T.Color(p.b[k]), p.u); }
  function num(t, x, k) { var p = at(t, x); return p.a[k] + (p.b[k] - p.a[k]) * p.u; }
  var HEAD_BIG = 0.4;   // 2歳までの頭の大きさの上乗せ（15歳でなくなる）
  function smooth(a, b, x) { var u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); }
  // 年齢 age の見た目。色は THREE.Color、ほかは数。
  function looks(age) {
    var skin = color(SKIN, age, "v"), body = color(ERAS, age, "body"), leg = color(ERAS, age, "leg");
    return {
      skin: skin, body: body, leg: leg, shoe: color(ERAS, age, "shoe"),
      shin: leg.clone().lerp(skin, num(ERAS, age, "shorts")),
      lower: skin.clone().lerp(body, num(ERAS, age, "long")),
      hair: color(HAIR, age, "v"),
      tie: num(ERAS, age, "tie"), pack: num(ERAS, age, "pack"),
      diaper: 1 - smooth(1.5, 3, age), chest: 1 + 0.35 * smooth(1, 6, age),
      headK: 1 + HEAD_BIG * (1 - smooth(2, 15, age)),
      // 幼いほど手足と胴をふっくら見せる（見た目だけ）。
      fat: 1 + 0.3 * (1 - smooth(2, 12, age)),
      hairSize: age < 1 ? 0.45 : age < 6 ? 0.45 + 0.11 * (age - 1) : age > 75 ? 1 - Math.min(0.25, (age - 75) / 60) : 1
    };
  }

  // from に前の姿（各部位の位置と角度）を渡すと、dur 秒かけてそこから今の体へ移る。
  // 服と髪の色、ネクタイ・ランドセルは、毎コマ今の年齢に合わせる（作り直しを待たない）。
  function Figure(walker, scene, from, dur) {
    this.walker = walker;
    this.form = walker.form;
    this.from = from || null;
    this.dur = dur || 0;
    this.t = 0;
    this.paint = [];
    var baby = walker.form === "baby", L = looks(walker.age), c = walker.cfg, self = this, sc = walker.scale || 0.5;
    var legZ = baby ? 0.06 : 0.1 * sc, armZ = baby ? 0.08 : 0.2 * sc;
    this.L = L;
    this.root = new T.Group();
    scene.add(this.root);
    this.meshes = [];
    // 年齢で色が変わる材質。role は looks の名前、k は奥の手足を暗くする割合。
    this.mat = function (role, k, rough) {
      var m = mat(L[role].clone().multiplyScalar(k || 1), rough);
      self.paint.push({ m: m, role: role, k: k || 1 });
      return m;
    };
    Object.keys(walker.parts).forEach(function (name) {
      var b = walker.parts[name], g = new T.Group(), side = name.slice(-1), far = side === "L" && name !== "trunk";
      var z = 0;
      if (/^(arm|cane)/.test(name)) z = (side === "L" ? -1 : 1) * armZ;
      if (/^(thigh|shin|foot)/.test(name)) z = (side === "L" ? -1 : 1) * legZ;
      if (name === "cane") z = armZ + 0.03 * sc;
      var k = far ? 0.78 : 1;
      if (name === "trunk") self.trunk(g, b, L, c);
      else if (/^arm/.test(name)) {
        var fat = baby ? 1 : L.fat, up = capsule(b.r * 1.15 * fat, b.len * 0.45, self.mat("body", k));
        up.position.y = b.len * 0.22;
        var low = capsule(b.r * fat, b.len * 0.5, self.mat("lower", k));
        low.position.y = -b.len * 0.2;
        var hand = ball(b.r * 1.35 * fat, self.mat("skin", k));
        hand.position.y = -b.len / 2;
        g.add(up, low, hand);
      } else if (/^thigh/.test(name)) {
        g.add(capsule(b.r * (baby ? 1 : L.fat), b.len, self.mat("leg", k)));
      } else if (/^shin/.test(name)) {
        g.add(capsule(b.r * (baby ? 1 : 0.95 * L.fat), b.len, self.mat("shin", k)));
        if (baby) { var foot = ball(b.r * 1.3, self.mat("skin", k)); foot.position.y = -b.len / 2; foot.scale.set(1, 1.4, 1); g.add(foot); }
      } else if (/^foot/.test(name)) {
        var f = box(b.len, 0.07 * sc, 0.11 * sc, self.mat("shoe", k, 0.6));
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
    var fat = baby ? 1 : L.fat, torso = capsule(half * fat, len - half * 0.6, this.mat("body"));
    torso.scale.z = L.chest;
    g.add(torso);
    // ネクタイ（胸の前）とランドセル（背中）。年代で大きさを 0〜1 に変えて出し入れする。
    var tie = box(0.025 * sc, len * 0.42, 0.06 * sc, mat(0xc23b3b, 0.6));
    tie.position.set(half + 0.01 * sc, len * 0.12, 0);
    var pack = new T.Group(), bag = box(0.12 * sc, len * 0.5, half * 2.1, mat(0xc0282d, 0.5));
    bag.position.x = -0.06 * sc;
    pack.add(bag);
    pack.position.set(-half, len * 0.12, 0);
    g.add(tie, pack);
    this.tie = tie; this.pack = pack;
    if (L.diaper > 0.02) {
      // おむつのふくらみ。育つにつれて小さくなる。
      var diaper = ball(half * 1.15, mat(0xffffff));
      diaper.scale.setScalar(L.diaper);
      this.diaper = diaper;
      diaper.position.y = -len / 2 + half * 0.5;
      g.add(diaper);
    }
    var neck = capsule(0.045 * sc, 0.06 * sc, this.mat("skin"));
    neck.position.y = len / 2 + 0.02 * sc;
    if (!baby) g.add(neck);
    var head = new T.Group(), r = b.headR;
    head.position.y = b.headOffset;
    this.head = head;
    this.headBase = { y: b.headOffset, r: r };
    head.add(ball(r, this.mat("skin")));
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
    var ear = ball(r * 0.22, this.mat("skin"));
    ear.position.set(baby ? 0.02 : -0.01, baby ? 0 : 0.01, r * 0.95);
    head.add(ear);
    // 髪。赤ちゃんは頭頂に少し、大人は後頭部を覆う。
    var hair = new T.Mesh(new T.SphereGeometry(r * 1.06, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55 * L.hairSize), this.mat("hair", 1, 1));
    hair.castShadow = true;
    hair.rotation.z = baby ? 1.9 : 0.38;
    head.add(hair);
    g.add(head);
  };
  Figure.prototype.update = function (dt) {
    var from = this.from, e = 1, L = looks(this.walker.age);
    this.paint.forEach(function (p) { p.m.color.copy(L[p.role]).multiplyScalar(p.k); });
    function show(o, v) { if (!o) return; o.visible = v > 0.01; o.scale.setScalar(Math.max(0.01, v)); }
    show(this.tie, L.tie);
    show(this.pack, L.pack);
    show(this.diaper, L.diaper);
    if (from) {
      this.t += dt || 0;
      var u = Math.min(1, this.t / this.dur);
      e = u * u * (3 - 2 * u);
      if (u >= 1) this.from = null;
    }
    // ハイハイの顔は頭の先を向くので、起き上がる間に顔を前へ回す。
    if (this.head) {
      this.head.rotation.z = from && from.baby ? 1.16 * (1 - e) : 0;
      // 幼いほど頭を大きく見せる（当たりの大きさは変えない）。首に埋まらないよう、大きくしたぶん上へずらす。
      this.head.scale.setScalar(L.headK);
      this.head.position.y = this.headBase.y + (L.headK - 1) * this.headBase.r * 0.9;
    }
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


    this.figure = null;
    this.look = { x: 0, y: 0.3, d: 2.6, f: 0 };
    this.w = 540; this.h = 960;
  }

  // morph 秒かけて、前の体の姿から新しい体へ移る（0 ならすぐ入れ替える。false なら杖もすぐ出す）。
  Scene.prototype.setWalker = function (walker, morph) {
    var from = null;
    if (this.figure) {
      if (morph || (morph !== false && walker && walker.cane && !this.figure.walker.cane)) from = this.figure.pose();
      this.figure.dispose();
    }
    this.figure = walker ? new Figure(walker, this.scene, from, morph || 0.6) : null;
  };

  // 上り階段を置く（null で外す）。st = { x0, run, rise }。段は地面から積み上げた石の箱。
  Scene.prototype.setStairs = function (st) {
    if (this.stairs) {
      this.scene.remove(this.stairs);
      this.stairs.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      this.stairs = null;
    }
    this.stairInfo = st || null;
    if (!st) return;
    var g = new T.Group(), top = mat(0xd9d2c3, 0.9), side = mat(0xb8ae9c, 1);
    for (var i = 0; i < STAIR_COUNT; i++) {
      var h = (i + 1) * st.rise;
      var b = new T.Mesh(new T.BoxGeometry(st.run, h, 1.3), [side, side, top, side, side, side]);
      b.position.set(st.x0 + (i + 0.5) * st.run, h / 2, 0);
      b.castShadow = true;
      b.receiveShadow = true;
      g.add(b);
    }
    this.stairs = g;
    this.scene.add(g);
  };
  var STAIR_COUNT = 160;

  Scene.prototype.resize = function (w, h) {
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  // s = { x, floor, form, scale, progress, snap, dt }。floor は足もとの高さ（階段）。
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
    this.look.f += ((s.floor || 0) - this.look.f) * Math.min(1, s.snap ? 1 : a * 0.8);
    var L = this.look, tall = Math.max(0, Math.min(1, (H / W - 1.45) / 0.9));
    this.camera.fov = 44 + tall * 10;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(L.x + L.d * 0.32, L.f + L.y + L.d * 0.2, L.d);
    this.camera.lookAt(L.x + L.d * 0.08, L.f + L.y * 0.85, 0);
    // 太陽は左の低い所から昇り、真上を通って右へ沈む。
    var ang = Math.PI * (0.06 + 0.88 * s.progress);
    var dir = new T.Vector3(-Math.cos(ang), Math.sin(ang) * 0.9 + 0.08, -0.45).normalize();
    this.sunBall.position.set(L.x - Math.cos(ang) * 160, L.f + 6 + Math.sin(ang) * 90, -200);
    this.sun.target.position.set(L.x, L.f, 0);
    this.sun.position.set(L.x + dir.x * 20, L.f + Math.max(2, dir.y * 20), dir.z * 20 + 6);
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
  };

  return Scene;
})();
