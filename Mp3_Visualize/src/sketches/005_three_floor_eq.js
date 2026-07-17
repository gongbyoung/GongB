/**
 * src/sketches/005_three_floor_eq.js
 * - [버전] Ver 5.1 (배경 이미지 X,Y 위치 및 Z 스케일 제어 + 비율 완치 판정 완결판)
 * - 비율 완치: 16:9, 9:16 종횡비 변환 시 마스터 그리드가 화면 밖으로 탈출하지 않도록 aspect 가드 센서 복구
 * - 조작 혁신: 3D Position Offset (X, Y, Z) 인풋 노브를 "로딩된 배경 이미지 메시"에 직결 체결
 *   • X 입력창 : 배경 이미지를 좌우로 미세 이동
 *   • Y 입력창 : 배경 이미지를 상하로 미세 이동
 *   • Z 입력창 : 배경 이미지의 스케일 크기를 줌인/줌아웃 확대 축소
 * - 순수 기하학 네온 매트릭스 7대 오디오 반응 및 3대 형상 셔플 모드는 완벽하게 보존형 유지
 */

export default class ThreeFloorEqualizer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    this.gridGroup = null;      // 32개 네온 버튼이 담긴 중앙 고정 그룹
    this.bgMesh = null;         // 💡 [개혁]: X, Y, Z 조작을 온전히 수혈받을 독립 배경 이미지 메시
    
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

    this.version = "005호 Neon Geometry Grid Ver 5.1";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x04050a, 0.015);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 10.5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x04050a);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    // 💡 [배경 플레이트 선행 시공]: 격자판 뒤쪽에 위치할 고화질 이미지 보드 생성
    const bgPlaneGeo = new THREE.PlaneGeometry(16, 16);
    this.bgMeshMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      visible: false // 이미지 로딩 전에는 숨김 처리
    });
    this.bgMesh = new THREE.Mesh(bgPlaneGeo, this.bgMeshMaterial);
    this.bgMesh.position.set(0, 0, -5); // 버튼들(Z=0)보다 한참 뒤에 배치
    this.scene.add(this.bgMesh);
    this.sharedGeometries.push(bgPlaneGeo);

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
    this.matrixButtons.forEach(btn => {
      this.gridGroup.remove(btn.group);
      btn.geometries.forEach(g => g.dispose());
      btn.materials.forEach(m => m.dispose());
    });
    this.matrixButtons = [];

    let sRandom = this.uiSettings.seed;

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

    const ringGeo = new THREE.RingGeometry(0.53, 0.58, 32);
    const roundedRingGeo = this.createRoundedRingGeometry(1.1, 1.1, 0.22, 0.05);
    
    const rippleCircleGeo = new THREE.RingGeometry(0.58, 0.61, 32);
    const rippleSquareGeo = this.createRoundedRingGeometry(1.18, 1.18, 0.26, 0.03);

    this.sharedGeometries.push(ringGeo, roundedRingGeo, rippleCircleGeo, rippleSquareGeo);

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

      let isSquareType = false;
      if (seedMode === 1) {
        isSquareType = true; 
      } else if (seedMode === 2) {
        isSquareType = false; 
      } else {
        isSquareType = shapeRand > 0.5; 
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

      const outerRing = new THREE.Mesh(isSquareType ? roundedRingGeo : ringGeo, lineMat);
      btnGroup.add(outerRing);

      const innerGroup = new THREE.Group();
      let instrumentType = Math.floor(this.seededRandom(sRandom + 3) * 4);

      if (instrumentType === 0) {
        const bodyGeo = new THREE.CircleGeometry(0.2, 16);
        const neckGeo = new THREE.BoxGeometry(0.04, 0.44, 0.02);
        neckGeo.translate(0, 0.25, 0);
        
        const bodyMesh = new THREE.Mesh(bodyGeo, meshMat);
        const neckMesh = new THREE.Mesh(neckGeo, lineMat);
        innerGroup.add(bodyMesh, neckMesh);
        geomList.push(bodyGeo, neckGeo);
      } else if (instrumentType === 1) {
        const headGeo = new THREE.CircleGeometry(0.1, 16);
        headGeo.translate(-0.08, -0.12, 0);
        const stemGeo = new THREE.BoxGeometry(0.03, 0.35, 0.02);
        stemGeo.translate(0.01, 0.05, 0);
        const flagGeo = new THREE.BoxGeometry(0.12, 0.04, 0.02);
        flagGeo.translate(0.08, 0.2, 0);

        innerGroup.add(new THREE.Mesh(headGeo, meshMat), new THREE.Mesh(stemGeo, lineMat), new THREE.Mesh(flagGeo, lineMat));
        geomList.push(headGeo, stemGeo, flagGeo);
      } else if (instrumentType === 2) {
        const barGeo1 = new THREE.BoxGeometry(0.05, 0.2, 0.02); barGeo1.translate(-0.1, 0, 0);
        const barGeo2 = new THREE.BoxGeometry(0.05, 0.32, 0.02); barGeo2.translate(0, 0, 0);
        const barGeo3 = new THREE.BoxGeometry(0.05, 0.15, 0.02); barGeo3.translate(0.1, 0, 0);

        innerGroup.add(new THREE.Mesh(barGeo1, meshMat), new THREE.Mesh(barGeo2, lineMat), new THREE.Mesh(barGeo3, meshMat));
        geomList.push(barGeo1, barGeo2, barGeo3);
      } else {
        const coreGeo = new THREE.RingGeometry(0.04, 0.2, 6);
        const coreMesh = new THREE.Mesh(coreGeo, lineMat);
        innerGroup.add(coreMesh);
        geomList.push(coreGeo);
      }

      innerGroup.rotation.z = -Math.PI / 6; 
      btnGroup.add(innerGroup);

      const rippleMesh = new THREE.Mesh(isSquareType ? rippleSquareGeo : rippleCircleGeo, lineMat.clone());
      rippleMesh.material.opacity = 0.0;
      btnGroup.add(rippleMesh);

      matList.push(rippleMesh.material);
      this.gridGroup.add(btnGroup);

      let computedIndex = Math.floor(THREE.MathUtils.mapLinear(i, 0, this.totalButtons, 2, 180));

      this.matrixButtons.push({
        group: btnGroup,
        inner: innerGroup,
        ripple: rippleMesh,
        rippleMaterial: rippleMesh.material,
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

    // 💡 [화면비율 16:9 및 9:16 완치 디텍터]: 세로 화면(aspect < 1)이 되면 전체 그리드 배율을 칼같이 자동 스케일 다운
    if (aspect < 1.0) {
      this.gridGroup.scale.setScalar(aspect * 0.95); // 9:16 스위칭 시 절대 안 잘리고 정중앙 정렬
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    } else {
      this.gridGroup.scale.setScalar(1.0); // 16:9 가로 모드 정상 배율 환원
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }

    // 관제탑 캘리브레이션 노브 값 추출
    let offX = 0, offY = 0, offZ = 0;
    const elX = document.getElementById('num-offset-x');
    const elY = document.getElementById('num-offset-y');
    const elZ = document.getElementById('num-offset-z');
    
    if (elX) offX = parseFloat(elX.value) || 0;
    if (elY) offY = parseFloat(elY.value) || 0;
    if (elZ) offZ = parseFloat(elZ.value) || 0;

    // 편안한 조작을 위해 민감도 인덱스 1/50 락인
    const sensitivity = 0.02;

    // 💡 [요청 사양 핵심]: X, Y 노브는 오직 배경 이미지의 이동에만, Z 노브는 이미지 크기 배율(Scale) 조절에만 직결 관제
    if (this.bgMesh) {
      this.bgMesh.position.x = offX * sensitivity * 10.0;
      this.bgMesh.position.y = offY * sensitivity * 10.0;
      
      // Z축 인풋 수치에 따라 이미지 가로세로 크기가 링 뒤쪽에서 유기적으로 주행 줌인/줌아웃
      let defaultBgScale = 14.5;
      let calculatedScale = defaultBgScale * (1.0 + (offZ * sensitivity));
      this.bgMesh.scale.set(calculatedScale, calculatedScale, 1.0);
    }

    // 💡 [배경 자산 마운팅]: 사진이 들어오는 즉시 3D 공간의 독립 전용 레이어에 수혈
    const targetImg = window.currentUploadedImageElement;
    if (targetImg && targetImg !== this.lastBgImage) {
      if (this.bgTexture) this.bgTexture.dispose();
      this.bgTexture = new THREE.Texture(targetImg);
      this.bgTexture.minFilter = THREE.LinearFilter;
      this.bgTexture.magFilter = THREE.LinearFilter;
      this.bgTexture.needsUpdate = true;
      this.lastBgImage = targetImg;
      
      // 독립 플레이트 활성화
      this.bgMeshMaterial.map = this.bgTexture;
      this.bgMeshMaterial.visible = true;
      this.bgMeshMaterial.needsUpdate = true;
      this.scene.background = null; 
    } else if (!targetImg && this.lastBgImage) {
      this.bgMeshMaterial.visible = false;
      this.scene.background = new THREE.Color(0x04050a);
      this.lastBgImage = null;
    }

    // 시스템 시스템 진단 노드 알림
    if (!this.lastTime) this.lastTime = performance.now();
    let now = performance.now();
    let fps = Math.round(1000 / (now - this.lastTime));
    this.lastTime = now;

    let shapeModeText = this.uiSettings.seed % 3 === 1 ? "Squares" : this.uiSettings.seed % 3 === 2 ? "Circles" : "Mixed";
    window.sketchDiagnostics = {
      fps: isNaN(fps) || fps > 100 ? 30 : fps,
      particleCount: this.totalButtons + " Matrix Buttons",
      isCovering: false,
      activeFunction: targetImg ? "Matrix[BG_Calibrating_Active]" : "Matrix[Pure_Geometry]"
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
    
    if (this.bgMesh) {
      this.scene.remove(this.bgMesh);
      this.bgMeshMaterial.dispose();
    }

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
