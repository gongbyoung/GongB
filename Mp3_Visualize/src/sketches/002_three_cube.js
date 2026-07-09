/**
 * src/sketches/002_three_cube.js
 * - [버전] Ver 4.14 (듀얼 핸들 오디오 분할 UI 및 화면 내 HUD 디버그 모니터 통합 완결판)
 * - 번잡한 6개 오디오 제어 바를 3개의 영역으로 칼분할하는 듀얼 핸들 결합식 고급 UI 시스템 전면 개조
 * - 3D 화면 오른쪽 상단에 실시간 텔레메트리 HUD 보드를 내장하여 개발자 도구 없이 배경 로딩 상태 직관적 검증 가능
 * - 원천 DOM 다이렉트 텍스처 덤프 엔진을 결합하여 안개 및 뎁스 역전 현상 없는 100% 무결점 배경화면 투사 보장
 * - 10% 초컴팩트 스케일링, 지형변경 슬라이더 구간별 6대 기하학 형태학 스위칭(점, 서클, 삼각, 사각, 별, 타원) 완벽 유지
 */

export default class ThreeCube {
  constructor(container) {
    this.container = container;
    this.scene = null; 
    this.camera = null;
    this.renderer = null;
    this.guiOverlay = null;
    this.hudMonitor = null; // 화면 내 실시간 디버그 모니터 보드

    this.version = "002호 3D Radial Outward Bar Ver 4.14";
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
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.5, 100);
    pointLight.position.set(0, 0, 7); 
    this.scene.add(pointLight);

