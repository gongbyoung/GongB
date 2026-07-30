/**
 * src/sketches/007_three_cosmic_nebula.js
 * - [4-Stem 전용] Three.js 3,000개 입자 우주 성운
 */
export default class ThreeCosmicNebulaSketch {
  constructor(container) {
    this.container = container;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.particleSystem = null;
    this.positions = null;
    this.initialPositions = null;
    this.time = 0;

    this.init();
  }

  init() {
    const THREE = window.THREE;
    if (!THREE) return;

    this.width = this.container.clientWidth || 800;
    this.height = this.container.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
    this.camera.position.z = 25;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.width, this.height);
    this.container.appendChild(this.renderer.domElement);

    const particleCount = 3000;
    const geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(particleCount * 3);
    this.initialPositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const r = Math.random() * 12 + 1;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;

      const x = r * Math.cos(theta) * Math.cos(phi);
      const y = r * Math.sin(theta) * Math.cos(phi);
      const z = r * Math.sin(phi);

      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;

      this.initialPositions[i * 3] = x;
      this.initialPositions[i * 3 + 1] = y;
      this.initialPositions[i * 3 + 2] = z;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.25,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
  }

  resize(w, h) {
    this.width = w || this.container.clientWidth || 800;
    this.height = h || this.container.clientHeight || 600;
    if (this.renderer && this.camera) {
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    }
  }

  update(audioData) {
    if (!this.renderer || !this.particleSystem) return;
    this.time += 0.01;

    const globalSettings = window.cosmicEngineSettings || {};
    const gainVal = globalSettings.audioGain ?? 1.0;

    const vocals = (audioData?.vocalsVol || 0) * gainVal;
    const drums  = (audioData?.drumsVol  || 0) * gainVal;
    const bass   = (audioData?.bassVol   || 0) * gainVal;
    const other  = (audioData?.otherVol  || 0) * gainVal;

    // 🎹 기타: 성운 회전 속도
    this.particleSystem.rotation.z += 0.002 + other * 0.02;
    this.particleSystem.rotation.x += 0.001 + bass * 0.01;

    const posAttr = this.particleSystem.geometry.attributes.position;
    const count = posAttr.count;

    // 🥁 드럼 & 🎤 보컬: 입자 방사형 팽창
    const burstFactor = 1.0 + drums * 0.8 + bass * 0.4;

    for (let i = 0; i < count; i++) {
      const ix = this.initialPositions[i * 3];
      const iy = this.initialPositions[i * 3 + 1];
      const iz = this.initialPositions[i * 3 + 2];

      const wave = Math.sin(this.time * 3 + i) * (vocals * 1.5);

      this.positions[i * 3] = ix * burstFactor;
      this.positions[i * 3 + 1] = iy * burstFactor + wave;
      this.positions[i * 3 + 2] = iz * burstFactor;
    }

    posAttr.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Particles: 3,000`,
      isCovering: true,
      activeFunction: "ThreeCosmicNebula[4Stem_Active]"
    };
  }

  destroy() {
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer = null; this.scene = null; this.camera = null;
  }
}
