/**
 * src/sketches/018_glsl_noise.js
 * - [버전] Ver 1.0 (GPU 가속 WebGL GLSL Liquid Noise Shader Stage)
 * - GPU 커스텀 프래그먼트 셰이더를 통해 CPU 병목이 전혀 없는 초고속 실시간 유체 구름 시뮬레이션
 * - 오디오의 저/중/고음 주파수 파이프라인이 셰이더 유니폼(Uniforms)으로 다이렉트 바인딩되어 유기적 팽창
 * - 지형변경(seed), 분산범위(scatter), 크기(glow) 하드웨어 슬라이더 DOM 직접 추적 및 실시간 연동
 */

export default class GLSLNoiseShaderStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.shaderProgram = null;
    
    this.version = "018호 GLSL Liquid Noise Ver 1.0";
    this.time = 0;
    this.isAudioActive = false;
  }

  // 💡 GPU 내부에서 초당 60프레임으로 동시 연산될 하이엔드 GLSL 셰이더 코드 소스
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

      // 외부에서 전달받는 오디오 및 UI 유니폼 데이터 파이프라인
      uniform float u_time;
      uniform vec3 u_audio; // x: 저음, y: 중음, z: 고음
      uniform float u_seed;
      uniform float u_scatter;
      uniform float u_glow;
      uniform int u_style;

      // GPU용 고속 의사 난수 생성 함수
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      // 2D 펄린 노이즈 보간 엔진
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                   mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }

      // 💡 017호 회원님 알고리즘을 셰이더 하드웨어용 6중 중첩 도메인 워핑(Domain Warping)으로 업그레이드
      float liquidFBM(vec2 p, float midBump) {
        vec2 q = vec2(
          noise(p + vec2(0.0, 0.0) + u_time * 0.1),
          noise(p + vec2(5.2, 1.3) + u_time * 0.08)
        );
        
        // 2차 중복 왜곡 충돌 유도
        float warpStr = 1.5 + (midBump * 3.0);
        vec2 r = vec2(
          noise(p + q * warpStr + vec2(1.7, 9.2) + u_time * 0.15),
          noise(p + q * warpStr + vec2(8.3, 2.8) + u_time * 0.12)
        );
        
        // 최종 주파수 합성
        return noise(p + r * (2.0 + u_scatter * 0.05));
      }

      void main() {
        // 화면 중심 기준 좌표 정렬 및 줌 배율 제어 (Glow 슬라이더 매핑)
        vec2 st = vTexCoord - 0.5;
        float zoom = 1.5 / (0.1 + u_glow * 0.015);
        st *= zoom;

        float low = u_audio.x;
        float mid = u_audio.y;
        float high = u_audio.z;

        // 리퀴드 FBM 연산
        float fbmVal = liquidFBM(st * 3.0 + vec2(u_seed * 0.1), mid * 2.0);

        // 💡 분산범위 슬라이더를 레이어 충돌 커트라인으로 다이렉트 바인딩
        float threshold = 0.35 + (u_scatter / 200.0) - (mid * 0.1);
        float density = max(0.0, fbmVal - threshold);
        float cloudIntensity = clamp(density * 6.5, 0.0, 1.0);

        // 정교한 날씨 화풍 그래디언트 컬러 바인딩
        vec3 skyColor = vec3(0.0);
        vec3 cloudColor = vec3(0.0);

        if (u_style == 0) { // 먹구름
            skyColor = vec3(0.08, 0.11, 0.16);
            cloudColor = vec3(0.48, 0.50, 0.54);
        } else if (u_style == 1) { // 맑은 하늘
            vec3 topH = vec3(0.05, 0.31, 0.68);
            vec3 botH = vec3(0.31, 0.58, 0.92);
            skyColor = mix(topH, botH, low);
            cloudColor = vec3(0.98, 0.99, 1.0);
        } else if (u_style == 2) { // 노을 / 해돋이
            vec3 dawnTop = vec3(0.21, 0.07, 0.41);
            vec3 dawnBot = vec3(0.92, 0.37, 0.15);
            skyColor = mix(dawnTop, dawnBot, low * 1.2);
            cloudColor = vec3(1.0, 0.86, 0.72);
        } else { // 기본 네온
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
        // 💡 GPU 셰이더 가동을 위해 WEBGL 모드로 캔버스 부팅
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight, p.WEBGL);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        // 커스텀 GLSL 프로그램 컴파일 장전
        this.shaderProgram = p.createShader(this.getVertexShader(), this.getFragmentShader());
        p.noLoop();
      };

      p.draw = () => {
        p.clear();
        
        if (this.shaderProgram) {
          p.shader(this.shaderProgram);
          
          // 💡 하드웨어 연동을 위한 실시간 DOM 데이터 수집 및 셰이더 Uniform 주입
          const ui = this.getUIParams();
          
          this.shaderProgram.setUniform('u_time', this.time);
          this.shaderProgram.setUniform('u_seed', ui.seed);
          this.shaderProgram.setUniform('u_scatter', ui.scatter);
          this.shaderProgram.setUniform('u_glow', ui.glow);
          
          let styleIdx = 1; // 맑은하늘 기본
          if (ui.style.includes('monochrome')) styleIdx = 0;
          else if (ui.style.includes('pastel')) styleIdx = 2;
          else if (ui.style.includes('full-random')) styleIdx = 3;
          this.shaderProgram.setUniform('u_style', styleIdx);

          // 임시/Fallback 오디오 벡터 전송
          if (!this.isAudioActive) {
            this.shaderProgram.setUniform('u_audio', [0.3, 0.2, 0.1]);
          }

          // 셰이더가 입혀질 사각형 스크린 평면 드로잉
          p.rect(-p.width / 2, -p.height / 2, p.width, p.height);
        }

        // 오디오가 미가동 중일 때 온스크린 안내 가이드 렌더링
        if (!this.isAudioActive) {
          p.resetShader(); // 가이드 텍스트를 그리기 위해 셰이더를 잠시 잠금 해제
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

  drawOnScreenGuide(p) {
    p.push();
    // WEBGL 모드이므로 중심 좌표계(0,0) 기준으로 보정하여 드로잉합니다.
    let w = p.width; let h = p.height;
    
    p.fill(0, 255, 204, 200);
    p.noStroke();
    p.textSize(12);
    p.textAlign(p.LEFT, p.TOP);
    p.text(`⚙️ SYSTEM STATUS: ${this.version} READY`, -w/2 + 20, -h/2 + 20);

    p.fill(10, 12, 18, 220);
    p.stroke(50, 55, 75);
    p.strokeWeight(1);
    p.rectMode(p.CENTER);
    p.rect(0, 0, w * 0.85, 220, 10);

    p.noStroke();
    p.fill(0, 255, 204);
    p.textSize(20);
    p.textAlign(p.CENTER, p.CENTER);
    p.text("Cosmic Studio 018호 GLSL 셰이더 무대 가이드", 0, -75);

    p.fill(220);
    p.textSize(13);
    p.textAlign(p.LEFT, p.CENTER);
    
    let startX = -(w * 0.38);
    let startY = -25;
    let lineSpacing = 32;

    p.text("1️⃣  [좌측 최상단] MP3 음악 파일을 로딩해 주세요.", startX, startY);
    p.text("2️⃣  [우측 패널] 모든 조절 슬라이더는 렉 없이 실시간 반영됩니다.", startX, startY + lineSpacing);
    
    p.fill(255, 204, 0); 
    p.text("3️⃣  [하단 컨트롤] 재생 버튼을 누르면 GPU 가속 유체 시뮬레이션이 폭발합니다!", startX, startY + lineSpacing * 2);

    p.fill(120);
    p.textSize(11);
    p.textAlign(p.CENTER, p.CENTER);
    p.text("곡이 흐르면 이 안내창은 자동으로 페이드아웃 되며 60FPS 하드웨어 영상이 출력됩니다.", 0, 75);
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

    // 주파수 파싱 및 지연 렌더링 값 주입
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
    
    // 유체 기류 흐름 시간 축 축적
    this.time += (0.02 + high * 0.05) * ui.burst;

    // GPU 내부에 실시간 오디오 스펙트럼 유니폼 주입
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
