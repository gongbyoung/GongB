/**
 * src/sketches/002_three_cube.js
 * - [버전] Ver 4.16 (autoClear 버퍼 초기화 버그 완전 수정 및 배경 화면 완전 표출판)
 * - 렌더러의 autoClear 강제 초기화 현상을 방어하기 위해 수동 클리어 파이프라인 및 백그라운드 텍스처 락 장치 탑재
 * - 10% 초컴팩트 스케일, Z: -30 레이어 후방 배치, 6대 기하학 레이아웃 매퍼 및 화면 내 HUD 디버그 보드 유지
 */

export default class ThreeCube {
  constructor(container) {
    this.container = container;
    this.scene = null; 
    this.camera = null;
    this.renderer = null;
    this.guiOverlay = null;
    this.hudMonitor = null;

    this.version = "002호 3D Radial Outward Bar Ver 4.16";
    this.isAudioActive = false;
    this.lastSettingsStr = "";

    this.barCount = 128; 
    this.visualNodes = []; 

    this.bgTexture = null;
    this.bgMesh = null;
    this.lastBgSrc = "";
    this.domObserver = null;

    this.currentShapeLogName = "circle";
    this.textureStatusLog = "배경 이미지 대기 중...";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x06060a, 0.005); 

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 8); 
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x06060a);
    
    // 💡 [배경 증발 차단 핵심] 관제탑의 자동 버퍼 클리어가 배경 텍스처를 지우지 못하도록 락을 겁니다.
    this.renderer.autoClear = false; 
    
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); 
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.5, 100);
    pointLight.position.set(0, 0, 7); 
    this.scene.add(pointLight);

    const bgGeo = new THREE.PlaneGeometry(80, 50); 
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x09090e, depthWrite: false, fog: false });
    this.bgMesh = new THREE.Mesh(bgGeo, bgMat);
    this.bgMesh.position.set(0, 0, -30); 
    this.scene.add(this.bgMesh);

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
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '85%',
      maxWidth: '420px',
      backgroundColor: 'rgba(8, 10, 15, 0.94)',
      border: '1px solid rgba(0, 255, 204, 0.6)', 
      borderRadius: '12px',
      padding: '22px',
      color: '#ffffff',
      fontFamily: 'sans-serif',
      zIndex: '20',
      boxShadow: '0 6px 25px rgba(0,0,0,0.6)',
      boxSizing: 'border-box',
      textAlign: 'center',
      pointerEvents: 'none',
      transition: 'opacity 0.45s cubic-bezier(0.25, 1, 0.5, 1)'
    });

    this.guiOverlay.innerHTML = `
      <div style="color: #00ffcc; font-size: 11px; text-align: left; margin-bottom: 14px; font-weight: bold; letter-spacing: 0.5px;">
        ⚙️ STAGE STATUS: ${this.version} READY
      </div>
      <h3 style="color: #ffffff; font-size: 16.5px; margin: 0 0 16px 0; font-weight: 600;">
        002호 정면 방사형 비주얼라이저 가이드
      </h3>
      <div style="font-size: 12.5px; text-align: left; line-height: 1.75; color: #dddddd;">
        <p style="margin: 6px 0;">🖼️ <strong style="color: #00ffcc;">[배경 대기 완료]</strong> autoClear 차단 필터가 결합되어 배경 이미지가 상시 유지됩니다.</p>
        <p style="margin: 6px 0;">🎲 <strong style="color: #ffffff;">[6대 기하학 스위칭]</strong> 지형변경 슬라이더 구간별로 [점 ➡️ 서클 ➡️ 삼각형 ➡️ 사각형 ➡️ 별 ➡️ 타원] 변형 완료!</p>
        <p style="margin: 6px 0; color: #ffcc00;">▶️ <strong style="color: #ffcc00;">[하단 스타트]</strong> 재생 버튼을 누르면 가이드창이 사라집니다!</p>
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
      position: 'absolute',
      top: '15px',
      right: '15px',
      width: '180px',
      backgroundColor: 'rgba(5, 7, 12, 0.85)',
      border: '1px solid #00ffcc',
      borderRadius: '6px',
      padding: '10px',
      color: '#00ffcc',
      fontFamily: 'monospace',
      fontSize: '11px',
      lineHeight: '1.5',
      zIndex: '25',
      pointerEvents: 'none',
      boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
    });
    
    this.container.appendChild(this.hudMonitor);
    this.updateHudMonitorDisplay();
  }

  updateHudMonitorDisplay(audioLen = 0) {
    if (!this.hudMonitor) return;
    this.hudMonitor.innerHTML = `
      <div style="color:#ffffff; font-weight:bold; border-bottom:1px solid #333; padding-bottom:3px; margin-bottom:5px;">📊 002호 HUD</div>
      <div>형태: <span style="color:#fff;">${this.currentShapeLogName.toUpperCase()}</span></div>
      <div>오디오: <span style="color:#fff;">${this.isAudioActive ? 'RUNNING' : 'STOPPED'}</span></div>
      <div>버퍼: <span style="color:#fff;">${audioLen} bands</span></div>
      <div style="margin-top:4px; font-size:10px; color:#ffcc00; border-top:1px solid #333; padding-top:3px;">🖼️ TEXTURE STATUS:</div>
      <div style="color:#fff; font-size:10px; word-break:break-all;">${this.textureStatusLog}</div>
    `;
  }

  buildRadialMatrix() {
    this.visualNodes.forEach(node => this.scene.remove(node.mesh));
    this.visualNodes = [];

    const baseBoxGeometry = new THREE.BoxGeometry(0.12, 1, 0.12);
    const ui = this.getUIParams();

    let currentBaseRadius = THREE.MathUtils.mapLinear(ui.scatter, 0.5, 5.0, 0.02, 0.4); 

    let seedValue = ui.seed;
    const seededRandom = () => {
      let x = Math.sin(seedValue++) * 10000;
      return x - Math.floor(x);
    };

    let shapeType = 'circle';
    if (ui.seed <= 16) shapeType = 'dot';
    else if (ui.seed <= 33) shapeType = 'circle';
    else if (ui.seed <= 50) shapeType = 'triangle';
    else if (ui.seed <= 66) shapeType = 'square';
    else if (ui.seed <= 83) shapeType = 'star';
    else shapeType = 'ellipse';

    this.currentShapeLogName = shapeType; 

    for (let i = 0; i < this.barCount; i++) {
      const angle = (i / this.barCount) * Math.PI * 2;
      let freqRatio = i / this.barCount;
      
      let finalX = 0;
      let finalY = 0;

      if (shapeType === 'dot') {
        finalX = 0.001 * Math.cos(angle);
        finalY = 0.001 * Math.sin(angle);
      } 
      else if (shapeType === 'circle') {
        finalX = Math.cos(angle);
        finalY = Math.sin(angle);
      } 
      else if (shapeType === 'triangle') {
        let triAngle = angle + Math.PI / 6;
        let rTri = (Math.sqrt(3) / (Math.sqrt(3) * Math.cos(triAngle % (Math.PI * 2 / 3) - Math.PI / 3)));
        if (isNaN(rTri) || !isFinite(rTri)) rTri = 1.0;
        finalX = Math.cos(angle) * rTri;
        finalY = Math.sin(angle) * rTri;
      } 
      else if (shapeType === 'square') {
        let rSquare = Math.min(1.0 / Math.abs(Math.cos(angle)), 1.0 / Math.abs(Math.sin(angle)));
        if (isNaN(rSquare) || !isFinite(rSquare)) rSquare = 1.0;
        finalX = Math.cos(angle) * rSquare;
        finalY = Math.sin(angle) * rSquare;
      } 
      else if (shapeType === 'star') {
        let starPoints = 5;
        let rStar = (0.6 + 0.4 * Math.cos(starPoints * angle));
        finalX = Math.cos(angle) * rStar;
        finalY = Math.sin(angle) * rStar;
      } 
      else {
        finalX = Math.cos(angle) * 1.25;
        finalY = Math.sin(angle) * 0.8;
      }

      finalX *= currentBaseRadius;
      finalY *= currentBaseRadius;

      let noiseShift = 1.0 + (Math.sin(freqRatio * Math.PI * 4.0) * 0.02);
      finalX *= noiseShift;
      finalY *= noiseShift;

      let drawRand = seededRandom();
      let mode = 'full-bar';
      if (drawRand < 0.34) mode = 'tip-only';    
      else if (drawRand < 0.67) mode = 'start-only';  

      let finalColor = new THREE.Color();
      let useWireframe = false;

      if (ui.style.includes('neon')) {
        finalColor.setHSL(0.02 + freqRatio * 0.08, 0.95, 0.55);
      } else if (ui.style.includes('monochrome')) {
        finalColor.setHSL(0.55 + freqRatio * 0.12, 0.9, 0.5);
      } else if (ui.style.includes('custom-color') || ui.style.includes('custom')) {
        if (mode === 'full-bar') finalColor.set(ui.gas1Hex);
        else if (mode === 'tip-only') finalColor.set(ui.gas2Hex);
        else finalColor.set(ui.starHex);
      } else if (ui.style.includes('full-random') || ui.style.includes('gradient')) {
        finalColor.setHSL(seededRandom(), 0.95, 0.55);
      } else {
        finalColor.setHSL(seededRandom(), 1.0, 0.6);
        useWireframe = true;
      }

      const material = new THREE.MeshStandardMaterial({
        color: finalColor,
        roughness: 0.15,
        metalness: 0.6,
        emissive: finalColor,
        emissiveIntensity: useWireframe ? 0.7 : 0.2,
        wireframe: useWireframe
      });

      let currentGeo = baseBoxGeometry;
      if (mode === 'start-only') {
        currentGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08); 
      } else if (mode === 'tip-only') {
        currentGeo = new THREE.BoxGeometry(0.09, 0.12, 0.09); 
      }

      const mesh = new THREE.Mesh(currentGeo, material);

      mesh.position.x = finalX;
      mesh.position.y = finalY;
      mesh.position.z = 0;

      mesh.rotation.z = Math.atan2(finalY, finalX) - Math.PI / 2;

      this.scene.add(mesh);

      this.visualNodes.push({
        mesh: mesh,
        angle: angle,
        baseX: finalX,
        baseY: finalY,
        mode: mode,
        freqIdxRatio: freqRatio,
        seedShift: seededRandom()
      });
    }
    this.updateHudMonitorDisplay();
  }

  setupDirectInputTracker() {
    const loader = new THREE.TextureLoader();
    const forceLoadTexture = () => {
      const allImgs = document.querySelectorAll('.media-resources img') || document.querySelectorAll('img');
      let currentSrc = "";
      for (let img of allImgs) {
        if (img.src && (img.src.includes('blob:') || img.src.length > 30 || img.id.includes('preview') || img.src.includes('data:image'))) {
          currentSrc = img.src;
          break;
        }
      }
      if (currentSrc && currentSrc !== this.lastBgSrc) {
        this.lastBgSrc = currentSrc;
        this.textureStatusLog = "이미지 감지됨, 로딩 중...";
        this.updateHudMonitorDisplay();

        loader.load(
          currentSrc,
          (tex) => {
            this.textureStatusLog = `🎉 성공: ${tex.image.width}x${tex.image.height}`;
            console.log(`[002호 수동 갱신 보증 마커]가 작동했습니다.`);
            this.updateHudMonitorDisplay();
            this.bgTexture = tex;
            if (this.bgMesh) {
              this.bgMesh.material.dispose();
              this.bgMesh.material = new THREE.MeshBasicMaterial({ map: this.bgTexture, depthWrite: false, fog: false });
              this.bgMesh.material.needsUpdate = true;
            }
          },
          undefined,
          (err) => {
            this.textureStatusLog = `❌ 에러: 로더 거부`;
            this.updateHudMonitorDisplay();
          }
        );
      }
    };
    this.domObserver = new MutationObserver(() => { forceLoadTexture(); });
    this.domObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
    setInterval(forceLoadTexture, 1000); 
    setTimeout(forceLoadTexture, 500);
  }

  getUIParams() {
      const seedSlider = document.getElementById('slide-cosmic-seed');
      const scatterSlider = document.getElementById('slide-cosmic-scatter'); 
      const glowSlider = document.getElementById('slide-cosmic-glow');       
      const colorSelect = document.getElementById('select-cosmic-color');
      const gainSlider = document.getElementById('slide-cosmic-gain');

      const p1 = document.getElementById('picker-cosmic-color1') || document.getElementById('color1') || document.querySelector('.color-pickers input:nth-of-type(1)');
      const p2 = document.getElementById('picker-cosmic-color2') || document.getElementById('color2') || document.querySelector('.color-pickers input:nth-of-type(2)');
      const p3 = document.getElementById('picker-cosmic-color3') || document.getElementById('color3') || document.querySelector('.color-pickers input:nth-of-type(3)');

      return {
          scatter: scatterSlider ? parseFloat(scatterSlider.value) : 2.2, 
          glow: glowSlider ? parseFloat(glowSlider.value) : 85,          
          burst: gainSlider ? parseFloat(gainSlider.value) / 100 : 1.0, 
          seed: seedSlider ? parseInt(seedSlider.value) : 42,            
          style: colorSelect ? colorSelect.value.toLowerCase() : 'neon',
          
          gas1Hex: (p1 && p1.value) ? p1.value : '#a52a2a',
          gas2Hex: (p2 && p2.value) ? p2.value : '#00ffcc',
          starHex: (p3 && p3.value) ? p3.value : '#ffff00'
      };
  }

  resetCanvas(p, isPreview = false) {}

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    // 💡 [수동 버퍼 드로잉 기폭 장치] autoClear=false 상태이므로 매 프레임 수동으로 잔상을 클리어합니다.
    this.renderer.clear();

    const time = Date.now() * 0.001;
    const ui = this.getUIParams();

    let currentSettingsStr = `${ui.seed}-${ui.scatter}-${ui.style}-${ui.gas1Hex}-${ui.gas2Hex}-${ui.starHex}`;
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
    if (audioData) {
        rawData = audioData.raw || audioData.spectrum || audioData.frequencyData || [];
    }
    
    let hasRaw = rawData && rawData.length > 10;
    let masterVol = audioData ? (audioData.vol || audioData.volume || 0.1) : 0.1;
    masterVol *= ui.burst;

    if (Math.floor(time * 60) % 20 === 0) {
      this.updateHudMonitorDisplay(rawData.length);
    }

    let amplitudeMultiplier = THREE.MathUtils.mapLinear(ui.glow, 0.1, 1.5, 0.3, 2.5);

    this.visualNodes.forEach((node) => {
      let freqVolume = 0;
      if (this.isAudioActive) {
        if (hasRaw) {
          let currentIdx = Math.floor(node.freqIdxRatio * (rawData.length - 1));
          freqVolume = rawData[currentIdx] / 255.0;
        } else {
          let wave1 = Math.sin(time * 4.0 + node.angle * 3.0);
          let wave2 = Math.cos(time * 2.5 - node.seedShift * 10.0);
          freqVolume = (wave1 * 0.15 + wave2 * 0.15) + 0.2;
        }
      } else {
        freqVolume = Math.sin(time * 2.0 + node.seedShift * 5.0) * 0.08 + 0.08;
      }

      freqVolume *= ui.burst;
      let dynamicResponse = freqVolume * 3.8 * amplitudeMultiplier;

      let dirX = Math.cos(node.angle);
      let dirY = Math.sin(node.angle);

      let baseLengthOffset = (node.baseX === 0.001 * dirX) ? 0 : Math.sqrt(node.baseX * node.baseX + node.baseY * node.baseY);

      if (node.mode === 'full-bar') {
        let targetScaleY = 0.05 + dynamicResponse;
        node.mesh.scale.y = THREE.MathUtils.lerp(node.mesh.scale.y, targetScaleY, 0.26);
        let currentRadius = baseLengthOffset + (node.mesh.scale.y / 2);
        node.mesh.position.x = dirX * currentRadius;
        node.mesh.position.y = dirY * currentRadius;
      } 
      else if (node.mode === 'tip-only') {
        node.mesh.scale.set(1, 1, 1);
        let targetRadius = baseLengthOffset + (dynamicResponse * 0.85);
        let curRadius = THREE.MathUtils.lerp(baseLengthOffset, targetRadius, 0.26);
        node.mesh.position.x = dirX * curRadius;
        node.mesh.position.y = dirY * curRadius;
      } 
      else {
        let targetDotScale = 1.0 + freqVolume * 2.8 * amplitudeMultiplier;
        let curDotScale = THREE.MathUtils.lerp(node.mesh.scale.x, targetDotScale, 0.28);
        node.mesh.scale.set(curDotScale, curDotScale, curDotScale);
        node.mesh.position.x = node.baseX;
        node.mesh.position.y = node.baseY;
      }

      if (node.mesh.material) {
        node.mesh.material.emissiveIntensity = THREE.MathUtils.lerp(node.mesh.material.emissiveIntensity, 0.15 + freqVolume * 2.5, 0.2);
      }
    });

    this.scene.rotation.z = time * 0.04 + (masterVol * 0.06);
    this.scene.rotation.y = Math.sin(time * 0.3) * 0.04;

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
    this.scene.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      object.material.dispose();
    });
    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    if (this.hudMonitor) this.hudMonitor.remove();
    if (this.domObserver) this.domObserver.disconnect();
    if (this.bgTexture) this.bgTexture.dispose();

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.visualNodes = [];
  }
}
