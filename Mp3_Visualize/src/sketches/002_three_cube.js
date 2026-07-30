/**
 * src/sketches/002_three_cube.js
 * - [수리 완결판] 3D 큐브 링 화면 복원 & 오디오 반응 강화
 */
export default class ThreeCubeSketch {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.cubes = [];
    this.coreMesh = null;
    this.rotationAngle = 0;

    this.init();
  }

  init() {
    const THREE = window.THREE;
    if (!THREE) return;

    this.width = this.container.clientWidth || 800;
    this.height = this.container.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, 0, 22);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.width, this.height);
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = 'width:100% !important; height:100% !important; display:block;';
    this.container.appendChild(this.canvas);

    const cubeCount = 28;
    const radius = 7;
    const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);

    for (let i = 0; i < cubeCount; i++) {
      const angle = (i / cubeCount) * Math.PI * 2;
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(i / cubeCount, 0.9, 0.6),
        wireframe: true
      });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      this.scene.add(cube);
      this.cubes.push({ mesh: cube, baseAngle: angle });
    }

    const coreGeo = new THREE.IcosahedronGeometry(3.0, 2);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.scene.add(this.coreMesh);
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
    if (!this.renderer || !this.scene) return;

    const globalSettings = window.cosmicEngineSettings || {};
    const gainVal = globalSettings.audioGain ?? 1.0;

    const targetAudio = (audioData && audioData.vocalsVol !== undefined) ? audioData : (window.latestCompiledAudioData || {});
    const vocals = (targetAudio.vocalsVol || 0) * gainVal;
    const drums  = (targetAudio.drumsVol  || 0) * gainVal;
    const bass   = (targetAudio.bassVol   || 0) * gainVal;
    const other  = (targetAudio.otherVol  || 0) * gainVal;

    this.rotationAngle += 0.008 + other * 0.04;
    this.scene.rotation.z = this.rotationAngle;
    this.scene.rotation.y = Math.sin(this.rotationAngle * 0.5) * 0.4;

    if (this.coreMesh) {
      const coreScale = 1.0 + bass * 2.0;
      this.coreMesh.scale.set(coreScale, coreScale, coreScale);
      this.coreMesh.rotation.x += 0.02;
      this.coreMesh.rotation.y += 0.02;
    }

    const currentRadius = 7 + drums * 6;
    this.cubes.forEach((item, idx) => {
      const angle = item.baseAngle + this.rotationAngle;
      item.mesh.position.x = Math.cos(angle) * currentRadius;
      item.mesh.position.y = Math.sin(angle) * currentRadius;

      const scale = 1.0 + vocals * 2.5 * Math.sin(idx + this.rotationAngle * 4);
      item.mesh.scale.set(scale, scale, scale);
    });

    this.renderer.render(this.scene, this.camera);

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `3D Cubes: 28 Pcs`,
      isCovering: true,
      activeFunction: "ThreeCube[Render_Fixed]"
    };
  }

  destroy() {
    if (this.renderer && this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.renderer = null; this.scene = null; this.camera = null;
  }
}
