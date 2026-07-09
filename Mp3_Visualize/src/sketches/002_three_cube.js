/**
 * src/sketches/002_three_cube.js
 * - [버전] Ver 4.6 (타원 왜곡 완전 격파 및 분산범위 슬라이더 ➡️ 서클 기본 반지름 크기 연동판)
 * - 9:16 해상도에서도 일그러짐 없는 완전한 정원(Circle) 형태학 궤적으로 비주얼라이저 라인 전면 교정
 * - 분산범위(Center Scatter) 조작 시 서클의 기본 반경 크기가 시원하게 조여들고 확장되도록 인터랙션 결합
 * - 3대 형태학 무작위 셔플 및 5대 컬러 스타일 프리셋, 특수문자 우회 3D 배경 스크린 탑재 유지
 */

export default class ThreeCube {
  constructor(container) {
    this.container = container;
    this.scene = null; 
    this.camera = null;
    this.renderer = null;
    this.guiOverlay = null;

    this.version = "002호 3D Radial Outward Bar Ver 4.6";
    this.isAudioActive = false;
    this.lastSettingsStr = "";

    this.barCount = 128; 
    this.visualNodes = []; 

    this.bgTexture = null;
    this.bgMesh = null;
    this.lastBgSrc = "";
    this.domObserver = null;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x06060a, 0.02);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 8); 
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x06060a);
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.5, 100);
    pointLight.position.set(0, 0, 6); 
    this.scene.add(pointLight);

    const bgGeo = new THREE.PlaneGeometry(24, 14);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x09090e, depthWrite: false });
    this.bgMesh = new THREE.Mesh(bgGeo, bgMat);
    this.bgMesh.position.set(0, 0, -4); 
    this.scene.add(this.bgMesh);

    this.buildOnScreenGuideUI();
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
        <p style="margin: 6px 0;">🔵 <strong style="color: #00ffcc;">[완벽한 정원]</strong> 타원형 찌그러짐 왜곡을 완벽히 수리하여 정갈한 써클 형태학 링을 구축했습니다.</p>
        <p style="margin: 6px 0;">📏 <strong style="color: #ffffff;">[분산범위 크기 조절]</strong> 우측 분산범위 슬라이더를 움직이면 서클 자체의 크기를 통째로 조절할 수 있습니다.</p>
        <p style="margin: 6px 0;">🎲 <strong style="color: #ffffff;">[3대 형태학]</strong> 전체 막대, 공중부양 끝막대, 시작점 앵커 단추 형태학 믹싱이 유지됩니다.</p>
        <p style="margin: 6px 0; color: #ffcc00;">▶️ <strong style="color: #ffcc00;">[하단 스타트]</strong> 재생 버튼을 누르면 이 가이드창이 투명하게 사라지며 영상이 시작됩니다!</p>
      </div>
      <div style="color: #777777; font-size: 10.5px; margin-top: 16px; border-top: 1px solid #222530; padding-top: 10px;">
        음악이 정지되면 안내 설명창이 다시 활성화됩니다.
      </div>
    `;
    this.container.appendChild(this.guiOverlay);
  }

  // 💡 [정원 리빌딩 매트릭스] 타원형 왜곡을 원천 격파하는 완전 등방성 정원 수식 배치
  buildRadialMatrix() {
    this.visualNodes.forEach(node => this.scene.remove(node.mesh));
    this.visualNodes = [];

    const baseBoxGeometry = new THREE.BoxGeometry(0.12, 1, 0.12);
    const ui = this.getUIParams();

    // 💡 [기획 1 매핑] 관제탑 분산범위(ui.scatter) 슬라이더 수치를 서클의 기본 배치 반경(Base Radius)으로 1:1 링크 주입
    // 수치 0.5~5.0 범위에 매칭하여 최소 0.6에서 최대 4.5 반경으로 시원하게 가변 스케일링
    let currentBaseRadius = THREE.MathUtils.mapLinear(ui.scatter, 0.5, 5.0, 0.6, 3.8);

    let seedValue = ui.seed;
    const seededRandom = () => {
      let x = Math.sin(seedValue++) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < this.barCount; i++) {
      const angle = (i / this.barCount) * Math.PI * 2;
      let freqRatio = i / this.barCount;
      
      // 💡 주파수 시작점 미세 변이 오프셋도 완전히 정원형 파동 기류로 보정
      let individualOffset = currentBaseRadius + (Math.sin(freqRatio * Math.PI * 6.0) * (currentBaseRadius * 0.08)) + (seededRandom() * 0.05);

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
        currentGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14); 
      } else if (mode === 'tip-only') {
        currentGeo = new THREE.BoxGeometry(0.15, 0.22, 0.15); 
      }

      const mesh = new THREE.Mesh(currentGeo, material);

      // 💡 [정원 형태 배치] 타원 찌그러짐을 유발하던 인자를 삭제하고 완벽한 사인/코사인 반지름 원으로 안착
      mesh.position.x = Math.cos(angle) * individualOffset;
      mesh.position.y = Math.sin(angle) * individualOffset;
      mesh.position.z = 0;

      mesh.rotation.z = angle - Math.PI / 2;

      this.scene.add(mesh);

      this.visualNodes.push({
        mesh: mesh,
        angle: angle,
        baseRadius: individualOffset,
        mode: mode,
        freqIdxRatio: freqRatio,
        seedShift: seededRandom()
      });
    }
  }

  setupDirectInputTracker() {
    const loader = new THREE.TextureLoader();
    const findAndBindImage = () => {
      const allImgs = document.querySelectorAll('img');
      let targetImg = null;
      for (let img of allImgs) {
        if (img.src && (img.src.includes('blob:') || img.src.length > 30 || img.id.includes('preview'))) {
          targetImg = img;
          break;
        }
      }
      if (targetImg && targetImg.src && targetImg.src !== this.lastBgSrc) {
        this.lastBgSrc = targetImg.src;
        loader.load(targetImg.src, (tex) => {
          this.bgTexture = tex;
          if (this.bgMesh) {
            this.bgMesh.material.dispose();
            this.bgMesh.material = new THREE.MeshBasicMaterial({ map: this.bgTexture, depthWrite: false });
          }
        });
      }
    };
    this.domObserver = new MutationObserver(() => { findAndBindImage(); });
    this.domObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
    setTimeout(findAndBindImage, 500);
  }

  getUIParams() {
      const seedSlider = document.getElementById('slide-cosmic-seed');
      const scatterSlider = document.getElementById('slide-cosmic-scatter'); // 💡 분산범위 (서클 크기 마스터 소스)
      const glowSlider = document.getElementById('slide-cosmic-glow');       // 💡 발광크기 (막대 진폭 마스터 소스)
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

  resetCanvas(p, isPreview = false) {
     // 인터페이스 우회
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    const time = Date.now() * 0.001;
    const ui = this.getUIParams();

    // 💡 분산범위(ui.scatter)의 가변 변동을 실시간 캡처하여 매 프레임 원형 크기 동적 갱신 추적
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

    // 💡 발광크기(Glow & Size)는 오직 주파수 진폭 피크 배율 제어로만 단독 활용 격리
    let amplitudeMultiplier = THREE.MathUtils.mapLinear(ui.glow, 0.1, 1.5, 0.3, 2.5);

    this.visualNodes.forEach((node) => {
      let freqVolume = 0;
      
      if (this.isAudioActive) {
        if (hasRaw) {
          let rawIdx = Math.floor(node.freqIdxRatio * (rawData.length - 1));
          freqVolume = rawData[rawIdx] / 255.0;
        } else {
          let wave1 = Math.sin(time * 4.0 + node.angle * 3.0);
          let wave2 = Math.cos(time * 2.5 - node.seedShift * 10.0);
          freqVolume = (wave1 * 0.15 + wave2 * 0.15) + 0.2;
        }
      } else {
        freqVolume = Math.sin(time * 2.0 + node.seedShift * 5.0) * 0.08 + 0.08;
      }

      freqVolume *= ui.burst;
      let dynamicResponse = freqVolume * 6.5 * amplitudeMultiplier;

      if (node.mode === 'full-bar') {
        let targetScaleY = 0.1 + dynamicResponse;
        node.mesh.scale.y = THREE.MathUtils.lerp(node.mesh.scale.y, targetScaleY, 0.26);
        let extendedRadius = node.baseRadius + (node.mesh.scale.y / 2);
        node.mesh.position.x = Math.cos(node.angle) * extendedRadius;
        node.mesh.position.y = Math.sin(node.angle) * extendedRadius;
      } 
      else if (node.mode === 'tip-only') {
        node.mesh.scale.set(1, 1, 1);
        let targetRadius = node.baseRadius + (dynamicResponse * 0.85);
        let curRadius = THREE.MathUtils.lerp(node.baseRadius, targetRadius, 0.26);
        node.mesh.position.x = Math.cos(node.angle) * curRadius;
        node.mesh.position.y = Math.sin(node.angle) * curRadius;
      } 
      else {
        let targetDotScale = 1.0 + freqVolume * 3.5 * amplitudeMultiplier;
        let curDotScale = THREE.MathUtils.lerp(node.mesh.scale.x, targetDotScale, 0.28);
        node.mesh.scale.set(curDotScale, curDotScale, curDotScale);
        node.mesh.position.x = Math.cos(node.angle) * node.baseRadius;
        node.mesh.position.y = Math.sin(node.angle) * node.baseRadius;
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
    if (this.domObserver) this.domObserver.disconnect();
    if (this.bgTexture) this.bgTexture.dispose();

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.visualNodes = [];
  }
}
