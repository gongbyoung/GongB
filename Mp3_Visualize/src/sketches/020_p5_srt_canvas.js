/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 18.0 (하드웨어 30FPS 락 & 실시간 땅/호수 배경 이미지 레이어 통합판)
 * - 배경 이미지 동적 바인딩: window.currentUploadedImageElement를 감지하여 캔버스 최하단(바닥면)에 렌더링
 * - 레이어 적층 리펙토링: [배경 이미지] -> [바닥 축적 융단 버퍼] -> [가사 자막] -> [라이브/글자 가림 파티클]
 * - 초기화(RESET) 버튼 작동 시 'Black Han Sans'와 'Noto Sans KR' 중 1종 무작위 자동 셔플 바인딩
 * - 30FPS 프레임 가속 고정으로 조작 레이턴시 및 CPU 과부하 제로 달성
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
    
    this.currentFont = 'Black Han Sans';
    this.textureCaches = null;
    this.version = "020호 Background Texture Layer Engine Ver 18.0";
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
        
        // 초기화 및 리셋 시 가사 폰트 2종 중 무작위 스위칭
        const fontPool = ['Black Han Sans', 'Noto Sans KR'];
        this.currentFont = p.random(fontPool);
        console.log(`🎨 [FONT ENGINE] 캔버스 가사 서체 무작위 세팅 완료: ${this.currentFont}`);
        
        this.createTextureFactories(p);
        
        // 30FPS 하드웨어 가속 락
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

        // 💡 [알고리즘 1: 리얼 땅바닥/호수바닥 텍스처 레이어 시공]
        // 업로드 창을 통해 주입된 배경 이미지가 존재하면 오프스크린 캔버스 최하단 바탕에 즉시 렌더링
        if (window.currentUploadedImageElement) {
          p.image(window.currentUploadedImageElement, 0, 0, p.width, p.height);
        }

        // SRT 가사 동기화 타임라인 트래킹
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

        // 가사가 다음 소절로 바뀌는 찰나에 글자 전면에 고착되어 있던 모든 파티클을 바닥 버퍼로 구워 누적
        if (text !== this.lastTrackedText) {
          this.particles.forEach(pt => {
            if (pt.isSettledOnText) {
              this.drawCachedTextureShape(this.accumulationBuffer, pt, true, 0, custom);
            }
          });
          this.particles = this.particles.filter(pt => !pt.isSettledOnText);
          this.lastTrackedText = text;
        }

        // 가림 임계 윈도우 스케일 연산
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

        // 평시 우회 하강 vs 가림 폭포수 스폰 물리 제어
        let spawnRate = p.frameCount % 2 === 0 ? 1 : 0; 
        if (isCoveringTimeWindow) {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          spawnRate = p.floor(p.map(coverFactor, 0.0, 1.0, 2, p.max(5, p.floor(gaugeRaw * 0.55))));
        }

        for (let k = 0; k < spawnRate; k++) {
          this.spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor, centerX, centerY, boxW, boxH);
        }

        this.updateParticlesPhysics(p, settings, custom, isCoveringTimeWindow);

        // HUD 로거 진단 정보 매핑
        window.sketchDiagnostics = {
          fps: p.floor(p.frameRate()),
          particleCount: this.particles.length,
          isCovering: isCoveringTimeWindow,
          activeFunction: `BG_RenderMode[Font:${this.currentFont.replace(/ /g,'')}]`
        };

        // ==========================================
        // 💡 [알고리즘 2: 배경 이미지 안착 리얼 물리 레이어링 큐]
        // ==========================================
        
        // [1단계 바닥은 대기 중]: 위에서 이미 그려진 배경 이미지(window.currentUploadedImageElement)가 베이스로 작동함
        
        // 2단계: 배경 이미지 바닥면 위에 차곡차곡 무제한 누적되는 잎사귀 버퍼 레이어 투사 (투명 버퍼이므로 BG 위에 합성됨)
        p.image(this.accumulationBuffer, 0, 0);
        
        // 3단계: 가사 자막을 100% 완전 불투명도로 중앙 전경에 드로우 (바닥에 쌓인 낙엽 융단 위에 얹어짐)
        this.drawSubtitle(p, style, settings, custom, isCoveringTimeWindow, coverFactor, currentSub, fontSize, tracking, leading, offX, offY);
        
        // 4단계: 가사 위를 포개어 덮거나 공중에서 날아오는 라이브 입자들을 최상단에 렌더링 (리얼 물리 가림 완수)
        this.drawLiveParticles(p, glowRaw, custom);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  createTextureFactories(p) {
    this.textureCaches = { leaf: [], grass: [], snow: [] };
    const settings = window.cosmicEngineSettings || { customColors: { gas1: '#ff4500', gas2: '#8b0000', star: '#ffff00' } };
    const custom = settings.customColors;

    // 🍁 단풍잎(Neon): 노랑, 주황, 다홍, 밤색 갈색이 오가닉하게 얽히는 단풍 텍스처 캐시
    const leafMixes = [
      { c0: 'rgba(255, 220, 85, 0.95)',  c1: custom.gas1, c2: 'rgba(100, 35, 10, 0.95)' },  
      { c0: custom.star,                 c1: 'rgba(215, 65, 25, 0.95)',  c2: 'rgba(85, 30, 8, 0.95)' },   
      { c0: 'rgba(255, 195, 60, 0.95)',  c1: custom.gas2, c2: 'rgba(75, 20, 5, 0.95)' },   
      { c0: 'rgba(230, 160, 45, 0.95)',  c1: 'rgba(180, 40, 15, 0.95)',  c2: custom.gas2 },               
      { c0: 'rgba(255, 235, 110, 0.95)', c1: custom.gas1, c2: 'rgba(115, 45, 15, 0.95)' } 
    ];

    leafMixes.forEach((m, idx) => {
      let pg = p.createGraphics(128, 128); let ctx = pg.drawingContext; let size = 35;
      ctx.save(); ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.25);
      grad.addColorStop(0, m.c0); grad.addColorStop(0.5, m.c1); grad.addColorStop(1, m.c2);
      ctx.fillStyle = grad; ctx.beginPath();
      for (let a = 0; a < 6.28; a += 0.05) {
        let lobes = idx % 2 === 0 ? 5 : 7;
        let r = size * (1.0 + 0.4 * Math.sin(lobes * a) + 0.2 * Math.sin(lobes * 2 * a));
        let x = r * Math.cos(a); let y = r * Math.sin(a);
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill(); ctx.restore();
      this.textureCaches.leaf.push(pg);
    });

    // 🍃 풀잎(Pastel): 청아하고 화사한 초록색류 5종 캐시 고정
    const greenMixes = [
      { c0: 'rgba(185, 245, 100, 0.95)', c1: 'rgba(55, 185, 80, 0.95)',  c2: 'rgba(15, 75, 25, 0.95)' },  
      { c0: 'rgba(165, 235, 130, 0.95)', c1: 'rgba(40, 155, 110, 0.95)', c2: 'rgba(10, 65, 45, 0.95)' },  
      { c0: 'rgba(215, 250, 110, 0.95)', c1: 'rgba(110, 200, 60, 0.95)', c2: 'rgba(30, 100, 20, 0.95)' }, 
      { c0: 'rgba(195, 240, 150, 0.95)', c1: 'rgba(75, 175, 75, 0.95)',  c2: 'rgba(20, 85, 30, 0.95)' },  
      { c0: 'rgba(160, 225, 95, 0.95)',  c1: 'rgba(50, 145, 60, 0.95)',  c2: 'rgba(12, 60, 15, 0.95)' }   
    ];

    greenMixes.forEach((gm, idx) => {
      let pg = p.createGraphics(128, 128); let ctx = pg.drawingContext; let size = 38;
      ctx.save(); ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
      grad.addColorStop(0, gm.c0); grad.addColorStop(0.5, gm.c1); grad.addColorStop(1, gm.c2);
      ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, -size * 1.3);
      ctx.bezierCurveTo(size * 0.65, -size * 0.45, size * 0.65, size * 0.65, 0, size * 1.3);
      ctx.bezierCurveTo(-size * 0.65, size * 0.65, -size * 0.65, -size * 0.45, 0, -size * 1.3);
      ctx.closePath(); ctx.fill(); ctx.restore();
      this.textureCaches.grass.push(pg);
    });

    // ❄️ 눈꽃송이(Monochrome) 프리베이킹
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
    sb.clear(); sb.textFont(this.currentFont); sb.textSize(fontSize); sb.textAlign(p.CENTER, p.CENTER);
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
            pt.isSettledOnText = true; 
          } else {
            // 바닥(배경 이미지 위)에 닿으면 축적 버퍼에 박제 유도
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
    let alphaLock = 255;
    if (style === 'earth' && isCoveringTimeWindow && currentSub) {
      alphaLock = p.constrain((1.0 - coverFactor) * 255, 0, 255);
    }
    p.tint(255, alphaLock);
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
