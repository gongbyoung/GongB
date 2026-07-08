/**
 * src/sketches/018_glsl_noise.js
 * - [버전] Ver 2.1 (파일명 특수문자 콜론 경로 깨짐 우회 및 WebGL 직통 텍스처 가속 패치)
 * - 파일명에 콜론(:) 등이 포함되어 경로 파싱이 깨지는 문제를 우회하기 위해 DOM 원천 데이터 캡처 엔진 시공
 * - 6중 프랙탈 FBM 구름 완벽 작동판
 */

export default class GLSLNoiseShaderStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.shaderProgram = null;
    this.guiOverlay = null; 
    
    // 💡 최종 업데이트 확인용 마커 세팅
    this.version = "018호 FBM Cloud Shader Ver 2.1";
    this.time = 0;
    this.isAudioActive = false;
    this.lastSettingsStr = "";
    
    this.bgTextureElement = null;
    this.lastBgSrc = "";
    this.domObserver = null;
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

      uniform sampler2D u_bgTexture;
      uniform bool u_useBgTexture;

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

      float cloudFBM(vec2 p, float seedShift) {
        float value = 0.0;
        float amplitude = 1.0;
        float frequency = 1.0;
        float maxValue = 0.0;

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
        vec2 st = vTexCoord - 0.5;
        float zoom = 2.0 / (0.1 + u_glow * 0.015);
        st *= zoom;

        float low = u_audio.x;
        float mid = u_audio.y;
        float high = u_audio.z;

        float fbmVal = cloudFBM(st * 2.5, u_seed * 12.3);

        float densityOffset = (u_scatter - 22.0) * 0.006;
        float threshold = 0.38 + densityOffset - (mid * 0.12);
        
        float density = max(0.0, fbmVal - threshold);
        float cloudIntensity = clamp(density * 7.0, 0.0, 1.0);

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

        if (u_useBgTexture) {
            vec4 texColor = texture2D(u_bgTexture, vec2(vTexCoord.x, 1.0 - vTexCoord.y));
            skyColor = texColor.rgb;
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
        <p style="margin: 6px 0;">✨ <strong style="color: #ffffff;">[특수문자 해결]</strong> 파일명과 관계없이 배경 이미지가 즉시 강제 하이브리드 합성됩니다.</p>
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
        
        // 💡 [특수문자 격파 핵심 루틴] DOM 이벤트를 우회해 미디어 패널 전체의 이미지 태그 변화를 다이렉트로 가로챕니다.
        this.setupDirectInputTracker(p);
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

          if (this.bgTextureElement && this.bgTextureElement.width > 2) {
              this.shaderProgram.setUniform('u_bgTexture', this.bgTextureElement);
              this.shaderProgram.setUniform('u_useBgTexture', true);
          } else {
              this.shaderProgram.setUniform('u_useBgTexture', false);
          }

          p.noStroke();
          p.rect(-p.width / 2, -p.height / 2, p.width, p.height);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 💡 HTML의 이미지 변경 속성을 관찰하여 파일명의 특수문자 여부와 관계없이 다이렉트로 메모리를 인터셉트하는 추적 장치
  setupDirectInputTracker(p) {
    const findAndBindImage = () => {
      const allImgs = document.querySelectorAll('img');
      let targetImg = null;
      for (let img of allImgs) {
        if (img.src && (img.src.includes('blob:') || img.src.length > 30 || img.id.includes('preview'))) {
          targetImg = img;
          break;
        }
      }
      
      if (targetImg && targetImg.src && targetImg.src !== this.lastBgSrc) {
        this.lastBgSrc = targetImg.src;
        // OS 덤프 파일명 우회용 비동기 로딩 파이프라인 가속
        p.loadImage(targetImg.src, (loadedImg) => {
          this.bgTextureElement = loadedImg;
          p.redraw();
        });
      }
    };

    // 실시간 DOM 옵저버 배치로 업로드 순간을 가로챕니다.
    this.domObserver = new MutationObserver(() => {
      findAndBindImage();
    });
    this.domObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
    
    // 초기 로딩용 스캔
    setTimeout(findAndBindImage, 500);
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
    if (this.domObserver) this.domObserver.disconnect();
  }
}
