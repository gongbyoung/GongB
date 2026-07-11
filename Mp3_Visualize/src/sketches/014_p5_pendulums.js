/**
 * src/sketches/014_p5_pendulums.js
 * - [버전] Ver 2.5 (공명의 잔상 Resonant Echoes - 명상형 5채널 앰비언트 오르브 완결판)
 * - 딱딱한 물리 충돌 공과 줄 메커니즘을 전면 철폐하고 유기적인 빛의 구체(Fluid Orbs) 시스템 전개
 * - 베이스 음에 맞춰 5개의 구체가 숨을 쉬듯 천천히 수축 팽창하며 파동이 옆으로 전이되는 연출 완수
 * - 최고점 타격 후 끈적하고 부드럽게 복원되는 0.06 초저속 롱 디케이(Long Decay) 이징 댐핑 구축
 * - 3D Position Offset X, Y, Z 입력 박스 연동을 통한 가상 카메라의 최면적 유영(Hypnotic Drift) 시프팅
 * - 관제탑 Color Style Palette(No1~No5) 색상 필터 및 현재 수치 즉시 적용 (RESET) 파이프라인 완벽 바인딩
 */

export default class P5Pendulums {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numOrbs = 5; // 5개의 몽환적인 가스 질감 빛 구체 배열
    this.orbs = [];
    this.currentAudioData = null;
    
    this.cameraDrift = 0;
    this.cameraZoom = 1.0;
    this.currentMode = "공명의 잔상";
    this.version = "Resonant Echoes Ambient Ver 2.5";
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

