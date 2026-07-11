/**
 * src/sketches/010_p5_datawave_512.js
 * - [버전] Ver 2.0 (새벽 안개 속 빛의 파도 - 명상형 512채널 오로라 완결판)
 * - 날카로운 지그재그 직선 파형을 완전 유기적인 스플라인 곡선(p.curveVertex) 파도로 대개조
 * - 즉각적인 칼반응 노이즈를 필터링하고 0.05의 극도로 부드러운 롱 디케이(Long Decay) 이징 댐핑 구축
 * - 전경, 중경, 원경의 3중 레이어링(Multi-Layer) 및 외곽부 아웃포커싱 렌즈 블러 질감 묘사
 * - 관제탑 Color Style Palette(No1~No5) 색상 필터 및 현재 수치 즉시 적용 (RESET) 파이프라인 완벽 바인딩
 */

export default class P5DataWave512 {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numBands = 512;
    this.smoothedFreq = new Float32Array(this.numBands);
    this.currentAudioData = null;

    this.bgImageEl = null;
    this.currentImageSrc = null;
    
    this.cameraAngle = 0;
    this.cameraZoomTime = 0;
    this.currentMode = "새벽 안개 속 빛의 파도";
    this.version = "Ambient Ocean Wave Ver 2.0";
  }

  async init() {
    if (!window.p5) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    // 배경 이미지 레이어 셋업
    this.bgImageEl = document.createElement('img');
    this.bgImageEl.style.position = 'absolute';
    this.bgImageEl.style.top = '0';
    this.bgImageEl.style.left = '0';
    this.bgImageEl.style.width = '100%';
    this.bgImageEl.style.height = '100%';
    this.bgImageEl.style.objectFit = 'cover';
    this.bgImageEl.style.opacity = '0.35'; // 몽환적인 성운/풍경 조화를 위해 최적화 조정
    this.bgImageEl.style.zIndex = '0';
    this.container.appendChild(this.bgImageEl);

    console.log(`%c[🔮 010호 앰비언트 파도 엔진 가동] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.noLoop(); 
        
        // 💡 RESET 구동 즉시 현재 관제탑의 무작위 노이즈 시드를 고정 수혈
        if (window.cosmicEngineSettings) {
            p.noiseSeed(window.cosmicEngineSettings.seed || 42);
        }
      };

      p.draw = () => {
        p.clear();

        // 💡 관제탑 프리셋 실시간 하드웨어 변수 동기화 인터셉트
        let seed = 42, scatter = 22, glow = 85, gain = 100, gauge = 50;
        let offX = 0, offY = 0, offZ = 0;
        let colorStyle = 'neon';
        let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

        if (window.cosmicEngineSettings) {
          seed = window.cosmicEngineSettings.seed || 42;
          scatter = window.cosmicEngineSettings.scatterExponent || 2.2; 
          gain = window.cosmicEngineSettings.audioGain || 1.0;          
          glow = window.cosmicEngineSettings.glowIntensity || 0.85;
          customColors = window.cosmicEngineSettings.customColors || customColors;
          colorStyle = window.cosmicEngineSettings.colorStyle || 'neon';
          gauge = window.cosmicEngineSettings.gaugeValue || 0.5; // 채도 조절용
          
          offX = window.cosmicEngineSettings.positionOffset?.x || 0;
          offY = window.cosmicEngineSettings.positionOffset?.y || 0;
          offZ = window.cosmicEngineSettings.positionOffset?.z || 0;
        }

        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;

        // 오디오 리소스 피딩 안전 예외 처리 및 기저 파동 가동
        let rawData = new Float32Array(this.numBands);
        let bass = 0.1;
        if (this.currentAudioData && this.currentAudioData.raw) {
            rawData = this.currentAudioData.raw;
            bass = this.currentAudioData.bass || 0.1;
        }

        // 💡 [반응의 템포 조절]: 0.05 초저속 댐핑 스mu딩 및 자잘한 고음 노이즈 필터링
        for (let i = 0; i < this.numBands; i++) {
          let rawVal = rawData[i] || 0;
          let normalized = rawVal / 255.0;
          if (normalized < 0.04) normalized = 0; // 노이즈 게이트

          // 고음역의 자잘한 떨림은 완만하게 댐핑 스케일 억제
          let deEmphasis = 1.0 + Math.sin((i / this.numBands) * p.PI) * 0.5;
          let targetFreq = Math.pow(normalized, 1.8) * gain * deEmphasis * 160; 

          // 💥 끈적한 이징 여운(Decay) 처리
          if (targetFreq > this.smoothedFreq[i]) {
            this.smoothedFreq[i] += (targetFreq - this.smoothedFreq[i]) * 0.12;
          } else {
            this.smoothedFreq[i] += (targetFreq - this.smoothedFreq[i]) * 0.05; // 부드럽게 가라앉는 시간 증폭
          }
        }

        // 💡 [시간과 공간의 확장]: 3D 카메라 오프셋 정면(0,0,0) 기준 앵글 유영 유도 무브먼트
        this.cameraAngle += 0.05;
        this.cameraZoomTime += 0.004;
        
        let camX = (width / 2) + (offX * 2.0);
        let camY = (height / 2) + (offY * -2.0);
        
        p.push();
        p.translate(camX, camY);
        
        // u_scale 개념의 전체 지름 크기 조정 및 Z축 줌 무브먼트 바이어스 결합
        let scaleFactor = p.map(glow, 10, 250, 0.4, 2.2) + Math.sin(this.cameraZoomTime) * 0.05 - (bass * 0.03);
        p.scale(scaleFactor);
        p.rotate(this.cameraAngle + offZ * 5.0);

        const baselineY = 0; // 중심점 기준으로 파형 변환
        const timeFactor = p.frameCount * 0.2;

        // 💡 [Color Style Palette 5대 명상 테마 그라데이션 정밀 빌드]
        let c1, c2, c3;
        if (colorStyle === 'monochrome') {
            // No1 : 차분한 모스 그린 힐링 파도
            c1 = 'rgba(35, 66, 51, 0.45)'; c2 = 'rgba(92, 184, 135, 0.65)'; c3 = '#ffffff';
            ctx.shadowColor = 'rgba(92, 184, 135, 0.5)';
        } else if (colorStyle === 'neon') {
            // No2 : 따뜻한 샌드 베이지 아날로그 파도
            c1 = 'rgba(171, 145, 114, 0.45)'; c2 = 'rgba(245, 240, 230, 0.65)'; c3 = '#ffffff';
            ctx.shadowColor = 'rgba(245, 240, 230, 0.5)';
        } else if (colorStyle === 'pastel') {
            // No3 : 은은한 대지 / 새벽녘 그라데이션
            c1 = 'rgba(31, 42, 56, 0.45)'; c2 = 'rgba(240, 191, 161, 0.65)'; c3 = '#ffffff';
            ctx.shadowColor = 'rgba(240, 191, 161, 0.5)';
        } else if (colorStyle === 'custom') {
            // No4 : 커스텀 픽커 파이프라인
            c1 = customColors.gas1 + '77'; c2 = customColors.gas2 + 'b1'; c3 = '#ffffff';
            ctx.shadowColor = customColors.star;
        } else {
            // No5 : 올 랜덤 시드 오로라 파도
            p.randomSeed(seed + 77);
            c1 = `rgba(${p.floor(p.random(100,200))}, ${p.floor(p.random(150,255))}, 255, 0.45)`;
            c2 = `rgba(255, ${p.floor(p.random(150,255))}, ${p.floor(p.random(100,200))}, 0.65)`;
            c3 = '#ffffff';
            ctx.shadowColor = 'rgba(255,255,255,0.4)';
        }

        // 💡 [Range 연동]: scatter(Range) 항목 수치를 몽환적인 안개 발광 블러의 강도로 매핑
        ctx.shadowBlur = p.map(scatter, 5, 50, 8, 75);

        // 💡 [개선안 j: 깊이감과 레이어링] 3중 투명 곡선 파도 오로라 렌더링 루프
        
        // 🌊 레이어 1: [원경] 몽환적인 아웃포커싱 심해 안개 파도 (가장 낮고 두껍게 일렁임)
        p.stroke(c1);
        p.strokeWeight(5 + gauge * 3); // Gauge 수치로 채도 및 두께 조절
        p.noFill();
        p.beginShape();
        // curveVertex 폐곡선 연결 유도 마진 루프
        for (let i = -4; i < this.numBands + 5; i++) {
          let idx = (i + this.numBands) % this.numBands;
          let x = p.map(i, 0, this.numBands - 1, -width * 0.6, width * 0.6);
          
          let waveNoise = p.noise(i * 0.02, timeFactor) * 45;
          let y = baselineY - (this.smoothedFreq[idx] * 0.7) + waveNoise - 40;
          p.curveVertex(x, y);
        }
        p.endShape();

        // 🌊 레이어 2: [중경] 은은한 안개 빛무리 오로라 파도 (중간 깊이)
        p.stroke(c2);
        p.strokeWeight(3.0);
        p.beginShape();
        for (let i = -4; i < this.numBands + 5; i++) {
          let idx = (i + this.numBands) % this.numBands;
          let x = p.map(i, 0, this.numBands - 1, -width * 0.6, width * 0.6);
          
          let waveNoise = p.noise(i * 0.03, timeFactor + 40) * 30;
          let y = baselineY - (this.smoothedFreq[idx] * 1.0) + waveNoise;
          p.curveVertex(x, y);
        }
        p.endShape();

        // 🌊 레이어 3: [전경] 부드러운 코어 소프트 라인 (선명한 에코 심지)
        ctx.shadowBlur = 0; // 코어 중심선은 선명하게 홀딩하여 입체 시각 쉼터 제공
        p.stroke(c3);
        p.strokeWeight(1.2);
        p.beginShape();
        for (let i = -4; i < this.numBands + 5; i++) {
          let idx = (i + this.numBands) % this.numBands;
          let x = p.map(i, 0, this.numBands - 1, -width * 0.6, width * 0.6);
          
          let waveNoise = p.noise(i * 0.03, timeFactor + 40) * 30;
          let y = baselineY - (this.smoothedFreq[idx] * 1.0) + waveNoise;
          p.curveVertex(x, y);
        }
        p.endShape();

        p.pop(); // 가상 카메라 공간계 반환
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  update(audioData) {
    if (!this.p5Instance) return;
    this.currentAudioData = audioData;

    if (window.currentUploadedImageElement) {
        if (this.currentImageSrc !== window.currentUploadedImageElement.src) {
            this.currentImageSrc = window.currentUploadedImageElement.src;
            this.bgImageEl.src = this.currentImageSrc;
        }
    }

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
