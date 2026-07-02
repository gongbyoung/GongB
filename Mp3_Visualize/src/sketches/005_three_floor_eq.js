/**
 * 005_three_floor_eq.js
 * 모든 주파수 대역과 연동되어 바닥에서 솟구치는 3D 격자 이퀄라이저 스테이지
 */
export default class ThreeFloorEqualizer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.eqBars = []; // 바닥에 깔릴 막대들의 배열
    
    this.gridSizeX = 12; // 가로 막대 개수
    this.gridSizeZ = 4;  // 세로 막대 개수 (4개 대역: Sub-Bass, Bass, Mid, Treble에 매핑)
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    // 깊이감과 사이버펑크 무드를 극대화하는 안개 효과 추가
    this.scene.fog = new THREE.FogExp2(0x050508, 0.08);

    // 무대를 위에서 비스듬히 내려다보는 시네마틱 카메라 뷰 각도 세팅
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 5, 8);
    this.camera.lookAt(0, 1, 0);

    // 레코더 엔진 우회 캡처용 옵션 활성화
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x050508);
    this.container.appendChild(this.renderer.domElement);

    // 은은한 전체 조명과 포인트 라이트 배치
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.1));
    const stageLight = new THREE.PointLight(0x00ffff, 1.5, 50);
    stageLight.position.set(0, 8, 2);
    this.scene.add(stageLight);

    // 💡 [바닥 고정 핵심 테크닉]
    // 박스 Geometry를 만든 후, 기준점(Pivot)을 정중앙(0,0,0)에서 바닥면(Y = -0.5)으로 이동시킵니다.
    // 이렇게 해야 나중에 scale.y를 키울 때 공중에 뜨지 않고 바닥에 붙은 채 위로만 솟아오릅니다.
    const geometry = new THREE.BoxGeometry(0.4, 1, 0.4);
    geometry.translate(0, 0.5, 0); 

    // 주파수 4대역별 네온 컬러 레이어 매칭 (Sub-Bass: 핫핑크, Bass: 네온민트, Mid: 사이언블루, Treble: 라임그린)
    const bandColors = [0xff0055, 0x00ffcc, 0x0077ff, 0xaaff00];

    // 격자 형태로 바닥 막대 군단 배치
    for (let z = 0; z < this.gridSizeZ; z++) {
      for (let x = 0; x < this.gridSizeX; x++) {
        
        const material = new THREE.MeshStandardMaterial({
          color: bandColors[z],
          roughness: 0.1,
          metalness: 0.7,
          emissive: bandColors[z],
          emissiveIntensity: 0.1
        });

        const bar = new THREE.Mesh(geometry, material);
        
        // 무대 중앙을 기준으로 가로(X), 세로(Z) 바닥 좌표 정렬 배치
        bar.position.x = (x - (this.gridSizeX - 1) / 2) * 0.6;
        bar.position.y = 0; // 💥 바닥에 정확히 밀착
        bar.position.z = (z - (this.gridSizeZ - 1) / 2) * 0.8 - 2;

        // 애니메이션 연산을 위해 좌표 정보 및 주파수 소속 라인(z) 저장
        bar.userData = { bandIndex: z, waveOffset: x * 0.2 };

        this.scene.add(bar);
        this.eqBars.push(bar);
      }
    }
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    if (audioData) {
      // 💡 주파수 분리된 모든 데이터 파이프라인 배열화
      const bands = [
        audioData.subBass,
        audioData.bass,
        audioData.mid,
        audioData.treble
      ];

      const time = Date.now() * 0.003;

      this.eqBars.forEach(bar => {
        const { bandIndex, waveOffset } = bar.userData;
        
        // 해당 막대가 속한 대역의 소리 세기 가져오기
        const targetAudioValue = bands[bandIndex];

        // 💥 [전체 연결 연산] 
        // 1. 내 대역 주파수 파워에 비례해 높이 계산
        // 2. 가로축(waveOffset)에 흐르는 사인파 노이즈를 믹스하여 전체 볼륨(volume) 강도에 따라 부드러운 물결 효과 연출
        const waveEffect = Math.sin(time + waveOffset) * (audioData.volume * 1.2);
        const targetHeight = 0.05 + (targetAudioValue * 7.0) + Math.max(0, waveEffect);

        // Lerp를 통해 뚝뚝 끊기지 않고 바닥에서 솟구치듯 부드럽게 스케일링
        bar.scale.y = THREE.MathUtils.lerp(bar.scale.y, targetHeight, 0.2);

        // 비트 세기에 맞춰 발광(Emissive) 밀도 동적 증폭
        bar.material.emissiveIntensity = targetAudioValue * 2.5 + (audioData.volume * 0.5);
      });

      // 전체 무대를 음악 볼륨 세기에 따라 카메라가 미세하게 회전하며 공간감 극대화
      this.scene.rotation.y = Math.sin(time * 0.1) * 0.15 + (audioData.volume * 0.05);
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
    this.eqBars = [];
  }
}
