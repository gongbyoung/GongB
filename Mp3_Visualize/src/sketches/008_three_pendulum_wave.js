/**
 * 008_three_pendulum_wave.js
 * 300개의 2중 진자 격자 군단과 오디오 주파수 파동 공명 스테이지
 */
export default class ThreePendulumWave {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // 진자 군단 세팅 (20 x 15 = 300개)
    this.cols = 20;
    this.rows = 15;
    this.numPendulums = this.cols * this.rows;
    
    // 물리 데이터 배열 (빠른 연산을 위한 1차원 플랫 배열)
    this.a1 = new Float32Array(this.numPendulums);
    this.a2 = new Float32Array(this.numPendulums);
    this.a1_v = new Float32Array(this.numPendulums);
    this.a2_v = new Float32Array(this.numPendulums);
    this.x0 = new Float32Array(this.numPendulums);
    this.y0 = new Float32Array(this.numPendulums);

    // 진자 공통 스펙
    this.l1 = 0.45; // 1번 마디 길이
    this.l2 = 0.45; // 2번 마디 길이
    this.m1 = 1.0;  // 1번 마디 질량
    this.m2 = 1.0;  // 2번 마디 질량
    this.g = 0.3;   // 기본 중력

    // 시각화 버퍼
    this.linesGeo = null;
    this.pointsGeo = null;
    this.linesMesh = null;
    this.pointsMesh = null;

