/**
 * src/sketches/002_three_cube.js
 * - [버전] Ver 4.21 (Color Palette 테마 연동 및 관제탑 RESET 하드웨어 동기화 완결판)
 * - No1(모스그린), No2(샌드베이지) 테마 변경 시 오로라 파티클의 성운 그라데이션 컬러 매핑 직결 연동
 * - RESET 클릭 시 Three.js Matrix 리셋 주기를 강제 격발하여 꼬임 현상 완전 원천 차단
 */

export default class ThreeCube {
  constructor(container) {
    this.container = container;
    this.scene = null; 
    this.camera = null;
    this.renderer = null;
    this.guiOverlay = null;
    this.hudMonitor = null;

    this.version = "002호 Cosmic Ambient Aurora Ver 4.21";
    this.isAudioActive = false;
    this.lastSettingsStr = "";

    this.barCount = 180; 
    this.visualNodes = []; 

    this.bgTexture = null;
    this.lastBgSrc = "";
    this.domObserver = null;

    this.currentShapeLogName = "aurora_ring";
    this.textureStatusLog = "배경 성운 대기 중...";
    this.smoothedHeights = new Float32Array(this.barCount);
    this.cameraZoomTime = 0;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05060b, 0.008); 

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 8); 
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x05060b);
    this.renderer.autoClear = false; 
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
    this.scene.add(ambientLight);

    this.buildOnScreenGuideUI();
    this.buildHudMonitorUI();
    this.buildRadialMatrix();
    this.setupDirectInputTracker();
  }

  buildOnScreenGuideUI() {
    const oldOverlay = this.container.querySelector('.cosmic-shader-guide');
    if (oldOverlay) oldOverlay.remove();

    this.guiOverlay = document.createElement('div');
    this.guiOverlay.className = 'cosmic-shader-guide';
    
    Object.assign(this.guiOverlay.style, {
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '85%', maxWidth: '420px', backgroundColor: 'rgba(6, 8, 12, 0.94)',
      border: '1px solid rgba(0, 255, 204, 0.4)', borderRadius: '12px', padding: '22px',
      color: '#ffffff', fontFamily: 'sans-serif', zIndex: '20', pointerEvents: 'none',
      boxShadow: '0 6px 25px rgba(0,0,0,0.7)', boxSizing: 'border-box', textAlign: 'center',
      transition: 'opacity 0.6s cubic-bezier(0.25, 1, 0.5, 1)'
    });

    this.guiOverlay.innerHTML = `
      <div style="color: #00ffcc; font-size: 11px; text-align: left; margin-bottom: 14px; font-weight: bold;">
        🌌 STAGE STATUS: ${this.version} READY
      </div>
      <h3 style="color: #ffffff; font-size: 16.5px; margin: 0 0 16px 0; font-weight: 600;">우주 성운의 호흡을 닮은 빛의 오로라</h3>
      <div style="font-size: 12.5px; text-align: left; line-height: 1.75; color: #cccccc;">
        <p style="margin: 6px 0;">✨ 오른쪽 관제탑의 슬라이더 조작 및 <strong style="color: #00ffcc;">Color Style Palette</strong> 드롭다운 변경이 실시간으로 웅장하게 투사됩니다.</p>
        <p style="margin: 6px 0; color: #ffcc00;">▶️ 재생 버튼을 누르면 이 가이드창이 아련하게 사라집니다.</p>
      </div>
    `;
    this.container.appendChild(this.guiOverlay);
  }

  buildHudMonitorUI() {
    const oldHud = this.container.querySelector('.cosmic-hud-monitor');
    if (oldHud) oldHud.remove();
    this.hudMonitor = document.createElement('div');
    this.hudMonitor.className = 'cosmic-hud-monitor';
    Object.assign(this.hudMonitor.style, {
      position: 'absolute', top: '15px', right: '15px', width: '180px',
      backgroundColor: 'rgba(4, 5, 8, 0.82)', border: '1px solid rgba(0, 255, 204, 0.5)',
      borderRadius: '6px', padding: '10px', color: '#00ffcc', fontFamily: 'monospace',
      fontSize: '11px', zIndex: '25', pointerEvents: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.6)'
    });
    this.container.appendChild(this.hudMonitor);
    this.updateHudMonitorDisplay();
  }

  updateHudMonitorDisplay(audioLen = 0) {
    if (!this.hudMonitor) return;
    this.hudMonitor.innerHTML = `
      <div style="color:#ffffff; font-weight:bold; border-bottom:1px solid #222; padding-bottom:3px; margin-bottom:5px;">📊 002호 HUD</div>
      <div>모드: <span style="color:#fff;">AMBIENT NEBULA</span></div>
      <div>오디오: <span style="color:#fff;">${this.isAudioActive ? 'HEALING' : 'STOPPED'}</span></div>
      <div>입자 밴드: <span style="color:#fff;">${this.barCount} Points</span></div>
      <div style="margin-top:4px; font-size:10px; color:#ffcc00; border-top:1px solid #222; padding-top:3px;">🖼️ NEBULA BG:</div>
      <div style="color:#fff; font-size:10px; word-break:break-all;">${this.textureStatusLog}</div>
    `;
  }

  buildRadialMatrix() {
    this.visualNodes.forEach(node => this.scene.remove(node.points));
    this.visualNodes = [];

    const ui = this.getUIParams();

    const createCircleGlowTexture = () => {
      const matCanvas = document.createElement('canvas'); matCanvas.width = 64; matCanvas.height = 64;
      const matCtx = matCanvas.getContext('2d');
      let grad = matCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.7)');
      grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      matCtx.fillStyle = grad; matCtx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(matCanvas);
    };

    const particleTexture = createCircleGlowTexture();
    let currentBaseRadius = THREE.MathUtils.mapLinear(ui.scatter, 5, 50, 0.4, 2.8); 

    let seedValue = ui.seed;
    const seededRandom = () => {
      let x = Math.sin(seedValue++) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < this.barCount; i++) {
      const angle = (i / this.barCount) * Math.PI * 2;
      let freqRatio = i / this.barCount;
      
      let finalX = Math.cos(angle) * currentBaseRadius;
      let finalY = Math.sin(angle) * currentBaseRadius;

      // 💡 [Color Style Palette 파이프라인 002호 오로라 컬러 하드웨어 매핑]
      let finalColor = new THREE.Color();
      if (ui.style.includes('monochrome')) {
          // No1: 모스 그린 그라데이션
          finalColor.set('#234233').lerp(new THREE.Color('#5cb887'), freqRatio);
      } else if (ui.style.includes('neon')) {
          // No2: 샌드 베이지 그라데이션
          finalColor.set('#ab9172').lerp(new THREE.Color('#f5f0e6'), freqRatio);
      } else if (ui.style.includes('pastel')) {
          // No3: 은은한 대지 새벽녘
          finalColor.set('#1f2a38').lerp(new THREE.Color('#f0bfa1'), freqRatio);
      } else if (ui.style.includes('custom')) {
          // No4: 커스텀 컬러 파싱
          finalColor.set(ui.gas1Hex).lerp(new THREE.Color(ui.gas2Hex), freqRatio);
      } else {
          // No5: 올 랜덤 시드 그라데이션
          let seedColor1 = new THREE.Color().setHSL((seedValue * 0.01) % 1.0, 0.9, 0.6);
          let seedColor2 = new THREE.Color().setHSL((seedValue * 0.02 + 0.4) % 1.0, 0.8, 0.5);
          finalColor.copy(seedColor1).lerp(seedColor2, freqRatio);
      }

      const pMaterial = new THREE.PointsMaterial({
        color: finalColor,
        size: THREE.MathUtils.mapLinear(ui.glow, 10, 250, 0.15, 0.95), 
        map: particleTexture,
        transparent: true,
        opacity: 0.65, 
        blending: THREE.AdditiveBlending, 
        depthWrite: false
      });

      const pGeometry = new THREE.BufferGeometry();
      const positions = [];
      const originalOffsets = [];

      for (let j = 0; j < 6; j++) {
        let streamRadius = currentBaseRadius * (1.0 + j * 0.08);
        positions.push(Math.cos(angle) * streamRadius, Math.sin(angle) * streamRadius, 0);
        originalOffsets.push(j * 0.08);
      }

      pGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const points = new THREE.Points(pGeometry, pMaterial);
      this.scene.add(points);

      this.visualNodes.push({
        points: points, angle: angle, baseX: finalX, baseY: finalY,
        currentBaseRadius: currentBaseRadius, freqIdxRatio: freqRatio,
        offsets: originalOffsets, seedShift: seededRandom()
      });
    }
    this.updateHudMonitorDisplay();
  }

  setupDirectInputTracker() {
    const forceSyncTexture = () => {
      let targetSrc = ""; let sourceElement = null;
      if (window.currentUploadedImageElement && window.currentUploadedImageElement.src) {
        targetSrc = window.currentUploadedImageElement.src; sourceElement = window.currentUploadedImageElement;
      } else {
        const allImgs = document.querySelectorAll('.media-resources img') || document.querySelectorAll('img');
        for (let img of allImgs) {
          if (img.src && (img.src.includes('blob:') || img.src.length > 30 || img.src.includes('data:image'))) {
            targetSrc = img.src; sourceElement = img; break;
          }
        }
      }
      if (targetSrc && targetSrc !== this.lastBgSrc && sourceElement) {
        this.lastBgSrc = targetSrc; this.textureStatusLog = "성운 캔버스 매핑 중..."; this.updateHudMonitorDisplay();
        try {
          const tex = new THREE.Texture(sourceElement); tex.needsUpdate = true;
          this.bgTexture = tex; this.scene.background = this.bgTexture;
          this.textureStatusLog = `🎉 성운 조화 완료`; this.updateHudMonitorDisplay();
        } catch (e) {
          const loader = new THREE.TextureLoader();
          loader.load(targetSrc, (t) => { this.bgTexture = t; this.scene.background = this.bgTexture; this.textureStatusLog = `🎉 성운 로더 복구`; this.updateHudMonitorDisplay(); });
        }
      }
    };
    this.domObserver = new MutationObserver(() => { forceSyncTexture(); });
    this.domObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
    setInterval(forceSyncTexture, 1000);
  }

  getUIParams() {
      // 💡 드롭다운 돔 객체 정밀 추출 바인딩 고정
      const seedInput = document.getElementById('num-cosmic-seed');
      const scatterInput = document.getElementById('num-cosmic-scatter'); 
      const glowInput = document.getElementById('num-cosmic-glow');       
      const colorSelect = document.getElementById('select-cosmic-color');
      const gainInput = document.getElementById('num-cosmic-gain');

      const p1 = document.getElementById('picker-gas1');
      const p2 = document.getElementById('picker-gas2');

      return {
          scatter: scatterInput ? parseFloat(scatterInput.value) : 22, 
          glow: glowInput ? parseFloat(glowInput.value) : 85,          
          burst: gainInput ? parseFloat(gainInput.value) / 100 : 1.0, 
          seed: seedInput ? parseInt(seedInput.value) : 42,            
          style: colorSelect ? colorSelect.value.toLowerCase() : 'neon',
          gas1Hex: (p1 && p1.value) ? p1.value : '#ff0055',
          gas2Hex: (p2 && p2.value) ? p2.value : '#00ffcc'
      };
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.clear();

    const time = Date.now() * 0.0008;
    const ui = this.getUIParams();

    let currentSettingsStr = `${ui.seed}-${ui.scatter}-${ui.style}-${ui.gas1Hex}-${ui.gas2Hex}`;
    if (this.lastSettingsStr !== currentSettingsStr) {
        this.lastSettingsStr = currentSettingsStr;
        this.buildRadialMatrix();
    }

    const audioEl = document.querySelector('audio');
    let isPlaying = audioEl && !audioEl.paused;

    if (isPlaying || (audioData && audioData.vol > 0.005)) {
        this.isAudioActive = true;
        if (this.guiOverlay) this.guiOverlay.style.opacity = '0';
    } else {
        this.isAudioActive = false;
        if (this.guiOverlay) this.guiOverlay.style.opacity = '1';
    }

    let rawData = [];
    if (audioData) { rawData = audioData.raw || audioData.spectrum || []; }
    
    let hasRaw = rawData && rawData.length > 10;
    let masterVol = audioData ? (audioData.vol || 0.1) : 0.1;
    masterVol *= ui.burst;

    if (Math.floor(time * 60) % 25 === 0) { this.updateHudMonitorDisplay(rawData.length); }

    this.visualNodes.forEach((node, i) => {
      let freqVolume = 0;
      if (this.isAudioActive && hasRaw) {
          let currentIdx = Math.floor(node.freqIdxRatio * (rawData.length - 1));
          freqVolume = rawData[currentIdx] / 255.0;
      } else {
          freqVolume = Math.sin(time * 2.0 + node.seedShift * 6.0) * 0.08 + 0.08;
      }

      freqVolume *= ui.burst;
      let currentH = this.smoothedHeights[i];
      currentH += (freqVolume - currentH) * 0.06; 
      this.smoothedHeights[i] = currentH;

      let waveDampingResponse = currentH * 3.5 + Math.sin(time * 1.5 + node.angle * 2.0) * 0.12;

      const posAttr = node.points.geometry.attributes.position;
      const posArray = posAttr.array;

      let dirX = Math.cos(node.angle); let dirY = Math.sin(node.angle);

      for (let j = 0; j < 6; j++) {
        let dynamicRadius = node.currentBaseRadius * (1.0 + node.offsets[j]) + (waveDampingResponse * (1.0 + j * 0.15));
        let idx3 = j * 3;
        posArray[idx3] = dirX * dynamicRadius;
        posArray[idx3 + 1] = dirY * dynamicRadius;
        posArray[idx3 + 2] = Math.sin(time + j * 0.5) * 0.05;
      }
      posAttr.needsUpdate = true;
      node.points.material.opacity = THREE.MathUtils.lerp(node.points.material.opacity, 0.35 + currentH * 0.5, 0.1);
    });

    this.cameraZoomTime += 0.005;
    let subtleZoomZ = 7.5 + Math.sin(this.cameraZoomTime) * 0.6 - (masterVol * 0.4);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, subtleZoomZ, 0.05);

    this.scene.rotation.z = time * 0.02 + (masterVol * 0.03);
    this.scene.rotation.y = Math.sin(time * 0.2) * 0.03;

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    if (this.camera && this.renderer) {
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h);
    }
  }

  destroy() {
    if (!this.scene) return;
    this.scene.traverse((object) => { if (!object.isPoints) return; object.geometry.dispose(); object.material.dispose(); });
    if (this.renderer) { this.container.removeChild(this.renderer.domElement); this.renderer.dispose(); }
    if (this.hudMonitor) this.hudMonitor.remove();
    if (this.domObserver) this.domObserver.disconnect();
    this.scene = null; this.camera = null; this.renderer = null; this.visualNodes = [];
  }
}
