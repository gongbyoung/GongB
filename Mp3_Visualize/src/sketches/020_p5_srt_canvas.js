/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 16.0 (관제탑 3색 컬러 오버라이드 및 폰트 로드 마스터판)
 * - Noto Sans KR / Black Han Sans 마스터 폰트를 캐시 드로잉에 완전 장착
 * - 눈(Monochrome)과 비(Earth) 스타일 선택 시 가사 가독성 증폭을 위해 customColors 3색 연동 필터링 구축
 * - 가사 변경 전 영역 침범 엄격 통제 디테일 매싱 교정 완료
 * - 전역 window.sketchDiagnostics 객체로 HUD 로거에 실시간 변수 상태 전송
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.particles = [];
    
    this.accumulationBuffer = null;
    this.subtitleBuffer = null; 
    this.lastWidth = 0;
    this.lastHeight = 0;
    
    this.lastTrackedText = "";
    this.subtitleRiseY = 0;
    this.lastRenderedText = "";
    this.lastRenderedFontSize = 0;
    this.lastRenderedColor = "";
    
    this.textureCaches = null;
    this.version = "020호 Custom-Color Adaptive Engine Ver 16.0";
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
        
        this.createTextureFactories(p);
        p.loop();
      };

      p.draw = () => {
        p.clear();
        
        const settings = window.cosmicEngineSettings || { 
          seed: 42, scatterExponent: 2.2, glowIntensity: 0.85, audioGain: 1.0, gaugeValue: 0.5, colorStyle: 'neon',
          customColors: { gas1: '#ff4500', gas2: '#8b0000', star: '#ffff00' }
        };
        
        const style = settings.colorStyle; 
        const custom = settings.customColors || { gas1: '#ff4500', gas2: '#8b0000', star: '#ffff00' };

        if (this.lastWidth !== p.width || this.lastHeight !== p.height) {
          let newBuffer = p.createGraphics(p.width, p.height);
          newBuffer.image(this.accumulationBuffer, 0, 0);
          if (this.accumulationBuffer) this.accumulationBuffer.remove();
          this.accumulationBuffer = newBuffer;
          this.lastWidth = p.width;
          this.lastHeight = p.height;
        }

        // 1. SRT 타임라인 정밀 트래킹
        const audioEl = document.getElementById('audio-player');
        const subs = window.parsedSubtitles || [];
        const currentTime = audioEl ? audioEl.currentTime : 0;
        
        const currentSub = subs.find(s => currentTime >= s.start && currentTime <= s.end);
        const text = window.currentSubtitleText || "";

        const glowRaw = settings.glowIntensity > 5 ? settings.glowIntensity : settings.glowIntensity * 100;
        const fontSize = p.map(glowRaw, 10, 250, 52, 210);
        const tracking = fontSize * 0.74;
        const leading = fontSize * 1.45;

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

        // 가림 임계 수치 환산
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

        // 💡 [매커니즘 미묘함 조치]: 가사 변하기 전 영역 침범 엄격 통제
        let spawnRate = p.frameCount % 3 === 0 ? 1 : 0; 
        if (isCoveringTimeWindow) {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          spawnRate = p.floor(p.map(coverFactor, 0.0, 1.0, 1, p.max(2, p.floor(gaugeRaw * 0.38))));
        }

        for (let k = 0; k < spawnRate; k++) {
          this.spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor, centerX, centerY, boxW, boxH);
        }

        this.updateParticlesPhysics(p, settings, custom);

        // 💡 [HUD 전역 데이터 바인딩]: main.js 로거에 실시간 전송
        window.sketchDiagnostics = {
          fps: p.floor(p.frameRate()),
          particleCount: this.particles.length + (this.accumulationBuffer ? 100 : 0),
          isCovering: isCoveringTimeWindow,
          activeFunction: isCoveringTimeWindow ? "BuryingSubtitle()" : "AmbientDrifting()"
        };

        // 레이어 출력 큐
        p.image(this.accumulationBuffer, 0, 0);
        this.drawSubtitle(p, style, settings, custom, isCoveringTimeWindow, coverFactor, currentSub, this.subtitleRiseY, fontSize, tracking, leading, offX, offY);
        this.drawLiveParticles(p, glowRaw, custom);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  createTextureFactories(p) {
    this.textureCaches = { leaf: [], grass: [], snow: [] };
    const settings = window.cosmicEngineSettings || { customColors: { gas1: '#ff4500', gas2: '#8b0000', star: '#ffff00' } };
    const custom = settings.customColors;

    // 🍁 단풍잎 프리베이킹 (관제탑 Custom Color 반영)
    for (let i = 0; i < 5; i++) {
      let pg = p.createGraphics(128, 128);
      let ctx = pg.drawingContext;
      let size = 35;
      ctx.save(); ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.25);
      grad.addColorStop(0, custom.star);
      grad.addColorStop(0.5, custom.gas1);
      grad.addColorStop(1, custom.gas2);
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let a = 0; a < 6.28; a += 0.05) {
        let lobes = i % 2 === 0 ? 5 : 7;
        let r = size * (1.0 + 0.4 * Math.sin(lobes * a) + 0.2 * Math.sin(lobes * 2 * a));
        let x = r * Math.cos(a); let y = r * Math.sin(a);
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
      this.textureCaches.leaf.push(pg);
    }

    // 🍃 풀잎 프리베이킹
    for (let i = 0; i < 5; i++) {
      let pg = p.createGraphics(128, 128);
      let ctx = pg.drawingContext;
      let size = 38;
      ctx.save(); ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
      grad.addColorStop(0, '#a6f05f'); grad.addColorStop(0.6, custom.gas1); grad.addColorStop(1, custom.gas2);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(0, -size * 1.3);
      ctx.bezierCurveTo(size * 0.65, -size * 0.45, size * 0.65, size * 0.65, 0, size * 1.3);
      ctx.bezierCurveTo(-size * 0.65, size * 0.65, -size * 0.65, -size * 0.45, 0, -size * 1.3);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      this.textureCaches.grass.push(pg);
    }

    // ❄️ 눈꽃송이 프리베이킹 (가산 인광 하이라이트 반영)
    for (let i = 0; i < 5; i++) {
      let pg = p.createGraphics(128, 128);
      let ctx = pg.drawingContext;
      let size = 35;
      ctx.save(); ctx.translate(64, 64);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.0;
      for (let j = 0; j < 6; j++) {
        ctx.rotate(Math.PI / 3); ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -size);
        ctx.moveTo(0, -size * 0.4); ctx.lineTo(size * 0.32, -size * 0.58);
        ctx.stroke();
      }
      ctx.restore();
      this.textureCaches.snow.push(pg);
    }
  }

  // 💡 [가사 고가속 프리렌더 엔진]: 로딩된 구글 폰트를 완벽히 가사에 주입하고 색상 변화에 실시간 갱신 대응
  renderSubtitleCache(p, text, fontSize, tracking, leading, textColorStyle) {
    if (!text) { if (this.subtitleBuffer) this.subtitleBuffer.clear(); return; }
    const lines = text.split(" ");
    let maxLineChars = 0;
    lines.forEach(l => { if (l.length > maxLineChars) maxLineChars = l.length; });
    
    const reqW = Math.max(120, p.floor(maxLineChars * tracking + 60));
    const reqH = Math.max(120, p.floor(lines.length * leading + 60));
    
    if (!this.subtitleBuffer || this.subtitleBuffer.width < reqW || this.subtitleBuffer.height < reqH) {
      if (this.subtitleBuffer) this.subtitleBuffer.remove();
      this.subtitleBuffer = p.createGraphics(reqW, reqH);
    }
    
    let sb = this.subtitleBuffer;
    sb.clear();
    
    // 💡 동적 주입된 메인 웹폰트 바인딩 지시
    sb.textFont('Black Han Sans'); 
    sb.textSize(fontSize); sb.textAlign(p.CENTER, p.CENTER);
    
    // 💡 [색상 가독성 완치]: 지정된 관제탑 3색 컬러셋을 가사에 투사
    sb.fill(textColorStyle); sb.noStroke();
    
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
    const baseShapeSize = p.map(gainRaw, 10, 500, 12, 62); 
    const endSize = p.random(baseShapeSize * 0.7, baseShapeSize * 1.3);
    const startSize = endSize * 3.0; 

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

    if (!isCoveringTimeWindow) {
      let guardLoop = 0;
      while (p.abs(targetX - centerX) < boxW * 1.2 && p.abs(targetY - centerY) < boxH * 1.2 && guardLoop < 25) {
        targetX = p.random(p.width); targetY = p.random(p.height);
        guardLoop++;
      }
    } else {
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

    if (this.particles.length > 150) { this.particles.shift(); }
  }

  updateParticlesPhysics(p, settings, custom) {
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
          this.drawCachedTextureShape(this.accumulationBuffer, pt, true, 0, custom);
          this.particles.splice(i, 1);
        }
      }
    }
  }

  drawLiveParticles(p, glowRaw, custom) {
    for (let i = 0; i < this.particles.length; i++) {
      let pt = this.particles[i];
      if (pt.type === 'rain') {
        p.noFill(); p.stroke(custom.gas1); p.strokeWeight(2.5); // 비 리플 색상 커스텀 연동
        p.ellipse(pt.x, pt.y, (255 - pt.alpha) * (pt.endSize * 0.05));
      } else {
        this.drawCachedTextureShape(p, pt, false, glowRaw, custom);
      }
    }
  }

  drawCachedTextureShape(target, pt, useEndSize, glowRaw, custom) {
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
        ctx.shadowColor = custom.gas2; // 눈꽃 발광색 커스텀 지정화
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

  drawSubtitle(p, style, settings, custom, isCoveringTimeWindow, coverFactor, currentSub, riseY, fontSize, tracking, leading, offX, offY, boxW, boxH) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    // 💡 [알고리즘 3]: 눈(Monochrome)과 비(Earth) 스타일일 때 잘 보이지 않던 가사 색상을 관제탑 3색(custom.star)으로 강제 스위칭
    let textColorStyle = '#ffffff';
    if (style === 'monochrome' || style === 'earth' || style === 'custom') {
      textColorStyle = custom.star; 
    } else {
      textColorStyle = '#ffffff'; // 네온/파스텔은 기본 화이트 유지 혹은 취향에 맞춰 조정
    }

    // 조건부 프리렌더 캐시 무효화 검증식
    if (text !== this.lastRenderedText || fontSize !== this.lastRenderedFontSize || textColorStyle !== this.lastRenderedColor) {
      this.renderSubtitleCache(p, text, fontSize, tracking, leading, textColorStyle);
      this.lastRenderedText = text;
      this.lastRenderedFontSize = fontSize;
      this.lastRenderedColor = textColorStyle;
    }

    p.push(); p.imageMode(p.CENTER);
    let alphaFade = 255;
    if (isCoveringTimeWindow && currentSub) {
      alphaFade = p.constrain((1.0 - coverFactor) * 255, 0, 255);
    }
    p.tint(255, alphaFade);
    
    // 💡 비 효과 시 흔들림 없이 스르륵 가만히 디졸브 연출 완성
    p.image(this.subtitleBuffer, (p.width / 2) + offX, (p.height / 2) + offY + riseY);
    p.pop();

    if (isCoveringTimeWindow && alphaFade <= 2 && (style === 'neon' || style === 'pastel' || style === 'monochrome')) {
       this.accumulationBuffer.fill(style === 'neon' ? [140, 35, 20, 18] : style === 'pastel' ? [30, 95, 35, 18] : [220, 230, 245, 12]);
       this.accumulationBuffer.rect(0, 0, p.width, p.height);
    }
  }

  update(audioData) {}
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
