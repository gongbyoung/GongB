/**
 * src/sketches/030_acoustic_assets.js
 * - [030호 홀로그램 스테이지 엔진 Ver 4.2 - 감도 최적화]
 * - 음악이 없을 때도 기본 연기와 도형이 은은하게 피어오릅니다 (Ambient Mode).
 * - 음악이 터질 때 폭발적으로 반응합니다.
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
    this.version = "030호 홀로그램 스테이지 Ver 4.2";
    
    this.smokeParticles = [];
    this.drumShapes = [];
    
    // 연기 효과를 위한 사전 렌더링 텍스처 (성능 최적화)
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

  // ☁️ 연기 파티클 텍스처 미리 만들기 (64x64)
  createSmokeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return canvas;
  }

  // 🥁 드럼 도형 스폰 (isAmbient가 true면 잔잔하게, false면 강하게 폭발)
  spawnDrumShape(x, y, intensity, renderW, isAmbient = false) {
    const types = ['triangle', 'ring', 'circle'];
    const colors = ['#ff2a6d', '#05d9e8', '#ff7a00', '#d1f7ff', '#b537f2'];
    
    const count = isAmbient ? 1 : Math.floor(intensity * 4) + 1; 
    
    for (let i = 0; i < count; i++) {
      this.drumShapes.push({
        type: types[Math.floor(Math.random() * types.length)],
        x: x + (Math.random() * renderW * 0.6 - renderW * 0.3),
        y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: isAmbient ? -(Math.random() * 3 + 2) : -(Math.random() * 10 + 5) * intensity,
        size: Math.random() * 15 + 10,
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
    
    // 🎛️ 오디오 감도 증폭 (게이지 값에 비례하여 작은 소리에도 반응하게 만듦)
    const targetAudio = (audioData && audioData.vol !== undefined) ? audioData : (window.latestCompiledAudioData || {});
    const gaugeVal = settings.gaugeValue ?? 0.5; 
    
    const vocals = (targetAudio.vocalsVol !== undefined ? targetAudio.vocalsVol : (targetAudio.mid || 0)) * gaugeVal * 2.5;
    const drums  = (targetAudio.drumsVol  !== undefined ? targetAudio.drumsVol  : (targetAudio.bass || 0)) * gaugeVal * 2.5;
    const strings= (targetAudio.otherVol  !== undefined ? targetAudio.otherVol  : (targetAudio.treble || 0)) * gaugeVal * 2.5;
    const vol = targetAudio.vol || 0;

    const gainVal = settings.audioGain ?? 1.0;

    this.time += 0.01 + (strings * 0.02 * gainVal);

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
    this.ctx.fillStyle = "#020205"; // 깊은 스테이지 암전
    this.ctx.fillRect(0, 0, W, H);
    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    const centerX = renderX + renderW / 2;
    const bottomY = renderY + renderH * 0.85;

    // ==========================================
    // 1. 🎻 STRING 파트 : 빛의 물결 (항상 렌더링)
    // ==========================================
    const lineColors = ['#00ffcc', '#ff0055', '#4d4dff', '#ffaa00'];
    this.ctx.globalCompositeOperation = 'screen';
    
    for (let i = 0; i < 6; i++) {
      this.ctx.beginPath();
      this.ctx.lineWidth = 1.5 + (strings * 3);
      this.ctx.strokeStyle = lineColors[i % lineColors.length];
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = this.ctx.strokeStyle;
      // 기본 투명도를 줘서 음악이 없을 때도 우아하게 보이도록 함
      this.ctx.globalAlpha = 0.3 + (strings * 0.7);

      const yBase = renderY + (renderH * 0.2) + (i * renderH * 0.1);
      
      this.ctx.moveTo(renderX, yBase);
      for (let x = renderX; x <= renderX + renderW; x += 20) {
        const freq = 0.01 + (i * 0.005);
        // 기본 파동 진폭(15) 보장
        const amp = 15 + (strings * 120) + Math.sin(this.time * 2 + i) * 15;
        const waveY = Math.sin(x * freq + this.time * (3 + i*0.5)) * amp;
        this.ctx.lineTo(x, yBase + waveY);
      }
      this.ctx.stroke();
    }
    this.ctx.shadowBlur = 0;

    // ==========================================
    // 2. 🎤 VOCAL 파트 : 신비로운 연기 (Smoke)
    // ==========================================
    // 보컬 소리가 클 때 폭발적으로, 없을 때는 10% 확률로 잔잔하게 스폰
    if (vocals > 0.1 || Math.random() < 0.1) {
      const isAmbient = vocals <= 0.1;
      this.smokeParticles.push({
        x: centerX + (Math.random() * renderW * 0.6 - renderW * 0.3),
        y: bottomY - 20,
        vx: (Math.random() - 0.5) * 1.5,
        vy: isAmbient ? -1 - Math.random() : -2 - (Math.random() * 4) * vocals,
        size: Math.random() * 40 + 40,
        growth: 0.3 + Math.random() * 0.5,
        life: 1.0,
        decay: 0.005 + Math.random() * 0.008,
        hue: 250 + Math.random() * 90 // 신비로운 파랑/보라/핑크 톤
      });
    }

    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      let p = this.smokeParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.size += p.growth;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.smokeParticles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.globalAlpha = p.life * 0.5 * (0.3 + vocals * 0.7);
      this.ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.life})`;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.globalCompositeOperation = 'screen';
      this.ctx.drawImage(this.smokeTexture, -p.size, -p.size, p.size * 2, p.size * 2);
      this.ctx.restore();
    }

    // ==========================================
    // 3. 🥁 DRUM 파트 : 기하학 도형 (Shapes)
    // ==========================================
    this.ctx.globalCompositeOperation = 'source-over';
    
    // 무대 바닥의 은은한 네온 조명판 (항상 켜져 있음)
    this.ctx.globalCompositeOperation = 'screen';
    const floorGrad = this.ctx.createRadialGradient(centerX, bottomY, 0, centerX, bottomY, renderW * 0.5);
    floorGrad.addColorStop(0, `rgba(50, 100, 255, ${0.1 + drums * 0.3})`);
    floorGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = floorGrad;
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, bottomY, renderW * 0.5, 60, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalCompositeOperation = 'source-over';

    // 피크 감지: 드럼 소리가 확 튈 때 강하게 스폰, 아니면 잔잔하게 스폰
    if (drums > 0.2 && drums > this.lastDrums + 0.02) {
      this.spawnDrumShape(centerX, bottomY, drums * gainVal, renderW, false);
    } else if (Math.random() < 0.05) {
      this.spawnDrumShape(centerX, bottomY, 0.2, renderW, true);
    }
    this.lastDrums = drums;

    for (let i = this.drumShapes.length - 1; i >= 0; i--) {
      let s = this.drumShapes[i];
      
      s.vy += 0.4; // 중력
      s.x += s.vx;
      s.y += s.vy;
      s.angle += s.rotSpeed;
      s.life -= s.decay;

      // 바닥 바운스
      if (s.y > bottomY) {
        s.y = bottomY;
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
      
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = s.color;

      if (s.type === 'triangle') {
        this.ctx.strokeStyle = s.color;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -s.size);
        this.ctx.lineTo(s.size * 0.866, s.size * 0.5);
        this.ctx.lineTo(-s.size * 0.866, s.size * 0.5);
        this.ctx.closePath();
        this.ctx.stroke();
      } else if (s.type === 'ring') {
        this.ctx.strokeStyle = s.color;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, s.size, 0, Math.PI * 2);
        this.ctx.stroke();
      } else {
        this.ctx.fillStyle = s.color;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, s.size * 0.6, 0, Math.PI * 2);
        this.ctx.fill();
      }
      
      this.ctx.restore();
    }

    // ==========================================
    // 4. ✍️ 자막 
    // ==========================================
    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "";
    
    if (subtitleText && settings.showSubtitle !== false) {
      this.ctx.globalAlpha = 1.0;
      this.ctx.globalCompositeOperation = 'source-over';
      const baseFontSize = Math.max(28, Math.min(52, renderW * 0.065));
      const fontSize = baseFontSize * (1.0 + (vol * 0.05)); 
      
      const rawFont = settings.fontFamily || "Noto Sans KR";
      const cleanFontName = rawFont.replace(/['"]/g, ''); 
      
      this.ctx.font = `bold ${fontSize}px "${cleanFontName}", sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const lines = subtitleText.split('\n');
      const lineHeight = fontSize * 1.35;

      lines.forEach((line, idx) => {
        const lineY = centerY + (idx - (lines.length - 1) / 2) * lineHeight;

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
      activeFunction: `HologramStage[Sub:${settings.showSubtitle !== false ? 'ON' : 'OFF'}]`
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
