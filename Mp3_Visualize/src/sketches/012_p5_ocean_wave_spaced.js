/**
 * src/sketches/012_p5_ocean_wave_spaced.js
 * - [버전] Ver 7.3 (⚡ RESET 즉시 적용 연동 및 마스터 가이드 콘솔 출력 최종 완결판)
 * - 관제탑의 [현재 수치 즉시 적용 (RESET)] 단추 클릭 시 부팅 루틴과 1:1 결합하여 실시간 물리 상태 리셋 가동
 * - 사용자가 업로드한 이미지가 있으면 캔버스 배경에 자동 수혈 투사 (가독성을 위한 70% 암전 틴트 시공)
 * - 자막(SRT) 파이프라인의 간섭을 완전히 원천 제거하여 앰비언트 월페이퍼(Ambient Wallpaper) 구동에 최적화 완수
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
    this.version = "Satisfying Orbs 물리 스튜디오 Ver 7.3";
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

    // 💡 [시스템 가이드 라인 브리핑 출력]
    console.log(`%c[🔮 012호 가동완료] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");
    console.log(
      `%c🎛️ 물리 스튜디오 핵심 파라미터 조작 메뉴얼\n` +
      `1. Shuffle  ➡️ 입력 수치에 따라 3가지 물리 무대(공명 바운스 / 진자 웨이브 / 무한 마블 런)가 랜덤 결정됩니다.\n` +
      `2. Range    ➡️ 9개 공(Orb)의 물리 반경 크기와 가로 배치 간격(Spacing)의 스케일을 제어합니다.\n` +
      `3. Scale    ➡️ 공들이 마찰 및 바운스할 때 투사되는 광원 네온(Glow)의 섀도 블러 범위를 결정합니다.\n` +
      `4. Volume   ➡️ 오디오 신호 입력 시 공들이 중력을 거스르고 튀어 오르는 탄성 에너지를 배가시킵니다.\n` +
      `5. Gauge    ➡️ 공명 바운스의 낙하 중력 상수 및 마블 런 레일의 무한 루프 기저 이동 속도를 지배합니다.`,
      "color: #ffffff; line-height: 1.6;"
    );

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.noLoop();
        
        // RESET 발생 시 물리 객체 프레임 완전 재정렬
        let scatter = 22, seed = 42;
        if (window.cosmicEngineSettings) {
          seed = window.cosmicEngineSettings.seed || 42;
          scatter = window.cosmicEngineSettings.scatterExponent || 2.2;
        }

        p.randomSeed(seed);
        let modes = ["공명 바운스", "진자 웨이브", "무한 마블 런"];
        this.currentMode = modes[p.floor(p.random(modes.length))];
        console.log(`%c[⚡ RESET 무대 가동] 물리 엔진 결정: ${this.currentMode} (지형 시드: ${seed})`, "color: #00ffcc; font-weight: bold;");

        for (let i = 0; i < this.numBands; i++) {
          this.orbs.push({
            y: p.random(p.height * 0.2, p.height * 0.5),
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

        // 💡 실시간 이미지 배경화면 바인딩 투사 엔진
        if (window.currentUploadedImageElement) {
            ctx.drawImage(window.currentUploadedImageElement, 0, 0, width, height);
            // 70% 틴트 차단막 시공으로 네온 Orbs의 시인성 하드웨어 극대화
            ctx.fillStyle = 'rgba(11, 6, 22, 0.72)';
            ctx.fillRect(0, 0, width, height);
        } else {
            const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
            bgGrad.addColorStop(0, '#090018');
            bgGrad.addColorStop(0.5, '#140026');
            bgGrad.addColorStop(1, '#000000');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);
        }

        // 주파수 타격 세기 보간
        if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            for (let i = 0; i < this.numBands; i++) {
                const binIndex = p.floor(2 + Math.pow(i / 8, 1.35) * 115); 
                let rawVal = (binIndex < this.currentAudioData.raw.length) ? this.currentAudioData.raw[binIndex] : 0;
                let normalized = Math.pow(rawVal / 255.0, 1.7);
                
                let currentH = this.smoothedInput[i];
                let targetH = normalized * (gain * 1.4); 

                currentH += (targetH - currentH) * 0.22;
                this.smoothedInput[i] = currentH;
            }
        }

        const time = Date.now() * 0.0015;
        const orbSize = p.map(scatter, 5, 50, 12, 38); 
        const baseGlow = p.map(glow, 10, 250, 4, 32);  

        const spacing = p.map(scatter, 5, 50, width * 0.07, width * 0.1); 
        const totalW = (this.numTracks - 1) * spacing;
        const startX = (width - totalW) / 2;

        // 가이드 레일 인젝션 드로잉
        p.strokeWeight(1);
        for (let i = 0; i < this.numTracks; i++) {
          let lineC = p.color(customColors.gas2);
          let x = startX + i * spacing;
          
          if (this.currentMode === "공명 바운스") {
              lineC.setAlpha(25); p.stroke(lineC);
              p.line(x, height * 0.1, x, height * 0.8);
          } else if (this.currentMode === "진자 웨이브") {
              p.beginShape(); p.noFill();
              lineC.setAlpha(35); p.stroke(lineC);
              for (let y = height * 0.15; y <= height * 0.85; y += 15) {
                  let yRatio = p.map(y, height * 0.15, height * 0.85, 0, p.PI * 2);
                  let guideX = x + p.sin(yRatio + time) * (spacing * 0.15); 
                  p.curveVertex(guideX, y);
              }
              p.endShape();
          } else if (this.currentMode === "무한 마블 런") {
              let lineC_2 = p.color(customColors.gas1);
              lineC_2.setAlpha(40); p.stroke(lineC_2);
              p.line(x, 0, x, height);
          }
        }

        p.noStroke();
        ctx.shadowBlur = baseGlow;
        ctx.shadowColor = customColors.star;

        // 9개 오브제 물리식 수치 반영 전개
        for (let i = 0; i < this.numBands; i++) {
          let x = startX + i * spacing;
          let pt = this.orbs[i];
          let input = this.smoothedInput[i];
          
          let orbColor = p.lerpColor(p.color(customColors.gas1), p.color(customColors.gas2), (i / 8.0));
          
          if (this.currentMode === "공명 바운스") {
            const gravity = 0.38 + (gauge * 0.0055); 
            pt.vy += gravity;
            pt.vy -= input * 2.4; 
            pt.vy *= 0.965; 
            pt.y += pt.vy;

            if (pt.y > height * 0.8) {
              pt.y = height * 0.8;
              pt.vy = -pt.vy * 0.64; 

              ctx.shadowBlur = baseGlow * 2.5; ctx.shadowColor = orbColor;
              let flashC = p.lerpColor(orbColor, p.color(255), 0.5); p.fill(flashC);
              p.circle(x, pt.y, orbSize * 1.3);
              ctx.shadowBlur = baseGlow; ctx.shadowColor = customColors.star;
            } else if (pt.y < height * 0.1) { pt.y = height * 0.1; pt.vy = 0; }

            p.fill(orbColor);
            p.circle(x, pt.y, orbSize);
            
          } else if (this.currentMode === "진자 웨이브") {
            const pendulumBaseH = height * 0.36;
            const pivotY = height * 0.1;

            let pendulumLen = pendulumBaseH + i * (spacing * 0.48) - input * 0.9;
            let phase = time * (0.68 + i * 0.068) + p.PI / 2; 
            let theta = p.sin(phase) * 0.42; 
            
            p.strokeWeight(1.5);
            let lineC = p.color(customColors.gas2); lineC.setAlpha(85); p.stroke(lineC);
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
            
            let currentVy = (gauge * 0.12) + 1.8 + (i * 0.38) + (input * 2.2);
            pt.y += currentVy; 

            if (pt.y > railBottom) {
              pt.y = railTop; 
            }

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
