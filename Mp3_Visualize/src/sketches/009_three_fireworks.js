/**
 * 009_three_fireworks.js (Media Art Wall Edition)
 * 현악기(바이올린) 등 특정 주파수 대역을 초정밀 분리하여, 
 * 36분할된 업로드 이미지 패널이 개별 악기처럼 입체적으로 진동하는 미디어 아트
 */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

export default class ThreeMediaArtWall {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.cols = 6;
    this.rows = 6;
    this.numPanels = this.cols * this.rows; 
    
    this.panels = []; 
    this.originPositions = []; 
    this.prevFreqBins = new Float32Array(this.numPanels); 

    this.loadedSeed = -1;
    this.shuffleMap = Array.from({length: this.numPanels}, (_, i) => i);
    
    // 💡 실시간 이미지 변경 감지용 변수
    this.currentImageEl = null; 
    this.baseTexture = null;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010103, 0.03);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 14); 
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x010103);
    this.container.appendChild(this.renderer.domElement);

    // 💡 조명을 하얗게(0xffffff) 주어 이미지 원본 색상을 완벽하게 보존
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const pointLight = new THREE.PointLight(0xffffff, 0.6);
    pointLight.position.set(0, 0, 10);
    this.scene.add(pointLight);

    this.buildImageWall();
  }

  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  createFallbackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#222');
    gradient.addColorStop(1, '#444');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('좌측 메뉴에서', 256, 230);
    ctx.fillText('이미지를 업로드 해주세요!', 256, 280);
    return new THREE.CanvasTexture(canvas);
  }

  buildImageWall() {
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 14 * 2; 
    const viewWidth = viewHeight * this.camera.aspect;
    
    const stepX = viewWidth / this.cols;
    const stepY = viewHeight / this.rows;
    const panelWidth = stepX * 0.98; // 타일 사이 미세한 틈
    const panelHeight = stepY * 0.98;

    this.currentImageEl = window.currentUploadedImageElement || null;
    if (this.currentImageEl) {
        this.baseTexture = new THREE.Texture(this.currentImageEl);
        this.baseTexture.needsUpdate = true;
    } else {
        this.baseTexture = this.createFallbackTexture();
    }

    const geo = new THREE.BoxGeometry(panelWidth, panelHeight, 0.2); 

    for (let i = 0; i < this.numPanels; i++) {
      let c = i % this.cols;
      let r = Math.floor(i / this.cols);
      
      const x = (c - this.cols / 2 + 0.5) * stepX;
      const y = (this.rows / 2 - r - 0.5) * stepY;

      const tex = this.baseTexture.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1 / this.cols, 1 / this.rows);
      tex.offset.set(c / this.cols, (this.rows - 1 - r) / this.rows);

      const mat = new THREE.MeshPhongMaterial({ 
          map: tex,
          shininess: 30,
          // 💡 발광색을 흰색으로 지정해 이미지 본연의 밝기만 팽창하도록 수정
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, 0);
      
      this.scene.add(mesh);
      this.panels.push(mesh);
      this.originPositions.push({ x: x, y: y }); 
      this.prevFreqBins[i] = 0;
    }
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    // 💡 [실시간 이미지 교체 로직] 재생 도중 사진을 업로드하면 즉시 타일 전체 교체!
    if (this.currentImageEl !== window.currentUploadedImageElement) {
        this.currentImageEl = window.currentUploadedImageElement;
        if (this.currentImageEl) {
            this.baseTexture = new THREE.Texture(this.currentImageEl);
            this.baseTexture.needsUpdate = true;
            
            for (let i = 0; i < this.numPanels; i++) {
                let c = i % this.cols;
                let r = Math.floor(i / this.cols);
                const tex = this.baseTexture.clone();
                tex.needsUpdate = true;
                tex.repeat.set(1 / this.cols, 1 / this.rows);
                tex.offset.set(c / this.cols, (this.rows - 1 - r) / this.rows);
                
                if (this.panels[i].material.map) this.panels[i].material.map.dispose();
                this.panels[i].material.map = tex;
                this.panels[i].material.needsUpdate = true;
            }
        }
    }

    let seed = 42, scatter = 2.2, gain = 1.0;
    if (window.cosmicEngineSettings) {
      seed = window.cosmicEngineSettings.seed;
      scatter = window.cosmicEngineSettings.scatterExponent; 
      gain = window.cosmicEngineSettings.audioGain;          
    }

    // 악기 자리 배치(Shuffle)
    if (this.loadedSeed !== seed) {
      this.loadedSeed = seed;
      this.shuffleMap = Array.from({length: this.numPanels}, (_, i) => i).sort(() => this.seededRandom(seed++) - 0.5);
    }

    const currentFreqBins = new Float32Array(this.numPanels);
    
    // 💡 [바이올린 등 초정밀 현악기 캐치 엔진] 
    if (audioData && audioData.raw && audioData.raw.length > 0) {
      for (let i = 0; i < this.numPanels; i++) {
        // 512개의 로우 데이터 중, 악기 소리가 분포하는 2~90번 인덱스에 레이저 조준
        const t = i / (this.numPanels - 1);
        const binIndex = Math.floor(2 + Math.pow(t, 1.8) * 88); 
        
        let val = audioData.raw[binIndex] || 0;
        let normalized = val / 255.0;
        
        // 💡 핵심 대비 필터(Contrast Filter): 
        // 3제곱을 곱해서 잔잔한 화음/잡음은 0으로 날려버리고, 선명하게 뚫고 나오는 주파수만 크게 반응시킴
        currentFreqBins[i] = Math.pow(normalized, 3.5) * gain * 4.0;
      }
    }

    for (let i = 0; i < this.numPanels; i++) {
      const panel = this.panels[i];
      const origin = this.originPositions[i];
      
      const targetFreq = currentFreqBins[this.shuffleMap[i]];
      
      // 지속음(현악기) 부드러운 유지 로직
      if (targetFreq > this.prevFreqBins[i]) {
          this.prevFreqBins[i] = targetFreq; 
      } else {
          this.prevFreqBins[i] += (targetFreq - this.prevFreqBins[i]) * 0.15; 
      }
      
      const smoothFreq = this.prevFreqBins[i];

      // 💡 [입체 돌출] 특정 주파수가 터지면 그 타일만 쑤욱 튀어나옴
      panel.position.z = smoothFreq * 4.0;

      // 💡 [빛의 팽창] 네온 컬러가 아니라, 타일 이미지 자체의 밝기가 섬광처럼 밝아짐!
      panel.material.emissiveIntensity = smoothFreq * 1.5;

      // 💡 [물리 진동] 소리가 터질 때 부들부들 떨리는 타격감
      if (smoothFreq > 0.1) {
          const shakePower = (scatter / 2.2) * smoothFreq * 0.2;
          panel.position.x = origin.x + (Math.random() - 0.5) * shakePower;
          panel.position.y = origin.y + (Math.random() - 0.5) * shakePower;
      } else {
          // 원래 위치로 복귀
          panel.position.x = origin.x;
          panel.position.y = origin.y;
      }
    }

    // 웅장한 카메라 무빙
    const time = Date.now() * 0.001;
    this.camera.position.z = 14 + Math.sin(time * 2) * 0.15;
    this.camera.position.y = Math.cos(time * 1.5) * 0.05;

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      
      const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 14 * 2; 
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
      if(p.material.map) p.material.map.dispose();
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
