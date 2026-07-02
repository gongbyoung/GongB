/**
 * 007_three_cosmic_nebula.js
 * 부드러운 가스 구 구름 텍스처 빌드 기능 및 실시간 전역 UI 슬라이더 매핑 우주 성운 스테이지
 */
export default class ThreeRealNebula {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    this.particleCount = 25000; // 가스 구름의 아날로그 질감을 위해 입자 밀도를 25,000개로 극대화
    this.geometry = null;
    this.material = null;
    this.points = null;
    this.particleData = [];

    this.loadedSeed = 42; // 현재 그래픽에 고정 반영된 씨드 상태 추적 변수
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    // 딥 스페이스 안개 농도를 조율하여 배경의 깊은 입체감 형성
    this.scene.fog = new THREE.FogExp2(0x010103, 0.04);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 10, 0); // 우주 성운 탑뷰(Top-view) 관측 각도 고정
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x010103);
    this.container.appendChild(this.renderer.domElement);

    // 은하 심연을 비출 기본 우주 앰비언트 라이트
    this.scene.add(new THREE.AmbientLight(0x111122, 0.8));

    // 최초 우주 성단 데이터 조립 시동
    this.buildCosmos();
  }

  /**
   * 💡 [태풍 사각형 소멸 핵심 마법] 
   * HTML Canvas를 메모리에 가상으로 만들어 중심부는 밝고 외곽은 흐릿하게 지워지는 
   * 원형 그라데이션 '성운 가스 텍스처'를 브라우저 런타임에 직접 구워내 뿜어줍니다.
   */
  createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // 방사형 그라데이션 브러시 정의
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)'); // 중심핵
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)'); // 외곽 안개 처리

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  buildCosmos() {
    // 💡 전역 변수에서 현재 유저가 세팅한 씨드값을 즉시 긁어와 대입
    if (window.cosmicEngineSettings) {
      this.currentSeed = window.cosmicEngineSettings.seed;
      this.colorStyle = window.cosmicEngineSettings.colorStyle;
    } else {
      this.currentSeed = 42;
      this.colorStyle = 'monochrome';
    }
    this.loadedSeed = this.currentSeed;

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
      sRandom = this.seededRandom(sRandom) * 1000;
      const rand1 = this.seededRandom(sRandom + 1);
      const rand2 = this.seededRandom(sRandom + 2);
      const rand3 = this.seededRandom(sRandom + 3);
      const rand4 = this.seededRandom(sRandom + 4);

      // 성운 가스 구름 및 독립 성단의 극좌표계 나선 소용돌이 분포 연산
      const angle = rand1 * Math.PI * 2;
      // 중심핵 부분에 가스가 뭉치고 외곽으로 흐릿하게 퍼지도록 수학적 밀도 압축 감쇄 적용
      const radius = Math.pow(rand2, 2.2) * 9.0 + 0.1;

      const x = Math.cos(angle) * radius;
      const y = (rand3 - 0.5) * 0.45; // 원반 성운의 슬림한 깊이감 구조
      const z = Math.sin(angle) * radius;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // 천체 사진의 현실감을 가를 대소(大小) 및 명암 파티클 가중치 분배
      let pSize = 0.02;
      let color = new THREE.Color();
      let starType = 'gas';

      if (rand4 < 0.06) {
        // 상위 6%의 선명하고 거대한 항성별
        pSize = 0.15 + rand1 * 0.25; 
        starType = 'star';
      } else if (rand4 < 0.30) {
        // 중간 성단 고밀도 벨트
        pSize = 0.04 + rand1 * 0.05;
      } else {
        // 은하 가스 성운 베이스
        pSize = 0.012 + rand1 * 0.015;
      }

      // 🎨 실시간 컬러 테마 프리셋 연동 연산
      if (this.colorStyle === 'neon') {
        // 용골자리 성운풍 강력한 사이버 네온 (핑크 & 민트)
        if (starType === 'star') color.setHSL(0.55 + rand2 * 0.05, 1.0, 0.9); // 선명한 별빛 화이트 민트
        else if (i % 2 === 0) color.setHSL(0.93 + rand2 * 0.03, 0.9, 0.55); // 성운 가스 핑크
        else color.setHSL(0.48 + rand2 * 0.04, 1.0, 0.45); // 성운 가스 민트
      } 
      else if (this.colorStyle === 'pastel') {
        // 은하수 전경의 안드로메다풍 몽환적 파스텔 (바이올렛 & 골드)
        if (starType === 'star') color.setHSL(0.10 + rand2 * 0.04, 0.9, 0.85); // 골드 브라이트 스타
        else if (i % 2 === 0) color.setHSL(0.74 + rand2 * 0.06, 0.4, 0.65); // 파스텔 보라 가스
        else color.setHSL(0.06 + rand2 * 0.04, 0.5, 0.7);  // 살구빛 소프트 가스
      } 
      else {
        // Monochrome: 시원하고 세련된 천체 허블 망원경 청록 단색 톤
        if (starType === 'star') color.setHex(0xffffff);
        else color.setHSL(0.52 + rand2 * 0.06, 0.9, 0.45);
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      sizes[i] = pSize;

      this.particleData.push({
        baseX: x, baseY: y, baseZ: z, radius: radius, angle: angle,
        speed: 0.08 + rand1 * 0.35,
        twinkleSpeed: 3.0 + rand2 * 9.0,
        type: starType,
        baseSize: pSize
      });
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // 💡PointsMaterial에 방금 가상으로 구워낸 부드러운 원형 그라데이션 글로우 텍스처 강제 주입!
    this.material = new THREE.PointsMaterial({
      size: 1.0,
      map: this.createGlowTexture(), // 💥 하얀 사각형 파괴 부품 주입
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending, // 빛이 중첩될수록 실제 가스 성운처럼 화사하게 융합
      depthWrite: false
    });

    // 가변 입자 런타임 셰이더 바인딩 전개
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
    
    console.log(`[🌌 007 Engine] 천체 성운 기하학 배치 완료 (Seed: ${this.currentSeed}, Theme: ${this.colorStyle})`);
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera || !this.points) return;

    // 💡 매 프레임 루프 때마다 전역 window 창고에서 실시간 슬라이더 조작 수치를 비동기 딜레이 없이 즉시 마스킹 획득
    if (window.cosmicEngineSettings) {
      this.colorStyle = window.cosmicEngineSettings.colorStyle;
      this.material.opacity = window.cosmicEngineSettings.glowIntensity; // 실시간 글로우 불투명도 조절
      this.audioGain = window.cosmicEngineSettings.audioGain;
    }

    const time = Date.now() * 0.001;
    const positions = this.geometry.attributes.position.array;
    const sizes = this.geometry.attributes.pSize.array;

    // 💡 [수동 움직임 강도 컨트롤] 유저의 오디오 모션 마스터 슬라이더(audioGain) 수치를 곱해 강도 조율 제어
    const gain = this.audioGain;
    const subBass = audioData ? audioData.subBass * gain : 0;
    const bass    = audioData ? audioData.bass * gain : 0;
    const mid     = audioData ? audioData.mid * gain : 0;
    const treble  = audioData ? audioData.treble * gain : 0;
    const volume  = audioData ? audioData.volume * gain : 0;

    for (let i = 0; i < this.particleCount; i++) {
      const data = this.particleData[i];

      // 🌌 3중 중복 수학적 노이즈 흐름 가동
      // 흐름 1: 은하계 전역 자전 기류
      let currentAngle = data.angle + time * 0.008 * data.speed;
      
      // 흐름 2: 음악 저음/중음 비트에 반응해 줄기 형태로 소용돌이치며 꼬이는 노이즈
      const noise2 = Math.sin(data.radius * 1.3 - time * 2.0) * (bass * 0.5 + mid * 0.25);
      currentAngle += noise2 / data.radius;

      // 흐름 3: 고음(Treble)에 호응해 파르르 흔들리는 마이크로 가스 디테일 기류
      const noise3 = Math.cos(time * data.twinkleSpeed) * (treble * 0.16);
      const finalRadius = data.radius + noise3 + (subBass * 0.4); // 드럼 타격 시 외곽으로 성운 전체 팽창

      positions[i * 3] = Math.cos(currentAngle) * finalRadius;
      positions[i * 3 + 1] = data.baseY + Math.sin(time * data.speed + data.radius) * (mid * 0.16);
      positions[i * 3 + 2] = Math.sin(currentAngle) * finalRadius;

      // 항성별과 기본 가스 구름의 독립적 리듬 분리 분리
      if (data.type === 'star') {
        // 드럼이 쿵쾅거릴 때 대형 항성들이 렌즈 플레어처럼 압도적인 크기로 번쩍이며 반응
        sizes[i] = data.baseSize * (1.2 + subBass * 3.2 + Math.sin(time * data.twinkleSpeed) * 0.35);
      } else {
        // 미세 가스들은 고음 리듬을 타며 찰랑거림
        sizes[i] = data.baseSize * (1.0 + treble * 1.5);
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.pSize.needsUpdate = true;

    // 은하 전경 슬로우 자전 연출 연출
    this.points.rotation.y = time * 0.006 + (volume * 0.04);

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
