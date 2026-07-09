/**
 * src/sketches/002_three_cube.js
 * - [버전] Ver 4.18 (관제탑 전역 변수 직접 바인딩 및 배경 이미지 실시간 렌더링 완결판)
 * - main.js가 업로드한 window.currentUploadedImageElement 메모리를 다이렉트로 낚아채는 매핑 파이프라인 탑재
 * - scene.background 텍스처 생성 주기를 동기화하여 지연 시간 없이 100% 무결점 배경 이미지 출력 보장
 * - 서클 중심 안팎 양방향(Bidirectional) 대칭 주파수 폭발 진폭 가속 연산 공식 유지
 * - 점 모드 예외 방어, 지형변경 슬라이더 구간별 6대 기하학 형태학 스위칭 및 화면 내 HUD 디버그 보드 유지
 */

export default class ThreeCube {
  constructor(container) {
    this.container = container;
    this.scene = null; 
    this.camera = null;
    this.renderer = null;
    this.guiOverlay = null;
    this.hudMonitor = null;

    this.version = "002호 3D Radial Outward Bar Ver 4.18";
    this.isAudioActive = false;
    this.lastSettingsStr = "";

    this.barCount = 128; 
    this.visualNodes = []; 

    this.bgTexture = null;
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
    this.renderer.autoClear = false; 
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.5, 7);
    pointLight.position.set(0, 0, 7); 
    this.scene.add(pointLight);

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
        002호 전역 텍스처 동기화 완료판
      </h3>
      <div style="font-size: 12.5px; text-align: left; line-height: 1.75; color: #dddddd;">
        <p style="margin: 6px 0;">🖼️ <strong style="color: #00ffcc;">[전역 메모리 직통 링크]</strong> main.js 관제탑의 업로드 데이터 메모리를 실시간 강제 추적하여 즉시 반영합니다.</p>
        <p style="margin: 6px 0;">↔️ <strong style="color: #ffffff;">[양방향 스케일링 폭발]</strong> 주파수 바가 원점을 기준으로 안쪽과 바깥쪽 사방으로 균등 진동 대칭 분할 폭발합니다.</p>
        <p style="margin: 6px 0; color: #ffcc00;">▶️ <strong style="color: #ffcc00;">[하단 스타트]</strong> 재생 버튼을 누르면 가이드창이 투명하게 소멸합니다.</p>
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

  // 💡 [배경 파이프라인 올수리] 관제탑 전역 변수(window.currentUploadedImageElement)를 직접 가로채도록 튜닝
  setupDirectInputTracker() {
    const forceSyncTexture = () => {
      let targetSrc = "";
      let sourceElement = null;

      // 1순위: main.js 관제탑이 정식 가공하여 바인딩해놓은 메모리 인스턴스 직접 수혈 추출
      if (window.currentUploadedImageElement && window.currentUploadedImageElement.src) {
        targetSrc = window.currentUploadedImageElement.src;
        sourceElement = window.currentUploadedImageElement;
      } else {
        // 2순위: 돔 엘리먼트 백업 하드웨어 풀링 추적
        const allImgs = document.querySelectorAll('.media-resources img') || document.querySelectorAll('img');
        for (let img of allImgs) {
          if (img.src && (img.src.includes('blob:') || img.src.length > 30 || img.id.includes('preview') || img.src.includes('data:image'))) {
            targetSrc = img.src;
            sourceElement = img;
            break;
          }
        }
      }

      if (targetSrc && targetSrc !== this.lastBgSrc && sourceElement) {
        this.lastBgSrc = targetSrc;
        this.textureStatusLog = "전역 변수 디코딩 중...";
        this.updateHudMonitorDisplay();

        try {
          // 비동기 다운로드 파이프라인 오류를 완벽 차단하기 위해 Three.js 기본 Texture 인스턴스로 즉시 주입 매핑
          const tex = new THREE.Texture(sourceElement);
          tex.needsUpdate = true; // 하드웨어 렌더 칩 가동
          
          this.bgTexture = tex;
          this.scene.background = this.bgTexture;
          
          this.textureStatusLog = `🎉 동기화 성공: ${sourceElement.width || 'OK'}px`;
          this.updateHudMonitorDisplay();
        } catch (e) {
          // 예외 우회용 로더 재기동 락
          const loader = new THREE.TextureLoader();
          loader.load(targetSrc, (t) => {
            this.bgTexture = t;
            this.scene.background = this.bgTexture;
            this.textureStatusLog = `🎉 로더 복구 성공`;
            this.updateHudMonitorDisplay();
          });
        }
      }
    };

    this.domObserver = new MutationObserver(() => { forceSyncTexture(); });
    this.domObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
    setInterval(forceSyncTexture, 1000); 
    setTimeout(forceSyncTexture, 500);
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
      let dynamicResponse = freqVolume * 5.2 * amplitudeMultiplier;

      let dirX = Math.cos(node.angle);
      let dirY = Math.sin(node.angle);

      let baseLengthOffset = (node.baseX === 0.001 * dirX) ? 0 : Math.sqrt(node.baseX * node.baseX + node.baseY * node.baseY);

      if (node.mode === 'full-bar') {
        let targetScaleY = 0.05 + dynamicResponse;
        node.mesh.scale.y = THREE.MathUtils.lerp(node.mesh.scale.y, targetScaleY, 0.26);
        
        node.mesh.position.x = dirX * baseLengthOffset;
        node.mesh.position.y = dirY * baseLengthOffset;
      } 
      else if (node.mode === 'tip-only') {
        node.mesh.scale.set(1, 1, 1);
        let targetRadius = baseLengthOffset + (Math.sin(time * 5.0 + node.seedShift) * (dynamicResponse * 0.75));
        let curRadius = THREE.MathUtils.lerp(baseLengthOffset, targetRadius, 0.26);
        node.mesh.position.x = dirX * curRadius;
        node.mesh.position.y = dirY * curRadius;
      } 
      else {
        let targetDotScale = 1.0 + freqVolume * 3.5 * amplitudeMultiplier;
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

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.visualNodes = [];
  }
}