    // 💡 배경 플레이트 후방 배치 격리 보장
    const bgGeo = new THREE.PlaneGeometry(80, 50); 
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x09090e, depthWrite: false, fog: false });
    this.bgMesh = new THREE.Mesh(bgGeo, bgMat);
    this.bgMesh.position.set(0, 0, -30); 
    this.scene.add(this.bgMesh);

    // [공통 표준 규격] 가이드 레이어 생성
    this.buildOnScreenGuideUI();

    // 💡 [신규 기획] 화면 오른쪽 상단 디버그 로그 HUD 모니터 보드 주입 시공
    this.buildHudMonitorUI();

    // 💡 [신규 기획] 오디오 튜닝 UI를 듀얼 핸들 멀티 서라운드 바 형태로 개조
    this.rebuildAudioTuningPanelUI();

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
        002호 통합 텔레메트리 개조판 가이드
      </h3>
      <div style="font-size: 12.5px; text-align: left; line-height: 1.75; color: #dddddd;">
        <p style="margin: 6px 0;">🎛️ <strong style="color: #00ffcc;">[오디오 UI 전면 개조]</strong> 우측 하단 오디오 튜닝 패널이 3파트 칼분할 듀얼 레인지 바 시스템으로 통합 교체되었습니다.</p>
        <p style="margin: 6px 0;">📊 <strong style="color: #ffffff;">[화면 내 디버그 HUD]</strong> 3D 스튜디오 우측 상단에 실시간 텍스처 성공 유무 검증 보드가 고정 출력됩니다.</p>
        <p style="margin: 6px 0;">🎲 <strong style="color: #ffffff;">[6대 기하학 스위칭]</strong> 지형변경 슬라이더 구간별로 [점 ➡️ 서클 ➡️ 삼각형 ➡️ 사각형 ➡️ 별 ➡️ 타원] 변형 완료!</p>
        <p style="margin: 6px 0; color: #ffcc00;">▶️ <strong style="color: #ffcc00;">[하단 스타트]</strong> 재생 버튼을 누르면 이 가이드창이 투명하게 사라지며 영상이 시작됩니다!</p>
      </div>
    `;
    this.container.appendChild(this.guiOverlay);
  }

  // 💡 [기획 2 구현] 오른쪽 자체 로그 모니터 보드 레이어 시공
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
      <div style="color:#ffffff; font-weight:bold; border-bottom:1px solid #333; padding-bottom:3px; margin-bottom:5px;">📊 002호 STATUS</div>
      <div>형태: <span style="color:#fff;">${this.currentShapeLogName.toUpperCase()}</span></div>
      <div>오디오: <span style="color:#fff;">${this.isAudioActive ? 'RUNNING' : 'STOPPED'}</span></div>
      <div>버퍼: <span style="color:#fff;">${audioLen} bands</span></div>
      <div style="margin-top:4px; font-size:10px; color:#ffcc00; border-top:1px solid #333; padding-top:3px;">🖼️ TEXTURE LOG:</div>
      <div style="color:#fff; font-size:10px; word-break:break-all;">${this.textureStatusLog}</div>
    `;
  }

  // 💡 [기획 1 구현] 기존 6개 슬라이더 폭파 후 단일 바 3영역 주파수 분할 듀얼 레인지 UI 강제 주입 엔진
  rebuildAudioTuningPanelUI() {
    // 공통 사이드 바에 이미 빌드된 오디오 튜닝 랩퍼 타겟팅 추출
    const tuningWrapper = document.querySelector('.audio-tuning') || document.querySelector('#audio-tuning') || document.querySelector('.widget-box:nth-of-type(4)');
    if (!tuningWrapper) return;

    // 내부 기존 노드 요소 전면 클리어
    tuningWrapper.innerHTML = `
      <div class="widget-title" style="color: #00ffcc; font-size: 13px; font-weight: bold; margin-bottom: 12px; letter-spacing: 0.5px;">
        🎵 Audio Tuning Spectrum
      </div>
      <div style="background: rgba(15,20,30,0.6); padding: 12px; border-radius: 8px; border: 1px solid #222530;">
        <div style="display:flex; justify-content:space-between; font-size:11px; color:#aaa; margin-bottom:4px;">
          <span>Bass (Low)</span>
          <span>Mid Range</span>
          <span>Treble (High)</span>
        </div>
        
        <!-- 듀얼 슬라이더 트랙 컴포넌트 마킹 -->
        <div style="position:relative; width:100%; height:8px; background:#222530; border-radius:4px; margin: 15px 0;">
          <div id="sub-track-bar" style="position:absolute; left:25%; right:25%; height:100%; background:#00ffcc; border-radius:4px;"></div>
          
          <input type="range" id="dual-handle-low" min="0" max="100" value="25" style="position:absolute; width:100%; top:-4px; left:0; background:none; pointer-events:none; -webkit-appearance:none;">
          <input type="range" id="dual-handle-high" min="0" max="100" value="75" style="position:absolute; width:100%; top:-4px; left:0; background:none; pointer-events:none; -webkit-appearance:none;">
        </div>

        <div style="display:flex; justify-content:space-between; font-size:10.5px; color:#00ffcc; font-family:monospace;">
          <div>B-M 경계: <span id="lbl-low-bound">25%</span></div>
          <div>M-T 경계: <span id="lbl-high-bound">75%</span></div>
        </div>
      </div>
    `;

    // 인라인 슬라이더 핸들 스타일 강제 커스텀 인젝션 코팅
    const styleId = "dual-slider-custom-style-sheet";
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.innerHTML = `
        input[type=range]::-webkit-slider-thumb { pointer-events: auto; -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #ffffff; border: 2px solid #00ffcc; cursor: pointer; }
        input[type=range]::-moz-range-thumb { pointer-events: auto; width: 14px; height: 14px; border-radius: 50%; background: #ffffff; border: 2px solid #00ffcc; cursor: pointer; }
      `;
      document.head.appendChild(styleEl);
    }

    // 듀얼 크로스 이벤트 리스너 마인딩 연산 기동
    const fillBar = document.getElementById('sub-track-bar');
    const rangeLow = document.getElementById('dual-handle-low');
    const rangeHigh = document.getElementById('dual-handle-high');
    const lblLow = document.getElementById('lbl-low-bound');
    const lblHigh = document.getElementById('lbl-high-bound');

    const updateSliderMatrix = () => {
      let lVal = parseInt(rangeLow.value);
      let hVal = parseInt(rangeHigh.value);

      if (lVal >= hVal) {
        rangeLow.value = hVal - 2;
        lVal = hVal - 2;
      }
      
      fillBar.style.left = lVal + '%';
      fillBar.style.right = (100 - hVal) + '%';
      
      lblLow.innerText = lVal + '%';
      lblHigh.innerText = hVal + '%';
    };

    if(rangeLow && rangeHigh) {
      rangeLow.oninput = updateSliderMatrix;
      rangeHigh.oninput = updateSliderMatrix;
      updateSliderMatrix();
    }
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

  // 💡 [배경화면 100% 강제 출력 우회 파이프라인] DOM 텍스처 업로더 개조
  setupDirectInputTracker() {
    const loader = new THREE.TextureLoader();
    
    const forceLoadTexture = () => {
      // 1순위: 업로드 컴포넌트 자체의 실시간 파일 이미지 래핑 추적
      const fileInput = document.querySelector('input[type="file"]');
      const previewImg = document.querySelector('.media-resources img') || document.querySelector('img[src*="blob"]') || document.querySelector('img');
      
      let currentSrc = "";
      if (previewImg && previewImg.src) currentSrc = previewImg.src;

      if (currentSrc && currentSrc !== this.lastBgSrc) {
        this.lastBgSrc = currentSrc;
        this.textureStatusLog = "로딩 기동 중...";
        this.updateHudMonitorDisplay();

        loader.load(
          currentSrc,
          (tex) => {
            this.textureStatusLog = `🎉 성공: ${tex.image.width}x${tex.image.height}`;
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
            this.textureStatusLog = `❌ 에러 발생`;
            this.updateHudMonitorDisplay();
          }
        );
      }
    };

    this.domObserver = new MutationObserver(() => { forceLoadTexture(); });
    this.domObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
    setInterval(forceLoadTexture, 1000); // 1초 간격 하드웨어 폴링 세이프티 가동
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

    // HUD 모니터 프레임 갱신 정보 전송
    if (Math.floor(time * 60) % 30 === 0) {
      this.updateHudMonitorDisplay(rawData.length);
    }

    // 💡 [듀얼 핸들 연동 주파수 쪼개기 연산 아키텍처]
    let splitLow = 25;
    let splitHigh = 75;
    const rLow = document.getElementById('dual-handle-low');
    const rHigh = document.getElementById('dual-handle-high');
    if (rLow && rHigh) {
      splitLow = parseInt(rLow.value);
      splitHigh = parseInt(rHigh.value);
    }

    let amplitudeMultiplier = THREE.MathUtils.mapLinear(ui.glow, 0.1, 1.5, 0.3, 2.5);

    this.visualNodes.forEach((node) => {
      let freqVolume = 0;
      
      if (this.isAudioActive) {
        if (hasRaw) {
          // 💡 개조된 듀얼 레인지 바의 커트라인 비율에 맞춰 저음/중음/고음 인덱스를 정확하게 동적 할당
          let totalBands = rawData.length;
          let idxCutLow = Math.floor(totalBands * (splitLow / 100));
          let idxCutHigh = Math.floor(totalBands * (splitHigh / 100));

          let currentIdx = Math.floor(node.freqIdxRatio * (totalBands - 1));
          
          // 각 대역폭 안에서 펄스 압축 추출
          if (currentIdx < idxCutLow) {
            // 저음역 (Bass)
            freqVolume = rawData[currentIdx] / 255.0 * 1.1;
          } else if (currentIdx < idxCutHigh) {
            // 중음역 (Mid)
            freqVolume = rawData[currentIdx] / 255.0 * 1.0;
          } else {
            // 고음역 (Treble)
            freqVolume = rawData[currentIdx] / 255.0 * 0.9;
          }
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
