/**
 * src/sketches/002_three_cube.js
 * - [4-Stem 전용] Three.js 3D 큐브 링 비주얼라이저
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
    this.camera.position.set(0, 0, 18);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.width, this.height);
    this.canvas = this.renderer.domElement;
    this.container.appendChild(this.canvas);

    // 3D 큐브 링 생성 (24개)
    const cubeCount = 24;
    const radius = 6;
    const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);

    for (let i = 0; i < cubeCount; i++) {
      const angle = (i / cubeCount) * Math.PI * 2;
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(i / cubeCount, 0.8, 0.5),
        wireframe: true
      });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.x = Math.cos(angle) * radius;
      cube.position.y = Math.sin(angle) * radius;
      cube.position.z = 0;
      this.scene.add(cube);
      this.cubes.push({ mesh: cube, baseAngle: angle, baseRadius: radius });
    }

    // 중앙 코어 구체 생성
    const coreGeo = new THREE.IcosahedronGeometry(2.5, 2);
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

    // 4-Stem 표준 수치
    const vocals = (audioData?.vocalsVol || 0) * gainVal;
    const drums  = (audioData?.drumsVol  || 0) * gainVal;
    const bass   = (audioData?.bassVol   || 0) * gainVal;
    const other  = (audioData?.otherVol  || 0) * gainVal;

    // 🎹 기타: 3D 회전
    this.rotationAngle += 0.005 + other * 0.03;
    this.scene.rotation.z = this.rotationAngle;
    this.scene.rotation.y = Math.sin(this.rotationAngle * 0.5) * 0.3;

    // 🎸 베이스: 중앙 코어 스케일 & 발광
    if (this.coreMesh) {
      const coreScale = 1.0 + bass * 1.5;
      this.coreMesh.scale.set(coreScale, coreScale, coreScale);
      this.coreMesh.rotation.x += 0.01;
      this.coreMesh.rotation.y += 0.01;
    }

    // 🥁 드럼 & 🎤 보컬: 큐브 링 반응
    const currentRadius = 6 + drums * 4;
    this.cubes.forEach((item, idx) => {
      const angle = item.baseAngle + this.rotationAngle;
      item.mesh.position.x = Math.cos(angle) * currentRadius;
      item.mesh.position.y = Math.sin(angle) * currentRadius;

      // 보컬 반응으로 개별 큐브 축소/확대
      const individualScale = 1.0 + vocals * 2.0 * Math.sin(idx + this.rotationAngle * 5);
      item.mesh.scale.set(individualScale, individualScale, individualScale);
    });

    this.renderer.render(this.scene, this.camera);

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `3D Cubes: 24 Pcs`,
      isCovering: true,
      activeFunction: "ThreeCube[4Stem_Active]"
    };
  }

  destroy() {
    if (this.renderer && this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.renderer = null;
    this.scene = null;
    this.camera = null;
  }
}
