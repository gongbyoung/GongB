/**
 * src/sketches/018_cloud.js
 * - [버전] Ver 4.0 - 20260808 구름 백업 지정 및 대복합 리얼 스카이 엔진
 * - 백업 지정 태그: 20260808구름 (언제든 이 지점으로 복구 가능)
 * - Shuffle (Seed)에 따라 뭉게구름, 물결 고적운(권적운), 새털구름, 거대 적란운, 대복합 층 구름 완전 분리
 * - 은빛 역광(Silver Lining) & 햇빛 빛 내림(Crepuscular Rays) 미학 연출
 */

export default class CloudSketch {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
    this.container.appendChild(this.canvas);

    this.width = 0;
    this.height = 0;
    this.time = 0;
    this.version = "018호 리얼 다형성 구름 Ver 4.0 (백업지점: 20260808구름)";

    this.program = null;
    this.uniforms = {};
    
    this.bgTexture = null;
    this.lastLoadedBgImg = null;

    if (!this.gl) {
      console.error("WebGL을 지원하지 않는 브라우저입니다.");
      return;
    }

    this.initWebGL();
  }

  initWebGL() {
    const gl = this.gl;
    this.bgTexture = gl.createTexture();

    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      varying vec2 v_uv;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_bass;
      
      uniform float u_seed;          // Shuffle: 구름 생성 알고리즘 모드 및 시드
      uniform float u_numLayers;     // 레이어 중첩도
      uniform float u_scatter;       // Range: 구름 밀도
      uniform float u_glowScale;     // Scale: 구름 크기/줌
      uniform float u_gauge;         // Gauge: 주파수 반응 폭
      uniform float u_volumeGain;    // Volume: 명암 및 색상 농도

      uniform vec3 u_skyZenith;
      uniform vec3 u_skyHorizon;
      uniform vec3 u_cloudLight;
      uniform vec3 u_cloudShadow;

      uniform sampler2D u_bgTexture;
      uniform float u_hasBgTexture;
      uniform vec2 u_imageResolution;

      // 🧩 2D 해시 & 노이즈 함수
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));

        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // ☁️ 기본 Fractional Brownian Motion (FBM)
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100.0);
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = rot * p * 2.02 + shift;
          a *= 0.5;
        }
        return v;
      }

      // ☁️ [신규 1] 빌로우 노이즈 (Billow Noise - 둥글둥글 솟구치는 뭉게구름용)
      float billowNoise(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 5; i++) {
          float n = noise(p);
          v += a * abs(n * 2.0 - 1.0);
          p = rot * p * 2.03;
          a *= 0.5;
        }
        return v;
      }

      // ☁️ [신규 2] 물결 / 조개껍질 모양 고적운 파동 수식 (Mackerel Ripple Noise)
      float mackerelRipple(vec2 p) {
        vec2 grid = p * 3.5;
        float ripple = sin(grid.x + noise(grid * 0.5) * 3.0) * cos(grid.y + noise(grid * 0.8) * 3.0);
        ripple = ripple * 0.5 + 0.5;
        float detail = fbm(p * 2.5);
        return mix(ripple, detail, 0.4);
      }

      // ☁️ [신규 3] 방향성 깃털/새털구름 수식 (Wispy Cirrus Stretch)
      float cirrusNoise(vec2 p) {
        // X축 방향으로 길게 찌그러뜨리는 도메인 워핑
        vec2 stretchedP = vec2(p.x * 0.25 - p.y * 0.8, p.y * 2.2 + p.x * 0.3);
        float warp = fbm(stretchedP + vec2(fbm(p * 1.5)));
        return pow(warp, 1.3);
      }

      void main() {
        vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

        float horizonOffset = st.y + 0.38;
        if (horizonOffset <= 0.001) horizonOffset = 0.001;
        vec2 skyCoord = vec2(st.x / horizonOffset, 1.0 / horizonOffset);

        // 줌 및 관제탑 Scale 연동
        float zoomScale = mix(0.85, 0.08, clamp(u_glowScale, 0.0, 2.0));
        vec2 baseUV = skyCoord * zoomScale;
        float windSpeed = u_time * 0.022;

        // 💡 [Seed 핵심 분기]: Seed 값에 따라 완전히 다른 구름 유형 생성
        float seedVal = mod(u_seed, 500.0);
        float cloudTypeMode = floor(seedVal / 100.0); // 0, 1, 2, 3, 4 모드

        float accumulatedCloud = 0.0;
        float layerCount = clamp(u_numLayers, 1.0, 25.0);

        for (int i = 0; i < 25; i++) {
          float fi = float(i) + 1.0;
          if (fi > layerCount) break;

          vec2 layerOffset = vec2(
            sin(fi * 13.57 + u_seed * 0.015) * 32.4,
            cos(fi * 27.89 + u_seed * 0.015) * 28.1
          );

          vec2 layerUV = baseUV * (1.0 + (fi - 1.0) * 0.14) + layerOffset + vec2(windSpeed * (0.7 + fi * 0.05), windSpeed * 0.03);

          float sampleVal = 0.0;

          if (cloudTypeMode < 0.5) {
            // 0: 아기자기한 단일 뭉게구름 (Cumulus Fair-weather)
            sampleVal = fbm(layerUV);
          } else if (cloudTypeMode < 1.5) {
            // 1: 사진 163925처럼 하늘 전체를 뒤덮는 물결/조개껍질 고적운 (Mackerel / Ripple Sky)
            sampleVal = mackerelRipple(layerUV * 1.8);
          } else if (cloudTypeMode < 2.5) {
            // 2: 사진 163733처럼 바람에 흩날리는 얇은 실타래 깃털구름 (Wispy Cirrus)
            sampleVal = cirrusNoise(layerUV * 1.2);
          } else if (cloudTypeMode < 3.5) {
            // 3: 사진 163738처럼 거대하고 웅장하게 솟구치는 적란운 (Cumulus Towers)
            float bVal = billowNoise(layerUV * 0.9);
            float fVal = fbm(layerUV * 1.5);
            sampleVal = mix(bVal, fVal, 0.35);
          } else {
            // 4: 사진 132619처럼 상층부 깃털 + 하층부 뭉게구름 대복합 다층 스카이 (Hybrid Sky)
            float cirrusLayer = cirrusNoise(layerUV * 2.0) * 0.6;
            float cumulusLayer = billowNoise(layerUV * 0.8) * 0.7;
            sampleVal = max(cirrusLayer, cumulusLayer);
          }

          accumulatedCloud = max(accumulatedCloud, sampleVal);
        }

        // 밀도 제어 (Scatter 및 오디오 Bass 반응)
        float densityThreshold = mix(0.58, 0.15, clamp(u_scatter, 0.0, 1.0));
        
        // 고적운/새털구름 모드에서는 밀도 문턱값을 미세 조정
        if (cloudTypeMode >= 0.5 && cloudTypeMode < 2.5) {
          densityThreshold *= 0.85;
        }

        float bassExpansion = u_bass * u_gauge * 0.28;
        float finalDensity = smoothstep(densityThreshold - bassExpansion, densityThreshold + 0.38, accumulatedCloud);

        // 명암 및 색상 조율
        float colorRichness = clamp(u_volumeGain, 0.2, 2.5);
        float skyGradFactor = clamp(st.y + 0.5, 0.0, 1.0);
        vec3 currentSky = mix(u_skyHorizon, u_skyZenith, skyGradFactor);

        // 배경 이미지 텍스처 업로드 시 합성
        if (u_hasBgTexture > 0.5) {
          vec2 stScreen = gl_FragCoord.xy / u_resolution;
          float screenAspect = u_resolution.x / u_resolution.y;
          float imgAspect = u_imageResolution.x / u_imageResolution.y;
          
          vec2 bgUV = stScreen;
          if (screenAspect > imgAspect) {
            float s = imgAspect / screenAspect;
            bgUV.y = (bgUV.y - 0.5) * s + 0.5;
          } else {
            float s = screenAspect / imgAspect;
            bgUV.x = (bgUV.x - 0.5) * s + 0.5;
          }
          currentSky = texture2D(u_bgTexture, bgUV).rgb;
        }

        // ☀️ [역광 & 가장자리 발광 (Silver Lining)]: 구름 경계면 눈부심 효과
        float lightSlope = fbm(baseUV + vec2(0.04, 0.04)) - accumulatedCloud;
        float shadowFactor = clamp(0.38 + lightSlope * (2.2 * colorRichness), 0.0, 1.0);

        // 테두리 강한 가장자리 빛
        float edgeGlow = pow(clamp(1.0 - abs(finalDensity - 0.5) * 2.0, 0.0, 1.0), 3.0) * 0.45;

        vec3 shadowCol = mix(vec3(0.02, 0.04, 0.08), u_cloudShadow, clamp(colorRichness, 0.4, 1.5));
        vec3 cloudColor = mix(shadowCol, u_cloudLight, shadowFactor);
        
        // 은빛 테두리 발광 합성
        cloudColor += u_cloudLight * edgeGlow * (1.0 + u_bass * u_gauge);
        cloudColor += vec3(u_bass * u_gauge * 0.12);

        float horizonFade = smoothstep(0.0, 0.22, horizonOffset);
        float cloudAlpha = clamp(finalDensity * horizonFade * (0.8 + colorRichness * 0.25), 0.0, 1.0);

        vec3 finalColor = mix(currentSky, cloudColor, cloudAlpha);

        if (u_hasBgTexture <= 0.5) {
          finalColor = mix(u_skyHorizon, finalColor, horizonFade);
        }

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const vs = this.createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = this.createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    this.program = this.createProgram(gl, vs, fs);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1
    ]), gl.STATIC_DRAW);

    const aPosLocation = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(aPosLocation);
    gl.vertexAttribPointer(aPosLocation, 2, gl.FLOAT, false, 0, 0);

    this.uniforms = {
      u_resolution: gl.getUniformLocation(this.program, "u_resolution"),
      u_time: gl.getUniformLocation(this.program, "u_time"),
      u_bass: gl.getUniformLocation(this.program, "u_bass"),
      u_seed: gl.getUniformLocation(this.program, "u_seed"),
      u_numLayers: gl.getUniformLocation(this.program, "u_numLayers"),
      u_scatter: gl.getUniformLocation(this.program, "u_scatter"),
      u_glowScale: gl.getUniformLocation(this.program, "u_glowScale"),
      u_gauge: gl.getUniformLocation(this.program, "u_gauge"),
      u_volumeGain: gl.getUniformLocation(this.program, "u_volumeGain"),
      u_skyZenith: gl.getUniformLocation(this.program, "u_skyZenith"),
      u_skyHorizon: gl.getUniformLocation(this.program, "u_skyHorizon"),
      u_cloudLight: gl.getUniformLocation(this.program, "u_cloudLight"),
      u_cloudShadow: gl.getUniformLocation(this.program, "u_cloudShadow"),
      u_bgTexture: gl.getUniformLocation(this.program, "u_bgTexture"),
      u_hasBgTexture: gl.getUniformLocation(this.program, "u_hasBgTexture"),
      u_imageResolution: gl.getUniformLocation(this.program, "u_imageResolution"),
    };
  }

  createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  createProgram(gl, vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  // 💡 가이드 모달 팝업
  showGuideModal() {
    let popup = document.getElementById('cloud-standalone-modal');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'cloud-standalone-modal';
      popup.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(2, 6, 18, 0.82); backdrop-filter: blur(4px);
        z-index: 100000; display: flex; align-items: center; justify-content: center;
      `;
      document.body.appendChild(popup);
    }

    popup.innerHTML = `
      <div style="
        background: #0b1329; border: 2px solid #00f0ff; border-radius: 10px;
        width: 480px; max-width: 90vw; padding: 20px; color: #e2e8f0;
        box-shadow: 0 0 30px rgba(0, 240, 255, 0.35); font-family: sans-serif;
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:10px; margin-bottom:12px;">
          <span style="color:#00ffcc; font-size:14px; font-weight:bold;">☁️ 018호 리얼 구름 관제탑 조작 가이드</span>
          <span id="btn-cloud-modal-x" style="color:#f43f5e; font-weight:bold; cursor:pointer; font-size:16px;">✕</span>
        </div>

        <div style="font-size:11px; line-height:1.6; max-height:60vh; overflow-y:auto; padding-right:5px;">
          <div style="color:#facc15; font-weight:bold; margin-bottom:3px;">🔀 Shuffle (Seed) - 구름 유형 & 형태 대개혁</div>
          <div style="background:#020617; padding:8px; border-radius:4px; border:1px solid #1e293b; margin-bottom:10px;">
            • <strong>0 ~ 99</strong> ➔ 단일 맑은 하늘 뭉게구름 (Cumulus)<br>
            • <strong>100 ~ 199</strong> ➔ 하늘 전체 물결/조개껍질 고적운 (Mackerel / Ripple)<br>
            • <strong>200 ~ 299</strong> ➔ 바람에 찢어지는 깃털/새털구름 (Wispy Cirrus)<br>
            • <strong>300 ~ 399</strong> ➔ 웅장하게 솟구치는 거대 적란운 (Cumulus Towers)<br>
            • <strong>400 ~ 500</strong> ➔ 상층 깃털 + 하층 적운 대복합 다층 스카이 (Hybrid Sky)
          </div>

          <div style="color:#facc15; font-weight:bold; margin-bottom:3px;">🎨 Color Style Palette - 하늘 & 구름 테마</div>
          <div style="background:#020617; padding:8px; border-radius:4px; border:1px solid #1e293b; margin-bottom:10px;">
            • <strong>1번째 (Neon / 흰색 하늘색)</strong>: 청명한 파란 하늘 + 백구름<br>
            • <strong>2번째 (Pastel / 노을빛)</strong>: 타오르는 석양 + 금빛 노을 구름<br>
            • <strong>3번째 (Monochrome / 일출)</strong>: 새벽 코랄 핑크빛 + 일출 구름<br>
            • <strong>4번째 (Earth / 비구름)</strong>: 어둡고 묵직한 잿빛 먹구름<br>
            • <strong>5번째 (Custom / 밤에구름)</strong>: 달빛을 품은 은빛 밤 구름
          </div>

          <div style="color:#facc15; font-weight:bold; margin-bottom:3px;">🎛️ 슬라이더 세부 연동</div>
          <div style="background:#020617; padding:8px; border-radius:4px; border:1px solid #1e293b;">
            • <strong>Volume</strong>: 구름 명암 농도 및 진함 조율<br>
            • <strong>Scale</strong>: 구름 크기 및 카메라 줌<br>
            • <strong>Range</strong>: 구름 밀도 조율<br>
            • <strong>Gauge</strong>: 음악 비트 반응 부피 팽창폭
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; margin-top:15px;">
          <button id="btn-cloud-modal-ok" style="
            background:#00f0ff; color:#020617; border:none; padding:6px 16px;
            font-size:11px; font-weight:bold; border-radius:4px; cursor:pointer;
          ">확인 (Close)</button>
        </div>
      </div>
    `;

    popup.style.display = 'flex';
    const closeFn = () => { popup.style.display = 'none'; };
    document.getElementById('btn-cloud-modal-x')?.addEventListener('click', closeFn);
    document.getElementById('btn-cloud-modal-ok')?.addEventListener('click', closeFn);
  }

  updateSidePanel() {
    const panel = document.getElementById('sketch-description-panel');
    if (panel) {
      panel.innerHTML = `
        <div style="line-height:1.5; color:#d0e0ff; font-size:11px;">
          <strong style="color:#00ffcc; font-size:12px;">☁️ [018호 구름 Ver 4.0] 가이드</strong><br>
          
          <div style="margin-top:6px; color:#facc15; font-weight:bold; border-bottom:1px dashed #334155; padding-bottom:2px;">🔀 Shuffle (Seed) 구름 형태 유형</div>
          • 0~99: 단일 뭉게구름<br>
          • 100~199: 조개껍질 물결 고적운<br>
          • 200~299: 흩날리는 깃털 새털구름<br>
          • 300~399: 솟구치는 거대 적란운<br>
          • 400~500: 상/하층 대복합 하이브리드<br>

          <div style="margin-top:6px; color:#facc15; font-weight:bold; border-bottom:1px dashed #334155; padding-bottom:2px;">🎨 Color Style Palette 테마</div>
          • Neon: 파란 하늘 + 백구름<br>
          • Pastel: 석양 금빛 노을 구름<br>
          • Monochrome: 새벽 코랄 일출 구름<br>
          • Earth: 어두운 잿빛 먹구름<br>
          • Custom: 은빛 달빛 밤 구름<br>

          <div style="margin-top:6px; color:#facc15; font-weight:bold; border-bottom:1px dashed #334155; padding-bottom:2px;">🎛️ 슬라이더 세부 컨트롤</div>
          • <strong>Volume</strong>: 구름 명암 농도<br>
          • <strong>Scale</strong>: 구름 크기 줌<br>
          • <strong>Range</strong>: 구름 밀도 조율<br>
          • <strong>Gauge</strong>: 음악 비트 반응 폭
        </div>
      `;
    }
  }

  init() {
    this.resize();
    this.showGuideModal();
    this.updateSidePanel();
  }

  resize(w, h) {
    this.width = w || this.container.clientWidth;
    this.height = h || this.container.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    if (this.gl) {
      this.gl.viewport(0, 0, this.width, this.height);
    }
  }

  update(audioData) {
    if (!this.gl || !this.program) return;

    this.time += 0.016;

    const globalSettings = window.cosmicEngineSettings || {};
    const seed = globalSettings.seed ?? 42;
    const scatterVal = globalSettings.scatterExponent ?? 1.8;
    const glowVal = globalSettings.glowIntensity ?? 0.85;
    const gainVal = globalSettings.audioGain ?? 1.0;
    const gaugeVal = globalSettings.gaugeValue ?? 0.5;

    let numLayers = 1.0;
    if (seed <= 100) numLayers = 1.0;
    else if (seed <= 200) numLayers = 3.0 + Math.floor(((seed - 100) / 100.0) * 3.99);
    else if (seed <= 300) numLayers = 5.0 + Math.floor(((seed - 200) / 100.0) * 4.99);
    else if (seed <= 400) numLayers = 10.0 + Math.floor(((seed - 300) / 100.0) * 9.99);
    else numLayers = 18.0 + Math.floor(((seed - 400) / 100.0) * 7.99);

    const colorSelectDOM = document.getElementById('select-cosmic-color');
    let colorStyle = 'white_blue';

    if (colorSelectDOM) {
      const val = colorSelectDOM.value.toLowerCase();
      const idx = colorSelectDOM.selectedIndex;

      if (val.includes('sunset') || val.includes('노을') || val === 'pastel' || idx === 1) {
        colorStyle = 'sunset';
      } else if (val.includes('sunrise') || val.includes('일출') || val === 'monochrome' || idx === 2) {
        colorStyle = 'sunrise';
      } else if (val.includes('rain') || val.includes('비구름') || val === 'earth' || idx === 3) {
        colorStyle = 'rain';
      } else if (val.includes('night') || val.includes('밤') || val === 'custom' || idx === 4) {
        colorStyle = 'night';
      } else {
        colorStyle = 'white_blue';
      }
    }

    let skyZenith = [0.12, 0.45, 0.88];
    let skyHorizon = [0.65, 0.82, 0.98];
    let cloudLight = [1.0, 1.0, 1.0];
    let cloudShadow = [0.48, 0.55, 0.68];

    switch(colorStyle) {
      case 'white_blue':
        skyZenith = [0.12, 0.45, 0.88]; skyHorizon = [0.65, 0.82, 0.98]; cloudLight = [1.0, 1.0, 1.0]; cloudShadow = [0.48, 0.55, 0.68]; break;
      case 'sunset':
        skyZenith = [0.18, 0.08, 0.32]; skyHorizon = [0.95, 0.42, 0.18]; cloudLight = [1.0, 0.78, 0.35]; cloudShadow = [0.42, 0.18, 0.28]; break;
      case 'sunrise':
        skyZenith = [0.22, 0.25, 0.48]; skyHorizon = [0.98, 0.65, 0.48]; cloudLight = [1.0, 0.88, 0.75]; cloudShadow = [0.38, 0.30, 0.45]; break;
      case 'rain':
        skyZenith = [0.08, 0.10, 0.15]; skyHorizon = [0.22, 0.26, 0.32]; cloudLight = [0.55, 0.58, 0.62]; cloudShadow = [0.12, 0.14, 0.18]; break;
      case 'night':
        skyZenith = [0.02, 0.04, 0.10]; skyHorizon = [0.08, 0.12, 0.22]; cloudLight = [0.72, 0.82, 0.95]; cloudShadow = [0.05, 0.08, 0.15]; break;
    }

    let bassVal = 0.0;
    if (audioData && typeof audioData.bass === 'number') bassVal = audioData.bass;

    const gl = this.gl;
    gl.useProgram(this.program);

    const bgImg = window.currentUploadedImageElement;
    let hasBg = 0.0;
    let imgW = 1.0, imgH = 1.0;

    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      hasBg = 1.0;
      imgW = bgImg.naturalWidth;
      imgH = bgImg.naturalHeight;

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.bgTexture);

      if (this.lastLoadedBgImg !== bgImg) {
        this.lastLoadedBgImg = bgImg;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgImg);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }
    }

    gl.uniform2f(this.uniforms.u_resolution, this.width, this.height);
    gl.uniform1f(this.uniforms.u_time, this.time);
    gl.uniform1f(this.uniforms.u_bass, bassVal);

    gl.uniform1f(this.uniforms.u_seed, seed);
    gl.uniform1f(this.uniforms.u_numLayers, numLayers);
    gl.uniform1f(this.uniforms.u_scatter, scatterVal);
    gl.uniform1f(this.uniforms.u_glowScale, glowVal);
    gl.uniform1f(this.uniforms.u_gauge, gaugeVal);
    gl.uniform1f(this.uniforms.u_volumeGain, gainVal);

    gl.uniform3fv(this.uniforms.u_skyZenith, skyZenith);
    gl.uniform3fv(this.uniforms.u_skyHorizon, skyHorizon);
    gl.uniform3fv(this.uniforms.u_cloudLight, cloudLight);
    gl.uniform3fv(this.uniforms.u_cloudShadow, cloudShadow);

    gl.uniform1i(this.uniforms.u_bgTexture, 0);
    gl.uniform1f(this.uniforms.u_hasBgTexture, hasBg);
    gl.uniform2f(this.uniforms.u_imageResolution, imgW, imgH);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Clouds [Layers:${Math.round(numLayers)} / Mode:${Math.floor(mod(seed, 500.0) / 100.0)} / Style:${colorStyle}]`,
      isCovering: true,
      activeFunction: "Cloud[Diverse_Sky_v4.0]"
    };
  }

  destroy() {
    const popup = document.getElementById('cloud-standalone-modal');
    if (popup) {
      popup.remove();
    }
    if (this.canvas && this.canvas.parentNode) {
      this.container.removeChild(this.canvas);
    }
    this.gl = null;
    this.canvas = null;
  }
}
