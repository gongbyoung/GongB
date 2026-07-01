/**
 * threeTemplate.js
 * 새로운 Three.js 기반 미디어 아트를 만들 때 복사해서 쓸 기본 거푸집
 */
export default class ThreeTemplate {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.mesh = null; // 예시 오브젝트
  }

  /**
   * 3D 세트장 초기화 (장면, 카메라, 렌더러, 조명 설정)
   */
  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // 1. 장면 및 카메라 세팅
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.z = 5;

    // 2. WebGL 렌더러 생성 및 컨테이너 주입
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.container.appendChild(this.renderer.domElement);

    // 3. 조명 추가
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0x00ffcc, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    this.scene.add(directionalLight);

    // 4. 예시 오브젝트(큐브) 생성 및 장면에 추가
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ffcc, roughness: 0.3 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);
  }

  /**
   * SketchManager가 루프를 돌며 매 프레임 오디오 데이터와 함께 호출하는 곳
   */
  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    // ----------------------------------------------------
    // 🎨 여기에 오디오 반응형 3D 연출 코드를 작성합니다.
    // ----------------------------------------------------

    // 예시: 음악의 중음(Mid) 수치에 따라 큐브를 회전시키고, 전체 볼륨에 따라 크기를 키움
    if (audioData) {
      this.mesh.rotation.x += 0.01 + audioData.mid * 0.05;
      this.mesh.rotation.y += 0.01 + audioData.mid * 0.05;

      const scale = 1 + audioData.volume * 1.5;
      this.mesh.scale.set(scale, scale, scale);
    }

    // 화면 렌더링 촬영 구동
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 창 크기가 변경될 때 3D 카메라 비율 및 렌더러 크기 재조정
   */
  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }
  }

  /**
   * [중요] 스케치 교체 시 WebGL 자원(GPU 메모리)을 흔적 없이 해제
   */
  destroy() {
    if (!this.scene) return;

    // 장면에 포함된 모든 메쉬의 자원 해제
    this.scene.traverse((object) => {
      if (!object.isMesh) return;
      
      object.geometry.dispose(); // 기하학 메모리 해제
      
      if (Array.isArray(object.material)) {
        object.material.forEach((mat) => mat.dispose());
      } else {
        object.material.dispose(); // 재질 메모리 해제
      }
    });

    // 렌더러 DOM 제거 및 컨텍스트 파기
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.mesh = null;
  }
}
