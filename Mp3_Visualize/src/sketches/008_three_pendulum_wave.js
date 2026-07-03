/**
 * 008_three_pendulum_wave.js
 * 고정된 4x4 그리드, 비트 타격(Spike) 감지형 카오스 진자 물리 엔진 및 100% 개별 랜덤 컬러 시스템
 */
export default class ThreePendulumWave {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.numPendulums = 16; // 4x4 그리드
    
    this.a1 = new Float32Array(this.numPendulums);
    this.a2 = new Float32Array(this.numPendulums);
    this.a1_v = new Float32Array(this.numPendulums);
    this.a2_v = new Float32Array(this.numPendulums);
    this.x0 = new Float32Array(this.numPendulums);
    this.y0 = new Float32Array(this.numPendulums);

    // 💡 비트 타격 감지를 위한 이전 프레임 주파수 스무딩 배열 추가
    this.smoothedFreq = new Float32Array(this.numPendulums);

    // 진자 기준 스펙 (Center Scatter 에 의해 크기만 런타임 증폭됨)
    this.baseL1 = 0.9;
    this.baseL2 = 0.8;
    this.m1 = 1.2;
    this.m2 = 1.2;
    this.g = 0.4;

    this.linesGeo = null;
    this.pointsGeo = null;
    this.linesMesh = null;
    this.pointsMesh = null;

