/**
 * src/sketches/020_p5_srt_canvas.js
 * - [버전] Ver 17.5 (셔플 오가닉 단풍 수묵색상 및 PASTEL 초록잎 고정판)
 * - Neon 단풍잎: 옐로우, 버트 오렌지, 크림슨 레드, 체스넛 브라운 등 다채로운 가을빛을 한 잎사귀 안 그라디언트에 완전 물들임
 * - Pastel 풀잎: 파스텔 톤 가설을 철회하고 완벽하게 파릇파릇 싱그러운 초록색류 5가지 그라디언트 잎으로 강제 고정 튜닝
 * - 30FPS 하드웨어 가속 락 및 글자 투명화 없는 명품 적층 덮기 가림 완성
 * - 초기화(RESET) 시 Noto Sans KR / Black Han Sans 마스터 웹글꼴 중 1종 무작위 자동 결정 스위칭
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
    this.version = "020호 Realistic Shuffled Foliage Engine Ver 17.5";
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
        
        // 💡 초기화(RESET) 시마다 폰트를 무작위로 자동 선정
        const fontPool = ['Black Han Sans', 'Noto Sans KR'];
        this.currentFont = p.random(fontPool);
        console.log(`🎨 [FONT RANDOMIZER] 선택된 명품 서체: ${this.currentFont}`);
        
        this.createTextureFactories(p);
        
        // 30FPS 하드웨어 락 보정
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

        // SRT 가사 타임라인 정밀 트래킹
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

        // 가사가 변경되는 순간 전경에 있던 가림 조각들을 전부 배경으로 베이킹 처리
        if (text !== this.lastTrackedText) {
          this.particles.forEach(pt => {
            if (pt.isSettledOnText) {
              this.drawCachedTextureShape(this.accumulationBuffer, pt, true, 0, custom);
            }
          });
          this.particles = this.particles.filter(pt => !pt.isSettledOnText);
          this.lastTrackedText = text;
        }

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

        let spawnRate = p.frameCount % 2 === 0 ? 1 : 0; 
        if (isCoveringTimeWindow) {
          const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
          spawnRate = p.floor(p.map(coverFactor, 0.0, 1.0, 2, p.max(5, p.floor(gaugeRaw * 0.55))));
        }

        for (let k = 0; k < spawnRate; k++) {
          this.spawnParticle(p, style, settings, isCoveringTimeWindow, coverFactor, centerX, centerY, boxW, boxH);
        }

        this.updateParticlesPhysics(p, settings, custom, isCoveringTimeWindow);

        // 시스템 진단 통계 갱신
        window.sketchDiagnostics = {
          fps: p.floor(p.frameRate()),
          particleCount: this.particles.length,
          isCovering: isCoveringTimeWindow,
          activeFunction: `Render[Font:${this.currentFont.replace(/ /g,'')}]`
        };

        // 절대 레이어링 파이프라인 가동
        p.image(this.accumulationBuffer, 0, 0); // 1단계: 바닥 레이어
        this.drawSubtitle(p, style, settings, custom, isCoveringTimeWindow, coverFactor, currentSub, fontSize, tracking, leading, offX, offY); // 2단계: 가사 자막 레이어 (배경 위에 안착)
        this.drawLiveParticles(p, glowRaw, custom); // 3단계: 가사 위를 덮는 물리 가림 레이어
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 💡 [알고리즘 3]: 노랑, 갈색이 유기적으로 공존하는 진짜 단풍잎 및 선명한 초록 풀잎 프리베이킹
  createTextureFactories(p) {
    this.textureCaches = { leaf: [], grass: [], snow: [] };
    const settings = window.cosmicEngineSettings || { customColors: { gas1: '#ff4500', gas2: '#8b0000', star: '#ffff00' } };
    const custom = settings.customColors;

    // 🍁 1. 단풍잎(Neon): 한 잎사귀 안에 노랑, 주황, 빨강, 갈색(Burnt Chestnut/Ochre)이 유기적으로 뒤섞이는 5종 셔플링 디자인
    const leafMixes = [
      { c0: 'rgba(255, 220, 85, 0.95)',  c1: custom.gas1, c2: 'rgba(100, 35, 10, 0.95)' },  // 화사한 골드노랑 -> 커스텀1 -> 밤색 낙엽 갈색
      { c0: custom.star,                 c1: 'rgba(215, 65, 25, 0.95)',  c2: 'rgba(85, 30, 8, 0.95)' },   // 커스텀Star -> 물든 가을 오렌지 -> 짙은 황토갈색
      { c0: 'rgba(255, 195, 60, 0.95)',  c1: custom.gas2, c2: 'rgba(75, 20, 5, 0.95)' },   // 금색 앰버 -> 커스텀2 -> 다크 체스넛 브라운
      { c0: 'rgba(230, 160, 45, 0.95)',  c1: 'rgba(180, 40, 15, 0.95)',  c2: custom.gas2 },               // 가을 들판 황토색 -> 타오르는 붉은 단풍 -> 커스텀2
      { c0: 'rgba(255, 235, 110, 0.95)', c1: custom.gas1, c2: 'rgba(115, 45, 15, 0.95)' } // 햇살 옐로우 -> 커스텀1 -> 마른 낙엽 갈색
    ];

    leafMixes.forEach((m, idx) => {
      let pg = p.createGraphics(128, 128); let ctx = pg.drawingContext; let size = 35;
      ctx.save(); ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.25);
      grad.addColorStop(0, m.c0); 
      grad.addColorStop(0.5, m.c1); 
      grad.addColorStop(1, m.c2);
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

    // 🍃 2. 풀잎(Pastel): 붉은색의 간섭을 완전히 차단한 극도로 싱그럽고 파릇파릇한 리얼 초록색류 그라디언트 고정 시공
    const greenMixes = [
      { c0: 'rgba(185, 245, 100, 0.95)', c1: 'rgba(55, 185, 80, 0.95)',  c2: 'rgba(15, 75, 25, 0.95)' },  // 라임 그린 -> 잔디 초록 -> 숲속 딥 그린
      { c0: 'rgba(165, 235, 130, 0.95)', c1: 'rgba(40, 155, 110, 0.95)', c2: 'rgba(10, 65, 45, 0.95)' },  // 민트 연두 -> 에메랄드 -> 다크 올리브 그린
      { c0: 'rgba(215, 250, 110, 0.95)', c1: 'rgba(110, 200, 60, 0.95)', c2: 'rgba(30, 100, 20, 0.95)' }, // 밝은 황록색 -> 올리브 초록 -> 깊은 전나무색
      { c0: 'rgba(195, 240, 150, 0.95)', c1: 'rgba(75, 175, 75, 0.95)',  c2: 'rgba(20, 85, 30, 0.95)' },  // 파스텔 연두 -> 정통 초록색 -> 이끼 상록수색
      { c0: 'rgba(160, 225, 95, 0.95)',  c1: 'rgba(50, 145, 60, 0.95)',  c2: 'rgba(12, 60, 15, 0.95)' }   // 어린새싹 그린 -> 삼림 그린 -> 다크 포레스트 그린
    ];

    greenMixes.forEach((gm, idx) => {
      let pg = p.createGraphics(128, 128); let ctx = pg.drawingContext; let size = 38;
      ctx.save(); ctx.translate(64, 64);
      let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
      grad.addColorStop(0, gm.c0); 
      grad.addColorStop(0.5, gm.c1); 
      grad.addColorStop(1, gm.c2);
      ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, -size * 1.3);
      ctx.bezierCurveTo(size * 0.65, -size * 0.45, size * 0.65, size * 0.65, 0, size * 1.3);
      ctx.bezierCurveTo(-size * 0.65, size * 0.65, -size * 0.65, -size * 0.45, 0, -size * 1.3);
      ctx.closePath(); ctx.fill(); ctx.restore();
      this.textureCaches.grass.push(pg);
    });

    // ❄️ 3. 눈꽃송이(Monochrome) 프리베이킹
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
