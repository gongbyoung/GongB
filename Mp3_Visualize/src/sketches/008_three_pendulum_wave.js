/**
 * 008_three_pendulum_wave.js
 * 16개 주파수 대역 채널과 1:1로 매핑된 16조 2중 진자 공명 스테이지
 */
export default class ThreePendulumWave {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // 💡 딱 주파수 분할 개수만큼만 진자 개수 고정 (16대역)
    this.numPendulums = 16;
    
    // 16개 진자의 독립 물리 상태 배열 구조화
    this.a1 = new Float32Array(this.numPendulums);
    this.a2 = new Float32Array(this.numPendulums);
    this.a1_v = new Float32Array(this.numPendulums);
    this.a2_v = new Float32Array(this.numPendulums);
    this.x0 = new Float32Array(this.numPendulums);
    this.y0 = new Float32Array(this.numPendulums);

    // 진자 개별 물리 스펙
    this.l1 = 0.9;  // 1번 암 길이
    this.l2 = 0.8;  // 2번 암 길이
    this.m1 = 1.2;  // 질량 1
    this.m2 = 1.2;  // 질량 2
    this.g = 0.4;   // 중력 가속도 배경값

    // 그래픽 버퍼 객체
    this.linesGeo = null;
    this.pointsGeo = null;
    this.linesMesh = null;
    this.pointsMesh = null;

