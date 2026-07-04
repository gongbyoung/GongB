/**
 * 010_p5_datawave_512.js
 * p5.js 라이브러리의 2D Canvas 렌더링 성능과 shadowBlur를 극대화하여 
 * 512개의 원본 주파수를 아날로그 레이저(Oscilloscope) 느낌의 파도로 시각화하는 스테이지
 */
export default class P5DataWave512 {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numBands = 512;
    this.smoothedFreq = new Float32Array(this.numBands);
    this.currentAudioData = null;

    // 배경 이미지 처리를 위한 HTML 엘리먼트
    this.bgImageEl = null;
    this.currentImageSrc = null;
  }

  async init() {
    // 1. p5.js 라이브러리가 로드되지 않았다면 동적으로 가져오기
    if (!window.p5) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    // 2. 캔버스 뒤에 깔릴 고해상도 배경 이미지 세팅 (Canvas 렌더링 부하 최소화)
    this.bgImageEl = document.createElement('img');
    this.bgImageEl.style.position = 'absolute';
    this.bgImageEl.style.top = '0';
    this.bgImageEl.style.left = '0';
    this.bgImageEl.style.width = '100%';
    this.bgImageEl.style.height = '100%';
    this.bgImageEl.style.objectFit = 'cover';
    this.bgImageEl.style.opacity = '0.4'; // 파도가 잘 보이도록 살짝 어둡게
    this.bgImageEl.style.zIndex = '0';
    this.container.appendChild(this.bgImageEl);

    // 3. p5.js 인스턴스 모드 초기화 (기존 시스템 아키텍처와 호환되도록 구성)
    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        // p5 자체 루프는 끄고, 메인 시스템의 update()에서 redraw()를 호출하도록 설정
        p.noLoop(); 
      };

      p.draw = () => {
        // 배경을 투명하게 지워서 뒤에 깔린 img 엘리먼트가 보이게 함
        p.clear();

        if (!this.currentAudioData) return;

        // UI 설정값 리딩
        let scatter = 2.2, gain = 1.0, glow = 0.85;
        let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };
        let colorStyle = 'neon';

        if (window.cosmicEngineSettings) {
          scatter = window.cosmicEngineSettings.scatterExponent; 
          gain = window.cosmicEngineSettings.audioGain;          
          glow = window.cosmicEngineSettings.glowIntensity;
          customColors = window.cosmicEngineSettings.customColors;
          colorStyle = window.cosmicEngineSettings.colorStyle;
        }

        const width = p.width;
        const height = p.height;
        const baselineY = height * 0.75; // 화면 75% 높이를 기준선으로 설정

        // 💡 [Canvas API 선형 그라데이션 셋업] p5.js의 장점: 부드러운 그라데이션 선 그리기 가능
        const ctx = p.drawingContext;
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        
        if (colorStyle === 'neon') {
            gradient.addColorStop(0, '#ff0055'); // 저음 (Red)
            gradient.addColorStop(0.5, '#00ffcc'); // 중음 (Cyan)
            gradient.addColorStop(1, '#6600ff'); // 고음 (Purple)
        } else if (colorStyle === 'pastel') {
            gradient.addColorStop(0, '#ffb3ba');
            gradient.addColorStop(1, '#bae1ff');
        } else if (colorStyle === 'custom') {
            gradient.addColorStop(0, customColors.gas1);
            gradient.addColorStop(1, customColors.gas2);
        } else {
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(1, '#ffffff');
        }

        ctx.strokeStyle = gradient;

        // 💡 [512 채널 데이터 스무딩 및 스케일링]
        const hasRawData = this.currentAudioData.raw && this.currentAudioData.raw.length > 0;

        for (let i = 0; i < this.numBands; i++) {
          let rawVal = 0;
          if (hasRawData) {
            rawVal = this.currentAudioData.raw[i] || 0;
          } else {
            // 백업용 3밴드 페이크 데이터
            let f = i / this.numBands;
            if (f < 0.25) rawVal = p.lerp(this.currentAudioData.subBass, this.currentAudioData.bass, f * 4.0) * 255;
            else if (f < 0.75) rawVal = p.lerp(this.currentAudioData.bass, this.currentAudioData.mid, (f - 0.25) * 2.0) * 255;
            else rawVal = p.lerp(this.currentAudioData.mid, this.currentAudioData.treble, (f - 0.75) * 4.0) * 255;
          }

          let normalized = rawVal / 255.0;
          if (normalized < 0.05) normalized = 0; // 노이즈 게이트

          let boost = 1.0 + (i / this.numBands) * 2.0; // 고음역대 부스트
          let targetFreq = Math.pow(normalized, 1.8) * gain * boost * 200; // 픽셀 단위 증폭

          // 바이올린 지속음 부드러운 스무딩 적용
          if (targetFreq > this.smoothedFreq[i]) {
            this.smoothedFreq[i] = targetFreq;
          } else {
            this.smoothedFreq[i] += (targetFreq - this.smoothedFreq[i]) * 0.15;
          }
        }

        // 💡 [그리기 레이어 1: 빛 번짐(Glow) 효과] p5.js의 필살기 shadowBlur 활용
        ctx.shadowBlur = 30 * glow;
        ctx.shadowColor = colorStyle === 'custom' ? customColors.gas2 : '#00ffcc';
        p.strokeWeight(3 + glow * 2);
        p.noFill();
        p.beginShape();
        for (let i = 0; i < this.numBands; i++) {
          let x = p.map(i, 0, this.numBands - 1, 0, width);
          // Scatter 슬라이더로 물결의 진폭 스케일 조절
          let y = baselineY - (this.smoothedFreq[i] * (scatter / 2.2));
          p.vertex(x, y); // p5의 vertex를 사용해 512포인트를 한 선으로 이음
        }
        p.endShape();

        // 💡 [그리기 레이어 2: 선명한 코어(Core) 라인] 가운데 흰색 심지를 그려 리얼리티 강조
        ctx.shadowBlur = 0; // 코어는 빛 번짐 없음
        p.strokeWeight(1.5);
        p.stroke(255, 255, 255, 200); // 반투명 흰색
        p.beginShape();
        for (let i = 0; i < this.numBands; i++) {
          let x = p.map(i, 0, this.numBands - 1, 0, width);
          let y = baselineY - (this.smoothedFreq[i] * (scatter / 2.2));
          p.vertex(x, y);
        }
        p.endShape();
      };
    };

    // p5.js 인스턴스 캔버스를 컨테이너에 부착
    this.p5Instance = new window.p5(sketch, this.container);
  }

  update(audioData) {
    if (!this.p5Instance) return;
    this.currentAudioData = audioData;

    // 💡 배경 이미지 실시간 갱신 로직 (HTML img 태그 src 변경)
    if (window.currentUploadedImageElement) {
        if (this.currentImageSrc !== window.currentUploadedImageElement.src) {
            this.currentImageSrc = window.currentUploadedImageElement.src;
            this.bgImageEl.src = this.currentImageSrc;
        }
    }

    // 메인 루프에서 p5.js의 draw() 함수를 1프레임 강제 실행
    this.p5Instance.redraw();
  }

  resize(w, h) {
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
    }
  }

  destroy() {
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }
    if (this.bgImageEl) {
      this.container.removeChild(this.bgImageEl);
      this.bgImageEl = null;
    }
    this.currentAudioData = null;
  }
}
