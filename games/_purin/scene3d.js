/* 巨大プリンの見た目（three.js）。形は pudding.js の格子から、表面を網にして作る。
   ゲーム側が sync(状態) で、形の版・目の位置・揺れ・スプーン・崩れの進み具合を渡す。 */
(function (global) {
  "use strict";
  var T, Z3 = global.Z3;

  var CUSTARD = [0.93, 0.62, 0.17], CUSTARD_IN = [0.97, 0.74, 0.30];
  var CARAMEL = [0.20, 0.06, 0.01], CARAMEL_HI = [0.42, 0.15, 0.02];

  /* カラメルの深さ（向きによって垂れる） */
  function caramelDepth(x, z) {
    var a = Math.atan2(z, x);
    var d = 0.42 + 0.08 * Math.sin(a * 5 + 1.3);
    var drip = Math.pow(Math.max(0, Math.sin(a * 9 + 0.7)), 10) * 1.3 + Math.pow(Math.max(0, Math.sin(a * 13 + 2.1)), 16) * 0.8;
    return d + drip;
  }

  /* 表面の網を作る（naive surface nets）。keep(i,j,k) が false の点は空とみなす */
  function buildGeometry(F, keep) {
    var NX = F.NX, NY = F.NY, NZ = F.NZ, h = F.h, f = F.f;
    function val(i, j, k) { var v = f[i + NX * (j + NY * k)]; return keep && !keep(i, j, k) ? Math.max(v, h * 0.5) : v; }
    var cellV = new Int32Array((NX - 1) * (NY - 1) * (NZ - 1)).fill(-1);
    var pos = [], idx = [];
    var cv = new Float32Array(8);
    var E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    function cid(i, j, k) { return i + (NX - 1) * (j + (NY - 1) * k); }
    for (var k = 0; k < NZ - 1; k++) for (var j = 0; j < NY - 1; j++) for (var i = 0; i < NX - 1; i++) {
      var mask = 0;
      for (var c = 0; c < 8; c++) { var v = val(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1)); cv[c] = v; if (v < 0) mask |= 1 << c; }
      if (mask === 0 || mask === 255) continue;
      var sx = 0, sy = 0, sz = 0, cnt = 0;
      for (var e = 0; e < 12; e++) {
        var a = E[e][0], b = E[e][1], va = cv[a], vb = cv[b];
        if ((va < 0) === (vb < 0)) continue;
        var t = va / (va - vb);
        sx += (a & 1) + (((b & 1) - (a & 1)) * t);
        sy += ((a >> 1) & 1) + ((((b >> 1) & 1) - ((a >> 1) & 1)) * t);
        sz += ((a >> 2) & 1) + ((((b >> 2) & 1) - ((a >> 2) & 1)) * t);
        cnt++;
      }
      cellV[cid(i, j, k)] = pos.length / 3;
      pos.push(F.X0 + (i + sx / cnt) * h, F.Y0 + (j + sy / cnt) * h, F.Z0 + (k + sz / cnt) * h);
    }
    /* 符号が変わる辺ごとに、まわりの4つの箱の点で四角を張る */
    for (k = 1; k < NZ - 1; k++) for (j = 1; j < NY - 1; j++) for (i = 1; i < NX - 1; i++) {
      var v0 = val(i, j, k), in0 = v0 < 0;
      for (var ax = 0; ax < 3; ax++) {
        var i2 = i + (ax === 0), j2 = j + (ax === 1), k2 = k + (ax === 2);
        if (i2 >= NX || j2 >= NY || k2 >= NZ) continue;
        if (in0 === (val(i2, j2, k2) < 0)) continue;
        var q;
        if (ax === 0) q = [cid(i, j - 1, k - 1), cid(i, j, k - 1), cid(i, j, k), cid(i, j - 1, k)];
        else if (ax === 1) q = [cid(i - 1, j, k - 1), cid(i - 1, j, k), cid(i, j, k), cid(i, j, k - 1)];
        else q = [cid(i - 1, j - 1, k), cid(i, j - 1, k), cid(i, j, k), cid(i - 1, j, k)];
        var A = cellV[q[0]], B = cellV[q[1]], C = cellV[q[2]], D = cellV[q[3]];
        if (A < 0 || B < 0 || C < 0 || D < 0) continue;
        if (in0) idx.push(A, B, C, A, C, D); else idx.push(A, C, B, A, D, C);
      }
    }
    /* 向き（形の傾きから）と色 */
    var n = pos.length / 3, nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (var p = 0; p < n; p++) {
      var x = pos[p * 3], y = pos[p * 3 + 1], z = pos[p * 3 + 2];
      var g = F.grad(x, y, z), L = Math.sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) || 1;
      nor[p * 3] = g[0] / L; nor[p * 3 + 1] = g[1] / L; nor[p * 3 + 2] = g[2] / L;
      var cr = Math.max(0, Math.min(1, F.sample(x, y, z, F.car))), sk = Math.max(0, Math.min(1, F.sample(x, y, z, F.skin))), rc = [0, 0, 0];
      var sp = 0.03 * Math.sin(x * 31 + y * 17) * Math.sin(z * 23 - y * 11) * (1 - sk);
      for (var ci = 0; ci < 3; ci++) {
        var cu = CUSTARD_IN[ci] + (CUSTARD[ci] - CUSTARD_IN[ci]) * sk + sp;
        var ca = CARAMEL[ci] + (CARAMEL_HI[ci] - CARAMEL[ci]) * (1 - cr) * 1.5;
        var w = Math.min(1, cr * 2.2);
        rc[ci] = cu + (ca - cu) * w;
      }
      col[p * 3] = rc[0]; col[p * 3 + 1] = rc[1]; col[p * 3 + 2] = rc[2];
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new T.BufferAttribute(nor, 3));
    geo.setAttribute("color", new T.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return geo;
  }

  /* ぷるぷる揺れる材質（揺れは頂点の高さに比例して横にずらす） */
  function puddingMaterial(env) {
    var m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0, envMap: env, envMapIntensity: 0.7, emissive: new T.Color(0x3a1800), emissiveIntensity: 0.25 });
    var u = { uWob: { value: new T.Vector2() }, uH: { value: 3.6 }, uSquash: { value: 0 }, uBase: { value: 0 } };
    m.userData.u = u;
    m.onBeforeCompile = function (sh) {
      for (var key in u) sh.uniforms[key] = u[key];
      sh.vertexShader = "uniform vec2 uWob; uniform float uH; uniform float uSquash; uniform float uBase;\n" + sh.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\n float hh = clamp((transformed.y - uBase) / uH, 0.0, 1.6);\n float ww = pow(hh, 1.5);\n transformed.xz += uWob * ww * uH;\n transformed.y = uBase + (transformed.y - uBase) * (1.0 - uSquash * hh * 0.5);\n transformed.xz *= 1.0 + uSquash * 0.18 * (1.0 - hh * 0.5);");
    };
    return m;
  }

  function GameScene(F) {
    T = global.THREE;
    this.F = F;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 0.85 }, camera: { fov: 68, near: 0.05, far: 80 } });
    this.scene = st.scene;
    this.camera = st.camera;
    this.scene.background = new T.Color(0xe9dccb);
    this.scene.fog = new T.Fog(0xe9dccb, 14, 34);
    var L = Z3.lights(this.scene, { shadows: true, shadowSize: 8, scale: 1.0 });
    L.key.position.set(-5, 11, 6);

    /* 映り込み用の明るい部屋（窓の光） */
    var pm = new T.PMREMGenerator(st.renderer);
    var envScene = new T.Scene();
    envScene.background = new T.Color(0xcdbca6);
    var room = new T.Mesh(new T.SphereGeometry(10, 16, 8), new T.MeshBasicMaterial({ color: 0xa89480, side: T.BackSide }));
    envScene.add(room);
    var win = new T.Mesh(new T.PlaneGeometry(6, 4), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide }));
    win.position.set(-5, 6, 4); win.lookAt(0, 0, 0); envScene.add(win);
    var win2 = new T.Mesh(new T.PlaneGeometry(8, 1.2), new T.MeshBasicMaterial({ color: 0xfff1dc, side: T.DoubleSide }));
    win2.position.set(4, 7, -3); win2.lookAt(0, 0, 0); envScene.add(win2);
    var flr = new T.Mesh(new T.PlaneGeometry(20, 20), new T.MeshBasicMaterial({ color: 0x6a4c34 }));
    flr.rotation.x = -Math.PI / 2; flr.position.y = -3; envScene.add(flr);
    this.env = pm.fromScene(envScene, 0.02).texture;

    /* 机（木目） */
    var wood = Z3.canvasTex(512, 512, function (g, w, hh) {
      g.fillStyle = "#9b6a43"; g.fillRect(0, 0, w, hh);
      var r = Z3.rng(5);
      for (var i = 0; i < 140; i++) {
        var y = r() * hh; g.strokeStyle = "rgba(" + (60 + r() * 40 | 0) + "," + (35 + r() * 20 | 0) + ",15," + (0.08 + r() * 0.15) + ")";
        g.lineWidth = 1 + r() * 4; g.beginPath(); g.moveTo(0, y);
        for (var x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 4);
        g.stroke();
      }
    }, 6);
    var table = new T.Mesh(new T.CircleGeometry(30, 48), new T.MeshStandardMaterial({ map: wood, roughness: 0.6 }));
    table.rotation.x = -Math.PI / 2; table.position.y = -0.09; table.receiveShadow = true;
    this.scene.add(table);

    /* 皿 */
    var plateM = new T.MeshStandardMaterial({ color: 0xf8f6f2, roughness: 0.12, envMap: this.env, envMapIntensity: 1.0 });
    var plate = new T.Mesh(new T.CylinderGeometry(4.7, 4.3, 0.09, 64), plateM);
    plate.position.y = -0.045; plate.receiveShadow = true; this.scene.add(plate);
    var rim = new T.Mesh(new T.TorusGeometry(4.75, 0.12, 10, 64), plateM);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.03; rim.receiveShadow = true; this.scene.add(rim);
    var rimLine = new T.Mesh(new T.TorusGeometry(4.55, 0.025, 6, 64), new T.MeshStandardMaterial({ color: 0x3f6fb5, roughness: 0.3 }));
    rimLine.rotation.x = Math.PI / 2; rimLine.position.y = 0.01; this.scene.add(rimLine);

    /* プリン */
    this.mat = puddingMaterial(this.env);
    this.mesh = new T.Mesh(new T.BufferGeometry(), this.mat);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
    this.ver = -1;
    this.parts = null;

    /* 食べる人（三人称で後ろから見る）。前は +z 向き */
    var skin = Z3.std(0xf2c39b, { roughness: 0.6 }), shirt = Z3.std(0xe0453a, { roughness: 0.6 }), pants = Z3.std(0x2f4f86, { roughness: 0.7 });
    var hair = Z3.std(0x2a1d16, { roughness: 0.8 }), shoe = Z3.std(0x3a2a22, { roughness: 0.7 }), black = new T.MeshBasicMaterial({ color: 0x1a1210 });
    var hero = this.hero = new T.Group();
    function part(geo, mat, x, y, z, parent) { var m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (parent || hero).add(m); return m; }
    var torso = part(new T.CapsuleGeometry(0.22, 0.38, 6, 12), shirt, 0, 1.08, 0);
    torso.scale.set(1, 1, 0.78);
    var head = this.head = new T.Group(); head.position.set(0, 1.55, 0); hero.add(head);
    part(new T.SphereGeometry(0.2, 18, 14), skin, 0, 0, 0, head);
    var hr = part(new T.SphereGeometry(0.212, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.02, -0.015, head); hr.rotation.x = -0.25;
    part(new T.SphereGeometry(0.026, 8, 6), black, -0.07, 0.01, 0.185, head);
    part(new T.SphereGeometry(0.026, 8, 6), black, 0.07, 0.01, 0.185, head);
    this.mouth = part(new T.SphereGeometry(0.03, 8, 6), new T.MeshBasicMaterial({ color: 0x7a2a22 }), 0, -0.08, 0.18, head);
    this.mouth.scale.set(1.3, 0.5, 0.5);
    /* 脚と腕は付け根で回す */
    var self = this;
    function limb(x, y, len, rad, mat, footMat) {
      var g = new T.Group(); g.position.set(x, y, 0); hero.add(g);
      part(new T.CapsuleGeometry(rad, len, 4, 8), mat, 0, -len / 2 - rad * 0.5, 0, g);
      if (footMat) { var f = part(new T.BoxGeometry(0.13, 0.08, 0.22), footMat, 0, -len - rad - 0.02, 0.04, g); }
      else part(new T.SphereGeometry(rad * 1.25, 8, 6), skin, 0, -len - rad, 0, g);
      return g;
    }
    this.legL = limb(-0.11, 0.72, 0.5, 0.085, pants, shoe);
    this.legR = limb(0.11, 0.72, 0.5, 0.085, pants, shoe);
    this.armL = limb(0.29, 1.32, 0.42, 0.065, shirt);
    this.armR = limb(-0.29, 1.32, 0.42, 0.065, shirt);
    this.scene.add(hero);

    /* 右手に大きい銀のスプーン */
    var metal = new T.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.18, envMap: this.env, envMapIntensity: 1.4 });
    var spoon = this.spoon = new T.Group();
    var bowl = new T.Mesh(new T.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), metal); bowl.material.side = T.DoubleSide;
    bowl.scale.set(0.12, 0.05, 0.17); bowl.position.set(0, 0, 0.62); bowl.castShadow = true;
    spoon.add(bowl);
    var handle = new T.Mesh(new T.BoxGeometry(0.045, 0.018, 0.5), metal);
    handle.position.set(0, 0.02, 0.22); handle.castShadow = true; spoon.add(handle);
    this.blob = new T.Mesh(new T.SphereGeometry(1, 16, 10), new T.MeshStandardMaterial({ color: 0xf7cd63, roughness: 0.2, envMap: this.env, emissive: 0x3a2200, emissiveIntensity: 0.3 }));
    this.blob.scale.set(0.1, 0.065, 0.13); this.blob.position.set(0, 0.01, 0.62);
    this.blob.visible = false;
    spoon.add(this.blob);
    this.blobTop = new T.Mesh(new T.SphereGeometry(1.02, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), new T.MeshStandardMaterial({ color: 0x5e2a08, roughness: 0.2, envMap: this.env }));
    this.blob.add(this.blobTop); this.blobTop.visible = false;
    /* 手の先（腕の下端）に持たせる */
    spoon.position.set(0, -0.56, 0.02);
    spoon.rotation.x = Math.PI / 2;
    this.armR.add(spoon);
  }

  GameScene.prototype.rebuild = function () {
    this.mesh.geometry.dispose();
    this.mesh.geometry = buildGeometry(this.F, null);
    this.ver = this.F.ver;
  };

  /* 崩れ始めたら、上と下に分ける */
  GameScene.prototype.split = function (col) {
    var F = this.F, up = col.plan.up;
    var upMat = puddingMaterial(this.env);
    var upM = new T.Mesh(buildGeometry(F, function (i, j, k) { return !!up[F.idx(i, j, k)]; }), upMat);
    var low = new T.Mesh(buildGeometry(F, function (i, j, k) { return !up[F.idx(i, j, k)]; }), this.mat);
    upM.castShadow = upM.receiveShadow = low.castShadow = low.receiveShadow = true;
    upM.matrixAutoUpdate = false;
    this.scene.remove(this.mesh);
    this.scene.add(upM); this.scene.add(low);
    this.parts = { up: upM, low: low, col: col };
  };

  /* 倒れる・落ちる・つぶれるを1つの行列に（pudding の bake と同じ順） */
  var _m = null;
  function poseMatrix(pl, po, out) {
    var M = new T.Matrix4(), A = new T.Matrix4();
    var pv = pl.pivot;
    M.makeTranslation(-pv[0], -pv[1], -pv[2]);
    A.makeRotationAxis(new T.Vector3(pl.ax[0], pl.ax[1], pl.ax[2]), po.ang); M.premultiply(A);
    A.makeTranslation(pv[0], pv[1] - po.drop, pv[2]); M.premultiply(A);
    A.makeTranslation(-pl.cx, -pl.base, -pl.cz); M.premultiply(A);
    A.makeScale(po.sxz, po.sy, po.sxz); M.premultiply(A);
    A.makeTranslation(pl.cx, pl.base, pl.cz); M.premultiply(A);
    out.copy(M);
  }

  GameScene.prototype.reset = function () {
    if (this.parts) {
      this.scene.remove(this.parts.up); this.scene.remove(this.parts.low);
      this.parts.up.geometry.dispose(); this.parts.low.geometry.dispose(); this.parts.up.material.dispose();
      this.parts = null;
      this.scene.add(this.mesh);
    }
    this.ver = -1;
  };

  /* s: { me:[x,y,z], face, moving, yaw, pitch, wob:[x,z], squash, spoon:{ t, phase, blob }, collapse:{ c, t }, shake } */
  GameScene.prototype.sync = function (s) {
    if (s.collapse && (!this.parts || this.parts.col !== s.collapse)) { if (this.parts) this.reset(); this.split(s.collapse); }
    if (!s.collapse && this.parts) this.reset();
    if (!this.parts && this.ver !== this.F.ver) this.rebuild();
    var u = this.mat.userData.u;
    u.uWob.value.set(s.wob[0], s.wob[1]);
    u.uSquash.value = s.squash || 0;
    u.uBase.value = 0;

    /* 人 */
    var hero = this.hero, k = s.spoon || { phase: 0 }, wk = s.walk || 0, mv = s.moving || 0;
    hero.position.set(s.me[0], 0, s.me[2]);
    hero.rotation.y = s.face;
    var sw = Math.sin(wk * 9) * 0.7 * mv;
    this.legL.rotation.x = sw; this.legR.rotation.x = -sw;
    this.armL.rotation.x = -sw * 0.8;
    hero.position.y = Math.abs(Math.cos(wk * 9)) * 0.05 * mv;
    /* 右腕：ふだんは前に構える。食べるときは口へ運ぶ */
    var lift = k.phase === 3 ? Math.sin(k.t * Math.PI) : 0;
    this.armR.rotation.set(-0.9 - 1.3 * lift + sw * 0.2 * (1 - lift), 0, 0.15 * lift);
    this.armR.position.x = -0.29 + 0.08 * lift;
    this.mouth.scale.set(1.3, 0.5 + 1.4 * lift, 0.5);
    this.head.rotation.x = -0.1 * lift;
    this.blob.visible = !!k.blob;
    this.blobTop.visible = !!k.blob && !!k.caramel;

    /* カメラ：人の後ろ上から。プリンに埋まらないよう手前に寄せる */
    var cam = this.camera, sh = s.shake || 0;
    var tx = s.me[0], ty = 1.5, tz = s.me[2];
    var el = Math.max(-0.35, Math.min(1.25, 0.32 - s.pitch));
    var dist = 3.4, dx = Math.sin(s.yaw) * Math.cos(el), dy = Math.sin(el), dz = Math.cos(s.yaw) * Math.cos(el);
    var d = 0.4;
    while (d < dist) {
      var px = tx + dx * (d + 0.15), py = ty + dy * (d + 0.15), pz = tz + dz * (d + 0.15);
      if (py < 0.25 || this.F.sample(px, py, pz) < 0.12) break;
      d += 0.1;
    }
    cam.position.set(tx + dx * d + (Math.random() - 0.5) * sh, Math.max(0.25, ty + dy * d) + (Math.random() - 0.5) * sh, tz + dz * d + (Math.random() - 0.5) * sh);
    cam.lookAt(tx, ty + 0.15, tz);
    hero.visible = d > 0.7;

    /* 崩れ */
    if (this.parts) {
      poseMatrix(s.collapse.plan, s.collapse.pose, this.parts.up.matrix);
      this.parts.up.matrixWorldNeedsUpdate = true;
      this.parts.up.material.userData.u.uWob.value.set(0, 0);
    }
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
