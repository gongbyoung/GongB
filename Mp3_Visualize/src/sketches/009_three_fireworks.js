/**
 * 009_three_fireworks.js (Media Art Wall Edition)
 * 업로드된 이미지를 36분할하여, 현악기의 지속음과 타격음을 완벽하게 분리해 반응하는 입체 패널
 */
export default class ThreeMediaArtWall {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.cols = 6;
    this.rows = 6;
    this.numPanels = this.cols * this.rows; // 36분할 패널
    
    this.panels = []; 
    this.originPositions = []; // 원래 위치 기억용
    this.prevFreqBins = new Float32Array(this.numPanels); 

    this.loadedSeed = -1;
    this.shuffleMap = Array.from({length: this.numPanels}, (_, i) => i);
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010103, 0.04);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 15); 
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x010103);
    this.container.appendChild(this.renderer.domElement);

    // 입체감을 위한 조명 세팅
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(0, 0, 10);
    this.scene.add(pointLight);

    this.buildImageWall();
  }

  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // 업로드된 이미지가 없을 때를 대비한 기본 텍스처
  createFallbackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#112233');
    gradient.addColorStop(0.5, '#224466');
    gradient.addColorStop(1, '#001122');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font = '40px sans-serif';
    ctx.fillText('Upload an Image!', 100, 256);
    return new THREE.CanvasTexture(canvas);
  }

  buildImageWall() {
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 15 * 2; 
    const viewWidth = viewHeight * this.camera.aspect;
    
    // 패널 사이의 미세한 간격을 위해 0.98 곱함 (타일 느낌 강조)
    const stepX = viewWidth / this.cols;
    const stepY = viewHeight / this.rows;
    const panelWidth = stepX * 0.98;
    const panelHeight = stepY * 0.98;

    // 💡 [핵심 기술 1] 유저가 업로드한 이미지를 가져와서 36개로 쪼개기 위한 베이스 텍스처
    let baseTexture;
    if (window.currentUploadedImageElement) {
        baseTexture = new THREE.Texture(window.currentUploadedImageElement);
        baseTexture.needsUpdate = true;
    } else {
        baseTexture = this.createFallbackTexture();
    }

    const geo = new THREE.BoxGeometry(panelWidth, panelHeight, 0.2); // 입체적인 박스

    for (let i = 0; i < this.numPanels; i++) {
      let c = i % this.cols;
      let r = Math.floor(i / this.cols);
      
      const x = (c - this.cols / 2 + 0.5) * stepX;
      const y = (this.rows / 2 - r - 0.5) * stepY;

      // 각 패널마다 이미지의 특정 구역(UV Offset)만 보여주도록 텍스처 복제 후 잘라내기
      const tex = baseTexture.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1 / this.cols, 1 / this.rows);
      tex.offset.set(c / this.cols, (this.rows - 1 - r) / this.rows);

      const mat = new THREE.MeshPhongMaterial({ 
          map: tex,
          shininess: 80,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, 0);
      
      this.scene.add(mesh);
      this.panels.push(mesh);
      this.originPositions.push({ x: x, y: y }); // 복귀할 원래 좌표 기억
      this.prevFreqBins[i] = 0;
    }
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    let seed = 42, scatter = 2.2, gain = 1.0;
    let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

    if (window.cosmicEngineSettings) {
      seed = window.cosmicEngineSettings.seed;
      scatter = window.cosmicEngineSettings.scatterExponent; 
      gain = window.cosmicEngineSettings.audioGain;          
      customColors = window.cosmicEngineSettings.customColors;
    }

    // Seed 변경 시: 그림은 그대로 두되, '어떤 주파수가 어떤 타일을 때릴지' 악기 배치를 셔플!
    if (this.loadedSeed !== seed) {
      this.loadedSeed = seed;
      this.shuffleMap = Array.from({length: this.numPanels}, (_, i) => i).sort(() => this.seededRandom(seed++) - 0.5);
      
      // 색상 스타일 변경 시 패널 측면/테두리에 빛나는 색상 주입
      const colorStyle = window.cosmicEngineSettings.colorStyle;
      this.panels.forEach((p, i) => {
          let emissiveColor = new THREE.Color();
          if (colorStyle === 'full-random') emissiveColor.setHSL(this.seededRandom(seed + i), 1.0, 0.2);
          else if (colorStyle === 'neon') emissiveColor.setHSL(i % 2 === 0 ? 0.93 : 0.48, 1.0, 0.2);
          else if (colorStyle === 'custom') emissiveColor.set(i % 2 === 0 ? customColors.gas1 : customColors.gas2);
          else emissiveColor.setHex(0x000000);
          p.material.emissive = emissiveColor;
      });
    }

    const currentFreqBins = new Float32Array(this.numPanels);
    
    // 💡 [핵심 기술 2] "바이올린을 잡아내기 위한" 로그 스케일 주파수 피크(Peak) 추출법
    if (audioData && audioData.raw && audioData.raw.length > 0) {
      // 512개의 주파수 중, 악기 소리가 몰려있는 앞쪽 200개 대역을 36분할
      // 이때 단순히 평균을 내지 않고, 현악기의 날카로운 음을 잡기 위해 해당 구간의 "최고값(Max)"을 뽑아냅니다.
      for (let i = 0; i < this.numPanels; i++) {
        // 저음은 좁게, 고음은 넓게 잡는 곡선(비선형) 분할
        let startBin = Math.floor(Math.pow(i / this.numPanels, 1.5) * 150) + 1;
        let endBin = Math.floor(Math.pow((i + 1) / this.numPanels, 1.5) * 150) + 1;
        if (endBin <= startBin) endBin = startBin + 1;

        let maxVal = 0;
        for (let j = startBin; j < endBin; j++) {
          if (audioData.raw[j] > maxVal) maxVal = audioData.raw[j];
        }
        
        // 고주파수일수록 신호가 약하므로 볼륨을 강제로 끌어올림 (바이올린 보정)
        let highFreqBoost = 1.0 + (i / this.numPanels) * 2.5; 
        currentFreqBins[i] = Math.pow(maxVal / 255.0, 1.2) * highFreqBoost * gain;
      }
    }

    for (let i = 0; i < this.numPanels; i++) {
      const panel = this.panels[i];
      const origin = this.originPositions[i];
      
      // 이 패널이 담당할 악기(주파수 대역) 가져오기
      const targetFreq = currentFreqBins[this.shuffleMap[i]];
      
      // 💡 [핵심 기술 3] 튀어오를 땐 즉각 반영, 내려갈 땐 서서히 (바이올린 여운 표현)
      if (targetFreq > this.prevFreqBins[i]) {
          this.prevFreqBins[i] = targetFreq; // 공격(Attack)은 빠르게!
      } else {
          this.prevFreqBins[i] += (targetFreq - this.prevFreqBins[i]) * 0.15; // 릴리즈(Release)는 부드럽게~
      }
      
      const smoothFreq = this.prevFreqBins[i];

      // 1. Z축 펌핑: 바이올린 소리가 "지속"되면, 패널이 계속 화면 쪽으로 밀려 나와 유지됨
      const pumpZ = smoothFreq * 5.0; // 최대 5만큼 앞으로 튀어나옴
      panel.position.z = pumpZ;

      // 발광 효과: 튀어나올수록 패널 측면에서 강한 빛이 뿜어져 나옴
      panel.material.emissiveIntensity = smoothFreq * 2.5;

      // 2. 물리적 진동 (Shake): 볼륨이 강할 때는 제자리에서 부들부들 떨림 (Scatter 슬라이더 연동)
      if (smoothFreq > 0.15) {
          const shakePower = (scatter / 2.2) * smoothFreq * 0.3;
          panel.position.x = origin.x + (Math.random() - 0.5) * shakePower;
          panel.position.y = origin.y + (Math.random() - 0.5) * shakePower;
      } else {
          // 소리가 멈추면 원래 X, Y 위치로 칼같이 복귀
          panel.position.x = origin.x;
          panel.position.y = origin.y;
      }
    }

    // 공간 전체가 베이스 울림에 맞춰 미세하게 흔들리는 시네마틱 효과
    const time = Date.now() * 0.001;
    this.camera.position.z = 15 + Math.sin(time * 3) * 0.1;

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      
      // 창 크기가 바뀔 때 패널 위치 재계산
      const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 15 * 2; 
      const viewWidth = viewHeight * this.camera.aspect;
      const stepX = viewWidth / this.cols;
      const stepY = viewHeight / this.rows;

      for (let i = 0; i < this.numPanels; i++) {
        let c = i % this.cols;
        let r = Math.floor(i / this.cols);
        
        const x = (c - this.cols / 2 + 0.5) * stepX;
        const y = (this.rows / 2 - r - 0.5) * stepY;
        
        this.originPositions[i] = { x: x, y: y };
        this.panels[i].position.set(x, y, this.panels[i].position.z);
      }
      
      this.renderer.setSize(w, h);
    }
  }

  destroy() {
    if (!this.scene) return;
    this.panels.forEach(p => {
      p.geometry.dispose();
      p.material.map.dispose(); // 복제된 텍스처 삭제
      p.material.dispose();
      this.scene.remove(p);
    });
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.panels = [];
  }
}
