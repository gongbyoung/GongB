/**
 * src/sketches/012_p5_ocean_wave_spaced.js
 * - [버전] Ver 7.8 (9채널 요요 역학 및 회전 인디케이터 블랙 가인판)
 * - 각 서클이 줄에 매달려 소리 타격 시 아래로 강하게 떨어졌다가 되감겨 올라오는 완벽한 요요 물리 구현
 * - 서클 내부 12시 방향에 검은색 마커 점을 주입하여 요요의 실시간 풀림/감김 회전 상태를 완벽 시각화
 * - 3D Position Offset X = 공의 크기, Y = 상하 중간 기준선 오프셋 가인 연동 유지
 */

export default class P5OceanWaveSpaced {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.numBands = 9; 
    this.orbs = []; 
    this.numTracks = 9; 

    this.audioHistory = new Float32Array(this.numBands);
    this.currentAudioData = null;
    this.version = "Yo-Yo Dynamics 스튜디오 Ver 7.8";
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

    console.log(`%c[🎛️ 요요 물리 시스템 가동] ${this.version}`, "color: #00ffcc; font-weight: bold; font-size: 13px;");

    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        p.noLoop();
        
        // 9개의 서클별 독립 요요 물리 상태 정의
        for (let i = 0; i < this.numBands; i++) {
          this.orbs.push({
            yOffset: 0,      // 중간 기준선으로부터의 상대적 하강 거리
            velocity: 0,     // 요요의 수직 이동 속도
            angle: 0,        // 회전 각도 (라디안)
            rotVelocity: 0   // 회전 속도
          });
        }
      };

      p.draw = () => {
        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;

        if (!this.currentAudioData) { p.clear(); ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, width, height); return; }

        let scatter = 22, gain = 100, glow = 85, gauge = 50;
        let offX = 0, offY = 0; 
        let customColors = { gas1: '#ff0055', gas2: '#00ffcc', star: '#ffffff' };

        if (window.cosmicEngineSettings) {
          scatter = window.cosmicEngineSettings.scatterExponent || 2.2;
          gain = window.cosmicEngineSettings.audioGain || 1.0;
          glow = window.cosmicEngineSettings.glowIntensity || 0.85;
          gauge = window.cosmicEngineSettings.gaugeValue || 0.5;
          customColors = window.cosmicEngineSettings.customColors || customColors;
          offX = window.cosmicEngineSettings.positionOffset?.x || 0; 
          offY = window.cosmicEngineSettings.positionOffset?.y || 0; 
        }

        // 잔상(Trail) 오버레이 효과 유지
        ctx.save();
        ctx.shadowBlur = 0;
        if (window.currentUploadedImageElement) {
            ctx.drawImage(window.currentUploadedImageElement, 0, 0, width, height);
            ctx.fillStyle = 'rgba(12, 6, 24, 0.22)'; 
            ctx.fillRect(0, 0, width, height);
        } else {
            ctx.fillStyle = 'rgba(10, 0, 22, 0.22)';
            ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();

        // 실시간 한 박자 타격 스파이크(Peak) 추출
        const spikeTrigger = new Float32Array(this.numBands);
        if (this.currentAudioData.raw && this.currentAudioData.raw.length > 0) {
            const dataLen = this.currentAudioData.raw.length;
            const instrumentIndices = [
                p.floor(dataLen * 0.02), p.floor(dataLen * 0.06), p.floor(dataLen * 0.10),
                p.floor(dataLen * 0.16), p.floor(dataLen * 0.26), p.floor(dataLen * 0.42),
                p.floor(dataLen * 0.60), p.floor(dataLen * 0.76), p.floor(dataLen * 0.92)
            ];

            for (let i = 0; i < this.numBands; i++) {
                let idx = p.constrain(instrumentIndices[i], 0, dataLen - 1);
                let rawVal = this.currentAudioData.raw[idx] || 0;
                let normalized = Math.pow(rawVal / 255.0, 1.6) * (gain * 1.5);
                
                let delta = normalized - this.audioHistory[i];
                if (delta > 0.07) { 
                    spikeTrigger[i] = delta * 5.0; // 박자 터질 때 쿵 떨어지는 기폭제 에너지
                }
                this.audioHistory[i] = normalized;
            }
        }

        // UI 바인딩 변환
        const orbSize = (offX !== 0) ? p.constrain(offX, 5, 120) : 22; 
        const centerYBase = (height / 2) + (offY * -1.5); 
        const baseGlow = p.map(glow, 10, 250, 4, 32);  
        const spacing = p.map(scatter, 5, 50, width * 0.072, width * 0.1); 
        const totalW = (this.numTracks - 1) * spacing;
        const startX = (width - totalW) / 2;

        const maxDropDistance = height * 0.35; // 요요가 최대 풀려 내려갈 수 있는 한계선

        // 1단계: 요요를 매단 줄(String) 먼저 전부 투사 드로잉
        p.strokeWeight(1.5);
        for (let i = 0; i < this.numBands; i++) {
            let x = startX + i * spacing;
            let pt = this.orbs[i];
            let currentY = centerYBase + pt.yOffset;
            
            let stringColor = p.color(customColors.gas2);
            stringColor.setAlpha(60);
            p.stroke(stringColor);
            
            // 상단 천장 피벗 영역에서부터 요요 공의 중심까지 연결되는 실 가선
            p.line(x, centerYBase - height * 0.4, x, currentY);
        }

        // 2단계: 요요 서클 및 12시 마커 회전 연산 드로잉
        p.noStroke();
        ctx.shadowBlur = baseGlow;
        ctx.shadowColor = customColors.star;

        for (let i = 0; i < this.numBands; i++) {
          let x = startX + i * spacing;
          let pt = this.orbs[i];
          let spike = spikeTrigger[i];
          
          // 💡 [독립 요요 물리 루프 계산]
          // 박자가 터지면 실이 끊어지듯 아래로 쿵 던져지는 속도 가인
          if (spike > 0.0) {
              pt.velocity += spike * 6.5; 
          }
          
          // Gauge 수치에 비례한 탄성 복원력(위로 감겨 올라가려는 힘) 계산
          let springRestoringForce = -0.06 - (gauge * 0.001);
          
          // 아래로 많이 풀릴수록 위로 되감기려는 복원 에너지가 비례해서 강력 가중됨
          pt.velocity += pt.yOffset * springRestoringForce;
          pt.velocity *= 0.92; // 찰진 요요 마찰 제어 계수
          pt.yOffset += pt.velocity;

          // 요요 상하 한계선 하드웨어 클램핑
          if (pt.yOffset < -50) { pt.yOffset = -50; pt.velocity = 0; }
          if (pt.yOffset > maxDropDistance) { pt.yOffset = maxDropDistance; pt.velocity = -pt.velocity * 0.8; }

          // 💡 [회전 물리 링크]: 상하 수직 이동 속도와 비례하여 바퀴가 회전함
          pt.rotVelocity = pt.velocity * 0.06;
          pt.angle += pt.rotVelocity;

          let currentY = centerYBase + pt.yOffset;
          let orbColor = p.lerpColor(p.color(customColors.gas1), p.color(customColors.gas2), (i / 8.0));

          // 요요 원판 베이스 드로잉
          p.fill(orbColor);
          p.circle(x, currentY, orbSize);

          // 💡 [회전 체감용 12시 방향 검은 점 주입 기믹]
          p.push();
          p.translate(x, currentY); // 요요 공의 정중앙으로 좌표계 중심 이동
          p.rotate(pt.angle);       // 요요가 풀리고 감기는 회전 변위만큼 회전
          
          p.noStroke();
          p.fill(0); // 완벽한 검은색 점
          // 반지름의 70% 위치에 지름 4~8px 크기의 마커 배치
          let markerPos = (orbSize / 2) * 0.68;
          let markerSize = p.constrain(orbSize * 0.2, 4, 10);
          p.circle(0, -markerPos, markerSize); // 회전 전 기준 완벽한 12시 방향 배치
          p.pop();
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
