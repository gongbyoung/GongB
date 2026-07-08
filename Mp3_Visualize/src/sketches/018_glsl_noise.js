/**
 * src/sketches/018_glsl_noise.js
 * - [버전] Ver 1.6 (WebGL 폰트 에러 스팸 영구 해결 완료 버전)
 * - p5.js text() 함수를 완전히 박살내고 100% 안전한 HTML DOM 가이드 패널 시스템으로 오버홀
 * - 콘솔창 경고 차단, 화면 비율 단추 연동 시 가이드 패널 중앙 정렬 완벽 유지
 */

export default class GLSLNoiseShaderStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.shaderProgram = null;
    this.guiOverlay = null; // HTML UI 오버레이 엘리먼트
    
    this.version = "018호 GLSL Liquid Noise Ver 1.6";
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

    // 💡 [초강력 차단 칩] 기존에 혹시 남아있을 가이드 HTML UI 엘리먼트 제거 후 재생성
    const oldOverlay = this.container.querySelector('.cosmic-shader-guide');
    if (oldOverlay) oldOverlay.remove();

    this.guiOverlay = document.createElement('div');
    this.guiOverlay.className = 'cosmic-shader-guide';
    // 부모 컨테이너 내부에 완벽히 중앙 고정 정렬시키는 최첨단 인라인 스타일링 시공
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

    // 💡 p5.js 내부 에러 유발 코드를 거두고 웹 표준 HTML 텍스트 주입
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
            this.shaderProgram.setUniform('u_audio', [0.3, 0.2, 0.1]);
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
        // 음악 재생 시 HTML 가이드 매끄럽게 숨김
        if (this.guiOverlay) this.guiOverlay.style.opacity = '0';
    } else {
        this.isAudioActive = false;
        // 정지 시 가이드 다시 선명하게 표시
        if (this.guiOverlay) this.guiOverlay.style.opacity = '1';
    }

    const ui = this.getUIParams();
    
    let currentSettingsStr = `${ui.seed}-${ui.scatter}-${ui.glow}-${ui.style}-${ui.burst}`;
    if (this.lastSettingsStr !== currentSettingsStr) {
        this.lastSettingsStr = currentSettingsStr;
        this.resetCanvas(p, true);
    }

    this.time += (0.01 + (audioData ? audioData.vol : 0.15) * 0.04) * ui.burst;

    p.shader(this.shaderProgram);
    this.shaderProgram.setUniform('u_audio', [
        audioData ? (audioData.raw[2]/255) : 0.3,
        audioData ? (audioData.vol * 1.5) : 0.2,
        audioData ? (audioData.raw[55]/255) : 0.1
    ]);
    
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
