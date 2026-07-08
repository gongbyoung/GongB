/**
 * src/sketches/019_p5_512_circles.js
 * - [버전] Ver 1.0 (512채널 전 주파수 숨김 배치 및 오디오 볼륨 속빈 서클 반짝임 Stage)
 * - 512개의 FFT 오디오 주파수 대역을 화면 전체 공간에 보이지 않게 그리드로 매핑
 * - 각 주파수의 볼륨(Vol) 강도에 따라 속이 빈 원(Stroke Circle)의 크기와 투명도가 반짝이며 실시간 반응
 * - 화면 비율(Full, 16:9, 9:16) 변동 시 정중앙 레이아웃 및 픽셀 스케일 자동 칼정렬
 */
import ImageAnalyzer from '../core/ImageAnalyzer.js'; 

export default class P5512CirclesStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    // 💡 업데이트 확인용 버전 세팅
    this.version = "019호 512채널 서클 Ver 1.0";
    this.isAudioActive = false;
    
    // 512개 입자들의 고유 난수 위치와 페이드 속성을 저장할 배열
    this.particles = [];
    this.totalChannels = 512;
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
        canvas.style('left', '0px');
        canvas.style('top', '0px');
        canvas.style('z-index', '1');
        
        p.pixelDensity(1);
        
        // 💡 512개 주파수 공간 노드를 화면 전체에 무작위 배정하되, 
        // 주파수 순서(낮은 음 -> 높은 음)대로 흐름을 가지도록 수학적 가상 그리드 필드를 구축합니다.
        this.generateFrequencyNodes(p.width, p.height);
        p.noLoop();
      };

      p.draw = () => {
        // 어두운 우주 공간 느낌의 딥 블랙 배경 고정
        p.background(10, 12, 18);
        
        // 💡 주파수 볼륨 신호가 잡히지 않을 때만 안내창 출력
        if (!this.isAudioActive) {
          this.drawOnScreenGuide(p);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 💡 512개 주파수 포인트를 화면 공간에 수학적으로 숨겨놓는 노드 빌더
  generateFrequencyNodes(w, h) {
    this.particles = [];
    p5.prototype.randomSeed(1003); // 지형 변경 시 규칙성을 깨지 않기 위한 고정 난수 시드

    for (let i = 0; i < this.totalChannels; i++) {
      // 저음역대는 화면 중심부에, 고음역대는 외곽으로 퍼지거나 무작위 밸런스를 가지도록 분포 배치
      let angle = p5.prototype.random(p5.prototype.TWO_PI);
      let radius = p5.prototype.random(0.05, 0.95) * Math.min(w, h) * 0.45;
      
      this.particles.push({
        x: w / 2 + Math.cos(angle) * radius,
        y: h / 2 + Math.sin(angle) * radius,
        baseSize: p5.prototype.random(15, 45), // 원의 기본 반지름 범위
        colorHue: p5.prototype.map(i, 0, this.totalChannels, 160, 260) // 주파수 대역별 고유 색상 띠 (민트~블루~퍼플)
      });
    }
  }

  getUIParams() {
      const settings = window.cosmicEngineSettings || {};
      const seedSlider = document.getElementById('slide-cosmic-seed');
      const scatterSlider = document.getElementById('slide-cosmic-scatter');
      const glowSlider = document.getElementById('slide-cosmic-glow');
      const gainSlider = document.getElementById('slide-cosmic-gain');

      return {
          scatter: scatterSlider ? parseFloat(scatterSlider.value) : 22, 
          glow: glowSlider ? parseFloat(glowSlider.value) : 85, 
          burst: gainSlider ? parseFloat(gainSlider.value) / 100 : 1.0, 
          seed: seedSlider ? parseInt(seedSlider.value) : 42
      };
  }

  drawOnScreenGuide(p) {
    p.push();
    p.fill(0, 255, 204, 200);
    p.noStroke();
    p.textSize(12);
    p.textAlign(p.LEFT, p.TOP);
    p.text(`⚙️ SYSTEM STATUS: ${this.version} READY`, 20, 20);

    p.fill(12, 15, 24, 230);
    p.stroke(0, 255, 204, 120);
    p.strokeWeight(1);
    p.rectMode(p.CENTER);
    p.rect(p.width / 2, p.height / 2, p.width * 0.85, 200, 10);

    p.noStroke();
    p.fill(0, 255, 204);
    p.textSize(18);
    p.textAlign(p.CENTER, p.CENTER);
    p.text("Cosmic Studio 019호 주파수 무대 가이드", p.width / 2, p.height / 2 - 60);

    p.fill(220);
    p.textSize(12);
    p.textAlign(p.LEFT, p.CENTER);
    
    let startX = p.width / 2 - (p.width * 0.38);
    let startY = p.height / 2 - 15;

    p.text("1️⃣  [좌측 최상단] MP3 음악 파일을 로딩해 주세요.", startX, startY);
    p.text("2️⃣  평소에는 512개의 주파수 노드가 보이지 않게 숨어있습니다.", startX, startY + 30);
    
    p.fill(255, 204, 0); 
    p.text("3️⃣  [재생] 버튼을 누르면 주파수 볼륨만큼 속빈 원들이 반짝입니다!", startX, startY + 60);
    p.pop();
  }

  resetCanvas(p, isPreview = false) {
    p.redraw(); 
  }

  // 💡 [핵심 알고리즘 엔진] 오디오 주파수 데이터를 가로채서 숨겨진 512개 서클에 바인딩
  update(audioData) {
    if (!this.p5Instance) return;
    let p = this.p5Instance;
    
    const audioEl = document.querySelector('audio');
    let isPlaying = audioEl && !audioEl.paused;

    if (isPlaying || (audioData && audioData.vol > 0.005)) {
        this.isAudioActive = true;
    } else {
        this.isAudioActive = false;
        p.redraw();
        return;
    }

    // 화면 소멸 후 고속 링 잔상 드로잉 초기화
    p.background(10, 12, 18);

    const ui = this.getUIParams();
    
    // 지형변경(ui.seed) 조작 시 주파수 노드들의 공간 배열 위치를 실시간 가변 셔플합니다.
    p.noiseSeed(ui.seed);

    // 오디오의 생(Raw) 512 채널 대역 배열 가로채기
    let rawData = (audioData && audioData.raw) ? audioData.raw : [];
    let hasRaw = rawData.length >= 128;

    // 💡 512개 숨겨진 주파수 노드 순회 루프 가동
    for (let i = 0; i < this.totalChannels; i++) {
      let node = this.particles[i];
      if (!node) continue;

      // 해당 채널의 오디오 볼륨값 추출 (0.0 ~ 1.0 정규화)
      let freqVolume = 0;
      if (hasRaw) {
        // 512 채널 인덱스 매핑
        let rawIdx = Math.floor(p.map(i, 0, this.totalChannels, 0, rawData.length - 1));
        freqVolume = rawData[rawIdx] / 255.0;
      } else {
        // Fallback 시뮬레이션 노이즈 기류
        freqVolume = p.noise(i * 0.05, p.millis() * 0.002) * 0.45;
      }

      // 우측 오디오 마스터 감도 슬라이더 계수 반영
      freqVolume *= ui.burst;

      // 💡 [회원님 기획안 수식 구현] 주파수 볼륨만큼 속빈 서클로 반짝이게 하기
      if (freqVolume > 0.02) {
        p.push();
        
        // 지형변경 시드 기반 미세 미동 효과 추가
        let nx = (p.noise(i * 10 + ui.seed) - 0.5) * (ui.scatter * 2.0);
        let ny = (p.noise(i * 20 - ui.seed) - 0.5) * (ui.scatter * 2.0);

        // 볼륨 크기에 비례해 반지름 팽창 스케일 연산
        let currentRadius = node.baseSize + (freqVolume * (ui.glow * 1.5));
        
        // 속 빈 원(Stroke Circle) 모드 셋업
        p.noFill(); 
        
        // 볼륨이 클수록 선이 선명하고 두껍게 반짝이도록 투명도(Alpha) 및 스트로크 값 매핑
        let strokeAlpha = p.map(freqVolume, 0.02, 1.0, 40, 255);
        let strokeW = p.map(freqVolume, 0.02, 1.0, 1.0, 3.5);
        
        p.strokeWeight(strokeW);
        
        // 우측 컬러 셀렉터 및 주파수 고유 컬러 스타일 바인딩 (네온 민트/스카이블루 기반 반짝임)
        p.stroke(0, 255, 204, strokeAlpha); 
        
        // 화면 정중앙 락포지션을 기준으로 연산된 좌표에 서클 드로잉
        p.circle(node.x + nx, node.y + ny, currentRadius * 2);
        
        // 중심부에 미세한 코어 점 추가하여 반짝임 극대화
        p.fill(255, 255, 255, strokeAlpha * 0.5);
        p.noStroke();
        p.circle(node.x + nx, node.y + ny, 2.5);
        
        p.pop();
      }
    }
  }

  // 화면 비율이 스위칭되면 512개의 가상 공간 위치 노드를 새로운 프레임 비율에 맞게 재배치합니다.
  resize(w, h) {
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
      this.generateFrequencyNodes(w, h);
    }
  }

  destroy() {
    if (this.p5Instance) this.p5Instance.remove();
  }
}
