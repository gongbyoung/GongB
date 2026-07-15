/**
 * src/sketches/021_p5_vfx_flower.js
 * - [버전] Ver 1.0 (EffectTextureMaker 극좌표 꽃 텍스처 이식판)
 * - 이징 매커니즘: 직교 좌표를 Polar(극좌표) 공간으로 왜곡 변환하여 완벽한 기하학 꽃잎(Petals) 구현
 * - 이미지 가속 마운트: window.currentUploadedImageElement 자산을 p.drawingContext.drawImage로 기저 배경에 투사
 * - 관제탑 인터페이스 무결점 직결 매핑 레일:
 *   • Shuffle(seed)           : 꽃잎의 기초 노이즈 무작위 변이 위상 시프트
 *   • Range(scatterExponent)  : 다단으로 중첩되는 레이어 꽃잎 간의 가로세로 간격 및 팽창 스케일 지배
 *   • Scale(glowIntensity)    : 꽃잎 윤곽선의 시각적 두께(Thickness) 및 네온 글로우 반경 튜닝
 *   • Volume(audioGain)       : 주파수 유입 시 꽃잎이 개화(Blooming)하며 요동치는 회전 진폭 민감도 증폭
 *   • Gauge(gaugeValue)       : 수학적 장미 곡선(Rose Curve) 연산을 통한 꽃잎의 총 개수(Petal Count) 제어
 * - 014호 테마 동기화: 흑백, 야광흰색, 그림자검은색, 커스텀3색, 올랜덤 컬러 컬렉션 이식 완료
 */

