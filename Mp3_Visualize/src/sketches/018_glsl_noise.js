/**
 * src/sketches/018_glsl_noise.js
 * - [버전] Ver 1.4 (화면 비율 변경 시 좌상단 쏠림 및 중앙 정렬 버그 완벽 해결 완료)
 * - uProjectionMatrix, uModelViewMatrix 통합으로 렌더링 평면 중심축을 캔버스 정중앙에 완벽 고정
 * - Full, 16:9, 9:16 비율 전환 시 어떠한 오차도 없이 프레임 내부에 칼정렬 보장
 */

export default class GLSLNoiseShaderStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.shaderProgram = null;
    
    // 💡 업데이트 확인 마커
    this.version = "018호 GLSL Liquid Noise Ver 1.4";
    this.time = 0;
    this.isAudioActive = false;
    this.lastSettingsStr = "";
  }

  // 💡 [핵심 버그 수정] p5.js WebGL 고유의 변환 행렬 유니폼을 바인딩하여 쏠림 현상을 원천 차단합니다.
  getVertexShader() {
    return `
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vTexCoord;

      uniform mat4 uModelViewMatrix;
      uniform mat4 uProjectionMatrix;

      void main() {
        vTexCoord = aTexCoord;
        // 정중앙 좌표계를 정확하게 투영 행렬과 매칭시킵니다.
        gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
      }
    `;
  }

  getFragmentShader() {
    return `
      precision highp float;
      varying vec2 vTexCoord;

      uniform float u_time;
      uniform vec3 u_audio; 
      uniform float u_seed;
      uniform float u_scatter;
      uniform float u_glow;
      uniform int u_style;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                   mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }

      float liquidFBM(vec2 p, float midBump) {
        vec2 q = vec2(
          noise(p + vec2(0.0, 0.0) + u_time * 0.06),
          noise(p + vec2(5.2, 1.3) + u_time * 0.05)
        );
        
        float warpStr = 1.5 + (midBump * 3.0);
        vec2 r = vec2(
          noise(p + q * warpStr + vec2(1.7, 9.2) + u_time * 0.1),
          noise(p + q * warpStr + vec2(8.3, 2.8) + u_time * 0.08)
        );
        
        return noise(p + r * (2.0 + u_scatter * 0.05));
      }

      void main() {
        // 정밀 공간 주파수 좌표 고정
        vec2 st = vTexCoord - 0.5;
        float zoom = 1.5 / (0.1 + u_glow * 0.015);
        st *= zoom;

        float low = u_audio.x;
        float mid = u_audio.y;
        float high = u_audio.z;

        float fbmVal = liquidFBM(st * 3.0 + vec2(u_seed * 0.1), mid * 2.0);

        float threshold = 0.35 + (u_scatter / 200.0) - (mid * 0.1);
        float density = max(0.0, fbmVal - threshold);
        float cloudIntensity = clamp(density * 6.5, 0.0, 1.0);

        vec3 skyColor = vec3(0.0);
        vec3 cloudColor = vec3(0.0);

        if (u_style == 0) { 
            skyColor = vec3(0.08, 0.11, 0.16);
            cloudColor = vec3(0.48, 0.50, 0.54);
        } else if (u_style == 1) { 
            vec3 topH = vec3(0.05, 0.31, 0.68);
            vec3 botH = vec3(0.31, 0.58, 0.92);
            skyColor = mix(topH, botH, low);
            cloudColor = vec3(0.98, 0.99, 1.0);
        } else if (u_style == 2) { 
            vec3 dawnTop = vec3(0.21, 0.07, 0.41);
            vec3 dawnBot = vec3(0.92, 0.37, 0.15);
            skyColor = mix(dawnTop, dawnBot, low * 1.2);
            cloudColor = vec3(1.0, 0.86, 0.72);
        } else { 
            skyColor = vec3(0.05, 0.07, 0.1);
            cloudColor = vec3(0.0, 0.9, 1.0);
        }

        vec3 finalColor = mix(skyColor, cloudColor, cloudIntensity);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;
  }

  async init() {
    if (!window.p5) {
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight, p.WEBGL);
        canvas.style('position', 'absolute');
        canvas.style('left', '0px');
        canvas.style('top', '0px');
        canvas.style('z-index', '1');
        
        this.shaderProgram = p.createShader(this.getVertexShader(), this.getFragmentShader());
        p.noLoop();
      };

      p.draw = () => {
        p.clear();
        
        if (this.shaderProgram) {
          p.shader(this.shaderProgram);
          
          const ui = this.getUIParams();
          
          this.shaderProgram.setUniform('u_time', this.time);
          this.shaderProgram.setUniform('u_seed', ui.seed);
          this.shaderProgram.setUniform('u_scatter', ui.scatter);
          this.shaderProgram.setUniform('u_glow', ui.glow);
          
          let styleIdx = 1; 
          if (ui.style.includes('monochrome')) styleIdx = 0;
          else if (ui.style.includes('pastel')) styleIdx = 2;
          else if (ui.style.includes('full-random')) styleIdx = 3;
          this.shaderProgram.setUniform('u_style', styleIdx);

          if (!this.isAudioActive) {
            this.shaderProgram.setUniform('u_audio', [0.3, 0.2, 0.1]);
          }

          p.noStroke();
          // 💡 WebGL 표준 평면 매핑 방식으로 평면을 드로잉하여 좌상단 밀림을 제로화합니다.
          p.rect(-p.width / 2, -p.height / 2, p.width, p.height);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  getUIParams() {
      const settings = window.cosmicEngineSettings || {};
      
      const seedSlider = document.getElementById('slide-cosmic-seed');
      const scatterSlider = document.getElementById('slide-cosmic-scatter');
      const glowSlider = document.getElementById('slide-cosmic-glow');
      const colorSelect = document.getElementById('select-cosmic-color');
      const gainSlider = document.getElementById('slide-cosmic-gain');

      return {
          scatter: scatterSlider ? parseFloat(scatterSlider.value) : 22, 
          glow: glowSlider ? parseFloat(glowSlider.value) : 85, 
          burst: gainSlider ? parseFloat(gainSlider.value) / 100 : 1.0, 
          seed: seedSlider ? parseInt(seedSlider.value) : 42,
          style: colorSelect ? colorSelect.value.toLowerCase() : 'neon'
      };
  }

  resetCanvas(p, isPreview = false) {
    p.redraw(); 
  }

  update(audioData) {
    if (!this.p5Instance || !this.shaderProgram) return;
    let p = this.p5Instance;
    
    const audioEl = document.querySelector('audio');
    let isPlaying = audioEl && !audioEl.paused;

    if (isPlaying || (audioData && audioData.vol > 0.005)) {
        this.isAudioActive = true;
    } else {
        this.isAudioActive = false;
    }

    let low = 0.3; let mid = 0.2; let high = 0.1;
    if (audioData && audioData.raw && audioData.raw.length > 60) {
        low = (audioData.raw[2] + audioData.raw[3]) / 510;
        mid = (audioData.raw[15] + audioData.raw[16]) / 510;
        high = (audioData.raw[55] + audioData.raw[56]) / 510;
    } else if (isPlaying) {
        low = p.noise(p.millis() * 0.001) * 0.5;
        mid = p.noise(p.millis() * 0.002 + 50) * 0.4;
        high = p.noise(p.millis() * 0.003 + 100) * 0.3;
    }

    const ui = this.getUIParams();
    
    // 슬라이더 상태 변경 추적 검사 후 변경 시 렌더 가속 트리거
    let currentSettingsStr = `${ui.seed}-${ui.scatter}-${ui.glow}-${ui.style}-${ui.burst}`;
    if (this.lastSettingsStr !== currentSettingsStr) {
        this.lastSettingsStr = currentSettingsStr;
        this.resetCanvas(p, true);
    }

    this.time += (0.01 + mid * 0.04) * ui.burst;

    p.shader(this.shaderProgram);
    this.shaderProgram.setUniform('u_audio', [low, mid, high]);
    
    p.redraw();
  }

  resize(w, h) {
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
    }
  }

  destroy() {
    if (this.p5Instance) this.p5Instance.remove();
  }
}
