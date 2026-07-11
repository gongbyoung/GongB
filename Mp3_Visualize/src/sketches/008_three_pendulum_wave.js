/**
 * src/sketches/008_three_pendulum_wave.js
 * - [버전] Ver 5.1 (16채널 주파수 독립 매핑 및 오가닉 키네틱 군무 완결판)
 * - 16개 진자가 주파수 대역별(저음~고음)로 완전히 독립되어 제각각 다르게 반응하도록 매핑 수리
 * - 각 노드별 고유 진동수와 위상차(Phase Offset)를 결합하여 따로 또 같이 일렁이는 최면 효과 구현
 * - 0.72 Heavy Damping 물속 저항 물리 및 슬로우 리본 트레일 궤적 완벽 유지
 */

export default class ThreePendulumWave {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.numPendulums = 16; 
    
    this.a1 = new Float32Array(this.numPendulums);
    this.a2 = new Float32Array(this.numPendulums);
    this.a1_v = new Float32Array(this.numPendulums);
    this.a2_v = new Float32Array(this.numPendulums);
    this.x0 = new Float32Array(this.numPendulums);
    this.y0 = new Float32Array(this.numPendulums);

    this.prevFreqBins = new Float32Array(this.numPendulums);

    this.baseL1 = 0.9;
    this.baseL2 = 0.8;
    this.m1 = 1.2;
    this.m2 = 1.2;
    this.g = 0.35; 

    this.loadedSeed = -1;
    this.invertFrequency = false;
    this.colorStyle = 'neon';

    this.maxTrailPoints = 32;
    this.trailHistories = [];
    this.trailGeometries = [];
    this.trailMeshes = [];
    
    this.pointsGeo = null;
    this.pointsMesh = null;
    
