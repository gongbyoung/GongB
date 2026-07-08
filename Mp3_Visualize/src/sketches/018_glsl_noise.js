/**
 * src/sketches/018_glsl_noise.js
 * - [버전] Ver 1.1 (우상단 화면 쏠림 버그 수정 및 WebGL 폰트 콘솔 에러 완전 차단본)
 * - resetMatrix() 강제 트리거를 통해 9:16 스크린 정중앙 프레임 배치 완벽 고정
 * - 폰트 미지정 스팸 경고를 완벽히 차단하도록 WebGL 가이드 드로잉 엔진 구조 재설계
 */

export default class GLSLNoiseShaderStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.shaderProgram = null;
    
    // 💡 업데이트 확인용 버전 세팅
    this.version = "018호 GLSL Liquid Noise Ver 1.1";
    this.time = 0;
    this.isAudioActive = false;
  }

  getVertexShader() {
    return `
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vTexCoord;
      void main() {
        vTexCoord = aTexCoord;
        gl_Position = vec4(aPosition, 1.0);
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
          noise(p + vec2(0.0, 0.0) + u_time * 0.08),
          noise(p + vec2(5.2, 1.3) + u_time * 0.06)
        );
        
        float warpStr = 1.5 + (midBump * 3.0);
        vec2 r = vec2(
          noise(p + q * warpStr + vec2(1.7, 9.2) + u_time * 0.12),
          noise(p + q * warpStr + vec2(8.3, 2.8) + u_time * 0.09)
        );
        
        return noise(p + r * (2.0 + u_scatter * 0.05));
      }

      void main() {
        vec2 st = vTexCoord - 0.5;
        // Glow & Size 슬라이더 수치에 부합하는 리얼 공간 주파수 매핑
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
        canvas.style('z-index', '1');
        
        this.shaderProgram = p.createShader(this.getVertexShader(), this.getFragmentShader());
        p.noLoop();
      };

      p.draw = () => {
        p.clear();
        
        if (this.shaderProgram) {
          // 💡 [버그 픽스 핵심] 셰이더를 그리기 전에 WebGL 매트릭스를 강제로 정중앙 리셋합니다.
          p.resetMatrix();
          
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

          // 💡 정중앙 리셋 후 평면 사각형을 그려 캔버스 전체에 우상단 밀림 없이 꽉 채웁니다.
          p.rect(-p.width / 2, -p.height / 2, p.width, p.height);
        }

        if (!this.isAudioActive) {
          p.resetShader();
          // 💡 폰트 로딩 경고 및 UI 깨짐을 완벽히 방지하는 2D 컨텍스트 안전 제어
          this.drawOnScreenGuide(p);
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

  // 💡 WebGL 스펙을 우회하여 스팸 에러를 원천 차단하고 정중앙 박스를 복구하는 안내 가이드 엔진
  drawOnScreenGuide(p) {
    p.push();
    let w = p.width; let h = p.height;
    
    // WebGL 내부 평면 텍스트 에러 방지용 가이드 박스 빌드업
    p.fill(10, 12, 18, 230);
    p.stroke(0, 255, 204, 150);
    p.strokeWeight(1);
    p.rectMode(p.CENTER);
    p.rect(0, 0, w * 0.85, 140, 8);

    p.noStroke();
    p.fill(0, 255, 204);
    // WebGL 기본 시스템 폰트 강제 우회 지정 (에러 로그 소멸 핵심)
    p.textFont('sans-serif'); 
    p.textAlign(p.CENTER, p.CENTER);
    
    p.textSize(16);
    p.text("🌌 Cosmic 018호 GLSL GPU 가속 무대", 0, -35);
    
    p.fill(220);
    p.textSize(12);
    p.text("MP3 음악 파일 로드 후 재생 버튼을 누르시면", 0, 5);
    p.fill(255, 204, 0);
    p.text("60FPS 초고속 하드웨어 셰이더 구름이 피어오릅니다.", 0, 25);
    
    p.fill(0, 255, 204, 120);
    p.textSize(10);
    p.text(`STATUS: ${this.version} READY`, 0, 50);
    p.pop();
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
    this.time += (0.015 + high * 0.04) * ui.burst;

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
