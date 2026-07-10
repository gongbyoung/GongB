/**
 * src/sketches/012_p5_ocean_wave_spaced.js
 * - [버전] Ver 7.5 (타악기·현악기 전용 주파수 분리 및 어택 물리 특화판)
 * - 9개의 공에 드럼/실로폰(타악기) 및 바이올린/첼로/비올라(현악기) 고유 주파수 밴드를 1:1 칼고정 할당
 * - 타악기 대역은 순간 팝업(Spike 어택), 현악기 대역은 부드러운 일렁임(Sustain 보간)으로 물리 반응 이원화 완수
 * - 관제탑 [RESET] 버튼 및 실시간 배경 이미지 틴트 엔진 완벽 유지
 */

export default class P5OceanWaveSpaced {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numBands = 9; 
    this.orbs = []; 
    this.numTracks = 9; 

    this.smoothedInput = new Float32Array(this.numBands);
    this.prevHeights = new Float32Array(this.numBands);
    
    this.currentAudioData = null;
    this.loadedSeed = -1;
    this.currentMode = "공명 바운스";
    this.version = "악기별 주파수 분리 물리 스튜디오 Ver 7.5";
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

    console.log(`%c[🔮 012호 오디오 매핑 정렬] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");
    console.log(
      `%c🎵 9채널 악기별 주파수 배치 리포트\n` +
      `• Orb 0: 🥁 베이스 드럼 (킥)  |  • Orb 1: 🥁 스네어 드럼\n` +
      `• Orb 2: 🎻 첼로 중저음       |  • Orb 3: 🎻 비올라 중음\n` +
      `• Orb 4: 🎻 바이올린 주선율   |  • Orb 5: 🎼 실로폰 고음 타격\n` +
      `• Orb 6: 🎻 바이올린 화려배음 |  • Orb 7: 🥁 하이햇/심벌즈 찰랑임\n` +
      `• Orb 8: ✨ 초고음역 에어 감도`,
      "color: #aaff00; line-height: 1.5;"
    );

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.noLoop();
        
        let seed = 42;
        if (window.cosmicEngineSettings) {
          seed = window.cosmicEngineSettings.seed || 42;
        }

        p.randomSeed(seed);
        let modes = ["공명 바운스", "진자 웨이브", "무한 마블 런"];
        this.currentMode = modes[p.floor(p.random(modes.length))];
        console.log(`%c[⚡ RESET 물리 테이블] 활성화된 법칙: ${this.currentMode}`, "color: #00ffcc; font-weight: bold;");

        for (let i = 0; i < this.numBands; i++) {
          this.orbs.push({
            y: p.random(p.height * 0.2, p.height * 0.4),
            vy: 0,
            angle: 0
          });
        }
        this.loadedSeed = seed;
      };

      p.draw = () => {
        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;

        if (!this.currentAudioData) { p.clear(); ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, width, height); return; }

        let scatter = 22, gain = 100, glow = 85, seed = 42, gauge = 50;
        let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

        if (window.cosmicEngineSettings) {
          scatter = window.cosmicEngineSettings.scatterExponent || 2.2;
          gain = window.cosmicEngineSettings.audioGain || 1.0;
          glow = window.cosmicEngineSettings.glowIntensity || 0.85;
          seed = window.cosmicEngineSettings.seed || 42;
          gauge = window.cosmicEngineSettings.gaugeValue || 0.5;
          customColors = window.cosmicEngineSettings.customColors || customColors;
        }

        p.clear();

        if (window.currentUploadedImageElement) {
            ctx.drawImage(window.currentUploadedImageElement, 0, 0, width, height);
            ctx.fillStyle = 'rgba(12, 6, 24, 0.75)'; // 시인성을 위한 75% 앰비언트 블로킹 틴트
            ctx.fillRect(0, 0, width, height);
        } else {
            const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
            bgGrad.addColorStop(0, '#070014');
            bgGrad.addColorStop(0.5, '#120022');
            bgGrad.addColorStop(1, '#000000');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);
        }

        // 💡 [악기 주파수 대역 정밀 인덱싱 튜닝 부량]
        if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            const dataLen = this.currentAudioData.raw.length;
            
            // FFT 256/512 버퍼 기준 악기별 매핑 주파수 버킷 인덱스 정의
            // 0: 드럼킥, 1: 스네어, 2: 첼로, 3: 비올라, 4: 바이올린, 5: 실로폰, 6: 바올고음, 7: 하이햇, 8: 에어
            const instrumentIndices = [
                p.floor(dataLen * 0.02),  // 0: 베이스 드럼 (극저역)
                p.floor(dataLen * 0.05),  // 1: 스네어 드럼 (저역)
                p.floor(dataLen * 0.09),  // 2: 첼로 대역 (중저역)
                p.floor(dataLen * 0.15),  // 3: 비올라 대역 (중역)
                p.floor(dataLen * 0.25),  // 4: 바이올린 선율 (중고역)
                p.floor(dataLen * 0.40),  // 5: 실로폰 타격 (고역 선명도)
                p.floor(dataLen * 0.58),  // 6: 바이올린 배음 (초고역)
                p.floor(dataLen * 0.75),  // 7: 하이햇 / 심벌즈 (찰랑임)
                p.floor(dataLen * 0.90)   // 8: 에어 감도 대역
            ];

            for (let i = 0; i < this.numBands; i++) {
                let idx = p.constrain(instrumentIndices[i], 0, dataLen - 1);
                let rawVal = this.currentAudioData.raw[idx] || 0;
                let normalized = Math.pow(rawVal / 255.0, 1.6);
                
                let currentH = this.smoothedInput[i];
                let targetH = normalized * (gain * 1.6); 

                // 💡 [물리 가속도 이원화 팩 시공]
                // 타악기 채널(0, 1, 5, 7번)은 번개처럼 반응(0.45), 현악기 채널은 부드러운 일렁임 보간(0.15)
                let isPercussion = (i === 0 || i === 1 || i === 5 || i === 7);
                let lerpFactor = isPercussion ? 0.45 : 0.15;

                currentH += (targetH - currentH) * lerpFactor;
                this.smoothedInput[i] = currentH;
            }
        }

        const time = Date.now() * 0.0015;
        const orbSize = p.map(scatter, 5, 50, 12, 36); 
        const baseGlow = p.map(glow, 10, 250, 4, 32);  

        const spacing = p.map(scatter, 5, 50, width * 0.072, width * 0.1); 
        const totalW = (this.numTracks - 1) * spacing;
        const startX = (width - totalW) / 2;

        // 트랙선 레이아웃 드로잉
        p.strokeWeight(1);
        for (let i = 0; i < this.numTracks; i++) {
          let lineC = p.color(customColors.gas2);
          let x = startX + i * spacing;
          
          if (this.currentMode === "공명 바운스") {
              lineC.setAlpha(20); p.stroke(lineC);
              p.line(x, height * 0.1, x, height * 0.8);
          } else if (this.currentMode === "진자 웨이브") {
              p.beginShape(); p.noFill();
              lineC.setAlpha(30); p.stroke(lineC);
              for (let y = height * 0.15; y <= height * 0.85; y += 15) {
                  let yRatio = p.map(y, height * 0.15, height * 0.85, 0, p.PI * 2);
                  let guideX = x + p.sin(yRatio + time) * (spacing * 0.12); 
                  p.curveVertex(guideX, y);
              }
              p.endShape();
          } else if (this.currentMode === "무한 마블 런") {
              let lineC_2 = p.color(customColors.gas1);
              lineC_2.setAlpha(35); p.stroke(lineC_2);
              p.line(x, 0, x, height);
          }
        }

        p.noStroke();
        ctx.shadowBlur = baseGlow;
        ctx.shadowColor = customColors.star;

        // 9개 악기별 오어브 투사 루프
        for (let i = 0; i < this.numBands; i++) {
          let x = startX + i * spacing;
          let pt = this.orbs[i];
          let input = this.smoothedInput[i];
          
          // 악기 인덱스별 색상 스펙트럼 배합
          let orbColor = p.lerpColor(p.color(customColors.gas1), p.color(customColors.gas2), (i / 8.0));
          
          if (this.currentMode === "공명 바운스") {
            const gravity = 0.35 + (gauge * 0.006); 
            pt.vy += gravity;
            
            // 타악기 공들은 소리가 나면 하늘로 스프링처럼 다이내믹하게 팝업 도약
            let isPercussion = (i === 0 || i === 1 || i === 5 || i === 7);
            pt.vy -= input * (isPercussion ? 3.2 : 1.8); 
            pt.vy *= 0.96; 
            pt.y += pt.vy;

            if (pt.y > height * 0.8) {
              pt.y = height * 0.8;
              pt.vy = -pt.vy * 0.62; 

              // 바운스 타격 네온 스플래시
              ctx.shadowBlur = baseGlow * 2.5; ctx.shadowColor = orbColor;
              let flashC = p.lerpColor(orbColor, p.color(255), 0.5); p.fill(flashC);
              p.circle(x, pt.y, orbSize * 1.25);
              ctx.shadowBlur = baseGlow; ctx.shadowColor = customColors.star;
            } else if (pt.y < height * 0.1) { pt.y = height * 0.1; pt.vy = 0; }

            p.fill(orbColor);
            p.circle(x, pt.y, orbSize);
            
          } else if (this.currentMode === "진자 웨이브") {
            const pendulumBaseH = height * 0.35;
            const pivotY = height * 0.1;

            // 현악기는 활을 켜는 감각으로 줄의 길이가 소리에 맞춰 부드럽게 신축 수축
            let pendulumLen = pendulumBaseH + i * (spacing * 0.45) - input * 1.2;
            
            let phase = time * (0.65 + i * 0.065) + p.PI / 2; 
            let theta = p.sin(phase) * 0.45; 
            
            p.strokeWeight(1.5);
            let lineC = p.color(customColors.gas2); lineC.setAlpha(80); p.stroke(lineC);
            let pendX = x + p.sin(theta) * pendulumLen;
            let pendY = pivotY + p.cos(theta) * pendulumLen;
            
            p.line(x, pivotY, pendX, pendY);
            p.noStroke();
            
            p.fill(orbColor);
            ctx.shadowBlur = baseGlow; ctx.shadowColor = customColors.star;
            p.circle(pendX, pendY, orbSize * 1.05);
            
          } else if (this.currentMode === "무한 마블 런") {
            const railTop = -orbSize * 2;
            const railBottom = height + orbSize * 2;
            
            // 타악기 비트가 치고 나갈 때 해당 레일의 공이 미끄러지듯 순간 가속 질주
            let isPercussion = (i === 0 || i === 1 || i === 5 || i === 7);
            let currentVy = (gauge * 0.12) + 1.5 + (i * 0.35) + input * (isPercussion ? 3.5 : 1.4);
            pt.y += currentVy; 

            if (pt.y > railBottom) { pt.y = railTop; }

            p.fill(orbColor);
            ctx.shadowBlur = baseGlow; ctx.shadowColor = customColors.star;
            p.circle(x, pt.y, orbSize);
          }
        }
        
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
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
    }
  }

  destroy() {
    if (!this.p5Instance) return;
    this.p5Instance.remove();
    this.p5Instance = null;
    this.orbs = [];
    this.currentAudioData = null;
  }
}