    this.loadedSeed = -1;
    this.invertFrequency = false;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010103, 0.04);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 9); // 화면 가득 차도록 전면 뷰포트 배치
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x010103);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    this.buildPendulumLine();
  }

  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  buildPendulumLine() {
    const linePositions = new Float32Array(this.numPendulums * 4 * 3);
    const pointPositions = new Float32Array(this.numPendulums * 2 * 3);
    const pointColors = new Float32Array(this.numPendulums * 2 * 3);

    // 화면 가득 배치하기 위한 균등 가로 폭 계산
    const totalWidth = 14.0;
    const spacingX = totalWidth / (this.numPendulums - 1);

    for (let i = 0; i < this.numPendulums; i++) {
      // 좌측 끝에서 우측 끝으로 일렬 정렬
      this.x0[i] = - (totalWidth / 2) + (i * spacingX);
      this.y0[i] = 1.5; // 상단 고정 피벗 높이

      // 초기 정렬 상태 세팅 (약간의 수직 노이즈 오프셋)
      this.a1[i] = Math.PI + (i * 0.02);
      this.a2[i] = Math.PI - (i * 0.02);
      this.a1_v[i] = 0;
      this.a2_v[i] = 0;
    }

    this.linesGeo = new THREE.BufferGeometry();
    this.linesGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

    this.pointsGeo = new THREE.BufferGeometry();
    this.pointsGeo.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
    this.pointsGeo.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));

    const lineMat = new THREE.LineBasicMaterial({ 
      color: 0x334455, 
      transparent: true, 
      opacity: 0.6 
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

    // 우측 패널 제어 변수들 실시간 채집
    let seed = 42, scatter = 2.2, glow = 0.85, gain = 1.0;
    let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

    if (window.cosmicEngineSettings) {
      seed = window.cosmicEngineSettings.seed;
      scatter = window.cosmicEngineSettings.scatterExponent; 
      glow = window.cosmicEngineSettings.glowIntensity;      
      gain = window.cosmicEngineSettings.audioGain;          
      customColors = window.cosmicEngineSettings.customColors;
    }

    // 💡 [지형 변경: Seed 연동] 주파수의 배열 순서를 역전시키거나 초기 물리 각도를 뒤틀어버림
    if (this.loadedSeed !== seed) {
      this.loadedSeed = seed;
      this.invertFrequency = (seed % 2 === 0);
      
      // 유저가 지정한 대형 별 색상을 진자 뼈대 라인 색상에 주입
      this.linesMesh.material.color.set(customColors.star);
      
      // 각도 재배치 오프셋 연산
      for(let i=0; i<this.numPendulums; i++) {
        const randAngle = this.seededRandom(seed + i) * 0.2;
        this.a1[i] = Math.PI + randAngle;
        this.a2[i] = Math.PI - randAngle;
      }
    }

    // 슬라이더 마스터 강도 연동
    this.pointsMesh.material.size = Math.max(0.1, glow * 0.45);
    this.pointsMesh.material.opacity = Math.min(1.0, glow);

    const lPos = this.linesGeo.attributes.position.array;
    const pPos = this.pointsGeo.attributes.position.array;
    const pCol = this.pointsGeo.attributes.color.array;

    const col1 = new THREE.Color(customColors.gas1);
    const col2 = new THREE.Color(customColors.gas2);

    const mu = 1 + this.m1 / this.m2;

    // 임의의 가상 오디오 16 주파수 버퍼 쪼개기 연산
    const freqBins = new Float32Array(this.numPendulums);
    if (audioData) {
      // 4대역 마크로 주파수를 기반으로 16개의 세부 그라데이션 주파수 성분 분해 유도
      for (let i = 0; i < this.numPendulums; i++) {
        let factor = i / (this.numPendulums - 1);
        if (factor < 0.25) {
          freqBins[i] = THREE.MathUtils.lerp(audioData.subBass, audioData.bass, factor * 4.0);
        } else if (factor < 0.75) {
          freqBins[i] = THREE.MathUtils.lerp(audioData.bass, audioData.mid, (factor - 0.25) * 2.0);
        } else {
          freqBins[i] = THREE.MathUtils.lerp(audioData.mid, audioData.treble, (factor - 0.75) * 4.0);
        }
        // 폭발력 배율(gain) 계산 결합
        freqBins[i] *= gain * 4.5;
      }
    }

    // 💥 16개 주파수 대역과 16개 진자의 1대1 물리 시뮬레이션 루프
    for (let i = 0; i < this.numPendulums; i++) {
      const bx = this.x0[i];
      const by = this.y0[i];

      // 지형 변경 옵션 상태에 따라 왼쪽/오른쪽 주파수 매핑 축을 뒤집음
      const targetBinIdx = this.invertFrequency ? (this.numPendulums - 1 - i) : i;
      let currentFreqForce = freqBins[targetBinIdx];

      // 💡 [분산 범위: Scatter 연동] 양옆 이웃 진자들 간의 소리 진동 에너지 간섭 결합 연산
      if (scatter > 0.5) {
        const leftIdx = Math.max(0, i - 1);
        const rightIdx = Math.min(this.numPendulums - 1, i + 1);
        const neighborhoodAvg = (freqBins[leftIdx] + freqBins[rightIdx]) * 0.5;
        // scatter가 클수록 옆집 소리에 같이 휩쓸려 춤추는 분산 결합도가 상승함
        currentFreqForce = THREE.MathUtils.lerp(currentFreqForce, neighborhoodAvg, (scatter / 5.0));
      }

      // 주파수 동력을 각 관절의 순간 가속 에너지로 다이렉트 주입
      this.a1_v[i] += currentFreqForce * 0.04;
      this.a2_v[i] += currentFreqForce * 0.04;

      // 2중 카오스 진자 운동 수학 방정식 기동
      const dAngle = this.a1[i] - this.a2[i];
      
      const num1 = this.g * (Math.sin(this.a2[i]) * Math.cos(dAngle) - mu * Math.sin(this.a1[i])) - 
                  (this.l2 * this.a2_v[i] * this.a2_v[i] + this.l1 * this.a1_v[i] * this.a1_v[i] * Math.cos(dAngle)) * Math.sin(dAngle);
      const den1 = this.l1 * (mu - Math.cos(dAngle) * Math.cos(dAngle));
      const a1_a = num1 / den1;

      const num2 = this.g * mu * (Math.sin(this.a1[i]) * Math.cos(dAngle) - Math.sin(this.a2[i])) + 
                  (mu * this.l1 * this.a1_v[i] * this.a1_v[i] + this.l2 * this.a2_v[i] * this.a2_v[i] * Math.cos(dAngle)) * Math.sin(dAngle);
      const den2 = this.l2 * (mu - Math.cos(dAngle) * Math.cos(dAngle));
      const a2_a = num2 / den2;

      this.a1_v[i] += a1_a * 0.04;
      this.a2_v[i] += a2_a * 0.04;
      this.a1[i] += this.a1_v[i] * 0.1;
      this.a2[i] += this.a2_v[i] * 0.1;

      // 물리 저항 저감 감쇄 연산
      this.a1_v[i] *= 0.985;
      this.a2_v[i] *= 0.985;

      // 역좌표계 정렬 변환
      const px1 = bx + this.l1 * Math.sin(this.a1[i]);
      const py1 = by - this.l1 * Math.cos(this.a1[i]);
      const px2 = px1 + this.l2 * Math.sin(this.a2[i]);
      const py2 = py1 - this.l2 * Math.cos(this.a2[i]);

      // 라인 그리기 위치 동기화
      const lIdx = i * 12;
      lPos[lIdx] = bx;   lPos[lIdx+1] = by;   lPos[lIdx+2] = 0;
      lPos[lIdx+3] = px1; lPos[lIdx+4] = py1; lPos[lIdx+5] = 0;
      lPos[lIdx+6] = px1; lPos[lIdx+7] = py1; lPos[lIdx+8] = 0;
      lPos[lIdx+9] = px2; lPos[lIdx+10] = py2; lPos[lIdx+11] = 0;

      // 발광 구체 그리기 위치 동기화
      const pIdx = i * 6;
      pPos[pIdx] = px1;   pPos[pIdx+1] = py1;   pPos[pIdx+2] = 0.01;
      pPos[pIdx+3] = px2; pPos[pIdx+4] = py2; pPos[pIdx+5] = 0.02;

      // 실시간 가동 에너지(속도량) 측정 후 네온 컬러 강도 변조
      const kineticEnergy = Math.abs(this.a1_v[i]) + Math.abs(this.a2_v[i]);

      // 1번 관절 색상 최적화 (가스 1 테마)
      pCol[pIdx]   = col1.r * (0.6 + kineticEnergy * 0.4);
      pCol[pIdx+1] = col1.g * (0.6 + kineticEnergy * 0.4);
      pCol[pIdx+2] = col1.b * (0.6 + kineticEnergy * 0.4);

      // 2번 말단 관절 색상 최적화 (가스 2 테마 - 피크 타격 시 번쩍임 효과)
      pCol[pIdx+3] = Math.min(1.0, col2.r + kineticEnergy * 0.25);
      pCol[pIdx+4] = Math.min(1.0, col2.g + kineticEnergy * 0.25);
      pCol[pIdx+5] = Math.min(1.0, col2.b + kineticEnergy * 0.25);
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