    this.loadedSeed = -1;
    this.invertFrequency = false;
    this.colorStyle = '';
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010103, 0.04);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 9);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x010103);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    this.buildPendulumGrid();
  }

  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  buildPendulumGrid() {
    const linePositions = new Float32Array(this.numPendulums * 4 * 3);
    const lineColors = new Float32Array(this.numPendulums * 4 * 3); 
    const pointPositions = new Float32Array(this.numPendulums * 2 * 3);
    const pointColors = new Float32Array(this.numPendulums * 2 * 3);

    for (let i = 0; i < this.numPendulums; i++) {
      this.a1[i] = Math.PI + (i * 0.02);
      this.a2[i] = Math.PI - (i * 0.02);
      this.a1_v[i] = 0;
      this.a2_v[i] = 0;
      this.smoothedFreq[i] = 0; // 스무딩 초기화
    }

    this.linesGeo = new THREE.BufferGeometry();
    this.linesGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    this.linesGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3)); 

    this.pointsGeo = new THREE.BufferGeometry();
    this.pointsGeo.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
    this.pointsGeo.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));

    const lineMat = new THREE.LineBasicMaterial({ 
      vertexColors: true, 
      transparent: true, 
      opacity: 0.7 
    });

    const pointMat = new THREE.PointsMaterial({
      size: 0.4,
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
    gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    let seed = 42, scatter = 2.2, glow = 0.85, gain = 1.0;
    let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

    if (window.cosmicEngineSettings) {
      seed = window.cosmicEngineSettings.seed;
      scatter = window.cosmicEngineSettings.scatterExponent; 
      glow = window.cosmicEngineSettings.glowIntensity;      
      gain = window.cosmicEngineSettings.audioGain;          
      customColors = window.cosmicEngineSettings.customColors;
      this.colorStyle = window.cosmicEngineSettings.colorStyle;
    }

    if (this.loadedSeed !== seed) {
      this.loadedSeed = seed;
      this.invertFrequency = (seed % 2 === 0);
      
      for(let i=0; i<this.numPendulums; i++) {
        const randAngle = this.seededRandom(seed + i) * 0.2;
        this.a1[i] = Math.PI + randAngle;
        this.a2[i] = Math.PI - randAngle;
      }
    }

    this.pointsMesh.material.size = Math.max(0.1, glow * 0.45);
    this.pointsMesh.material.opacity = Math.min(1.0, glow);
    this.linesMesh.material.opacity = Math.min(1.0, glow * 0.8);

    const aspect = this.camera.aspect;

    // 💡 [그리드 위치 완전 고정] 뷰포트 크기에 맞춰 간격만 고정 계산 (scatter 제외)
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 9 * 2; 
    const viewWidth = viewHeight * aspect;
    const stepX = (viewWidth / 4);
    const stepY = (viewHeight / 4);

    // 💡 [크기만 조절] 분산 범위 슬라이더는 진자의 팔 길이만 줌인/줌아웃 하듯 조절
    const scatterScale = scatter / 2.2;
    const curL1 = this.baseL1 * scatterScale;
    const curL2 = this.baseL2 * scatterScale;

    const freqBins = new Float32Array(this.numPendulums);
    if (audioData) {
      for (let i = 0; i < this.numPendulums; i++) {
        let factor = i / (this.numPendulums - 1);
        if (factor < 0.25) freqBins[i] = THREE.MathUtils.lerp(audioData.subBass, audioData.bass, factor * 4.0);
        else if (factor < 0.75) freqBins[i] = THREE.MathUtils.lerp(audioData.bass, audioData.mid, (factor - 0.25) * 2.0);
        else freqBins[i] = THREE.MathUtils.lerp(audioData.mid, audioData.treble, (factor - 0.75) * 4.0);
        
        freqBins[i] *= gain * 4.0;
      }
    }

    const lPos = this.linesGeo.attributes.position.array;
    const lCol = this.linesGeo.attributes.color.array;
    const pPos = this.pointsGeo.attributes.position.array;
    const pCol = this.pointsGeo.attributes.color.array;
    const mu = 1 + this.m1 / this.m2;

    for (let i = 0; i < this.numPendulums; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      
      const bx = (col - 1.5) * stepX;
      const by = (1.5 - row) * stepY;

      const targetBinIdx = this.invertFrequency ? (this.numPendulums - 1 - i) : i;
      const currentFreqForce = freqBins[targetBinIdx];
      const prevFreq = this.smoothedFreq[i];

      // 💡 [비트 타격 감지 엔진] 소리가 전 프레임 대비 급격히 튀어오를 때(Spike)만 계산
      let impulse = 0;
      if (currentFreqForce > prevFreq + 0.02) { 
        impulse = (currentFreqForce - prevFreq); 
      }
      
      // 스무딩 변수 업데이트 (부드러운 하강선을 위해 lerp 적용)
      this.smoothedFreq[i] += (currentFreqForce - this.smoothedFreq[i]) * 0.2;

      // 💡 [랜덤 타격력 주입] 주파수가 튈 때만 1, 2관절에 각기 다른 방향과 세기로 힘을 때려 넣음
      if (impulse > 0) {
        // 매번 무작위 방향(정방향/역방향)으로 쳐서 선풍기처럼 도는 현상 방지
        const randDir1 = Math.random() > 0.5 ? 1 : -1;
        const randDir2 = Math.random() > 0.5 ? 1 : -1;
        
        // 관절마다 다른 비율의 힘을 가해 카오스 움직임을 극대화
        this.a1_v[i] += impulse * 0.15 * randDir1;
        this.a2_v[i] += impulse * 0.20 * randDir2;
      }

      const dAngle = this.a1[i] - this.a2[i];
      
      const num1 = this.g * (Math.sin(this.a2[i]) * Math.cos(dAngle) - mu * Math.sin(this.a1[i])) - 
                  (curL2 * this.a2_v[i] * this.a2_v[i] + curL1 * this.a1_v[i] * this.a1_v[i] * Math.cos(dAngle)) * Math.sin(dAngle);
      const den1 = curL1 * (mu - Math.cos(dAngle) * Math.cos(dAngle));
      const a1_a = num1 / den1;

      const num2 = this.g * mu * (Math.sin(this.a1[i]) * Math.cos(dAngle) - Math.sin(this.a2[i])) + 
                  (mu * curL1 * this.a1_v[i] * this.a1_v[i] + curL2 * this.a2_v[i] * this.a2_v[i] * Math.cos(dAngle)) * Math.sin(dAngle);
      const den2 = curL2 * (mu - Math.cos(dAngle) * Math.cos(dAngle));
      const a2_a = num2 / den2;

      this.a1_v[i] += a1_a * 0.04;
      this.a2_v[i] += a2_a * 0.04;
      this.a1[i] += this.a1_v[i] * 0.1;
      this.a2[i] += this.a2_v[i] * 0.1;

      // 💡 [급정거 브레이크 마찰력] 기존 0.985 -> 0.94로 대폭 낮춰서 타격 후 금방 진정되게 만듦
      this.a1_v[i] *= 0.94;
      this.a2_v[i] *= 0.94;

      const px1 = bx + curL1 * Math.sin(this.a1[i]);
      const py1 = by - curL1 * Math.cos(this.a1[i]);
      const px2 = px1 + curL2 * Math.sin(this.a2[i]);
      const py2 = py1 - curL2 * Math.cos(this.a2[i]);

      const lIdx = i * 12;
      lPos[lIdx] = bx;   lPos[lIdx+1] = by;   lPos[lIdx+2] = 0;
      lPos[lIdx+3] = px1; lPos[lIdx+4] = py1; lPos[lIdx+5] = 0;
      lPos[lIdx+6] = px1; lPos[lIdx+7] = py1; lPos[lIdx+8] = 0;
      lPos[lIdx+9] = px2; lPos[lIdx+10] = py2; lPos[lIdx+11] = 0;

      const pIdx = i * 6;
      pPos[pIdx] = px1;   pPos[pIdx+1] = py1;   pPos[pIdx+2] = 0.01;
      pPos[pIdx+3] = px2; pPos[pIdx+4] = py2; pPos[pIdx+5] = 0.02;

      let c1 = new THREE.Color();
      let c2 = new THREE.Color();

      if (this.colorStyle === 'full-random') {
        const uniqueHue = this.seededRandom(seed + i * 123);
        c1.setHSL(uniqueHue, 0.8, 0.5);
        c2.setHSL((uniqueHue + 0.15) % 1.0, 1.0, 0.7);
      } else if (this.colorStyle === 'neon') {
        if (i % 2 === 0) { c1.setHSL(0.93, 0.9, 0.55); c2.setHSL(0.48, 1.0, 0.45); }
        else { c1.setHSL(0.48, 1.0, 0.45); c2.setHSL(0.93, 0.9, 0.55); }
      } else if (this.colorStyle === 'pastel') {
        if (i % 2 === 0) { c1.setHSL(0.74, 0.4, 0.65); c2.setHSL(0.10, 0.9, 0.85); }
        else { c1.setHSL(0.06, 0.5, 0.7); c2.setHSL(0.74, 0.4, 0.65); }
      } else if (this.colorStyle === 'custom') {
        c1.set(customColors.gas1);
        c2.set(customColors.gas2);
      } else {
        c1.setHex(0x00ffcc);
        c2.setHex(0xffffff);
      }

      const kineticEnergy = Math.abs(this.a1_v[i]) + Math.abs(this.a2_v[i]);
      const glowBoost = Math.min(1.0, kineticEnergy * 0.15);
      
      c2.lerp(new THREE.Color(0xffffff), glowBoost * 0.5);

      lCol[lIdx] = c1.r; lCol[lIdx+1] = c1.g; lCol[lIdx+2] = c1.b;
      lCol[lIdx+3] = c1.r; lCol[lIdx+4] = c1.g; lCol[lIdx+5] = c1.b;
      lCol[lIdx+6] = c1.r; lCol[lIdx+7] = c1.g; lCol[lIdx+8] = c1.b;
      lCol[lIdx+9] = c2.r; lCol[lIdx+10] = c2.g; lCol[lIdx+11] = c2.b;

      pCol[pIdx] = c1.r; pCol[pIdx+1] = c1.g; pCol[pIdx+2] = c1.b;
      pCol[pIdx+3] = c2.r; pCol[pIdx+4] = c2.g; pCol[pIdx+5] = c2.b;
    }

    this.linesGeo.attributes.position.needsUpdate = true;
    this.linesGeo.attributes.color.needsUpdate = true; 
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
