/**
 * src/sketches/018_cloud.js
 * - [버전] Ver 1.0 원거리 포토리얼리스틱 구름 & 대기 스카이 셰이더
 * - 비주얼 메커니즘:
 * 1) 원근 투영(Perspective Horizon Projection): 지평선 쪽으로 갈수록 구름이 작아지고 촘촘해지는 원거리 하늘 구현
 * 2) fBm (Fractional Brownian Motion) 6중 노이즈: 실제 구름처럼 부드럽고 정밀한 입자 표현
 * 3) 태양광 산란 & 그림자(Sun Rayleigh Scattering): 구름 상단의 밝은 하이라이트와 하단의 입체적 그림자 층
 * 4) 오디오 유기적 연동: 음악의 베이스와 게인에 따라 구름의 밀도와 햇살 라이팅이 입체적으로 반응
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
    this.version = "018호 포토리얼 구름 Ver 1.0";

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

    // 정점 셰이더 (전체 화면 2D 사각형)
    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // 프래그먼트 셰이더 (fBm 노이즈 + 원근 시점 매핑 + 대기 산란 라이팅)
    const fsSource = `
      precision highp float;
      varying vec2 v_uv;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_bass;
      uniform float u_gain;

      // 2D 난수 생성 함수
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      // 부드러운 Value Noise
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

      // fBm (Fractional Brownian Motion) - 6단계 다중 노이즈 합성
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

        // 1. 원거리 원근 투영 (지평선 구름 축소 왜곡)
        // 화면 아래쪽(st.y)으로 갈수록 원근감이 소멸하며 멀리 있는 구름 시점 생성
        float horizonOffset = st.y + 0.38;
        if (horizonOffset <= 0.001) {
          horizonOffset = 0.001; // 음수 연산 차단 방어
        }

        // 지평선 기하학적 맵핑 (멀리 있는 구름일수록 촘촘하게 축소)
        vec2 skyCoord = vec2(st.x / horizonOffset, 1.0 / horizonOffset);

        // 구름 흐름 타임라인 (바람에 천천히 밀려가는 자연스러운 이동)
        float speed = u_time * 0.035;
        vec2 cloudUV = skyCoord * 0.35 + vec2(speed, speed * 0.12);

        // 2. fBm 노이즈로 밀도 및 형태 산출
        float q = fbm(cloudUV);
        float r = fbm(cloudUV + q + vec2(1.7, 9.2) + u_time * 0.008);
        float cloudDensity = fbm(cloudUV + r);

        // 음악 베이스 반응형 부피 팽창
        cloudDensity = smoothstep(0.36 - u_bass * 0.06, 0.76, cloudDensity);

        // 3. 사진 같은 대기 & 스카이 그라데이션
        vec3 skyColorZenith = vec3(0.18, 0.44, 0.78);  // 머리 위 깊은 푸른 하늘
        vec3 skyColorHorizon = vec3(0.65, 0.80, 0.95); // 지평선 밝은 하늘

        float skyGradFactor = clamp(st.y + 0.5, 0.0, 1.0);
        vec3 skyColor = mix(skyColorHorizon, skyColorZenith, skyGradFactor);

        // 4. 입체적 구름 태양광 산란 & 그림자 (Light & Shadow Shading)
        vec3 cloudSunLight = vec3(1.0, 0.98, 0.94);   // 햇빛 받는 상단 (유백색)
        vec3 cloudShadow   = vec3(0.42, 0.48, 0.58);   // 안쪽 음영 (차가운 그림자)

        // 경사면에 따른 입체 음영 연산
        float lightSlope = fbm(cloudUV + vec2(0.03, 0.03)) - cloudDensity;
        float shadowFactor = clamp(0.45 + lightSlope * 2.8, 0.0, 1.0);

        vec3 cloudColor = mix(cloudShadow, cloudSunLight, shadowFactor);
        cloudColor += vec3(u_bass * 0.12); // 비트에 맞춘 미세한 광채 반사

        // 5. 지평선 안개(Haze) 스무딩 & 알파 블렌딩
        float horizonFade = smoothstep(0.0, 0.28, horizonOffset);
        float finalCloudAlpha = clamp(cloudDensity * horizonFade, 0.0, 1.0);

        // 최종 컬러 합성
        vec3 finalColor = mix(skyColor, cloudColor, finalCloudAlpha * 0.92);

        // 지평선 가까이 자연스러운 대기 원근감 필터
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

    const globalSettings = window.cosmicEngineSettings || {};
    const gainScale = globalSettings.audioGain ?? 1.0;

    let bassVal = 0.0;
    if (audioData && typeof audioData.bass === 'number') {
      bassVal = audioData.bass * gainScale;
    }

    const gl = this.gl;
    gl.useProgram(this.program);

    gl.uniform2f(this.uniforms.u_resolution, this.width, this.height);
    gl.uniform1f(this.uniforms.u_time, this.time);
    gl.uniform1f(this.uniforms.u_bass, bassVal);
    gl.uniform1f(this.uniforms.u_gain, gainScale);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: "fBm Procedural Sky & Clouds",
      isCovering: true,
      activeFunction: "Cloud[Photoreal_fBm_Perspective]"
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