    // 주파수 파장 진원지 (Seed에 의해 변경됨)
    this.waveCenters = [
      { x: 0, y: 0 }, // SubBass 진원지
      { x: 0, y: 0 }, // Bass 진원지
      { x: 0, y: 0 }, // Mid 진원지
      { x: 0, y: 0 }  // Treble 진원지
    ];
    this.loadedSeed = -1;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x020205, 0.03);

    // 카메라 화면 가득 채우기 배치
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 12);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x020205);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    this.buildPendulumGrid();
  }

  // 💡 수학적 난수 생성기
  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  buildPendulumGrid() {
    const linePositions = new Float32Array(this.numPendulums * 4 * 3); // 진자 1개당 선분 2개(점4개)
    const pointPositions = new Float32Array(this.numPendulums * 2 * 3); // 진자 1개당 관절 2개
    const pointColors = new Float32Array(this.numPendulums * 2 * 3);

    const spacingX = 16.0 / this.cols;
    const spacingY = 12.0 / this.rows;

    let idx = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        // 격자 배치
        this.x0[idx] = (c - this.cols / 2 + 0.5) * spacingX;
        this.y0[idx] = (r - this.rows / 2 + 0.5) * spacingY;
        
        // 초기 각도는 약간의 노이즈를 섞어 정렬
        this.a1[idx] = Math.PI + (Math.random() - 0.5) * 0.1;
        this.a2[idx] = Math.PI + (Math.random() - 0.5) * 0.1;
        this.a1_v[idx] = 0;
        this.a2_v[idx] = 0;
        idx++;
      }
    }

    this.linesGeo = new THREE.BufferGeometry();
    this.linesGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

    this.pointsGeo = new THREE.BufferGeometry();
    this.pointsGeo.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
    this.pointsGeo.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));

    // 선(팔) 매테리얼
    const lineMat = new THREE.LineBasicMaterial({ 
      color: 0x445566, 
      transparent: true, 
      opacity: 0.5 
    });

    // 💡 글로우 점(관절) 매테리얼 (가상 텍스처 적용)
    const pointMat = new THREE.PointsMaterial({
      size: 0.3,
      map: this.createGlowTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.linesMesh = new THREE.LineSegments(this.linesGeo, lineMat);
    this.pointsMesh = new THREE.Points(this.pointsGeo, pointMat);

    this.scene.add(this.linesMesh);
    this.scene.add(this.pointsMesh);
  }

  createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    // 1. UI 설정값 리딩
    let seed = 42, scatter = 2.2, glow = 0.85, gain = 1.0;
    let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

    if (window.cosmicEngineSettings) {
      seed = window.cosmicEngineSettings.seed;
      scatter = window.cosmicEngineSettings.scatterExponent; // 파장 크기 및 속도
      glow = window.cosmicEngineSettings.glowIntensity;      // 발광 크기
      gain = window.cosmicEngineSettings.audioGain;          // 폭발력 (물리 힘)
      customColors = window.cosmicEngineSettings.customColors;
    }

    // 💡 2. 지형 변경 (Seed): 주파수가 발생할 X, Y 진원지를 재배치
    if (this.loadedSeed !== seed) {
      this.loadedSeed = seed;
      for (let i = 0; i < 4; i++) {
        const randX = this.seededRandom(seed + i * 10);
        const randY = this.seededRandom(seed + i * 20);
        this.waveCenters[i].x = (randX - 0.5) * 16;
        this.waveCenters[i].y = (randY - 0.5) * 12;
      }
      
      // 선 색상 실시간 연동
      this.linesMesh.material.color.set(customColors.star);
    }

    // 글로우 UI 연동
    this.pointsMesh.material.opacity = Math.min(1.0, glow);
    this.pointsMesh.material.size = Math.max(0.1, glow * 0.35);
    this.linesMesh.material.opacity = Math.min(0.8, glow * 0.4);

    const time = Date.now() * 0.002;
    
    // 오디오 신호 배열화
    const audioBands = [
      (audioData ? audioData.subBass : 0) * gain * 3.5, // 0: SubBass
      (audioData ? audioData.bass : 0) * gain * 2.5,    // 1: Bass
      (audioData ? audioData.mid : 0) * gain * 2.0,     // 2: Mid
      (audioData ? audioData.treble : 0) * gain * 1.5   // 3: Treble
    ];

    const lPos = this.linesGeo.attributes.position.array;
    const pPos = this.pointsGeo.attributes.position.array;
    const pCol = this.pointsGeo.attributes.color.array;

    const col1 = new THREE.Color(customColors.gas1);
    const col2 = new THREE.Color(customColors.gas2);

    const mu = 1 + this.m1 / this.m2;

    // 3. 💥 300개 2중 진자의 혼돈 물리 및 파장 연산 루프
    for (let i = 0; i < this.numPendulums; i++) {
      const bx = this.x0[i];
      const by = this.y0[i];

      // [파장 연산] 4개의 주파수 진원지로부터 진동(Force)이 얼마나 도달했는지 계산
      let totalForce = 0;
      for (let w = 0; w < 4; w++) {
        const dx = bx - this.waveCenters[w].x;
        const dy = by - this.waveCenters[w].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // 거리에 따른 사인파 파동 + Scatter(분산) 슬라이더로 파장 간격 조율
        const wave = Math.sin(dist * (6.0 - scatter) - time * 3.0);
        totalForce += wave * audioBands[w] * (1.0 / (dist * 0.5 + 1.0));
      }

      // 파동의 힘을 진자의 각속도에 밀어넣음 (바람이 불듯 진자를 때림)
      this.a1_v[i] += totalForce * 0.05;
      this.a2_v[i] += totalForce * 0.05;

      // [2중 진자 물리 엔진 (Euler-Lagrange)]
      const dAngle = this.a1[i] - this.a2[i];
      
      const num1 = this.g * (Math.sin(this.a2[i]) * Math.cos(dAngle) - mu * Math.sin(this.a1[i])) - 
                  (this.l2 * this.a2_v[i] * this.a2_v[i] + this.l1 * this.a1_v[i] * this.a1_v[i] * Math.cos(dAngle)) * Math.sin(dAngle);
      const den1 = this.l1 * (mu - Math.cos(dAngle) * Math.cos(dAngle));
      const a1_a = num1 / den1;

      const num2 = this.g * mu * (Math.sin(this.a1[i]) * Math.cos(dAngle) - Math.sin(this.a2[i])) + 
                  (mu * this.l1 * this.a1_v[i] * this.a1_v[i] + this.l2 * this.a2_v[i] * this.a2_v[i] * Math.cos(dAngle)) * Math.sin(dAngle);
      const den2 = this.l2 * (mu - Math.cos(dAngle) * Math.cos(dAngle));
      const a2_a = num2 / den2;

      this.a1_v[i] += a1_a * 0.05;
      this.a2_v[i] += a2_a * 0.05;
      this.a1[i] += this.a1_v[i] * 0.1;
      this.a2[i] += this.a2_v[i] * 0.1;

      // 마찰력 (공기 저항)
      this.a1_v[i] *= 0.98;
      this.a2_v[i] *= 0.98;

      // X, Y 좌표 역계산
      const px1 = bx + this.l1 * Math.sin(this.a1[i]);
      const py1 = by - this.l1 * Math.cos(this.a1[i]);
      const px2 = px1 + this.l2 * Math.sin(this.a2[i]);
      const py2 = py1 - this.l2 * Math.cos(this.a2[i]);

      // 버퍼 포지션 업데이트 (선 그리기)
      const lIdx = i * 12; 
      lPos[lIdx] = bx;   lPos[lIdx+1] = by;   lPos[lIdx+2] = 0;
      lPos[lIdx+3] = px1; lPos[lIdx+4] = py1; lPos[lIdx+5] = 0;
      lPos[lIdx+6] = px1; lPos[lIdx+7] = py1; lPos[lIdx+8] = 0;
      lPos[lIdx+9] = px2; lPos[lIdx+10] = py2; lPos[lIdx+11] = 0;

      // 버퍼 포지션 업데이트 (관절 점 그리기)
      const pIdx = i * 6;
      pPos[pIdx] = px1;   pPos[pIdx+1] = py1;   pPos[pIdx+2] = 0.01;
      pPos[pIdx+3] = px2; pPos[pIdx+4] = py2; pPos[pIdx+5] = 0.02;

      // 운동 에너지(속도)에 따라 관절 색상 동적 변경
      const energy = Math.abs(this.a1_v[i]) + Math.abs(this.a2_v[i]);
      
      // 안쪽 관절 (가스 1 색상)
      pCol[pIdx]   = col1.r * (0.5 + energy * 0.5);
      pCol[pIdx+1] = col1.g * (0.5 + energy * 0.5);
      pCol[pIdx+2] = col1.b * (0.5 + energy * 0.5);
      
      // 바깥쪽 관절 (가스 2 색상 - 속도가 빠를수록 하얗게 번쩍임)
      pCol[pIdx+3] = Math.min(1.0, col2.r + energy * 0.3);
      pCol[pIdx+4] = Math.min(1.0, col2.g + energy * 0.3);
      pCol[pIdx+5] = Math.min(1.0, col2.b + energy * 0.3);
    }

    this.linesGeo.attributes.position.needsUpdate = true;
    this.pointsGeo.attributes.position.needsUpdate = true;
    this.pointsGeo.attributes.color.needsUpdate = true;

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
    if (this.linesGeo) {
      this.linesGeo.dispose();
      this.linesMesh.material.dispose();
      this.scene.remove(this.linesMesh);
    }
    if (this.pointsGeo) {
      this.pointsGeo.dispose();
      this.pointsMesh.material.dispose();
      this.scene.remove(this.pointsMesh);
    }
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
  }
}
