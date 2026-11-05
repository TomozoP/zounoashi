/* 名字の水族館の立体（three.js）。games/three-base.js の Z3 を土台にする。
   通路（奥へ -z）の左右に水槽が並び、突き当たりが大水槽。名字の魚が泳ぐ。
   並び（どの水槽に何がいるか）は MYOUJI_LAYOUT で決め、ゲーム側も同じものを使う。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;

  /* ============ 並び ============ */
  var THEMES = "田 藤 山 川 木 野 井 本 村 島 原 中 小 大 上 石 松 谷 岡 森 沢 宮 西 高 崎 部 口 下 内 江 浜 水 池 鳥".split(" ");
  var HALL = 2.0;                               /* 通路の半分の幅 */
  var DEPTH = 4.2;                              /* 水槽の奥行き */
  var TOP = 3.9;                                /* 水槽の天井 */
  var GIANT = 10;
  var ROOM = 5.2;                               /* 大水槽の部屋の半分の幅 */                               /* 大水槽に入る、人数の多い名字の数 */

  function layout() {
    var seen = {}, list = [];
    (global.MYOUJI || []).forEach(function (s) {
      var p = s.split(":");
      if (!p[0] || !p[1] || seen[p[0]]) return;
      seen[p[0]] = 1;
      list.push({ name: p[0], yomi: p[1], rank: list.length });
    });
    var groups = {}, other = [], giant = [];
    list.forEach(function (f) {
      if (f.rank < GIANT) { giant.push(f); return; }
      for (var i = 0; i < THEMES.length; i++) {
        if (f.name.indexOf(THEMES[i]) >= 0) { (groups[THEMES[i]] = groups[THEMES[i]] || []).push(f); return; }
      }
      other.push(f);
    });
    var tanks = [];
    THEMES.forEach(function (k) {
      var g = groups[k];
      if (!g) return;
      if (g.length < 8) { other = other.concat(g); return; }
      var parts = Math.ceil(g.length / 80);
      for (var p = 0; p < parts; p++) {
        var sub = g.slice(Math.floor(g.length * p / parts), Math.floor(g.length * (p + 1) / parts));
        tanks.push({ label: "「" + k + "」の水槽" + (parts > 1 ? " " + (p + 1) : ""), fish: sub });
      }
    });
    other.sort(function (a, b) { return a.rank - b.rank; });
    var parts2 = Math.ceil(other.length / 80);
    for (var q = 0; q < parts2; q++) {
      tanks.push({ label: "いろいろな名字の水槽" + (parts2 > 1 ? " " + (q + 1) : ""), fish: other.slice(Math.floor(other.length * q / parts2), Math.floor(other.length * (q + 1) / parts2)) });
    }
    /* 左右に交互に詰める。長さは魚の数に合わせる */
    var zL = -1.5, zR = -1.5, GAP = 0.6;
    tanks.forEach(function (t, i) {
      var len = Math.max(4.5, Math.min(11, t.fish.length / 7.5));
      t.side = zL >= zR ? -1 : 1;                /* 奥まで進んでいないほうに足す */
      if (t.side < 0) { t.z0 = zL; zL -= len + GAP; } else { t.z0 = zR; zR -= len + GAP; }
      t.z1 = t.z0 - len;
      t.len = len;
    });
    var end = Math.min(zL, zR) - 0.4;
    /* 長いほうに合わせて短い側の最後の水槽を伸ばす */
    tanks.forEach(function (t) {
      var last = true;
      tanks.forEach(function (u) { if (u.side === t.side && u.z1 < t.z1) last = false; });
      if (last) { t.z1 = end + 0.4 - GAP; t.len = t.z0 - t.z1; }
    });
    var exitZ = end - 3, giantZ = end - 7;
    return { list: list, tanks: tanks, giant: giant, end: end, exitZ: exitZ, giantZ: giantZ, hall: HALL, room: ROOM, depth: DEPTH, top: TOP };
  }
  global.MYOUJI_LAYOUT = layout;

  /* ============ 絵 ============ */
  var CELL_W = 160, CELL_H = 48, ATLAS = 2048;
  var PER_ROW = Math.floor(ATLAS / CELL_W), PER_ATLAS = PER_ROW * Math.floor(ATLAS / CELL_H);
  var COLORS = [0xff7a59, 0xffb347, 0xffd166, 0x5ec8e5, 0x7bd389, 0xf28dc4, 0xa78bfa, 0x4f9dff, 0xff5d73, 0x2ec4b6, 0xf4a261, 0xe9c46a];

  function fishShape() {
    var s = new T.Shape();
    /* 頭を +x に。体はだ円、後ろに尾びれ */
    s.moveTo(0.62, 0);
    s.bezierCurveTo(0.6, 0.3, 0.2, 0.36, -0.15, 0.3);
    s.bezierCurveTo(-0.35, 0.26, -0.45, 0.12, -0.52, 0.04);
    s.lineTo(-0.82, 0.3);
    s.lineTo(-0.76, 0);
    s.lineTo(-0.82, -0.3);
    s.lineTo(-0.52, -0.04);
    s.bezierCurveTo(-0.45, -0.12, -0.35, -0.26, -0.15, -0.3);
    s.bezierCurveTo(0.2, -0.36, 0.6, -0.3, 0.62, 0);
    return new T.ShapeGeometry(s, 10);
  }

  function GameScene() {
    T = global.THREE;
    var st = this.stage = new Z3.Stage({ renderer: { tone: "linear" }, camera: { fov: 62, near: 0.1, far: 80 }, finish: { contrast: 0.1, vignette: 0.45, grain: 0.02 } });
    this.scene = st.scene;
    this.camera = st.camera;
    this.camera.rotation.order = "YXZ";
    this.scene.background = new T.Color(0x04101e);
    this.scene.fog = new T.Fog(0x05182c, 5, 30);
    var L = this.L = layout();
    this.buildRoom(L);
    this.buildFish(L);
  }

  GameScene.prototype.buildRoom = function (L) {
    var sc = this.scene, len = -L.giantZ + 4;
    var dark = new T.MeshBasicMaterial({ color: 0x0b1626 });
    /* 通路の床と天井 */
    var floorTex = Z3.canvasTex(64, 64, function (g, w, h) {
      g.fillStyle = "#13202f"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#18283a"; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
    });
    floorTex.wrapS = floorTex.wrapT = T.RepeatWrapping; floorTex.repeat.set(L.room, len / 2);
    var floor = new T.Mesh(new T.PlaneGeometry(L.room * 2, len), new T.MeshBasicMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 2 - len / 2);
    sc.add(floor);
    var ceil = new T.Mesh(new T.PlaneGeometry(L.room * 2 + 0.4, len), dark);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, L.top + 0.3, 2 - len / 2);
    sc.add(ceil);
    /* 入口の壁 */
    var back = new T.Mesh(new T.PlaneGeometry(L.hall * 2, L.top + 0.3), dark);
    back.position.set(0, (L.top + 0.3) / 2, 2); back.rotation.y = Math.PI;
    sc.add(back);

    var water = Z3.canvasTex(8, 256, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#5fd0ff"); gr.addColorStop(0.35, "#1677b8"); gr.addColorStop(1, "#06305a");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    var sand = Z3.canvasTex(128, 128, function (g, w, h) {
      g.fillStyle = "#c9b48a"; g.fillRect(0, 0, w, h);
      var r = Z3.rng(3);
      for (var i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? "#b49d72" : "#ddc9a0"; g.fillRect(r() * w, r() * h, 2, 2); }
    }, 1);
    sand.wrapS = sand.wrapT = T.RepeatWrapping;
    var waterMat = new T.MeshBasicMaterial({ map: water, fog: false });
    var glassMat = new T.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.08, depthWrite: false });
    var pillarMat = new T.MeshBasicMaterial({ color: 0x0e1c2e });
    var weedMat = new T.MeshBasicMaterial({ color: 0x2f8f5b, side: T.DoubleSide });
    var rnd = Z3.rng(11), self = this;
    this.signs = [];

    function tankBox(cx, cz, w, d, rotY, label) {
      /* w: ガラス面の幅、d: 奥行き。ガラス面が原点側、奥が +d 方向（rotY で向きを変える） */
      var g = new T.Group();
      g.position.set(cx, 0, cz); g.rotation.y = rotY;
      var backW = new T.Mesh(new T.PlaneGeometry(w, L.top), waterMat);
      backW.position.set(0, L.top / 2, -d); g.add(backW);
      [-1, 1].forEach(function (s) {
        var side = new T.Mesh(new T.PlaneGeometry(d, L.top), waterMat);
        side.rotation.y = -s * Math.PI / 2; side.position.set(s * w / 2, L.top / 2, -d / 2); g.add(side);
      });
      var top = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ color: 0x8fe3ff, fog: false }));
      top.rotation.x = Math.PI / 2; top.position.set(0, L.top, -d / 2); g.add(top);
      var sm = new T.MeshBasicMaterial({ map: sand.clone() });
      sm.map.needsUpdate = true; sm.map.repeat.set(w / 2, d / 2);
      var bottom = new T.Mesh(new T.PlaneGeometry(w, d), sm);
      bottom.rotation.x = -Math.PI / 2; bottom.position.set(0, 0.25, -d / 2); g.add(bottom);
      /* 水草 */
      for (var i = 0; i < Math.round(w * 1.2); i++) {
        var hgt = 0.6 + rnd() * 1.4;
        var weed = new T.Mesh(new T.PlaneGeometry(0.18, hgt), weedMat);
        weed.position.set((rnd() - 0.5) * (w - 0.4), 0.25 + hgt / 2, -0.4 - rnd() * (d - 0.8));
        weed.rotation.y = rnd() * Math.PI;
        g.add(weed);
      }
      /* ガラス（うすく色をつける）と、上下の縁 */
      var glass = new T.Mesh(new T.PlaneGeometry(w, L.top), glassMat);
      glass.position.set(0, L.top / 2, 0); g.add(glass);
      var lip = new T.Mesh(new T.BoxGeometry(w + 0.3, 0.3, 0.2), pillarMat); lip.position.set(0, 0.15, 0.05); g.add(lip);
      var lip2 = new T.Mesh(new T.BoxGeometry(w + 0.3, 0.45, 0.2), pillarMat); lip2.position.set(0, L.top + 0.1, 0.05); g.add(lip2);
      [-1, 1].forEach(function (s) {
        var p = new T.Mesh(new T.BoxGeometry(0.3, L.top + 0.4, 0.3), pillarMat); p.position.set(s * (w / 2 + 0.15), (L.top + 0.4) / 2, 0.05); g.add(p);
      });
      if (label) {
        var tex = Z3.canvasTex(512, 64, function (c, cw, ch) {
          c.fillStyle = "#0e1c2e"; c.fillRect(0, 0, cw, ch);
          c.fillStyle = "#e8f6ff"; c.font = "800 40px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
          c.fillText(label, cw / 2, ch / 2 + 2);
        });
        var sign = new T.Mesh(new T.PlaneGeometry(2.6, 0.325), new T.MeshBasicMaterial({ map: tex }));
        sign.position.set(0, L.top + 0.1, 0.17); g.add(sign);
      }
      sc.add(g);
      return g;
    }
    L.tanks.forEach(function (t) {
      var cz = (t.z0 + t.z1) / 2;
      /* 右（+x）の水槽はガラスが -x を向く。左は +x を向く */
      tankBox(t.side * L.hall, cz, t.len, L.depth, t.side > 0 ? -Math.PI / 2 : Math.PI / 2, t.label);
    });
    /* 大水槽の部屋：通路より広い。左右の壁と、通路から広がるところの壁 */
    var roomLen = L.end - L.giantZ;
    [-1, 1].forEach(function (s) {
      var w = new T.Mesh(new T.PlaneGeometry(roomLen + 0.4, L.top + 0.3), dark);
      w.rotation.y = -s * Math.PI / 2; w.position.set(s * L.room, (L.top + 0.3) / 2, (L.end + L.giantZ) / 2);
      sc.add(w);
      var f = new T.Mesh(new T.PlaneGeometry(L.room - L.hall, L.top + 0.3), dark);
      f.position.set(s * (L.hall + L.room) / 2, (L.top + 0.3) / 2, L.end);
      sc.add(f);
    });
    tankBox(0, L.giantZ, L.room * 2, 6, 0, "大水槽");
    /* 出口（大水槽の手前、右の壁） */
    var exitTex = Z3.canvasTex(256, 128, function (c, cw, ch) {
      c.fillStyle = "#1f8f4e"; c.fillRect(0, 0, cw, ch);
      c.fillStyle = "#fff"; c.font = "900 64px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("出口", cw / 2, ch / 2 + 4);
    });
    var door = new T.Mesh(new T.PlaneGeometry(1.4, 2.4), new T.MeshBasicMaterial({ color: 0xf2f5f0 }));
    door.rotation.y = -Math.PI / 2; door.position.set(L.room - 0.01, 1.2, L.exitZ); sc.add(door);
    var exitSign = new T.Mesh(new T.PlaneGeometry(1.0, 0.5), new T.MeshBasicMaterial({ map: exitTex, fog: false }));
    exitSign.rotation.y = -Math.PI / 2; exitSign.position.set(L.room - 0.02, 2.8, L.exitZ); sc.add(exitSign);
  };

  GameScene.prototype.buildFish = function (L) {
    var all = this.fish = [];
    var rnd = Z3.rng(7);
    function size(rank) {
      if (rank < 3) return 2.3;
      if (rank < GIANT) return 1.8;
      if (rank < 40) return 1.15;
      if (rank < 150) return 0.95;
      if (rank < 400) return 0.8;
      return 0.6;
    }
    L.tanks.forEach(function (t) {
      t.fish.forEach(function (f) {
        var s = size(f.rank);
        all.push({
          f: f, s: s, tank: t,
          /* 右の水槽: ガラス x=+hall、奥 +x。左は逆 */
          x: t.side * (L.hall + 0.5 + rnd() * (L.depth - 1.1)),
          y: 0.6 + s * 0.3 + rnd() * (L.top - 1.2 - s * 0.5),
          zc: (t.z0 + t.z1) / 2,
          amp: Math.max(0.2, t.len / 2 - 0.4 - s * 0.6) * (0.5 + rnd() * 0.5),
          w: (0.12 + rnd() * 0.18) / Math.sqrt(s), ph: rnd() * Math.PI * 2, bob: rnd() * 6,
          rotY: t.side > 0 ? -Math.PI / 2 : Math.PI / 2, giant: false
        });
      });
    });
    L.giant.forEach(function (f, i) {
      var s = size(f.rank);
      all.push({
        f: f, s: s, giant: true,
        z: L.giantZ - 1.0 - rnd() * 4.2,
        y: 0.9 + s * 0.25 + (i % 5) / 5 * (L.top - 1.6 - s * 0.4),
        xc: 0, amp: L.room - 0.6 - s * 0.9,
        w: (0.1 + rnd() * 0.08), ph: rnd() * Math.PI * 2, bob: rnd() * 6, rotY: 0
      });
    });
    this.byName = {};
    var self = this;
    all.forEach(function (o, i) { o.i = i; self.byName[o.f.name] = o; o.pos = new T.Vector3(); o.dir = 1; });

    /* 魚の形はなし。名字の文字そのものが泳ぐ（文字に色をつける） */
    var n = all.length;
    var col = new T.Color();

    /* 名前の文字は、何枚かの大きな絵にまとめて貼る */
    this.texts = [];
    for (var a = 0; a * PER_ATLAS < n; a++) {
      var chunk = all.slice(a * PER_ATLAS, (a + 1) * PER_ATLAS);
      var tex = Z3.canvasTex(ATLAS, ATLAS, function (g) {
        g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
        chunk.forEach(function (o, k) {
          var cx = (k % PER_ROW) * CELL_W + CELL_W / 2, cy = Math.floor(k / PER_ROW) * CELL_H + CELL_H / 2;
          var fs = 38;
          g.font = "900 " + fs + "px sans-serif";
          var tw = g.measureText(o.f.name).width;
          g.save(); g.translate(cx, cy + 2);
          if (tw > CELL_W - 22) g.scale((CELL_W - 22) / tw, 1);
          g.lineWidth = 8; g.strokeStyle = "rgba(10,20,40,.9)"; g.strokeText(o.f.name, 0, 0);
          g.fillStyle = "#fff"; g.fillText(o.f.name, 0, 0);
          g.restore();
        });
      });
      tex.anisotropy = 4;
      var geo = new T.PlaneGeometry(1, 1);
      var off = new Float32Array(chunk.length * 2);
      chunk.forEach(function (o, k) { off[k * 2] = (k % PER_ROW) * CELL_W / ATLAS; off[k * 2 + 1] = 1 - (Math.floor(k / PER_ROW) + 1) * CELL_H / ATLAS; });
      geo.setAttribute("cell", new T.InstancedBufferAttribute(off, 2));
      var mat = new T.MeshBasicMaterial({ map: tex, alphaTest: 0.35, side: T.DoubleSide });
      (function (mat) {
        mat.onBeforeCompile = function (sh) {
          sh.vertexShader = sh.vertexShader
            .replace("#include <common>", "#include <common>\nattribute vec2 cell;")
            .replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = cell + uv * vec2(" + (CELL_W / ATLAS).toFixed(6) + ", " + (CELL_H / ATLAS).toFixed(6) + ");");
        };
      })(mat);
      var im = new T.InstancedMesh(geo, mat, chunk.length);
      chunk.forEach(function (o, k) { col.setHex(COLORS[(o.f.rank * 7 + 3) % COLORS.length]); im.setColorAt(k, col); });
      im.frustumCulled = false;
      im.base = a * PER_ATLAS;
      this.scene.add(im);
      this.texts.push(im);
    }
    this.dummy = new T.Object3D();
  };

  GameScene.prototype.reset = function () {};

  /* s: { t, cam: {x, z, yaw, pitch}, found: {名前:1} } */
  GameScene.prototype.sync = function (s) {
    var t = s.t, c = s.cam, cam = this.camera, d = this.dummy;
    cam.position.set(c.x, 1.55, c.z);
    cam.rotation.set(c.pitch || 0, c.yaw, 0);
    var all = this.fish;
    for (var i = 0; i < all.length; i++) {
      var o = all[i];
      var a = o.ph + t * o.w, sv = Math.sin(a), cv = Math.cos(a);
      var y = o.y + Math.sin(t * 0.9 + o.bob) * 0.12;
      var dir = cv >= 0 ? 1 : -1;
      if (o.giant) o.pos.set(o.xc + sv * o.amp, y, o.z);
      else o.pos.set(o.x, y, o.zc + sv * o.amp * (o.tank.side > 0 ? 1 : -1));
      /* 文字：裏返さない。泳ぐ向きに少し傾けて、ゆらゆらさせる */
      d.position.copy(o.pos);
      d.rotation.set(0, o.rotY, Math.sin(t * 3 + o.bob) * 0.07 + (o.giant ? 0 : 0));
      var sw = 1 + Math.sin(t * 4 + o.bob) * 0.04;
      d.scale.set(o.s * 1.9 * sw, o.s * 1.9 / sw * CELL_H / CELL_W, 1);
      d.updateMatrix();
      var im = this.texts[Math.floor(i / PER_ATLAS)];
      im.setMatrixAt(i - im.base, d.matrix);
    }
    this.texts.forEach(function (im) { im.instanceMatrix.needsUpdate = true; });
  };

  /* 画面の (x, y) にいちばん近い魚。いなければ null */
  GameScene.prototype.pick = function (x, y, W, H) {
    var cam = this.camera, v = new T.Vector3(), best = null, bd = 1e9;
    cam.updateMatrixWorld();
    var fwd = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    for (var i = 0; i < this.fish.length; i++) {
      var o = this.fish[i];
      v.copy(o.pos).sub(cam.position);
      var dist = v.length();
      if (dist > 16 || v.dot(fwd) <= 0.3) continue;
      v.copy(o.pos).project(cam);
      var sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
      var r = Math.max(26, o.s * 0.75 / dist * H * 0.9);
      var dd = Math.hypot(sx - x, sy - y);
      if (dd < r && dd / r + dist * 0.02 < bd) { bd = dd / r + dist * 0.02; best = o; }
    }
    return best;
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
