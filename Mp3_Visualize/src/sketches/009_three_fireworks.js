/**
 * 009_three_fireworks.js (12-Channel Raw FFT Waveform Edition)
 * 3개의 매크로 대역을 버리고, 512개의 Raw 데이터를 12구간으로 완벽하게 독립 분할하여
 * 12개의 파형이 각자 다른 악기(주파수)에만 반응하도록 만든 미디어 아트
 */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

export default class ThreeMediaArtWall {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.numBands = 12; // 정확히 12채널 독립 분할
    this.cols = 4; 
    this.rows = 3; 
    
    this.bgPlane = null; 
    this.waveforms = []; 
    this.pointsPerWave = 60; 
    
    this.prevFreqBins = new Float32Array(this.numBands); 

    this.currentImageEl = null; 
    this.baseTexture = null;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 15); 
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000);
    this.container.appendChild(this.renderer.domElement);

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

    const geo = new THREE.PlaneGeometry(viewWidth, viewHeight); 
    const mat = new THREE.MeshBasicMaterial({ 
        map: this.baseTexture,
        color: 0xffffff 
    });

    this.bgPlane = new THREE.Mesh(geo, mat);
    this.bgPlane.position.set(0, 0, -1); 
    this.scene.add(this.bgPlane);
  }

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

      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(this.pointsPerWave * 3);
      
      for (let j = 0; j < this.pointsPerWave; j++) {
        const px = originX - (cellWidth * 0.4) + (j / (this.pointsPerWave - 1)) * (cellWidth * 0.8);
        positions[j*3] = px;
        positions[j*3+1] = originY; 
        positions[j*3+2] = 0;
      }
      
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

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
    
    // 💡 [초정밀 12분할 엔진] 가짜 3대역이 아닌, 512개 Raw 데이터를 진짜 12구간으로 자릅니다!
    if (audioData && audioData.raw && audioData.raw.length > 0) {
      // 512개 중 의미 있는 소리가 몰려있는 0~200 인덱스 사이를 로그 스케일로 분할
      const maxActiveBin = 200;
      
      for (let i = 0; i < this.numBands; i++) {
        // 저음은 촘촘하게, 고음은 넓게 잡아서 악기별 배정 확률을 높임 (Logarithmic scale)
        let startBin = Math.floor(Math.pow(i / this.numBands, 1.5) * maxActiveBin);
        let endBin = Math.floor(Math.pow((i + 1) / this.numBands, 1.5) * maxActiveBin);
        if (endBin <= startBin) endBin = startBin + 1;

        let sum = 0;
        let count = 0;
        for (let j = startBin; j < endBin; j++) {
            sum += audioData.raw[j];
            count++;
        }
        
        let avgRaw = (sum / count) / 255.0; // 0.0 ~ 1.0 정규화
        
        // 💡 [잡음 완벽 차단] 특정 데시벨 이하는 아예 0으로 날려버림 (노이즈 게이트)
        if (avgRaw < 0.12) avgRaw = 0;
        
        // 고음부 볼륨 보정 (고음은 원래 데시벨이 낮으므로 증폭시켜줌)
        let trebleBoost = 1.0 + (i / this.numBands) * 1.5;

        // 제곱을 줘서 튀는 소리만 강하게 반응하도록 설정
        currentFreqBins[i] = Math.pow(avgRaw, 1.8) * gain * trebleBoost * 3.5;
      }
    } else if (audioData) {
      // raw 데이터가 완전히 끊겼을 때만 최후의 수단으로 3대역 보간법 사용
      for (let i = 0; i < this.numBands; i++) {
        let factor = i / (this.numBands - 1);
        if (factor < 0.25) currentFreqBins[i] = THREE.MathUtils.lerp(audioData.subBass, audioData.bass, factor * 4.0);
        else if (factor < 0.75) currentFreqBins[i] = THREE.MathUtils.lerp(audioData.bass, audioData.mid, (factor - 0.25) * 2.0);
        else currentFreqBins[i] = THREE.MathUtils.lerp(audioData.mid, audioData.treble, (factor - 0.75) * 4.0);
        currentFreqBins[i] *= gain * 1.5;
      }
    }

    const time = Date.now() * 0.005;

    for (let i = 0; i < this.numBands; i++) {
      const wf = this.waveforms[i];
      const targetFreq = currentFreqBins[i];
      
      // 파형 스무딩
      this.prevFreqBins[i] += (targetFreq - this.prevFreqBins[i]) * 0.25; 
      const smoothFreq = this.prevFreqBins[i];

      const pos = wf.mesh.geometry.attributes.position.array;
      const amplitude = smoothFreq * Math.max(1.0, scatter / 2.0) * 1.5; 

      for (let j = 0; j < this.pointsPerWave; j++) {
        // 양 끝은 얌전하게 0으로 모이고, 중간에서 파동이 크게 치도록 봉투(Envelope) 씌움
        const envelope = Math.sin((j / (this.pointsPerWave - 1)) * Math.PI);
        
        // 2개의 주파수를 섞어 진짜 오디오 파형처럼 복잡하게 꼬이도록 연출
        const wave1 = Math.sin(j * 0.6 - time * 1.5) * amplitude;
        const wave2 = Math.cos(j * 1.2 + time * 2.0) * (amplitude * 0.4);
        
        pos[j*3+1] = wf.originY + (wave1 + wave2) * envelope;
      }
      
      wf.mesh.geometry.attributes.position.needsUpdate = true;

      // 12구역 독립 색상
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

      // 소리가 아예 없을 때는 0.1(거의 안 보임), 소리가 튈 때만 네온사인처럼 밝아짐
      wf.mesh.material.color = c;
      wf.mesh.material.opacity = 0.1 + Math.min(0.9, smoothFreq * glow * 2.0);
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      
      const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 15 * 2; 
      const viewWidth = viewHeight * this.camera.aspect;
      
      if(this.bgPlane) {
          this.bgPlane.geometry.dispose();
          this.bgPlane.geometry = new THREE.PlaneGeometry(viewWidth, viewHeight);
      }

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
