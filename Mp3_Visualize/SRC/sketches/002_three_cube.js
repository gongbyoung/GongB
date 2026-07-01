/**
 * 002_three_cube.js
 * Three.js 기반 3D 주파수 그리드 이퀄라이저
 */
export default class ThreeCube {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cubes = []; // 생성된 큐브들을 담을 배열
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0a10, 0.05); // 몽환적인 깊이감을 위한 안개 효과

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 4, 7);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x0a0a10);
    this.container.appendChild(this.renderer.domElement);

    // 조명 세팅
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00ffff, 1, 100);
    pointLight.position.set(0, 5, 5);
    this.scene.add(pointLight);

    // 4개의 주파수 그룹을 시각화할 4개의 거대한 3D 바(Bar) 배치
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    
    // 각 대역별로 다른 네온 컬러 부여
    const colors = [0xff0055, 0x00ffcc, 0x0077ff, 0xaaff00]; 

    for (let i = 0; i < 4; i++) {
      const material = new THREE.MeshStandardMaterial({
        color: colors[i],
        roughness: 0.2,
        metalness: 0.8,
        emissive: colors[i],
        emissiveIntensity: 0.2
      });

      const cube = new THREE.Mesh(geometry, material);
      // X축 정렬 배치 (-1.5, -0.5, 0.5, 1.5)
      cube.position.x = (i - 1.5) * 1.8; 
      cube.position.y = 0;
      
      this.scene.add(cube);
      this.cubes.push(cube);
    }
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    if (audioData) {
      // 주파수 매핑 객체 분해
      const bands = [audioData.subBass, audioData.bass, audioData.mid, audioData.treble];

      this.cubes.forEach((cube, index) => {
        const value = bands[index];

        // 1. 주파수 세기에 따라 큐브의 Y축 길이(높이) 조절 (최소 높이 0.1 보장)
        const targetScaleY = 0.1 + value * 8;
        // 보간 처리를 통해 뚝뚝 끊기지 않고 부드럽게 스케일 변화
        cube.scale.y = THREE.MathUtils.lerp(cube.scale.y, targetScaleY, 0.3);
        
        // 2. 길어진 만큼 위쪽으로만 솟아오르도록 보정
        cube.position.y = cube.scale.y / 2;

        // 3. 비트가 강할 때 네온 발광 자체(Emissive) 강도 증폭
        cube.material.emissiveIntensity = value * 2;
      });

      // 전체 씬을 약간씩 회전시켜 동적인 느낌 추가
      this.scene.rotation.y += 0.003 + audioData.volume * 0.01;
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }
  }

  destroy() {
    if (!this.scene) return;

    this.scene.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      object.material.dispose();
    });

    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cubes = [];
  }
}
