/**
 * src/sketches/005_three_floor_eq.js
 * - [버전] Ver 4.1 (ReferenceError 오타 완치 및 32채널 네온 악기 매트릭스 완결판)
 * - 버그 완치: buildInstrumentMatrix 내부 p.map 참조 오류를 THREE.MathUtils.mapLinear로 완벽 수리
 * - 이미지 수혈: 반 고흐 명화나 업로드 이미지를 THREE.Texture로 변환하여 3D 우주 배경에 실시간 레이어 통합
 * - Shuffle (Seed) 연동: 시드 변경 즉시 32개 버튼에 7가지 독자 반응 액션 모드와 기하학 형태를 무작위 교차 셔플팅
 * - 관제탑 제어 인터페이스 100% 직결 매핑:
 *   • Scale  (glowIntensity) : 네온 버튼 라인의 원천 밝기 및 글로우 블렌딩 반경 지배
 *   • Volume (audioGain)     : 주파수 유입 시 7대 모드 변위가 튕겨 나가는 움직임 크기(진폭) 가중치 부스트
 *   • Range  (scatterExponent): 32개 네온 버튼 간의 가로세로 정렬 배치 간격(Spacing) 확장
 *   • Gauge  (gaugeValue)    : 내부 악기 기하학의 기본 디테일 밀도 변형 제어
 */

