/**
 * src/sketches/017_p5_fbm_cloud.js
 * - [017호] 프랙탈 브라운 운동(FBM) 구름 시뮬레이터
 * - 오디오 주파수 매핑: 저음(하늘 색조/기류) -> 중음(구름 질량) -> 고음(바람/형태 소멸)
 * - 4중첩 펄린 노이즈 프랙탈 알고리즘 탑재
 */
export default class P5FBMCloudGenerator {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.cloudImg = null; // 픽셀 가속용 이미지 버퍼
    
    // 애니메이션 시간 축 및 물리 파라미터
    this.timeX = 0;
    this.timeY = 0;
    this.simulatedProgress = 0;
    
    this.currentSettings = { style: 'neon', scatter: 2.2, gain: 1.0, seed: 42, glow: 0.25 };
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
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        p.pixelDensity(1); // 픽셀 연산 오버헤드 방지
        
        // 실시간 고속 연산을 위해 화면보다 작은 버퍼(다운샘플링)를 생성해 연산 속도를 확보합니다.
        this.cloudImg = p.createImage(Math.floor(p.width / 2), Math.floor(p.height / 2));
        p.noLoop();
      };

      p.draw = () => {
        p.clear();
        // 💡 계산된 구름 이미지를 메인 캔버스 크기로 늘려 부드러운 안개 필터 효과를 냅니다.
        if (this.cloudImg) {
          p.image(this.cloudImg, 0, 0, p.width, p.height);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  getUIParams() {
      const settings = window.cosmicEngineSettings || {};
      return {
          scatter: settings.scatterExponent ?? 2.2, // 노이즈 해칭 강도
          glow: settings.glowAmount ?? (settings.size ?? 0.25), // 구름 기본 밝기
          burst: settings.audioGain ?? 1.0, // 생성 속도 배율
          seed: settings.seed ?? 42,
          style: (settings.colorStyle || 'neon').toLowerCase()
      };
  }

  // 💡 4옥타브(Octave) FBM 수식 엔진 코어
  calculateFBM(x, y, p, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let total = 0;
    let amplitude = 1.0;
    let frequency = 0.005; // 구름 덩어리의 기본 크기 스케일
    
    for (let i = 0; i < octaves; i++) {
      // p5.js의 내장 2D 노이즈를 누적합산
      total += p.noise(x * frequency, y * frequency) * amplitude;
      frequency *= lacunarity; // 주파수 증가 (디테일 쪼개기)
      amplitude *= gain;      // 진폭 감소 (자잘한 주름의 영향도 축소)
    }
    return total;
  }

  update(audioData) {
    if (!this.p5Instance || !this.cloudImg) return;
    let p = this.p5Instance;
    const ui = this.getUIParams();

    const audioEl = document.querySelector('audio');
    let isPlaying = audioEl && !audioEl.paused;

    // 💡 오디오 주파수 대역 정밀 분리
    let low = audioData ? (audioData.raw[2] + audioData.raw[3]) / 510 : 0.3;
    let mid = audioData ? (audioData.raw[15] + audioData.raw[16]) / 510 : 0.2;
    let high = audioData ? (audioData.raw[55] + audioData.raw[56]) / 510 : 0.1;

    // 💡 고음(High)과 폭발력(Burst) 슬라이더에 반응하여 대기 기류(바람) 속도 가속
    let windSpeed = (0.01 + high * 0.05) * ui.burst;
    this.timeX += windSpeed;
    this.timeY += windSpeed * 0.2;

    p.noiseSeed(ui.seed);

    this.cloudImg.loadPixels();
    let w = this.cloudImg.width;
    let h = this.cloudImg.height;

    // 💡 1단계 저음(Low): 베이스 드럼에 연동되어 하늘 배경의 그라데이션 색조 변경
    let skyR = p.map(low, 0, 1, 10, 40) * (ui.glow + 0.5);
    let skyG = p.map(low, 0, 1, 25, 75) * (ui.glow + 0.5);
    let skyB = p.map(low, 0, 1, 50, 150) * (ui.glow + 0.5);

    // 💡 컬러 스타일에 따른 예외 처리
    if (ui.style.includes('monochrome')) {
       let gray = (skyR + skyG + skyB) / 3; skyR = gray; skyG = gray; skyB = gray;
    }

    // 픽셀 루프 시작
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // 💡 2단계 바람 연동: 흐르는 시간축(timeX, timeY)을 주입하여 노이즈 샘플링 위치 이동
        let fbmVal = this.calculateFBM(x + this.timeX * 100, y + this.timeY * 100, p, 4, 2.1, 0.45);

        // 💡 3단계 중음(Mid): 보컬/멜로디 진폭에 따라 구름의 밀도(임계값)를 동적으로 밀어 올림
        let cloudThreshold = p.map(mid, 0, 1, 0.45, 0.3); // 음악이 고조되면 구름 면적이 넓어짐
        let density = Math.max(0, fbmVal - cloudThreshold);
        
        // 부드러운 화이트 밸런스 처리를 위한 매핑 수식
        let cloudIntensity = p.smoothstep ? p.smoothstep(0, 0.4, density) : Math.min(1.0, density * 2.5);

        // 픽셀 배열 인덱스 연산
        let idx = (y * w + x) * 4;

        // 구름 컬러 스타일 입히기
        let cR = 255, cG = 255, cB = 255;
        if (ui.style.includes('neon')) {
            cR = 0; cG = 230; cB = 255; // 네온 구름 야경 효과
        } else if (ui.style.includes('pastel')) {
            cR = 255; cG = 200; cB = 220;
        }

        // 💡 최종 하늘 색상과 구름 색상 보간(Blending)
        this.cloudImg.pixels[idx]     = p.mix ? p.mix(skyR, cR, cloudIntensity) : skyR + (cR - skyR) * cloudIntensity;
        this.cloudImg.pixels[idx + 1] = p.mix ? p.mix(skyG, cG, cloudIntensity) : skyG + (cG - skyG) * cloudIntensity;
        this.cloudImg.pixels[idx + 2] = p.mix ? p.mix(skyB, cB, cloudIntensity) : skyB + (cB - skyB) * cloudIntensity;
        this.cloudImg.pixels[idx + 3] = 255; // 불투명 고정
      }
    }
    
    this.cloudImg.updatePixels();
    p.redraw();
  }

  resize(w, h) {
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
      this.cloudImg = this.p5Instance.createImage(Math.floor(w / 2), Math.floor(h / 2));
    }
  }

  destroy() {
    if (this.p5Instance) this.p5Instance.remove();
    this.cloudImg = null;
  }
}
