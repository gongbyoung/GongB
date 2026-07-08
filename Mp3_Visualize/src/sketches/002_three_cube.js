/**
 * src/sketches/002_three_cube.js
 * - [버전] Ver 4.0 (3D 방사형 링 바 비주얼라이저 및 3대 드로잉 기하학 셔플 완결판)
 * - 중심축 이격 거리 변이 구조 및 [전체막대, 끝점만, 시작점만] 3대 형태 무작위 하이브리드 혼합 배치 완료
 * - Color Style 5대 스펙트럼 (1:태양, 2:파란바다, 3:3중피커 커스텀, 4:랜덤원색채우기, 5:와이어프레임 테두리) 완벽 이식
 * - 로딩 시 HTML 사용 설명 가이드 레이어 고정 및 재생 스타트 시 자동 페이드아웃 규격 기본 장착
 * - 특수문자 파일명 우회형 3D BG 텍스처 백드롭 매핑 파이프라인 완비
 */

export default class ThreeCube {
  constructor(container) {
    this.container = container;
    this.scene = null; 
    this.camera = null;
    this.renderer = null;
    this.guiOverlay = null;

    // 💡 업데이트 마커 세팅
    this.version = "002호 Cosmic 3D Ring Bar Ver 4.0";
    this.isAudioActive = false;
    this.lastSettingsStr = "";

    // 3D 메쉬 노드 제어 저장소
    this.barCount = 128; // 원형 링을 조밀하게 채울 고해상도 3D 노드 개수
    this.visualNodes = []; 

    // 배경 이미지 텍스처 주입 장치
    this.bgTexture = null;
    this.bgMesh = null;
    this.lastBgSrc = "";
    this.domObserver = null;
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x06060a, 0.03);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    // 원형 비주얼라이저를 입체적으로 내려다볼 수 있는 최적의 시네마틱 앵글 카메라 쿼터뷰 포지셔닝
    this.camera.position.set(0, 5, 9);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x06060a);
    this.container.appendChild(this.renderer.domElement);

    // 환경 광원 빌드
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.2, 100);
    pointLight.position.set(0, 8, 5);
    this.scene.add(pointLight);

    // 💡 3D 우주 배경 스크린 설치 (BG 이미지 합성용 플레이트 가속)
    const bgGeo = new THREE.PlaneGeometry(24, 14);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x111116, depthWrite: false });
    this.bgMesh = new THREE.Mesh(bgGeo, bgMat);
    this.bgMesh.position.set(0, 0, -5); // 카메라 뒤쪽 바닥에 배경 스크린 배치
    this.scene.add(this.bgMesh);

    // 💡 [공통 표준 규격] 사용설명 로딩 안내 패널 HTML 생성 기동
    this.buildOnScreenGuideUI();

    // 💡 [핵심 엔진] 3D 방사형 링 바 비주얼라이저 지오메트리 어레이 빌드
    this.buildRadialMatrix();

    // 특수문자 우회 이미지 스캔 트래커 배치
    this.setupDirectInputTracker();
  }

  // 💡 [공통 표준 규격] UI 안내 레이어 생성 및 스타일 인라인 코팅
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
        002호 3D 방사형 비주얼라이저 가이드
      </h3>
      <div style="font-size: 12.5px; text-align: left; line-height: 1.75; color: #dddddd;">
        <p style="margin: 6px 0;">🎡 <strong style="color: #00ffcc;">[원형 배치]</strong> 128개의 3D 바가 주파수 대역별로 시작점 이격을 달리하여 원형 정렬됩니다.</p>
        <p style="margin: 6px 0;">🎲 <strong style="color: #ffffff;">[3대 형태 셔플]</strong> 각 노드는 전체막대, 끝점만, 시작점만 표현 모드가 랜덤하게 뒤섞여 생성됩니다.</p>
        <p style="margin: 6px 0;">🎨 <strong style="color: #ffffff;">[스타일 파레트]</strong> 태양(레드), 파란바다, 3중 커스텀 피커 연동, 랜덤 원색, 테두리 와이어프레임을 스위칭하세요.</p>
        <p style="margin: 6px 0; color: #ffcc00;">▶️ <strong style="color: #ffcc00;">[하단 스타트]</strong> 재생 버튼을 누르면 이 가이드창이 투명하게 사라지며 무대가 폭발합니다!</p>
      </div>
      <div style="color: #777777; font-size: 10.5px; margin-top: 16px; border-top: 1px solid #222530; padding-top: 10px;">
        음악이 정지되면 안내 설명창이 다시 활성화됩니다.
      </div>
    `;
    this.container.appendChild(this.guiOverlay);
  }

  // 💡 [기획 의도 공학적 구현] 128개의 노드에 이격 변이 및 3대 드로잉 형태학 패스 무작위 셔플 세팅
  buildRadialMatrix() {
    // 기존에 존재하던 메쉬 배열 요소 청소
    this.visualNodes.forEach(node => this.scene.remove(node.mesh));
    this.visualNodes = [];

    const baseBoxGeometry = new THREE.BoxGeometry(0.12, 1, 0.12);
    const ui = this.getUIParams();

    // 지형변경(ui.seed) 값을 기준으로 형태학적 셔플 난수 흐름 고정
    let seedValue = ui.seed;
    const seededRandom = () => {
      let x = Math.sin(seedValue++) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < this.barCount; i++) {
      const angle = (i / this.barCount) * Math.PI * 2;

      // 💡 [기획 요구사항 1] 주파수 인덱스 편차에 따라 원형 시작점이 중심부로부터 조금씩 다르게 생성되는 변이 수식
      let freqRatio = i / this.barCount;
      let baseRadiusOffset = 2.4 + Math.sin(freqRatio * Math.PI * 4.0) * 0.45 + seededRandom() * 0.3;

      // 💡 [기획 요구사항 2] 막대전체, 끝만 막대, 시작만 표현 3개 모드 주사위 셔플
      let drawRand = seededRandom();
      let mode = 'full-bar';
      if (drawRand < 0.34) {
        mode = 'tip-only';    // 끝만 막대 형태로 공중부양
      } else if (drawRand < 0.67) {
        mode = 'start-only';  // 시작 부근에 점 단추 형태로 고정
      }

      // 테마별 컬러 기초 색상 할당
      let finalColor = new THREE.Color();
      let useWireframe = false;

      if (ui.style.includes('neon')) {
        // 1번 스타일: 태양을 표현 (화사한 불꽃 레드 오렌지 크림 골드 그라데이션)
        finalColor.setHSL(0.02 + freqRatio * 0.08, 0.95, 0.55);
      } else if (ui.style.includes('monochrome')) {
        // 2번 스타일: 파란 바다 (시아닉 청록 네온에서 깊은 사파이어 블루 그라데이션)
        finalColor.setHSL(0.55 + freqRatio * 0.12, 0.9, 0.5);
      } else if (ui.style.includes('custom-color') || ui.style.includes('custom')) {
        // 3번 스타일: 가스1(잎사귀면), 가스2(테두리), 대형별(코어) 3축 피커 다이렉트 덤프 융합
        if (mode === 'full-bar') finalColor.set(ui.gas1Hex);
        else if (mode === 'tip-only') finalColor.set(ui.gas2Hex);
        else finalColor.set(ui.starHex);
      } else if (ui.style.includes('full-random') || ui.style.includes('gradient')) {
        // 4번 스타일: 랜덤 원색 채우기 (중복 제어 셔플 고유 색상 배정)
        finalColor.setHSL(seededRandom(), 0.95, 0.55);
      } else {
        // 5번 스타일: 랜덤 테두리만 칠하기 (와이어프레임 강제 개방 모드)
        finalColor.setHSL(seededRandom(), 1.0, 0.6);
        useWireframe = true;
      }

      const material = new THREE.MeshStandardMaterial({
        color: finalColor,
        roughness: 0.2,
        metalness: 0.7,
        emissive: finalColor,
        emissiveIntensity: useWireframe ? 0.6 : 0.2,
        wireframe: useWireframe // 5번 테두리 전용 와이어프레임 칩
      });

      // 만약 시작점 모드나 끝점 모드면 그에 맞는 지오메트리 콤팩트 다듬기 가동
      let currentGeo = baseBoxGeometry;
      if (mode === 'start-only') {
        currentGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14); // 시작점 전용 미니 큐브 앵커
      } else if (mode === 'tip-only') {
        currentGeo = new THREE.BoxGeometry(0.15, 0.25, 0.15); // 끝단 전용 공중 비트 상자
      }

      const mesh = new THREE.Mesh(currentGeo, material);

      // 박스를 원형 방사형 방향 각도로 정렬 정렬
      mesh.position.x = Math.cos(angle) * baseRadiusOffset;
      mesh.position.z = Math.sin(angle) * baseRadiusOffset;
      mesh.position.y = 0;

      // 박스가 중심점(0,0,0)을 바라보고 사방으로 곧게 뻗어나가도록 수학적 회전 정렬 행렬 계산
      mesh.rotation.y = -angle + Math.PI / 2;

      this.scene.add(mesh);

      // 실시간 프레임 동적 트래킹 데이터 팩 저장
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

  // 💡 특수문자 콜론 주소 브라우저 파싱 차단 우회 직통 DOM 옵저버
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
        // Three.js 텍스처 하드웨어 버퍼 파이프라인 업로드 기동
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

  // 💡 [실시간 애니메이션 프레임 매트릭스 변환] 저음~고음 독립 펄스 변환 루프
  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera) return;

    const time = Date.now() * 0.001;
    const ui = this.getUIParams();

    // 지형변경(ui.seed) 슬라이더 조작 시 3대 형태학 배치 구도를 실시간 강제 리모델링 셔플 변경 트리거
    let currentSettingsStr = `${ui.seed}-${ui.style}-${ui.gas1Hex}-${ui.gas2Hex}-${ui.starHex}`;
    if (this.lastSettingsStr !== currentSettingsStr) {
        this.lastSettingsStr = currentSettingsStr;
        this.buildRadialMatrix();
    }

    // 스타트 재생 버튼 상태 트래킹을 통한 가이드 레이어 투명도 페이드아웃 규격 가동
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

    // 오디오 진폭 원천 정보 가져오기
    let rawData = (audioData && audioData.raw) ? audioData.raw : [];
    let hasRaw = rawData.length > 20;
    let masterVol = audioData ? audioData.vol : 0.1;

    // 감도 슬라이더 마스터 계수
    masterVol *= ui.burst;

    // 💡 128개 3D 독립 방사형 메쉬 메커니즘 순회 루프 실행
    this.visualNodes.forEach((node) => {
      let freqVolume = 0;
      if (hasRaw) {
        // 128개 노드 인덱스 분할 인터폴레이션 정렬
        let rawIdx = Math.floor(node.freqIdxRatio * (rawData.length - 1));
        freqVolume = rawData[rawIdx] / 255.0;
      } else {
        freqVolume = Math.sin(time * 3.0 + node.seedShift * 10.0) * 0.3 + 0.3;
      }

      freqVolume *= ui.burst;

      // 발광크기(ui.glow) 슬라이더 계수와 오디오 진폭 실시간 합성
      let scaleMultiplier = p5 ? p5.prototype.map(ui.glow, 10, 150, 0.4, 2.5) : 1.0;
      let dynamicResponse = freqVolume * 7.5 * scaleMultiplier;

      // 💡 [3대 기하학 모드별 오디오 물리 반응 분기 수식 구현 완료]
      if (node.mode === 'full-bar') {
        // 1. 막대 전체 표현: Y축 길이(높이) 스케일을 확장하고 길어진 절반만큼 중심 외곽으로 보정 평행이동
        let targetScaleY = 0.1 + dynamicResponse;
        node.mesh.scale.y = THREE.MathUtils.lerp(node.mesh.scale.y, targetScaleY, 0.25);
        
        // 시작점에 고정된 상태로 바깥쪽으로 자라나도록 포지션 트랜스폼 연산
        let currentExtRadius = node.baseRadius + (node.mesh.scale.y / 2);
        node.mesh.position.x = Math.cos(node.angle) * currentExtRadius;
        node.mesh.position.z = Math.sin(node.angle) * currentExtRadius;

      } else if (node.mode === 'tip-only') {
        // 2. 끝만 막대로 표현 (공중 비트 박스): 스케일은 고정되거나 미세 펄스만 먹고, 오직 중심부 이격 반경 거리 자체가 우주 밖으로 슬라이딩 사출
        node.mesh.scale.set(1, 1, 1);
        let targetRadius = node.baseRadius + (dynamicResponse * 0.8);
        let curRadius = THREE.MathUtils.lerp(node.baseRadius, targetRadius, 0.28);
        
        node.mesh.position.x = Math.cos(node.angle) * curRadius;
        node.mesh.position.z = Math.sin(node.angle) * curRadius;

      } else {
        // 3. 시작만 표현 (앵커 단추): 사방으로 움직이지 않고 고정된 원형 격자 위치에서 오디오 볼륨 크기만큼 구슬 스케일 자체만 웅장하게 벌크업 팽창 반짝임
        let targetDotScale = 1.0 + freqVolume * 3.8 * scaleMultiplier;
        let curDotScale = THREE.MathUtils.lerp(node.mesh.scale.x, targetDotScale, 0.3);
        node.mesh.scale.set(curDotScale, curDotScale, curDotScale);

        node.mesh.position.x = Math.cos(node.angle) * node.baseRadius;
        node.mesh.position.z = Math.sin(node.angle) * node.baseRadius;
      }

      // 비트 진폭 타격에 비례한 실시간 네온 발광 세기(Emissive) 동적 오버클러킹
      if (node.mesh.material) {
        node.mesh.material.emissiveIntensity = THREE.MathUtils.lerp(node.mesh.material.emissiveIntensity, 0.1 + freqVolume * 2.8, 0.2);
      }
    });

    // 전체 비주얼라이저 매트릭스 링 스튜디오 씬을 은은하게 슬로우 시네마틱 자전 회전 효과 추가
    this.scene.rotation.y = time * 0.05 + (masterVol * 0.08);
    this.scene.rotation.x = Math.sin(time * 0.2) * 0.05;

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