    console.log(`%c[🔮 014호 공명의 잔상 엔진 가동] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.noLoop(); 

        // 💡 물리 구체 상태 데이터 초기 빌드
        this.orbs = [];
        for (let i = 0; i < this.numOrbs; i++) {
          this.orbs.push({
            smoothedSize: 0,
            pulsePhase: p.random(360),
            rippleEnergy: 0
          });
        }
      };

      p.draw = () => {
        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;

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
          gauge = window.cosmicEngineSettings.gaugeValue || 0.5;
          
          offX = window.cosmicEngineSettings.positionOffset?.x || 0;
          offY = window.cosmicEngineSettings.positionOffset?.y || 0;
          offZ = window.cosmicEngineSettings.positionOffset?.z || 0;
        }

        p.noiseSeed(seed);

        // 💡 [개선안 3: 배경 캔버스] 완전 블랙 탈피 -> 부드러운 한지/새벽녘 감성 대지 음영 캔버스 전개
        p.noStroke();
        ctx.shadowBlur = 0;
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#0a0d14');   // 어스름한 깊은 네이비
        bgGrad.addColorStop(0.5, '#10141f'); // 실키한 새벽 밤하늘
        bgGrad.addColorStop(1, '#06080d');   // 편안한 심해 암부
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // 잉크 잔상 효과 필터 한 겹 오버레이 (Gauge와 연동하여 진하기 제어)
        let alphaFade = p.map(gauge, 0, 1, 35, 8);
        p.fill(10, 14, 22, alphaFade);
        p.rect(0, 0, width, height);

        // 오디오 리소스 피딩 분산
        let rawData = [];
        if (this.currentAudioData && this.currentAudioData.raw) {
          rawData = this.currentAudioData.raw;
        }

        let bass = this.currentAudioData ? (this.currentAudioData.bass || 0.1) : 0.1;
        let mid = this.currentAudioData ? (this.currentAudioData.mid || 0.1) : 0.1;

        const timeFactor = p.frameCount * 0.2;

        // 💡 [반응의 템포 조절]: 0.06 초저속 댐핑 스무딩 및 공명 전이(Ripple) 물리 루프
        for (let i = 0; i < this.numOrbs; i++) {
          let pt = this.orbs[i];
          pt.pulsePhase += 0.5;

          // 채널 분할에 맞춘 주파수 수혈 (저음역 중심)
          let freqIdx = p.floor(p.map(i, 0, this.numOrbs, 3, 45));
          let rawVal = (rawData && rawData[freqIdx]) ? rawData[freqIdx] / 255.0 : 0.0;
          
          // 베이스 및 선율의 강도를 증폭 계수와 융합
          let targetVolume = rawVal * gain * 1.5;
          
          // 💥 최고점을 찍은 후 물 흐르듯 유연하게 움직이는 롱 디케이 이징 적용
          pt.smoothedSize += (targetVolume - pt.smoothedSize) * 0.06;

          // 옆 구체로 부드럽게 번져나가는 파동 전이 에너지 연산
          let nextIdx = (i + 1) % this.numOrbs;
          if (this.orbs[nextIdx]) {
            this.orbs[nextIdx].rippleEnergy += (pt.smoothedSize - this.orbs[nextIdx].rippleEnergy) * 0.02;
          }
        }

        // 💡 [개선안 2: 깊이감과 카메라 무브먼트] 
        // 3D Offset 조작계 및 느린 호흡의 최면적 줌인 유영(Hypnotic Drift) 자동 카메라 탑재
        this.cameraDrift += 0.03;
        this.cameraZoom = p.map(glow, 10, 250, 0.4, 2.0) + p.sin(this.cameraDrift * 0.3) * 0.04 - (bass * 0.02);

        let camX = (width / 2) + (offX * 2.0);
        let camY = (height / 2) + (offY * -2.0);

        p.push();
        p.translate(camX, camY);
        p.scale(this.cameraZoom);
        p.rotate(p.sin(this.cameraDrift * 0.2) * 1.5 + offZ * 4.0); // Z축 제어 시 회전 변위

        // 💡 [Color Style Palette 5대 명상 테마 그라데이션 브러시 인터페이스 완수]
        let c1, c2;
        if (colorStyle === 'monochrome') {
            // No1 : 은은하고 차분한 모스 그린
            c1 = p.color('#2b4c3b'); c2 = p.color('#5eb88b');
            ctx.shadowColor = 'rgba(94, 184, 139, 0.45)';
        } else if (colorStyle === 'neon') {
            // No2 : 따뜻하고 화사한 샌드 베이지
            c1 = p.color('#bfa588'); c2 = p.color('#fcf9f2');
            ctx.shadowColor = 'rgba(252, 249, 242, 0.45)';
        } else if (colorStyle === 'pastel') {
            // No3 : 깊은 대지 / 라벤더 새벽녘 톤
            c1 = p.color('#222d3d'); c2 = p.color('#e0b6aa');
            ctx.shadowColor = 'rgba(224, 182, 170, 0.45)';
        } else if (colorStyle === 'custom') {
            // No4 : 커스텀 매립 픽커 색상
            c1 = p.color(customColors.gas1); c2 = p.color(customColors.gas2);
            ctx.shadowColor = customColors.star;
        } else {
            // No5 : 올 랜덤 아날로그 컬러 시프팅
            p.randomSeed(seed + 66);
            c1 = p.color(p.random(80, 160), p.random(120, 220), 255);
            c2 = p.color(255, p.random(130, 240), p.random(90, 180));
            ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
        }

        // 💡 [Range 연동]: scatter(Range) 항목 수치를 몽환적인 안개 발광의 두께로 다이렉트 매핑
        ctx.shadowBlur = p.map(scatter, 5, 50, 10, 85);

        // 5개 구체의 정갈한 가로 정렬선 간격 계산
        let totalWidth = width * 0.62;
        let startX = -totalWidth / 2;
        let spacing = totalWidth / (this.numOrbs - 1);

        // 1단계: 구체들을 잇는 미세한 빛의 가스(Tendrils) 및 안개 줄 드로잉
        p.strokeWeight(1.5);
        for (let i = 0; i < this.numOrbs - 1; i++) {
          let x1 = startX + i * spacing;
          let x2 = startX + (i + 1) * spacing;
          
          let pt1 = this.orbs[i];
          let pt2 = this.orbs[i + 1];
          
          let y1 = p.sin(pt1.pulsePhase) * 12 + (pt1.smoothedSize * 8);
          let y2 = p.sin(pt2.pulsePhase) * 12 + (pt2.smoothedSize * 8);
          
          // 빛의 띠 연결선
          let lineCol = p.lerpColor(c1, c2, i / (this.numOrbs - 1));
          lineCol.setAlpha(45);
          p.stroke(lineCol);
          p.noFill();
          
          // 안개처럼 휘어지는 부드러운 흐름선 묘사
          p.beginShape();
          p.curveVertex(x1, y1);
          p.curveVertex(x1, y1);
          p.curveVertex(p.lerp(x1, x2, 0.5), (y1 + y2) * 0.5 + p.noise(i, timeFactor) * 20 - 10);
          p.curveVertex(x2, y2);
          p.curveVertex(x2, y2);
          p.endShape();
        }

        // 2단계: 유기적 포그 글로우 빛의 구체(Light Orbs) 드로잉
        p.noStroke();
        for (let i = 0; i < this.numOrbs; i++) {
          let pt = this.orbs[i];
          let x = startX + i * spacing;
          
          // 자연스러운 자율 위상 펄스와 주파수 에너지가 결합된 부드러운 호흡 반경
          let baseSize = p.map(glow, 10, 250, 25, 110);
          let breathingRadius = baseSize + (pt.smoothedSize * 95) + (pt.rippleEnergy * 45) + p.sin(pt.pulsePhase * 2) * 6;
          
          let currentY = p.sin(pt.pulsePhase) * 12 + (pt.smoothedSize * 8);
          
          // 그라데이션 채도 컬러 변환
          let orbColor = p.lerpColor(c1, c2, i / (this.numOrbs - 1));
          
          // 💡 [개선안 1: 초점의 변화 및 안개 질감] 
          // 구체 정중앙에서 외곽으로 은은하게 퍼져나가는 멀티 레이어 잉크 안개 분산 시공
          ctx.save();
          let radialGrad = ctx.createRadialGradient(x, currentY, 2, x, currentY, breathingRadius * 0.5);
          radialGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)'); // 심지 코어 흰색 분출
          radialGrad.addColorStop(0.2, orbColor.toString());
          
          // 외곽으로 갈수록 아웃포커싱 렌즈 블러 느낌으로 스며들듯 소멸
          let edgeAlpha = p.map(p.dist(x, currentY, 0, 0), 0, width * 0.5, 0.18, 0.02);
          radialGrad.addColorStop(0.8, `rgba(${p.red(orbColor)}, ${p.green(orbColor)}, ${p.blue(orbColor)}, ${edgeAlpha})`);
          radialGrad.addColorStop(1, 'rgba(0,0,0,0)');
          
          ctx.fillStyle = radialGrad;
          p.ellipse(x, currentY, breathingRadius * 1.5);
          ctx.restore();
        }

        p.pop(); // 카메라 복귀
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  update(audioData) {
    if (!this.p5Instance) return;
    this.currentAudioData = audioData;
    this.p5Instance.redraw();
  }

  resize(w, h) {
    if (this.p5Instance) this.p5Instance.resizeCanvas(w, h);
  }

  destroy() {
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }
    this.orbs = [];
    this.currentAudioData = null;
  }
}
