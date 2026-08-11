/**
 * src/sketches/027_guitar_speaker_stage.js
 * - [027호 오디오 반응형 기타 스피커 스테이지 Ver 3.0 - True Frequency Band Mapping]
 * - 🎸 5개 베이스 현: 5개 주파수 대역(Sub-Bass ~ Low-Mid) 1:1 정밀 독립 배당
 * - 🎯 정적 상태: 음이 없을 때 무분별한 움직임 없이 완벽한 3D 직선 원근 유지
 * - 🥁 좌측 상단: 드럼(drumsVol) 독립 반응 드럼 세트
 * - 🔊 우측 상단: 베이스/기타(bassVol/otherVol) 독립 반응 대형 스피커
 * - 🎤 상단 원근점: 보컬(vocalsVol) 독립 반응 수평선 오라
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
    this.version = "027호 기타 스피커 스테이지 Ver 3.0 (Frequency Band Mapping)";
    
    this.stringCount = 5; // 5개 주파수 대역 배당
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
    if (!hex) return "210, 225, 255";
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
        targetAmplitude: 0,
        frequency: 5 + i * 2.0,
        decay: 0.82, // 빠른 감쇄로 깔끔한 정지 상태 유도
        phase: Math.random() * Math.PI * 2,
        baseThickness: 6.8 - i * 0.9 // 저음 줄일수록 두꺼운 줄
      });
    }
  }

  spawnSparks(x, y, color, count = 3) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 3.0,
        color: color,
        life: 1.0
      });
    }
  }

  spawnSoundRing(x, y, color, maxRadius) {
    this.soundRings.push({
      x: x,
      y: y,
      radius: 10,
      maxRadius: maxRadius,
      color: color,
      alpha: 0.85,
      speed: 3.5 + Math.random() * 3.5
    });
  }

  // 💡 주파수 대역 평균 구하는 도우미 함수
  getBandAverage(spectrum, startBin, endBin) {
    if (!spectrum || spectrum.length === 0) return 0;
    let sum = 0;
    let count = 0;
    const maxLen = Math.min(spectrum.length, endBin + 1);
    for (let i = startBin; i <= maxLen; i++) {
      sum += (spectrum[i] || 0);
      count++;
    }
    return count > 0 ? (sum / count) : 0;
  }

  // =========================================================================
  // 🖌️ 좌측 상단 드럼 세트 (Drums Only)
  // =========================================================================
  drawLeftDrumKit(ctx, x, y, size, pulse, color) {
    ctx.save();
    ctx.translate(x, y);

    const scale = (size / 100) * (1.0 + pulse * 0.18);

    ctx.fillStyle = "#161b26";
    ctx.strokeStyle = `rgba(${color}, ${0.6 + pulse * 0.4})`;
    ctx.lineWidth = 2.5;

    // 메인 베이스 드럼
    ctx.beginPath();
    ctx.ellipse(0, 10 * scale, 32 * scale, 18 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = `rgba(${color}, ${0.15 + pulse * 0.45})`;
    ctx.beginPath();
    ctx.ellipse(0, 10 * scale, 24 * scale, 13 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // 스네어 드럼
    ctx.fillStyle = "#121622";
    ctx.beginPath();
    ctx.ellipse(-30 * scale, -12 * scale, 20 * scale, 11 * scale, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 탐탐 드럼
    ctx.beginPath();
    ctx.ellipse(24 * scale, -18 * scale, 22 * scale, 12 * scale, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  // =========================================================================
  // 🖌️ 우측 상단 스피커 콘 (Bass & Speaker Only)
  // =========================================================================
  drawRightSpeakerKit(ctx, x, y, size, pulse, color) {
    ctx.save();
    ctx.translate(x, y);

    const scale = (size / 100);

    ctx.fillStyle = "#121622";
    ctx.strokeStyle = `rgba(${color}, 0.6)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-28 * scale, -10 * scale, 24 * scale, 13 * scale, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const speakerScale = scale * (1.0 + pulse * 0.25);
    const spX = 18 * scale;
    const spY = 8 * scale;

    ctx.fillStyle = "#1a202c";
    ctx.strokeStyle = `rgba(${color}, ${0.7 + pulse * 0.3})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(spX, spY, 36 * speakerScale, 36 * speakerScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = `rgba(${color}, ${0.15 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(spX, spY, 28 * speakerScale, 28 * speakerScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = `rgba(${color}, ${0.5 + pulse * 0.5})`;
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

    const exportRatio = (globalSettings.exportRatio || globalSettings.exportSetting || globalSettings.aspectRatio || 'full').toLowerCase();

    const rawScatter = globalSettings.scatterExponent ?? globalSettings.scatter ?? globalSettings.range ?? 25;
    const scatterSpeed = Math.max(1.0, Math.min(500.0, rawScatter * 10.0));

    const rawGlow = globalSettings.glowScale ?? globalSettings.glow ?? globalSettings.scale ?? 50;
    const scaleFactor = Math.max(0.2, Math.min(3.5, rawGlow / 40.0));

    // 4-Stem 음압
    const vocalsVol = (targetAudio.vocalsVol ?? targetAudio.mid ?? 0) * gainVal;
    const drumsVol  = (targetAudio.drumsVol  ?? targetAudio.bass ?? 0) * gainVal;
    const bassVol   = (targetAudio.bassVol   ?? targetAudio.bass ?? 0) * gainVal;
    const otherVol  = (targetAudio.otherVol  ?? targetAudio.treble ?? 0) * gainVal;

    // 💡 [핵심]: 주파수 스펙트럼 데이터 수신 (64 채널)
    const spectrum = targetAudio.spectrum || targetAudio.frequencyData || new Float32Array(64);

    this.time += 0.016 * (scatterSpeed / 50.0);

    const W = this.canvas.width;
    const H = this.canvas.height;

    // Export 뷰포트 영역 계산
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

    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, W, H);

    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    // 팔레트 지정
    let bgColor = "#12141c";
    let isDark = true;

    const customColors = globalSettings.customColors || {};
    const cGas1 = this.hexToRgb(customColors.gas1);
    const cGas2 = this.hexToRgb(customColors.gas2);
    const cStar = this.hexToRgb(customColors.star);

    let mainColor = "210, 225, 255";
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

    const bgGrad = this.ctx.createLinearGradient(renderX, renderY, renderX, renderY + renderH);
    bgGrad.addColorStop(0, isDark ? "#282c3d" : "#e5e2d8");
    bgGrad.addColorStop(0.35, isDark ? "#12141f" : "#f4f1ea");
    bgGrad.addColorStop(1, isDark ? "#08090f" : "#d0ccc0");

    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(renderX, renderY, renderW, renderH);

    const centerX = renderX + renderW / 2;
    const vanishY = renderY + renderH * 0.18;

    // ---------------------------------------------------------------------
    // 1. 🎤 보컬 전용: 상단 원근점 오라 (Vocals Only)
    // ---------------------------------------------------------------------
    if (vocalsVol > 0.03) {
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
    // 2. 🥁 드럼 & 🔊 스피커 전용 반응 (Drums & Bass/Other Only)
    // ---------------------------------------------------------------------
    const leftKitX = renderX + renderW * 0.18;
    const rightKitX = renderX + renderW * 0.82;
    const kitY = vanishY + renderH * 0.02;
    const kitSize = 90 * scaleFactor;

    // 좌측 드럼: drumsVol 전용
    this.drawLeftDrumKit(this.ctx, leftKitX, kitY, kitSize, drumsVol * 1.6, mainColor);

    // 우측 스피커: bassVol / otherVol 전용
    const speakerPulse = Math.max(bassVol, otherVol) * 1.6;
    this.drawRightSpeakerKit(this.ctx, rightKitX, kitY, kitSize, speakerPulse, accentColor);

    if (speakerPulse > 0.12 && Math.random() < 0.25) {
      this.spawnSoundRing(rightKitX + kitSize * 0.18, kitY + kitSize * 0.08, accentColor, kitSize * 2.2);
    }
    if (drumsVol > 0.12 && Math.random() < 0.25) {
      this.spawnSoundRing(leftKitX, kitY, mainColor, kitSize * 2.0);
    }

    for (let i = this.soundRings.length - 1; i >= 0; i--) {
      const ring = this.soundRings[i];
      ring.radius += ring.speed;
      ring.alpha -= 0.028;

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
    // 3. 🎸 베이스 5현 주파수 슬라이싱 1:1 매핑 (Bass 5 Bands Slicing)
    // ---------------------------------------------------------------------
    // 주파수 5개 대역 샘플링
    const bands = [
      this.getBandAverage(spectrum, 0, 3) * 2.5 * gainVal,   // 1번 줄: Sub-Bass
      this.getBandAverage(spectrum, 4, 7) * 2.5 * gainVal,   // 2번 줄: Low-Bass
      this.getBandAverage(spectrum, 8, 12) * 2.5 * gainVal,  // 3번 줄: Mid-Bass
      this.getBandAverage(spectrum, 13, 18) * 2.5 * gainVal, // 4번 줄: Upper-Bass
      this.getBandAverage(spectrum, 19, 26) * 2.5 * gainVal  // 5번 줄: Low-Mid
    ];

    const bottomY = renderY + renderH * 0.98;
    const topY = vanishY;

    const bottomWidth = renderW * 0.82;
    const topWidth = renderW * 0.08;

    this.strings.forEach((str, idx) => {
      const bandEnergy = bands[idx] || 0;
      
      // 음이 감지될 때만 진동 진폭 설정 (임계값 0.04)
      if (bandEnergy > 0.04) {
        str.targetAmplitude = (12 + bandEnergy * 35) * scaleFactor;
        
        // 피크 시 Spark 파티클 팝업
        if (bandEnergy > 0.18 && Math.random() < 0.4) {
          const normIdx = idx / (this.stringCount - 1);
          const sparkX = centerX - (bottomWidth * 0.5) + normIdx * bottomWidth;
          const sparkY = bottomY - 0.2 * (bottomY - topY);
          this.spawnSparks(sparkX, sparkY, idx % 2 === 0 ? mainColor : accentColor, 3);
        }
      } else {
        str.targetAmplitude = 0;
      }

      // 목표 진폭 보평 및 감쇄
      str.amplitude = str.amplitude * str.decay + str.targetAmplitude * (1.0 - str.decay);
      
      // 미세 잔여 진동 차단 ➔ 완전히 곧은 직선 가공
      if (str.amplitude < 0.2) {
        str.amplitude = 0;
      } else {
        str.phase += 0.25;
      }
    });

    // 3D 원근 5현 렌더링
    for (let i = 0; i < this.stringCount; i++) {
      const str = this.strings[i];
      const normIdx = i / (this.stringCount - 1);

      const startX = centerX - (bottomWidth * 0.5) + normIdx * bottomWidth;
      const endX = centerX - (topWidth * 0.5) + normIdx * topWidth;

      const samples = 90;
      this.ctx.beginPath();

      for (let s = 0; s <= samples; s++) {
        const ratio = s / samples;
        const currentY = bottomY - ratio * (bottomY - topY);
        const currentBaseX = startX + ratio * (endX - startX);

        // str.amplitude가 0일 때는 vibeX가 정확히 0 ➔ 완전한 3D 직선 생성!
        let vibeX = 0;
        if (str.amplitude > 0) {
          const envelope = Math.sin((1.0 - ratio) * Math.PI);
          vibeX = Math.sin((1.0 - ratio) * str.frequency + str.phase + this.time * 8) * str.amplitude * envelope;
        }

        if (s === 0) this.ctx.moveTo(currentBaseX + vibeX, currentY);
        else this.ctx.lineTo(currentBaseX + vibeX, currentY);
      }

      const currentThickness = Math.max(1.2, str.baseThickness * scaleFactor);

      if (str.amplitude > 0) {
        this.ctx.shadowColor = `rgb(${mainColor})`;
        this.ctx.shadowBlur = str.amplitude * 0.8;
      }

      this.ctx.strokeStyle = `rgba(${stringColor}, ${str.amplitude > 0 ? 0.95 : 0.70})`;
      this.ctx.lineWidth = currentThickness;
      this.ctx.stroke();

      this.ctx.shadowBlur = 0;
    }

    // ---------------------------------------------------------------------
    // 4. 💥 Spark 파티클 렌더링
    // ---------------------------------------------------------------------
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.038;

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
      particleCount: `5-Band Bass Strings (Sparks:${this.particles.length})`,
      isCovering: true,
      activeFunction: `GuitarFrequencyStage[5Bands_${colorStyle.toUpperCase()}]`
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
