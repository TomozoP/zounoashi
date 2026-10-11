/* 立体（three.js）で描くゲームの共通の土台。window.Z3 に入る。

     <script src="../random-bowling/vendor/three.min.js"></script>
     <script src="../three-base.js"></script>

   これまでの3D作品（オム文字・ジーンズ・アメンボ・盆栽・マシマシ）で毎回書いていた部分をまとめた。
   - 立体は画面外の描画係で描き、ゲームの canvas に drawImage で写す。
     ボタンや文字は今までどおり2Dで上に描けて、録画・画像保存にも立体が入る
   - スマホ（指で触る画面）は描く細かさを下げて軽くする
   - 開いた直後の失敗で平面に落ちないよう、作り直しを何度か試す（Z3.lazy）
   使い方の見本は games/_template/scene3d.js（new.js に --3d を付けると写される）。 */
(function (global) {
  "use strict";
  var Z3 = {};
  Z3.mobile = !!(global.matchMedia && global.matchMedia("(pointer: coarse)").matches);

  /* 描く細かさ。max は PC での上限（既定 1.5）。スマホは 1 まで */
  Z3.dpr = function (max) { return Math.min(Z3.mobile ? 1 : (max || 1.5), global.devicePixelRatio || 1); };

  /* 描画係。shadows: 影、tone: "aces" / "linear"、exposure、alpha: 背景を透かす */
  Z3.renderer = function (o) {
    o = o || {};
    var T = global.THREE;
    var r = new T.WebGLRenderer({ antialias: o.antialias !== false, alpha: !!o.alpha, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    r.outputColorSpace = T.SRGBColorSpace;
    if (o.tone === "aces") r.toneMapping = T.ACESFilmicToneMapping;
    else if (o.tone === "linear") r.toneMapping = T.LinearToneMapping;
    if (o.exposure) r.toneMappingExposure = o.exposure;
    if (o.alpha) r.setClearColor(0x000000, 0);
    if (o.shadows) { r.shadowMap.enabled = true; r.shadowMap.type = Z3.mobile ? T.PCFShadowMap : T.PCFSoftShadowMap; }
    return r;
  };

  /* 立体の場面1つ分。scene・camera・renderer を持ち、draw(ctx, W, H) でゲームの canvas に写す。
     o.camera: { fov, near, far } （既定 32°、0.5〜200）、o.renderer: Z3.renderer の指定、o.dpr: 上限、o.finish: 仕上げ（下） */
  Z3.Stage = function (o) {
    o = o || {};
    var T = global.THREE, c = o.camera || {};
    this.renderer = Z3.renderer(o.renderer);
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(c.fov || 32, 540 / 960, c.near || 0.5, c.far || 200);
    this.maxDpr = o.dpr;
    this.finish = o.finish ? new Z3.Finish(this.renderer, o.finish) : null;
    this.w = this.h = 0;
  };
  /* 画面の大きさが変わったときだけ描画係とカメラを合わせ、描いてから写す。描けなかったら false */
  Z3.Stage.prototype.draw = function (ctx, W, H) {
    var dpr = Z3.dpr(this.maxDpr), w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (!(w >= 2 && h >= 2)) return false;     /* 画面の大きさが決まる前（0や数でない）は描かない */
    if (w !== this.w || h !== this.h) {
      this.renderer.setSize(w, h, false);
      this.w = w; this.h = h;
      if (this.camera.isPerspectiveCamera) { this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); }
      if (this.finish) this.finish.size(w, h);
    }
    if (this.finish) this.finish.render(this.scene, this.camera);
    else this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, 0, 0, W, H);
    return true;
  };

  /* よく使う明かり：空と地面の照り返し・主光（影つき）・縁の光・補助光。強さは scale でまとめて変える */
  Z3.lights = function (scene, o) {
    o = o || {};
    var T = global.THREE, k = o.scale || 1;
    scene.add(new T.HemisphereLight(0xfff4e8, 0x3a3028, 0.55 * k));
    var key = new T.DirectionalLight(0xfff0e0, 2.4 * k);
    key.position.set(-4, 8, 6);
    if (o.shadows) {
      key.castShadow = true;
      key.shadow.mapSize.set(Z3.mobile ? 1024 : 2048, Z3.mobile ? 1024 : 2048);
      var s = o.shadowSize || 10, cam = key.shadow.camera;
      cam.left = -s; cam.right = s; cam.top = s; cam.bottom = -s; cam.near = 0.5; cam.far = 60;
      key.shadow.bias = -0.0005;
    }
    scene.add(key);
    var rim = new T.DirectionalLight(0xc8dcff, 1.0 * k); rim.position.set(6, 3, -5); scene.add(rim);
    var fill = new T.DirectionalLight(0xffe0cc, 0.4 * k); fill.position.set(5, 2, 6); scene.add(fill);
    return { key: key, rim: rim, fill: fill };
  };

  /* 材質。std(0xff8800, { roughness: 0.4 }) */
  Z3.std = function (color, extra) {
    var p = { color: color, roughness: 0.8 };
    for (var k in extra) p[k] = extra[k];
    return new global.THREE.MeshStandardMaterial(p);
  };

  /* 決まった並びの乱数（見た目を毎回同じにする）。var r = Z3.rng(7); r() → 0〜1 */
  Z3.rng = function (seed) {
    var s = (seed >>> 0) % 2147483647 || 1;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  };

  /* 2Dで描いた絵を貼り物にする。paint(g, w, h)。repeat を数で渡すと繰り返し */
  Z3.canvasTex = function (w, h, paint, repeat) {
    var T = global.THREE, c = document.createElement("canvas");
    c.width = w; c.height = h;
    paint(c.getContext("2d"), w, h);
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); }
    return t;
  };

  /* 仕上げ：少しのコントラスト・周辺を暗く・細かい粒子（オム文字・アメンボで使った形）。
     o: { contrast: 0.18, vignette: 0.32, grain: 0.025 }。使えない端末では素の描画に戻る */
  Z3.Finish = function (renderer, o) {
    this.r = renderer;
    this.o = o === true ? {} : o;
    this.failed = false;
  };
  Z3.Finish.prototype.size = function (w, h) {
    if (this.failed) return;
    var T = global.THREE, o = this.o;
    try {
      if (this.rt) { this.rt.setSize(w, h); this.mat.uniforms.uRes.value.set(w, h); return; }
      this.rt = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, samples: Z3.mobile ? 0 : 4 });
      this.mat = new T.ShaderMaterial({
        uniforms: {
          tColor: { value: this.rt.texture }, uRes: { value: new T.Vector2(w, h) }, uTime: { value: 0 },
          uContrast: { value: o.contrast == null ? 0.18 : o.contrast },
          uVignette: { value: o.vignette == null ? 0.32 : o.vignette },
          uGrain: { value: o.grain == null ? 0.025 : o.grain }
        },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader: [
          "uniform sampler2D tColor; uniform vec2 uRes; uniform float uTime, uContrast, uVignette, uGrain;",
          "varying vec2 vUv;",
          "float rnd(vec2 p){ return fract(sin(dot(p + uTime, vec2(12.9898, 78.233))) * 43758.5453); }",
          "void main(){",
          "  vec3 col = texture2D(tColor, vUv).rgb;",
          "  col = mix(col, col * col * (3.0 - 2.0 * col), uContrast);",
          "  vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;",
          "  col *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(q) * 1.25);",
          "  col += (rnd(vUv * uRes) - 0.5) * uGrain;",
          "  gl_FragColor = vec4(col, 1.0);",
          "  #include <colorspace_fragment>",
          "}"
        ].join("\n"),
        depthTest: false, depthWrite: false
      });
      this.post = new T.Scene();
      this.post.add(new T.Mesh(new T.PlaneGeometry(2, 2), this.mat));
      this.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    } catch (e) { this.failed = true; }
  };
  Z3.Finish.prototype.render = function (scene, camera) {
    var r = this.r;
    if (!this.failed && this.rt) {
      try {
        this.mat.uniforms.uTime.value = (this.mat.uniforms.uTime.value + 0.37) % 100;
        r.setRenderTarget(this.rt); r.render(scene, camera);
        r.setRenderTarget(null); r.render(this.post, this.cam);
        return;
      } catch (e) { this.failed = true; r.setRenderTarget(null); }
    }
    r.render(scene, camera);
  };

  /* 立体の場面を作る係。開いた直後は画面の大きさが0だったり、描画の準備が間に合わなかったりするので、
     1回の失敗で平面に切り替えず、0.5秒おきに20回まで作り直す（マシマシの形）。
     var scene3d = Z3.lazy(function () { return new MyScene(); });  … scene3d() で取り出す（まだなら null） */
  Z3.lazy = function (make) {
    var made = null, tries = 0, last = -1e9;
    function get() {
      if (made || tries >= 20 || !global.THREE) return made;
      var now = global.performance ? performance.now() : Date.now();
      if (now - last < 500) return null;
      last = now; tries++;
      try { made = make(); } catch (e) { made = null; }
      return made;
    }
    get.drop = function () { made = null; };   /* 描くのに失敗したら捨てて、次で作り直す */
    return get;
  };

  global.Z3 = Z3;
})(window);
