/**
 * src/sketches/018_cloud.js
 * - [버전] Ver 3.0 다중 레이어 복합 구름 & 5대 감성 스카이 스케치
 * - 스펙 매핑:
 * 1) Shuffle (1~500): 1~100(단일), 101~200(2개), 201~300(5개+), 301~400(10개+), 401~500(20개+) 복합 구름 믹싱
 * 2) Range (Scatter): 구름의 밀도 및 조밀도
 * 3) Scale (Glow): 구름 크기 줌 스케일
 * 4) Gauge: 음악 주파수/비트 반응 감도
 * 5) Volume (Gain): 구름 색의 진함 (명암 대비 및 색상 농도)
 * 6) Color Style: 흰색 하늘색, 노을빛, 일출, 비구름, 밤에구름 완전 지원
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
    this.version = "018호 복합 구름 Ver 3.0";

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
      
      // 관제탑 슬라이더 매핑 유니폼
      uniform float u_seed;         // Shuffle: 구름 씨드
      uniform float u_numLayers;    // Shuffle 범위 기반 구름 레이어 개수 (1, 2, 5~25)
      uniform float u_scatter;      // Range: 구름 밀도
      uniform float u_glowScale;    // Scale: 구름 크기
      uniform float u_gauge;        // Gauge: 주파수 반응도
      uniform float u_volumeGain;   // Volume: 구름 색의 진함

      // 컬러 세트 유니폼
      uniform vec3 u_skyZenith;
      uniform vec3 u_skyHorizon;
      uniform vec3 u_cloudLight;
      uniform vec3 u_cloudShadow;

      // 배경 이미지 연동
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

        // 원근 시점 매핑
        float horizonOffset = st.y + 0.38;
        if (horizonOffset <= 0.001) horizonOffset = 0.001;
        vec2 skyCoord = vec2(st.x / horizonOffset, 1.0 / horizonOffset);

        // 1. Scale (Glow): 구름 크기 줌 조절 (기본 크기 확장)
        float zoomScale = mix(0.75, 0.12, clamp(u_glowScale, 0.0, 2.0));
        vec2 baseUV = skyCoord * zoomScale;

        // 바람 이동
        float windSpeed = u_time * 0.025;

        // 2. Shuffle (1~500): 1~25개 복합 구름 레이어 합성
        float accumulatedCloud = 0.0;
        
        for (int i = 0; i < 25; i++) {
          float fi = float(i) + 1.0;
          if (fi > u_numLayers) break;

          // 레이어별 독립 난수 오프셋 계산
          vec2 layerOffset = vec2(
            sin(fi * 13.57 + u_seed * 0.012) * 28.4,
            cos(fi * 27.89 + u_seed * 0.012) * 34.1
          );

          vec2 layerUV = baseUV * (1.0 + (fi - 1.0) * 0.12) + layerOffset + vec2(windSpeed * (0.8 + fi * 0.04), windSpeed * 0.05);
          float n = fbm(layerUV);
          
          // 구름 오버랩 합성 (Max Blend)
          accumulatedCloud = max(accumulatedCloud, n);
        }

        // 3. Range (Scatter): 구름 밀도 (Density Tightness)
        float densityThreshold = mix(0.55, 0.20, clamp(u_scatter, 0.0, 1.0));
        
        // 4. Gauge: 주파수/음악 비트 반응 부피 팽창
        float bassExpansion = u_bass * u_gauge * 0.25;
        
        float finalDensity = smoothstep(densityThreshold - bassExpansion, densityThreshold + 0.35, accumulatedCloud);

        // 5. Volume (Gain): 구름 색의 진함 / 명암 대비
        float colorRichness = clamp(u_volumeGain, 0.2, 2.5);

        // 6. 하늘 그라데이션 및 색상 합성
        float skyGradFactor = clamp(st.y + 0.5, 0.0, 1.0);
        vec3 currentSky = mix(u_skyHorizon, u_skyZenith, skyGradFactor);

        // 배경 이미지 업로드 시 합성
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

        // 구름 음영 및 빛 산란 연산
        float lightSlope = fbm(baseUV + vec2(0.03, 0.03)) - accumulatedCloud;
        float shadowFactor = clamp(0.40 + lightSlope * (2.0 * colorRichness), 0.0, 1.0);

        // 구름 색상 명암 및 진함 연산 적용
        vec3 shadowCol = mix(vec3(0.0), u_cloudShadow, clamp(colorRichness, 0.4, 1.5));
        vec3 cloudColor = mix(shadowCol, u_cloudLight, shadowFactor);
        cloudColor += vec3(u_bass * u_gauge * 0.15); // 비트 반사 광채

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

  init() {
    this.resize();
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

    // 관제탑 슬라이더 값 로드
    const globalSettings = window.cosmicEngineSettings || {};
    const seed = globalSettings.seed ?? 42;
    const scatterVal = globalSettings.scatterExponent ?? 1.8;
    const glowVal = globalSettings.glowIntensity ?? 0.85;
    const gainVal = globalSettings.audioGain ?? 1.0;
    const gaugeVal = globalSettings.gaugeValue ?? 0.5;

    // 💡 [Shuffle 구름 개수 수식]: 1~100(1개), 101~200(2개), 201~300(5~9개), 301~400(10~19개), 401~500(20~25개)
    let numLayers = 1.0;
    if (seed <= 100) {
      numLayers = 1.0;
    } else if (seed <= 200) {
      numLayers = 2.0;
    } else if (seed <= 300) {
      numLayers = 5.0 + Math.floor(((seed - 200) / 100.0) * 4.99);
    } else if (seed <= 400) {
      numLayers = 10.0 + Math.floor(((seed - 300) / 100.0) * 9.99);
    } else {
      numLayers = 20.0 + Math.floor(((seed - 400) / 100.0) * 5.99);
    }

    // 💡 [컬러 스타일 5대 팔레트 다이렉트 디코딩]
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
        colorStyle = 'white_blue'; // 기본: 흰색 하늘색 (Neon / idx 0)
      }
    }

    // 팔레트 세부 RGB 구성
    let skyZenith = [0.12, 0.45, 0.88];
    let skyHorizon = [0.65, 0.82, 0.98];
    let cloudLight = [1.0, 1.0, 1.0];
    let cloudShadow = [0.48, 0.55, 0.68];

    switch(colorStyle) {
      case 'white_blue': // 1. 흰색 하늘색
        skyZenith = [0.12, 0.45, 0.88];
        skyHorizon = [0.65, 0.82, 0.98];
        cloudLight = [1.0, 1.0, 1.0];
        cloudShadow = [0.48, 0.55, 0.68];
        break;

      case 'sunset': // 2. 노을빛구현 구름
        skyZenith = [0.18, 0.08, 0.32];
        skyHorizon = [0.95, 0.42, 0.18];
        cloudLight = [1.0, 0.78, 0.35];
        cloudShadow = [0.42, 0.18, 0.28];
        break;

      case 'sunrise': // 3. 일출에 구름
        skyZenith = [0.22, 0.25, 0.48];
        skyHorizon = [0.98, 0.65, 0.48];
        cloudLight = [1.0, 0.88, 0.75];
        cloudShadow = [0.38, 0.30, 0.45];
        break;

      case 'rain': // 4. 비구름
        skyZenith = [0.08, 0.10, 0.15];
        skyHorizon = [0.22, 0.26, 0.32];
        cloudLight = [0.55, 0.58, 0.62];
        cloudShadow = [0.12, 0.14, 0.18];
        break;

      case 'night': // 5. 밤에구름
        skyZenith = [0.02, 0.04, 0.10];
        skyHorizon = [0.08, 0.12, 0.22];
        cloudLight = [0.72, 0.82, 0.95];
        cloudShadow = [0.05, 0.08, 0.15];
        break;
    }

    let bassVal = 0.0;
    if (audioData && typeof audioData.bass === 'number') {
      bassVal = audioData.bass;
    }

    const gl = this.gl;
    gl.useProgram(this.program);

    // 배경 이미지 바인딩
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

    // 슬라이더 유니폼 전송
    gl.uniform1f(this.uniforms.u_seed, seed);
    gl.uniform1f(this.uniforms.u_numLayers, numLayers);
    gl.uniform1f(this.uniforms.u_scatter, scatterVal);
    gl.uniform1f(this.uniforms.u_glowScale, glowVal);
    gl.uniform1f(this.uniforms.u_gauge, gaugeVal);
    gl.uniform1f(this.uniforms.u_volumeGain, gainVal);

    // 컬러 유니폼 전송
    gl.uniform3fv(this.uniforms.u_skyZenith, skyZenith);
    gl.uniform3fv(this.uniforms.u_skyHorizon, skyHorizon);
    gl.uniform3fv(this.uniforms.u_cloudLight, cloudLight);
    gl.uniform3fv(this.uniforms.u_cloudShadow, cloudShadow);

    // 텍스처 전송
    gl.uniform1i(this.uniforms.u_bgTexture, 0);
    gl.uniform1f(this.uniforms.u_hasBgTexture, hasBg);
    gl.uniform2f(this.uniforms.u_imageResolution, imgW, imgH);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Clouds [Layers:${Math.round(numLayers)} / Style:${colorStyle}]`,
      isCovering: true,
      activeFunction: "Cloud[MultiLayer_5Styles_v3.0]"
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.container.removeChild(this.canvas);
    }
    this.gl = null;
    this.canvas = null;
  }
}
