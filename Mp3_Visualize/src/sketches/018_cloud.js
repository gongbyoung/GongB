/**
 * src/sketches/018_cloud.js
 * - [버전] Ver 2.0 관제탑 슬라이더 완전 연동 포토리얼 구름 스케치
 * - 연동 매핑 사양:
 * 1) Shuffle (Seed): 구름 시드 노이즈 오프셋 ➔ 구름 모양 및 배치 무작위 변형
 * 2) Range (Scatter): 구름 입자 디테일 & 바람 유동 속도 제어
 * 3) Scale (Glow): 구름 줌 스케일 & 구름 덩어리 크기 조절
 * 4) Volume (Gain): 오디오 음악 비트에 반응하는 구름 부피 팽창 감도
 * 5) Gauge: 구름 커버리지 밀도 (맑은 하늘 ~ 빽빽한 구름)
 * 6) Color Style Palette & Custom: Neon, Monochrome, Pastel, Earth, Custom(가스1, 가스2, 스타 색상) 하늘/구름 컬러 매핑
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
    this.version = "018호 포토리얼 구름 Ver 2.0";

    this.program = null;
    this.uniforms = {};
    
    if (!this.gl) {
      console.error("WebGL을 지원하지 않는 브라우저입니다.");
      return;
    }

    this.initWebGL();
  }

  initWebGL() {
    const gl = this.gl;

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
      uniform float u_gain;

      // 관제탑 슬라이더 유니폼 파라미터
      uniform float u_seed;
      uniform float u_scatter;
      uniform float u_glowScale;
      uniform float u_gaugeDensity;

      // 컬러 세트 유니폼
      uniform vec3 u_skyColor;
      uniform vec3 u_cloudLight;
      uniform vec3 u_cloudShadow;

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
        for (int i = 0; i < 6; i++) {
          v += a * noise(p);
          p = rot * p * 2.02 + shift;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

        // 원근 지평선 매핑
        float horizonOffset = st.y + 0.38;
        if (horizonOffset <= 0.001) horizonOffset = 0.001;

        vec2 skyCoord = vec2(st.x / horizonOffset, 1.0 / horizonOffset);

        // 1. Range (Scatter) - 바람 속도 및 복잡도 제어
        float windSpeed = u_time * (0.015 + u_scatter * 0.02);
        
        // 2. Scale (Glow) - 구름 크기 줌 스케일링
        float zoomScale = mix(0.6, 0.15, clamp(u_glowScale, 0.0, 2.0));
        
        // 3. Shuffle (Seed) - 무작위 구름 위치 및 노이즈 형태 변경 오프셋
        vec2 seedOffset = vec2(u_seed * 1.731, u_seed * 3.141);
        vec2 cloudUV = skyCoord * zoomScale + vec2(windSpeed, windSpeed * 0.12) + seedOffset;

        // fBm 다중 노이즈 합성
        float q = fbm(cloudUV);
        float r = fbm(cloudUV + q + vec2(1.7, 9.2) + u_time * 0.005 * (1.0 + u_scatter));
        float cloudDensity = fbm(cloudUV + r);

        // 4. Gauge & Volume(Gain) - 구름 양(밀도) 및 음악 베이스 반응 폭
        float baseThreshold = mix(0.58, 0.15, clamp(u_gaugeDensity, 0.0, 1.0));
        float bassExpand = u_bass * u_gain * 0.15;
        
        cloudDensity = smoothstep(baseThreshold - bassExpand, baseThreshold + 0.38, cloudDensity);

        // 5. 하늘 및 구름 컬러 합성
        vec3 skyColorZenith = u_skyColor;
        vec3 skyColorHorizon = mix(u_skyColor, vec3(1.0), 0.35);

        float skyGradFactor = clamp(st.y + 0.5, 0.0, 1.0);
        vec3 currentSky = mix(skyColorHorizon, skyColorZenith, skyGradFactor);

        // 입체 광원 산란 연산
        float lightSlope = fbm(cloudUV + vec2(0.03, 0.03)) - cloudDensity;
        float shadowFactor = clamp(0.42 + lightSlope * 2.8, 0.0, 1.0);

        vec3 cloudColor = mix(u_cloudShadow, u_cloudLight, shadowFactor);
        cloudColor += vec3(u_bass * u_gain * 0.12); // 음악 비트 반사 광채

        float horizonFade = smoothstep(0.0, 0.28, horizonOffset);
        float finalCloudAlpha = clamp(cloudDensity * horizonFade, 0.0, 1.0);

        vec3 finalColor = mix(currentSky, cloudColor, finalCloudAlpha * 0.94);
        finalColor = mix(skyColorHorizon, finalColor, horizonFade);

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
      u_gain: gl.getUniformLocation(this.program, "u_gain"),
      u_seed: gl.getUniformLocation(this.program, "u_seed"),
      u_scatter: gl.getUniformLocation(this.program, "u_scatter"),
      u_glowScale: gl.getUniformLocation(this.program, "u_glowScale"),
      u_gaugeDensity: gl.getUniformLocation(this.program, "u_gaugeDensity"),
      u_skyColor: gl.getUniformLocation(this.program, "u_skyColor"),
      u_cloudLight: gl.getUniformLocation(this.program, "u_cloudLight"),
      u_cloudShadow: gl.getUniformLocation(this.program, "u_cloudShadow"),
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

  hexToVec3(hex) {
    if (!hex) return [1, 1, 1];
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return [(num >> 16 & 255) / 255, (num >> 8 & 255) / 255, (num & 255) / 255];
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

    // 관제탑 슬라이더 파라미터 로드
    const globalSettings = window.cosmicEngineSettings || {};
    const seed = globalSettings.seed ?? 42;
    const scatterVal = globalSettings.scatterExponent ?? 1.8;
    const glowVal = globalSettings.glowIntensity ?? 0.85;
    const gainVal = globalSettings.audioGain ?? 1.0;
    const gaugeVal = globalSettings.gaugeValue ?? 0.5;

    const colorSelectDOM = document.getElementById('select-cosmic-color');
    let colorStyle = 'neon';
    if (colorSelectDOM) colorStyle = colorSelectDOM.value.toLowerCase();
    else colorStyle = (globalSettings.colorStyle || 'neon').toLowerCase();

    // 컬러 세트 매핑
    let skyCol = [0.15, 0.45, 0.78];
    let lightCol = [0.98, 0.95, 0.92];
    let shadowCol = [0.42, 0.48, 0.58];

    switch(colorStyle) {
      case 'neon':
        skyCol = [0.03, 0.08, 0.22];
        lightCol = [0.0, 0.95, 1.0];
        shadowCol = [0.08, 0.15, 0.35];
        break;
      case 'monochrome':
        skyCol = [0.08, 0.08, 0.10];
        lightCol = [0.90, 0.90, 0.92];
        shadowCol = [0.22, 0.22, 0.25];
        break;
      case 'pastel':
        skyCol = [0.75, 0.62, 0.72];
        lightCol = [1.0, 0.94, 0.82];
        shadowCol = [0.42, 0.32, 0.48];
        break;
      case 'earth':
        skyCol = [0.18, 0.48, 0.82];
        lightCol = [0.98, 0.96, 0.92];
        shadowCol = [0.38, 0.45, 0.55];
        break;
      case 'custom':
        if (globalSettings.customColors) {
          skyCol = this.hexToVec3(globalSettings.customColors.gas1);
          shadowCol = this.hexToVec3(globalSettings.customColors.gas2);
          lightCol = this.hexToVec3(globalSettings.customColors.star);
        }
        break;
    }

    let bassVal = 0.0;
    if (audioData && typeof audioData.bass === 'number') {
      bassVal = audioData.bass * gainVal;
    }

    const gl = this.gl;
    gl.useProgram(this.program);

    gl.uniform2f(this.uniforms.u_resolution, this.width, this.height);
    gl.uniform1f(this.uniforms.u_time, this.time);
    gl.uniform1f(this.uniforms.u_bass, bassVal);
    gl.uniform1f(this.uniforms.u_gain, gainVal);

    // 슬라이더 유니폼 송신
    gl.uniform1f(this.uniforms.u_seed, seed);
    gl.uniform1f(this.uniforms.u_scatter, scatterVal);
    gl.uniform1f(this.uniforms.u_glowScale, glowVal);
    gl.uniform1f(this.uniforms.u_gaugeDensity, gaugeVal);

    // 컬러 유니폼 송신
    gl.uniform3fv(this.uniforms.u_skyColor, skyCol);
    gl.uniform3fv(this.uniforms.u_cloudLight, lightCol);
    gl.uniform3fv(this.uniforms.u_cloudShadow, shadowCol);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `fBm Sky [Seed:${seed} / Density:${Math.round(gaugeVal*100)}%]`,
      isCovering: true,
      activeFunction: "Cloud[Fully_Interactive_v2.0]"
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
