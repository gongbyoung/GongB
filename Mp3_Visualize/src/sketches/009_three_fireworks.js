/**
 * 009_three_fireworks.js (12-Channel Waveform Overlay Edition)
 * 이미지는 100% 원본 상태로 고정(Static)하고, 
 * 정확히 12분할된 주파수 대역에 1:1로 매칭되는 12개의 독립 파형(Waveform)을 오버레이하는 미디어 아트
 */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

export default class ThreeMediaArtWall {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.numBands = 12; // 정확히 12개의 주파수 대역
    this.cols = 4; // 가로 4칸
    this.rows = 3; // 세로 3칸 (4x3 = 12)
    
    this.bgPlane = null; // 고정된 배경 이미지
    this.waveforms = []; // 12개의 파형 라인 객체
    this.pointsPerWave = 60; // 파형 하나당 꺾이는 점의 개수
    
    this.prevFreqBins = new Float32Array(this.numBands); 

    this.currentImageEl = null; 
    this.baseTexture = null;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 15); // 카메라도 고정
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000);
    this.container.appendChild(this.renderer.domElement);

    // 원본 색상을 그대로 보여주기 위한 기본 조명
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    this.buildStaticBackground();
    this.buildWaveformGrid();
  }

  createFallbackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
    gradient.addColorStop(0, '#111');
    gradient.addColorStop(1, '#222');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '50px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('좌측 메뉴에서 이미지를 업로드하세요.', 512, 512);
    return new THREE.CanvasTexture(canvas);
  }

  // 💡 1. 배경 이미지는 절대 움직이거나 빛나지 않는 평면(Plane)으로 박제
  buildStaticBackground() {
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 15 * 2; 
    const viewWidth = viewHeight * this.camera.aspect;

    this.currentImageEl = window.currentUploadedImageElement || null;
    if (this.currentImageEl) {
        this.baseTexture = new THREE.Texture(this.currentImageEl);
        this.baseTexture.needsUpdate = true;
    } else {
        this.baseTexture = this.createFallbackTexture();
    }

    // 화면을 꽉 채우는 하나의 거대한 판
    const geo = new THREE.PlaneGeometry(viewWidth, viewHeight); 
    const mat = new THREE.MeshBasicMaterial({ 
        map: this.baseTexture,
        color: 0xffffff // 원본 색상 유지
    });

    this.bgPlane = new THREE.Mesh(geo, mat);
    this.bgPlane.position.set(0, 0, -1); // 파형보다 살짝 뒤에 배치
    this.scene.add(this.bgPlane);
  }

  // 💡 2. 화면을 12분할하여 각각의 구역에 파형(선)을 생성
  buildWaveformGrid() {
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 15 * 2; 
    const viewWidth = viewHeight * this.camera.aspect;
    
    const cellWidth = viewWidth / this.cols;
    const cellHeight = viewHeight / this.rows;

    for (let i = 0; i < this.numBands; i++) {
      let c = i % this.cols;
      let r = Math.floor(i / this.cols);
      
      const originX = (c - this.cols / 2 + 0.5) * cellWidth;
      const originY = (this.rows / 2 - r - 0.5) * cellHeight;

      // 파형을 그릴 선(Line) 생성
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(this.pointsPerWave * 3);
      
      // 초기 상태는 일직선
      for (let j = 0; j < this.pointsPerWave; j++) {
        // 셀 너비의 80%만큼 선을 그림
        const px = originX - (cellWidth * 0.4) + (j / (this.pointsPerWave - 1)) * (cellWidth * 0.8);
        positions[j*3] = px;
        positions[j*3+1] = originY; 
        positions[j*3+2] = 0;
      }
      
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      // 부드럽게 빛나는 네온 선 재질
      const mat = new THREE.LineBasicMaterial({ 
          color: 0xffffff, 
          transparent: true,
          opacity: 0.8,
          linewidth: 2
      });

      const line = new THREE.Line(geo, mat);
      this.scene.add(line);
      
      this.waveforms.push({
          mesh: line,
          originX: originX,
          originY: originY,
          width: cellWidth * 0.8
      });
    }
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    // 실시간 이미지 교체
    if (this.currentImageEl !== window.currentUploadedImageElement) {
        this.currentImageEl = window.currentUploadedImageElement;
        if (this.currentImageEl) {
            this.baseTexture = new THREE.Texture(this.currentImageEl);
            this.baseTexture.needsUpdate = true;
            this.bgPlane.material.map = this.baseTexture;
            this.bgPlane.material.needsUpdate = true;
        }
    }

    let scatter = 2.2, gain = 1.0, glow = 0.85;
    let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };
    let colorStyle = 'neon';

    if (window.cosmicEngineSettings) {
      scatter = window.cosmicEngineSettings.scatterExponent; 
      gain = window.cosmicEngineSettings.audioGain;          
      glow = window.cosmicEngineSettings.glowIntensity;
      customColors = window.cosmicEngineSettings.customColors;
      colorStyle = window.cosmicEngineSettings.colorStyle;
    }

    const currentFreqBins = new Float32Array(this.numBands);
    
    // 💡 [초정밀 12분할 엔진] Raw 데이터를 정확히 12구역으로 분리
    if (audioData && audioData.raw && audioData.raw.length > 0) {
      // 12가지 악기 소리가 분포하는 2~120 인덱스 사이를 정밀하게 12등분
      for (let i = 0; i < this.numBands; i++) {
        // 저음부터 고음까지 지수 형태로 밴드 할당 (악기 소리 분리 목적)
        const t = i / (this.numBands - 1);
        const binIndex = Math.floor(2 + Math.pow(t, 1.5) * 118); 
        
        let val = audioData.raw[binIndex] || 0;
        let normalized = val / 255.0;
        
        // 특정 임계치(Threshold)를 넘지 못하는 잡음은 완전히 차단(0)
        if (normalized < 0.15) normalized = 0;
        
        // 날카로운 음만 반응하도록 대비 부여
        currentFreqBins[i] = Math.pow(normalized, 2.0) * gain * 3.0;
      }
    }

    const time = Date.now() * 0.005;

    for (let i = 0; i < this.numBands; i++) {
      const wf = this.waveforms[i];
      const targetFreq = currentFreqBins[i];
      
      // 스무딩 (부드러운 파형 애니메이션을 위해)
      this.prevFreqBins[i] += (targetFreq - this.prevFreqBins[i]) * 0.2; 
      const smoothFreq = this.prevFreqBins[i];

      const pos = wf.mesh.geometry.attributes.position.array;
      
      // 💡 [파형 요동 로직] 해당 주파수가 들어왔을 때만 위아래로 출렁임
      const amplitude = smoothFreq * (scatter / 2.2) * 2.0; 

      for (let j = 0; j < this.pointsPerWave; j++) {
        // 양 끝은 고정(0)되고, 가운데로 갈수록 진폭이 커지는 Envelope 적용
        const envelope = Math.sin((j / (this.pointsPerWave - 1)) * Math.PI);
        
        // 사인파(Sine Wave)와 노이즈를 섞어 실제 오디오 파형 느낌 구현
        const wave1 = Math.sin(j * 0.5 - time) * amplitude;
        const wave2 = Math.cos(j * 0.8 + time * 1.5) * (amplitude * 0.5);
        
        // Y축 위아래 진동 적용
        pos[j*3+1] = wf.originY + (wave1 + wave2) * envelope;
      }
      
      wf.mesh.geometry.attributes.position.needsUpdate = true;

      // 💡 12개 채널별 고유 색상 매핑
      let c = new THREE.Color();
      if (colorStyle === 'neon') {
        c.setHSL((i / this.numBands) * 0.8, 1.0, 0.6);
      } else if (colorStyle === 'pastel') {
        c.setHSL((i / this.numBands) * 0.8, 0.6, 0.7);
      } else if (colorStyle === 'custom') {
        c.set(i % 2 === 0 ? customColors.gas1 : customColors.gas2);
      } else {
        c.setHex(0xffffff);
      }

      // 소리가 날 때만 선명해지고 조용할 땐 반투명해짐
      wf.mesh.material.color = c;
      wf.mesh.material.opacity = 0.2 + Math.min(0.8, smoothFreq * glow * 2.0);
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      
      // 창 크기 변경 시 배경 크기 재조정
      const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 15 * 2; 
      const viewWidth = viewHeight * this.camera.aspect;
      
      if(this.bgPlane) {
          this.bgPlane.geometry.dispose();
          this.bgPlane.geometry = new THREE.PlaneGeometry(viewWidth, viewHeight);
      }

      // 파형 위치 재조정
      const cellWidth = viewWidth / this.cols;
      const cellHeight = viewHeight / this.rows;

      for (let i = 0; i < this.numBands; i++) {
        let c = i % this.cols;
        let r = Math.floor(i / this.cols);
        const originX = (c - this.cols / 2 + 0.5) * cellWidth;
        const originY = (this.rows / 2 - r - 0.5) * cellHeight;
        
        this.waveforms[i].originX = originX;
        this.waveforms[i].originY = originY;
        this.waveforms[i].width = cellWidth * 0.8;
      }
      
      this.renderer.setSize(w, h);
    }
  }

  destroy() {
    if (!this.scene) return;
    if (this.bgPlane) {
        this.bgPlane.geometry.dispose();
        this.bgPlane.material.dispose();
    }
    this.waveforms.forEach(wf => {
      wf.mesh.geometry.dispose();
      wf.mesh.material.dispose();
      this.scene.remove(wf.mesh);
    });
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.waveforms = [];
  }
}