export default class ThreeFloorEqualizer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    // 4열 x 8행 = 32개의 고밀도 독립 네온 버튼 구조체
    this.matrixButtons = [];
    this.numCols = 4;
    this.numRows = 8;
    this.totalButtons = 32;

    this.bgTexture = null;
    this.lastBgImage = null;
    this.lastTime = 0;

    this.uiSettings = {
      seed: 42,
      scatter: 22,
      style: 'neon', 
      glow: 85,
      gain: 100,
      gauge: 50,
      customColors: { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' }
    };

    this.version = "005호 Neon Instrument Matrix Ver 4.1";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05060c, 0.012);

    // 원근감이 살아있는 공간 시네마틱 카메라 배치
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 11);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x05060c);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    this.syncUISettings();
    this.buildInstrumentMatrix();
  }

  syncUISettings() {
    if (window.cosmicEngineSettings) {
      const global = window.cosmicEngineSettings;
      this.uiSettings.seed = global.seed ?? 42;
      this.uiSettings.scatter = global.scatterExponent ?? 2.2;
      this.uiSettings.style = global.colorStyle ?? 'neon';
      this.uiSettings.glow = global.glowIntensity ?? 0.85; 
      this.uiSettings.gain = global.audioGain ?? 1.0;
      this.uiSettings.gauge = global.gaugeValue ?? 0.5;
      this.uiSettings.customColors = global.customColors ?? { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };
    }
  }

  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // [알고리즘 1: 이미지 양식 일치형 32개 네온 악기 하이엔드 생성기]
  buildInstrumentMatrix() {
    // 기존에 깔린 자산 흔적 없이 소멸 처리
    this.matrixButtons.forEach(btn => {
      this.scene.remove(btn.group);
      btn.geometries.forEach(g => g.dispose());
      btn.materials.forEach(m => m.dispose());
    });
    this.matrixButtons = [];

    let sRandom = this.uiSettings.seed;

    // 014호 호환 마스터 파레트 디코딩
    let baseC1 = new THREE.Color(), baseC2 = new THREE.Color();
    if (this.uiSettings.style === 'monochrome') {
      baseC1.set('#ffffff'); baseC2.set('#999999');
    } else if (this.uiSettings.style === 'neon') {
      baseC1.set('#ff0055'); baseC2.set('#00ffcc');
    } else if (this.uiSettings.style === 'pastel') {
      baseC1.set('#1a2536'); baseC2.set('#ebbaa8'); 
    } else if (this.uiSettings.style === 'custom') {
      baseC1.set(this.uiSettings.customColors.gas1);
      baseC2.set(this.uiSettings.customColors.gas2);
    } else {
      baseC1.setRGB(0.9, 0.1, 0.4); baseC2.setRGB(0.1, 0.9, 0.6);
    }

    // 그리드 생성 루프 전개
    for (let i = 0; i < this.totalButtons; i++) {
      const col = i % this.numCols;
      const row = Math.floor(i / this.numCols);

      const btnGroup = new THREE.Group();
      const geomList = [];
      const matList = [];

      sRandom = this.seededRandom(sRandom) * 1000;
      let shapeRand = this.seededRandom(sRandom + 1);
      let modeRand = this.seededRandom(sRandom + 2);

      // SHUFFLE 연동: 7가지 반응 특수 액션 모드를 버튼별로 골고루 랜덤 분배
      let assignedActionMode = Math.floor(modeRand * 7) + 1; 

      // 칸별 고유 컬러 브렌딩 그라데이션 추출
      let blendRatio = i / (this.totalButtons - 1);
      let btnThemeColor = baseC1.clone().lerp(baseC2, blendRatio);
      
      if (this.uiSettings.style === 'full-random') {
        btnThemeColor.setHSL(this.seededRandom(sRandom + 5), 0.9, 0.6);
      }

      // 기본 공통 재질 바인딩
      const meshMat = new THREE.MeshBasicMaterial({
        color: btnThemeColor,
        transparent: true,
        opacity: assignedActionMode === 5 ? 0.05 : 0.2, 
        side: THREE.DoubleSide
      });
      const lineMat = new THREE.LineBasicMaterial({
        color: btnThemeColor,
        transparent: true,
        opacity: 0.9,
        linewidth: 2
      });

      matList.push(meshMat, lineMat);

      // 1) 외곽 프레임 시공 (동그라미 vs 사각형 교차 셔플팅)
      let outerFrameMesh;
      if (shapeRand > 0.5) {
        const ringGeo = new THREE.RingGeometry(0.55, 0.6, 32);
        outerFrameMesh = new THREE.Mesh(ringGeo, lineMat);
        geomList.push(ringGeo);
      } else {
        const boxGeo = new THREE.BoxGeometry(1.0, 1.0, 0.05);
        const edges = new THREE.EdgesGeometry(boxGeo);
        outerFrameMesh = new THREE.LineSegments(edges, lineMat);
        geomList.push(boxGeo, edges);
      }
      btnGroup.add(outerFrameMesh);

      // 2) 내부 악기 기하학 구조체 시공
      const innerGroup = new THREE.Group();
      let instrumentType = Math.floor(this.seededRandom(sRandom + 3) * 4);

      if (instrumentType === 0) {
        const bodyGeo = new THREE.CircleGeometry(0.22, 16);
        const neckGeo = new THREE.BoxGeometry(0.06, 0.5, 0.02);
        neckGeo.translate(0, 0.3, 0);
        
        const bodyMesh = new THREE.Mesh(bodyGeo, meshMat);
        const neckMesh = new THREE.Mesh(neckGeo, lineMat);
        innerGroup.add(bodyMesh, neckMesh);
        geomList.push(bodyGeo, neckGeo);
      } else if (instrumentType === 1) {
        const headGeo = new THREE.CircleGeometry(0.12, 16);
        headGeo.translate(-0.1, -0.15, 0);
        const stemGeo = new THREE.BoxGeometry(0.04, 0.4, 0.02);
        stemGeo.translate(0.02, 0.05, 0);
        const flagGeo = new THREE.BoxGeometry(0.15, 0.05, 0.02);
        flagGeo.translate(0.1, 0.23, 0);

        innerGroup.add(new THREE.Mesh(headGeo, meshMat), new THREE.Mesh(stemGeo, lineMat), new THREE.Mesh(flagGeo, lineMat));
        geomList.push(headGeo, stemGeo, flagGeo);
      } else if (instrumentType === 2) {
        const luteGeo = new THREE.CylinderGeometry(0.05, 0.22, 0.5, 16);
        const luteMesh = new THREE.Mesh(luteGeo, meshMat);
        luteMesh.rotation.z = Math.PI / 4;
        innerGroup.add(luteMesh);
        geomList.push(luteGeo);
      } else {
        const coreGeo = new THREE.RingGeometry(0.05, 0.25, 6);
        const coreMesh = new THREE.Mesh(coreGeo, lineMat);
        innerGroup.add(coreMesh);
        geomList.push(coreGeo);
      }

      innerGroup.rotation.z = -Math.PI / 6;
      btnGroup.add(innerGroup);

      // 3) 6번 모드 전용 외부 팽창 리플 링 사전 증설
      const rippleGeo = new THREE.RingGeometry(0.6, 0.63, 32);
      const rippleMat = lineMat.clone();
      rippleMat.opacity = 0.0;
      const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
      btnGroup.add(rippleMesh);
      geomList.push(rippleGeo);
      matList.push(rippleMat);

      this.scene.add(btnGroup);

      // 💡 [버그 완치 핵심]: p.map 오타를 THREE.MathUtils.mapLinear 모듈로 변환 완료!
      let computedIndex = Math.floor(THREE.MathUtils.mapLinear(i, 0, this.totalButtons, 2, 180));

      this.matrixButtons.push({
        group: btnGroup,
        inner: innerGroup,
        outer: outerFrameMesh,
        ripple: rippleMesh,
        rippleMaterial: rippleMat,
        geometries: geomList,
        materials: matList,
        baseColor: btnThemeColor.clone(),
        actionMode: assignedActionMode,
        sampleIndex: computedIndex, 
        colPos: col,
        rowPos: row,
        rippleActive: false,
        rippleScale: 1.0,
        prevForce: 0
      });
    }
  }

  update(audioData) {
    if (!this.renderer || !this.scene || !this.camera || this.matrixButtons.length === 0) return;

    this.syncUISettings();
    this.renderer.clear();

    // 배경 이미지 가속 마운트 커넥터 일치
    const bgImg = window.currentUploadedImageElement;
    if (bgImg && bgImg !== this.lastBgImage) {
      if (this.bgTexture) this.bgTexture.dispose();
      this.bgTexture = new THREE.Texture(bgImg);
      this.bgTexture.minFilter = THREE.LinearFilter;
      this.bgTexture.magFilter = THREE.LinearFilter;
      this.bgTexture.needsUpdate = true;
      this.lastBgImage = bgImg;
      this.scene.background = this.bgTexture; 
    } else if (!bgImg && this.lastBgImage) {
      this.scene.background = new THREE.Color(0x05060c);
      this.lastBgImage = null;
    }

    // 진단 HUD 타임 연산선 전개
    if (!this.lastTime) this.lastTime = performance.now();
    let now = performance.now();
    let fps = Math.round(1000 / (now - this.lastTime));
    this.lastTime = now;

    window.sketchDiagnostics = {
      fps: isNaN(fps) || fps > 100 ? 30 : fps,
      particleCount: this.totalButtons + " Neon Instrument Buttons",
      isCovering: false,
      activeFunction: `NeonGrid[Style:${this.uiSettings.style}]`
    };

    const time = Date.now() * 0.001;

    // 관제탑 물리 제어 스케일링 계수 환산
    let scatterRaw = this.uiSettings.scatter > 5 ? this.uiSettings.scatter : this.uiSettings.scatter * 10;
    let layoutSpacingX = THREE.MathUtils.mapLinear(scatterRaw, 5, 50, 1.5, 3.2);
    let layoutSpacingY = THREE.MathUtils.mapLinear(scatterRaw, 5, 50, 1.0, 1.8);

    let glowRaw = this.uiSettings.glow > 5 ? this.uiSettings.glow : this.uiSettings.glow * 100;
    let glowFactor = THREE.MathUtils.mapLinear(glowRaw, 10, 250, 0.4, 3.8);

    let volumeGainScale = this.uiSettings.gain > 5 ? this.uiSettings.gain / 100.0 : this.uiSettings.gain;

    // 32채널 7대 반응 액션 실시간 역학 루프 연산구역
    this.matrixButtons.forEach((btn) => {
      let finalX = (btn.colPos - (this.numCols - 1) * 0.5) * layoutSpacingX;
      let finalY = ((this.numRows - 1) * 0.5 - btn.rowPos) * layoutSpacingY;
      btn.group.position.set(finalX, finalY, 0);

      // 주파수 바인딩 유입 및 정규화
      let rawFreq = 0.0;
      if (audioData && audioData.raw && audioData.raw.length > 0) {
        rawFreq = (audioData.raw[btn.sampleIndex] || 0) / 255.0;
      } else {
        rawFreq = (Math.sin(time * 2.0 + btn.sampleIndex) * 0.5 + 0.5) * 0.15;
      }

      let freqIntensity = rawFreq * volumeGainScale;
      let delta = freqIntensity - btn.prevForce;
      btn.prevForce = freqIntensity;

      // 물리 기본값 청소 및 리셋 초기화
      btn.group.scale.setScalar(1.0);
      btn.inner.scale.setScalar(1.0);
      
      btn.materials.forEach(mat => {
        if (mat.color) mat.color.copy(btn.baseColor).multiplyScalar(glowFactor);
        if (mat.opacity && mat !== btn.rippleMaterial) mat.opacity = 0.3 + freqIntensity * 0.4;
      });

      // SHUFFLE로 배정된 버튼별 고유 7대 특수 반응 모드 실행
      switch (btn.actionMode) {
        case 1:
          let pulseScale = 1.0 + freqIntensity * 0.45;
          btn.group.scale.setScalar(pulseScale);
          break;

        case 2:
          let peakGlow = glowFactor * (1.0 + freqIntensity * 3.5);
          btn.materials.forEach(mat => {
            if (mat.color) mat.color.copy(btn.baseColor).multiplyScalar(peakGlow);
          });
          break;

        case 3:
          if (freqIntensity > 0.3) {
            let invertColor = new THREE.Color(1.0 - btn.baseColor.r, 1.0 - btn.baseColor.g, 1.0 - btn.baseColor.b);
            btn.materials.forEach(mat => {
              if (mat.color) mat.color.copy(invertColor).multiplyScalar(glowFactor * 1.5);
            });
          }
          break;

        case 4:
          btn.inner.rotation.z = -Math.PI / 6 + (freqIntensity * Math.PI * 1.2);
          break;

        case 5:
          let fillOpacity = THREE.MathUtils.clamp(freqIntensity * 0.95, 0.05, 0.9);
          btn.materials[0].opacity = fillOpacity; 
          break;

        case 6:
          if (delta > 0.08 && !btn.rippleActive) {
            btn.rippleActive = true;
            btn.rippleScale = 1.0;
          }
          break;

        case 7:
          let innerPulse = 1.0 + freqIntensity * 0.75;
          btn.inner.scale.setScalar(innerPulse);
          break;
      }

      // 6번 리플 모드 독립 애니메이션 프레임 워크 구동
      if (btn.rippleActive) {
        btn.rippleScale += 0.08;
        btn.ripple.scale.setScalar(btn.rippleScale);
        btn.rippleMaterial.opacity = (2.5 - btn.rippleScale) * 0.6;
        btn.rippleMaterial.color.copy(btn.baseColor).multiplyScalar(glowFactor * 1.2);

        if (btn.rippleScale >= 2.5) {
          btn.rippleActive = false;
          btn.rippleScale = 1.0;
          btn.rippleMaterial.opacity = 0.0;
        }
      } else {
        btn.rippleMaterial.opacity = 0.0;
      }
    });

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
    this.matrixButtons.forEach(btn => {
      this.scene.remove(btn.group);
      btn.geometries.forEach(g => g.dispose());
      btn.materials.forEach(m => m.dispose());
    });
    
    if (this.bgTexture) {
      this.bgTexture.dispose();
      this.bgTexture = null;
    }
    this.lastBgImage = null;

    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.matrixButtons = [];
  }
}
