/**
 * src/sketches/008_three_pendulum_wave.js
 * - [버전] Ver 6.0 (3D 키네틱 리본 배경 이미지 통합 및 16채널 트루 스플릿 판)
 * - 외부 업로드 이미지(땅/호수바닥)를 THREE.Texture로 실시간 가속 마운트하여 3D 우주 배경에 레이어 통합
 * - 16채널 트루 스펙트럼 스플릿: FFT 512 주파수 배열을 16등분 컷오프하여 16개 진자에 1:1 완벽 독립 구동력 주입
 * - 지속형 에너지(Continuous Force)와 충격형 진폭(Transient Delta) 물리 연산을 하이브리드 결합하여 고유 움직임 극대화
 * - 30FPS 진단 HUD 통신 가상 프레임 레이터 및 실시간 3D 키네틱 링크 카운터 완벽 시공 완료
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
    
    this.version = "008호 Kinetic Aurora Pendulum Ver 6.0";

    // 💡 배경 이미지 및 HUD 타임 컨트롤러 트래킹 변수 수립
    this.bgTexture = null;
    this.lastBgImage = null;
    this.lastTime = 0;
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

    console.log(`%c[🔮 008호 트루 독립 스플릿 가동] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");

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
      // 독립 나선형 위상차 초깃값 분배
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

    this.pointsMesh = new THREE.Points(this.geometry || this.pointsGeo, pointMat);
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
    if (!this.renderer || !this.scene || !this.camera || !this.pointsMesh) return;

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

    // 💡 [배경 이미지 실시간 가속 마운트 엔진 시공]
    const bgImg = window.currentUploadedImageElement;
    if (bgImg && bgImg !== this.lastBgImage) {
      if (this.bgTexture) this.bgTexture.dispose();
      this.bgTexture = new THREE.Texture(bgImg);
      this.bgTexture.minFilter = THREE.LinearFilter;
      this.bgTexture.magFilter = THREE.LinearFilter;
      this.bgTexture.needsUpdate = true;
      this.lastBgImage = bgImg;
      this.scene.background = this.bgTexture; // 3D 월드 최하단 레이어 고정 안착
    } else if (!bgImg && this.lastBgImage) {
      this.scene.background = new THREE.Color(0x060810);
      this.lastBgImage = null;
    }

    // 진단 HUD 연동용 FPS 환산 타임 트래킹
    if (!this.lastTime) this.lastTime = performance.now();
    let now = performance.now();
    let fps = Math.round(1000 / (now - this.lastTime));
    this.lastTime = now;

    // 메인 HUD에 실시간 변수 상태 피딩 투사
    window.sketchDiagnostics = {
      fps: isNaN(fps) || fps > 100 ? 30 : fps,
      particleCount: this.numPendulums + " Kinetic Links",
      isCovering: false,
      activeFunction: this.bgTexture ? "Kinetic[BG_Loaded]" : "Kinetic[Core_Active]"
    };

    const aspect = this.camera.aspect;
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 9.5 * 2; 
    const viewWidth = viewHeight * aspect;
    
    const stepX = (viewWidth / 4);
    const stepY = (viewHeight / 4);

    const scatterScale = scatter / 22.0; 
    const curL1 = this.baseL1 * scatterScale;
    const curL2 = this.baseL2 * scatterScale;

    // 💡 [알고리즘: 16채널 트루 주파수 스플릿 핵심 연산구역]
    const freqBins = new Float32Array(this.numPendulums);
    if (audioData) {
      const rawBands = audioData.raw || audioData.spectrum || [];
      
      if (rawBands.length >= this.numPendulums) {
        // FFT 256/512 스펙트럼 크기를 청크 단위로 분할하여 16개 대역 평균 주파수 수혈
        let chunkSize = Math.floor(rawBands.length / this.numPendulums);
        for (let i = 0; i < this.numPendulums; i++) {
          let sum = 0;
          for (let j = 0; j < chunkSize; j++) {
            sum += rawBands[i * chunkSize + j];
          }
          let avg = sum / chunkSize;
          // 주파수 크기가 0~255로 들어올 때와 0~1로 들어올 때 유연 대응 노멀라이징
          freqBins[i] = avg > 1.0 ? avg / 255.0 : avg;
          
          // 고음역대로 갈수록 감쇠하는 신호 진폭 보완을 위해 가중 밸런스 부스트 시공
          let frequencyBoost = 1.0 + (i / this.numPendulums) * 2.2;
          freqBins[i] *= (gain * frequencyBoost); 
        }
      } else {
        // Fallback: 오디오 버퍼가 초기 로딩 중이거나 공백일 때 아날로그 보간 대체
        for (let i = 0; i < this.numPendulums; i++) {
          let factor = i / (this.numPendulums - 1);
          if (factor < 0.20) {
            freqBins[i] = THREE.MathUtils.lerp(audioData.subBass || 0.1, audioData.bass || 0.1, factor * 5.0);
          } else if (factor < 0.70) {
            freqBins[i] = THREE.MathUtils.lerp(audioData.bass || 0.1, audioData.mid || 0.1, (factor - 0.20) * 2.0);
          } else {
            freqBins[i] = THREE.MathUtils.lerp(audioData.mid || 0.1, audioData.treble || 0.1, (factor - 0.70) * 3.33);
          }
          freqBins[i] *= gain;
        }
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

    const time = Date.now() * 0.001;

    for (let i = 0; i < this.numPendulums; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      
      const bx = (col - 1.5) * stepX * 0.95;
      const by = (1.5 - row) * stepY * 0.95;

      // 💡 각 진자 인덱스(i)가 16개의 '진짜' 독립 대역 주파수와 1:1 매핑 연동
      const targetBinIdx = this.invertFrequency ? (this.numPendulums - 1 - i) : i;
      const currentFreqForce = freqBins[targetBinIdx];
      
      // 실시간 흐름 미분 추적 변위 분석
      const delta = currentFreqForce - this.prevFreqBins[i];
      
      // 💡 [독립 기네틱 무드 장착]: 1) 평시 흐름에 독립 주파수 가중치를 지속 부여하여 춤추게 유도
      this.a1_v[i] += Math.sin(time * 2.5 + i) * currentFreqForce * 0.015;
      this.a2_v[i] += Math.cos(time * 2.0 - i) * currentFreqForce * 0.025;

      // 💡 2) 강한 비트 타격(Transient Kick) 감지 시 대역 신호 차이에 의해 각 진자가 완전히 개별 속도로 발진
      if (delta > 0.003) {
        const randDir = this.seededRandom(seed + i) > 0.5 ? 1 : -1;
        this.a1_v[i] += delta * (4.2 + (i * 0.2)) * randDir;
        this.a2_v[i] *= 0.60;
      } else if (delta < -0.003) {
        this.a1_v[i] *= 0.50;
        const randDir = this.seededRandom(seed + i + 35) > 0.5 ? 1 : -1;
        this.a2_v[i] += Math.abs(delta) * 1.8 * randDir;
      }

      this.prevFreqBins[i] = currentFreqForce;

      // 이중 진자 카오스 물리 방정식 루프
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

      // 0.72 물속 저항 물리 유체 점성 댐핑
      this.a1_v[i] *= 0.72; 
      this.a2_v[i] *= 0.72;

      const px1 = bx + curL1 * Math.sin(this.a1[i]);
      const py1 = by - curL1 * Math.cos(this.a1[i]);
      const px2 = px1 + curL2 * Math.sin(this.a2[i]);
      const py2 = py1 - curL2 * Math.cos(this.a2[i]);

      const pIdx = i * 6;
      pPos[pIdx] = px1;   pPos[pIdx+1] = py1;   pPos[pIdx+2] = 0.01;
      pPos[pIdx+3] = px2; pPos[pIdx+4] = py2; pPos[pIdx+5] = 0.02;

      // 대역별 궤적 오로라 리본 색상 그라데이션
      let blendRatio = i / (this.numPendulums - 1);
      let mixedC1 = new THREE.Color().copy(baseC1).lerp(baseC2, blendRatio * 0.5);
      let mixedC2 = new THREE.Color().copy(baseC1).lerp(baseC2, 0.5 + blendRatio * 0.5);

      pCol[pIdx] = mixedC1.r; pCol[pIdx+1] = mixedC1.g; pCol[pIdx+2] = mixedC1.b;
      pCol[pIdx+3] = mixedC2.r; pCol[pIdx+4] = mixedC2.g; pCol[pIdx+5] = mixedC2.b;

      // 오로라 리본 트레일 버퍼 갱신
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
    
    // 💡 생성된 배경 가속 텍스처 자원 메모리 완전 완전 박멸
    if (this.bgTexture) {
      this.bgTexture.dispose();
      this.bgTexture = null;
    }
    this.lastBgImage = null;

    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.scene = null; this.camera = null; this.renderer = null;
    this.trailHistories = []; this.trailGeometries = []; this.trailMeshes = [];
  }
}
