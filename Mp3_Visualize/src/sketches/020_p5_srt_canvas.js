/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 11.2 (네이티브 그래픽 컨텍스트 예외 교정 및 렌더링 락 완치판)
 * - drawGradientShape 내부의 무효한 ctx.noStroke() 코드를 완벽히 청소하여 그래픽 루프 셧다운 버그 해결
 * - p5.js 고유 네이티브 루프를 활성화하여 끊김 없는 60fps 오가닉 나풀거림 연출 보장
 * - 1:단풍잎(그라디언트), 2:풀잎(그라디언트), 3:눈꽃송이(6축), 4:빗방울(탑뷰 리플 왜곡) 전체 메커니즘 정상화
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.particles = [];
    
    this.accumulationBuffer = null;
    this.lastWidth = 0;
    this.lastHeight = 0;
    
    this.lastTrackedText = "";
    this.subtitleRiseY = 0;
    
    this.version = "020호 Organic Floating Gradient Engine Ver 11.2";
  }

  init() {
    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        this.accumulationBuffer = p.createGraphics(p.width, p.height);
        this.accumulationBuffer.clear();
        
        this.lastWidth = p.width;
        this.lastHeight = p.height;
        
        // 💡 실시간 나풀거림 애니메이션을 매끄럽게 처리하기 위해 p5 기본 루프 자동 가동
        p.loop();
      };

      p.draw = () => {
        p.clear();
        
        const settings = window.cosmicEngineSettings || { 
          seed: 42, scatterExponent: 2.2, glowIntensity: 0.85, audioGain: 1.0, gaugeValue: 0.5, colorStyle: 'neon' 
        };
        
        p.randomSeed(settings.seed);
        const style = settings.colorStyle; 

        if (this.lastWidth !== p.width || this.lastHeight !== p.height) {
          let newBuffer = p.createGraphics(p.width, p.height);
          newBuffer.image(this.accumulationBuffer, 0, 0);
          this.accumulationBuffer = newBuffer;
          this.lastWidth = p.width;
          this.lastHeight = p.height;
        }

        // 1. SRT 자막 타임라인 추적 및 Easing 가림 임계 수치 환산
        const audioEl = document.getElementById('audio-player');
        const subs = window.parsedSubtitles || [];
        const currentTime = audioEl ? audioEl.currentTime : 0;
        
        const currentSub = subs.find(s => currentTime >= s.start && currentTime <= s.end);
        const text = window.currentSubtitleText || "";

        if (text !== this.lastTrackedText) {
          if (text !== "") this.subtitleRiseY = 150; 
          this.lastTrackedText = text;
        }
        this.subtitleRiseY = p.lerp(this.subtitleRiseY, 0, 0.09);

        let coverFactor = 0.0;
        let isCoveringTimeWindow = false;
        if (currentSub) {
          const remainingTime = currentSub.end - currentTime;
          const coverThresholdTime = p.map(settings.gaugeValue, 0, 100, 0.0, 2.8);
          if (remainingTime <= coverThresholdTime) {
            isCoveringTimeWindow = true;
            coverFactor = p.constrain((coverThresholdTime - remainingTime) / coverThresholdTime, 0.0, 1.0);
          }
        }

        // 2. 상시 낙하 스폰 레이트 결정 (Gauge 수치 및 가림 여부에 따라 동적 조율)
        let spawnRate = 1; 
        if (isCoveringTimeWindow) {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          spawnRate = p.floor(p.map(coverFactor, 0.0, 1.0, 1, p.max(2, p.floor(gaugeRaw * 0.22))));
        }

        if (p.frameCount % 2 === 0) {
          for (let k = 0; k < spawnRate; k++) {
            this.spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor);
          }
        }

        // 3. 탑뷰 유기적 조화 물리엔진 업데이트
        this.updateParticlesPhysics(p, settings);

        // 4. [레이어 역전 적층 시공]: 자막을 가장 먼저 백그라운드에 렌더링 (낙엽 밑으로 진입)
        this.drawSubtitle(p, style, settings, isCoveringTimeWindow, coverFactor, currentSub, this.subtitleRiseY);

        // 5. 이미 바닥에 깔려서 영구 누적되고 있는 그라디언트 축적 버퍼 레이어 투사
        p.image(this.accumulationBuffer, 0, 0);

        // 6. 공중에서 바람을 타고 나풀거리며 이동 중인 라이브 파티클들을 최상단에 투사
        this.drawLiveParticles(p);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor) {
    const gainRaw = settings.audioGain > 5 ? settings.audioGain : settings.audioGain * 100;
    const baseShapeSize = p.map(gainRaw, 10, 500, 15, 85);
    const finalSize = p.random(baseShapeSize * 0.65, baseShapeSize * 1.35);
    
    const scatterRaw = settings.scatterExponent > 5 ? settings.scatterExponent : settings.scatterExponent * 10;
    const speedScale = p.map(scatterRaw, 5, 50, 0.006, 0.035);

    let type = 'leaf';
    if (style === 'pastel') type = 'grass';
    if (style === 'monochrome') type = 'snow';
    if (style === 'earth') type = 'rain';

    const spawnAngle = p.random(p.TWO_PI);
    const spawnRadius = p.max(p.width, p.height) * 0.8;
    const startX = (p.width / 2) + p.cos(spawnAngle) * spawnRadius;
    const startY = (p.height / 2) + p.sin(spawnAngle) * spawnRadius;

    let targetX = p.random(p.width);
    let targetY = p.random(p.height);

    if (isCoveringTimeWindow && type !== 'rain') {
      const glowRaw = settings.glowIntensity > 5 ? settings.glowIntensity : settings.glowIntensity * 100;
      const fontSize = p.map(glowRaw, 10, 250, 50, 220);
      const textWidthArea = fontSize * 5.0 * coverFactor;
      const textHeightArea = fontSize * 2.5 * coverFactor;
      
      targetX = (p.width / 2) + p.random(-textWidthArea, textWidthArea) + (settings.positionOffset?.x || 0);
      targetY = (p.height / 2) + p.random(-textHeightArea, textHeightArea) + (settings.positionOffset?.y || 0);
    }

    this.particles.push({
      x: startX,
      y: type === 'rain' ? p.random(p.height) : startY,
      startX: startX,
      startY: startY,
      targetX: targetX,
      targetY: targetY,
      pct: 0,
      step: isCoveringTimeWindow ? p.random(0.012, 0.038) : p.random(speedScale * 0.7, speedScale * 1.3),
      size: finalSize,
      angle: p.random(p.TWO_PI),
      spin: p.random(-0.03, 0.03),
      waveSeed: p.random(100),
      waveAmp: p.random(15, 45),
      type: type,
      age: 0,
      maxAge: type === 'rain' ? 45 : 450,
      alpha: 255
    });
  }

  updateParticlesPhysics(p, settings) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];
      pt.age++;

      if (pt.type === 'rain') {
        pt.alpha -= 5;
        if (pt.alpha <= 0) this.particles.splice(i, 1);
      } else {
        if (pt.pct < 1.0) {
          pt.pct += pt.step;
          if (pt.pct > 1.0) pt.pct = 1.0;
          
          let rawX = p.lerp(pt.startX, pt.targetX, pt.pct);
          let rawY = p.lerp(pt.startY, pt.targetY, pt.pct);
          
          let waveOffset = Math.sin(pt.age * 0.06 + pt.waveSeed) * pt.waveAmp * (1.0 - pt.pct);
          pt.x = rawX + waveOffset * 0.5;
          pt.y = rawY + waveOffset * 0.3;
          
          pt.angle += pt.spin;
        }

        if (pt.pct >= 1.0) {
          this.drawGradientShape(this.accumulationBuffer, pt);
          this.particles.splice(i, 1);
        }
      }
    }
  }

  drawLiveParticles(p) {
    for (let i = 0; i < this.particles.length; i++) {
      let pt = this.particles[i];
      if (pt.type === 'rain') {
        p.noFill();
        p.stroke(145, 185, 255, pt.alpha);
        p.strokeWeight(2.5);
        p.ellipse(pt.x, pt.y, (255 - pt.alpha) * (pt.size * 0.05));
      } else {
        this.drawGradientShape(p, pt);
      }
    }
  }

  // 💡 [버그 완치]: 에러를 유발하던 무효한 'ctx.noStroke()' 라인을 완벽히 제거
  drawGradientShape(target, pt) {
    let ctx = target.drawingContext;
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(pt.angle);

    let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, pt.size * 1.2);

    if (pt.type === 'leaf') {
      grad.addColorStop(0, 'rgba(255, 110, 60, 0.95)');   
      grad.addColorStop(0.4, 'rgba(215, 55, 35, 0.95)');   
      grad.addColorStop(1, 'rgba(125, 25, 15, 0.95)');     
      ctx.fillStyle = grad;

      ctx.beginPath();
      for (let a = 0; a < 6.28; a += 0.05) {
        let r = pt.size * (1.0 + 0.4 * Math.sin(5 * a) + 0.2 * Math.sin(10 * a));
        let x = r * Math.cos(a); let y = r * Math.sin(a);
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(95, 15, 5, 0.4)';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, pt.size * 1.05); ctx.stroke();
    } 
    else if (pt.type === 'grass') {
      grad.addColorStop(0, 'rgba(150, 240, 95, 0.95)');   
      grad.addColorStop(0.5, 'rgba(50, 165, 70, 0.95)');   
      grad.addColorStop(1, 'rgba(15, 75, 25, 0.95)');      
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(0, -pt.size * 1.3);
      ctx.bezierCurveTo(pt.size * 0.65, -pt.size * 0.45, pt.size * 0.65, pt.size * 0.65, 0, pt.size * 1.3);
      ctx.bezierCurveTo(-pt.size * 0.65, pt.size * 0.65, -pt.size * 0.65, -pt.size * 0.45, 0, -pt.size * 1.3);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(10, 50, 15, 0.4)';
      ctx.lineWidth = 2.0;
      ctx.beginPath(); ctx.moveTo(0, -pt.size * 1.1), ctx.lineTo(0, pt.size * 1.1); ctx.stroke();
    } 
    else if (pt.type === 'snow') {
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');   
      grad.addColorStop(1, 'rgba(175, 210, 255, 0.60)');   
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(2.2, pt.size * 0.09);
      
      for (let j = 0; j < 6; j++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -pt.size);
        ctx.moveTo(0, -pt.size * 0.4); ctx.lineTo(pt.size * 0.35, -pt.size * 0.6);
        ctx.moveTo(0, -pt.size * 0.4); ctx.lineTo(-pt.size * 0.35, -pt.size * 0.6);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawSubtitle(p, style, settings, isCoveringTimeWindow, coverFactor, currentSub, riseY) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    const glowRaw = settings.glowIntensity > 5 ? settings.glowIntensity : settings.glowIntensity * 100;
    const fontSize = p.map(glowRaw, 10, 250, 50, 220);
    const tracking = fontSize * 0.72; 
    const leading = fontSize * 1.45;  

    p.textSize(fontSize);
    p.textAlign(p.CENTER, p.CENTER);

    let alphaFade = 255;
    if (isCoveringTimeWindow && currentSub) {
      alphaFade = p.constrain((1.0 - coverFactor) * 255, 0, 255);
    }

    const offX = settings.positionOffset?.x || 0;
    const offY = settings.positionOffset?.y || 0;
    const lines = text.split(" ");
    
    lines.forEach((line, lineIdx) => {
      let currentLineY = (p.height / 2) + offY + riseY + (lineIdx * leading) - ((lines.length - 1) * leading * 0.5);
      let chars = line.split("");
      
      chars.forEach((char, charIdx) => {
        let currentRawX = (p.width / 2) + offX + (charIdx * tracking) - ((chars.length - 1) * tracking * 0.5);
        
        let finalX = currentRawX;
        let finalY = currentLineY;

        if (style === 'earth') {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          let wave = p.sin(p.frameCount * 0.12 + charIdx * 0.7) * (gaugeRaw * 0.45);
          finalX += wave * 0.8;
          finalY += p.cos(p.frameCount * 0.09 + charIdx) * wave * 0.5;
        }

        p.fill(255, alphaFade);
        p.noStroke();
        p.text(char, finalX, finalY);
      });
    });

    if (isCoveringTimeWindow && alphaFade <= 2 && (style === 'neon' || style === 'pastel' || style === 'monochrome')) {
       this.accumulationBuffer.fill(style === 'neon' ? [140, 35, 20, 18] : style === 'pastel' ? [30, 95, 35, 18] : [220, 230, 245, 12]);
       this.accumulationBuffer.rect(0, 0, p.width, p.height);
    }
  }

  update(audioData) { if (this.p5Instance) this.p5Instance.redraw(); }
  resize(w, h) { if (this.p5Instance) this.p5Instance.resizeCanvas(w, h); }
  destroy() {
    if (this.p5Instance) { this.p5Instance.remove(); this.p5Instance = null; }
    if (this.accumulationBuffer) { this.accumulationBuffer.remove(); this.accumulationBuffer = null; }
    this.particles = [];
  }
}
