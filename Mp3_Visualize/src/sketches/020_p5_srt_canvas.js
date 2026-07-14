/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 16.5 (30FPS 하드웨어 락 및 리얼 물리 가림 엔진)
 * - 30FPS 고정 시공으로 CPU/메모리 부하 원천 파괴 및 부드러운 하드웨어 가속 보장
 * - 가사 투명화(Alpha Fade) 및 상승 트랜지션 전면 폐기 -> 완전 불투명(255) 상태로 즉시 출현
 * - 레이어 재정렬: [축적 버퍼] -> [자막(완전불투명)] -> [라이브/자막 가림 파티클] 순으로 시공하여 진짜 물리 가림 실현
 * - 가사 변경 시 글자를 덮고 있던 최상단 낙엽 조각들을 바닥 버퍼로 즉시 베이킹(Bake) 처리
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
    this.lastRenderedText = "";
    this.lastRenderedFontSize = 0;
    this.lastRenderedColor = "";
    
    this.textureCaches = null;
    this.version = "020호 30FPS Real Masking Engine Ver 16.5";
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
        
        // 💡 [30FPS 락 체결]: 초당 30프레임으로 제한하여 그래픽 가속 연산 최적화 고정
        p.frameRate(30);
        p.loop();
      };

      p.draw = () => {
        p.clear();
        
        const settings = window.cosmicEngineSettings || { 
          seed: 42, scatterExponent: 2.2, glowIntensity: 0.85, audioGain: 1.0, gaugeValue: 0.5, colorStyle: 'neon',
          customColors: { gas1: '#ff4500', gas2: '#8b0000', star: '#ffff00' }
        };
        
        const style = settings.colorStyle; 
        const custom = settings.customColors;

        if (this.lastWidth !== p.width || this.lastHeight !== p.height) {
          let newBuffer = p.createGraphics(p.width, p.height);
          newBuffer.image(this.accumulationBuffer, 0, 0);
          if (this.accumulationBuffer) this.accumulationBuffer.remove();
          this.accumulationBuffer = newBuffer;
          this.lastWidth = p.width;
          this.lastHeight = p.height;
        }

        // SRT 데이터 스트림 추적
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

        // 💡 [가사 변경 및 전경 베이킹 트리거]: 가사가 바뀔 때 글자 위에 얹혀있던 낙엽들을 바닥 버퍼로 즉시 구워버림
        if (text !== this.lastTrackedText) {
          this.particles.forEach(pt => {
            if (pt.isSettledOnText) {
              this.drawCachedTextureShape(this.accumulationBuffer, pt, true, 0, custom);
            }
          });
          // 글자 위 낙엽들을 라이브 배열에서 일제 청소하여 새 가사 출현 공간 확보
          this.particles = this.particles.filter(pt => !pt.isSettledOnText);
          this.lastTrackedText = text;
        }

        // 타임라인 동기화 가림 시간선 계산
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

        // 30fps 최적화에 맞춘 동적 스폰 밀도 보정
        let spawnRate = p.frameCount % 2 === 0 ? 1 : 0; 
        if (isCoveringTimeWindow) {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          spawnRate = p.floor(p.map(coverFactor, 0.0, 1.0, 2, p.max(4, p.floor(gaugeRaw * 0.45))));
        }

        for (let k = 0; k < spawnRate; k++) {
          this.spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor, centerX, centerY, boxW, boxH);
        }

        this.updateParticlesPhysics(p, settings, custom, isCoveringTimeWindow);

        // 시스템 진단 HUD 통신 데이터 스트림
        window.sketchDiagnostics = {
          fps: p.floor(p.frameRate()),
          particleCount: this.particles.length,
          isCovering: isCoveringTimeWindow,
          activeFunction: isCoveringTimeWindow ? "PhysicalTargetBurying()" : "AmbientDrifting()"
        };

        // 💡 [레이어링의 대혁명 연출 큐]: 자막을 바닥 버퍼 위, 라이브 입자 아래에 샌드위치 시공
        // 1단계: 기존에 쌓인 바닥 융단 낙엽 드로우
        p.image(this.accumulationBuffer, 0, 0);
        
        // 2단계: 그 위에 100% 완전 불투명 상태로 가사 자막을 정갈하게 인쇄 (배경 낙엽 위에 얹어짐)
        this.drawSubtitle(p, style, settings, custom, isCoveringTimeWindow, coverFactor, currentSub, fontSize, tracking, leading, offX, offY);
        
        // 3단계: 공중 낙엽 및 글자 전면에 안착하여 글씨를 '진짜' 가려버리는 물리 낙엽 최상단 투사
        this.drawLiveParticles(p, glowRaw, custom);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  createTextureFactories(p) {
    this.textureCaches = { leaf: [], grass: [], snow: [] };
    const settings = window.cosmicEngineSettings || { customColors: { gas1: '#ff4500', gas2: '#8b0000', star: '#ffff00' } };
    const custom = settings.customColors;

    for (let i = 0; i < 5; i++) {
      let pg = p.createGraphics(128, 128); let ctx = pg.drawingContext; let size = 35;
      ctx.save(); ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.25);
      grad.addColorStop(0, custom.star); grad.addColorStop(0.5, custom.gas1); grad.addColorStop(1, custom.gas2);
      ctx.fillStyle = grad; ctx.beginPath();
      for (let a = 0; a < 6.28; a += 0.05) {
        let lobes = i % 2 === 0 ? 5 : 7;
        let r = size * (1.0 + 0.4 * Math.sin(lobes * a) + 0.2 * Math.sin(lobes * 2 * a));
        let x = r * Math.cos(a); let y = r * Math.sin(a);
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill(); ctx.restore();
      this.textureCaches.leaf.push(pg);
    }

    for (let i = 0; i < 5; i++) {
      let pg = p.createGraphics(128, 128); let ctx = pg.drawingContext; let size = 38;
      ctx.save(); ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
      grad.addColorStop(0, '#a6f05f'); grad.addColorStop(0.6, custom.gas1); grad.addColorStop(1, custom.gas2);
      ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, -size * 1.3);
      ctx.bezierCurveTo(size * 0.65, -size * 0.45, size * 0.65, size * 0.65, 0, size * 1.3);
      ctx.bezierCurveTo(-size * 0.65, size * 0.65, -size * 0.65, -size * 0.45, 0, -size * 1.3);
      ctx.closePath(); ctx.fill(); ctx.restore();
      this.textureCaches.grass.push(pg);
    }

    for (let i = 0; i < 5; i++) {
      let pg = p.createGraphics(128, 128); let ctx = pg.drawingContext; let size = 35;
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
    sb.clear(); sb.textFont('Black Han Sans'); sb.textSize(fontSize); sb.textAlign(p.CENTER, p.CENTER);
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
    const baseShapeSize = p.map(gainRaw, 10, 500, 12, 65); 
    const endSize = p.random(baseShapeSize * 0.7, baseShapeSize * 1.3);
    const startSize = endSize * 3.0; 

    const scatterRaw = settings.scatterExponent > 5 ? settings.scatterExponent : settings.scatterExponent * 10;
    // 💡 30fps 하향에 대응하여 보간 속도 계수를 2배 상향 터치
    const speedScale = p.map(scatterRaw, 5, 50, 0.024, 0.09);

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
      // 가림 타이밍 시 가사 영역 내부 박스로 정밀 유착 분산화
      targetX = centerX + p.random(-boxW * 0.5, boxW * 0.5);
      targetY = centerY + p.random(-boxH * 0.5, boxH * 0.5);
    }

    this.particles.push({
      x: startX, y: type === 'rain' ? p.random(p.height) : startY,
      startX: startX, startY: startY, targetX: targetX, targetY: targetY,
      pct: 0.0, 
      step: isCoveringTimeWindow ? p.random(0.035, 0.09) : p.random(speedScale * 0.75, speedScale * 1.25),
      startSize: startSize, endSize: endSize, currentSize: startSize,
      angle: p.random(p.TWO_PI), spin: p.random(-0.04, 0.04),
      waveSeed: p.random(100), waveAmp: p.random(25, 55), type: type,
      shuffledTextureIdx: p.floor(p.random(100)), alpha: 255,
      isTargetingText: isCoveringTimeWindow, // 가사 가림용 파티클 여부 바인딩
      isSettledOnText: false
    });

    if (this.particles.length > 200) { this.particles.shift(); }
  }

  updateParticlesPhysics(p, settings, custom, isCoveringTimeWindow) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];

      if (pt.type === 'rain') {
        pt.alpha -= 10; // 30fps 대응 페이딩 속도 상향
        if (pt.alpha <= 0) this.particles.splice(i, 1);
      } else {
        // 이미 글자 위에 고착되어 가리고 있는 녀석은 물리 연산 스킵
        if (pt.isSettledOnText) continue;

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

        // 💡 [물리 가림의 핵심 알고리즘]: 목적지 도달 시 가사 가림용이면 최상단 레이어에 정지 고정, 일반 낙엽이면 바닥 버퍼로 즉시 전송
        if (pt.pct >= 1.0) {
          if (isCoveringTimeWindow && pt.isTargetingText) {
            pt.isSettledOnText = true; // 가사 표면에 물리 박제 플래그 작동 (제거하지 않고 홀딩)
          } else {
            this.drawCachedTextureShape(this.accumulationBuffer, pt, true, 0, custom);
            this.particles.splice(i, 1);
          }
        }
      }
    }
  }

  drawLiveParticles(p, glowRaw, custom) {
    for (let i = 0; i < this.particles.length; i++) {
      let pt = this.particles[i];
      if (pt.type === 'rain') {
        p.noFill(); p.stroke(custom.gas1); p.strokeWeight(2.5);
        p.ellipse(pt.x, pt.y, (255 - pt.alpha) * (pt.endSize * 0.05));
      } else {
        // 공중 파티클 및 글자 전면 안착 가림 파티클 모두 최상단에 투사
        this.drawCachedTextureShape(p, pt, pt.isSettledOnText, glowRaw, custom);
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
        ctx.save(); ctx.shadowBlur = p.map(glowRaw, 10, 250, 15, 60); ctx.shadowColor = custom.gas2;
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

  drawSubtitle(p, style, settings, custom, isCoveringTimeWindow, coverFactor, currentSub, fontSize, tracking, leading, offX, offY) {
    const text = window.currentSubtitleText || "";
    if (!text) return;

    let textColorStyle = '#ffffff';
    if (style === 'monochrome' || style === 'earth' || style === 'custom') {
      textColorStyle = custom.star; 
    }

    if (text !== this.lastRenderedText || fontSize !== this.lastRenderedFontSize || textColorStyle !== this.lastRenderedColor) {
      this.renderSubtitleCache(p, text, fontSize, tracking, leading, textColorStyle);
      this.lastRenderedText = text;
      this.lastRenderedFontSize = fontSize;
      this.lastRenderedColor = textColorStyle;
    }

    p.push(); p.imageMode(p.CENTER);
    
    // 💡 [투명화 완전 박멸]: 가림 윈도우 진행도에 상관없이 언제나 선명도 255(100% 불투명) 보존 고정
    let alphaLock = 255;
    if (style === 'earth' && isCoveringTimeWindow && currentSub) {
      // 비 효과 시에만 번져서 사라지는 디졸브 연출을 위해 알파 감쇄 허용
      alphaLock = p.constrain((1.0 - coverFactor) * 255, 0, 255);
    }
    p.tint(255, alphaLock);
    
    // 💡 애니메이션 변위(riseY)를 제거하여 가사가 튀어오르지 않고 제자리에 즉시 고정 출현하도록 연동
    p.image(this.subtitleBuffer, (p.width / 2) + offX, (p.height / 2) + offY);
    p.pop();
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