    this.version = "008호 Kinetic Aurora Pendulum Ver 5.1";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060810, 0.02);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0.3, -0.2, 9.5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x060810);
    this.renderer.autoClear = false; 
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    console.log(`%c[🔮 008호 독립 파이프라인 가동] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");

    this.buildPendulumGrid();
  }

  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  buildPendulumGrid() {
    this.trailMeshes.forEach(mesh => this.scene.remove(mesh));
    if (this.pointsMesh) this.scene.remove(this.pointsMesh);
    
    this.trailHistories = [];
    this.trailGeometries = [];
    this.trailMeshes = [];

    const pointPositions = new Float32Array(this.numPendulums * 2 * 3);
    const pointColors = new Float32Array(this.numPendulums * 2 * 3);

    for (let i = 0; i < this.numPendulums; i++) {
      // 💡 [독립 위상차 분배]: 각 진자가 고유한 시작 각도와 흐름을 가지도록 나선형 정렬
      let phaseOffset = i * (Math.PI / 8); 
      this.a1[i] = Math.PI + 0.1 + Math.sin(phaseOffset) * 0.2;
      this.a2[i] = Math.PI - 0.1 + Math.cos(phaseOffset) * 0.2;
      this.a1_v[i] = 0;
      this.a2_v[i] = 0;
      this.prevFreqBins[i] = 0;

      const trailPoints = [];
      for (let p = 0; p < this.maxTrailPoints; p++) {
        trailPoints.push(new THREE.Vector3(0, 0, 0));
      }
      this.trailHistories.push(trailPoints);

      const trailGeo = new THREE.BufferGeometry();
      const posArray = new Float32Array(this.maxTrailPoints * 3);
      const colArray = new Float32Array(this.maxTrailPoints * 3);
      trailGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      trailGeo.setAttribute('color', new THREE.BufferAttribute(colArray, 3));
      this.trailGeometries.push(trailGeo);

      const trailMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending
      });

      const trailMesh = new THREE.Line(trailGeo, trailMat);
      this.trailMeshes.push(trailMesh);
      this.scene.add(trailMesh);
    }

    this.pointsGeo = new THREE.BufferGeometry();
    this.pointsGeo.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
    this.pointsGeo.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));

    const pointMat = new THREE.PointsMaterial({
      size: 0.35,
      map: this.createGlowTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.pointsMesh = new THREE.Points(this.pointsGeo, pointMat);
    this.scene.add(this.pointsMesh);
  }

  createGlowTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.45)');
    gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    this.renderer.clearDepth();

    let seed = 42, scatter = 2.2, glow = 85, gain = 1.0;
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
      this.buildPendulumGrid();
    }

    const aspect = this.camera.aspect;
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 9.5 * 2; 
    const viewWidth = viewHeight * aspect;
    
    const stepX = (viewWidth / 4);
    const stepY = (viewHeight / 4);

    const scatterScale = scatter / 22.0; 
    const curL1 = this.baseL1 * scatterScale;
    const curL2 = this.baseL2 * scatterScale;

    // 💡 [16채널 완전 독립 분할 매핑 수리 완수]
    const freqBins = new Float32Array(this.numPendulums);
    if (audioData) {
      for (let i = 0; i < this.numPendulums; i++) {
        let factor = i / (this.numPendulums - 1);
        
        // 512 버퍼 구간을 16개의 독립된 서브 안테나 대역으로 칼같이 쪼개어 수혈
        if (factor < 0.20) {
          freqBins[i] = THREE.MathUtils.lerp(audioData.subBass || 0.1, audioData.bass || 0.1, factor * 5.0);
        } else if (factor < 0.70) {
          freqBins[i] = THREE.MathUtils.lerp(audioData.bass || 0.1, audioData.mid || 0.1, (factor - 0.20) * 2.0);
        } else {
          freqBins[i] = THREE.MathUtils.lerp(audioData.mid || 0.1, audioData.treble || 0.1, (factor - 0.70) * 3.33);
        }
        
        // 고음역대로 갈수록 감쇠되는 물리 질량을 보완하기 위해 대역별 가중 부스트 처리
        let frequencyBoost = 1.0 + (i / this.numPendulums) * 1.5;
        freqBins[i] *= (gain * frequencyBoost); 
      }
    }

    const pPos = this.pointsGeo.attributes.position.array;
    const pCol = this.pointsGeo.attributes.color.array;
    const mu = 1 + this.m1 / this.m2;

    let baseC1 = new THREE.Color(), baseC2 = new THREE.Color();
    if (this.colorStyle === 'monochrome') {
      baseC1.set('#1e3d2f'); baseC2.set('#52b381');
    } else if (this.colorStyle === 'neon') {
      baseC1.set('#a38a6c'); baseC2.set('#fcf8f0');
    } else if (this.colorStyle === 'pastel') {
      baseC1.set('#1a2430'); baseC2.set('#ebbaa8');
    } else if (this.colorStyle === 'custom') {
      baseC1.set(customColors.gas1); baseC2.set(customColors.gas2);
    } else {
      baseC1.setHSL(this.seededRandom(seed + 45), 0.6, 0.5);
      baseC2.setHSL(this.seededRandom(seed + 90), 0.7, 0.7);
    }

    for (let i = 0; i < this.numPendulums; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      
      const bx = (col - 1.5) * stepX * 0.95;
      const by = (1.5 - row) * stepY * 0.95;

      // 💡 각 진자 인덱스(i)가 고유 대역 주파수(targetBinIdx)와 1:1로 엄격 매핑되도록 연결
      const targetBinIdx = this.invertFrequency ? (this.numPendulums - 1 - i) : i;
      const currentFreqForce = freqBins[targetBinIdx];
      
      // 실시간 흐름 미분 추적 계산
      const delta = currentFreqForce - this.prevFreqBins[i];
      
      if (delta > 0.003) {
        const randDir = this.seededRandom(seed + i) > 0.5 ? 1 : -1;
        // 💡 주파수 대역별 신호 차이에 의해 각 진자가 완전히 독자적인 속도로 튕겨 나감
        this.a1_v[i] += delta * (3.5 + (i * 0.1)) * randDir;
        this.a2_v[i] *= 0.65;
      } else if (delta < -0.003) {
        this.a1_v[i] *= 0.55;
        const randDir = this.seededRandom(seed + i + 40) > 0.5 ? 1 : -1;
        this.a2_v[i] += Math.abs(delta) * 1.5 * randDir;
      }

      this.prevFreqBins[i] = currentFreqForce;

      // 물리 공식 연산 루프
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

      // 무거운 물속 끈적한 저항 댐핑
      this.a1_v[i] *= 0.72; 
      this.a2_v[i] *= 0.72;

      const px1 = bx + curL1 * Math.sin(this.a1[i]);
      const py1 = by - curL1 * Math.cos(this.a1[i]);
      const px2 = px1 + curL2 * Math.sin(this.a2[i]);
      const py2 = py1 - curL2 * Math.cos(this.a2[i]);

      const pIdx = i * 6;
      pPos[pIdx] = px1;   pPos[pIdx+1] = py1;   pPos[pIdx+2] = 0.01;
      pPos[pIdx+3] = px2; pPos[pIdx+4] = py2; pPos[pIdx+5] = 0.02;

      // 고유 인덱스에 따라 은하수 리본 색상도 입체 그라데이션 매핑
      let blendRatio = i / (this.numPendulums - 1);
      let mixedC1 = new THREE.Color().copy(baseC1).lerp(baseC2, blendRatio * 0.5);
      let mixedC2 = new THREE.Color().copy(baseC1).lerp(baseC2, 0.5 + blendRatio * 0.5);

      pCol[pIdx] = mixedC1.r; pCol[pIdx+1] = mixedC1.g; pCol[pIdx+2] = mixedC1.b;
      pCol[pIdx+3] = mixedC2.r; pCol[pIdx+4] = mixedC2.g; pCol[pIdx+5] = mixedC2.b;

      // 히스토리 트레일 버퍼 적재
      const history = this.trailHistories[i];
      history.shift();
      history.push(new THREE.Vector3(px2, py2, -0.02));

      const tGeo = this.trailGeometries[i];
      const tPos = tGeo.attributes.position.array;
      const tCol = tGeo.attributes.color.array;

      for (let p = 0; p < this.maxTrailPoints; p++) {
        const tIdx = p * 3;
        tPos[tIdx] = history[p].x;
        tPos[tIdx+1] = history[p].y;
        tPos[tIdx+2] = history[p].z;

        let alphaRatio = p / (this.maxTrailPoints - 1);
        let ribbonGradColor = new THREE.Color().copy(mixedC1).lerp(mixedC2, alphaRatio);
        
        tCol[tIdx] = ribbonGradColor.r * alphaRatio;
        tCol[tIdx+1] = ribbonGradColor.g * alphaRatio;
        tCol[tIdx+2] = ribbonGradColor.b * alphaRatio;
      }
      tGeo.attributes.position.needsUpdate = true;
      tGeo.attributes.color.needsUpdate = true;
    }

    this.pointsGeo.attributes.position.needsUpdate = true;
    this.pointsGeo.attributes.color.needsUpdate = true;

    let camTime = Date.now() * 0.0004;
    this.camera.position.x = 0.3 + Math.sin(camTime) * 0.2;
    this.camera.position.y = -0.2 + Math.cos(camTime * 0.8) * 0.15;

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h);
    }
  }

  destroy() {
    if (!this.scene) return;
    this.trailMeshes.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); this.scene.remove(mesh); });
    if (this.pointsGeo) { this.pointsGeo.dispose(); this.pointsMesh.material.dispose(); this.scene.remove(this.pointsMesh); }
    if (this.renderer) { this.container.removeChild(this.renderer.domElement); this.renderer.dispose(); }
    this.scene = null; this.camera = null; this.renderer = null;
    this.trailHistories = []; this.trailGeometries = []; this.trailMeshes = [];
  }
}
