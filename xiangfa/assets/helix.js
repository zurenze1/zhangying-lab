'use strict';

(() => {
  const stage = document.getElementById('helix-stage');
  const mount = document.getElementById('helix-canvas');
  const desktop = matchMedia('(min-width: 761px) and (prefers-reduced-motion: no-preference)');
  let teardown;
  let library;
  let pending = false;

  function script(src) {
    return new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = src;
      tag.onload = resolve;
      tag.onerror = reject;
      document.head.append(tag);
    });
  }

  function getThree() {
    const fallback = 'assets/vendor/three-0.149.0.min.js';
    library ??= location.protocol === 'file:'
      ? script(fallback)
      : script('https://cdnjs.cloudflare.com/ajax/libs/three.js/0.149.0/three.min.js').catch(() => script(fallback));
    return library;
  }

  function showHelix() {
    const T = window.THREE;
    const scene = new T.Scene();
    const renderer = new T.WebGLRenderer({alpha: true, antialias: true, powerPreference: 'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = T.sRGBEncoding;
    const camera = new T.OrthographicCamera(-4, 4, 3, -3, 0.1, 40);
    camera.position.set(0, 0, 12);
    const object = new T.Group();
    const model = new T.Group();
    scene.add(object);
    object.add(model);
    object.rotation.z = -Math.PI * .37;
    object.rotation.y = -.23;
    const golds = [0xffd29b, 0xf0a456, 0xbb8064];
    const turns = 4.5;
    const radius = .67;
    const length = 6.3;
    const points = 225;
    function point(t, phase) {
      const angle = t * Math.PI * 2 * turns + phase;
      return new T.Vector3(Math.cos(angle) * radius, (t - .5) * length, Math.sin(angle) * radius);
    }
    for (const [strand, color] of golds.entries()) {
      const phase = strand * 2 * Math.PI / 3;
      const samples = Array.from({length: points + 1}, (_, index) => point(index / points, phase));
      const curve = new T.CatmullRomCurve3(samples);
      const core = new T.Mesh(new T.TubeGeometry(curve, points, .027, 7),
        new T.MeshStandardMaterial({color, metalness: .27, roughness: .37, emissive: color, emissiveIntensity: .19}));
      const halo = new T.Mesh(new T.TubeGeometry(curve, points, .075, 5),
        new T.MeshBasicMaterial({color, opacity: .15, transparent: true, depthWrite: false, blending: T.AdditiveBlending}));
      const accents = new T.Points(new T.BufferGeometry().setFromPoints(samples.filter((_, i) => i % 6 === 0)),
        new T.PointsMaterial({color: 0xffeccb, transparent: true, opacity: .76, size: .045}));
      model.add(core, halo, accents);
    }
    scene.add(new T.HemisphereLight(0xffe9cd, 0x7657af, 1.5));
    const key = new T.DirectionalLight(0xffdeb0, 2.2);
    key.position.set(-2, 4, 6);
    scene.add(key);

    let frame = 0;
    let width = 0;
    let height = 0;
    function draw() {
      frame = 0;
      const rect = mount.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (width !== rect.width || height !== rect.height) {
        width = rect.width;
        height = rect.height;
        const halfHeight = Math.max(2.24, 3.8 / (width / height));
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
        camera.left = -halfHeight * width / height;
        camera.right = -camera.left;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      }
      const progress = Math.min(1, Math.max(0, (innerHeight - rect.top) / (innerHeight + rect.height)));
      model.rotation.y = progress * Math.PI * 2.3;
      object.rotation.x = .27 - progress * .57;
      renderer.render(scene, camera);
      stage.dataset.live = 'true';
    }
    function queueDraw() {
      if (!frame) frame = requestAnimationFrame(draw);
    }
    function restoreStill(event) {
      event.preventDefault();
      delete stage.dataset.live;
    }
    mount.append(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost', restoreStill);
    renderer.domElement.addEventListener('webglcontextrestored', queueDraw);
    window.addEventListener('scroll', queueDraw, {passive: true});
    const resize = new ResizeObserver(queueDraw);
    resize.observe(mount);
    queueDraw();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll', queueDraw);
      renderer.domElement.removeEventListener('webglcontextlost', restoreStill);
      renderer.domElement.removeEventListener('webglcontextrestored', queueDraw);
      model.traverse(item => {
        item.geometry?.dispose();
        item.material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      delete stage.dataset.live;
    };
  }

  const near = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting || !desktop.matches || teardown || pending) return;
    pending = true;
    getThree().then(() => {
      if (desktop.matches) teardown = showHelix();
    }).catch(() => {
      stage.dataset.live = 'fallback';
    }).finally(() => { pending = false; });
  }, {rootMargin: '300px'});

  function observe() {
    if (desktop.matches) near.observe(stage);
    else {
      near.unobserve(stage);
      teardown?.();
      teardown = undefined;
    }
  }
  desktop.addEventListener('change', observe);
  observe();
})();
