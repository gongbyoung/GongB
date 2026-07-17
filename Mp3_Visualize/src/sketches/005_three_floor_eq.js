/**
 * src/sketches/005_three_floor_eq.js
 * - [버전] Ver 4.6 (관제탑 X, Y, Z 노브 직결 이미지 슬라이싱 캘리브레이션 완결판)
 * - 보정 개혁: 오른쪽 사이드바의 3D Position Offset (X,Y,Z) 값을 실시간 텍스처 오프셋 제어기로 전사 리인덱싱
 * - 이미지 수혈: z-image-turbo_01103_.jpg 등 업로드된 아틀라스 이미지 격자를 4x8로 정밀 커팅 매핑
 * - 실시간 튜닝 매커니즘:
 *   • X 입력창 : 이미지 조각들의 가로축 자르기 위치 미세 이동 (UV Offset X)
 *   • Y 입력창 : 이미지 조각들의 세로축 자르기 위치 미세 이동 (UV Offset Y)
 *   • Z 입력창 : 각 격자 셀 내부에 채워지는 네온 이미지의 확대/축소 비율 배율화 (UV Scale Zoom)
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

    this.version = "005호 Neon Image Slicer Ver 4.6";
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x04050a, 0.015);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 11);
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

  buildInstrumentMatrix() {
    this.matrixButtons.forEach(btn => {
      this.scene.remove(btn.group);
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
      baseC1.set('#121b29'); baseC2.set('#dba494'); 
    } else if (this.uiSettings.style === 'custom') {
      baseC1.set(this.uiSettings.customColors.gas1);
      baseC2.set(this.uiSettings.customColors.gas2);
    } else {
      baseC1.setRGB(0.9, 0.1, 0.4); baseC2.setRGB(0.1, 0.9, 0.6);
    }

    const ringGeo = new THREE.RingGeometry(0.56, 0.6, 32);
    const innerPlaneGeo = new THREE.PlaneGeometry(0.92, 0.92);
    const rippleGeo = new THREE.RingGeometry(0.61, 0.64, 32);

    for (let i = 0; i < this.totalButtons; i++) {
      const col = i % this.numCols;
      const row = Math.floor(i / this.numCols);

      const btnGroup = new THREE.Group();
      const geomList = [ringGeo, innerPlaneGeo, rippleGeo];
      const matList = [];

      sRandom = this.seededRandom(sRandom) * 1000;
      let modeRand = this.seededRandom(sRandom + 2);

      let assignedActionMode = Math.floor(modeRand * 7) + 1; 

      let blendRatio = i / (this.totalButtons - 1);
      let btnThemeColor = baseC1.clone().lerp(baseC2, blendRatio);
      if (this.uiSettings.style === 'full-random') {
        btnThemeColor.setHSL(this.seededRandom(sRandom + 5), 0.9, 0.6);
      }

      const lineMat = new THREE.LineBasicMaterial({
        color: btnThemeColor,
        transparent: true,
        opacity: 0.9
      });
      const outerRing = new THREE.Mesh(ringGeo, lineMat);
      btnGroup.add(outerRing);

      // 커스텀 셰이더 슬라이서 매립
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
          u_fillMode: { value: 0.0 }
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
          varying vec2 vUv;

          void main() {
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

      const rippleMat = lineMat.clone();
      rippleMat.opacity = 0.0;
      const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
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

    // 💡 [알고리즘 1]: 우측 패널의 X, Y, Z 디바이스 수치 실시간 강제 포착 및 미세 눈금 필터링
    let offX = 0, offY = 0, offZ = 0;
    const elX = document.getElementById('num-offset-x');
    const elY = document.getElementById('num-offset-y');
    const elZ = document.getElementById('num-offset-z');
    
    if (elX) offX = parseFloat(elX.value) || 0;
    if (elY) offY = parseFloat(elY.value) || 0;
    if (elZ) offZ = parseFloat(elZ.value) || 0;

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
      activeFunction: targetImg ? "Matrix[VFX_4x8_Calibrating]" : "Matrix[Placeholder]"
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

      // 💡 [알고리즘 2]: X, Y 축 오프셋 주입 및 Z축을 통한 개별 아틀라스 줌스케일 동적 분사
      let finalUvOffsetX = (btn.colPos / 4.0) + offX;
      let finalUvOffsetY = ((7.0 - btn.rowPos) / 8.0) + offY;
      
      // Z 값이 0일 때 정상 배율(1.0)을 유지하도록 보정 연산
      let finalUvScaleX = (1.0 / 4.0) * (1.0 + offZ);
      let finalUvScaleY = (1.0 / 8.0) * (1.0 + offZ);

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
    this.scene = null; this.camera = null; this.renderer = null;
    this.matrixButtons = [];
  }
}
