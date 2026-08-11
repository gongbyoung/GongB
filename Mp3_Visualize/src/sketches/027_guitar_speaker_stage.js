/**
 * src/sketches/027_guitar_speaker_stage.js
 * - [027호 오디오 반응형 기타 스피커 스테이지 Ver 8.0 - Strict Isolated Frequency Engine]
 * - 🎸 7현: 인위적 보완 수식 100% 제거 ➔ 오직 1:1 전용 주파수 재생 시에만 독립 진동 (미연주 시 완전 직선)
 * - 🥁 좌측: 킥, 스네어, 탐탐, 하이햇 심벌 개별 분리 아기자기한 개별 좌표 배치
 * - 🔊 우측: 피아노 완전 제거 ➔ 서브우퍼 + 미드/트위터 듀얼 모니터 스피커 시스템
 * - 16:9 / 9:16 Export 비율 및 오버스캔 레터박스 지원
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
    this.version = "027호 기타 스피커 스테이지 Ver 8.0 (Strict Frequency)";
    
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
        decay: 0.75, // 빠른 감쇄 연산으로 즉각적 정지 반응
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
      x: x, y: y, radius: 8, maxRadius: maxRadius,
      color: color, alpha: 0.85, speed: 3.0 + Math.random() * 3.0
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
  // 🥁 좌측 무대: 개별 부속별 아기자기한 분리 배치 드럼 세트
  // =========================================================================
  drawCuteSeparatedDrums(ctx, baseX, baseY, scale, kickP, snareP, tomP, cymbalP, color) {
    ctx.save();
    ctx.translate(baseX, baseY);

    const s = scale / 100;

    // 1. 하이햇 / 크래쉬 심벌 (좌측 상단 - cymbalP 고음 반응)
    const cymScale = s * (1.0 + cymbalP * 0.22);
    ctx.strokeStyle = `rgba(${color}, ${0.5 + cymbalP * 0.5})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-35 * s, 10 * s);
    ctx.lineTo(-35 * s, -35 * s);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 215, 0, ${0.5 + cymbalP * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(-35 * s, -35 * s, 18 * cymScale, 5 * cymScale, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // 2. 탐탐 드럼 (중앙 상단 - tomP 중음 반응)
    const tomScale = s * (1.0 + tomP * 0.18);
    ctx.fillStyle = "#121622";
    ctx.strokeStyle = `rgba(${color}, ${0.6 + tomP * 0.4})`;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(-5 * tomScale, -25 * tomScale, 15 * tomScale, 8 * tomScale, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // 3. 스네어 드럼 (좌측 중앙 - snareP 중저음 반응)
    const snareScale = s * (1.0 + snareP * 0.20);
    ctx.beginPath();
    ctx.ellipse(-30 * snareScale, -5 * snareScale, 16 * snareScale, 9 * snareScale, -0.15, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // 4. 대형 킥 드럼 (하단 중앙 - kickP 극저음 반응)
    const kickScale = s * (1.0 + kickP * 0.25);
    ctx.fillStyle = "#181d2a";
    ctx.strokeStyle = `rgba(${color}, ${0.7 + kickP * 0.3})`;
    ctx.lineWidth = 2.8;

    ctx.beginPath();
    ctx.ellipse(0, 15 * kickScale, 24 * kickScale, 20 * kickScale, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = `rgba(${color}, ${0.25 + kickP * 0.55})`;
    ctx.beginPath();
    ctx.ellipse(0, 15 * kickScale, 18 * kickScale, 15 * kickScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // =========================================================================
  // 🔊 우측 무대: 고해상도 듀얼 스튜디오 모니터 스피커 (Dual Speakers)
  // =========================================================================
  drawDualStudioSpeakers(ctx, baseX, baseY, scale, wooferP, tweeterP, color) {
    ctx.save();
    ctx.translate(baseX, baseY);

    const s = scale / 100;
    const spW = 30 * s;
    const spH = 48 * s;

    // ① 메인 서브우퍼 스피커 (좌측 - wooferP 저음 반응)
    ctx.save();
    ctx.translate(-spW * 0.6, 5 * s);
    ctx.fillStyle = "#1a202c";
    ctx.strokeStyle = `rgba(${color}, ${0.7 + wooferP * 0.3})`;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.roundRect(-spW / 2, -spH / 2, spW, spH, 5 * s);
    ctx.fill(); ctx.stroke();

    // 우퍼 콘
    const wooferR = (spW * 0.33) * (1.0 + wooferP * 0.28);
    ctx.fillStyle = `rgba(${color}, ${0.2 + wooferP * 0.5})`;
    ctx.beginPath();
    ctx.arc(0, spH * 0.15, wooferR, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = `rgba(${color}, ${0.7 + wooferP * 0.3})`;
    ctx.beginPath();
    ctx.arc(0, spH * 0.15, wooferR * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ② 미드/트위터 스피커 (우측 - tweeterP 고음 반응)
    ctx.save();
    ctx.translate(spW * 0.6, -5 * s);
    ctx.fillStyle = "#141824";
    ctx.strokeStyle = `rgba(${color}, ${0.7 + tweeterP * 0.3})`;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.roundRect(-spW / 2, -spH / 2, spW, spH, 5 * s);
    ctx.fill(); ctx.stroke();

    // 트위터 돔 (고음 속전속결 떨림)
    const tweeterR = (spW * 0.20) * (1.0 + tweeterP * 0.35);
    ctx.fillStyle = `rgba(${color}, ${0.5 + tweeterP * 0.5})`;
    ctx.beginPath();
    ctx.arc(0, -spH * 0.22, tweeterR, 0, Math.PI * 2);
    ctx.fill();

    // 미드 콘
    const midR = spW * 0.28;
    ctx.fillStyle = `rgba(${color}, 0.2)`;
    ctx.beginPath();
    ctx.arc(0, spH * 0.16, midR, 0, Math.PI * 2);
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

    // 64채널 스펙트럼 수신
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
    // 2. 🥁 🔊 무대 악기 (좌측 분리 드럼 & 우측 듀얼 스피커)
    // ---------------------------------------------------------------------
    const leftKitX = renderX + renderW * 0.18;
    const rightKitX = renderX + renderW * 0.82;
    const kitY = vanishY + renderH * 0.02;
    const kitSize = 90 * scaleFactor;

    // 무대 악기별 독립 주파수 산출
    const kickEnergy    = this.getBandAverage(spectrum, 0, 2) * 3.2 * gainVal;   // 킥 (Sub-Bass)
    const snareEnergy   = this.getBandAverage(spectrum, 3, 7) * 2.8 * gainVal;  // 스네어 (Low-Mid)
    const tomEnergy     = this.getBandAverage(spectrum, 8, 16) * 2.8 * gainVal;  // 탐탐 (Mid)
    const cymbalEnergy  = Math.max(otherVol * 1.2, this.getBandAverage(spectrum, 28, 50) * 3.2 * gainVal); // 심벌 (Treble)

    const wooferEnergy  = Math.max(bassVol * 1.5, this.getBandAverage(spectrum, 0, 5) * 3.2 * gainVal);   // 우퍼 (Bass)
    const tweeterEnergy = Math.max(vocalsVol * 1.2, this.getBandAverage(spectrum, 20, 40) * 3.2 * gainVal); // 트위터 (High-Mid)

    // ① 좌측 아기자기하게 분리된 드럼 세트
    this.drawCuteSeparatedDrums(this.ctx, leftKitX, kitY, kitSize, kickEnergy, snareEnergy, tomEnergy, cymbalEnergy, mainColor);

    // ② 우측 듀얼 스튜디오 모니터 스피커
    this.drawDualStudioSpeakers(this.ctx, rightKitX, kitY + kitSize * 0.1, kitSize, wooferEnergy, tweeterEnergy, accentColor);

    // 파동 링 발생
    if (wooferEnergy > 0.15 && Math.random() < 0.3) {
      this.spawnSoundRing(rightKitX - kitSize * 0.15, kitY + kitSize * 0.15, accentColor, kitSize * 2.2);
    }
    if (kickEnergy > 0.15 && Math.random() < 0.3) {
      this.spawnSoundRing(leftKitX, kitY + kitSize * 0.15, mainColor, kitSize * 2.0);
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
    // 3. 🎸 7현 주파수 슬라이싱 1:1 매핑 (인위적 덮어쓰기 완전 제거)
    // ---------------------------------------------------------------------
    const bassSens = 6.5 * gainVal;
    
    // 🎯 7개 현 전용 1:1 주파수 대역 (Bin 0 ~ Bin 40)
    const bands = [
      this.getBandAverage(spectrum, 0, 1) * bassSens,   // 1번 현: Sub-Bass (20~60Hz)
      this.getBandAverage(spectrum, 2, 3) * bassSens,   // 2번 현: Low-Bass (60~120Hz)
      this.getBandAverage(spectrum, 4, 6) * bassSens,   // 3번 현: Bass-Mid (120~250Hz)
      this.getBandAverage(spectrum, 7, 10) * bassSens,  // 4번 현: Low-Mid (250~500Hz)
      this.getBandAverage(spectrum, 11, 16) * bassSens, // 5번 현: Mid-Range (500~1.2kHz)
      this.getBandAverage(spectrum, 17, 25) * bassSens, // 6번 현: High-Mid (1.2~3kHz)
      this.getBandAverage(spectrum, 26, 40) * bassSens  // 7번 현: Treble (3~8kHz)
    ];

    const bottomY = renderY + renderH * 0.98;
    const topY = vanishY;

    const bottomWidth = renderW * 0.85;
    const topWidth = renderW * 0.09;

    this.strings.forEach((str, idx) => {
      // 💡 [핵심]: 오직 자신에게 할당된 주파수 에너지(bands[idx])만 수신!
      const bandEnergy = bands[idx] || 0;
      
      // 임계값 0.05 이상일 때만 목표 진폭 설정
      if (bandEnergy > 0.05) {
        str.targetAmplitude = (12 + bandEnergy * 42) * scaleFactor;
        
        if (bandEnergy > 0.18 && Math.random() < 0.45) {
          const normIdx = idx / (this.stringCount - 1);
          const sparkX = centerX - (bottomWidth * 0.5) + normIdx * bottomWidth;
          const sparkY = bottomY - 0.2 * (bottomY - topY);
          this.spawnSparks(sparkX, sparkY, idx % 2 === 0 ? mainColor : accentColor, 3);
        }
      } else {
        str.targetAmplitude = 0; // 해당 주파수 무음 시 0으로 정지
      }

      // 현 진폭 보평 및 급속 감쇄
      str.amplitude = str.amplitude * str.decay + str.targetAmplitude * (1.0 - str.decay);
      
      // 잔여 진동 미세값 완전 스냅 ➔ 픽스된 3D 직선
      if (str.amplitude < 0.15) {
        str.amplitude = 0;
      } else {
        str.phase += 0.28;
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
        // amplitude가 0일 때는 vibeX가 0 ➔ 오차 없는 100% 3D 직선!
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

    // 4. Spark 파티클 렌더링
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
      particleCount: `Strict 7-String & Dual Speakers (Sparks:${this.particles.length})`,
      isCovering: true,
      activeFunction: `Guitar7StringStage[StrictFrequency_${colorStyle.toUpperCase()}]`
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
