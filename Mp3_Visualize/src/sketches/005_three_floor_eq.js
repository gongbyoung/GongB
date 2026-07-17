/**
 * src/sketches/005_three_floor_eq.js
 * - [버전] Ver 4.8 (하이브리드 둥근 사각형-원형 프레임 캘리브레이션 완결판)
 * - 버그 완치: 원형 프레임에 둥근 사각형 에셋이 들어가 찌그러지던 현상을 shapeMap 개별 매핑으로 완벽 해결
 * - 셰이더 마스킹: 셰이더 내부에서 Rounded Box SDF 및 Circle 마스크를 구동하여 검은 외곽 여백을 100% 원천 증발 시공
 * - 7대 모션 액션: 셔플(Seed) 변경 시 32개 버튼에 스피커 펄스, 회전, 리플 등 특수 효과 무작위 매핑 유지
 */

export default class ThreeFloorEqualizer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    this.matrixButtons = [];
    this.numCols = 4;
    this.numRows = 8;
    this.totalButtons = 32;

    this.bgTexture = null;
    this.lastBgImage = null;
    this.lastTime = 0;

    // 💡 [VFX 아틀라스 셰이프 마스터 맵]: 원본 이미지와 1:1 대응되는 도형 락인 정보 (0: 원형, 1: 둥근 사각형)
    this.shapeMap = [
      0, 0, 0, 0, // 1층: 전부 원형
      0, 1, 0, 0, // 2층: 2열 주황 기타 사각형
      0, 0, 1, 1, // 3층: 3열 보라 카드, 4열 주황 가로팩 사각형
      0, 0, 0, 0, // 4층: 전부 원형
      0, 0, 1, 0, // 5층: 3열 빨강 스피커 사각형
      0, 0, 0, 0, // 6층: 전부 원형
      0, 0, 0, 0, // 7층: 전부 원형
      0, 0, 0, 0  // 8층: 전부 원형
    ];

    this.sharedGeometries = []; // 중복 메모리 누수 방지용 공유 가드

    this.uiSettings = {
      seed: 42,
      scatter: 22,
      style: 'neon', 
      glow: 85,
      gain: 100,
      gauge: 50,
      customColors: { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' }
    };

    this.version = "005호 Neon Hybrid Slicer Ver 4.8";
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

  // 💡 [수학적 하이엔드 설계]: 네온 링과 완벽히 호환되는 속 빈 둥근 사각형 격자 프레임 제작기
  createRoundedRingGeometry(w, h, r, thickness) {
    const shape = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    
    // 외곽 라인 (Counter-Clockwise)
    shape.moveTo(x, y + r);
    shape.lineTo(x, y + h - r);
    shape.quadraticCurveTo(x, y + h, x + r, y + h);
    shape.lineTo(x + w - r, y + h);
    shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    shape.lineTo(x + w, y + r);
    shape.quadraticCurveTo(x + w, y, x + w - r, y);
    shape.lineTo(x + r, y);
    shape.quadraticCurveTo(x, y, x, y + r);

    // 내부 구멍 라인 (Clockwise)
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
    // 이전 자원 완전 릴리즈
    this.matrixButtons.forEach(btn => {
      this.scene.remove(btn.group);
      btn.materials.forEach(m => m.dispose());
    });
    if (this.sharedGeometries) {
      this.sharedGeometries.forEach(g => g.dispose());
    }
    this.matrixButtons = [];
    this.sharedGeometries = [];

    let sRandom = this.uiSettings.seed;

    let baseC1 = new THREE.Color(), baseC2 = new THREE.Color();
    if (this.uiSettings.style === 'monochrome') {
      baseC1.set('#ffffff'); baseC2.set('#999999');
    } else if (this.uiSettings.style === 'neon') {
      baseC1.set('#ff0055'); baseC2.set('#00ffcc');
    } else if (this.uiSettings.style === 'pastel') {
      baseC1.set('#121b29'); baseC2.set('#dba494'); 
    } else if (this.uiSettings.style === 'custom') {
      baseC1.set(this.uiSettings.customColors.gas1);
      baseC2.set(this.uiSettings.customColors.gas2);
    } else {
      baseC1.setRGB(0.9, 0.1, 0.4); baseC2.setRGB(0.1, 0.9, 0.6);
    }

    // 최적화용 원천 지오메트리 셋 수립
    const ringGeo = new THREE.RingGeometry(0.55, 0.6, 32);
    const roundedRingGeo = this.createRoundedRingGeometry(1.12, 1.12, 0.24, 0.05);
    const innerPlaneGeo = new THREE.PlaneGeometry(0.95, 0.95);
    
    const rippleCircleGeo = new THREE.RingGeometry(0.61, 0.64, 32);
    const rippleSquareGeo = this.createRoundedRingGeometry(1.22, 1.22, 0.28, 0.04);

    this.sharedGeometries.push(ringGeo, roundedRingGeo, innerPlaneGeo, rippleCircleGeo, rippleSquareGeo);

    for (let i = 0; i < this.totalButtons; i++) {
      const col = i % this.numCols;
      const row = Math.floor(i / this.numCols);

      const btnGroup = new THREE.Group();
      const matList = [];

      sRandom = this.seededRandom(sRandom) * 1000;
      let modeRand = this.seededRandom(sRandom + 2);

      let assignedActionMode = Math.floor(modeRand * 7) + 1; 

      let blendRatio = i / (this.totalButtons - 1);
      let btnThemeColor = baseC1.clone().lerp(baseC2, blendRatio);
      if (this.uiSettings.style === 'full-random') {
        btnThemeColor.setHSL(this.seededRandom(sRandom + 5), 0.9, 0.6);
      }

      // 💡 [도형 분기 판독]: 현재 칸이 사각형 슬라이싱 대상인지 실시간 판정
      const isSquareType = this.shapeMap[i] === 1;

      const lineMat = new THREE.LineBasicMaterial({
        color: btnThemeColor,
        transparent: true,
        opacity: 0.9
      });

      // 판정에 따라 알맞은 3D 네온 외곽 프레임 장착
      const outerRing = new THREE.Mesh(isSquareType ? roundedRingGeo : ringGeo, lineMat);
      btnGroup.add(outerRing);

      // 💡 [GPU 셰이더 마스크 연산 단면 시공]: 둥근 사각형과 원형을 경계 바깥으로 완전 Discard 컷
      const sliceShaderMat = new THREE.ShaderMaterial({
        uniforms: {
          u_texture: { value: new THREE.Texture() },
          u_hasTexture: { value: 0.0 },
          u_uvOffset: { value: new THREE.Vector2(0, 0) }, 
          u_uvScale: { value: new THREE.Vector2(1.0 / 4.0, 1.0 / 8.0) },
          u_color: { value: btnThemeColor.clone() },
          u_glow: { value: 1.0 },
          u_opacity: { value: 1.0 },
          u_invert: { value: 0.0 },
          u_fillMode: { value: 0.0 },
          u_shapeType: { value: isSquareType ? 1.0 : 0.0 } // 0.0: 원형 마스크, 1.0: 둥근 사각 마스크
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D u_texture;
          uniform float u_hasTexture;
          uniform vec2 u_uvOffset;
          uniform vec2 u_uvScale;
          uniform vec3 u_color;
          uniform float u_glow;
          uniform float u_opacity;
          uniform float u_invert;
          uniform float u_fillMode;
          uniform float u_shapeType;
          varying vec2 vUv;

          // 모서리가 둥근 사각형을 픽셀 단위로 도려내는 SDF 공식
          float roundedBoxSDF(vec2 p, vec2 b, float r) {
              vec2 d = abs(p) - b + vec2(r);
              return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
          }

          void main() {
            // 💡 [원천 기술]: 3D 테두리 바깥으로 삐져나가는 사각형 이미지의 검은 여백을 실시간 삭제
            if (u_shapeType > 0.5) {
              vec2 p = vUv - vec2(0.5);
              float d = roundedBoxSDF(p, vec2(0.45), 0.16);
              if (d > 0.0) discard; 
            } else {
              float d = length(vUv - vec2(0.5));
              if (d > 0.47) discard; 
            }

            vec4 finalTex = vec4(1.0);
            if (u_hasTexture > 0.5) {
              vec2 slicedUV = vUv * u_uvScale + u_uvOffset;
              finalTex = texture2D(u_texture, slicedUV);
              
              if (u_invert > 0.5) {
                finalTex.rgb = 1.0 - finalTex.rgb;
              }
              finalTex.rgb *= u_color * u_glow;
              finalTex.a *= u_opacity;
            } else {
              float d = length(vUv - vec2(0.5));
              float ring = smoothstep(0.02, 0.0, abs(d - 0.28));
              float core = smoothstep(0.08, 0.0, d);
              finalTex = vec4(u_color * u_glow, (ring + core * u_fillMode) * u_opacity);
            }
            if (finalTex.a < 0.02) discard;
            gl_FragColor = finalTex;
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      const innerIconMesh = new THREE.Mesh(innerPlaneGeo, sliceShaderMat);
      btnGroup.add(innerIconMesh);

      // 리플 링 역시 셰이프 속성에 맞춰 대응 장착
      const rippleMat = lineMat.clone();
      rippleMat.opacity = 0.0;
      const rippleMesh = new THREE.Mesh(isSquareType ? rippleSquareGeo : rippleCircleGeo, rippleMat);
      btnGroup.add(rippleMesh);

      matList.push(lineMat, sliceShaderMat, rippleMat);
      this.scene.add(btnGroup);

      let computedIndex = Math.floor(THREE.MathUtils.mapLinear(i, 0, this.totalButtons, 2, 180));

      this.matrixButtons.push({
        group: btnGroup,
        inner: innerIconMesh,
        ripple: rippleMesh,
        rippleMaterial: rippleMat,
        shaderMaterial: sliceShaderMat,
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

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const aspect = width / height;

    if (aspect < 1.0) {
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, 11.5 / (aspect * 1.05), 0.1);
    } else {
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, 10.5, 0.1);
    }
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    // 관제탑 X, Y, Z 눈금 계수 확보
    let offX = 0, offY = 0, offZ = 0;
    const elX = document.getElementById('num-offset-x');
    const elY = document.getElementById('num-offset-y');
    const elZ = document.getElementById('num-offset-z');
    
    if (elX) offX = parseFloat(elX.value) || 0;
    if (elY) offY = parseFloat(elY.value) || 0;
    if (elZ) offZ = parseFloat(elZ.value) || 0;

    // 💡 편안한 타이핑 조절을 위해 실시간 연산 오프셋 감도를 정확히 1/50인 0.02 배율로 감축 조율
    const sensitivity = 0.02; 
    let microX = offX * sensitivity;
    let microY = offY * sensitivity;
    let microZ = offZ * sensitivity;

    // 업로드 아틀라스 이미지 감지 파이프라인
    const targetImg = window.currentUploadedImageElement;
    if (targetImg && targetImg !== this.lastBgImage) {
      if (this.bgTexture) this.bgTexture.dispose();
      this.bgTexture = new THREE.Texture(targetImg);
      this.bgTexture.minFilter = THREE.LinearFilter;
      this.bgTexture.magFilter = THREE.LinearFilter;
      this.bgTexture.needsUpdate = true;
      this.lastBgImage = targetImg;

      this.matrixButtons.forEach(btn => {
        btn.shaderMaterial.uniforms.u_texture.value = this.bgTexture;
        btn.shaderMaterial.uniforms.u_hasTexture.value = 1.0;
        btn.shaderMaterial.needsUpdate = true;
      });
    } else if (!targetImg && this.lastBgImage) {
      this.matrixButtons.forEach(btn => {
        btn.shaderMaterial.uniforms.u_hasTexture.value = 0.0;
        btn.shaderMaterial.needsUpdate = true;
      });
      this.lastBgImage = null;
    }

    // 진단 HUD 연동
    if (!this.lastTime) this.lastTime = performance.now();
    let now = performance.now();
    let fps = Math.round(1000 / (now - this.lastTime));
    this.lastTime = now;

    window.sketchDiagnostics = {
      fps: isNaN(fps) || fps > 100 ? 30 : fps,
      particleCount: this.totalButtons + " Calibrated Buttons",
      isCovering: false,
      activeFunction: targetImg ? "Matrix[SDF_Hybrid_Masking]" : "Matrix[Placeholder]"
    };

    const time = Date.now() * 0.001;

    let scatterRaw = this.uiSettings.scatter > 5 ? this.uiSettings.scatter : this.uiSettings.scatter * 10;
    let layoutSpacingX = THREE.MathUtils.mapLinear(scatterRaw, 5, 50, 1.45, 3.0);
    let layoutSpacingY = THREE.MathUtils.mapLinear(scatterRaw, 5, 50, 0.95, 1.7);

    let glowRaw = this.uiSettings.glow > 5 ? this.uiSettings.glow : this.uiSettings.glow * 100;
    let glowFactor = THREE.MathUtils.mapLinear(glowRaw, 10, 250, 0.4, 3.8);

    let volumeGainScale = this.uiSettings.gain > 5 ? this.uiSettings.gain / 100.0 : this.uiSettings.gain;

    this.matrixButtons.forEach((btn) => {
      let finalX = (btn.colPos - (this.numCols - 1) * 0.5) * layoutSpacingX;
      let finalY = ((this.numRows - 1) * 0.5 - btn.rowPos) * layoutSpacingY;
      btn.group.position.set(finalX, finalY, 0);

      // 💡 [정밀 UV 오프셋 시공]: 1/50 정밀 스냅샷 계수가 반영된 조각 절단
      let finalUvOffsetX = (btn.colPos / 4.0) + microX;
      let finalUvOffsetY = ((7.0 - btn.rowPos) / 8.0) + microY;
      
      let finalUvScaleX = (1.0 / 4.0) * (1.0 + microZ);
      let finalUvScaleY = (1.0 / 8.0) * (1.0 + microZ);

      btn.shaderMaterial.uniforms.u_uvOffset.value.set(finalUvOffsetX, finalUvOffsetY);
      btn.shaderMaterial.uniforms.u_uvScale.value.set(finalUvScaleX, finalUvScaleY);

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

      btn.shaderMaterial.uniforms.u_glow.value = glowFactor;
      btn.shaderMaterial.uniforms.u_opacity.value = 0.3 + freqIntensity * 0.7;
      btn.shaderMaterial.uniforms.u_invert.value = 0.0;
      btn.shaderMaterial.uniforms.u_fillMode.value = 0.0;

      btn.materials[0].opacity = 0.3 + freqIntensity * 0.6; 

      switch (btn.actionMode) {
        case 1:
          btn.group.scale.setScalar(1.0 + freqIntensity * 0.45);
          break;
        case 2:
          btn.shaderMaterial.uniforms.u_glow.value = glowFactor * (1.0 + freqIntensity * 3.2);
          break;
        case 3:
          if (freqIntensity > 0.28) btn.shaderMaterial.uniforms.u_invert.value = 1.0;
          break;
        case 4:
          btn.inner.rotation.z = freqIntensity * Math.PI * 1.0;
          break;
        case 5:
          btn.shaderMaterial.uniforms.u_fillMode.value = 1.0;
          btn.shaderMaterial.uniforms.u_opacity.value = THREE.MathUtils.clamp(freqIntensity * 1.2, 0.1, 0.95);
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
      this.scene.remove(btn.group);
      btn.materials.forEach(m => m.dispose());
    });
    
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
