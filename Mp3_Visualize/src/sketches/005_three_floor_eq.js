/**
 * src/sketches/005_three_floor_eq.js
 * - [버전] Ver 5.0 (순수 기하학 네온 매트릭스 및 독립 배경 마운트 완결판)
 * - 구조 전환: 이미지 슬라이싱을 전면 폐기하고, 100% 무결점 3D 벡터 네온 기하학 악기 오브젝트로 전격 대체
 * - 배경 분리: 업로드된 이미지는 3D 월드의 최하단 배경(scene.background)으로만 깨끗하게 투사되어 왜곡 방지
 * - 3대 형상 모드 (Shuffle Seed 연동):
 *   • Seed % 3 === 1 : 빽빽하고 리드미컬한 [전체 사각형] 모드
 *   • Seed % 3 === 2 : 우아하고 청명한 [전체 원형] 모드
 *   • Seed % 3 === 0 : 가득 찬 재미를 주는 [반반 랜덤 셔플] 모드
 * - 3D Position Offset (X, Y, Z) 제어 전환:
 *   • 이제 버튼 개별 조작 대신, 네온 버튼 Grid 전체를 배경 이미지 위에서 상하좌우(X, Y)로 이동시키고 카메라 거리(Z)를 미세 조율하는 마스터 컴포지터로 작동
 */

