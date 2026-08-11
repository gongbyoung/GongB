/**
 * src/sketches/027_guitar_speaker_stage.js
 * - [027호 오디오 반응형 기타 스피커 스테이지 Ver 7.0 - Full Band Live Stage]
 * - 🥁 좌측: 5종 풀 세트 드럼 (킥, 스네어, 하이탐, 플로어탐, 심벌 1:1 분리)
 * - 🎹 우측 상단: 14키 피아노 건반 (otherVol / 피아노 주파수 연동 눌림 & 발광)
 * - 🔊 우측: 2개의 듀얼 스튜디오 모니터 스피커 (우퍼 / 트위터 독립 펌핑)
 * - 🎸 중앙: 3D 원근 7현 (7개 주파수 대역 1:1 매핑 & 정적 시 완전 직선)
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
    this.version = "027호 기타 스피커 스테이지 Ver 7.0 (Full Band Live)";
    
    this.stringCount = 7;
    this.strings = [];
    this.particles = [];
    this.soundRings = [];
    this.pianoKeyCount = 14;
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
  // 🥁 5종 풀 세트 드럼 렌더링 (Kick, Snare, Hi-Tom, Floor-Tom, Cymbal)
  // =========================================================================
  draw5PieceDrumKit(ctx, x, y, size, kickP, snareP, tomP, cymbalP, color) {
    ctx.save();
    ctx.translate(x, y);

    const scale = size / 100;

    // 1. 심벌 스탠드 & 크래쉬 심벌 (상단 - cymbalP 반응)
    const cymScale = scale * (1.0 + cymbalP * 0.2);
    ctx.strokeStyle = `rgba(${color}, ${0.4 + cymbalP * 0.6})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -10 * scale);
    ctx.lineTo(0, -45 * scale);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 215, 0, ${0.4 + cymbalP * 0.6})`;
    ctx.beginPath();
    ctx.ellipse(0, -45 * scale, 22 * cymScale, 6 * cymScale, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // 2. 하이 탐 & 미드 탐 (상단 드럼 2개 - tomP 반응)
    const tomScale = scale * (1.0 + tomP * 0.15);
    ctx.fillStyle = "#121622";
    ctx.strokeStyle = `rgba(${color}, ${0.5 + tomP * 0.4})`;
    ctx.lineWidth = 2;

    // 하이 탐 (좌)
    ctx.beginPath();
    ctx.ellipse(-18 * tomScale, -22 * tomScale, 16 * tomScale, 9 * tomScale, -0.1, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // 플로어 탐 (우)
    ctx.beginPath();
    ctx.ellipse(20 * tomScale, -24 * tomScale, 18 * tomScale, 10 * tomScale, 0.1, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // 3. 스네어 드럼 (좌측 하단 - snareP 반응)
    const snareScale = scale * (1.0 + snareP * 0.18);
    ctx.beginPath();
    ctx.ellipse(-28 * snareScale, -2 * snareScale, 19 * snareScale, 10 * snareScale, -0.2, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // 4. 메인 킥 드럼 (중앙 하단 - kickP 반응)
    const kickScale = scale * (1.0 + kickP * 0.22);
    ctx.fillStyle = "#181d2a";
    ctx.strokeStyle = `rgba(${color}, ${0.7 + kickP * 0.3})`;
    ctx.lineWidth = 2.8;

    ctx.beginPath();
    ctx.ellipse(-2 * kickScale, 12 * kickScale, 26 * kickScale, 22 * kickScale, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = `rgba(${color}, ${0.2 + kickP * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(-2 * kickScale, 12 * kickScale, 19 * kickScale, 16 * kickScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // =========================================================================
  // 🎹 피아노 건반 렌더링 (14 Keys - pianoPulse & 주파수 연동)
  // =========================================================================
  drawPianoKeys(ctx, x, y, width, height, pianoPulse, spectrum, color) {
    ctx.save();
    ctx.translate(x, y);

    const keyW = width / this.pianoKeyCount;

    // 건반 상단 베젤
    ctx.fillStyle = "#121520";
    ctx.strokeStyle = `rgba(${color}, 0.6)`;
    ctx.lineWidth = 2;
    ctx.fillRect(-2, -4, width + 4, 6);

    // 14개 흰색 건반
    for (let i = 0; i < this.pianoKeyCount; i++) {
      const keyX = i * keyW;
      const keyFreq = this.getBandAverage(spectrum, 10 + i * 2, 12 + i * 2) * 3.0;
      const isPressed = keyFreq > 0.08 || (pianoPulse > 0.15 && i % 3 === 0);

      const pressOffset = isPressed ? 3 : 0;

      ctx.fillStyle = isPressed ? `rgba(${color}, 0.9)` : "#e2e8f0";
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;

      ctx.fillRect(keyX, pressOffset, keyW - 1, height - pressOffset);
      ctx.strokeRect(keyX, pressOffset, keyW - 1, height - pressOffset);

      if (isPressed && Math.random() < 0.2) {
        this.spawnSparks(x + keyX + keyW / 2, y + height, color, 2);
      }
    }

    // 흑건 (Black Keys)
    const blackKeyIndices = [1, 2, 4, 5, 6, 8, 9, 11, 12];
    ctx.fillStyle = "#0f172a";
    blackKeyIndices.forEach(idx => {
      if (idx < this.pianoKeyCount - 1) {
        const bkX = idx * keyW + keyW * 0.65;
        ctx.fillRect(bkX, 0, keyW * 0.7, height * 0.6);
      }
    });

    ctx.restore();
  }

  // =========================================================================
  // 🔊 듀얼 모니터 스피커 캐비닛 렌더링 (Left & Right Speakers)
  // =========================================================================
  drawDualSpeakers(ctx, x, y, size, wooferP, tweeterP, color) {
    ctx.save();
    ctx.translate(x, y);

    const scale = size / 100;
    const spW = 32 * scale;
    const spH = 48 * scale;

    // 1. 좌측 스피커 캐비닛 (우퍼 전용)
    ctx.save();
    ctx.translate(-spW * 0.65, 0);
    ctx.fillStyle = "#1a202c";
    ctx.strokeStyle = `rgba(${color}, ${0.7 + wooferP * 0.3})`;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.roundRect(-spW / 2, -spH / 2, spW, spH, 5 * scale);
    ctx.fill(); ctx.stroke();

    const wR1 = (spW * 0.32) * (1.0 + wooferP * 0.25);
    ctx.fillStyle = `rgba(${color}, ${0.2 + wooferP * 0.4})`;
    ctx.beginPath();
    ctx.arc(0, spH * 0.15, wR1, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.restore();

    // 2. 우측 스피커 캐비닛 (트위터 전용)
    ctx.save();
    ctx.translate(spW * 0.65, 5 * scale);
    ctx.fillStyle = "#161b26";
    ctx.strokeStyle = `rgba(${color}, ${0.7 + tweeterP * 0.3})`;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.roundRect(-spW / 2, -spH / 2, spW, spH, 5 * scale);
    ctx.fill(); ctx.stroke();

    const tR2 = (spW * 0.18) * (1.0 + tweeterP * 0.35);
    ctx.fillStyle = `rgba(${color}, ${0.5 + tweeterP * 0.5})`;
    ctx.beginPath();
    ctx.arc(0, -spH * 0.2, tR2, 0, Math.PI * 2);
    ctx.fill();

    const wR2 = spW * 0.30;
    ctx.fillStyle = `rgba(${color}, 0.2)`;
    ctx.beginPath();
    ctx.arc(0, spH * 0.15, wR2, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.restore();
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

    // 스펙트럼 64 Bins
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
    // 2. 🥁 🎹 🔊 무대 악기 구동 (5종 드럼 + 피아노 건반 + 듀얼 스피커)
    // ---------------------------------------------------------------------
    const leftKitX = renderX + renderW * 0.18;
    const rightKitX = renderX + renderW * 0.82;
    const kitY = vanishY + renderH * 0.02;
    const kitSize = 90 * scaleFactor;

    // 주파수 세부 대역 수치 계산
    const kickEnergy    = this.getBandAverage(spectrum, 0, 3) * 3.0 * gainVal;   // 킥 드럼
    const snareEnergy   = this.getBandAverage(spectrum, 4, 10) * 2.5 * gainVal;  // 스네어
    const tomEnergy     = this.getBandAverage(spectrum, 8, 18) * 2.5 * gainVal;  // 탐탐
    const cymbalEnergy  = Math.max(otherVol * 1.2, this.getBandAverage(spectrum, 30, 55) * 3.0 * gainVal); // 심벌

    const wooferEnergy  = Math.max(bassVol * 1.5, this.getBandAverage(spectrum, 1, 6) * 3.0 * gainVal);   // 스피커 우퍼
    const tweeterEnergy = Math.max(vocalsVol * 1.2, this.getBandAverage(spectrum, 25, 45) * 3.0 * gainVal); // 스피커 트위터

    // ① 좌측 5종 풀 세트 드럼
    this.draw5PieceDrumKit(this.ctx, leftKitX, kitY, kitSize, kickEnergy, snareEnergy, tomEnergy, cymbalEnergy, mainColor);

    // ② 우측 상단 피아노 건반 (Piano Keyboard)
    const pianoW = renderW * 0.22 * scaleFactor;
    const pianoH = 22 * scaleFactor;
    this.drawPianoKeys(this.ctx, rightKitX - pianoW / 2, kitY - kitSize * 0.35, pianoW, pianoH, otherVol * 1.8, spectrum, accentColor);

    // ③ 우측 듀얼 스피커 캐비닛
    this.drawDualSpeakers(this.ctx, rightKitX, kitY + kitSize * 0.15, kitSize, wooferEnergy, tweeterEnergy, accentColor);

    // 파동 링 발생
    if (wooferEnergy > 0.15 && Math.random() < 0.3) {
      this.spawnSoundRing(rightKitX - kitSize * 0.15, kitY + kitSize * 0.2, accentColor, kitSize * 2.2);
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
      particleCount: `Full Live Stage (Drums:5 / Piano:14Keys / Speakers:Dual)`,
      isCovering: true,
      activeFunction: `Guitar7StringStage[FullLiveStage_${colorStyle.toUpperCase()}]`
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
