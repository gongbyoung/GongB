/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 17.0 (하드웨어 30FPS 락 & 폰트 랜덤 셔플 및 절대 레이어 가림 엔진)
 * - 초기화(RESET) 버튼을 누를 때마다 'Black Han Sans'와 'Noto Sans KR' 중 하나를 100% 무작위 자동 선택 바인딩
 * - 레이어 가림 절대성 확보: 가림 타이밍 시 가사 레이어 위로 쉐이프 텍스처를 강제 오버레이 투사하여 물리적 매립 완수
 * - 가사 변경 트리거 발생 즉시 글자 위 낙엽들을 바닥 버퍼로 백베이킹(Bake)하여 다음 자막의 클린 출현 레이어 보장
 * - 30FPS 하드웨어 가속 최적화 고정으로 지연 및 버벅임 100% 영구 동결
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
    
    // 💡 [폰트 랜덤 스위칭 상태 변수]
    this.currentFont = 'Black Han Sans';
    
    this.textureCaches = null;
    this.version = "020호 Random Font & Absolute Overlay Engine Ver 17.0";
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
        
        // 💡 [알고리즘 1: 폰트 랜덤 초기화]: 리셋/기동 시마다 두 명품 폰트 중 하나를 무작위 선정
        const fontPool = ['Black Han Sans', 'Noto Sans KR'];
        this.currentFont = p.random(fontPool);
        console.log(`🎨 [FONT ENGINE] 현재 무작위 선택된 자막 글꼴: ${this.currentFont}`);
        
        this.createTextureFactories(p);
        
        // 30FPS 하드웨어 락 고정
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

        // 가사 변환 시 최상단 고착 낙엽들을 바닥 배경 버퍼로 완전 압착 베이킹(Bake) 처리
        if (text !== this.lastTrackedText) {
          this.particles.forEach(pt => {
            if (pt.isSettledOnText) {
              this.drawCachedTextureShape(this.accumulationBuffer, pt, true, 0, custom);
            }
          });
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

        // 프레임 밀도 스폰 보정
        let spawnRate = p.frameCount % 2 === 0 ? 1 : 0; 
        if (isCoveringTimeWindow) {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          spawnRate = p.floor(p.map(coverFactor, 0.0, 1.0, 2, p.max(5, p.floor(gaugeRaw * 0.55))));
        }

        for (let k = 0; k < spawnRate; k++) {
          this.spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor, centerX, centerY, boxW, boxH);
        }

        this.updateParticlesPhysics(p, settings, custom, isCoveringTimeWindow);

        // 시스템 진단 HUD 매핑
        window.sketchDiagnostics = {
          fps: p.floor(p.frameRate()),
          particleCount: this.particles.length,
          isCovering: isCoveringTimeWindow,
          activeFunction: `Render[Font:${this.currentFont.replace(/ /g,'')}]`
        };

        // ==========================================
        // 💡 [알고리즘 2: 절대 레이어 적층 시공 파이프라인]
        // ==========================================
        
        // 1단계(최하단 바닥): 기존에 이미 안착해 깔려있던 낙엽 버퍼 투사
        p.image(this.accumulationBuffer, 0, 0);
        
        // 2단계(중간 전경): 100% 완전 불투명 상태로 순수 가사 자막을 정갈하게 인쇄 (낙엽 위에 얹어짐)
        this.drawSubtitle(p, style, settings, custom, isCoveringTimeWindow, coverFactor, currentSub, fontSize, tracking, leading, offX, offY);
        
        // 3단계(최상단 덮개): 공중 비행 입자 및 자막 표면에 안착한 낙엽들을 자막 '위로' 최종 투사 (물리 가림 백프로 실현)
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
    sb.clear(); 
    
    // 💡 초기화 시 랜덤 결정된 고유 폰트를 다이내믹 주입
    sb.textFont(this.currentFont); 
    sb.textSize(fontSize); sb.textAlign(p.CENTER, p.CENTER);
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
      // 💡 [정밀 유착 유도]: 가사 텍스트의 바운딩 면적 박스 스케일 내부로 목푯값 완전 정렬
      targetX = centerX + p.random(-boxW * 0.45, boxW * 0.45);
      targetY = centerY + p.random(-boxH * 0.45, boxH * 0.45);
    }

    this.particles.push({
      x: startX, y: type === 'rain' ? p.random(p.height) : startY,
      startX: startX, startY: startY, targetX: targetX, targetY: targetY,
      pct: 0.0, step: isCoveringTimeWindow ? p.random(0.04, 0.095) : p.random(speedScale * 0.75, speedScale * 1.25),
      startSize: startSize, endSize: endSize, currentSize: startSize,
      angle: p.random(p.TWO_PI), spin: p.random(-0.04, 0.04),
      waveSeed: p.random(100), waveAmp: p.random(25, 55), type: type,
      shuffledTextureIdx: p.floor(p.random(100)), alpha: 255,
      isTargetingText: isCoveringTimeWindow, 
      isSettledOnText: false
    });

    if (this.particles.length > 350) { this.particles.shift(); }
  }

  updateParticlesPhysics(p, settings, custom, isCoveringTimeWindow) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];

      if (pt.type === 'rain') {
        pt.alpha -= 10; 
        if (pt.alpha <= 0) this.particles.splice(i, 1);
      } else {
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

        if (pt.pct >= 1.0) {
          if (isCoveringTimeWindow && pt.isTargetingText) {
            // 💡 가사 덮기용 알맹이는 소멸하지 않고 가사 정면 레이어 위에 그대로 정지 고정
            pt.isSettledOnText = true; 
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
        // 💡 자막보다 나중에(최상단에) 드로우되므로 자막을 완벽하게 덮어버림
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
    
    // 💡 [물리 가림 완치]: 가림 시간대에도 자막 자체의 불투명도는 언제나 선명하게 255 고정 (비 효과 제외)
    let alphaLock = 255;
    if (style === 'earth' && isCoveringTimeWindow && currentSub) {
      alphaLock = p.constrain((1.0 - coverFactor) * 255, 0, 255);
    }
    p.tint(255, alphaLock);
    
    // 튀어오르는 변위 없이 완벽 제자리에 깔끔 투사
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
