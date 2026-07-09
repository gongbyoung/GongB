/**
 * src/sketches/002_three_cube.js
 * - [버전] Ver 4.4 (오디오 재생 시 3D 링 바 블랙아웃 증발 버그 원천 격파 최종 완결판)
 * - 외부 p5 라이브러리 의존성 찌꺼기를 100% 제거하여 재생 시 자바스크립트 런타임 셧다운(Crash) 원인 원천 봉쇄
 * - 서클 정면 배치 및 오디오 타격 시 중심 원(Core)에서 사방 바깥쪽(Radial Outward)으로 뿜어내는 입체 스케일 변환
 * - 3대 형태학 무작위 셔플 및 5대 컬러 프리셋(태양, 파란바다, 3중 멀티피커, 랜덤원색, 와이어 테두리) 완벽 연동
 * - 사용 설명 가이드 HTML 레이어(스타트 재생 시 자동 페이드아웃) 및 특수문자 파일명 우회 3D 배경 스크린 기본 장착
 */

export default class ThreeCube {
  constructor(container) {
    this.container = container;
    this.scene = null; 
    this.camera = null;
    this.renderer = null;
    this.guiOverlay = null;

    // 💡 002호 전용 최종 패치 픽스 마커 세팅
    this.version = "002호 3D Radial Outward Bar Ver 4.4";
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

    // 서클 비주얼라이저를 왜곡 없이 정면에서 똑바로 응시하도록 카메라 앵글 정중앙 셋업
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

    // 3D 우주 배경 스크린 (특수문자 및 블롭 경로 대응 우회판)
    const bgGeo = new THREE.PlaneGeometry(24, 14);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x09090e, depthWrite: false });
    this.bgMesh = new THREE.Mesh(bgGeo, bgMat);
    this.bgMesh.position.set(0, 0, -4); 
    this.scene.add(this.bgMesh);

    // [공통 표준 규격] 사용 설명 가이드 UI 빌드
    this.buildOnScreenGuideUI();

    // 정면 방사형 매트릭스 링 어레이 빌드
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
        <p style="margin: 6px 0;">🎡 <strong style="color: #00ffcc;">[중심 ➡️ 바깥]</strong> 서클을 정면으로 응시하며 모든 막대들이 중심에서 바깥 사방으로 뻗어 나갑니다.</p>
        <p style="margin: 6px 0;">🎲 <strong style="color: #ffffff;">[3대 형태학]</strong> 전체 막대, 공중부양 끝막대, 시작점 앵커 단추 형태가 무작위 셔플 혼합됩니다.</p>
        <p style="margin: 6px 0;">🎨 <strong style="color: #ffffff;">[3중 멀티피커]</strong> Custom선택 시 가스1(면), 가스2(선), 대형별(시작단추) 색상과 완벽하게 동기화됩니다.</p>
        <p style="margin: 6px 0; color: #ffcc00;">▶️ <strong style="color: #ffcc00;">[하단 스타트]</strong> 재생 버튼을 누르면 이 가이드창이 투명하게 사라지며 영상이 시작됩니다!</p>
      </div>
      <div style="color: #777777; font-size: 10.5px; margin-top: 16px; border-top: 1px solid #222530; padding-top: 10px;">
        음악이 정지되면 안내 설명창이 다시 활성화됩니다.
      </div>
    `;
    this.container.appendChild(this.guiOverlay);
  }

  buildRadialMatrix() {
    this.visualNodes.forEach(node => this.scene.remove(node.mesh));
    this.visualNodes = [];

    const baseBoxGeometry = new THREE.BoxGeometry(0.12, 1, 0.12);
    const ui = this.getUIParams();

    let seedValue = ui.seed;
    const seededRandom = () => {
      let x = Math.sin(seedValue++) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < this.barCount; i++) {
      const angle = (i / this.barCount) * Math.PI * 2;
      let freqRatio = i / this.barCount;
      
      let baseRadiusOffset = 2.0 + Math.sin(freqRatio * Math.PI * 4.0) * 0.35 + seededRandom() * 0.2;

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

      mesh.position.x = Math.cos(angle) * baseRadiusOffset;
      mesh.position.y = Math.sin(angle) * baseRadiusOffset;
      mesh.position.z = 0;

      mesh.rotation.z = angle - Math.PI / 2;

      this.scene.add(mesh);

      this.visualNodes.push({
        mesh: mesh,
        angle: angle,
        baseRadius: baseRadiusOffset,
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
      const scatterSlider = document.getElementById('slide-cosmic-scatter');
      const glowSlider = document.getElementById('slide-cosmic-glow');
      const colorSelect = document.getElementById('select-cosmic-color');
      const gainSlider = document.getElementById('slide-cosmic-gain');

      const p1 = document.getElementById('picker-cosmic-color1') || document.getElementById('color1') || document.querySelector('.color-pickers input:nth-of-type(1)');
      const p2 = document.getElementById('picker-cosmic-color2') || document.getElementById('color2') || document.querySelector('.color-pickers input:nth-of-type(2)');
      const p3 = document.getElementById('picker-cosmic-color3') || document.getElementById('color3') || document.querySelector('.color-pickers input:nth-of-type(3)');

      return {
          scatter: scatterSlider ? parseFloat(scatterSlider.value) : 22, 
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
     // 구조적 리셋 우회
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    const time = Date.now() * 0.001;
    const ui = this.getUIParams();

    let currentSettingsStr = `${ui.seed}-${ui.style}-${ui.gas1Hex}-${ui.gas2Hex}-${ui.starHex}`;
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

    let rawData = (audioData && audioData.raw) ? audioData.raw : [];
    let hasRaw = rawData.length > 20;
    let masterVol = audioData ? audioData.vol : 0.1;
    masterVol *= ui.burst;

    // 💡 [버그 원천 해결] 에러를 일으키던 p5.prototype을 완벽히 도려내고, 순수 쓰리제이에스 내장 함수로 실시간 슬라이더 값 매핑 교체 완료
    let scaleMultiplier = 1.0; 
    const glowSlider = document.getElementById('slide-cosmic-glow');
    if (glowSlider) {
      scaleMultiplier = THREE.MathUtils.mapLinear(parseFloat(glowSlider.value), 10, 150, 0.4, 2.5);
    }

    this.visualNodes.forEach((node) => {
      let freqVolume = 0;
      if (this.isAudioActive && hasRaw) {
        let rawIdx = Math.floor(node.freqIdxRatio * (rawData.length - 1));
        freqVolume = rawData[rawIdx] / 255.0;
      } else {
        // 정지 상태일 때 호흡하듯 잔잔하게 파동 치는 대기 모션용 난수 보간
        freqVolume = Math.sin(time * 2.0 + node.seedShift * 5.0) * 0.08 + 0.08;
      }

      freqVolume *= ui.burst;
      let dynamicResponse = freqVolume * 6.8 * scaleMultiplier;

      if (node.mode === 'full-bar') {
        // 1. 전체 막대: 서클 정면 중심 ➡️ 바깥 방향 팽창
        let targetScaleY = 0.1 + dynamicResponse;
        node.mesh.scale.y = THREE.MathUtils.lerp(node.mesh.scale.y, targetScaleY, 0.26);
        let extendedRadius = node.baseRadius + (node.mesh.scale.y / 2);
        node.mesh.position.x = Math.cos(node.angle) * extendedRadius;
        node.mesh.position.y = Math.sin(node.angle) * extendedRadius;
      } 
      else if (node.mode === 'tip-only') {
        // 2. 끝만 막대: 공중부양 알갱이가 비트에 맞춰 바깥쪽으로 사출
        node.mesh.scale.set(1, 1, 1);
        let targetRadius = node.baseRadius + (dynamicResponse * 0.85);
        let curRadius = THREE.MathUtils.lerp(node.baseRadius, targetRadius, 0.26);
        node.mesh.position.x = Math.cos(node.angle) * curRadius;
        node.mesh.position.y = Math.sin(node.angle) * curRadius;
      } 
      else {
        // 3. 시작만 표현: 정위치 앵커 단추 벌크업 반짝임
        let targetDotScale = 1.0 + freqVolume * 3.5 * scaleMultiplier;
        let curDotScale = THREE.MathUtils.lerp(node.mesh.scale.x, targetDotScale, 0.28);
        node.mesh.scale.set(curDotScale, curDotScale, curDotScale);
        node.mesh.position.x = Math.cos(node.angle) * node.baseRadius;
        node.mesh.position.y = Math.sin(node.angle) * node.baseRadius;
      }

      if (node.mesh.material) {
        node.mesh.material.emissiveIntensity = THREE.MathUtils.lerp(node.mesh.material.emissiveIntensity, 0.15 + freqVolume * 2.5, 0.2);
      }
    });

    // 정면 방향 원형 비주얼라이저의 입체적 자전 롤링 효과
    this.scene.rotation.z = time * 0.04 + (masterVol * 0.06);
    this.scene.rotation.y = Math.sin(time * 0.3) * 0.04;

    // 💡 렌더링 파이프라인 상시 보장 고정
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
