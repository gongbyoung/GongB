/**
 * 009_three_fireworks.js (Repurposed)
 * 36분할(6x6) 그리드 매트릭스와 빛의 파장(Gradient Ripple)을 이용한 고성능 오디오 비주얼라이저
 */
export default class ThreeGridGlowStage {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // 💡 6x6 그리드 = 36분할
    this.cols = 6;
    this.rows = 6;
    this.numCells = this.cols * this.rows; 
    
    this.prevFreqBins = new Float32Array(this.numCells); 
    this.explosions = []; // 파장이 퍼져나가는 진원지 데이터

    this.pointsGeo = null;
    this.pointsMesh = null;
    this.gridLines = null;

    this.loadedSeed = -1;
    this.colorStyle = '';
    this.shuffleMap = Array.from({length: this.numCells}, (_, i) => i);
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010103, 0.02);

    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 15); 
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x010103);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    this.buildMatrixGrid();
  }

  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // 💡 부드러운 그라데이션 텍스처 (중앙은 밝고 외곽은 투명하게 사라짐)
  createRadialGradient() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)'); // 중심부 폭발광
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)'); // 외곽 자연스러운 페이드아웃
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }

  buildMatrixGrid() {
    // 💡 화면 36분할 영역(Bounds) 가이드라인 그리기 (시각적 고급스러움 추가)
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(55 / 2)) * 15 * 2; 
    const viewWidth = viewHeight * this.camera.aspect;
    
    const stepX = viewWidth / this.cols;
    const stepY = viewHeight / this.rows;

    const lineGeo = new THREE.BufferGeometry();
    const linePos = [];
    
    // 세로선
    for(let i = 0; i <= this.cols; i++) {
      let x = (i - this.cols / 2) * stepX;
      linePos.push(x, viewHeight / 2, 0, x, -viewHeight / 2, 0);
    }
    // 가로선
    for(let i = 0; i <= this.rows; i++) {
      let y = (i - this.rows / 2) * stepY;
      linePos.push(viewWidth / 2, y, 0, -viewWidth / 2, y, 0);
    }
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    this.gridLines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      color: 0x334455, transparent: true, opacity: 0.15 
    }));
    this.scene.add(this.gridLines);

    // 💡 36개 그리드 셀의 그라데이션 발광체(Points) 셋업
    this.pointsGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(this.numCells * 3);
    const col = new Float32Array(this.numCells * 3);
    const siz = new Float32Array(this.numCells);

    for (let i = 0; i < this.numCells; i++) {
      let c = i % this.cols;
      let r = Math.floor(i / this.cols);
      
      pos[i*3] = (c - this.cols / 2 + 0.5) * stepX;
      pos[i*3+1] = (this.rows / 2 - r - 0.5) * stepY;
      pos[i*3+2] = 0.1; // 선보다 살짝 앞으로

      col[i*3] = 1; col[i*3+1] = 1; col[i*3+2] = 1;
      siz[i] = 1.0;
      this.prevFreqBins[i] = 0;
    }

    this.pointsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.pointsGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.pointsGeo.setAttribute('pSize', new THREE.BufferAttribute(siz, 1));

    const mat = new THREE.PointsMaterial({
      size: 1.0,
      map: this.createRadialGradient(),
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending, // 겹칠 때 빛이 폭발적으로 밝아짐
      depthWrite: false
    });

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        `attribute float pSize;\nvoid main() {`
      );
      shader.vertexShader = shader.vertexShader.replace(
        'gl_PointSize = size;',
        'gl_PointSize = size * pSize;'
      );
    };

    this.pointsMesh = new THREE.Points(this.pointsGeo, mat);
    this.scene.add(this.pointsMesh);
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

    // Seed 변경 시 36개 그리드의 주파수 배치 순서 무작위 셔플
    if (this.loadedSeed !== seed) {
      this.loadedSeed = seed;
      this.shuffleMap = Array.from({length: this.numCells}, (_, i) => i).sort(() => this.seededRandom(seed++) - 0.5);
    }

    // 💡 오디오 데이터를 36개의 촘촘한 채널로 분해
    const currentFreqBins = new Float32Array(this.numCells);
    if (audioData) {
      for (let i = 0; i < this.numCells; i++) {
        let factor = i / (this.numCells - 1);
        if (factor < 0.25) currentFreqBins[i] = THREE.MathUtils.lerp(audioData.subBass, audioData.bass, factor * 4.0);
        else if (factor < 0.75) currentFreqBins[i] = THREE.MathUtils.lerp(audioData.bass, audioData.mid, (factor - 0.25) * 2.0);
        else currentFreqBins[i] = THREE.MathUtils.lerp(audioData.mid, audioData.treble, (factor - 0.75) * 4.0);
        currentFreqBins[i] *= gain * 1.5;
      }
    }

    // 시간 경과에 따른 진원지(폭발) 생명주기 관리
    this.explosions.forEach(exp => exp.age += 0.05);
    this.explosions = this.explosions.filter(exp => exp.age < 1.0);

    const colAttr = this.pointsGeo.attributes.color.array;
    const sizAttr = this.pointsGeo.attributes.pSize.array;
    
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(55 / 2)) * 15 * 2; 
    const viewWidth = viewHeight * this.camera.aspect;
    const maxCellSize = (viewWidth / this.cols) * 2.5; // 발광 최대 크기 (이웃 셀까지 침범)

    for (let i = 0; i < this.numCells; i++) {
      let c = i % this.cols;
      let r = Math.floor(i / this.cols);
      
      const targetFreq = currentFreqBins[this.shuffleMap[i]];
      const delta = targetFreq - this.prevFreqBins[i];
      this.prevFreqBins[i] += (targetFreq - this.prevFreqBins[i]) * 0.3; // 스무딩

      // 💡 [그리드 폭발 감지] 해당 셀의 주파수가 강하게 튈 때 파장(Explosion) 생성
      if (delta > 0.08) {
        this.explosions.push({ c: c, r: r, force: delta, age: 0 });
      }

      // 💡 [거리 기반 파장 연산] 내 주변에서 터진 폭발이 나에게 미치는 빛의 밝기 계산
      let totalGlow = targetFreq * 0.2; // 기본 음압에 의한 미세한 떨림
      
      for (let exp of this.explosions) {
        // 진원지와의 그리드 거리 계산
        const dist = Math.sqrt(Math.pow(c - exp.c, 2) + Math.pow(r - exp.r, 2));
        
        // 분산 범위(Scatter)를 높이면 파장이 화면 전체로 멀리까지 퍼짐
        const reach = (scatter / 2.2) * 1.5; 
        
        // 거리가 가까울수록 강하게, 멀어질수록 약하게 도달
        let impact = (exp.force * 2.5) / (dist * reach + 1.0);
        
        // 시간이 지날수록 페이드아웃
        impact *= (1.0 - exp.age); 
        
        totalGlow += Math.max(0, impact);
      }

      totalGlow = Math.min(1.0, totalGlow); // 최대치 제한

      // 💡 1. 밝기(Glow)에 따라 그라데이션 반경(크기) 팽창
      // 폭발의 중심은 이웃 셀을 덮어버릴 만큼 커지고, 멀어질수록 작아짐
      sizAttr[i] = (maxCellSize * 0.2) + (maxCellSize * totalGlow * glow * 1.5);

      // 💡 2. 밝기(Glow)에 따른 완벽한 색상 전이 (Base Color -> Intense White)
      let baseColor = new THREE.Color();
      if (this.colorStyle === 'full-random') {
        baseColor.setHSL(this.seededRandom(seed + i * 99), 0.9, 0.4);
      } else if (this.colorStyle === 'neon') {
        baseColor.setHSL(i % 2 === 0 ? 0.93 : 0.48, 1.0, 0.4);
      } else if (this.colorStyle === 'pastel') {
        baseColor.setHSL(i % 2 === 0 ? 0.74 : 0.10, 0.8, 0.5);
      } else if (this.colorStyle === 'custom') {
        baseColor.set(i % 2 === 0 ? customColors.gas1 : customColors.gas2);
      } else {
        baseColor.setHSL(i / this.numCells, 0.9, 0.4); // 기본 무지개 
      }

      // 터지는 중심(totalGlow가 1에 가까운 곳)은 밝은 흰색/노란색으로 타오름
      baseColor.lerp(new THREE.Color(0xffffee), totalGlow);
      
      // 멀어질수록(totalGlow가 0에 가까운 곳) 원래 색상으로 돌아가며 어두워짐
      colAttr[i*3] = baseColor.r * (0.1 + totalGlow * 0.9);
      colAttr[i*3+1] = baseColor.g * (0.1 + totalGlow * 0.9);
      colAttr[i*3+2] = baseColor.b * (0.1 + totalGlow * 0.9);
    }

    this.pointsGeo.attributes.color.needsUpdate = true;
    this.pointsGeo.attributes.pSize.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      
      // 화면 비율이 바뀔 때 그리드 좌표 재계산
      this.scene.remove(this.gridLines);
      this.scene.remove(this.pointsMesh);
      if(this.gridLines) this.gridLines.geometry.dispose();
      if(this.pointsGeo) this.pointsGeo.dispose();
      this.buildMatrixGrid();
      
      this.renderer.setSize(w, h);
    }
  }

  destroy() {
    if (!this.scene) return;
    if (this.gridLines) {
      this.gridLines.geometry.dispose();
      this.gridLines.material.dispose();
      this.scene.remove(this.gridLines);
    }
    if (this.pointsMesh) {
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
    this.explosions = [];
  }
}
