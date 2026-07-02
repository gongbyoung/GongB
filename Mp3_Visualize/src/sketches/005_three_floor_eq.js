/**
 * 005_three_floor_eq.js
 * 브라우저 화면(Viewport) 최하단에 칼같이 고정되어 작동하는 주파수 분리 이퀄라이저
 */
export default class ThreeFloorEqualizer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.eqBars = [];
    
    // 주파수 데이터를 정밀하게 쪼갤 가로 막대 총 개수
    this.barCount = 32; 
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();

    // 💡 [화면 고정 핵심 1] 
    // 원근감이 없는 정면 직교 카메라(OrthographicCamera) 스타일로 시점 고정
    // 화면 크기를 기준으로 좌, 우, 상, 하 경계를 픽셀 감각으로 매핑합니다.
    this.camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 1000);
    this.camera.position.z = 10;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
    this.renderer.setSize(width, height);
    // 배경을 투명하거나 아주 어둡게 처리하여 화면 하단 연출 극대화
    this.renderer.setClearColor(0x000000, 0.0); 
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    // 💡 [화면 고정 핵심 2] 축 정렬
    // 막대가 위로만 자라나도록 기준점을 Box의 맨 아래(Y = -0.5)로 이동
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.translate(0, 0.5, 0);

    // 주파수 영역별 시각적 구분을 위한 색상 그라데이션 배열 생성 생성 (SubBass -> Bass -> Mid -> Treble)
    this.buildBars(width, height, geometry);
  }

  /**
   * 화면 크기에 맞춰 하단에 막대들을 균등 배치하는 함수
   */
  buildBars(width, height, geometry) {
    // 기존 막대가 있다면 씬에서 제거
    this.eqBars.forEach(bar => this.scene.add ? this.scene.remove(bar) : null);
    this.eqBars = [];

    const barWidth = (width / this.barCount) * 0.85; // 막대 사이 여백을 둔 가로폭
    const startX = -width / 2 + barWidth / 2 + (width / this.barCount) * 0.075;
    const bottomY = -height / 2; // 💥 화면 최하단 Y 좌표

    for (let i = 0; i < this.barCount; i++) {
      // 인덱스 위치에 따라 색상을 네온 핑크 -> 블루 -> 시안 -> 그린으로 전환
      let colorHex = 0x00ffcc;
      if (i < this.barCount * 0.15) colorHex = 0xff0055;      // Sub-Bass Zone
      else if (i < this.barCount * 0.4) colorHex = 0x00ffcc;  // Bass Zone
      else if (i < this.barCount * 0.75) colorHex = 0x0077ff; // Mid Zone
      else colorHex = 0xaaff00;                               // Treble Zone

      const material = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.85
      });

      const bar = new THREE.Mesh(geometry, material);
      
      // 두께와 가로폭 세팅
      bar.scale.x = barWidth;
      bar.scale.z = 1;
      
      // 💥 위치를 화면 맨 밑바닥(bottomY)에 칼같이 고정
      bar.position.x = startX + i * (width / this.barCount);
      bar.position.y = bottomY; 
      bar.position.z = 0;

      // 오디오 분석 데이터의 주파수 인덱스 매핑을 위한 메타데이터 저장
      bar.userData = {
        sampleIndex: Math.floor((i / this.barCount) * 256) //전체 주파수 대역 매핑
      };

      this.scene.add(bar);
      this.eqBars.push(bar);
    }
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    if (audioData && audioData.raw && audioData.raw.length > 0) {
      const heightFactor = this.container.clientHeight * 0.8; // 최대 솟구칠 높이 한도 (화면 높이의 80%)

      this.eqBars.forEach(bar => {
        const { sampleIndex } = bar.userData;
        
        // 오디오 주파수 원본 배열(raw)에서 내 위치의 주파수 파워 추출 (0 ~ 255 수치를 0.0 ~ 1.0으로 규격화)
        const rawValue = (audioData.raw[sampleIndex] || 0) / 255;

        // 대역별 파워 보정 (고음역대로 갈수록 감도가 낮아지므로 스케일 보정치 적용)
        let boost = 1.0;
        if (sampleIndex > 150) boost = 2.2;
        else if (sampleIndex > 80) boost = 1.6;

        const targetHeight = 5 + (rawValue * heightFactor * boost);

        // 바닥에 고정된 채 위로만 스무스하게 솟구치도록 연산
        bar.scale.y = THREE.MathUtils.lerp(bar.scale.y, targetHeight, 0.25);
      });
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      // 💡 화면 크기가 리사이즈되어도 바닥 좌표계를 다시 계산하여 완벽 밀착 유지
      this.camera.left = -w / 2;
      this.camera.right = w / 2;
      this.camera.top = h / 2;
      this.camera.bottom = -h / 2;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);

      // 박스 기하학 재정렬용 임시 생성
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      geometry.translate(0, 0.5, 0);
      this.buildBars(w, h, geometry);
    }
  }

  destroy() {
    if (!this.scene) return;
    this.eqBars.forEach(bar => {
      bar.geometry.dispose();
      bar.material.dispose();
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
