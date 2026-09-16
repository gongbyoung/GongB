/**
 * src/sketches/030_acoustic_assets.js
 * - [030호 유기적 홀로그램 엔진 Ver 6.0 - 단일축 교차 모델]
 * - 🎻 STRING: 모든 선이 '하나의 유영하는 중심축'을 공유하며 거미줄/리본처럼 얽히고 교차함
 * - 🎤 VOCAL: 중심축의 현재 위치에서 다양한 크기의 연기가 피어오르며 리얼하게 사라짐
 * - 🥁 DRUM: 중심축을 기반으로 한 발광 패드에서 역동적으로 도형이 튐
 * - 모든 움직임, 크기, 폭발 빈도가 UI 슬라이더와 100% 연동
 */

export default class HolographicStageSketch {
  constructor(container) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    if (this.container) {
      this.container.appendChild(this.canvas);
    }

    this.time = 0;
    this.version = "030호 유기적 홀로그램 Ver 6.0";
    
    this.smokeParticles = [];
    this.drumShapes = [];
    
    this.smokeTexture = this.createSmokeTexture();
    this.lastDrums = 0;
    
    this.init();
  }

  init() {
    this.resize();
  }

  resize(w, h) {
    this.width = w || (this.container ? this.container.clientWidth : 800) || 800;
    this.height = h || (this.container ? this.container.clientHeight : 600) || 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  // ☁️ 사실적인 연기 텍스처 (가장자리가 부드럽게 디졸브)
  createSmokeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.3)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return canvas;
  }

  // 🥁 기하학 도형 스폰
  spawnDrumShape(x, y, intensity, spreadRange, scaleMulti, speedMulti, isAmbient = false) {
    const types = ['triangle', 'ring', 'circle'];
    const colors = ['#ff2a6d', '#05d9e8', '#ff7a00', '#d1f7ff', '#b537f2'];
    
    const count = isAmbient ? 1 : Math.floor(intensity * 4) + 1; 
    
    for (let i = 0; i < count; i++) {
      this.drumShapes.push({
        type: types[Math.floor(Math.random() * types.length)],
        x: x + (Math.random() * spreadRange - spreadRange / 2),
        y: y,
        vx: (Math.random() - 0.5) * 6 * speedMulti,
        vy: isAmbient ? -(Math.random() * 2 + 1) * speedMulti : -(Math.random() * 8 + 4) * intensity * speedMulti,
        size: (Math.random() * 15 + 8) * scaleMulti,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.0,
        decay: 0.015 + Math.random() * 0.015,
        angle: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2
      });
    }
  }

  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const W = this.canvas.width;
    const H = this.canvas.height;
    const settings = window.cosmicEngineSettings || {};
    
    // 🎛️ 오디오 데이터 & 게이지 민감도
    const targetAudio = (audioData && audioData.vol !== undefined) ? audioData : (window.latestCompiledAudioData || {});
    const gaugeVal = settings.gaugeValue ?? 0.5; 
    
    const vocals = (targetAudio.vocalsVol !== undefined ? targetAudio.vocalsVol : (targetAudio.mid || 0)) * gaugeVal * 2.5;
    const drums  = (targetAudio.drumsVol  !== undefined ? targetAudio.drumsVol  : (targetAudio.bass || 0)) * gaugeVal * 2.5;
    const strings= (targetAudio.otherVol  !== undefined ? targetAudio.otherVol  : (targetAudio.treble || 0)) * gaugeVal * 2.5;
    const vol = targetAudio.vol || 0;

    // 🎛️ 관제탑 UI 값
    const seedVal = settings.seed ?? 42;                             // Shuffle: 파장 및 꼬임 형태 변경
    const scatterVal = settings.scatterExponent ?? 2.2;              // Range: 화면에서 상하 유영하는 폭 조절
    const glowVal = settings.glowIntensity ?? 0.85;                  // Scale: 연기 및 진동 크기
    const gainVal = settings.audioGain ?? 1.0;                       // Volume: 이동 속도

    this.time += (0.01 + (strings * 0.02)) * gainVal;

    // 📐 레터박스 엔진
    let exportRatio = settings.exportRatio || 'full';
    let renderW = W, renderH = H, renderX = 0, renderY = 0;
    if (exportRatio === '16:9') {
      renderH = W * (9/16);
      if (renderH > H) { renderH = H; renderW = H * (16/9); }
      renderX = (W - renderW)/2; renderY = (H - renderH)/2;
    } else if (exportRatio === '9:16') {
      renderW = H * (9/16);
      if (renderW > W) { renderW = W; renderH = W * (16/9); }
      renderX = (W - renderW)/2; renderY = (H - renderH)/2;
    }

    this.ctx.save();
    this.ctx.fillStyle = "#020204"; 
    this.ctx.fillRect(0, 0, W, H);
    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    const centerX = renderX + renderW / 2;
    const centerY = renderY + renderH / 2;
    
    // 💡 [핵심]: 유영하는 공통 중심축(yBase)
    // Range(scatterVal)에 따라 상하로 움직이는 폭이 달라지며, 시간에 따라 부드럽게 위아래로 떠다닙니다.
    const driftY = Math.sin(this.time * 0.4 + seedVal * 0.1) * (renderH * 0.25 * scatterVal);
    const yBase = centerY + driftY;

    // Range에 따른 파티클 가로 퍼짐 폭
    const spreadRange = renderW * 0.4 * scatterVal; 

    // ==========================================
    // 1. 🎻 STRING 파트 : 하나의 선에 모여 교차하는 빛의 물결
    // ==========================================
    const lineColors = ['#00ffcc', '#ff0055', '#4d4dff', '#ffaa00', '#cc00ff', '#ffffff'];
    this.ctx.globalCompositeOperation = 'screen';
    
    for (let i = 0; i < 6; i++) {
      this.ctx.beginPath();
      this.ctx.lineWidth = 1.5 + (strings * 3);
      this.ctx.strokeStyle = lineColors[i % lineColors.length];
      this.ctx.shadowBlur = 15 * glowVal;
      this.ctx.shadowColor = this.ctx.strokeStyle;
      this.ctx.globalAlpha = 0.3 + (strings * 0.7);

      this.ctx.moveTo(renderX, yBase);
      for (let x = renderX; x <= renderX + renderW; x += 15) {
        // 💡 모든 선이 동일한 yBase를 기준으로 위아래로 진동합니다.
        // 주파수(freq)와 위상(phase)이 i값에 따라 다르기 때문에 평행하지 않고 서로 교차(Intersect)합니다!
        const freq = 0.002 + (i * 0.0015) * (seedVal * 0.05);
        const phase = this.time * (2 + i * 0.5);
        
        // 💡 진폭(Amp)도 선마다 다르게 요동치게 만들어 3D 리본처럼 보이게 함
        const baseAmp = (15 + (strings * 120)) * glowVal;
        const individualAmp = baseAmp * Math.sin(this.time * 0.3 + i * Math.PI / 3);
        
        const waveY = Math.sin(x * freq + phase) * individualAmp;
        
        this.ctx.lineTo(x, yBase + waveY);
      }
      this.ctx.stroke();
    }
    this.ctx.shadowBlur = 0;

    // ==========================================
    // 2. 🎤 VOCAL 파트 : 움직이는 축(yBase)에서 흩날리는 유기적인 연기
    // ==========================================
    if (vocals > 0.1 || Math.random() < 0.15) {
      const isAmbient = vocals <= 0.1;
      this.smokeParticles.push({
        x: centerX + (Math.random() * spreadRange - spreadRange / 2),
        y: yBase, // 💡 연기가 항상 유영하는 중심선에서 시작됨!
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: Math.random() * 0.05 + 0.02,
        vy: isAmbient ? -(Math.random() * 1.5 + 0.5) * gainVal : -(Math.random() * 3 + 1.5) * vocals * gainVal,
        size: (Math.random() * 60 + 20) * glowVal, // 크기가 다양함
        life: 1.0,
        decay: 0.005 + Math.random() * 0.007, // 천천히 사라짐
        hue: 240 + Math.random() * 120 
      });
    }

    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      let p = this.smokeParticles[i];
      
      // 위로 상승하며 유기적으로 좌우로 흔들림
      p.x += Math.sin(this.time * 3 + p.driftPhase) * 2.0;
      p.y += p.vy;
      p.size *= 0.985; // 점점 작아지는 디졸브 효과
      p.life -= p.decay;

      if (p.life <= 0 || p.size < 5) {
        this.smokeParticles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.globalAlpha = p.life * (0.3 + vocals * 0.7);
      this.ctx.globalCompositeOperation = 'screen';
      
      this.ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.life})`;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.drawImage(this.smokeTexture, -p.size, -p.size, p.size * 2, p.size * 2);
      this.ctx.restore();
    }

    // ==========================================
    // 3. 🥁 DRUM 파트 : 기하학 도형 (Shapes)
    // ==========================================
    this.ctx.globalCompositeOperation = 'source-over';
    
    // 중앙선(yBase) 아래에 깔리는 빛나는 무대 패드
    const padY = yBase + 20; 
    this.ctx.globalCompositeOperation = 'screen';
    const floorGrad = this.ctx.createRadialGradient(centerX, padY, 0, centerX, padY, renderW * 0.3 * glowVal);
    floorGrad.addColorStop(0, `rgba(100, 150, 255, ${0.1 + drums * 0.4})`);
    floorGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = floorGrad;
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, padY, spreadRange * 0.8, 30 * glowVal, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalCompositeOperation = 'source-over';

    if (drums > 0.25 && drums > this.lastDrums + 0.02) {
      this.spawnDrumShape(centerX, padY, drums, spreadRange, glowVal, gainVal, false);
    } else if (Math.random() < 0.05) {
      this.spawnDrumShape(centerX, padY, 0.2, spreadRange, glowVal, gainVal, true);
    }
    this.lastDrums = drums;

    for (let i = this.drumShapes.length - 1; i >= 0; i--) {
      let s = this.drumShapes[i];
      
      s.vy += 0.3 * gainVal; 
      s.x += s.vx;
      s.y += s.vy;
      s.angle += s.rotSpeed;
      s.life -= s.decay;

      // 움직이는 축(padY)를 바닥 삼아 튕김!
      if (s.y > padY + 10) {
        s.y = padY + 10;
        s.vy *= -0.6;
        s.vx *= 0.8; 
      }

      if (s.life <= 0) {
        this.drumShapes.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(s.x, s.y);
      this.ctx.rotate(s.angle);
      this.ctx.globalAlpha = s.life;
      
      this.ctx.shadowBlur = 10 * glowVal;
      this.ctx.shadowColor = s.color;

      if (s.type === 'triangle') {
        this.ctx.strokeStyle = s.color;
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -s.size);
        this.ctx.lineTo(s.size * 0.866, s.size * 0.5);
        this.ctx.lineTo(-s.size * 0.866, s.size * 0.5);
        this.ctx.closePath();
        this.ctx.stroke();
      } else if (s.type === 'ring') {
        this.ctx.strokeStyle = s.color;
        this.ctx.lineWidth = 3.5;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, s.size, 0, Math.PI * 2);
        this.ctx.stroke();
      } else {
        this.ctx.fillStyle = s.color;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, s.size * 0.7, 0, Math.PI * 2);
        this.ctx.fill();
      }
      
      this.ctx.restore();
    }

    // ==========================================
    // 4. ✍️ 자막 (중심선을 따라 유영함)
    // ==========================================
    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "";
    
    if (subtitleText && settings.showSubtitle !== false) {
      this.ctx.globalAlpha = 1.0;
      this.ctx.globalCompositeOperation = 'source-over';
      const baseFontSize = Math.max(26, Math.min(48, renderW * 0.055));
      const fontSize = baseFontSize * (1.0 + (vol * 0.05)); 
      
      const rawFont = settings.fontFamily || "Noto Sans KR";
      const cleanFontName = rawFont.replace(/['"]/g, ''); 
      
      this.ctx.font = `bold ${fontSize}px "${cleanFontName}", sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const lines = subtitleText.split('\n');
      const lineHeight = fontSize * 1.35;

      // 💡 자막 위치도 움직이는 중심축(yBase)을 기준으로 유영하게 만듦
      const textCenterY = yBase - (renderH * 0.2);

      lines.forEach((line, idx) => {
        const lineY = textCenterY + (idx - (lines.length - 1) / 2) * lineHeight;

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        [-2, 2].forEach(ox => {
          [-2, 2].forEach(oy => {
            this.ctx.fillText(line, centerX + ox, lineY + oy);
          });
        });

        this.ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        this.ctx.shadowBlur = 15;
        this.ctx.fillStyle = "#ffffff"; 
        this.ctx.fillText(line, centerX, lineY);
        this.ctx.shadowBlur = 0;
      });
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Smoke:${this.smokeParticles.length} | Shapes:${this.drumShapes.length}`,
      isCovering: true,
      activeFunction: `OrganicHolo[BaseY:${yBase.toFixed(0)}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.smokeParticles = [];
    this.drumShapes = [];
  }
}
