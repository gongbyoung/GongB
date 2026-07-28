/**
 * src/sketches/018_cloud.js
 * - [버전] Ver 3.5 캡슐화 가이드 팝업 & 복합 구름 스카이 스케치
 * - 완전 독립성: main.js를 오염시키지 않고 스케치 자체 라이프사이클(init / destroy)에 맞춰 팝업과 안내 상자를 자동 생성 및 파기함.
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
    this.version = "018호 독립 팝업 구름 Ver 3.5";

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
      
      uniform float u_seed;         // Shuffle: 구름 개수/배치
      uniform float u_numLayers;    // 레이어 개수
      uniform float u_scatter;      // Range: 구름 밀도
      uniform float u_glowScale;    // Scale: 구름 크기
      uniform float u_gauge;        // Gauge: 주파수 반응도
      uniform float u_volumeGain;   // Volume: 구름 색의 진함

      uniform vec3 u_skyZenith;
      uniform vec3 u_skyHorizon;
      uniform vec3 u_cloudLight;
      uniform vec3 u_cloudShadow;

      uniform sampler2D u_bgTexture;
      uniform float u_hasBgTexture;
      uniform vec2 u_imageResolution;

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

      void main() {
        vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

        float horizonOffset = st.y + 0.38;
        if (horizonOffset <= 0.001) horizonOffset = 0.001;
        vec2 skyCoord = vec2(st.x / horizonOffset, 1.0 / horizonOffset);

        float zoomScale = mix(0.75, 0.12, clamp(u_glowScale, 0.0, 2.0));
        vec2 baseUV = skyCoord * zoomScale;
        float windSpeed = u_time * 0.025;

        float accumulatedCloud = 0.0;
        for (int i = 0; i < 25; i++) {
          float fi = float(i) + 1.0;
          if (fi > u_numLayers) break;

          vec2 layerOffset = vec2(
            sin(fi * 13.57 + u_seed * 0.012) * 28.4,
            cos(fi * 27.89 + u_seed * 0.012) * 34.1
          );

          vec2 layerUV = baseUV * (1.0 + (fi - 1.0) * 0.12) + layerOffset + vec2(windSpeed * (0.8 + fi * 0.04), windSpeed * 0.05);
          accumulatedCloud = max(accumulatedCloud, fbm(layerUV));
        }

        float densityThreshold = mix(0.55, 0.20, clamp(u_scatter, 0.0, 1.0));
        float bassExpansion = u_bass * u_gauge * 0.25;
        float finalDensity = smoothstep(densityThreshold - bassExpansion, densityThreshold + 0.35, accumulatedCloud);

        float colorRichness = clamp(u_volumeGain, 0.2, 2.5);

        float skyGradFactor = clamp(st.y + 0.5, 0.0, 1.0);
        vec3 currentSky = mix(u_skyHorizon, u_skyZenith, skyGradFactor);

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

        float lightSlope = fbm(baseUV + vec2(0.03, 0.03)) - accumulatedCloud;
        float shadowFactor = clamp(0.40 + lightSlope * (2.0 * colorRichness), 0.0, 1.0);

        vec3 shadowCol = mix(vec3(0.0), u_cloudShadow, clamp(colorRichness, 0.4, 1.5));
        vec3 cloudColor = mix(shadowCol, u_cloudLight, shadowFactor);
        cloudColor += vec3(u_bass * u_gauge * 0.15);

        float horizonFade = smoothstep(0.0, 0.25, horizonOffset);
        float cloudAlpha = clamp(finalDensity * horizonFade * (0.8 + colorRichness * 0.2), 0.0, 1.0);

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

  // 💡 [스케치 자체 UI 제어 1]: 구름 팝업 생성
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
        width: 460px; max-width: 90vw; padding: 20px; color: #e2e8f0;
        box-shadow: 0 0 30px rgba(0, 240, 255, 0.35); font-family: sans-serif;
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:10px; margin-bottom:12px;">
          <span style="color:#00ffcc; font-size:14px; font-weight:bold;">☁️ 018호 구름 관제탑 조작 가이드</span>
          <span id="btn-cloud-modal-x" style="color:#f43f5e; font-weight:bold; cursor:pointer; font-size:16px;">✕</span>
        </div>

        <div style="font-size:11px; line-height:1.6; max-height:60vh; overflow-y:auto; padding-right:5px;">
          <div style="color:#facc15; font-weight:bold; margin-bottom:3px;">🔀 Shuffle (Seed) - 구름 개수 & 복합 구성</div>
          <div style="background:#020617; padding:8px; border-radius:4px; border:1px solid #1e293b; margin-bottom:10px;">
            • <strong>50 설정</strong> ➔ 깔끔한 단일 덩어리 구름<br>
            • <strong>150 설정</strong> ➔ 2개의 구름이 입체적으로 중첩<br>
            • <strong>250 설정</strong> ➔ 5가지 이상의 구름이 흩어짐<br>
            • <strong>350 설정</strong> ➔ 10가지 이상의 구름이 넓게 분포<br>
            • <strong>450 설정</strong> ➔ 20개 이상의 구름이 하늘 전체를 웅장하게 레이어링
          </div>

          <div style="color:#facc15; font-weight:bold; margin-bottom:3px;">🎨 Color Style Palette - 하늘 & 구름 테마</div>
          <div style="background:#020617; padding:8px; border-radius:4px; border:1px solid #1e293b; margin-bottom:10px;">
            • <strong>1번째 (Neon / 흰색 하늘색)</strong>: 청명한 파란 하늘 + 맑은 백구름<br>
            • <strong>2번째 (Pastel / 노을빛)</strong>: 타오르는 석양 + 금빛 노을 구름<br>
            • <strong>3번째 (Monochrome / 일출)</strong>: 새벽 코랄 핑크빛 + 일출 구름<br>
            • <strong>4번째 (Earth / 비구름)</strong>: 어둡고 묵직한 잿빛 먹구름<br>
            • <strong>5번째 (Custom / 밤에구름)</strong>: 달빛을 품은 은빛 밤 구름
          </div>

          <div style="color:#facc15; font-weight:bold; margin-bottom:3px;">🎛️ 슬라이더 기능 매핑</div>
          <div style="background:#020617; padding:8px; border-radius:4px; border:1px solid #1e293b;">
            • <strong>Volume</strong>: 구름의 진함 및 명암 짙은 정도 조율<br>
            • <strong>Scale</strong>: 구름 크기 줌 조율<br>
            • <strong>Range</strong>: 구름의 밀도 및 조밀함 조율<br>
            • <strong>Gauge</strong>: 음악 비트에 반응하는 부피 폭 조율
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

  // 💡 [스케치 자체 UI 제어 2]: 좌측 설명 패널 자율 주입
  updateSidePanel() {
    const panel = document.getElementById('sketch-description-panel');
    if (panel) {
      panel.innerHTML = `
        <div style="line-height:1.5; color:#d0e0ff; font-size:11px;">
          <strong style="color:#00ffcc; font-size:12px;">☁️ [018호 구름] 관제탑 가이드</strong><br>
          
          <div style="margin-top:6px; color:#facc15; font-weight:bold; border-bottom:1px dashed #334155; padding-bottom:2px;">🔀 Shuffle (Seed) 구름 개수 조율</div>
          • 50: 단일 덩어리 구름<br>
          • 150: 2개 구름 입체 중첩<br>
          • 250: 5가지 이상 구름 흩어짐<br>
          • 350: 10가지 이상 구름 넓게 분포<br>
          • 450: 20개 이상 구름 웅장한 레이어링<br>

          <div style="margin-top:6px; color:#facc15; font-weight:bold; border-bottom:1px dashed #334155; padding-bottom:2px;">🎨 Color Style Palette 하늘/구름 테마</div>
          • 1번째 (Neon): 청명한 파란 하늘 + 맑은 백구름<br>
          • 2번째 (Pastel): 타오르는 석양 + 금빛 노을 구름<br>
          • 3번째 (Monochrome): 새벽 코랄 핑크빛 + 일출 구름<br>
          • 4번째 (Earth): 어둡고 묵직한 잿빛 먹구름<br>
          • 5번째 (Custom): 달빛을 품은 은빛 밤 구름<br>

          <div style="margin-top:6px; color:#facc15; font-weight:bold; border-bottom:1px dashed #334155; padding-bottom:2px;">🎛️ 슬라이더 세부 컨트롤</div>
          • <strong>Volume</strong>: 구름의 진함 및 명암 짙은 정도<br>
          • <strong>Scale</strong>: 구름 크기 줌 조율<br>
          • <strong>Range</strong>: 구름 밀도 및 조밀함<br>
          • <strong>Gauge</strong>: 음악 비트 반응 부피 폭
        </div>
      `;
    }
  }

  init() {
    this.resize();
    // 💡 [구름 스케치가 선택되어 시작될 때만 UI 실행]
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
    else if (seed <= 200) numLayers = 2.0;
    else if (seed <= 300) numLayers = 5.0 + Math.floor(((seed - 200) / 100.0) * 4.99);
    else if (seed <= 400) numLayers = 10.0 + Math.floor(((seed - 300) / 100.0) * 9.99);
    else numLayers = 20.0 + Math.floor(((seed - 400) / 100.0) * 5.99);

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
      particleCount: `Clouds [Layers:${Math.round(numLayers)} / Style:${colorStyle}]`,
      isCovering: true,
      activeFunction: "Cloud[Standalone_UI_v3.5]"
    };
  }

  // 💡 [스케치 자체 UI 제어 3]: 다른 스케치로 교체되어 파기될 때 팝업을 흔적도 없이 삭제
  destroy() {
    const popup = document.getElementById('cloud-standalone-modal');
    if (popup) {
      popup.remove(); // DOM에서 완전 제거
    }
    if (this.canvas && this.canvas.parentNode) {
      this.container.removeChild(this.canvas);
    }
    this.gl = null;
    this.canvas = null;
  }
}
