/**
 * src/sketches/002_three_cube.js
 * - [버전] Ver 4.1 (서클 정면 배치 및 중심에서 바깥쪽으로 사방 방사형 확장 오버홀 완결판)
 * - 비주얼라이저 서클을 정면으로 세우고 오디오 주파수 반응 시 큐브들이 중심축에서 바깥 외곽으로 곧게 자라나도록 개조
 * - 3대 형태학 셔플 및 5대 컬러 프리셋(태양, 파란바다, 3중 멀티피커, 랜덤원색, 와이어테두리) 완벽 유지
 * - 사용 설명 가이드 HTML 레이어(스타트 재생 시 자동 페이드아웃 소멸) 및 특수문자 우회 BG 이미지 스크린 결합
 */

export default class ThreeCube {
  constructor(container) {
    this.container = container;
    this.scene = null; 
    this.camera = null;
    this.renderer = null;
    this.guiOverlay = null;

    // 💡 최종 업데이트 확인용 마커
    this.version = "002호 3D Radial Outward Bar Ver 4.1";
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

    // 💡 [정면 배치 개조] 서클 비주얼라이저를 정면으로 칼정렬하기 위해 카메라를 정중앙 앞쪽으로 이동
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
    pointLight.position.set(0, 0, 6); // 정면에서 광원을 선명하게 투사
    this.scene.add(pointLight);

    // 3D 우주 배경 스크린 (CORS 및 특수문자 대응)
    const bgGeo = new THREE.PlaneGeometry(24, 14);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x09090e, depthWrite: false });
    this.bgMesh = new THREE.Mesh(bgGeo, bgMat);
    this.bgMesh.position.set(0, 0, -4); 
    this.scene.add(this.bgMesh);

    // [공통 표준 규격] 가이드 레이어 생성
    this.buildOnScreenGuideUI();

    // 💡 [핵심 정면 방사형 엔진] 3D 격자 구조물 사전 빌드 기동
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

  // 💡 [방사형 축 변환 빌더] 모든 박스의 기준 축을 중심에서 바깥 방사형을 향하도록 정렬
  buildRadialMatrix() {
    this.visualNodes.forEach(node => this.scene.remove(node.mesh));
    this.visualNodes = [];

    // 바깥쪽으로 길게 뻗어나갈 수 있도록 기본 지오메트리를 원각 축으로 슬림하게 설계 (두께 0.12, 기본 길이 1)
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
      
      // 주파수 시작점 이격 변이 매트릭스 공식
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

      // 💡 [정면 방사형 배치] 큐브들을 X, Y 평면상에 원형으로 배치 (Z축은 정면 고정)
      mesh.position.x = Math.cos(angle) * baseRadiusOffset;
      mesh.position.y = Math.sin(angle) * baseRadiusOffset;
      mesh.position.z = 0;

      // 💡 [방사형 각도 고정 핵심] 박스의 머리(길어지는 축)가 중심에서 사방 바깥쪽을 향하도록 Z축 회전 매핑
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

  // 💡 [방사형 동적 프레임 변환] 중심축 기준 사방 바깥 팽창 연산
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
        this.renderer.render(this.scene, this.camera);
        return;
    }

    let rawData = (audioData && audioData.raw) ? audioData.raw : [];
    let hasRaw = rawData.length > 20;
    let masterVol = audioData ? audioData.vol : 0.1;
    masterVol *= ui.burst;

    let scaleMultiplier = p5 ? p5.prototype.map(ui.glow, 10, 150, 0.4, 2.5) : 1.0;

    this.visualNodes.forEach((node) => {
      let freqVolume = 0;
      if (hasRaw) {
        let rawIdx = Math.floor(node.freqIdxRatio * (rawData.length - 1));
        freqVolume = rawData[rawIdx] / 255.0;
      } else {
        freqVolume = Math.sin(time * 3.5 + node.seedShift * 8.0) * 0.25 + 0.25;
      }

      freqVolume *= ui.burst;
      let dynamicResponse = freqVolume * 6.8 * scaleMultiplier;

      // 💡 [방사형 확장 오버홀] 3대 형태학 모드가 Y축이 아닌 원의 중심을 기준으로 반응 가동
      if (node.mode === 'full-bar') {
        // 1. 전체 막대: 중심에서 사방 바깥 방향으로의 길이 스케일(Y축) 팽창
        let targetScaleY = 0.1 + dynamicResponse;
        node.mesh.scale.y = THREE.MathUtils.lerp(node.mesh.scale.y, targetScaleY, 0.26);
        
        // 막대 뿌리(시작점)가 원에 고정된 채 바깥쪽으로 길어지도록 방사형 위치 자동 보정
        let extendedRadius = node.baseRadius + (node.mesh.scale.y / 2);
        node.mesh.position.x = Math.cos(node.angle) * extendedRadius;
        node.mesh.position.y = Math.sin(node.angle) * extendedRadius;

      } else if (node.mode === 'tip-only') {
        // 2. 끝만 막대 (공중 비트 상자): 스케일 체적은 유지한 채, 큐브 알갱이가 주파수 비트에 맞춰 바깥 우주 외곽으로 웅장하게 발사 및 사출(Radius 확장)
        node.mesh.scale.set(1, 1, 1);
        let targetRadius = node.baseRadius + (dynamicResponse * 0.85);
        let curRadius = THREE.MathUtils.lerp(node.baseRadius, targetRadius, 0.26);
        
        node.mesh.position.x = Math.cos(node.angle) * curRadius;
        node.mesh.position.y = Math.sin(node.angle) * curRadius;

      } else {
        // 3. 시작만 표현 (앵커 단추): 사방으로 튕겨 나가지 않고 정위치에서 볼륨 감도만큼 구슬 크기 자체가 전방향 벌크업 반짝임
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

    // 💡 서클 전면의 입체감을 유지하되, 전체 방사형 링 무대가 관성 시계 방향으로 우아하게 자전 회전하도록 정면(Z축) 롤링 효과 주입
    this.scene.rotation.z = time * 0.04 + (masterVol * 0.06);
    
    // 깊이감을 배가하기 위한 미세한 3D 틸팅 흔들림 효과
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
