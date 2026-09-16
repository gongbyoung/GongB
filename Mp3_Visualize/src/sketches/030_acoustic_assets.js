/**
 * src/sketches/030_acoustic_assets.js
 * - [030호 홀로그램 스테이지 엔진 Ver 4.0]
 * - 🎻 현/기타 (Treble/Other): 빛의 물결 (곡선)
 * - 🎤 목소리 (Mid/Vocals): 신비로운 연기 (Smoke)
 * - 🥁 드럼/베이스 (Bass/Drums): 바닥에서 튀어오르는 기하학 도형 (Shapes)
 * - 각각의 소리에만 독립적으로 완벽하게 반응합니다.
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
    this.version = "030호 홀로그램 스테이지 Ver 4.0";
    
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

  // 🥁 드럼 도형 스폰 (삼각형, 빈 원형 등)
  spawnDrumShape(x, y, intensity) {
    const types = ['triangle', 'ring'];
    const colors = ['#ff2a6d', '#05d9e8', '#ff7a00', '#d1f7ff'];
    
    const count = Math.floor(intensity * 3) + 1; // 세게 칠수록 많이 나옴
    
    for (let i = 0; i < count; i++) {
      this.drumShapes.push({
        type: types[Math.floor(Math.random() * types.length)],
        x: x + (Math.random() * 200 - 100),
        y: y,
        vx: (Math.random() - 0.5) * 6,
        vy: -(Math.random() * 8 + 4) * intensity, // 위로 튀어오름
        size: Math.random() * 20 + 15,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.0,
        decay: 0.02 + Math.random() * 0.02,
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
    
    // 🎛️ 멀티 스템(4-Stem) 데이터가 있으면 우선 사용, 없으면 주파수(Bass/Mid/Treble)로 대체
    const targetAudio = (audioData && audioData.vocalsVol !== undefined) ? audioData : (window.latestCompiledAudioData || {});
    const vocals = targetAudio.vocalsVol !== undefined ? targetAudio.vocalsVol : (targetAudio.mid || 0);
    const drums  = targetAudio.drumsVol  !== undefined ? targetAudio.drumsVol  : (targetAudio.bass || 0);
    const strings= targetAudio.otherVol  !== undefined ? targetAudio.otherVol  : (targetAudio.treble || 0);
    const vol = targetAudio.vol || 0;

    const gainVal = settings.audioGain ?? 1.0;
    const gaugeVal = settings.gaugeValue ?? 0.5; 

    this.time += 0.01 + (strings * 0.02 * gainVal);

    // 📐 16:9 / 9:16 레터박스 엔진
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
    const bottomY = renderY + renderH * 0.85; // 무대 바닥 위치

    // ==========================================
    // 1. 🎻 STRING 파트 : 빛의 물결 (곡선)
    // ==========================================
    const lineColors = ['#00ffcc', '#ff0055', '#4d4dff', '#ffaa00'];
    this.ctx.globalCompositeOperation = 'screen';
    
    for (let i = 0; i < 6; i++) {
      this.ctx.beginPath();
      this.ctx.lineWidth = 2 + (strings * 3);
      this.ctx.strokeStyle = lineColors[i % lineColors.length];
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = this.ctx.strokeStyle;
      this.ctx.globalAlpha = 0.4 + (strings * 0.6);

      const yBase = renderY + (renderH * 0.2) + (i * renderH * 0.1);
      
      this.ctx.moveTo(renderX, yBase);
      for (let x = renderX; x <= renderX + renderW; x += 20) {
        // 스트링(현/기타) 소리가 커질수록 파장이 요동침
        const freq = 0.01 + (i * 0.005);
        const amp = 20 + (strings * 150 * gaugeVal) + Math.sin(this.time + i) * 20;
        const waveY = Math.sin(x * freq + this.time * (2 + i*0.5)) * amp;
        this.ctx.lineTo(x, yBase + waveY);
      }
      this.ctx.stroke();
    }
    this.ctx.shadowBlur = 0;

    // ==========================================
    // 2. 🎤 VOCAL 파트 : 신비로운 연기 (Smoke)
    // ==========================================
    // 보컬 소리가 있을 때 연기 스폰
    if (vocals > 0.1 && Math.random() < vocals * 0.8) {
      this.smokeParticles.push({
        x: centerX + (Math.random() * renderW * 0.4 - renderW * 0.2),
        y: bottomY - 50,
        vx: (Math.random() - 0.5) * 2.0,
        vy: -2 - (Math.random() * 3) * vocals, // 위로 솟아오름
        size: Math.random() * 40 + 40,
        growth: 0.5 + Math.random(), // 점점 퍼짐
        life: 1.0,
        decay: 0.005 + Math.random() * 0.01,
        // 보라/핑크/오렌지 톤의 보컬 연기 색상
        hue: 280 + Math.random() * 60
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
      this.ctx.globalAlpha = p.life * 0.4 * (0.5 + vocals * 0.5); // 보컬이 셀수록 연기가 진해짐
      // 연기 색상 틴팅
      this.ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.life})`;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      this.ctx.fill();

      // 연기 텍스처 오버레이
      this.ctx.globalCompositeOperation = 'screen';
      this.ctx.drawImage(this.smokeTexture, -p.size, -p.size, p.size * 2, p.size * 2);
      this.ctx.restore();
    }

    // ==========================================
    // 3. 🥁 DRUM 파트 : 기하학 도형 (Shapes)
    // ==========================================
    this.ctx.globalCompositeOperation = 'source-over';
    
    // 피크 감지: 드럼 소리가 확 튈 때 도형 스폰
    if (drums > 0.35 && drums > this.lastDrums + 0.05) {
      this.spawnDrumShape(centerX, bottomY, drums * gainVal);
    }
    this.lastDrums = drums;

    // 무대 바닥 라인 (도형들이 튕기는 곳)
    this.ctx.fillStyle = `rgba(255, 255, 255, ${0.05 + drums * 0.1})`;
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, bottomY, renderW * 0.4, 40, 0, 0, Math.PI * 2);
    this.ctx.fill();

    for (let i = this.drumShapes.length - 1; i >= 0; i--) {
      let s = this.drumShapes[i];
      
      // 중력 적용
      s.vy += 0.4; 
      s.x += s.vx;
      s.y += s.vy;
      s.angle += s.rotSpeed;
      s.life -= s.decay;

      // 바닥에 닿으면 튕김 (Bouncing)
      if (s.y > bottomY) {
        s.y = bottomY;
        s.vy *= -0.6; // 탄성
        s.vx *= 0.8;  // 마찰
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
      }
      
      this.ctx.restore();
    }

    // ==========================================
    // 4. ✍️ 자막 (자막 끄기 토글 상태 확인!)
    // ==========================================
    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "";
    
    if (subtitleText && settings.showSubtitle !== false) {
      this.ctx.globalAlpha = 1.0;
      this.ctx.globalCompositeOperation = 'source-over';
      const baseFontSize = Math.max(28, Math.min(52, renderW * 0.065));
      const fontSize = baseFontSize * (1.0 + (vocals * 0.05 * gaugeVal)); // 보컬에 자막이 살짝 반응
      
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
