/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 15.5 (하드웨어 가속 프리렌더링 및 가상 캔버스 메모리 청소 완결판)
 * - 자막 프리렌더링 캐시 레이어를 시공하여 매 프레임 발생하던 폰트 레이아웃 CPU 병목 완치
 * - .remove() 가비지 컬렉터 강제 구동으로 유령 캔버스 점유 메모리 누수 원천 봉쇄
 * - 레이어 정렬: [바닥 축적 버퍼] -> [순수 가사 자막] -> [라이브 파티클] 순으로 시각성 최적화
 * - 평시 가사 영역 완벽 우회 및 자막 종료 타임라인 타겟팅 가림 구현
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.particles = [];
    
    this.accumulationBuffer = null;
    this.subtitleBuffer = null; // 💡 자막 연산 폭발을 막기 위한 전용 프리렌더 캐시 버퍼
    this.lastWidth = 0;
    this.lastHeight = 0;
    
    this.lastTrackedText = "";
    this.subtitleRiseY = 0;
    this.lastRenderedText = "";
    this.lastRenderedFontSize = 0;
    
    this.textureCaches = null;
    this.version = "020호 Light-Speed Pre-rendered Engine Ver 15.5";
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
        
        // 정적 텍스처 미리 굽기 공장 가동
        this.createTextureFactories(p);
        p.loop();
      };

      p.draw = () => {
        p.clear();
        
        const settings = window.cosmicEngineSettings || { 
          seed: 42, scatterExponent: 2.2, glowIntensity: 0.85, audioGain: 1.0, gaugeValue: 0.5, colorStyle: 'neon' 
        };
        
        const style = settings.colorStyle; 

        // 💡 [메모리 누수 완치]: 새 버퍼를 생성하기 전 올드 캔버스 객체를 엘리먼트 레벨에서 강제 삭제
        if (this.lastWidth !== p.width || this.lastHeight !== p.height) {
          let newBuffer = p.createGraphics(p.width, p.height);
          newBuffer.image(this.accumulationBuffer, 0, 0);
          
          if (this.accumulationBuffer) this.accumulationBuffer.remove();
          this.accumulationBuffer = newBuffer;
          
          this.lastWidth = p.width;
          this.lastHeight = p.height;
        }

        // SRT 데이터 스트림 트래킹
        const audioEl = document.getElementById('audio-player');
        const subs = window.parsedSubtitles || [];
        const currentTime = audioEl ? audioEl.currentTime : 0;
        
        const currentSub = subs.find(s => currentTime >= s.start && currentTime <= s.end);
        const text = window.currentSubtitleText || "";

        const glowRaw = settings.glowIntensity > 5 ? settings.glowIntensity : settings.glowIntensity * 100;
        const fontSize = p.map(glowRaw, 10, 250, 50, 220);
        const tracking = fontSize * 0.72;
        const leading = fontSize * 1.45;

        // 자막 공간 상자 면적 동적 분석
        let maxLineChars = 0;
        const lines = text.split(" ");
        lines.forEach(l => { if (l.length > maxLineChars) maxLineChars = l.length; });
        
        const boxW = maxLineChars * tracking;
        const boxH = lines.length * leading;

        const offX = settings.positionOffset?.x || 0;
        const offY = settings.positionOffset?.y || 0;
        const centerX = (p.width / 2) + offX;
        const centerY = (p.height / 2) + offY;

        if (text !== this.lastTrackedText) {
          if (text !== "") this.subtitleRiseY = 35; 
          this.lastTrackedText = text;
        }
        this.subtitleRiseY = p.lerp(this.subtitleRiseY, 0, 0.08);

        // 타임라인 동기화 기반 가림 임계 수치 계산
        let coverFactor = 0.0;
        let isCoveringTimeWindow = false;
        if (currentSub) {
          const remainingTime = currentSub.end - currentTime;
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          const coverThresholdTime = p.map(gaugeRaw, 0, 100, 0.0, 2.8);
          
          if (remainingTime <= coverThresholdTime) {
            isCoveringTimeWindow = true;
            coverFactor = p.constrain((coverThresholdTime - remainingTime) / coverThresholdTime, 0.0, 1.0);
          }
        }

        // 파티클 스폰 레이트
        let spawnRate = p.frameCount % 3 === 0 ? 1 : 0; 
        if (isCoveringTimeWindow) {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          spawnRate = p.floor(p.map(coverFactor, 0.0, 1.0, 1, p.max(2, p.floor(gaugeRaw * 0.35))));
        }

        for (let k = 0; k < spawnRate; k++) {
          this.spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor, centerX, centerY, boxW, boxH);
        }

        this.updateParticlesPhysics(p, settings);

        // 💡 1단계 레이어: 이미 깔린 낙엽 융단 버퍼를 가장 바탕에 드로우
        p.image(this.accumulationBuffer, 0, 0);

        // 💡 2단계 레이어: 뚫고 나오는 느낌 극대화를 위해 낙엽 버퍼 위, 공중 파티클 밑에 가사 전면 배치
        this.drawSubtitle(p, style, settings, isCoveringTimeWindow, coverFactor, currentSub, this.subtitleRiseY, fontSize, tracking, leading, offX, offY, boxW, boxH);

        // 💡 3단계 레이어: 공중에서 날아 떨어지는 역동적 파티클을 최상단에 투사
        this.drawLiveParticles(p, glowRaw);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  createTextureFactories(p) {
    this.textureCaches = { leaf: [], grass: [], snow: [] };

    const leafColors = [
      { r: 240, g: 70, b: 35 }, { r: 180, g: 30, b: 20 }, { r: 255, g: 150, b: 45 },
      { r: 215, g: 85, b: 30 }, { r: 135, g: 25, b: 15 }
    ];
    const lobesPool = [5, 7, 6, 5, 7];

    leafColors.forEach((c, idx) => {
      let pg = p.createGraphics(128, 128);
      let ctx = pg.drawingContext;
      let size = 35;
      let lobes = lobesPool[idx];

      ctx.save(); ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.25);
      grad.addColorStop(0, `rgba(${c.r}, ${p.min(255, c.g + 45)}, ${p.min(255, c.b + 35)}, 0.95)`);
      grad.addColorStop(0.4, `rgba(${c.r}, ${c.g}, ${c.b}, 0.95)`);
      grad.addColorStop(1, `rgba(${p.max(10, c.r - 80)}, ${p.max(5, c.g - 25)}, ${p.max(5, c.b - 15)}, 0.95)`);
      ctx.fillStyle = grad;

      ctx.beginPath();
      for (let a = 0; a < 6.28; a += 0.05) {
        let r = size * (1.0 + 0.4 * Math.sin(lobes * a) + 0.2 * Math.sin(lobes * 2 * a));
        let x = r * Math.cos(a); let y = r * Math.sin(a);
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(${p.max(0, c.r - 110)}, 10, 5, 0.35)`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, size * 1.05); ctx.stroke();
      ctx.restore();
      this.textureCaches.leaf.push(pg);
    });

    for (let i = 0; i < 5; i++) {
      let pg = p.createGraphics(128, 128);
      let ctx = pg.drawingContext;
      let size = 38;
      ctx.save(); ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
      let greenShift = 135 + i * 16;
      grad.addColorStop(0, `rgba(${greenShift - 45}, 245, 95, 0.95)`);
      grad.addColorStop(0.5, `rgba(45, ${greenShift - 20}, 65, 0.95)`);
      grad.addColorStop(1, 'rgba(10, 55, 15, 0.95)');
      ctx.fillStyle = grad;

      ctx.beginPath(); ctx.moveTo(0, -size * 1.3);
      ctx.bezierCurveTo(size * 0.65, -size * 0.45, size * 0.65, size * 0.65, 0, size * 1.3);
      ctx.bezierCurveTo(-size * 0.65, size * 0.65, -size * 0.65, -size * 0.45, 0, -size * 1.3);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(8, 40, 10, 0.35)'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(0, -size * 1.1); ctx.lineTo(0, size * 1.1); ctx.stroke();
      ctx.restore();
      this.textureCaches.grass.push(pg);
    }

    for (let i = 0; i < 5; i++) {
      let pg = p.createGraphics(128, 128);
      let ctx = pg.drawingContext;
      let size = 35;
      ctx.save(); ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      grad.addColorStop(1, `rgba(${190 - i * 12}, 220, 255, 0.75)`);
      ctx.strokeStyle = grad; ctx.lineWidth = 2.8;

      for (let j = 0; j < 6; j++) {
        ctx.rotate(Math.PI / 3); ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -size);
        ctx.moveTo(0, -size * 0.4); ctx.lineTo(size * 0.32, -size * 0.58);
        ctx.moveTo(0, -size * 0.4); ctx.lineTo(-size * 0.32, -size * 0.58);
        ctx.stroke();
      }
      ctx.restore();
      this.textureCaches.snow.push(pg);
    }
  }

  // 💡 [CPU 최적화의 핵]: 고중량 폰트 드로잉을 가사 전환 시 딱 1번만 이미지로 가공하는 가속 컨베이어
  renderSubtitleCache(p, text, fontSize, tracking, leading) {
    if (!text) { if (this.subtitleBuffer) this.subtitleBuffer.clear(); return; }
    
    const lines = text.split(" ");
    let maxLineChars = 0;
    lines.forEach(l => { if (l.length > maxLineChars) maxLineChars = l.length; });
    
    const reqW = Math.max(120, p.floor(maxLineChars * tracking + 50));
    const reqH = Math.max(120, p.floor(lines.length * leading + 50));
    
    if (!this.subtitleBuffer) {
      this.subtitleBuffer = p.createGraphics(reqW, reqH);
    } else if (this.subtitleBuffer.width < reqW || this.subtitleBuffer.height < reqH) {
      this.subtitleBuffer.remove();
      this.subtitleBuffer = p.createGraphics(reqW, reqH);
    }
    
    let sb = this.subtitleBuffer;
    sb.clear(); sb.textSize(fontSize); sb.textAlign(p.CENTER, p.CENTER); sb.fill(255); sb.noStroke();
    
    lines.forEach((line, lineIdx) => {
      let currentLineY = (sb.height / 2) + (lineIdx * leading) - ((lines.length - 1) * leading * 0.5);
      let chars = line.split("");
      chars.forEach((char, charIdx) => {
        let finalX = (sb.width / 2) + (charIdx * tracking) - ((chars.length - 1) * tracking * 0.5);
        sb.text(char, finalX, currentLineY);
      });
    });
  }

  spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor, centerX, centerY, boxW, boxH) {
    const gainRaw = settings.audioGain > 5 ? settings.audioGain : settings.audioGain * 100;
    const baseShapeSize = p.map(gainRaw, 10, 500, 12, 65); 
    const endSize = p.random(baseShapeSize * 0.7, baseShapeSize * 1.3);
    const startSize = endSize * 3.2; 

    const scatterRaw = settings.scatterExponent > 5 ? settings.scatterExponent : settings.scatterExponent * 10;
    const speedScale = p.map(scatterRaw, 5, 50, 0.012, 0.045);

    let type = 'leaf';
    if (style === 'pastel') type = 'grass';
    if (style === 'monochrome') type = 'snow';
    if (style === 'earth') type = 'rain';

    const spawnAngle = p.random(p.TWO_PI);
    const spawnRadius = p.max(p.width, p.height) * 0.75;
    const startX = (p.width / 2) + p.cos(spawnAngle) * spawnRadius;
    const startY = (p.height / 2) + p.sin(spawnAngle) * spawnRadius;

    let targetX = p.random(p.width);
    let targetY = p.random(p.height);

    // 💡 [가사 영역 상시 우회]: 평시 연주 중에는 가사 경계면에 절대 안착하지 않도록 오차 제어
    if (!isCoveringTimeWindow) {
      let guardLoop = 0;
      while (p.abs(targetX - centerX) < boxW * 1.15 && p.abs(targetY - centerY) < boxH * 1.15 && guardLoop < 30) {
        targetX = p.random(p.width); targetY = p.random(p.height);
        guardLoop++;
      }
    } else {
      // 가사 교체 타임라인 한정 박스 전역 포화 매립 타겟팅
      targetX = centerX + p.random(-boxW * 0.5, boxW * 0.5);
      targetY = centerY + p.random(-boxH * 0.5, boxH * 0.5);
    }

    this.particles.push({
      x: startX, y: type === 'rain' ? p.random(p.height) : startY,
      startX: startX, startY: startY, targetX: targetX, targetY: targetY,
      pct: 0.0, step: isCoveringTimeWindow ? p.random(0.02, 0.055) : p.random(speedScale * 0.75, speedScale * 1.25),
      startSize: startSize, endSize: endSize, currentSize: startSize,
      angle: p.random(p.TWO_PI), spin: p.random(-0.04, 0.04),
      waveSeed: p.random(100), waveAmp: p.random(25, 55), type: type,
      shuffledTextureIdx: p.floor(p.random(100)), alpha: 255
    });

    // 💡 무제한 라이브 객체 연산 방지를 위한 배열 캡 한계령 자진 체결
    if (this.particles.length > 180) { this.particles.shift(); }
  }

  updateParticlesPhysics(p, settings) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];

      if (pt.type === 'rain') {
        pt.alpha -= 5;
        if (pt.alpha <= 0) this.particles.splice(i, 1);
      } else {
        if (pt.pct < 1.0) {
          pt.pct += pt.step;
          if (pt.pct > 1.0) pt.pct = 1.0;
          
          let rawX = p.lerp(pt.startX, pt.targetX, pt.pct);
          let rawY = p.lerp(pt.startY, pt.targetY, pt.pct);
          
          let wave = Math.sin(pt.pct * Math.PI * 3 + pt.waveSeed) * pt.waveAmp * (1.0 - pt.pct);
          pt.x = rawX + wave * 0.6; pt.y = rawY + wave * 0.4;
          
          pt.currentSize = p.lerp(pt.startSize, pt.endSize, pt.pct);
          pt.angle += pt.spin;
        }

        if (pt.pct >= 1.0) {
          this.drawCachedTextureShape(this.accumulationBuffer, pt, true, 0);
          this.particles.splice(i, 1);
        }
      }
    }
  }

  drawLiveParticles(p, glowRaw) {
    for (let i = 0; i < this.particles.length; i++) {
      let pt = this.particles[i];
      if (pt.type === 'rain') {
        p.noFill(); p.stroke(145, 185, 255, pt.alpha); p.strokeWeight(2.5);
        p.ellipse(pt.x, pt.y, (255 - pt.alpha) * (pt.endSize * 0.05));
      } else {
        this.drawCachedTextureShape(p, pt, false, glowRaw);
      }
    }
  }

  drawCachedTextureShape(target, pt, useEndSize, glowRaw) {
    let pool = this.textureCaches[pt.type];
    if (!pool || pool.length === 0) return;
    
    let cachedGraphics = pool[pt.shuffledTextureIdx % pool.length];
    const renderSize = useEndSize ? pt.endSize : pt.currentSize;

    if (target === this.p5Instance) {
      let p = this.p5Instance;
      p.push(); p.translate(pt.x, pt.y); p.rotate(pt.angle);

      if (pt.type === 'snow' && glowRaw > 0) {
        let ctx = p.drawingContext;
        ctx.save();
        ctx.shadowBlur = p.map(glowRaw, 10, 250, 15, 60);
        ctx.shadowColor = 'rgba(235, 245, 255, 0.95)';
        p.image(cachedGraphics, -renderSize, -renderSize, renderSize * 2, renderSize * 2);
        ctx.restore();
      } else {
        p.image(cachedGraphics, -renderSize, -renderSize, renderSize * 2, renderSize * 2);
      }
      p.pop();
    } else {
      target.push(); target.translate(pt.x, pt.y); target.rotate(pt.angle);
      target.image(cachedGraphics, -renderSize, -renderSize, renderSize * 2, renderSize * 2);
      target.pop();
    }
  }

  drawSubtitle(p, style, settings, isCoveringTimeWindow, coverFactor, currentSub, riseY, fontSize, tracking, leading, offX, offY, boxW, boxH) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    // 💡 [대변혁 성공]: 조건이 바뀔 때만 프리렌더 엔진을 1회 구동하여 폰트 무한 연산 부하 완전 소멸
    if (text !== this.lastRenderedText || fontSize !== this.lastRenderedFontSize) {
      this.renderSubtitleCache(p, text, fontSize, tracking, leading);
      this.lastRenderedText = text;
      this.lastRenderedFontSize = fontSize;
    }

    p.push();
    p.imageMode(p.CENTER);
    
    let alphaFade = 255;
    if (isCoveringTimeWindow && currentSub) {
      alphaFade = p.constrain((1.0 - coverFactor) * 255, 0, 255);
    }
    
    p.tint(255, alphaFade);
    
    // 💡 [대변혁 성공]: 60fps로 도는 메인 루프에서는 미리 구워둔 가사 캔버스 이미지를 초고속 단순 복사 투사
    p.image(this.subtitleBuffer, (p.width / 2) + offX, (p.height / 2) + offY + riseY);
    p.pop();

    if (isCoveringTimeWindow && alphaFade <= 2 && (style === 'neon' || style === 'pastel' || style === 'monochrome')) {
       this.accumulationBuffer.fill(style === 'neon' ? [140, 35, 20, 18] : style === 'pastel' ? [30, 95, 35, 18] : [220, 230, 245, 12]);
       this.accumulationBuffer.rect(0, 0, p.width, p.height);
    }
  }

  update(audioData) {
    // 💡 [완치 비결]: 오토 루프(p.loop)와 슬라이더 redraw() 간의 스레드 간섭 충돌 유발을 막기 위해 비워둠
  }
  
  resize(w, h) { if (this.p5Instance) this.p5Instance.resizeCanvas(w, h); }

  destroy() {
    if (this.p5Instance) { this.p5Instance.remove(); this.p5Instance = null; }
    if (this.accumulationBuffer) { this.accumulationBuffer.remove(); this.accumulationBuffer = null; }
    if (this.subtitleBuffer) { this.subtitleBuffer.remove(); this.subtitleBuffer = null; }
    if (this.textureCaches) {
      ['leaf', 'grass', 'snow'].forEach(t => {
        if (this.textureCaches[t]) this.textureCaches[t].forEach(g => g?.remove());
      });
      this.textureCaches = null;
    }
    this.particles = [];
  }
}
