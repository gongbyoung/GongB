/**
 * 009_three_fireworks.js (512-Channel Data Wave Ocean Edition)
 * 512개의 모든 원본 주파수(Raw FFT) 데이터를 단 하나의 웅장한 데이터 네온 파도로 연결하여
 * 악기별 고유 선율과 잔음을 실시간 레이저 형태로 시각화하는 고성능 스테이지
 */
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

export default class ThreeDataWaveOcean {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // 💡 오디오 분석기 원본 출력 해상도인 512 채널 전원 투입
    this.numBands = 512; 
    
    this.bgPlane = null; // 고정 배경 이미지 패널
    this.waveLine = null; // 512 포인트를 연결한 메인 데이터 파도 선
    this.wavePoints = null; // 파도의 정점마다 빛나는 미세 광원들
    
    this.smoothedFreq = new Float32Array(this.numBands); // 부드러운 파형 유지용 버퍼

    this.currentImageEl = null; 
    this.baseTexture = null;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 14); 
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    this.buildStaticBackground();
    this.buildDataWaveGeometry();
  }

  createFallbackTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
    gradient.addColorStop(0, '#05050a');
    gradient.addColorStop(1, '#11111a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('좌측 메뉴에서 이미지를 업로드하세요.', 512, 512);
    return new THREE.CanvasTexture(canvas);
  }

  buildStaticBackground() {
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 14 * 2; 
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
    this.bgPlane.position.set(0, 0, -1); // 파도 뒤에 배치
    this.scene.add(this.bgPlane);
  }

  // 💡 512개의 점을 단 하나의 연속 버퍼 구조로 빌드 (CPU 부하 0% 지향)
  buildDataWaveGeometry() {
    const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 14 * 2; 
    const viewWidth = viewHeight * this.camera.aspect;

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.numBands * 3);
    const colors = new Float32Array(this.numBands * 3);

    // 가로 화면을 512칸으로 정밀 분할하여 초기 일직선 좌표 생성
    for (let i = 0; i < this.numBands; i++) {
      const t = i / (this.numBands - 1);
      // 화면 좌측 끝(-width/2)부터 우측 끝(width/2)까지 정렬
      positions[i * 3] = - (viewWidth / 2) + t * viewWidth;
      positions[i * 3 + 1] = -1.5; // 하단부 기본 베이스라인 높이
      positions[i * 3 + 2] = 0;

      // 기본 주파수 그라데이션 컬러 버퍼 세팅
      colors[i * 3] = 1; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1;
      this.smoothedFreq[i] = 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // 1. 🌊 파도의 줄기를 그릴 선 메테리얼 (버텍스 컬러 연동)
    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      linewidth: 3 // 브라우저 지원 사양에 따라 두께 표현
    });
    this.waveLine = new THREE.Line(geo, lineMat);
    this.scene.add(this.waveLine);

    // 2. ✨ 파도의 정점마다 박힐 네온 입자 시스템 추가 연동
    const pointMat = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    this.wavePoints = new THREE.Points(geo, pointMat);
    this.scene.add(this.wavePoints);
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    // 실시간 이미지 업데이트 감지 및 반영
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

    const linePos = this.waveLine.geometry.attributes.position.array;
    const lineCol = this.waveLine.geometry.attributes.color.array;

    // 💡 [초고해상도 512채널 런타임 매핑] 
    const hasRawData = audioData && audioData.raw && audioData.raw.length > 0;
    
    // 악기 고유의 배음 구조를 살리는 색상 매트릭스
    const cMat = new THREE.Color();

    for (let i = 0; i < this.numBands; i++) {
      let rawVal = 0;
      
      if (hasRawData) {
        // 512개 오디오 데이터를 가공 없이 1대1 다이렉트 바인딩
        rawVal = audioData.raw[i] || 0;
      } else if (audioData) {
        // 백업용 의사 주파수 그라데이션 유도
        let f = i / this.numBands;
        if (f < 0.25) rawVal = THREE.MathUtils.lerp(audioData.subBass, audioData.bass, f * 4.0) * 255;
        else if (f < 0.75) rawVal = THREE.MathUtils.lerp(audioData.bass, audioData.mid, (f - 0.25) * 2.0) * 255;
        else rawVal = THREE.MathUtils.lerp(audioData.mid, audioData.treble, (f - 0.75) * 4.0) * 255;
      }

      let normalized = rawVal / 255.0;
      
      // 미세 노이즈 제거용 게이트 필터
      if (normalized < 0.08) normalized = 0;

      // 💡 바이올린/오케스트라 고음역대 활성화를 위한 고주파수 보정 가중치
      let freqFactor = i / this.numBands;
      let boost = 1.0 + freqFactor * 2.5; 
      
      // 대비 스케일링을 통해 악기 고유의 파동 텍스처 강조
      let finalForce = Math.pow(normalized, 1.6) * gain * boost * 4.5;

      // 💡 [현악기 서스테인 특화 스무딩] 피크 도달은 광속, 하강 릴리즈는 극도로 부드럽게 유지
      if (finalForce > this.smoothedFreq[i]) {
        this.smoothedFreq[i] = finalForce; // 소리가 커질 땐 즉시 반응
      } else {
        this.smoothedFreq[i] += (finalForce - this.smoothedFreq[i]) * 0.12; // 현악기 여운 표현
      }

      const activeHeight = this.smoothedFreq[i];

      // 🌊 512개의 버텍스 Y축 고도 실시간 변조 (기본 높이 -1.5에서 위로 솟구침)
      // Scatter(분산 범위) 슬라이더를 올리면 물결 파동의 도약 높이가 더 웅장해집니다.
      linePos[i * 3 + 1] = -1.5 + (activeHeight * (scatter / 2.2));

      // 🎨 [스타일별 네온 컬러 실시간 그라데이션 도포]
      if (colorStyle === 'neon') {
        // 저음(레드/마젠타) -> 중음(그린/사이언) -> 고음(블루/바이올렛)으로 이어지는 무지개 파도
        cMat.setHSL(freqFactor * 0.85, 1.0, 0.55);
      } else if (colorStyle === 'pastel') {
        cMat.setHSL(freqFactor * 0.85, 0.6, 0.7);
      } else if (colorStyle === 'custom') {
        // 사용자가 지정한 가스1, 가스2 색상 사이를 512개 조각으로 부드럽게 보간(Lerp)
        cMat.set(customColors.gas1).lerp(new THREE.Color(customColors.gas2), freqFactor);
      } else {
        cMat.setHex(0xffffff);
      }

      // 소리 강도에 비례해 타오르는 섬광 보정 (피크점은 하얗게)
      cMat.lerp(new THREE.Color(0xffffee), Math.min(1.0, activeHeight * 0.15));

      lineCol[i * 3] = cMat.r;
      lineCol[i * 3 + 1] = cMat.g;
      lineCol[i * 3 + 2] = cMat.b;
    }

    // 데이터 변경 사항 GPU 메모리에 즉시 전송 명령
    this.waveLine.geometry.attributes.position.needsUpdate = true;
    this.waveLine.geometry.attributes.color.needsUpdate = true;
    this.wavePoints.geometry.attributes.position.needsUpdate = true;
    this.wavePoints.geometry.attributes.color.needsUpdate = true;

    // 입자 발광 크기 UI 연동
    this.wavePoints.material.size = Math.max(0.05, glow * 0.16);
    this.waveLine.material.opacity = Math.min(1.0, glow * 0.9);

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      
      const viewHeight = Math.tan(THREE.MathUtils.degToRad(50 / 2)) * 14 * 2; 
      const viewWidth = viewHeight * this.camera.aspect;
      
      if(this.bgPlane) {
          this.bgPlane.geometry.dispose();
          this.bgPlane.geometry = new THREE.PlaneGeometry(viewWidth, viewHeight);
      }

      // 리사이즈 시 512개 격자 가로폭 전면 재조정
      const linePos = this.waveLine.geometry.attributes.position.array;
      for (let i = 0; i < this.numBands; i++) {
        const t = i / (this.numBands - 1);
        linePos[i * 3] = - (viewWidth / 2) + t * viewWidth;
      }
      this.waveLine.geometry.attributes.position.needsUpdate = true;
      
      this.renderer.setSize(w, h);
    }
  }

  destroy() {
    if (!this.scene) return;
    if (this.bgPlane) {
        this.bgPlane.geometry.dispose();
        this.bgPlane.material.dispose();
    }
    if (this.waveLine) {
      this.waveLine.geometry.dispose();
      this.waveLine.material.dispose();
      this.scene.remove(this.waveLine);
    }
    if (this.wavePoints) {
      this.wavePoints.geometry.dispose();
      this.wavePoints.material.dispose();
      this.scene.remove(this.wavePoints);
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
