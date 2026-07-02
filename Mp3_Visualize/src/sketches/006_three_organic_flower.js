/**
 * 006_three_organic_flower.js
 * 3중 노이즈 성운 가스 + 랜덤 씨드 재배치 + 컬러 프리셋 스위처 + 글로우 및 Gain 수동 인터랙션 제어형 스튜디오 스케치
 */
export default class ThreeCosmicNebula {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    this.particleCount = 20000; // 입자 수 증량으로 화려함 업그레이드
    this.geometry = null;
    this.material = null;
    this.points = null;
    this.particleData = [];

    // 💡 관제탑(main.js) 슬라이더와 실시간 양방향 매핑될 커스텀 변수 공간 정의
    this.currentSeed = 42;
    this.colorStyle = 'monochrome';
    this.glowIntensity = 0.85;
    this.audioGain = 1.0;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010103, 0.03);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 12, 0);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x010103);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0x222233, 0.5));

    this.buildCosmos();
  }

  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  /**
   * 💡 씨드 슬라이더 조작 시 실시간 호출되어 우주 지형을 무작위로 전면 리모델링하는 핵심 메커니즘
   */
  buildCosmos() {
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

      // 극좌표 은하 소용돌이 성운 분포 연산
      const angle = rand1 * Math.PI * 2;
      const radius = Math.pow(rand2, 1.8) * 8.5 + 0.1;

      const x = Math.cos(angle) * radius;
      const y = (rand3 - 0.5) * 0.35;
      const z = Math.sin(angle) * radius;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // 🎨 [스타일 가변 매핑 옵션 구역]
      let pSize = 0.015;
      let color = new THREE.Color();
      let starFlag = 'gas';

      // 7%는 현실적인 대형 항성별 분배
      if (rand4 < 0.07) {
        pSize = 0.07 + rand1 * 0.15;
        starFlag = 'star';
      } else if (rand4 < 0.35) {
        pSize = 0.025 + rand1 * 0.035;
      } else {
        pSize = 0.01 + rand1 * 0.01;
      }

      // UI 컬러 스타일 셀렉터 상태에 따른 실시간 테마 색상 셋업
      if (this.colorStyle === 'neon') {
        // 핫핑크 & 민트의 사이버펑크 네온 스타일 테마 테마
        if (starFlag === 'star') color.setHSL(0.95 + rand2 * 0.05, 1.0, 0.85);
        else if (i % 2 === 0) color.setHSL(0.92 + rand2 * 0.04, 0.9, 0.6); // 네온 핑크
        else color.setHSL(0.48 + rand2 * 0.04, 1.0, 0.55); // 네온 민트
      } 
      else if (this.colorStyle === 'pastel') {
        // 은은한 골드 & 연보랏빛 신비로운 파스텔 우주 테마
        if (starFlag === 'star') color.setHSL(0.12 + rand2 * 0.05, 0.8, 0.8); // 소프트 골드
        else if (i % 2 === 0) color.setHSL(0.75 + rand2 * 0.05, 0.5, 0.7); // 파스텔 바이올렛
        else color.setHSL(0.08 + rand2 * 0.04, 0.6, 0.75); // 은은한 살구 크림
      } 
      else {
        // Monochrome Cyan: 깔끔한 단색 네온 기반 주파수 스펙트럼
        if (starFlag === 'star') color.setHex(0xffffff);
        else color.setHSL(0.50 + rand2 * 0.08, 0.9, 0.5); // 청록 네온
      }

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      sizes[i] = pSize;

      this.particleData.push({
        baseX: x, baseY: y, baseZ: z, radius: radius, angle: angle,
        speed: 0.1 + rand1 * 0.4,
        twinkleSpeed: 2.0 + rand2 * 8.0,
        type: starFlag,
        baseSize: pSize
      });
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.material = new THREE.PointsMaterial({
      size: 1.0,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending, // 글로우 연출의 핵심 (빛 겹침 축적)
      depthWrite: false
    });

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

    // 💡 [수동 강도 제어] 오디오 수치 전체에 마스터 승수(audioGain)를 결합하여 움직이는 강도를 수동 제어합니다.
    const gain = this.audioGain;
    const subBass = audioData ? audioData.subBass * gain : 0;
    const bass    = audioData ? audioData.bass * gain : 0;
    const mid     = audioData ? audioData.mid * gain : 0;
    const treble  = audioData ? audioData.treble * gain : 0;
    const volume  = audioData ? audioData.volume * gain : 0;

    // 💡 [Glow 강도 조절] 슬라이더 수치를 입자들의 전역 투명도 마스터 스펙에 즉시 주입
    this.material.opacity = this.glowIntensity;

    for (let i = 0; i < this.particleCount; i++) {
      const data = this.particleData[i];

      // 3중 중복 노이즈 가스 구름 연산 가동
      let currentAngle = data.angle + time * 0.012 * data.speed;
      const noise2 = Math.sin(data.radius * 1.4 - time * 2.2) * (bass * 0.45 + mid * 0.22);
      currentAngle += noise2 / data.radius;

      const noise3 = Math.cos(time * data.twinkleSpeed) * (treble * 0.18);
      const finalRadius = data.radius + noise3 + (subBass * 0.35);

      positions[i * 3] = Math.cos(currentAngle) * finalRadius;
      positions[i * 3 + 1] = data.baseY + Math.sin(time * data.speed + data.radius) * (mid * 0.18);
      positions[i * 3 + 2] = Math.sin(currentAngle) * finalRadius;

      // 크고 밝은 별과 가스의 독립적 오디오 펄스 반응
      if (data.type === 'star') {
        sizes[i] = data.baseSize * (1.0 + subBass * 2.8 + Math.sin(time * data.twinkleSpeed) * 0.3);
      } else {
        sizes[i] = data.baseSize * (1.0 + treble * 1.5);
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.pSize.needsUpdate = true;

    // 전체 마스터 회전 효과
    this.points.rotation.y = time * 0.008 + (volume * 0.05);

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
