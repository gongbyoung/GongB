/**
 * src/sketches/018_glsl_noise.js
 * - [버전] Ver 1.8 (오일 질감 제거 및 6중 프랙탈 뭉게구름 엔진 오버홀)
 * - 액체 왜곡(Domain Warping) 수식을 완전히 걷어내고, 순수 6단계 FBM 프랙탈 레이어 중첩 적용
 * - 분산범위(ui.scatter) 슬라이더 조작 시 017호와 동일한 레이어 중첩 충돌 필터 메커니즘 가동
 */

export default class GLSLNoiseShaderStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.shaderProgram = null;
    this.guiOverlay = null; 
    
    // 💡 업데이트 세팅 마커
    this.version = "018호 FBM Cloud Shader Ver 1.8";
    this.time = 0;
    this.isAudioActive = false;
    this.lastSettingsStr = "";
  }

  getVertexShader() {
    return `
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vTexCoord;
      uniform mat4 uModelViewMatrix;
      uniform mat4 uProjectionMatrix;
      void main() {
        vTexCoord = aTexCoord;
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

      // GPU 가속 난수 생성기
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      // 2D 밸런스 노이즈
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                   mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }

      // 💡 [오일 질감 완전 제거] 6단계 독립 옥타브 FBM 구름 묘사 엔진
      // 주파수를 배수로 쪼개어 겹치면서 보송보송하고 불규칙한 자연계 구름 입자를 형성합니다.
      float cloudFBM(vec2 p, float seedShift) {
        float value = 0.0;
        float amplitude = 1.0;
        float frequency = 1.0;
        float maxValue = 0.0;

        // 음악 주파수 및 시간 흐름 기류 주입
        vec2 shift = vec2(u_time * 0.05, u_time * 0.02) + vec2(seedShift);

        for (int i = 0; i < 6; i++) {
          value += noise(p * frequency + shift) * amplitude;
          maxValue += amplitude;
          frequency *= 2.15;
          amplitude *= 0.48;
        }
        return value / maxValue;
      }

      void main() {
        // 정밀 가상 렌즈 중심점 설정
        vec2 st = vTexCoord - 0.5;
        
        // Glow & Size 슬라이더 기반 카메라 공간 줌 아웃 매핑 밸런스 조정
        float zoom = 2.0 / (0.1 + u_glow * 0.015);
        st *= zoom;

        float low = u_audio.x;
        float mid = u_audio.y;
        float high = u_audio.z;

        // 6중 중첩 프랙탈 노이즈 가동
        float fbmVal = cloudFBM(st * 2.5, u_seed * 12.3);

        // 💡 [회원님 기획안 이식] 분산범위(u_scatter)를 레이어 중첩 충돌 필터 커트라인으로 오버홀
        // 우측으로 밀수록 레이어가 여러 개 강력하게 충돌한 묵직하고 리얼한 구름 산맥 위주로 필터링됩니다.
        float densityOffset = (u_scatter - 22.0) * 0.006;
        float threshold = 0.38 + densityOffset - (mid * 0.12);
        
        float density = max(0.0, fbmVal - threshold);
        float cloudIntensity = clamp(density * 7.0, 0.0, 1.0);

        // 화풍 컬러 매핑
        vec3 skyColor = vec3(0.0);
        vec3 cloudColor = vec3(0.0);

        if (u_style == 0) { 
            skyColor = vec3(0.08, 0.11, 0.16);
            cloudColor = vec3(0.55, 0.57, 0.60);
        } else if (u_style == 1) { 
            vec3 topH = vec3(0.05, 0.35, 0.72);
            vec3 botH = vec3(0.35, 0.62, 0.95);
            skyColor = mix(topH, botH, low);
            cloudColor = vec3(0.98, 0.99, 1.0);
        } else if (u_style == 2) { 
            vec3 dawnTop = vec3(0.25, 0.08, 0.45);
            vec3 dawnBot = vec3(0.95, 0.40, 0.18);
            skyColor = mix(dawnTop, dawnBot, low * 1.2);
            cloudColor = vec3(1.0, 0.88, 0.75);
        } else { 
            skyColor = vec3(0.05, 0.08, 0.12);
            cloudColor = vec3(0.0, 0.92, 1.0);
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

    const oldOverlay = this.container.querySelector('.cosmic-shader-guide');
    if (oldOverlay) oldOverlay.remove();

    this.guiOverlay = document.createElement('div');
    this.guiOverlay.className = 'cosmic-shader-guide';
    Object.assign(this.guiOverlay.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '85%',
      maxWidth: '420px',
      backgroundColor: 'rgba(10, 12, 18, 0.92)',
      border: '1px solid rgba(0, 255, 204, 0.6)',
      borderRadius: '10px',
      padding: '20px',
      color: '#ffffff',
      fontFamily: 'sans-serif',
      zIndex: '10',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      boxSizing: 'border-box',
      textAlign: 'center',
      pointerEvents: 'none',
      transition: 'opacity 0.4s ease'
    });

    this.guiOverlay.innerHTML = `
      <div style="color: #00ffcc; font-size: 11px; text-align: left; margin-bottom: 15px; font-weight: bold; opacity: 0.85;">
        ⚙️ SYSTEM STATUS: ${this.version} READY
      </div>
      <h3 style="color: #00ffcc; font-size: 16px; margin: 0 0 18px 0; font-weight: 600;">
        Cosmic Studio 018호 셰이더 무대 가이드
      </h3>
      <div style="font-size: 12.5px; text-align: left; line-height: 1.7; color: #dddddd;">
        <p style="margin: 6px 0;">1️⃣ <strong style="color: #ffffff;">[좌측 최상단]</strong> MP3 음악 파일을 로딩해 주세요.</p>
        <p style="margin: 6px 0;">2️⃣ <strong style="color: #ffffff;">[우측 패널]</strong> 슬라이더 제어 시 렉 없이 실시간 왜곡 연동됩니다.</p>
        <p style="margin: 6px 0; color: #ffcc00;">3️⃣ <strong style="color: #ffcc00;">[하단 컨트롤]</strong> 재생(▶) 단추를 누르면 GPU 셰이더가 폭발합니다!</p>
      </div>
      <div style="color: #888888; font-size: 10.5px; margin-top: 15px;">
        음악이 재생되면 이 안내창은 자동으로 페이드아웃 됩니다.
      </div>
    `;
    this.container.appendChild(this.guiOverlay);

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
        p.resetMatrix();
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
            this.shaderProgram.setUniform('u_audio', [0.4, 0.3, 0.2]);
          }

          p.noStroke();
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
        if (this.guiOverlay) this.guiOverlay.style.opacity = '0';
    } else {
        this.isAudioActive = false;
        if (this.guiOverlay) this.guiOverlay.style.opacity = '1';
    }

    const ui = this.getUIParams();
    
    let currentSettingsStr = `${ui.seed}-${ui.scatter}-${ui.glow}-${ui.style}-${ui.burst}`;
    if (this.lastSettingsStr !== currentSettingsStr) {
        this.lastSettingsStr = currentSettingsStr;
        this.resetCanvas(p, true);
    }

    let low = 0.4; let mid = 0.3; let high = 0.2;
    if (audioData && audioData.raw && audioData.raw.length > 60) {
        low = (audioData.raw[2] + audioData.raw[3]) / 510;
        mid = (audioData.raw[15] + audioData.raw[16]) / 510;
        high = (audioData.raw[55] + audioData.raw[56]) / 510;
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
    if (this.guiOverlay) this.guiOverlay.remove();
  }
}
