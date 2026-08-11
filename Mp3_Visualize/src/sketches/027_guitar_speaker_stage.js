/**
 * src/sketches/027_guitar_speaker_stage.js
 * - [027호 오디오 반응형 기타 스피커 스테이지 Ver 2.0 - 3D Perspective Stage]
 * - 🎸 3D 원근 기타 6현: 하단부 넓고 두꺼운 현 ➔ 상단 원근점으로 아득히 수렴
 * - 🥁 좌측 상단: 안정적으로 배치된 3D 드럼 세트 (드럼 비트 연동 펌핑)
 * - 🔊 우측 상단: 스네어 드럼 & 대형 스피커 콘 유닛 (베이스/기타 연동 파동 링)
 * - 🎤 상단 원근점: 보컬 음압에 반응하는 수평선 은은한 오라 발광
 * - 16:9 / 9:16 Export 비율 & 오버스캔 레터박스 지원
 */

export default class GuitarSpeakerStageSketch {
  constructor(container) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    if (this.container) {
      this.container.appendChild(this.canvas);
    }

    this.time = 0;
    this.version = "027호 기타 스피커 스테이지 Ver 2.0 (3D Perspective)";
    
    this.stringCount = 6;
    this.strings = [];
    this.particles = [];
    this.soundRings = [];
    this.loadedSeed = -1;
  }

  init() {
    this.resize();
  }

  resize(w, h) {
    this.width = w || (this.container ? this.container.clientWidth : 800) || 800;
    this.height = h || (this.container ? this.container.clientHeight : 600) || 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.initGuitarStrings();
  }

  hexToRgb(hex) {
    if (!hex) return "200, 220, 255";
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  initGuitarStrings() {
    this.strings = [];
    for (let i = 0; i < this.stringCount; i++) {
      this.strings.push({
        amplitude: 0,
        frequency: 6 + i * 2.0,
        decay: 0.91,
        phase: Math.random() * Math.PI * 2,
        baseThickness: 6.5 - i * 0.7 // 아래쪽 기준 두께
      });
    }
  }

  spawnSparks(x, y, color, count = 4) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 5;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 3.5,
        color: color,
        life: 1.0
      });
    }
  }

  spawnSoundRing(x, y, color, maxRadius) {
    this.soundRings.push({
      x: x,
      y: y,
      radius: 12,
      maxRadius: maxRadius,
      color: color,
      alpha: 0.85,
      speed: 3 + Math.random() * 3
    });
  }

  // =========================================================================
  // 🖌️ 좌측 상단 드럼 세트 연출 (Top-Left Drums)
  // =========================================================================
  drawLeftDrumKit(ctx, x, y, size, pulse, color) {
    ctx.save();
    ctx.translate(x, y);

    const scale = (size / 100) * (1.0 + pulse * 0.15);

    // 1. 메인 베이스 드럼 (중앙 하단)
    ctx.fillStyle = "#161b26";
    ctx.strokeStyle = `rgba(${color}, ${0.7 + pulse * 0.3})`;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.ellipse(0, 10 * scale, 32 * scale, 18 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = `rgba(${color}, ${0.2 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(0, 10 * scale, 24 * scale, 13 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. 스네어 드럼 (좌측)
    ctx.fillStyle = "#121622";
    ctx.beginPath();
    ctx.ellipse(-30 * scale, -12 * scale, 20 * scale, 11 * scale, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 3. 탐탐 드럼 (우측 상단)
    ctx.beginPath();
    ctx.ellipse(24 * scale, -18 * scale, 22 * scale, 12 * scale, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  // =========================================================================
  // 🖌️ 우측 상단 스피커 콘 & 드럼 연출 (Top-Right Speaker & Drum)
  // =========================================================================
  drawRightSpeakerKit(ctx, x, y, size, pulse, color) {
    ctx.save();
    ctx.translate(x, y);

    const scale = (size / 100);

    // 1. 뒤쪽 드럼
    ctx.fillStyle = "#121622";
    ctx.strokeStyle = `rgba(${color}, 0.6)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-28 * scale, -10 * scale, 24 * scale, 13 * scale, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 2. 앞쪽 기울어진 대형 스피커 드라이버 유닛
    const speakerScale = scale * (1.0 + pulse * 0.22);
    const spX = 18 * scale;
    const spY = 8 * scale;

    // Outer Rim
    ctx.fillStyle = "#1a202c";
    ctx.strokeStyle = `rgba(${color}, ${0.8 + pulse * 0.2})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(spX, spY, 36 * speakerScale, 36 * speakerScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Surround Ring
    ctx.fillStyle = `rgba(${color}, ${0.15 + pulse * 0.35})`;
    ctx.beginPath();
    ctx.ellipse(spX, spY, 28 * speakerScale, 28 * speakerScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cone Center Cap
    ctx.fillStyle = `rgba(${color}, ${0.6 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(spX, spY, 12 * speakerScale, 12 * speakerScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // =========================================================================
  // 🔄 UPDATE RENDER LOOP
  // =========================================================================
  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const targetAudio = audioData || {};

    const globalSettings = window.cosmicEngineSettings || {};
    const seedVal = globalSettings.seed ?? 42;
    const gainVal = globalSettings.audioGain ?? 1.0;
    const colorStyle = (globalSettings.colorStyle || 'monochrome').toLowerCase();

    // Export 비율 파악
    const exportRatio = (globalSettings.exportRatio || globalSettings.exportSetting || globalSettings.aspectRatio || 'full').toLowerCase();

    // ⚡ 관제탑 연동
    const rawScatter = globalSettings.scatterExponent ?? globalSettings.scatter ?? globalSettings.range ?? 25;
    const scatterSpeed = Math.max(1.0, Math.min(500.0, rawScatter * 10.0));

    const rawGlow = globalSettings.glowScale ?? globalSettings.glow ?? globalSettings.scale ?? 50;
    const scaleFactor = Math.max(0.2, Math.min(3.5, rawGlow / 40.0));

    // 4-Stem 음압
    const vocalsVol = (targetAudio.vocalsVol ?? targetAudio.mid ?? 0) * gainVal;
    const drumsVol  = (targetAudio.drumsVol  ?? targetAudio.bass ?? 0) * gainVal;
    const bassVol   = (targetAudio.bassVol   ?? targetAudio.bass ?? 0) * gainVal;
    const otherVol  = (targetAudio.otherVol  ?? targetAudio.treble ?? 0) * gainVal;

    this.time += 0.016 * (scatterSpeed / 50.0);

    const W = this.canvas.width;
    const H = this.canvas.height;

    // Export 레터박스 뷰포트 영점 계산
    let renderW = W, renderH = H, renderX = 0, renderY = 0;
    if (exportRatio === '16:9') {
      renderW = W;
      renderH = W * (9 / 16);
      if (renderH > H) { renderH = H; renderW = H * (16 / 9); }
      renderX = (W - renderW) / 2; renderY = (H - renderH) / 2;
    } else if (exportRatio === '9:16') {
      renderH = H;
      renderW = H * (9 / 16);
      if (renderW > W) { renderW = W; renderH = W * (16 / 9); }
      renderX = (W - renderW) / 2; renderY = (H - renderH) / 2;
    }

    this.ctx.save();

    // 레터박스 마스크
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, W, H);

    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    // 팔레트 지정 (이미지의 은은한 스튜디오 모노톤 감성 반영)
    let bgColor = "#12141c";
    let isDark = true;

    const customColors = globalSettings.customColors || {};
    const cGas1 = this.hexToRgb(customColors.gas1);
    const cGas2 = this.hexToRgb(customColors.gas2);
    const cStar = this.hexToRgb(customColors.star);

    let mainColor = "210, 225, 255";  // 은빛 백색
    let accentColor = "160, 185, 220";
    let stringColor = "240, 245, 255";

    if (colorStyle === 'neon') {
      bgColor = "#080a14"; isDark = true;
      mainColor = "0, 240, 255"; accentColor = "255, 0, 128"; stringColor = "255, 255, 255";
    } else if (colorStyle === 'pastel') {
      bgColor = "#f4f1ea"; isDark = false;
      mainColor = "70, 130, 200"; accentColor = "200, 90, 140"; stringColor = "40, 50, 70";
    } else if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      bgColor = "#14151c"; isDark = true;
      mainColor = "220, 230, 245"; accentColor = "140, 155, 175"; stringColor = "255, 255, 255";
    }

    // 스튜디오 무대 그라데이션 배경
    const bgGrad = this.ctx.createLinearGradient(renderX, renderY, renderX, renderY + renderH);
    bgGrad.addColorStop(0, isDark ? "#282c3d" : "#e5e2d8");
    bgGrad.addColorStop(0.35, isDark ? "#12141f" : "#f4f1ea");
    bgGrad.addColorStop(1, isDark ? "#08090f" : "#d0ccc0");

    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(renderX, renderY, renderW, renderH);

    const centerX = renderX + renderW / 2;

    // ---------------------------------------------------------------------
    // 1. 🎤 상단 원근점 (Vanishing Point Horizon Glow & Vocal Aura)
    // ---------------------------------------------------------------------
    const vanishY = renderY + renderH * 0.18; // 기타줄이 모여드는 상단 수평선

    if (vocalsVol > 0.02) {
      const vAuraRadius = (renderW * 0.22) * (1.0 + vocalsVol * 0.9);
      const vGrad = this.ctx.createRadialGradient(centerX, vanishY, 5, centerX, vanishY, vAuraRadius);
      vGrad.addColorStop(0, `rgba(${mainColor}, ${0.45 * vocalsVol})`);
      vGrad.addColorStop(1, `rgba(${mainColor}, 0)`);

      this.ctx.fillStyle = vGrad;
      this.ctx.beginPath();
      this.ctx.arc(centerX, vanishY, vAuraRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // ---------------------------------------------------------------------
    // 2. 🥁 & 🔊 기타줄 상단 좌/우 빈 공간 드럼 & 스피커 배치
    // ---------------------------------------------------------------------
    const leftKitX = renderX + renderW * 0.18;
    const rightKitX = renderX + renderW * 0.82;
    const kitY = vanishY + renderH * 0.02;
    const kitSize = 90 * scaleFactor;

    // 좌측 상단 드럼 세트
    this.drawLeftDrumKit(this.ctx, leftKitX, kitY, kitSize, drumsVol * 1.6, mainColor);

    // 우측 상단 스피커 & 드럼
    this.drawRightSpeakerKit(this.ctx, rightKitX, kitY, kitSize, bassVol * 1.6, accentColor);

    // 스피커 soundRings 파동 발생 및 렌더링
    if (bassVol > 0.08 && Math.random() < 0.3) {
      this.spawnSoundRing(rightKitX + kitSize * 0.18, kitY + kitSize * 0.08, accentColor, kitSize * 2.2);
    }
    if (drumsVol > 0.08 && Math.random() < 0.3) {
      this.spawnSoundRing(leftKitX, kitY, mainColor, kitSize * 2.0);
    }

    for (let i = this.soundRings.length - 1; i >= 0; i--) {
      const ring = this.soundRings[i];
      ring.radius += ring.speed;
      ring.alpha -= 0.025;

      if (ring.alpha <= 0 || ring.radius >= ring.maxRadius) {
        this.soundRings.splice(i, 1);
        continue;
      }

      this.ctx.strokeStyle = `rgba(${ring.color}, ${ring.alpha})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // ---------------------------------------------------------------------
    // 3. 🎸 3D 원근 기타 6현 (Perspective Strings: Bottom Wide ➔ Top Narrow)
    // ---------------------------------------------------------------------
    const bottomY = renderY + renderH * 0.98; // 화면 하단 시작점
    const topY = vanishY;                    // 상단 수렴점

    const bottomWidth = renderW * 0.82; // 하단부 아주 넓은 간격
    const topWidth = renderW * 0.08;    // 상단부 아득히 좁은 간격

    // 베이스/드럼 음압에 따른 기타 줄 튕김 트리거
    this.strings.forEach((str, idx) => {
      const triggerVol = (idx % 2 === 0) ? bassVol : drumsVol;
      
      if (triggerVol > 0.05 && Math.random() < 0.45) {
        str.amplitude = (16 + triggerVol * 38) * scaleFactor;
        str.phase = Math.random() * Math.PI * 2;

        // 하단부 중심 Spark 파티클 팝업
        const tRatio = 0.6 + Math.random() * 0.3; // 하단 근처
        const sparkX = centerX - (bottomWidth * 0.5) + (idx / (this.stringCount - 1)) * bottomWidth;
        const sparkY = topY + tRatio * (bottomY - topY);
        this.spawnSparks(sparkX, sparkY, idx % 2 === 0 ? mainColor : accentColor, 3);
      }

      str.amplitude *= str.decay;
      str.phase += 0.22;
    });

    // 3D 원근 기타줄 6개 렌더링
    for (let i = 0; i < this.stringCount; i++) {
      const str = this.strings[i];
      const normIdx = i / (this.stringCount - 1); // 0.0 ~ 1.0

      const startX = centerX - (bottomWidth * 0.5) + normIdx * bottomWidth;
      const endX = centerX - (topWidth * 0.5) + normIdx * topWidth;

      const samples = 90;
      this.ctx.beginPath();

      for (let s = 0; s <= samples; s++) {
        const ratio = s / samples; // 0.0 (하단) ~ 1.0 (상단)
        const currentY = bottomY - ratio * (bottomY - topY);
        const currentBaseX = startX + ratio * (endX - startX);

        // 원근 위치에 따른 진동 감쇄 Envelope 수식 (하단부 진동 극대화)
        const envelope = Math.sin((1.0 - ratio) * Math.PI);
        const vibeX = Math.sin((1.0 - ratio) * str.frequency + str.phase + this.time * 8) * str.amplitude * envelope;

        if (s === 0) this.ctx.moveTo(currentBaseX + vibeX, currentY);
        else this.ctx.lineTo(currentBaseX + vibeX, currentY);
      }

      // 원근에 따른 줄 두께 변화 (하단 두껍고 상단 가냘픔)
      const currentThickness = Math.max(1.2, str.baseThickness * scaleFactor);

      this.ctx.shadowColor = `rgb(${mainColor})`;
      this.ctx.shadowBlur = Math.max(2, str.amplitude * 0.7);

      this.ctx.strokeStyle = `rgba(${stringColor}, ${isDark ? 0.90 : 0.75})`;
      this.ctx.lineWidth = currentThickness;
      this.ctx.stroke();

      this.ctx.shadowBlur = 0;
    }

    // ---------------------------------------------------------------------
    // 4. 💥 Spark 파티클 렌더링 & 업데이트
    // ---------------------------------------------------------------------
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.035;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.fillStyle = `rgba(${p.color}, ${p.life})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `3D Perspective Strings (Sparks:${this.particles.length})`,
      isCovering: true,
      activeFunction: `GuitarPerspectiveStage[4Stem_${colorStyle.toUpperCase()}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.strings = [];
    this.particles = [];
    this.soundRings = [];
  }
}
