/**
 * 008_three_pendulum_wave.js
 * 2중 & 3중 진자의 물리적 혼돈 궤적과 오디오 주파수 공명 파장 시뮬레이터
 */
export default class ThreePendulumWave {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // 진자 시스템 물리 변수 정의
    this.doublePendulum = null;
    this.triplePendulum = null;
    
    // 배경 파동 파티클 시스템
    this.waveParticles = null;
    this.particleCount = 5000;
    this.waveOrigins = []; // 파동 발생원 저장 배열
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x020206, 0.05);

    // 탑뷰와 프론트뷰의 깊이감을 동시에 주는 시네마틱 카메라 배치
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x020206);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0x223344, 0.6));

    // 💡 진자 시스템 초기 물리 상태 세팅 (각도, 길이, 질량, 각속도)
    this.initPhysics();

    // 💡 배경 파장 파티클 그리드 빌드
    this.buildWaveGrid();
  }

  initPhysics() {
    // 1. 2중 진자 구조 세팅 (좌측 배치)
    this.doublePendulum = {
      x0: -2.5, y0: 2.0,
      l1: 1.8, l2: 1.5,
      m1: 2.0, m2: 2.0,
      a1: Math.PI / 2, a2: Math.PI / 3, // 초기 각도
      a1_v: 0.0, a2_v: 0.0,             // 초기 각속도
      trail: [],
      maxTrail: 120
    };

    // 2. 3중 진자 구조 세팅 (우측 배치)
    this.triplePendulum = {
      x0: 2.5, y0: 2.0,
      l1: 1.4, l2: 1.2, l3: 1.0,
      m1: 2.0, m2: 2.0, m3: 2.0,
      a1: Math.PI / 2, a2: Math.PI / 4, a3: Math.PI / 6,
      a1_v: 0.0, a2_v: 0.0, a3_v: 0.0,
      trail: [],
      maxTrail: 150
    };

    // 시각적 드로잉을 위한 뼈대 그룹 생성
    this.visualGroup = new THREE.Group();
    this.scene.add(this.visualGroup);
  }

  buildWaveGrid() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);

    for (let i = 0; i < this.particleCount; i++) {
      // 화면 전체 비율에 가득 차도록 사각형 격자 분포 형태로 초기화
      const x = (Math.random() - 0.5) * 16;
      const y = (Math.random() - 0.5) * 10;
      const z = (Math.random() - 0.5) * 2 - 2; // 진자 뒤쪽에 배치

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      const col = new THREE.Color(0x005577);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.waveMaterial = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });

    this.waveParticles = new THREE.Points(geo, this.waveMaterial);
    this.scene.add(this.waveParticles);
  }

  /**
   * 💡 2중 진자의 오일러-라그랑주 물리 방정식 적분 연산 루프
   */
  updateDoublePendulum(g, impulse) {
    const p = this.doublePendulum;
    
    // 오디오 비트 강도 타격 시 순간 물리 각속도 폭발
    if (impulse > 0.5) {
      p.a1_v += (Math.random() - 0.5) * impulse * 0.2;
      p.a2_v += (Math.random() - 0.5) * impulse * 0.2;
    }

    const mu = 1 + p.m1 / p.m2;
    const dAngle = p.a1 - p.a2;

    // 가속도 계산 수식 분모 분자 처리
    const num1 = g * (Math.sin(p.a2) * Math.cos(dAngle) - mu * Math.sin(p.a1)) - (p.l2 * p.a2_v * p.a2_v + p.l1 * p.a1_v * p.a1_v * Math.cos(dAngle)) * Math.sin(dAngle);
    const den1 = p.l1 * (mu - Math.cos(dAngle) * Math.cos(dAngle));
    const a1_a = num1 / den1; // 1번 마디 각가속도

    const num2 = g * mu * (Math.sin(p.a1) * Math.cos(dAngle) - Math.sin(p.a2)) + (mu * p.l1 * p.a1_v * p.a1_v + p.l2 * p.a2_v * p.a2_v * Math.cos(dAngle)) * Math.sin(dAngle);
    const den2 = p.l2 * (mu - Math.cos(dAngle) * Math.cos(dAngle));
    const a2_a = num2 / den2; // 2번 마디 각가속도

    // 속도 및 각도 업데이트
    p.a1_v += a1_a * 0.1;
    p.a2_v += a2_a * 0.1;
    p.a1 += p.a1_v * 0.1;
    p.a2 += p.a2_v * 0.1;

    // 감쇠 처리 (Friction)
    p.a1_v *= 0.995;
    p.a2_v *= 0.995;

    // 픽셀 좌표 역계산
    const x1 = p.x0 + p.l1 * Math.sin(p.a1);
    const y1 = p.y0 - p.l1 * Math.cos(p.a1);
    const x2 = x1 + p.l2 * Math.sin(p.a2);
    const y2 = y1 - p.l2 * Math.cos(p.a2);

    // 잔상 저장 및 충격 주기가 맞을 때 파동 발생원 추가
    p.trail.push(new THREE.Vector3(x2, y2, 0));
    if (p.trail.length > p.maxTrail) p.trail.shift();

    if (Math.abs(p.a2_v) > 0.15 && Math.random() < 0.2) {
      this.waveOrigins.push({ x: x2, y: y2, time: 0, strength: Math.abs(p.a2_v) });
    }

    return { x1, y1, x2, y2 };
  }

  /**
   * 💡 3중 진자의 고차 혼돈 가속도 간이 물리 연산 루프
   */
  updateTriplePendulum(g, impulse) {
    const p = this.triplePendulum;

    if (impulse > 0.5) {
      p.a1_v += (Math.random() - 0.5) * impulse * 0.15;
      p.a2_v += (Math.random() - 0.5) * impulse * 0.15;
      p.a3_v += (Math.random() - 0.5) * impulse * 0.15;
    }

    // 3중 결합 상호작용 의사 가속도 유도법
    const a1_a = (-g * Math.sin(p.a1) - 0.05 * p.a1_v + Math.sin(p.a2 - p.a1) * p.a2_v * p.a2_v) / p.l1;
    const a2_a = (-g * Math.sin(p.a2) - 0.05 * p.a2_v + Math.sin(p.a3 - p.a2) * p.a3_v * p.a3_v + Math.sin(p.a1 - p.a2) * p.a1_v * p.a1_v) / p.l2;
    const a3_a = (-g * Math.sin(p.a3) - 0.05 * p.a3_v + Math.sin(p.a2 - p.a3) * p.a2_v * p.a2_v) / p.l3;

    p.a1_v += a1_a * 0.1; p.a2_v += a2_a * 0.1; p.a3_v += a3_a * 0.1;
    p.a1 += p.a1_v * 0.1;   p.a2 += p.a2_v * 0.1;   p.a3 += p.a3_v * 0.1;

    p.a1_v *= 0.996; p.a2_v *= 0.996; p.a3_v *= 0.996;

    const x1 = p.x0 + p.l1 * Math.sin(p.a1);
    const y1 = p.y0 - p.l1 * Math.cos(p.a1);
    const x2 = x1 + p.l2 * Math.sin(p.a2);
    const y2 = y1 - p.l2 * Math.cos(p.a2);
    const x3 = x2 + p.l3 * Math.sin(p.a3);
    const y3 = y2 - p.l3 * Math.cos(p.a3);

    p.trail.push(new THREE.Vector3(x3, y3, 0));
    if (p.trail.length > p.maxTrail) p.trail.shift();

    if (Math.abs(p.a3_v) > 0.2 && Math.random() < 0.2) {
      this.waveOrigins.push({ x: x3, y: y3, time: 0, strength: Math.abs(p.a3_v) });
    }

    return { x1, y1, x2, y2, x3, y3 };
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    // 💡 우측 Cosmic Studio 패널 설정 값 실시간 전역 리딩
    let seed = 42, scatter = 2.2, glow = 0.85, gain = 1.0;
    let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

    if (window.cosmicEngineSettings) {
      seed = window.cosmicEngineSettings.seed;
      scatter = window.cosmicEngineSettings.scatterExponent; // 파장 크기 지수 변환
      glow = window.cosmicEngineSettings.glowIntensity;       // 발광 크기
      gain = window.cosmicEngineSettings.audioGain;           // 폭발력 배율
    }

    // 씨드 값의 변경 상태 추적
    if (this.prevSeed !== seed) {
      this.prevSeed = seed;
      this.frequencyOffset = (seed * 0.05); // 지형 변경용 주파수 위치 오프셋 결정
    }

    const time = Date.now() * 0.001;
    const bassPulse = audioData ? audioData.bass * gain : 0;
    const treblePulse = audioData ? audioData.treble * gain : 0;

    // 1. ⚙️ 물리 연산 가동: UI 폭발력(gain)을 기본 중력 상수에 곱해 진자 물리 속도 수동 튜닝
    const baseGravity = 0.4 * gain;
    const dPos = this.updateDoublePendulum(baseGravity, bassPulse);
    const tPos = this.updateTriplePendulum(baseGravity, bassPulse);

    // 2. 🌸 시각적 구조 드로잉 초기화 및 런타임 갱신
    while (this.visualGroup.children.length > 0) {
      const obj = this.visualGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
      this.visualGroup.remove(obj);
    }

    // 💡 글로우 발광 크기 및 수동 컬러 세팅 결합
    const pColor1 = new THREE.Color(customColors.gas1);
    const pColor2 = new THREE.Color(customColors.gas2);
    const starColor = new THREE.Color(customColors.star);

    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 * glow });
    const sphereMat1 = new THREE.MeshBasicMaterial({ color: pColor1, transparent: true, opacity: glow });
    const sphereMat2 = new THREE.MeshBasicMaterial({ color: pColor2, transparent: true, opacity: glow });
    const sphereMat3 = new THREE.MeshBasicMaterial({ color: starColor, transparent: true, opacity: glow });

    const sphereGeo = new THREE.SphereGeometry(0.12 * (1.0 + treblePulse), 16, 16);

    // 2중 진자 그리기
    const dpPoints = [new THREE.Vector3(this.doublePendulum.x0, this.doublePendulum.y0, 0), new THREE.Vector3(dPos.x1, dPos.y1, 0), new THREE.Vector3(dPos.x2, dPos.y2, 0)];
    const dpLineGeo = new THREE.BufferGeometry().setFromPoints(dpPoints);
    this.visualGroup.add(new THREE.Line(dpLineGeo, lineMat));

    const dpMesh = new THREE.Mesh(sphereGeo, sphereMat1);
    dpMesh.position.set(dPos.x2, dPos.y2, 0);
    this.visualGroup.add(dpMesh);

    // 3중 진자 그리기
    const tpPoints = [new THREE.Vector3(this.triplePendulum.x0, this.triplePendulum.y0, 0), new THREE.Vector3(tPos.x1, tPos.y1, 0), new THREE.Vector3(tPos.x2, tPos.y2, 0), new THREE.Vector3(tPos.x3, tPos.y3, 0)];
    const tpLineGeo = new THREE.BufferGeometry().setFromPoints(tpPoints);
    this.visualGroup.add(new THREE.Line(tpLineGeo, lineMat));

    const tpMesh = new THREE.Mesh(sphereGeo, sphereMat2);
    tpMesh.position.set(tPos.x3, tPos.y3, 0);
    this.visualGroup.add(tpMesh);

    // 3. 🌊 파동(Wave) 전파 및 파티클 간섭 연산
    // 파동 발생원 생명주기 관리
    this.waveOrigins.forEach(w => {
      w.time += 0.08;
    });
    this.waveOrigins = this.waveOrigins.filter(w => w.time < 6.0);

    const positions = this.waveParticles.geometry.attributes.position.array;
    const colors = this.waveParticles.geometry.attributes.color.array;

    // 💡 분산 범위(scatter) 슬라이더가 파동의 전파 속도 및 최대 크기 배율을 통제
    const waveSizeScale = scatter * 1.5; 
    const freqOffset = this.frequencyOffset || 0;

    for (let i = 0; i < this.particleCount; i++) {
      const px = positions[i * 3];
      const py = positions[i * 3 + 1];
      
      let totalDisplacement = 0;

      // 축적된 모든 관절 파동원과의 거리 계산 및 수학적 간섭 처리
      this.waveOrigins.forEach(w => {
        const dx = px - w.x;
        const dy = py - w.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const currentWaveRadius = w.time * waveSizeScale;
        
        if (dist < currentWaveRadius && dist > currentWaveRadius - 1.5) {
          // 동심원 사인파 진폭 가중치 부여
          const waveFactor = Math.sin((dist - currentWaveRadius) * 4.0) * w.strength * (1.0 / (dist + 0.5));
          totalDisplacement += waveFactor;
        }
      });

      // 💡 지형 변경(Seed 연동 주파수) 노이즈 값을 기반으로 한 Z축 출렁임 보정
      const baseNoise = Math.sin(px * 0.5 + freqOffset + time) * Math.cos(py * 0.5 + time) * 0.2;
      positions[i * 3 + 2] = -2 + totalDisplacement * 2.5 + baseNoise;

      // 파동 충격 강도에 따라 파티클의 네온 색상 실시간 가변 변조
      if (Math.abs(totalDisplacement) > 0.05) {
        colors[i * 3] = pColor2.r * glow;
        colors[i * 3 + 1] = pColor2.g * glow;
        colors[i * 3 + 2] = pColor2.b * glow;
      } else {
        // 평상시 딥스페이스 백그라운드 색상
        colors[i * 3] = THREE.MathUtils.lerp(colors[i * 3], 0.0, 0.1);
        colors[i * 3 + 1] = THREE.MathUtils.lerp(colors[i * 3 + 1], 0.2, 0.1);
        colors[i * 3 + 2] = THREE.MathUtils.lerp(colors[i * 3 + 2], 0.4, 0.1);
      }
    }

    this.waveParticles.geometry.attributes.position.needsUpdate = true;
    this.waveParticles.geometry.attributes.color.needsUpdate = true;

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
    while (this.visualGroup.children.length > 0) {
      const obj = this.visualGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
      this.visualGroup.remove(obj);
    }
    if (this.waveParticles) {
      this.waveParticles.geometry.dispose();
      this.waveMaterial.dispose();
    }
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.waveOrigins = [];
  }
}