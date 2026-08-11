/**
 * src/sketches/027_guitar_speaker_stage.js
 * - [027호 오디오 반응형 기타 스피커 스테이지 Ver 6.0 - Independent Frequency Gear Engine]
 * - 🥁 좌측 드럼 2종: 킥 드럼(Sub-Bass) / 스네어탐(Low-Mid) 1:1 분리 구동
 * - 🥁 우측 드럼: 심벌&하이햇(High-Treble) 독립 구동
 * - 🔊 우측 스피커 2종: 대형 우퍼(Bass Cone) / 트위터(High Tweeter) 독립 구동
 * - 🎸 7현 3D 원근: Sub-Bass ~ Treble 7개 대역 1:1 매핑
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
    this.version = "027호 기타 스피커 스테이지 Ver 6.0 (Gear Split)";
    
    this.stringCount = 7;
    this.strings = [];
    this.particles = [];
    this.soundRings = [];
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
        frequency: 4.5 + i * 1.8,
        decay: 0.80,
        phase: Math.random() * Math.PI * 2,
        baseThickness: 7.5 - i * 0.95
      });
    }
  }

  spawnSparks(x, y, color, count = 3) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 3.0,
        color: color, life: 1.0
      });
    }
  }

  spawnSoundRing(x, y, color, maxRadius) {
    this.soundRings.push({
      x: x, y: y, radius: 10, maxRadius: maxRadius,
      color: color, alpha: 0.85, speed: 3.5 + Math.random() * 3.5
    });
  }

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
  // 🖌️ 좌측 드럼 세트 (킥 드럼[저음] & 스네어탐[중음] 독립 구동)
  // =========================================================================
  drawLeftDrumKit(ctx, x, y, size, kickPulse, snarePulse, color) {
    ctx.save();
    ctx.translate(x, y);

    const scale = size / 100;

    // 1. 후면 스네어 & 탐탐 (snarePulse 반응)
    const tomScale = scale * (1.0 + snarePulse * 0.15);
    ctx.fillStyle = "#121622";
    ctx.strokeStyle = `rgba(${color}, ${0.5 + snarePulse * 0.4})`;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(-18 * tomScale, -28 * tomScale, 18 * tomScale, 10 * tomScale, -0.1, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(18 * tomScale, -32 * tomScale, 19 * tomScale, 11 * tomScale, 0.1, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // 2. 전면 대형 킥 드럼 (kickPulse 저음 반응)
    const kickScale = scale * (1.0 + kickPulse * 0.22);
    ctx.fillStyle = "#181d2a";
    ctx.strokeStyle = `rgba(${color}, ${0.7 + kickPulse * 0.3})`;
    ctx.lineWidth = 2.8;

    ctx.beginPath();
    ctx.ellipse(-10 * kickScale, 5 * kickScale, 28 * kickScale, 24 * kickScale, -0.25, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = `rgba(${color}, ${0.2 + kickPulse * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(-10 * kickScale, 5 * kickScale, 21 * kickScale, 18 * kickScale, -0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // =========================================================================
  // 🖌️ 우측 드럼 & 스피커 (하이햇[고음] & 우퍼[저음]/트위터[초고음] 독립 구동)
  // =========================================================================
  drawRightSpeakerKit(ctx, x, y, size, wooferPulse, tweeterPulse, cymbalPulse, color) {
    ctx.save();
    ctx.translate(x, y);

    const scale = size / 100;

    // 1. 후면 하이햇 & 심벌 드럼 (cymbalPulse 고음 반응)
    const cymScale = scale * (1.0 + cymbalPulse * 0.15);
    ctx.fillStyle = "#121622";
    ctx.strokeStyle = `rgba(${color}, ${0.5 + cymbalPulse * 0.4})`;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(-26 * cymScale, -22 * cymScale, 18 * cymScale, 10 * cymScale, -0.1, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(10 * cymScale, -28 * cymScale, 20 * cymScale, 11 * cymScale, 0.1, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // 2. 전면 우측 스튜디오 모니터 스피커
    const spW = 38 * scale;
    const spH = 54 * scale;
    const spX = 22 * scale;
    const spY = 8 * scale;

    ctx.save();
    ctx.translate(spX, spY);
    ctx.rotate(-0.12);

    // 스피커 인클로저
    ctx.fillStyle = "#1a202c";
    ctx.strokeStyle = `rgba(${color}, ${0.8 + wooferPulse * 0.2})`;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-spW / 2, -spH / 2, spW, spH, 6 * scale);
    ctx.fill(); ctx.stroke();

    // 상단 트위터 (tweeterPulse 초고음 독립 반응)
    const tweeterR = (spW * 0.18) * (1.0 + tweeterPulse * 0.35);
    ctx.fillStyle = `rgba(${color}, ${0.4 + tweeterPulse * 0.6})`;
    ctx.beginPath();
    ctx.arc(0, -spH * 0.22, tweeterR, 0, Math.PI * 2);
    ctx.fill();

    // 하단 우퍼 콘 (wooferPulse 저음 독립 반응)
    const wooferR = (spW * 0.32) * (1.0 + wooferPulse * 0.25);
    ctx.fillStyle = `rgba(${color}, ${0.2 + wooferPulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(0, spH * 0.18, wooferR, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = `rgba(${color}, ${0.7 + wooferPulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(0, spH * 0.18, wooferR * 0.38, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();
  }

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

    // 주파수 스펙트럼 (64 Bins)
    const spectrum = targetAudio.bassSpectrum || targetAudio.spectrum || targetAudio.frequencyData || new Float32Array(64);

    this.time += 0.016 * (scatterSpeed / 50.0);

    const W = this.canvas.width;
    const H = this.canvas.height;

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

    let bgColor = "#12141c";
    let isDark = true;

    const customColors = globalSettings.customColors || {};
    const cGas1 = this.hexToRgb(customColors.gas1);
    const cGas2 = this.hexToRgb(customColors.gas2);

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
    bgGrad.addColorStop(0, isDark ? "#2a2e40" : "#e5e2d8");
    bgGrad.addColorStop(0.35, isDark ? "#12141f" : "#f4f1ea");
    bgGrad.addColorStop(1, isDark ? "#08090f" : "#d0ccc0");

    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(renderX, renderY, renderW, renderH);

    const centerX = renderX + renderW / 2;
    const vanishY = renderY + renderH * 0.18;

    // 1. 🎤 보컬 오라
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
    // 2. 🥁 🔊 드럼 & 스피커 부품별 주파수 세부 분리 구동
    // ---------------------------------------------------------------------
    const leftKitX = renderX + renderW * 0.18;
    const rightKitX = renderX + renderW * 0.82;
    const kitY = vanishY + renderH * 0.02;
    const kitSize = 90 * scaleFactor;

    // 주파수 세부 대역 수치 계산
    const kickEnergy    = this.getBandAverage(spectrum, 0, 3) * 3.0 * gainVal;   // 킥 드럼 (Sub-Bass)
    const snareEnergy   = this.getBandAverage(spectrum, 4, 10) * 2.5 * gainVal;  // 스네어/탐탐 (Low-Mid)
    const wooferEnergy  = Math.max(bassVol * 1.5, this.getBandAverage(spectrum, 1, 6) * 3.0 * gainVal); // 우퍼 (Bass)
    const tweeterEnergy = Math.max(vocalsVol * 1.2, this.getBandAverage(spectrum, 25, 45) * 3.0 * gainVal); // 트위터 (Treble)
    const cymbalEnergy  = Math.max(otherVol * 1.2, this.getBandAverage(spectrum, 30, 55) * 3.0 * gainVal);  // 심벌/하이햇 (Highs)

    // 좌측 드럼 (킥 드럼 & 스네어탐 독립 구동)
    this.drawLeftDrumKit(this.ctx, leftKitX, kitY, kitSize, kickEnergy, snareEnergy, mainColor);

    // 우측 드럼 & 스피커 (우퍼, 트위터, 심벌 독립 구동)
    this.drawRightSpeakerKit(this.ctx, rightKitX, kitY, kitSize, wooferEnergy, tweeterEnergy, cymbalEnergy, accentColor);

    // 파동 링 발생
    if (wooferEnergy > 0.15 && Math.random() < 0.3) {
      this.spawnSoundRing(rightKitX + kitSize * 0.22, kitY + kitSize * 0.08, accentColor, kitSize * 2.2);
    }
    if (kickEnergy > 0.15 && Math.random() < 0.3) {
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
    // 3. 🎸 7현 주파수 슬라이싱 (Bass FFT + Sensitivity 6.0x)
    // ---------------------------------------------------------------------
    const bassSens = 6.0 * gainVal;
    const bands = [
      this.getBandAverage(spectrum, 0, 2) * bassSens,
      this.getBandAverage(spectrum, 3, 5) * bassSens,
      this.getBandAverage(spectrum, 6, 9) * bassSens,
      this.getBandAverage(spectrum, 10, 15) * bassSens,
      this.getBandAverage(spectrum, 16, 24) * bassSens,
      this.getBandAverage(spectrum, 25, 35) * bassSens,
      this.getBandAverage(spectrum, 36, 50) * bassSens
    ];

    const bottomY = renderY + renderH * 0.98;
    const topY = vanishY;

    const bottomWidth = renderW * 0.85;
    const topWidth = renderW * 0.09;

    this.strings.forEach((str, idx) => {
      let bandEnergy = bands[idx] || 0;
      if (bassVol > 0.05 && bandEnergy < bassVol * 0.5) {
        bandEnergy = bassVol * (0.6 + (idx % 3) * 0.2);
      }
      
      if (bandEnergy > 0.02) {
        str.targetAmplitude = (10 + bandEnergy * 40) * scaleFactor;
        
        if (bandEnergy > 0.15 && Math.random() < 0.45) {
          const normIdx = idx / (this.stringCount - 1);
          const sparkX = centerX - (bottomWidth * 0.5) + normIdx * bottomWidth;
          const sparkY = bottomY - 0.2 * (bottomY - topY);
          this.spawnSparks(sparkX, sparkY, idx % 2 === 0 ? mainColor : accentColor, 3);
        }
      } else {
        str.targetAmplitude = 0;
      }

      str.amplitude = str.amplitude * str.decay + str.targetAmplitude * (1.0 - str.decay);
      
      if (str.amplitude < 0.1) {
        str.amplitude = 0;
      } else {
        str.phase += 0.25;
      }
    });

    // 3D 원근 7현 렌더링
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

        let vibeX = 0;
        if (str.amplitude > 0) {
          const envelope = Math.sin((1.0 - ratio) * Math.PI);
          vibeX = Math.sin((1.0 - ratio) * str.frequency + str.phase + this.time * 8) * str.amplitude * envelope;
        }

        if (s === 0) this.ctx.moveTo(currentBaseX + vibeX, currentY);
        else this.ctx.lineTo(currentBaseX + vibeX, currentY);
      }

      const currentThickness = Math.max(1.1, str.baseThickness * scaleFactor);

      if (str.amplitude > 0) {
        this.ctx.shadowColor = `rgb(${mainColor})`;
        this.ctx.shadowBlur = str.amplitude * 0.8;
      }

      this.ctx.strokeStyle = `rgba(${stringColor}, ${str.amplitude > 0 ? 0.95 : 0.70})`;
      this.ctx.lineWidth = currentThickness;
      this.ctx.stroke();

      this.ctx.shadowBlur = 0;
    }

    // 파티클 렌더링
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
      particleCount: `Gear Split Perspective (Sparks:${this.particles.length})`,
      isCovering: true,
      activeFunction: `Guitar7StringStage[GearSplit_${colorStyle.toUpperCase()}]`
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
