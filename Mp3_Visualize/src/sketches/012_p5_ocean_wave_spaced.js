/**
 * src/sketches/012_p5_ocean_wave_spaced.js
 * - [버전] Ver 7.6 (한 박자 정밀 오디오 타격 싱크 및 악기 스펙트럼 완결판)
 * - 단순 볼륨 감지를 탈피하고 직전 프레임 대비 변위 스파이크(Peak)를 역산하여 한 박자 한 박자 정확한 물리 타이밍 연동
 * - 타악기(실로폰, 드럼)의 날카로운 타격 순간 공들이 스프링처럼 즉각 튀어 오르는 어택 감도 극대화
 * - 관제탑 [RESET] 즉시 적용 시스템, 실시간 배경 이미지 로더 및 가독성 75% 틴트 쉴드 완벽 유지
 */

export default class P5OceanWaveSpaced {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numBands = 9; 
    this.orbs = []; 
    this.numTracks = 9; 

    this.smoothedInput = new Float32Array(this.numBands);
    
    // 💡 한 박자 정밀 싱크를 위해 직전 프레임의 주파수 값을 저장하는 버퍼 버킷
    this.audioHistory = new Float32Array(this.numBands);
    
    this.currentAudioData = null;
    this.loadedSeed = -1;
    this.currentMode = "공명 바운스";
    this.version = "한 박자 정밀 싱크 물리 스튜디오 Ver 7.6";
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

