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
  /* カメラと人の間にあるプリンは、筒の形にくり抜いて見えなくする（全部の材質で共有） */
  var CUT = null;
  function puddingMaterial(env) {
    if (!CUT) CUT = { uCam: { value: new T.Vector3() }, uHero: { value: new T.Vector3() }, uCutR: { value: 0.9 } };
    var m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0, envMap: env, envMapIntensity: 0.7, emissive: new T.Color(0x3a1800), emissiveIntensity: 0.25 });
    var u = { uWob: { value: new T.Vector2() }, uH: { value: 3.6 }, uSquash: { value: 0 }, uBase: { value: 0 } };
    m.userData.u = u;
    m.onBeforeCompile = function (sh) {
      for (var key in u) sh.uniforms[key] = u[key];
      for (var key2 in CUT) sh.uniforms[key2] = CUT[key2];
      sh.vertexShader = "varying vec3 vCutP;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n vCutP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = "uniform vec3 uCam; uniform vec3 uHero; uniform float uCutR; varying vec3 vCutP;\n" + sh.fragmentShader.replace("void main() {",
        "void main() {\n vec3 cutD = uHero - uCam; float cutL = length(cutD); vec3 cutN = cutD / max(cutL, 1e-4);\n float cutT = dot(vCutP - uCam, cutN);\n if (cutT > 0.0 && cutT < cutL - 0.15) {\n  float cutR = length(vCutP - uCam - cutN * cutT);\n  float rr = uCutR * (0.55 + 0.45 * cutT / cutL);\n  float dith = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);\n  if (cutR < rr - 0.06 * dith) discard;\n }");
      sh.vertexShader = "uniform vec2 uWob; uniform float uH; uniform float uSquash; uniform float uBase;\n" + sh.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\n float hh = clamp((transformed.y - uBase) / uH, 0.0, 1.6);\n float ww = pow(hh, 1.5);\n transformed.xz += uWob * ww * uH;\n transformed.y = uBase + (transformed.y - uBase) * (1.0 - uSquash * hh * 0.5);\n transformed.xz *= 1.0 + uSquash * 0.18 * (1.0 - hh * 0.5);");
    };
    return m;
  }

  function GameScene(F) {
    T = global.THREE;
    this.F = F;
    var st = this.stage = new Z3.Stage({ renderer: { shadows: true, tone: "aces", exposure: 0.85 }, camera: { fov: 80, near: 0.03, far: 80 } });
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
    this.cheekL = part(new T.SphereGeometry(0.075, 10, 8), skin, -0.11, -0.06, 0.12, head);
    this.cheekR = part(new T.SphereGeometry(0.075, 10, 8), skin, 0.11, -0.06, 0.12, head);
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
    spoon.scale.setScalar(1.4);
    spoon.position.set(0, -0.56, 0.02);
    spoon.rotation.x = Math.PI / 2;
    this.armR.add(spoon);
    var spoon2 = this.spoon2 = spoon.clone();
    this.blob2 = spoon2.children[2]; this.blobTop2 = this.blob2.children[0];
    this.armL.add(spoon2);

    /* 一人称の腕（画面の下から前へ伸ばす。両手にスプーン） */
    this.scene.add(this.camera);
    this.fp = [];
    for (var sd = -1; sd <= 1; sd += 2) {
      var g = new T.Group();
      var sleeve = new T.Mesh(new T.CapsuleGeometry(0.026, 0.32, 4, 10), shirt); sleeve.rotation.x = Math.PI / 2; sleeve.position.z = -0.12; g.add(sleeve);
      var hand = new T.Mesh(new T.SphereGeometry(0.032, 12, 10), skin); hand.position.z = -0.32; g.add(hand);
      var sp3 = spoon.clone(); sp3.rotation.set(-0.15, Math.PI, 0); sp3.position.set(0, 0.006, -0.32); sp3.scale.setScalar(0.5); g.add(sp3);
      this.camera.add(g);
      this.fp.push({ g: g, side: sd, blob: sp3.children[2] });
    }

    /* 飛び散るかけら */
    var crumbG = new T.SphereGeometry(1, 8, 6);
    this.crumbM = [new T.MeshStandardMaterial({ color: 0xf2c25a, roughness: 0.25, envMap: this.env, emissive: 0x3a2200, emissiveIntensity: 0.3 }),
                   new T.MeshStandardMaterial({ color: 0x5a2507, roughness: 0.2, envMap: this.env })];
    this.crumbs = [];
    for (var ci = 0; ci < 70; ci++) {
      var cm = new T.Mesh(crumbG, this.crumbM[0]); cm.visible = false; this.scene.add(cm);
      this.crumbs.push({ m: cm, life: 0, v: [0, 0, 0] });
    }
    this.biteN = 0; this.lastT = 0; this.eatAmt = 0; this.chew = 0;
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
    upM.geometry.computeBoundingBox();
    var bb = upM.geometry.boundingBox, pb = col.plan.mode === "tip" ? col.plan.pivot[1] : bb.min.y;
    this.parts = { ver: F.ver, up: upM, low: low, col: col, base: pb, h: Math.max(0.5, bb.max.y - pb) };
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
    /* 倒れている間に食べたら、残る側だけ作り直す */
    if (this.parts && this.parts.ver !== this.F.ver) {
      var F2 = this.F, up2 = this.parts.col.plan.up;
      this.parts.low.geometry.dispose();
      this.parts.low.geometry = buildGeometry(F2, function (i, j, k) { return !up2[F2.idx(i, j, k)]; });
      this.parts.ver = F2.ver;
    }
    var u = this.mat.userData.u;
    u.uWob.value.set(s.wob[0], s.wob[1]);
    u.uSquash.value = s.squash || 0;
    u.uBase.value = 0;

    /* 人 */
    var now = performance.now() / 1000, dt = Math.min(0.05, this.lastT ? now - this.lastT : 0.016); this.lastT = now;
    var hero = this.hero, k = s.spoon || { phase: 0 }, wk = s.walk || 0, mv = s.moving || 0;
    this.eatAmt += ((s.eating ? 1 : 0) - this.eatAmt) * Math.min(1, dt * 10);
    var ea = this.eatAmt;
    if (ea > 0.05) this.chew += dt * 7;
    hero.position.set(s.me[0], 0, s.me[2]); hero.scale.setScalar(0.25);
    hero.rotation.y = s.face;
    var sw = Math.sin(wk * 9) * 0.7 * mv;
    this.legL.rotation.x = sw; this.legR.rotation.x = -sw;
    hero.position.y = Math.abs(Math.cos(wk * 9)) * 0.012 * mv;
    /* 両手のスプーンで交互にかきこむ：前へ突っこむ→口へ */
    var cyc = this.chew, aR = 0.5 + 0.5 * Math.sin(cyc), aL = 0.5 + 0.5 * Math.sin(cyc + Math.PI);
    /* 腕はいつも前へまっすぐ伸ばす。食べるときは交互に突っこんで口へかきこむ */
    /* a=1 で前へ突っこみ、a=0 でスプーンを頭の高さまで持ち上げて口へ（後ろからも見えるよう大きく） */
    var mR = Math.pow(1 - aR, 1.6), mL = Math.pow(1 - aL, 1.6);
    this.armR.rotation.set(-1.5 + sw * 0.08 + (-0.2 * aR - 1.0 * mR) * ea, 0, 0.55 * mR * ea);
    this.armL.rotation.set(-1.5 - sw * 0.08 + (-0.2 * aL - 1.0 * mL) * ea, 0, -0.55 * mL * ea);
    /* もぐもぐ：口・ほっぺ・頭 */
    var ch = Math.abs(Math.sin(cyc * 1.3));
    this.mouth.scale.set(1.3 + 0.3 * ea, 0.5 + 1.2 * ch * ea, 0.5);
    var ck = 1 + 0.55 * ea * (0.7 + 0.3 * ch);
    this.cheekL.scale.set(ck, ck, ck); this.cheekR.scale.set(ck, ck, ck);
    this.head.rotation.x = (-0.1 - 0.3 * Math.max(mR, mL) + 0.1 * ch) * ea;
    this.head.position.y = 1.55 - 0.03 * ch * ea;
    var full = ea > 0.3;
    this.blob.visible = full && aR < 0.6; this.blob2.visible = full && aL < 0.6;
    this.blobTop.visible = this.blob.visible && !!k.caramel; this.blobTop2.visible = this.blob2.visible && !!k.caramel;
    /* かけら */
    var b = s.bites;
    if (b && b.n !== this.biteN) {
      this.biteN = b.n;
      var cnt = 5;
      for (var i2 = 0, made = 0; i2 < this.crumbs.length && made < cnt; i2++) {
        var c = this.crumbs[i2]; if (c.life > 0) continue;
        made++;
        c.life = 0.7 + Math.random() * 0.5;
        c.m.material = b.caramel && Math.random() < 0.5 ? this.crumbM[1] : this.crumbM[0];
        c.m.position.set(b.p[0] + (Math.random() - 0.5) * 0.5, b.p[1] + (Math.random() - 0.5) * 0.5, b.p[2] + (Math.random() - 0.5) * 0.5);
        var sp2 = 1.2 + Math.random() * 2;
        c.v = [b.dir[0] * sp2 * 0.3 + (Math.random() - 0.5) * 2.0, 1.0 + Math.random() * 2.0, b.dir[1] * sp2 * 0.3 + (Math.random() - 0.5) * 2.0];
        var sz = 0.012 + Math.random() * 0.022; c.m.scale.set(sz, sz * 0.8, sz);
        c.m.visible = true;
      }
    }
    for (var i3 = 0; i3 < this.crumbs.length; i3++) {
      var cc = this.crumbs[i3]; if (cc.life <= 0) continue;
      cc.life -= dt; cc.v[1] -= 9 * dt;
      var P = cc.m.position; P.x += cc.v[0] * dt; P.y += cc.v[1] * dt; P.z += cc.v[2] * dt;
      if (P.y < 0.03) { P.y = 0.03; cc.v[1] *= -0.25; cc.v[0] *= 0.6; cc.v[2] *= 0.6; }
      if (cc.life <= 0) cc.m.visible = false;
    }

    /* カメラ：人の後ろの低い所から、いつも同じ距離。間に挟まるプリンはくり抜いて見せる */
    var cam = this.camera, sh = (s.shake || 0) + 0.015 * this.eatAmt;
    var tx = s.me[0], ty = 0.3, tz = s.me[2];
    var el = 0.3, d = 4.0, dx = Math.sin(s.yaw) * Math.cos(el), dy = Math.sin(el), dz = Math.cos(s.yaw) * Math.cos(el);
    var cx0 = tx + dx * d, cy0 = Math.max(0.12, ty + dy * d), cz0 = tz + dz * d;
    var lx0 = tx - Math.sin(s.yaw) * 2, ly0 = ty + 0.75, lz0 = tz - Math.cos(s.yaw) * 2;
    /* 倒れる間は引きのカメラ（プリンの中心から、人のいる側へ離れて少し上から） */
    var w = s.wide || 0;
    if (w > 0) {
      w = w * w * (3 - 2 * w);
      var ox = tx, oz = tz, ol = Math.sqrt(ox * ox + oz * oz);
      if (ol < 0.5) { ox = Math.sin(s.yaw); oz = Math.cos(s.yaw); ol = 1; }
      var wx = ox / ol * 11, wz = oz / ol * 11;
      cx0 += (wx - cx0) * w; cy0 += (4.2 - cy0) * w; cz0 += (wz - cz0) * w;
      lx0 += (0 - lx0) * w; ly0 += (1.4 - ly0) * w; lz0 += (0 - lz0) * w;
    }
    cam.position.set(cx0 + (Math.random() - 0.5) * sh, cy0 + (Math.random() - 0.5) * sh, cz0 + (Math.random() - 0.5) * sh);
    cam.lookAt(lx0, ly0, lz0);
    CUT.uCam.value.copy(cam.position);
    CUT.uHero.value.set(tx, 0.25, tz);
    if (w > 0.5) CUT.uHero.value.copy(cam.position);   /* 引きのときはくり抜かない */
    for (var fi = 0; fi < this.fp.length; fi++) this.fp[fi].g.visible = false;

    /* 崩れ */
    if (this.parts) {
      poseMatrix(s.collapse.plan, s.collapse.pose, this.parts.up.matrix);
      this.parts.up.matrixWorldNeedsUpdate = true;
      /* しなり：倒れ始めは上が遅れて後ろへ反り、着地の直前に前へしなる。着地後もしばらく揺れる */
      var pl = s.collapse.plan, tt = s.collapse.t, um = this.parts.up.material.userData.u;
      var dir = [-pl.ax[2], pl.ax[0]];
      var fall = Math.min(1, tt / pl.tLand), bend;
      if (pl.mode === "tip") bend = -0.16 * Math.sin(Math.PI * Math.min(1, fall * 1.4)) + 0.22 * Math.pow(fall, 4);
      else bend = 0;
      if (tt > pl.tLand) { var e2 = tt - pl.tLand; bend = 0.22 * Math.exp(-e2 * 2.4) * Math.cos(e2 * 9); }
      um.uWob.value.set(dir[0] * bend, dir[1] * bend);
      um.uBase.value = this.parts.base; um.uH.value = this.parts.h;
    }
  };

  GameScene.prototype.draw = function (ctx, W, H) { return this.stage.draw(ctx, W, H); };

  global.GameScene = GameScene;
})(window);
