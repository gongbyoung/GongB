/**
 * src/sketches/008_three_pendulum_wave.js
 * - [버전] Ver 5.0 (키네틱 빛의 군무 Kinetic Waves - 앰비언트 2중 진자 완결판)
 * - 딱딱한 로봇팔 직선 와이어프레임을 지우고, 부드러운 잔상이 남는 모션 트레일 리본 구조로 대개조
 * - 마네킹 같은 뚝뚝 끊김을 완화하기 위해 Ease-in 및 물속 저항 느낌의 Heavy Damping(0.72) 필터 체결
 * - 4x4 그리드 인덱스 간 정교한 위상차(Phase Offset)를 주입하여 파도치듯 이어지는 최면 군무 연출
 * - 관제탑 Color Style Palette(No1~No5) 색상 필터 및 현재 수치 즉시 적용 (RESET) 파이프라인 완벽 바인딩
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

    // 진자 물리 상수 보정
    this.baseL1 = 0.9;
    this.baseL2 = 0.8;
    this.m1 = 1.2;
    this.m2 = 1.2;
    this.g = 0.3; // 모션을 조금 더 은은하고 느릿하게 만들기 위해 중력 감축

    this.loadedSeed = -1;
    this.invertFrequency = false;
    this.colorStyle = 'neon';

    // 💡 [미술적 개선안: 리본 잔상] 각 진자의 말단 궤적 좌표들을 축적할 히스토리 버퍼 버킷 수립
    this.maxTrailPoints = 32;
    this.trailHistories = [];
    this.trailGeometries = [];
    this.trailMeshes = [];
    
    this.pointsGeo = null;
    this.pointsMesh = null;
    
    this.version = "008호 Kinetic Aurora Pendulum Ver 5.0";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    
    // 💡 [영상적 개선안: 깊이감] 몽환적인 밤하늘 안개감 레이어링
    this.scene.fog = new THREE.FogExp2(0x060810, 0.02);

    // 카메라는 평면 완전 2D를 피하고 3D 공간으로 살짝 틀어 입체 아웃포커싱 유도
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0.3, -0.2, 9.5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x060810);
    this.renderer.autoClear = false; // 끈적한 에코 잔상 콤포지션을 위해 자동 클리어 대기
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    console.log(`%c[🔮 008호 키네틱 빛의 군무 가동] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");

    this.buildPendulumGrid();
  }

  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  buildPendulumGrid() {
    // 기존에 존재하던 메쉬 클린 제거
    this.trailMeshes.forEach(mesh => this.scene.remove(mesh));
    if (this.pointsMesh) this.scene.remove(this.pointsMesh);
    
    this.trailHistories = [];
    this.trailGeometries = [];
    this.trailMeshes = [];

    const pointPositions = new Float32Array(this.numPendulums * 2 * 3);
    const pointColors = new Float32Array(this.numPendulums * 2 * 3);

    // 💡 [영상적 개선안: 군무 연출] 진자 배치 시 미세한 위상차 오프셋(Phase Offset) 인젝션
    for (let i = 0; i < this.numPendulums; i++) {
      let phaseOffset = i * 0.12; // 옆 진자와 완벽한 파도 모양을 그리며 유기적으로 이어지는 밸런스 값
      this.a1[i] = Math.PI + 0.1 + phaseOffset;
      this.a2[i] = Math.PI - 0.1 + phaseOffset;
      this.a1_v[i] = 0;
      this.a2_v[i] = 0;
      this.prevFreqBins[i] = 0;

      // 각 진자 노드별 잔상 궤적 좌표 초기화
      const trailPoints = [];
      for (let p = 0; p < this.maxTrailPoints; p++) {
        trailPoints.push(new THREE.Vector3(0, 0, 0));
      }
      this.trailHistories.push(trailPoints);

      // 리본 메쉬 형성을 위한 튜브/스트립 지오메트리 동적 생성
      const trailGeo = new THREE.BufferGeometry();
      const posArray = new Float32Array(this.maxTrailPoints * 3);
      const colArray = new Float32Array(this.maxTrailPoints * 3);
      trailGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      trailGeo.setAttribute('color', new THREE.BufferAttribute(colArray, 3));
      this.trailGeometries.push(trailGeo);

      // 💡 [미술적 개선안: 리본 질감] 부드럽게 스며드는 은은한 리본 띠용 라인 머티리얼 배합
      const trailMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        linewidth: 2 // 브라우저 가변 두께 필터
      });

      const trailMesh = new THREE.Line(trailGeo, trailMat);
      this.trailMeshes.push(trailMesh);
      this.scene.add(trailMesh);
    }

    this.pointsGeo = new THREE.BufferGeometry();
    this.pointsGeo.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
    this.pointsGeo.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));

    // 관절 노드를 은은한 오로라 형태의 빛무리(Soft Glow Sphere)로 매핑 치환
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

    // 아날로그 에코 잔상을 캔버스 배경 믹싱 컨텍스트에 투사
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

    // RESET 신호 매칭 생명 주기 트래킹
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

    // 슬라이더 조작 수치를 오직 팔 길이에만 투사
    const scatterScale = scatter / 22.0; 
    const curL1 = this.baseL1 * scatterScale;
    const curL2 = this.baseL2 * scatterScale;

    // 16채널 오디오 주파수 그라디언트 분산
    const freqBins = new Float32Array(this.numPendulums);
    if (audioData) {
      for (let i = 0; i < this.numPendulums; i++) {
        let factor = i / (this.numPendulums - 1);
        if (factor < 0.25) freqBins[i] = THREE.MathUtils.lerp(audioData.subBass, audioData.bass, factor * 4.0);
        else if (factor < 0.75) freqBins[i] = THREE.MathUtils.lerp(audioData.bass, audioData.mid, (factor - 0.25) * 2.0);
        else freqBins[i] = THREE.MathUtils.lerp(audioData.mid, audioData.treble, (factor - 0.75) * 4.0);
        freqBins[i] *= gain; 
      }
    }

    const pPos = this.pointsGeo.attributes.position.array;
    const pCol = this.pointsGeo.attributes.color.array;
    const mu = 1 + this.m1 / this.m2;

    // 💡 [Color Style Palette 5대 명상 컬러칩 수리]
    let baseC1 = new THREE.Color(), baseC2 = new THREE.Color();
    if (this.colorStyle === 'monochrome') {
      // No1: 모스 그린 명상 톤
      baseC1.set('#1e3d2f'); baseC2.set('#52b381');
    } else if (this.colorStyle === 'neon') {
      // No2: 샌드 베이지 아날로그 톤
      baseC1.set('#a38a6c'); baseC2.set('#fcf8f0');
    } else if (this.colorStyle === 'pastel') {
      // No3: 은은한 대지 / 새벽녘 라벤더 톤
      baseC1.set('#1a2430'); baseC2.set('#ebbaa8');
    } else if (this.colorStyle === 'custom') {
      // No4: 커스텀 컬러 수혈
      baseC1.set(customColors.gas1); baseC2.set(customColors.gas2);
    } else {
      // No5: 올 랜덤 키네틱 팔레트
      baseC1.setHSL(this.seededRandom(seed + 45) * 1.0, 0.6, 0.5);
      baseC2.setHSL(this.seededRandom(seed + 90) * 1.0, 0.7, 0.7);
    }

    for (let i = 0; i < this.numPendulums; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      
      const bx = (col - 1.5) * stepX * 0.95;
      const by = (1.5 - row) * stepY * 0.95;

      const targetBinIdx = this.invertFrequency ? (this.numPendulums - 1 - i) : i;
      const currentFreqForce = freqBins[targetBinIdx];
      
      const delta = currentFreqForce - this.prevFreqBins[i];
      
      // 💡 [개선안 2: 움직임의 템포 제어]: 끈적하고 부드러운 가감속 물리 보정
      if (delta > 0.004) {
        const randDir = this.seededRandom(seed + i) > 0.5 ? 1 : -1;
        // Ease-in 가속 유도
        this.a1_v[i] += delta * 2.8 * randDir;
        this.a2_v[i] *= 0.7;
      } else if (delta < -0.004) {
        // 브레이크 감속 이징 유도
        this.a1_v[i] *= 0.6;
        const randDir = this.seededRandom(seed + i + 30) > 0.5 ? 1 : -1;
        this.a2_v[i] += Math.abs(delta) * 1.2 * randDir;
      }

      this.prevFreqBins[i] = currentFreqForce;

      // 2중 진자 물리 오가닉 렌더 계산식
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

      // 💥 찰랑이는 물속 저항 콘셉트를 완성하기 위한 중화형 관성 댐핑 계수 적용
      this.a1_v[i] *= 0.72; 
      this.a2_v[i] *= 0.72;

      // 물리 관절 포인트 최종 연산 구동
      const px1 = bx + curL1 * Math.sin(this.a1[i]);
      const py1 = by - curL1 * Math.cos(this.a1[i]);
      const px2 = px1 + curL2 * Math.sin(this.a2[i]);
      const py2 = py1 - curL2 * Math.cos(this.a2[i]);

      // 💡 [관절 노드의 아날로그화]: 부드러운 오로라 광원으로 점 노드 배치
      const pIdx = i * 6;
      pPos[pIdx] = px1;   pPos[pIdx+1] = py1;   pPos[pIdx+2] = 0.01;
      pPos[pIdx+3] = px2; pPos[pIdx+4] = py2; pPos[pIdx+5] = 0.02;

      pCol[pIdx] = baseC1.r; pCol[pIdx+1] = baseC1.g; pCol[pIdx+2] = baseC1.b;
      pPos[pIdx+3] = px2; pPos[pIdx+4] = py2; pPos[pIdx+5] = 0.02;
      pCol[pIdx+3] = baseC2.r; pCol[pIdx+4] = baseC2.g; pCol[pIdx+5] = baseC2.b;

      // 💡 [미술적 개선안: 직선에서 궤적과 리본으로] 말단 잔상 역사 버퍼 밀어넣기
      const history = this.trailHistories[i];
      history.shift();
      history.push(new THREE.Vector3(px2, py2, -0.02)); // 약간 뒷공간 레이어 배치로 뎁스 유도

      // 버퍼 속성 리본 메쉬에 펌핑 바인딩
      const tGeo = this.trailGeometries[i];
      const tPos = tGeo.attributes.position.array;
      const tCol = tGeo.attributes.color.array;

      for (let p = 0; p < this.maxTrailPoints; p++) {
        const tIdx = p * 3;
        tPos[tIdx] = history[p].x;
        tPos[tIdx+1] = history[p].y;
        tPos[tIdx+2] = history[p].z;

        // 꼬리로 갈수록 리본 빛의 세기가 아련하게 사라지는 페이드 아웃(Decay) 그라디언트 적용
        let alphaRatio = p / (this.maxTrailPoints - 1);
        let mixedColor = new THREE.Color().copy(baseC1).lerp(baseC2, alphaRatio);
        
        tCol[tIdx] = mixedColor.r * alphaRatio;
        tCol[tIdx+1] = mixedColor.g * alphaRatio;
        tCol[tIdx+2] = mixedColor.b * alphaRatio;
      }
      tGeo.attributes.position.needsUpdate = true;
      tGeo.attributes.color.needsUpdate = true;
    }

    this.pointsGeo.attributes.position.needsUpdate = true;
    this.pointsGeo.attributes.color.needsUpdate = true;

    // 💡 [영상적 개선안: 은하수 유영] 가상 카메라가 입체 군무 무대를 미세 정현파 정찰 렌즈 무브먼트 진행
    let camTime = Date.now() * 0.0004;
    this.camera.position.x = 0.3 + Math.sin(camTime) * 0.2;
    this.camera.position.y = -0.2 + Math.cos(camTime * 0.8) * 0.15;

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
    
    this.trailMeshes.forEach(mesh => {
      mesh.geometry.dispose();
      mesh.material.dispose();
      this.scene.remove(mesh);
    });

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
    this.trailHistories = [];
    this.trailGeometries = [];
    this.trailMeshes = [];
  }
}
