/**
 * 009_three_fireworks.js
 * 512개 Raw FFT 데이터를 36개로 쪼개어 완벽히 독립적으로 반응하는 6x6 오디오 매트릭스
 */
export default class ThreeGridGlowStage {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.cols = 6;
    this.rows = 6;
    this.numCells = this.cols * this.rows; // 36분할
    
    this.prevFreqBins = new Float32Array(this.numCells); 
    this.explosions = []; 

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

  createRadialGradient() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)'); 
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)'); 
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }

  buildMatrixGrid() {
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(55 / 2)) * 15 * 2; 
    const viewWidth = viewHeight * this.camera.aspect;
    
    const stepX = viewWidth / this.cols;
    const stepY = viewHeight / this.rows;

    const lineGeo = new THREE.BufferGeometry();
    const linePos = [];
    
    for(let i = 0; i <= this.cols; i++) {
      let x = (i - this.cols / 2) * stepX;
      linePos.push(x, viewHeight / 2, 0, x, -viewHeight / 2, 0);
    }
    for(let i = 0; i <= this.rows; i++) {
      let y = (i - this.rows / 2) * stepY;
      linePos.push(viewWidth / 2, y, 0, -viewWidth / 2, y, 0);
    }
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    this.gridLines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      color: 0x334455, transparent: true, opacity: 0.15 
    }));
    this.scene.add(this.gridLines);

    this.pointsGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(this.numCells * 3);
    const col = new Float32Array(this.numCells * 3);
    const siz = new Float32Array(this.numCells);

    for (let i = 0; i < this.numCells; i++) {
      let c = i % this.cols;
      let r = Math.floor(i / this.cols);
      
      pos[i*3] = (c - this.cols / 2 + 0.5) * stepX;
      pos[i*3+1] = (this.rows / 2 - r - 0.5) * stepY;
      pos[i*3+2] = 0.1; 

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
      blending: THREE.AdditiveBlending, 
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

    if (this.loadedSeed !== seed) {
      this.loadedSeed = seed;
      this.shuffleMap = Array.from({length: this.numCells}, (_, i) => i).sort(() => this.seededRandom(seed++) - 0.5);
    }

    const currentFreqBins = new Float32Array(this.numCells);
    
    // 💡 [핵심 기술 변경] 날것의 512개 Raw FFT 데이터를 36개 구간으로 정밀하게 잘라냅니다.
    if (audioData && audioData.raw && audioData.raw.length > 0) {
      // 대역폭 중 의미 있는 소리가 가장 많은 앞부분(0~180)을 36개로 분할
      const binsPerCell = Math.floor(180 / this.numCells); 

      for (let i = 0; i < this.numCells; i++) {
        let sum = 0;
        for (let j = 0; j < binsPerCell; j++) {
          sum += audioData.raw[i * binsPerCell + j] || 0;
        }
        // 0~255 수치를 0.0 ~ 1.0으로 정규화하고 폭발력(gain)을 곱함
        let avgRaw = (sum / binsPerCell) / 255.0;
        
        // 날것의 데이터는 너무 자잘해서 시각적으로 잘 보이게 곡선(제곱) 스케일링 처리
        currentFreqBins[i] = Math.pow(avgRaw, 1.2) * gain * 2.0;
      }
    } else if (audioData) {
      // 혹시라도 구버전 엔진이라 raw가 없을 때를 대비한 안전 장치 (Fall-back)
      for (let i = 0; i < this.numCells; i++) {
        let factor = i / (this.numCells - 1);
        if (factor < 0.25) currentFreqBins[i] = THREE.MathUtils.lerp(audioData.subBass, audioData.bass, factor * 4.0);
        else if (factor < 0.75) currentFreqBins[i] = THREE.MathUtils.lerp(audioData.bass, audioData.mid, (factor - 0.25) * 2.0);
        else currentFreqBins[i] = THREE.MathUtils.lerp(audioData.mid, audioData.treble, (factor - 0.75) * 4.0);
        currentFreqBins[i] *= gain * 1.5;
      }
    }

    this.explosions.forEach(exp => exp.age += 0.05);
    this.explosions = this.explosions.filter(exp => exp.age < 1.0);

    const colAttr = this.pointsGeo.attributes.color.array;
    const sizAttr = this.pointsGeo.attributes.pSize.array;
    
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(55 / 2)) * 15 * 2; 
    const viewWidth = viewHeight * this.camera.aspect;
    const maxCellSize = (viewWidth / this.cols) * 2.5; 

    for (let i = 0; i < this.numCells; i++) {
      let c = i % this.cols;
      let r = Math.floor(i / this.cols);
      
      const targetFreq = currentFreqBins[this.shuffleMap[i]];
      const delta = targetFreq - this.prevFreqBins[i];
      
      // 스무딩 최적화: 날것의 데이터는 너무 빨리 식으므로 내려갈 땐 천천히 식게 만듦
      this.prevFreqBins[i] += (targetFreq - this.prevFreqBins[i]) * (targetFreq > this.prevFreqBins[i] ? 0.6 : 0.1); 

      // 💡 [독립 스파크 감지] 개별 채널의 주파수가 튈 때만 정확히 폭발 파장 생성
      if (delta > 0.08) {
        this.explosions.push({ c: c, r: r, force: delta, age: 0 });
      }

      let totalGlow = targetFreq * 0.2; 
      
      for (let exp of this.explosions) {
        const dist = Math.sqrt(Math.pow(c - exp.c, 2) + Math.pow(r - exp.r, 2));
        const reach = (scatter / 2.2) * 1.5; 
        let impact = (exp.force * 2.5) / (dist * reach + 1.0);
        impact *= (1.0 - exp.age); 
        totalGlow += Math.max(0, impact);
      }

      totalGlow = Math.min(1.0, totalGlow); 

      sizAttr[i] = (maxCellSize * 0.15) + (maxCellSize * totalGlow * glow * 1.5);

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
        baseColor.setHSL(i / this.numCells, 0.9, 0.4); 
      }

      baseColor.lerp(new THREE.Color(0xffffee), totalGlow);
      
      colAttr[i*3] = baseColor.r * (0.05 + totalGlow * 0.95);
      colAttr[i*3+1] = baseColor.g * (0.05 + totalGlow * 0.95);
      colAttr[i*3+2] = baseColor.b * (0.05 + totalGlow * 0.95);
    }

    this.pointsGeo.attributes.color.needsUpdate = true;
    this.pointsGeo.attributes.pSize.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      
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
