/**
 * src/sketches/002_three_cube.js
 * - [버전] Ver 4.20 (우주 성운의 호흡을 닮은 빛의 오로라 - 앰비언트 3D 완결판)
 * - 딱딱한 각진 막대 구조를 완벽 도려내고, 은은한 포그 글로우 입자(THREE.Points) 시스템 전면 도입
 * - 최고점 포착 후 물 흐르듯 천천히 복원되는 웅장한 롱 디케이(Long Decay/Ease-out) 이징 댐핑 구축
 * - 저음(따뜻한 오렌지 브라운)과 고음(차가운 인디고 블루)이 가산 혼합(Additive Blending)되는 그라데이션 질감
 * - 오디오의 팽창 호흡에 맞춰 Z축 공간을 아주 느리게 유영하며 줌인(Zoom-in)하는 시네마틱 카메라 시스템 탑재
 */

export default class ThreeCube {
  constructor(container) {
    this.container = container;
    this.scene = null; 
    this.camera = null;
    this.renderer = null;
    this.guiOverlay = null;
    this.hudMonitor = null;

    this.version = "002호 Cosmic Ambient Aurora Ver 4.20";
    this.isAudioActive = false;
    this.lastSettingsStr = "";

    this.barCount = 180; // 성운 고리의 디테일을 위해 해상도 상향 조정
    this.visualNodes = []; 

    this.bgTexture = null;
    this.lastBgSrc = "";
    this.domObserver = null;

    this.currentShapeLogName = "aurora_ring";
    this.textureStatusLog = "배경 성운 대기 중...";
    
    // 댐핑 축적용 스무딩 버퍼
    this.smoothedHeights = new Float32Array(this.barCount);
    this.cameraZoomTime = 0;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    
    // 💡 [배경 통합] 우주 가스 성운과 부드럽게 융합되도록 안개 안착 깊이 조정
    this.scene.fog = new THREE.FogExp2(0x05060b, 0.008); 

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 8); 
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x05060b);
    this.renderer.autoClear = false; 
    this.container.appendChild(this.renderer.domElement);

    // 은은한 대지/우주 앰비언트 광량 분산
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
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '85%',
      maxWidth: '420px',
      backgroundColor: 'rgba(6, 8, 12, 0.94)',
      border: '1px solid rgba(0, 255, 204, 0.4)', 
      borderRadius: '12px',
      padding: '22px',
      color: '#ffffff',
      fontFamily: 'sans-serif',
      zIndex: '20',
      boxShadow: '0 6px 25px rgba(0,0,0,0.7)',
      boxSizing: 'border-box',
      textAlign: 'center',
      pointerEvents: 'none',
      transition: 'opacity 0.6s cubic-bezier(0.25, 1, 0.5, 1)'
    });

    this.guiOverlay.innerHTML = `
      <div style="color: #00ffcc; font-size: 11px; text-align: left; margin-bottom: 14px; font-weight: bold; letter-spacing: 0.5px;">
        🌌 STAGE STATUS: ${this.version} READY
      </div>
      <h3 style="color: #ffffff; font-size: 16.5px; margin: 0 0 16px 0; font-weight: 600;">
        우주 성운의 호흡을 닮은 빛의 오로라
      </h3>
      <div style="font-size: 12.5px; text-align: left; line-height: 1.75; color: #cccccc;">
        <p style="margin: 6px 0;">✨ <strong style="color: #00ffcc;">[빛의 미립자 대변혁]</strong> 딱딱한 각진 바를 전면 걷어내고, 경계선이 흐릿하고 몽환적인 오로라 입자 띠로 재탄생했습니다.</p>
        <p style="margin: 6px 0;">🌊 <strong style="color: #ffffff;">[웅장한 슬로우 여운]</strong> 피크 타격 후 거칠게 끊기지 않고 물결이 일렁이듯 부드럽게 제자리로 수축 팽창합니다.</p>
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
      position: 'absolute',
      top: '15px',
      right: '15px',
      width: '180px',
      backgroundColor: 'rgba(4, 5, 8, 0.82)',
      border: '1px solid rgba(0, 255, 204, 0.5)',
      borderRadius: '6px',
      padding: '10px',
      color: '#00ffcc',
      fontFamily: 'monospace',
      fontSize: '11px',
      lineHeight: '1.5',
      zIndex: '25',
      pointerEvents: 'none',
      boxShadow: '0 4px 15px rgba(0,0,0,0.6)'
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
    // 기존 노드 완전 폐기 청소
    this.visualNodes.forEach(node => this.scene.remove(node.points));
    this.visualNodes = [];

    const ui = this.getUIParams();

    // 💡 [개선안 1: 재질의 순화] 둥근 입자 질감을 가산 혼합 셰이더 느낌으로 렌더링하기 위한 하드웨어 캔버스 텍스처 동적 생성
    const createCircleGlowTexture = () => {
      const matCanvas = document.createElement('canvas');
      matCanvas.width = 64;
      matCanvas.height = 64;
      const matCtx = matCanvas.getContext('2d');
      
      // 중심부는 선명하고 바깥쪽은 자연스럽게 스며드는 라디알 안개 그라데이션
      let grad = matCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
      grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.15)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      matCtx.fillStyle = grad;
      matCtx.fillRect(0, 0, 64, 64);
      
      return new THREE.CanvasTexture(matCanvas);
    };

    const particleTexture = createCircleGlowTexture();
    let currentBaseRadius = THREE.MathUtils.mapLinear(ui.scatter, 5, 50, 0.4, 2.8); 

    let seedValue = ui.seed;
    const seededRandom = () => {
      let x = Math.sin(seedValue++) * 10000;
      return x - Math.floor(x);
    };

    // 💡 [개선안 3: 조화로운 색채 팔레트] 배경 성운의 오렌지 브라운 및 딥 블루 보라 톤 세팅
    for (let i = 0; i < this.barCount; i++) {
      const angle = (i / this.barCount) * Math.PI * 2;
      let freqRatio = i / this.barCount;
      
      // 방사형 오로라 띠 레이어 좌표 형성
      let finalX = Math.cos(angle) * currentBaseRadius;
      let finalY = Math.sin(angle) * currentBaseRadius;

      // 성운 입자 컬러 그라데이션 분배 (저음: 따뜻한 오렌지 갈색 / 고음: 차가운 차분한 인디고 블루)
      let finalColor = new THREE.Color();
      if (ui.style.includes('custom') || ui.style.includes('custom-color')) {
          finalColor.set(ui.gas1Hex).lerp(new THREE.Color(ui.gas2Hex), freqRatio);
      } else {
          // 기본 성운 특화 톤앤매너
          let orangeTone = new THREE.Color('#d97d41'); // 성운 가스 오렌지
          let blueTone = new THREE.Color('#3b5287');   // 차분한 밤하늘 인디고 블루
          finalColor.copy(orangeTone).lerp(blueTone, freqRatio);
      }

      // 💡 [개선안 3: 투명도의 활용] Alpha Blending을 극대화하여 배경이 은은하게 비치도록 설정
      const pMaterial = new THREE.PointsMaterial({
        color: finalColor,
        size: THREE.MathUtils.mapLinear(ui.glow, 10, 250, 0.15, 0.95), // Scale 수치 연동
        map: particleTexture,
        transparent: true,
        opacity: 0.65, // 비쳐 보이도록 65% 투명도 적용
        blending: THREE.AdditiveBlending, // 겹칠 때 화사하게 증폭 발광하는 오로라 효과
        depthWrite: false
      });

      // 단일 막대가 아닌, 1열당 6개의 미립자가 꼬리를 그리며 연속 배치되는 오로라 스트림 구조 설계
      const pGeometry = new THREE.BufferGeometry();
      const positions = [];
      const originalOffsets = [];

      // 중심에서 바깥으로 뻗어 나가는 스트림 배치
      for (let j = 0; j < 6; j++) {
        let streamRadius = currentBaseRadius * (1.0 + j * 0.08);
        positions.push(Math.cos(angle) * streamRadius, Math.sin(angle) * streamRadius, 0);
        originalOffsets.push(j * 0.08); // 스트림 상대 깊이 저장
      }

      pGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const points = new THREE.Points(pGeometry, pMaterial);
      this.scene.add(points);

      this.visualNodes.push({
        points: points,
        angle: angle,
        baseX: finalX,
        baseY: finalY,
        currentBaseRadius: currentBaseRadius,
        freqIdxRatio: freqRatio,
        offsets: originalOffsets,
        seedShift: seededRandom()
      });
    }
    this.updateHudMonitorDisplay();
  }

  setupDirectInputTracker() {
    const forceSyncTexture = () => {
      let targetSrc = "";
      let sourceElement = null;

      if (window.currentUploadedImageElement && window.currentUploadedImageElement.src) {
        targetSrc = window.currentUploadedImageElement.src;
        sourceElement = window.currentUploadedImageElement;
      } else {
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
        this.textureStatusLog = "성운 캔버스 매핑 중...";
        this.updateHudMonitorDisplay();

        try {
          const tex = new THREE.Texture(sourceElement);
          tex.needsUpdate = true;
          this.bgTexture = tex;
          this.scene.background = this.bgTexture;
          this.textureStatusLog = `🎉 성운 조화 완료 (${sourceElement.width || 'OK'}px)`;
          this.updateHudMonitorDisplay();
        } catch (e) {
          const loader = new THREE.TextureLoader();
          loader.load(targetSrc, (t) => {
            this.bgTexture = t;
            this.scene.background = this.bgTexture;
            this.textureStatusLog = `🎉 성운 로더 복구`;
            this.updateHudMonitorDisplay();
          });
        }
      }
    };

    this.domObserver = new MutationObserver(() => { forceSyncTexture(); });
    this.domObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
    setInterval(forceSyncTexture, 1000);
  }

  getUIParams() {
      // 🎛️ 인풋 연동 안정화 락인 패치
      const seedInput = document.getElementById('num-cosmic-seed');
      const scatterInput = document.getElementById('num-cosmic-scatter'); 
      const glowInput = document.getElementById('num-cosmic-glow');       
      const colorSelect = document.getElementById('select-cosmic-color');
      const gainInput = document.getElementById('num-cosmic-gain');

      const p1 = document.getElementById('picker-gas1');
      const p2 = document.getElementById('picker-gas2');
      const p3 = document.getElementById('picker-star');

      return {
          scatter: scatterInput ? parseFloat(scatterInput.value) : 22, 
          glow: glowInput ? parseFloat(glowInput.value) : 85,          
          burst: gainInput ? parseFloat(gainInput.value) / 100 : 1.0, 
          seed: seedInput ? parseInt(seedInput.value) : 42,            
          style: colorSelect ? colorSelect.value.toLowerCase() : 'neon',
          
          gas1Hex: (p1 && p1.value) ? p1.value : '#ff0055',
          gas2Hex: (p2 && p2.value) ? p2.value : '#00ffcc',
          starHex: (p3 && p3.value) ? p3.value : '#ffffff'
      };
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    this.renderer.clear();

    const time = Date.now() * 0.0008;
    const ui = this.getUIParams();

    // 실시간 UI 드래그 변동 트래킹 감지
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
    if (audioData) {
        rawData = audioData.raw || audioData.spectrum || audioData.frequencyData || [];
    }
    
    let hasRaw = rawData && rawData.length > 10;
    let masterVol = audioData ? (audioData.vol || audioData.volume || 0.1) : 0.1;
    masterVol *= ui.burst;

    if (Math.floor(time * 60) % 25 === 0) {
      this.updateHudMonitorDisplay(rawData.length);
    }

    // 💡 [개선안 2: 영상적 호흡 조절] 0.06 초저속 디케이(Decay) 및 이징 댐핑 처리 루프
    this.visualNodes.forEach((node, i) => {
      let freqVolume = 0;
      if (this.isAudioActive && hasRaw) {
          let currentIdx = Math.floor(node.freqIdxRatio * (rawData.length - 1));
          freqVolume = rawData[currentIdx] / 255.0;
      } else {
          // 음악이 꺼졌을 때 잔잔한 자율 명상 오로라 파동 유지
          freqVolume = Math.sin(time * 2.0 + node.seedShift * 6.0) * 0.08 + 0.08;
      }

      freqVolume *= ui.burst;

      // 💥 핵심 시공: 정점을 찍은 후 복원될 때 0.06의 극도로 부드러운 호흡 레이트 적용 (Damping 완벽 주입)
      let currentH = this.smoothedHeights[i];
      currentH += (freqVolume - currentH) * 0.06; 
      this.smoothedHeights[i] = currentH;

      // 💡 [개선안 2: 물결 같은 연동] 이웃한 파형 유닛과 정현파 사인 기믹을 결합하여 방사형 수평선 웨이브 연출
      let waveDampingResponse = currentH * 3.5 + Math.sin(time * 1.5 + node.angle * 2.0) * 0.12;

      // 입자 포지션 버퍼 갱신
      const posAttr = node.points.geometry.attributes.position;
      const posArray = posAttr.array;

      let dirX = Math.cos(node.angle);
      let dirY = Math.sin(node.angle);

      // 💡 [개선안 2: 초점과 공간감] 중앙(선명)에서 바깥(흐림) 오프셋에 따라 입자 스케일 및 위치 그라데이션 분배
      for (let j = 0; j < 6; j++) {
        let dynamicRadius = node.currentBaseRadius * (1.0 + node.offsets[j]) + (waveDampingResponse * (1.0 + j * 0.15));
        
        let idx3 = j * 3;
        posArray[idx3] = dirX * dynamicRadius;
        posArray[idx3 + 1] = dirY * dynamicRadius;
        posArray[idx3 + 2] = Math.sin(time + j * 0.5) * 0.05; // 미세한 Z축 일렁임 보너스
      }
      posAttr.needsUpdate = true;

      // 💡 주파수 호흡 강도에 맞춰 오로라 입자 광량(Emissive Intensity 효과) 유기적 브리딩
      node.points.material.opacity = THREE.MathUtils.lerp(node.points.material.opacity, 0.35 + currentH * 0.5, 0.1);
    });

    // 💡 [개선안 2: 시간과 공간의 확장] 가상 카메라가 성운의 호흡을 따라 아주 느리게 Z축으로 줌인/줌아웃 무브먼트 전개
    this.cameraZoomTime += 0.005;
    let subtleZoomZ = 7.5 + Math.sin(this.cameraZoomTime) * 0.6 - (masterVol * 0.4);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, subtleZoomZ, 0.05);

    // 전체 무대 느린 회전 유영 극대화
    this.scene.rotation.z = time * 0.02 + (masterVol * 0.03);
    this.scene.rotation.y = Math.sin(time * 0.2) * 0.03;

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
      if (!object.isMesh && !object.isPoints) return;
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
