/**
 * 020_p5_srt_canvas.js
 * [대규모 업그레이드] 자막 유무와 상관없이 항상 반응하는 오디오 비주얼라이저 내장 및
 * 키네틱 텍스트 타격(Impact) 효과, 글자 크기 대폭 상향 패치 완료.
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.currentAudioData = null;
    
    // 시각 효과 파티클 및 충격파 배열
    this.particles = [];
    this.orbs = [];
    this.shockwaves = [];
    
    // 자막 상태 관리
    this.lastSubtitle = "";
    this.subtitleScale = 1.0;
    this.fadeAlpha = 0;
    this.textImpactScale = 1.0; // 글자가 나타날 때 '쾅' 치는 효과를 위한 스케일
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
        p.rectMode(p.CENTER);
        p.textAlign(p.CENTER, p.CENTER);
        
        // 💡 상시 떠다니는 빛나는 오르브(Orb) 파티클 초기화
        for (let i = 0; i < 60; i++) {
          this.orbs.push({
            x: p.random(p.width),
            y: p.random(p.height),
            size: p.random(2, 10),
            speed: p.random(0.5, 2.0),
            offset: p.random(p.TWO_PI)
          });
        }
        
        p.noLoop();
      };

      p.draw = () => {
        const width = p.width;
        const height = p.height;
        const ctx = p.drawingContext;
        
        // 1. 잔상이 남는 우주 배경 (모션 블러 효과)
        p.background(5, 7, 15, 60);

        let scatter = 2.2, gain = 1.0, glow = 0.85, seed = 42;
        let colorStyle = 'neon';
        let gas1Color = '#ff0055', gas2Color = '#00ffcc', starColor = '#ffffff';

        if (window.cosmicEngineSettings) {
          scatter = window.cosmicEngineSettings.scatterExponent || 2.2;
          gain = window.cosmicEngineSettings.audioGain || 1.0;
          glow = window.cosmicEngineSettings.glowIntensity || 0.85;
          seed = window.cosmicEngineSettings.seed || 42;
          colorStyle = window.cosmicEngineSettings.colorStyle || 'neon';
          
          if (window.cosmicEngineSettings.customColors) {
            gas1Color = window.cosmicEngineSettings.customColors.gas1 || gas1Color;
            gas2Color = window.cosmicEngineSettings.customColors.gas2 || gas2Color;
            starColor = window.cosmicEngineSettings.customColors.star || starColor;
          }
        }

        // Scale 슬라이더를 폰트 배율에 강력하게 적용 (기본 1.5배 가중치)
        this.subtitleScale = glow * 1.5;

        // 음악 재생 상태 확인
        const audio = document.getElementById('audio-player');
        const isPlaying = audio && !audio.paused && audio.currentTime > 0;

        let bass = 0, mid = 0, rms = 0;
        if (this.currentAudioData && this.currentAudioData.raw) {
          let bassSum = 0, midSum = 0, totalSum = 0;
          const raw = this.currentAudioData.raw;
          for (let i = 0; i < 128; i++) {
            if (i < 10) bassSum += raw[i];
            else if (i < 50) midSum += raw[i];
            totalSum += raw[i];
          }
          bass = (bassSum / 10) / 255.0;
          mid = (midSum / 40) / 255.0;
          rms = (totalSum / 128) / 255.0;
        }

        /* 💡 2. 상시 반응형 영상 효과 (음악이 나오면 무조건 작동) */
        p.noStroke();
        let cGas1 = p.color(gas1Color);
        let cGas2 = p.color(gas2Color);

        // 떠다니는 빛무리(Orbs) 애니메이션
        this.orbs.forEach(orb => {
          // 베이스(bass)가 강할수록 더 빠르게 위로 상승
          orb.y -= orb.speed * (1.0 + bass * 10.0 * gain);
          orb.x += p.sin(p.frameCount * 0.02 + orb.offset) * 2;
          
          if (orb.y < -20) {
            orb.y = height + 20;
            orb.x = p.random(width);
          }
          
          let pulse = orb.size * (1.0 + mid * 3.0);
          ctx.shadowBlur = pulse * 2 * (glow / 1.5);
          ctx.shadowColor = orb.size % 2 === 0 ? cGas1.toString() : cGas2.toString();
          
          let orbC = orb.size % 2 === 0 ? cGas1 : cGas2;
          orbC.setAlpha(100 + bass * 155);
          p.fill(orbC);
          p.circle(orb.x, orb.y, pulse);
        });

        // 하단 오디오 주파수 웨이브폼 (항상 바닥에서 일렁임)
        if (this.currentAudioData && this.currentAudioData.raw) {
          p.push();
          p.noFill();
          p.strokeWeight(3);
          ctx.shadowBlur = 15;
          ctx.shadowColor = cGas2.toString();
          
          cGas2.setAlpha(150);
          p.stroke(cGas2);
          p.beginShape();
          for(let x = 0; x <= width; x += 20) {
            let index = p.floor(p.map(x, 0, width, 0, 60));
            let val = (this.currentAudioData.raw[index] || 0) / 255.0;
            let y = height - (val * 150 * gain * scatter) - 10;
            p.curveVertex(x, y);
          }
          p.endShape();
          p.pop();
        }

        const subtitleText = window.currentSubtitleText || "";

        // 새로운 자막 등장 시 충격파(Impact) 및 파티클 폭발
        if (subtitleText !== this.lastSubtitle && subtitleText !== "") {
          this.lastSubtitle = subtitleText;
          this.fadeAlpha = 0; 
          this.textImpactScale = 1.8; // 글자가 1.8배에서 1.0배로 쾅 찍힘
          
          // 충격파 링 생성
          this.shockwaves.push({ x: width/2, y: height * 0.55, radius: 0, life: 255 });

          // 글자 폭발 파티클
          for (let i = 0; i < 40; i++) {
            this.particles.push({
              x: width / 2 + p.random(-200, 200),
              y: height * 0.55 + p.random(-50, 50),
              vx: p.random(-6, 6) * scatter,
              vy: p.random(-6, 6) * scatter,
              life: 255,
              size: p.random(3, 8)
            });
          }
        }

        // 충격파 렌더링
        p.noFill();
        p.strokeWeight(4);
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
          let sw = this.shockwaves[i];
          sw.radius += 15;
          sw.life -= 10;
          
          let swColor = p.color(starColor);
          swColor.setAlpha(sw.life);
          p.stroke(swColor);
          p.circle(sw.x, sw.y, sw.radius);
          
          if (sw.life <= 0) this.shockwaves.splice(i, 1);
        }

        if (!isPlaying) {
          // 정지 시 팝업 렌더링
          p.push();
          ctx.shadowBlur = 30;
          ctx.shadowColor = cGas1.toString();
          
          p.fill(10, 12, 18, 230);
          p.stroke(cGas1);
          p.strokeWeight(2);
          p.rect(width / 2, height / 2, 480, 240, 15);
          p.noStroke();

          p.fill(cGas2);
          p.textSize(20);
          p.text("● STAGE STATUS: 020 SRT Kinetic Lyric READY", width / 2, height / 2 - 70);

          p.fill(255);
          p.textSize(16);
          p.text("음악 재생 시 팝업이 사라지며 다이나믹 영상이 시작됩니다.", width / 2, height / 2 - 20);
          
          p.fill(150, 170, 190);
          p.textSize(13);
          p.text("1. 음악의 베이스와 비트에 맞춰 배경 빛무리가 반응합니다.\n2. 자막이 변경될 때 강력한 키네틱 타격 효과가 발생합니다.\n3. 우측 Scale 슬라이더로 폰트 크기를 극대화할 수 있습니다.", width / 2, height / 2 + 40);
          p.pop();
        } else {
          // 키네틱 텍스트 렌더링
          if (this.fadeAlpha < 255) this.fadeAlpha += 20;
          if (this.textImpactScale > 1.0) this.textImpactScale -= 0.1; // 1.8 -> 1.0으로 빠르게 축소

          if (subtitleText !== "") {
            p.push();
            ctx.shadowBlur = 35 * (glow / 1.5) * (1.0 + rms);
            ctx.shadowColor = cGas2.toString();
            
            // 💡 폰트 베이스 사이즈 대폭 상향 및 스케일 곱 적용
            let baseSize = height * 0.08; // 기존 0.05에서 대폭 상향
            let computedSize = baseSize * this.subtitleScale * this.textImpactScale;
            if (computedSize < 30) computedSize = 30; 
            
            p.textSize(computedSize);
            p.textStyle(p.BOLD);
            
            p.fill(255, 255, 255, this.fadeAlpha);
            p.stroke(cGas1);
            p.strokeWeight(computedSize * 0.02); // 폰트 크기에 비례하는 테두리 두께
            
            let offsetX = window.cosmicEngineSettings ? window.cosmicEngineSettings.positionOffset.x : 0;
            let offsetY = window.cosmicEngineSettings ? window.cosmicEngineSettings.positionOffset.y : 0;
            
            // 오디오에 맞춰 텍스트가 바운스
            let textY = (height * 0.55) + offsetY - (bass * 15.0 * gain);
            p.text(subtitleText, (width / 2) + offsetX, textY);
            p.pop();
          }
        }

        // 폭발 파티클 렌더링
        p.noStroke();
        for (let i = this.particles.length - 1; i >= 0; i--) {
          let pt = this.particles[i];
          pt.vy += 0.2; 
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.life -= 5;

          ctx.shadowBlur = 15;
          ctx.shadowColor = cGas1.toString();
          
          let pc = i % 2 === 0 ? cGas1 : cGas2;
          pc.setAlpha(pt.life);
          p.fill(pc);
          p.circle(pt.x, pt.y, pt.size);

          if (pt.life <= 0) this.particles.splice(i, 1);
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
    if (this.p5Instance) this.p5Instance.resizeCanvas(w, h);
  }

  destroy() {
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }
    this.particles = [];
    this.orbs = [];
    this.shockwaves = [];
    this.currentAudioData = null;
  }
}
