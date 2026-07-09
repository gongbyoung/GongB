/**
 * src/sketches/002_three_cube.js
 * - [버전] Ver 4.13 (실시간 텍스처 로딩 및 오디오 노드 상태 정밀 디버그 로그 탑재판)
 * - 배경화면 미출력 현상의 원인 규명을 위해 DOM 추적, TextureLoader 성공/실패 여부를 콘솔창(Console)에 명확히 기록
 * - 매 60프레임마다 기하학 모양 상태와 오디오 데이터 버퍼 유입 강도를 덤프 출력
 * - 분산범위(Center Scatter) 기반 컴팩트 10% 스케일, Z: -30 레이어 후방 배치, 6대 기하학 레이아웃 매퍼 유지
 */

export default class ThreeCube {
  constructor(container) {
    this.container = container;
    this.scene = null; 
    this.camera = null;
    this.renderer = null;
    this.guiOverlay = null;

    this.version = "002호 3D Radial Outward Bar Ver 4.13";
    this.isAudioActive = false;
    this.lastSettingsStr = "";

    this.barCount = 128; 
    this.visualNodes = []; 

    this.bgTexture = null;
    this.bgMesh = null;
    this.lastBgSrc = "";
    this.domObserver = null;

    // 디버깅용 프레임 카운터
    this.logFrameCount = 0;
    this.currentShapeLogName = "circle";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    console.log(`%c[${this.version}] 🚀 스케치 초기화 시동 완료 (화면 크기: ${width}x${height})`, "color: #00ffcc; font-weight: bold;");

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x06060a, 0.005); 

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 8); 
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x06060a);
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35); 
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.5, 100);
    pointLight.position.set(0, 0, 7); 
    this.scene.add(pointLight);

    // 배경 스크린 후방 격리 세팅
    const bgGeo = new THREE.PlaneGeometry(80, 50); 
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x09090e, depthWrite: false, fog: false });
    this.bgMesh = new THREE.Mesh(bgGeo, bgMat);
    this.bgMesh.position.set(0, 0, -30); 
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
        002호 실시간 텔레메트리 디버그 가이드
      </h3>
      <div style="font-size: 12.5px; text-align: left; line-height: 1.75; color: #dddddd;">
        <p style="margin: 6px 0;">🕵️‍♂️ <strong style="color: #00ffcc;">[실시간 콘솔 검증]</strong> 배경 이미지의 유입 성공/실패 여부를 콘솔창에 낱낱이 출력합니다.</p>
        <p style="margin: 6px 0;">🎲 <strong style="color: #ffffff;">[6대 기하학 스위칭]</strong> 지형변경 슬라이더 구간별로 [점 ➡️ 서클 ➡️ 삼각형 ➡️ 사각형 ➡️ 별 ➡️ 타원] 변형 완료!</p>
        <p style="margin: 6px 0;">📏 <strong style="color: #ffffff;">[10% 스케일 컴팩트]</strong> 분산범위 수치 폭주 연산 오류를 해결하여 아담하게 안착했습니다.</p>
        <p style="margin: 6px 0; color: #ffcc00;">▶️ <strong style="color: #ffcc00;">[하단 스타트]</strong> 재생 버튼을 누르면 이 가이드창이 투명하게 사라지며 영상이 시작됩니다!</p>
      </div>
      <div style="color: #777777; font-size: 10.5px; margin-top: 16px; border-top: 1px solid #222530; padding-top: 10px;">
        우측 개발자 도구 Console 탭을 연 상태에서 테스트해주세요.
      </div>
    `;
    this.container.appendChild(this.guiOverlay);
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

    this.currentShapeLogName = shapeType; // 실시간 덤프용 이름 백업

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
  }

  // 💡 [배경 이미지 디버그 관제탑]
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
        
        console.log(`%c[디버그] 🖼️ DOM에서 배경 이미지 요소 포착 완료! 주소: ${targetImg.src.substring(0, 80)}...`, "color: #ff9900;");

        // Three.js 비동기 파이프라인 시동
        loader.load(
          targetImg.src, 
          (tex) => {
            // 💡 로딩 성공 시 확인용 로그 덤프
            console.log("%c[디버그] 🎉 Three.js TextureLoader 업로드 성공! 해상도: " + tex.image.width + "x" + tex.image.height, "color: #33cc33; font-weight: bold;");
            
            this.bgTexture = tex;
            if (this.bgMesh) {
              this.bgMesh.material.dispose();
              this.bgMesh.material = new THREE.MeshBasicMaterial({ map: this.bgTexture, depthWrite: false, fog: false });
              this.bgMesh.material.needsUpdate = true; 
            }
          },
          undefined,
          (err) => {
            // 💡 로딩 실패 시 에러 사유 및 원인 격리 로그 덤프
            console.error("[디버그] ❌ Three.js TextureLoader 업로드 실패! 원인:", err);
          }
        );
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

    this.logFrameCount++;

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

    // 💡 [실시간 60프레임 정기 덤프 검증소]
    if (this.logFrameCount % 60 === 0) {
      console.log(
        `%c[텔레메트리 프레임 로그] 🔮 형태: ${this.currentShapeLogName.toUpperCase()} | 오디오 상태: ${this.isAudioActive ? '재생 중' : '정지 중'} | 오디오 배열 길이: ${rawData.length}개 | 마스터 볼륨 배율: ${masterVol.toFixed(2)}`,
        "color: #bbbbbb; font-size: 10.5px;"
      );
    }

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
    if (this.domObserver) this.domObserver.disconnect();
    if (this.bgTexture) this.bgTexture.dispose();

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.visualNodes = [];
  }
}