export default class ThreeFloorEqualizer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    this.gridGroup = null; // 32개 버튼 전체를 품어 미세 이동시키는 마스터 그룹
    this.matrixButtons = [];
    this.numCols = 4;
    this.numRows = 8;
    this.totalButtons = 32;

    this.bgTexture = null;
    this.lastBgImage = null;
    this.lastTime = 0;

    this.sharedGeometries = [];

    this.uiSettings = {
      seed: 42,
      scatter: 22,
      style: 'neon', 
      glow: 85,
      gain: 100,
      gauge: 50,
      customColors: { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' }
    };

    this.version = "005호 Neon Geometry Grid Ver 5.0";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x04050a, 0.015);

    // 카메라 원근감 최적화 배치
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 10.5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x04050a);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    this.gridGroup = new THREE.Group();
    this.scene.add(this.gridGroup);

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

  // 둥근 사각형의 속 빈 네온 링 구조 생성 함수
  createRoundedRingGeometry(w, h, r, thickness) {
    const shape = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    
    shape.moveTo(x, y + r);
    shape.lineTo(x, y + h - r);
    shape.quadraticCurveTo(x, y + h, x + r, y + h);
    shape.lineTo(x + w - r, y + h);
    shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    shape.lineTo(x + w, y + r);
    shape.quadraticCurveTo(x + w, y, x + w - r, y);
    shape.lineTo(x + r, y);
    shape.quadraticCurveTo(x, y, x, y + r);

    const hole = new THREE.Path();
    const iw = w - thickness * 2;
    const ih = h - thickness * 2;
    const ir = Math.max(0.01, r - thickness);
    const ix = -iw / 2, iy = -ih / 2;
    
    hole.moveTo(ix, iy + ir);
    hole.lineTo(ix + iw - ir, iy);
    hole.quadraticCurveTo(ix + iw, iy, ix + iw, iy + ir);
    hole.lineTo(ix + iw, iy + ih - ir);
    hole.quadraticCurveTo(ix + iw, iy + ih, ix + iw - ir, iy + ih);
    hole.lineTo(ix + ir, iy + ih);
    hole.quadraticCurveTo(ix, iy + ih, ix, iy + ih - ir);
    hole.lineTo(ix, iy + ir);
    hole.quadraticCurveTo(ix, iy, ix + ir, iy);

    shape.holes.push(hole);
    return new THREE.ShapeGeometry(shape, 24);
  }

  buildInstrumentMatrix() {
    // 이전 생성 자산 디스포즈 청소
    this.matrixButtons.forEach(btn => {
      this.gridGroup.remove(btn.group);
      btn.geometries.forEach(g => g.dispose());
      btn.materials.forEach(m => m.dispose());
    });
    if (this.sharedGeometries) {
      this.sharedGeometries.forEach(g => g.dispose());
      this.sharedGeometries = [];
    }
    this.matrixButtons = [];

    let sRandom = this.uiSettings.seed;

    // 014호 테마 호환 컬러 셋 디코딩
    let baseC1 = new THREE.Color(), baseC2 = new THREE.Color();
    if (this.uiSettings.style === 'monochrome') {
      baseC1.set('#ffffff'); baseC2.set('#999999');
    } else if (this.uiSettings.style === 'neon') {
      baseC1.set('#ff0055'); baseC2.set('#00ffcc');
    } else if (this.uiSettings.style === 'pastel') {
      baseC1.set('#152238'); baseC2.set('#ffd1b3'); 
    } else if (this.uiSettings.style === 'custom') {
      baseC1.set(this.uiSettings.customColors.gas1);
      baseC2.set(this.uiSettings.customColors.gas2);
    } else {
      baseC1.setRGB(0.9, 0.1, 0.4); baseC2.setRGB(0.1, 0.9, 0.6);
    }

    // 기본 벡터 에셋 공유 지오메트리 셋 빌드
    const ringGeo = new THREE.RingGeometry(0.53, 0.58, 32);
    const roundedRingGeo = this.createRoundedRingGeometry(1.1, 1.1, 0.22, 0.05);
    
    const rippleCircleGeo = new THREE.RingGeometry(0.58, 0.61, 32);
    const rippleSquareGeo = this.createRoundedRingGeometry(1.18, 1.18, 0.26, 0.03);

    this.sharedGeometries.push(ringGeo, roundedRingGeo, rippleCircleGeo, rippleSquareGeo);

    // 💡 [형상 전환 룰]: Seed의 값을 기준으로 전체 원형, 전체 사각형, 반반 셔플 결정
    const seedMode = this.uiSettings.seed % 3;

    for (let i = 0; i < this.totalButtons; i++) {
      const col = i % this.numCols;
      const row = Math.floor(i / this.numCols);

      const btnGroup = new THREE.Group();
      const geomList = [];
      const matList = [];

      sRandom = this.seededRandom(sRandom) * 1000;
      let shapeRand = this.seededRandom(sRandom + 1);
      let modeRand = this.seededRandom(sRandom + 2);

      let assignedActionMode = Math.floor(modeRand * 7) + 1; 

      let blendRatio = i / (this.totalButtons - 1);
      let btnThemeColor = baseC1.clone().lerp(baseC2, blendRatio);
      if (this.uiSettings.style === 'full-random') {
        btnThemeColor.setHSL(this.seededRandom(sRandom + 5), 0.9, 0.6);
      }

      // 💡 [형상 매핑 핵심]: 원형 및 사각형 락인 분기
      let isSquareType = false;
      if (seedMode === 1) {
        isSquareType = true; // 전부 사각형 모드
      } else if (seedMode === 2) {
        isSquareType = false; // 전부 원형 모드
      } else {
        isSquareType = shapeRand > 0.5; // 반반 랜덤 셔플 모드
      }

      const meshMat = new THREE.MeshBasicMaterial({
        color: btnThemeColor,
        transparent: true,
        opacity: assignedActionMode === 5 ? 0.05 : 0.2, 
        side: THREE.DoubleSide
      });
      const lineMat = new THREE.LineBasicMaterial({
        color: btnThemeColor,
        transparent: true,
        opacity: 0.9
      });

      matList.push(meshMat, lineMat);

      // 1) 외곽 프레임 부착 (SDF 방식 대신 완전한 3D 벡터 구조)
      const outerRing = new THREE.Mesh(isSquareType ? roundedRingGeo : ringGeo, lineMat);
      btnGroup.add(outerRing);

      // 2) 내부 악기 형상의 프로시저럴 기하학 엠블럼 생성
      const innerGroup = new THREE.Group();
      let instrumentType = Math.floor(this.seededRandom(sRandom + 3) * 4);

      if (instrumentType === 0) {
        // 기타/비파 형태
        const bodyGeo = new THREE.CircleGeometry(0.2, 16);
        const neckGeo = new THREE.BoxGeometry(0.04, 0.44, 0.02);
        neckGeo.translate(0, 0.25, 0);
        
        const bodyMesh = new THREE.Mesh(bodyGeo, meshMat);
        const neckMesh = new THREE.Mesh(neckGeo, lineMat);
        innerGroup.add(bodyMesh, neckMesh);
        geomList.push(bodyGeo, neckGeo);
      } else if (instrumentType === 1) {
        // 음표 형태
        const headGeo = new THREE.CircleGeometry(0.1, 16);
        headGeo.translate(-0.08, -0.12, 0);
        const stemGeo = new THREE.BoxGeometry(0.03, 0.35, 0.02);
        stemGeo.translate(0.01, 0.05, 0);
        const flagGeo = new THREE.BoxGeometry(0.12, 0.04, 0.02);
        flagGeo.translate(0.08, 0.2, 0);

        innerGroup.add(new THREE.Mesh(headGeo, meshMat), new THREE.Mesh(stemGeo, lineMat), new THREE.Mesh(flagGeo, lineMat));
        geomList.push(headGeo, stemGeo, flagGeo);
      } else if (instrumentType === 2) {
        // 다이내믹 3중 스펙트럼 미니 바 형태
        const barGeo1 = new THREE.BoxGeometry(0.05, 0.2, 0.02); barGeo1.translate(-0.1, 0, 0);
        const barGeo2 = new THREE.BoxGeometry(0.05, 0.32, 0.02); barGeo2.translate(0, 0, 0);
        const barGeo3 = new THREE.BoxGeometry(0.05, 0.15, 0.02); barGeo3.translate(0.1, 0, 0);

        innerGroup.add(new THREE.Mesh(barGeo1, meshMat), new THREE.Mesh(barGeo2, lineMat), new THREE.Mesh(barGeo3, meshMat));
        geomList.push(barGeo1, barGeo2, barGeo3);
      } else {
        // Concentric 우퍼 스피커 형태
        const coreGeo = new THREE.RingGeometry(0.04, 0.2, 6);
        const coreMesh = new THREE.Mesh(coreGeo, lineMat);
        innerGroup.add(coreMesh);
        geomList.push(coreGeo);
      }

      innerGroup.rotation.z = -Math.PI / 6; // 비스듬하게 세워진 원형 무드 유지
      btnGroup.add(innerGroup);

      // 6번 리플용 외곽 링 부착
      const rippleMat = lineMat.clone();
      rippleMat.opacity = 0.0;
      const rippleMesh = new THREE.Mesh(isSquareType ? rippleSquareGeo : rippleCircleGeo, rippleMat);
      btnGroup.add(rippleMesh);

      matList.push(rippleMat);
      this.gridGroup.add(btnGroup);

      let computedIndex = Math.floor(THREE.MathUtils.mapLinear(i, 0, this.totalButtons, 2, 180));

      this.matrixButtons.push({
        group: btnGroup,
        inner: innerGroup,
        ripple: rippleMesh,
        rippleMaterial: rippleMat,
        materials: matList,
        geometries: geomList,
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

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const aspect = width / height;

    if (aspect < 1.0) {
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, 11.0 / aspect, 0.1);
    } else {
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, 10.0, 0.1);
    }
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    // 💡 [적용의 전환]: X, Y, Z 입력창의 값을 버튼 Grid 전체의 오프셋 제어선으로 연결 (민감도 1/50 적용)
    let offX = 0, offY = 0, offZ = 0;
    const elX = document.getElementById('num-offset-x');
    const elY = document.getElementById('num-offset-y');
    const elZ = document.getElementById('num-offset-z');
    
    if (elX) offX = parseFloat(elX.value) || 0;
    if (elY) offY = parseFloat(elY.value) || 0;
    if (elZ) offZ = parseFloat(elZ.value) || 0;

    const sensitivity = 0.02;
    this.gridGroup.position.x = offX * sensitivity * 10.0;
    this.gridGroup.position.y = offY * sensitivity * 10.0;
    this.camera.position.z += offZ * sensitivity * 5.0; // Z 축은 카메라 거리를 당기고 미는 줌 렌즈 작동

    // 💡 [배경 이미지]: 사진은 3D 공간의 완벽한 캔버스 배경으로만 독립 안착
    const targetImg = window.currentUploadedImageElement;
    if (targetImg && targetImg !== this.lastBgImage) {
      if (this.bgTexture) this.bgTexture.dispose();
      this.bgTexture = new THREE.Texture(targetImg);
      this.bgTexture.minFilter = THREE.LinearFilter;
      this.bgTexture.magFilter = THREE.LinearFilter;
      this.bgTexture.needsUpdate = true;
      this.lastBgImage = targetImg;
      this.scene.background = this.bgTexture; // 버튼에 입히지 않고 배경에 깔기
    } else if (!targetImg && this.lastBgImage) {
      this.scene.background = new THREE.Color(0x04050a);
      this.lastBgImage = null;
    }

    // 진단 HUD 스트리밍
    if (!this.lastTime) this.lastTime = performance.now();
    let now = performance.now();
    let fps = Math.round(1000 / (now - this.lastTime));
    this.lastTime = now;

    let shapeModeText = this.uiSettings.seed % 3 === 1 ? "Squares" : this.uiSettings.seed % 3 === 2 ? "Circles" : "Mixed";
    window.sketchDiagnostics = {
      fps: isNaN(fps) || fps > 100 ? 30 : fps,
      particleCount: this.totalButtons + " Neon Geometries",
      isCovering: false,
      activeFunction: `Grid[Shape:${shapeModeText}]`
    };

    const time = Date.now() * 0.001;

    let scatterRaw = this.uiSettings.scatter > 5 ? this.uiSettings.scatter : this.uiSettings.scatter * 10;
    let layoutSpacingX = THREE.MathUtils.mapLinear(scatterRaw, 5, 50, 1.45, 3.0);
    let layoutSpacingY = THREE.MathUtils.mapLinear(scatterRaw, 5, 50, 0.95, 1.7);

    let glowRaw = this.uiSettings.glow > 5 ? this.uiSettings.glow : this.uiSettings.glow * 100;
    let glowFactor = THREE.MathUtils.mapLinear(glowRaw, 10, 250, 0.4, 3.8);

    let volumeGainScale = this.uiSettings.gain > 5 ? this.uiSettings.gain / 100.0 : this.uiSettings.gain;

    // 32채널 7대 고유 액션 제어 루프
    this.matrixButtons.forEach((btn) => {
      let finalX = (btn.colPos - (this.numCols - 1) * 0.5) * layoutSpacingX;
      let finalY = ((this.numRows - 1) * 0.5 - btn.rowPos) * layoutSpacingY;
      btn.group.position.set(finalX, finalY, 0);

      let rawFreq = 0.0;
      if (audioData && audioData.raw && audioData.raw.length > 0) {
        rawFreq = (audioData.raw[btn.sampleIndex] || 0) / 255.0;
      } else {
        rawFreq = (Math.sin(time * 2.5 + btn.sampleIndex) * 0.5 + 0.5) * 0.12;
      }

      let freqIntensity = rawFreq * volumeGainScale;
      let delta = freqIntensity - btn.prevForce;
      btn.prevForce = freqIntensity;

      // 물리 스케일 베이스 리셋
      btn.group.scale.setScalar(1.0);
      btn.inner.scale.setScalar(1.0);
      btn.inner.rotation.z = 0;

      btn.materials.forEach(mat => {
        if (mat.color) mat.color.copy(btn.baseColor).multiplyScalar(glowFactor);
        if (mat.opacity && mat !== btn.rippleMaterial) {
          mat.opacity = mat.type === "MeshBasicMaterial" ? (btn.actionMode === 5 ? 0.05 : 0.2) : 0.9;
        }
      });

      switch (btn.actionMode) {
        case 1:
          btn.group.scale.setScalar(1.0 + freqIntensity * 0.45);
          break;
        case 2:
          btn.materials.forEach(mat => {
            if (mat.color) mat.color.copy(btn.baseColor).multiplyScalar(glowFactor * (1.0 + freqIntensity * 3.2));
          });
          break;
        case 3:
          if (freqIntensity > 0.28) {
            let invertColor = new THREE.Color(1.0 - btn.baseColor.r, 1.0 - btn.baseColor.g, 1.0 - btn.baseColor.b);
            btn.materials.forEach(mat => {
              if (mat.color) mat.color.copy(invertColor).multiplyScalar(glowFactor * 1.5);
            });
          }
          break;
        case 4:
          btn.inner.rotation.z = freqIntensity * Math.PI * 1.0;
          break;
        case 5:
          // 테두리 색 내부 면 채우기 (MeshBasicMaterial 오퍼시티 최대화)
          btn.materials[0].opacity = THREE.MathUtils.clamp(freqIntensity * 1.2, 0.05, 0.95);
          break;
        case 6:
          if (delta > 0.07 && !btn.rippleActive) {
            btn.rippleActive = true;
            btn.rippleScale = 1.0;
          }
          break;
        case 7:
          btn.inner.scale.setScalar(1.0 + freqIntensity * 0.7);
          break;
      }

      if (btn.rippleActive) {
        btn.rippleScale += 0.09;
        btn.ripple.scale.setScalar(btn.rippleScale);
        btn.rippleMaterial.opacity = (2.4 - btn.rippleScale) * 0.7;
        if (btn.rippleScale >= 2.4) {
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
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  destroy() {
    if (!this.scene) return;
    this.matrixButtons.forEach(btn => {
      this.gridGroup.remove(btn.group);
      btn.geometries.forEach(g => g.dispose());
      btn.materials.forEach(m => m.dispose());
    });
    this.scene.remove(this.gridGroup);
    
    if (this.sharedGeometries) {
      this.sharedGeometries.forEach(g => g.dispose());
      this.sharedGeometries = [];
    }

    if (this.bgTexture) {
      this.bgTexture.dispose();
      this.bgTexture = null;
    }
    this.lastBgImage = null;

    if (this.renderer) {
      this.container.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.scene = null; this.camera = null; this.renderer = null;
    this.matrixButtons = [];
  }
}