    console.log(`%c[🔮 012호 박자 동기화 가동] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");
    console.log(
      `%c🛠️ 박자 및 악기 정밀 제어 메뉴얼\n` +
      `• 실로폰 / 드럼 (타악기 대역) ➡️ 소리가 닿는 한 박자 단위로 공이 즉시 튕겨 나갑니다.\n` +
      `• 바이올린 / 첼로 (현악기 대역) ➡️ 활을 켜는 리듬과 음의 고저에 따라 부드러운 하모닉스 진동을 전개합니다.\n` +
      `• Shuffle 변경 후 [RESET] 클릭 시 모드가 무작위 교체됩니다.`,
      "color: #ffffff; line-height: 1.6;"
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
        console.log(`%c[⚡ RESET 계수 반영] 현재 물리 세계관: ${this.currentMode}`, "color: #00ffcc; font-weight: bold;");

        for (let i = 0; i < this.numBands; i++) {
          this.orbs.push({
            y: p.height / 2,
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

        // 배경화면 및 틴트
        if (window.currentUploadedImageElement) {
            ctx.drawImage(window.currentUploadedImageElement, 0, 0, width, height);
            ctx.fillStyle = 'rgba(11, 5, 23, 0.75)'; 
            ctx.fillRect(0, 0, width, height);
        } else {
            const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
            bgGrad.addColorStop(0, '#060012');
            bgGrad.addColorStop(0.5, '#110020');
            bgGrad.addColorStop(1, '#000000');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);
        }

        // 💡 [한 박자 정밀 타격 스파이크 역산 프레임]
        const spikeTrigger = new Float32Array(this.numBands);
        
        if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            const dataLen = this.currentAudioData.raw.length;
            
            const instrumentIndices = [
                p.floor(dataLen * 0.02),  // 0: 🥁 베이스 드럼 (킥)
                p.floor(dataLen * 0.06),  // 1: 🥁 스네어 드럼
                p.floor(dataLen * 0.10),  // 2: 🎻 첼로 중저역선
                p.floor(dataLen * 0.16),  // 3: 🎻 비올라 중역선
                p.floor(dataLen * 0.26),  // 4: 🎻 바이올린 선율 주축
                p.floor(dataLen * 0.42),  // 5: 🎼 실로폰 고음 타격점
                p.floor(dataLen * 0.60),  // 6: 🎻 바이올린 고주파 배음
                p.floor(dataLen * 0.76),  // 7: 🥁 하이햇 / 심벌즈 메탈릭
                p.floor(dataLen * 0.92)   // 8: ✨ 초고역 사운드 에어선
            ];

            for (let i = 0; i < this.numBands; i++) {
                let idx = p.constrain(instrumentIndices[i], 0, dataLen - 1);
                let rawVal = this.currentAudioData.raw[idx] || 0;
                let normalized = Math.pow(rawVal / 255.0, 1.6) * (gain * 1.5);
                
                // 💥 [박자 동기화 핵심 수식]: 직전 프레임과의 차이값을 구함 (음의 시작점 포착)
                let delta = normalized - this.audioHistory[i];
                if (delta > 0.08) {
                    // 순간적으로 탁 치고 올라오는 음의 첫 박자 타이밍 격발 에너지 주입
                    spikeTrigger[i] = delta * 4.5; 
                }
                this.audioHistory[i] = normalized; // 역사 버퍼 최신화

                // 기본 일렁임 감도 스무딩 보간
                let isPercussion = (i === 0 || i === 1 || i === 5 || i === 7);
                let lerpFactor = isPercussion ? 0.4 : 0.15;
                this.smoothedInput[i] += (normalized - this.smoothedInput[i]) * lerpFactor;
            }
        }

        const time = Date.now() * 0.0015;
        const orbSize = p.map(scatter, 5, 50, 12, 36); 
        const baseGlow = p.map(glow, 10, 250, 4, 32);  

        const spacing = p.map(scatter, 5, 50, width * 0.072, width * 0.1); 
        const totalW = (this.numTracks - 1) * spacing;
        const startX = (width - totalW) / 2;

        // 레일 트랙 가이드 렌더링
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
                  let guideX = x + p.sin(yRatio + time) * (spacing * 0.1); 
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

        // 9개 오브제 박자 정밀 드로잉 루프
        for (let i = 0; i < this.numBands; i++) {
          let x = startX + i * spacing;
          let pt = this.orbs[i];
          let input = this.smoothedInput[i];
          let spike = spikeTrigger[i]; // 한 박자 정밀 타격 벡터
          
          let orbColor = p.lerpColor(p.color(customColors.gas1), p.color(customColors.gas2), (i / 8.0));
          
          if (this.currentMode === "공명 바운스") {
            const gravity = 0.35 + (gauge * 0.0055); 
            pt.vy += gravity;
            
            // 💥 일반 볼륨 대신 한 박자 스파이크 에너지를 폭발적으로 척력으로 공급
            if (spike > 0.0) {
                pt.vy -= spike * 3.5; 
            }
            pt.vy *= 0.955; 
            pt.y += pt.vy;

            if (pt.y > height * 0.8) {
              pt.y = height * 0.8;
              pt.vy = -pt.vy * 0.6; 

              // 바닥을 탁 치는 타이밍에 가산되는 네온 플래시 싱크
              ctx.shadowBlur = baseGlow * 2.8; ctx.shadowColor = orbColor;
              let flashC = p.lerpColor(orbColor, p.color(255), 0.6); p.fill(flashC);
              p.circle(x, pt.y, orbSize * 1.35);
              ctx.shadowBlur = baseGlow; ctx.shadowColor = customColors.star;
            } else if (pt.y < height * 0.1) { pt.y = height * 0.1; pt.vy = 0; }

            p.fill(orbColor);
            p.circle(x, pt.y, orbSize);
            
          } else if (this.currentMode === "진자 웨이브") {
            const pendulumBaseH = height * 0.35;
            const pivotY = height * 0.1;

            // 현악기는 한 박자마다 줄이 팅기듯이 수축했다가 이내 우아한 배음 곡선으로 복원
            let pendulumLen = pendulumBaseH + i * (spacing * 0.45) - (input * 1.0) - (spike * 1.5);
            
            let phase = time * (0.65 + i * 0.065) + p.PI / 2; 
            let theta = p.sin(phase) * 0.42; 
            
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
            
            // 💥 한 박자 소리가 날카롭게 격발될 때 공이 레일을 따라 슈루룩 미끄러지는 순간 가속 질주 물리
            let currentVy = (gauge * 0.12) + 1.2 + (i * 0.35) + (input * 1.2) + (spike * 4.0);
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
