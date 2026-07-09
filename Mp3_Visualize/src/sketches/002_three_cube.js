/**
 * src/sketches/002_three_cube.js
 * - [버전] Ver 4.11 (비동기 텍스처 이미지 로딩 needsUpdate 누락 및 안개 Fog 가림 현상 버그 100% 완전 해결판)
 * - TextureLoader 비동기 완료 시점에 material.needsUpdate = true 강제 칩을 주입하여 실시간 렌더링 세대교체 보장
 * - 배경 메쉬만 안개 효과(fog: false)의 간섭을 차단하여 이미지가 뒤에 온전하고 꽉 차게 방출되도록 공학 설계
 * - 분산범위(Center Scatter) 기반 50% 슬림 콤팩트 스케일링 및 지형변경 슬라이더 6대 기하학 레이아웃 매퍼 유지
 * - 점 모드 0나누기 NaN 좌표 깨짐 방어 및 3대 형태학 무작위 셔플, 5대 컬러 프리셋 완벽 유지
 */

export default class ThreeCube {
  constructor(container) {
    this.container = container;
    this.scene = null; 
    this.camera = null;
    this.renderer = null;
    this.guiOverlay = null;

    // 💡 최종 미디어 융합 완결판 마커 세팅
    this.version = "002호 3D Radial Outward Bar Ver 4.11";
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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.22);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.5, 100);
    pointLight.position.set(0, 0, 6); 
    this.scene.add(pointLight);

    // 💡 [배경판 생성 부근 개조] 안개(fog: false)의 간섭을 완전히 찢어버려 까맣게 탈색되는 버그를 무력화
    const bgGeo = new THREE.PlaneGeometry(24, 14);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x09090e, depthWrite: false, fog: false });
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
        <p style="margin: 6px 0;">🖼️ <strong style="color: #00ffcc;">[배경 이미지 리얼 타임 맵]</strong> 비동기 로딩 텍스처 업데이트 락 해제로 이미지가 칼같이 투사됩니다.</p>
        <p style="margin: 6px 0;">🎲 <strong style="color: #ffffff;">[6대 기하학 스위칭]</strong> 지형변경 슬라이더 구간별로 [점 ➡️ 서클 ➡️ 삼각형 ➡️ 사각형 ➡️ 별 ➡️ 타원] 형태 변형 완료!</p>
        <p style="margin: 6px 0;">📏 <strong style="color: #ffffff;">[분산범위 크기 조절]</strong> 분산범위 수치를 밀고 당겨 9:16 모바일 뷰에 안착하는 컴팩트 마스터 반경을 조절하세요.</p>
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

    // 분산범위 기반 50% 콤팩트 축소 마스터 기본 반경
    let currentBaseRadius = THREE.MathUtils.mapLinear(ui.scatter, 0.5, 5.0, 0.2, 1.25) * 0.65; 

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
        finalX = Math.cos(angle) * currentBaseRadius;
        finalY = Math.sin(angle) * currentBaseRadius;
      } 
      else if (shapeType === 'triangle') {
        let triAngle = angle + Math.PI / 6;
        let rTri = currentBaseRadius * (Math.sqrt(3) / (Math.sqrt(3) * Math.cos(triAngle % (Math.PI * 2 / 3) - Math.PI / 3)));
        if (isNaN(rTri) || !isFinite(rTri)) rTri = currentBaseRadius;
        finalX = Math.cos(angle) * rTri;
        finalY = Math.sin(angle) * rTri;
      } 
      else if (shapeType === 'square') {
        let rSquare = currentBaseRadius * Math.min(1.0 / Math.abs(Math.cos(angle)), 1.0 / Math.abs(Math.sin(angle)));
        if (isNaN(rSquare) || !isFinite(rSquare)) rSquare = currentBaseRadius;
        finalX = Math.cos(angle) * rSquare;
        finalY = Math.sin(angle) * rSquare;
      } 
      else if (shapeType === 'star') {
        let starPoints = 5;
        let rStar = currentBaseRadius * (0.6 + 0.4 * Math.cos(starPoints * angle));
        finalX = Math.cos(angle) * rStar;
        finalY = Math.sin(angle) * rStar;
      } 
      else {
        finalX = Math.cos(angle) * currentBaseRadius * 1.25;
        finalY = Math.sin(angle) * currentBaseRadius * 0.8;
      }

      let noiseShift = 1.0 + (Math.sin(freqRatio * Math.PI * 4.0) * 0.03);
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
        currentGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12); 
      } else if (mode === 'tip-only') {
        currentGeo = new THREE.BoxGeometry(0.13, 0.18, 0.13); 
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
  }

  // 💡 [배경 주입 옵저버 전면 개조] needsUpdate 기폭 장치 수혈 탑재
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
            // 💡 안개 차단형 재질 재생성 및needsUpdate 선언 완벽 조립
            this.bgMesh.material = new THREE.MeshBasicMaterial({ map: this.bgTexture, depthWrite: false, fog: false });
            this.bgMesh.material.needsUpdate = true; 
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
      let dynamicResponse = freqVolume * 4.8 * amplitudeMultiplier;

      let dirX = Math.cos(node.angle);
      let dirY = Math.sin(node.angle);

      let baseLengthOffset = (node.baseX === 0.001 * dirX) ? 0 : Math.sqrt(node.baseX * node.baseX + node.baseY * node.baseY);

      if (node.mode === 'full-bar') {
        let targetScaleY = 0.1 + dynamicResponse;
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
    if (this.domObserver) this.domObserver.disconnect();
    if (this.bgTexture) this.bgTexture.dispose();

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.visualNodes = [];
  }
}
