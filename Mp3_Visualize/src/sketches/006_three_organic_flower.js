/**
 * 006_three_organic_flower.js
 * 3중 중복 노이즈 가스 구름 + 독립적 크기/밝기를 가진 성단 및 실시간 랜덤 씨드 UI 연동 시스템
 */
export default class ThreeCosmicNebula {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    // 우주 가스 및 별들을 이룰 입자 시스템 변수
    this.particleCount = 15000; 
    this.geometry = null;
    this.material = null;
    this.points = null;

    // 파티클 각각의 독립적인 물리 속성을 보관할 내부 배열
    this.particleData = [];

    // 💡 UI와 동적으로 연동될 로컬 제어 변수 기본값 설정
    this.currentSeed = 42; 
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    
    // 심연의 깊이감을 위한 딥 스페이스 안개 배치
    this.scene.fog = new THREE.FogExp2(0x010103, 0.03);

    // 탑뷰(Top-view) 시네마틱 앵글 고정
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 12, 0);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x010103);
    this.container.appendChild(this.renderer.domElement);

    // 전역 공간 조명 밸런싱
    this.scene.add(new THREE.AmbientLight(0x222233, 0.5));

    // 💡 메인 우주 성단 및 가스 파티클 빌드 가동
    this.buildCosmos();
  }

  /**
   * 의사 난수(Pseudo-random) 생성기 함수
   * 입력된 씨드값(Seed)에 따라 항상 규칙적이면서도 불규칙한 천체 좌표를 수학적으로 보장합니다.
   */
  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  buildCosmos() {
    // 리사이즈 및 씨드 변경 시 기존 오브젝트 자원 수거
    if (this.points) {
      this.scene.remove(this.points);
      this.geometry.dispose();
      this.material.dispose();
    }

    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);

    this.particleData = [];
    let sRandom = this.currentSeed;

    for (let i = 0; i < this.particleCount; i++) {
      // 씨드 기반 난수 추출 순현
      sRandom = this.seededRandom(sRandom) * 1000;
      const rand1 = this.seededRandom(sRandom + 1);
      const rand2 = this.seededRandom(sRandom + 2);
      const rand3 = this.seededRandom(sRandom + 3);
      const rand4 = this.seededRandom(sRandom + 4);

      // 1. 🌌 극좌표 기반 소용돌이 형태의 초기 은하 분포 생성
      const angle = rand1 * Math.PI * 2;
      const radius = Math.pow(rand2, 2.0) * 8.0 + 0.1; // 중심부에 더 밀집되도록 설정

      const x = Math.cos(angle) * radius;
      const y = (rand3 - 0.5) * 0.4; // 납작한 원반 형태의 탑뷰 두께감
      const z = Math.sin(angle) * radius;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // 2. 🌟 크기와 밝기가 다른 별들의 현실감 분배 (대소/명암의 대비)
      let pSize = 0.015; // 기본 마이크로 가스 입자 크기
      let color = new THREE.Color();

      if (rand4 < 0.07) {
        // 상위 7%는 눈부시게 빛나는 거대 거성/항성 레이어
        pSize = 0.08 + rand1 * 0.14; 
        color.setHSL(0.55 + rand2 * 0.1, 0.9, 0.85); // 오리온 성운풍 신비로운 사이언/화이트 톤
      } else if (rand4 < 0.35) {
        // 중간 성단 레이어
        pSize = 0.03 + rand1 * 0.04;
        color.setHSL(0.92 + rand2 * 0.05, 0.8, 0.65); // 몽환적인 바이올렛/네온 핑크 톤
      } else {
        // 배경을 채우는 기본 미세 우주 먼지 가스 구름
        pSize = 0.01 + rand1 * 0.012;
        color.setHSL(0.60 + rand2 * 0.08, 0.7, 0.45); // 딥스페이스 블루 톤
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      sizes[i] = pSize;

      // 애니메이션 연산용 개별 물리 데이터 팩 저장
      this.particleData.push({
        baseX: x,
        baseY: y,
        baseZ: z,
        radius: radius,
        angle: angle,
        speed: 0.1 + rand1 * 0.4,
        twinkleSpeed: 2.0 + rand2 * 8.0,
        type: rand4 < 0.07 ? 'star' : 'gas', // 항성과 가스 구름 분리
        baseSize: pSize
      });
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // 💡 [WebGL 하이엔드 테크닉] 파티클별 고유 크기 처리를 위해 셰이더 확장 꼼수 적용
    // 텍스처를 쓰지 않고 기본 원형 점 형태로 깔끔하게 떨어지도록 매테리얼 셋업
    this.material = new THREE.PointsMaterial({
      size: 1.0,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending, // 빛이 겹칠수록 눈부시게 폭발하는 연출
      depthWrite: false
    });

    // 버텍스별 가변 크기를 런타임에 직접 밀어넣기 위한 전처리 적용
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        `attribute float pSize;
         void main() {`
      );
      shader.vertexShader = shader.vertexShader.replace(
        'gl_PointSize = size;',
        'gl_PointSize = size * pSize;'
      );
    };

    this.geometry.setAttribute('pSize', new THREE.BufferAttribute(sizes, 1));

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera || !this.points) return;

    const time = Date.now() * 0.001;
    const positions = this.geometry.attributes.position.array;
    const sizes = this.geometry.attributes.pSize.array;

    // 실시간 오디오 4대역 주파수 매핑 가중치 추출
    const subBass = audioData ? audioData.subBass : 0;
    const bass = audioData ? audioData.bass : 0;
    const mid = audioData ? audioData.mid : 0;
    const treble = audioData ? audioData.treble : 0;
    const volume = audioData ? audioData.volume : 0;

    for (let i = 0; i < this.particleCount; i++) {
      const data = this.particleData[i];

      // 💡 [3중 중복 수학적 노이즈 흐름 연산 구현]
      // 노이즈 1 (거대한 우주 거시 기류): 시간의 흐름에 따라 은하계 전체가 은은하게 자전
      let currentAngle = data.angle + time * 0.015 * data.speed;

      // 노이즈 2 (중간 소용돌이 줄기): Bass/Mid 주파수 파워에 비례해 반경 중심축이 비틀어지며 꼬임
      const noise2 = Math.sin(data.radius * 1.5 - time * 2.0) * (bass * 0.4 + mid * 0.2);
      currentAngle += noise2 / data.radius;

      // 노이즈 3 (마이크로 가스 구름 파르르 떨림): Treble(고음)에 연동해 외곽 궤도가 자잘하게 진동
      const noise3 = Math.cos(time * data.twinkleSpeed) * (treble * 0.15);

      // 최종 계산된 3중 필터링 좌표계를 포지션 버퍼에 다이렉트 이식
      const finalRadius = data.radius + noise3 + (subBass * 0.3); // 저음에 맞춰 전체 팽창
      
      positions[i * 3] = Math.cos(currentAngle) * finalRadius;
      positions[i * 3 + 1] = data.baseY + Math.sin(time * data.speed + data.radius) * (mid * 0.15);
      positions[i * 3 + 2] = Math.sin(currentAngle) * finalRadius;

      // 3. ✨ 크고 밝은 항성별들의 독립적 반짝임 인터랙션
      if (data.type === 'star') {
        // Sub-Bass 드럼 타격 시 순간적으로 항성의 크기가 강렬하게 증폭
        sizes[i] = data.baseSize * (1.0 + subBass * 2.5 + Math.sin(time * data.twinkleSpeed) * 0.25);
      } else {
        // 일반 가스 입자는 고음 주파수 리듬에 따라 은은하게 페이드
        sizes[i] = data.baseSize * (1.0 + treble * 1.2);
      }
    }

    // GPU에게 데이터가 실시간으로 변경되었음을 전송하여 동기화 가동
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.pSize.needsUpdate = true;

    // 우주 전체 공간을 마스터 음악 볼륨 세기에 따라 아주 몽환적으로 자전 슬로우 틸트 처리
    this.points.rotation.y = time * 0.01 + (volume * 0.04);

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
    if (this.points) {
      this.scene.remove(this.points);
      this.geometry.dispose();
      this.material.dispose();
    }
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particleData = [];
  }
}