export default class P5VfxFlowerStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.currentAudioData = null;
    this.version = "021호 VFX Polar Flower Ver 1.0";
    this.isAudioActive = false;

    this.flowerTime = 0;
    this.lastTime = 0;
    this.smoothVol = 0;
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

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        p.pixelDensity(1);
        p.colorMode(p.HSB, 360, 100, 100, 255); 
        p.noLoop();
      };

      p.draw = () => {
        p.clear();
        const ctx = p.drawingContext;

        // 관제탑 UI 파라미터 안전 디코딩
        let seed = 42, scatter = 22, glow = 85, gain = 100, gauge = 50;
        let colorStyle = 'neon';
        let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

        if (window.cosmicEngineSettings) {
          seed = window.cosmicEngineSettings.seed || 42;
          scatter = window.cosmicEngineSettings.scatterExponent || 2.2; 
          gain = window.cosmicEngineSettings.audioGain || 1.0;          
          glow = window.cosmicEngineSettings.glowIntensity || 0.85;
          customColors = window.cosmicEngineSettings.customColors || customColors;
          colorStyle = window.cosmicEngineSettings.colorStyle || 'neon';
          gauge = window.cosmicEngineSettings.gaugeValue || 0.5;
        }

        // 💡 [요청 기능 1]: HTML5 Native 이미지 가속 최하단 배경 시공
        if (window.currentUploadedImageElement) {
          ctx.drawImage(window.currentUploadedImageElement, 0, 0, p.width, p.height);
        } else {
          // 배경이 없을 때의 명상형 리프팅 다크 블루 그라데이션
          p.noStroke();
          const bgGrad = ctx.createLinearGradient(0, 0, 0, p.height);
          bgGrad.addColorStop(0, '#04060d');
          bgGrad.addColorStop(1, '#0b0f1f');
          ctx.fillStyle = bgGrad;
          p.rect(0, 0, p.width, p.height);
        }

        // 오디오 에너지 트래킹 및 감쇠 보간
        let rawVol = this.currentAudioData ? (this.currentAudioData.vol || 0.0) : 0.0;
        let smoothBass = this.currentAudioData ? (this.currentAudioData.bass || 0.0) : 0.0;
        let smoothMid = this.currentAudioData ? (this.currentAudioData.mid || 0.0) : 0.0;
        let smoothTreble = this.currentAudioData ? (this.currentAudioData.treble || 0.0) : 0.0;

        let volumeGainScale = p.map(gain, 10, 500, 0.15, 4.5);
        if (gain <= 5.0) volumeGainScale = gain; 

        this.smoothVol += (rawVol * volumeGainScale - this.smoothVol) * 0.08;
        this.flowerTime += 0.01 + (this.smoothVol * 0.02);

        // 💡 [요청 기능 2: EffectTextureMaker 극좌표 꽃 변환 수식 정의]
        // 1) Gauge 연동 -> 꽃잎의 총 개수 스케일링 결정 (0~100 수치를 3~16개 꽃잎으로 치환)
        let gaugeRaw = gauge > 1 ? gauge : gauge * 100;
        let petalCount = p.floor(p.map(gaugeRaw, 0, 100, 3, 16));
        // 장미 곡선 특성 상 짝수/홀수 꽃잎 균형 보정
        if (petalCount % 2 === 0) petalCount /= 2; 

        // 2) Scale 연동 -> 꽃잎 선의 두께 및 네온 글로우 스위칭
        let glowRaw = glow > 5 ? glow : glow * 100;
        let strokeThickness = p.map(glowRaw, 10, 250, 0.5, 12.0);

        // 3) Range 연동 -> 꽃잎들의 중심원점 기준 레이어 번짐 정렬 간격
        let scatterRaw = scatter > 5 ? scatter : scatter * 10;
        let spreadLayerRadius = p.map(scatterRaw, 5, 50, 45, 260);

        // 4) Shuffle 연동 -> 노이즈 마스크 변이 난수 시드 고정
        p.noiseSeed(seed);

        let centerX = p.width / 2;
        let centerY = p.height / 2;

        // 💡 014호 공통 5대 명품 컬러 파레트 환경 믹싱 수혈
        let c1, c2, c3;
        p.push();
        p.translate(centerX, centerY);

        ctx.save();
        ctx.shadowBlur = 0;

        if (colorStyle === 'monochrome') {
          c1 = p.color(0, 0, 100, 255); c2 = p.color(0, 0, 80, 180); c3 = p.color(0, 0, 100, 255);
          p.stroke(255);
        } else if (colorStyle === 'neon') {
          c1 = p.color(180, 80, 95, 225); c2 = p.color(140, 90, 100, 150); c3 = p.color(0, 0, 100, 255);
          p.stroke(255);
          ctx.shadowBlur = strokeThickness * 3.5;
          ctx.shadowColor = 'rgba(0, 255, 204, 0.9)';
        } else if (colorStyle === 'pastel') {
          // 그림자 검은색 모드: 물속 묵직한 수묵 잉크 꽃 텍스처 연출
          c1 = p.color(220, 90, 15, 240); c2 = p.color(240, 95, 8, 160); c3 = p.color(220, 80, 12, 255);
          p.stroke(10, 15, 28);
          ctx.shadowBlur = 15;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        } else if (colorStyle === 'custom') {
          c1 = p.color(customColors.gas1); c2 = p.color(customColors.gas2); c3 = p.color(customColors.star);
          ctx.shadowBlur = 10;
          ctx.shadowColor = customColors.star;
        } else {
          // 올 랜덤 컬러 모드
          p.randomSeed(seed + 77);
          c1 = p.color(p.random(360), 85, 95, 220);
          c2 = p.color(p.random(360), 80, 90, 140);
          c3 = p.color(p.random(360), 90, 100, 255);
        }

        p.strokeWeight(strokeThickness);
        p.noFill();

        // 💡 [VFX 마스터 하이라이트]: 3중 다단 극좌표 기하학 루프 구동 (저, 중, 고음 레이어 독립 적층)
        const totalLayers = 3;
        for (let l = 0; l < totalLayers; l++) {
          let layerMultiplier = (l + 1) / totalLayers;
          let currentBaseRadius = spreadLayerRadius * layerMultiplier * (0.6 + this.smoothVol * 0.4);
          
          // 대역별 개별 주파수 요동 바인딩
          let freqImpulse = smoothMid;
          if (l === 0) { p.stroke(c1); freqImpulse = smoothBass; }
          else if (l === 1) { p.stroke(c2); freqImpulse = smoothMid; }
          else { p.stroke(c3); freqImpulse = smoothTreble; }

          p.beginShape();
          // 360도 극좌표 회전 변환 드로우 루프 실행
          for (let a = 0; a <= p.TWO_PI + 0.05; a += 0.04) {
            // 직교 공간 좌표계 투사
            let cosA = p.cos(a);
            let sinA = p.sin(a);

            // 💡 [EffectTextureMaker 핵심 식]: 극좌표 축 고유 펄린 노이즈 난류 주입 (원형 래핑)
            let noiseX = cosA * 1.5 + seed;
            let noiseY = sinA * 1.5 + this.flowerTime * (1.0 - l * 0.2);
            let proceduralNoise = p.noise(noiseX, noiseY) * (freqImpulse * volumeGainScale * 120.0);

            // 장미 곡선 꽃잎 기하학 파동 결합 식
            let flowerPetalWave = p.sin(a * petalCount + this.flowerTime * 1.5) * (currentBaseRadius * 0.45);
            
            // 최종 극좌표 합성 지름 산출
            let finalRadius = currentBaseRadius + flowerPetalWave + proceduralNoise;

            let x = cosA * finalRadius;
            let y = sinA * finalRadius;

            p.vertex(x, y);
          }
          p.endShape();
        }

        ctx.restore();
        p.pop();

        // 시스템 진단 HUD 실시간 바인딩 스트리밍
        if (!this.lastTime) this.lastTime = performance.now();
        let now = performance.now();
        let fps = Math.round(1000 / (now - this.lastTime));
        this.lastTime = now;

        window.sketchDiagnostics = {
          fps: isNaN(fps) || fps > 100 ? 30 : fps,
          particleCount: petalCount + " Active Petals",
          isCovering: false,
          activeFunction: window.currentUploadedImageElement ? "PolarFlower[BG_Active]" : "PolarFlower[Core_Active]"
        };
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  update(audioData) {
    if (!this.p5Instance) return;
    this.currentAudioData = audioData;
    this.p5Instance.redraw();
  }

  resize(w, h) { if (this.p5Instance) this.p5Instance.resizeCanvas(w, h); }

  destroy() {
    if (this.p5Instance) { this.p5Instance.remove(); this.p5Instance = null; }
    this.currentAudioData = null;
  }
}
