/**
 * src/sketches/027_guitar_speaker_stage.js
 * - [027호 오디오 반응형 기타 스피커 스테이지 Ver 1.0]
 * - 🎸 중앙 기타 6현: 베이스/드럼 음압 및 주파수에 맞춘 실시간 현 튕김 물리학
 * - 🔊 좌우 스피커 & 드럼: 저음/비트 타격 시 우퍼 펌핑 & 사운드 파동 링 팝업
 * - 🎤 보컬 & 기타: 줄 피킹 Spark 파티클 & 오라 발광 연동
 * - 16:9 / 9:16 Export 레터박스 뷰포트 완벽 연동
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
    this.version = "027호 기타 스피커 스테이지 Ver 1.0";
    
    // 기타 6줄 물리 상태
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
    if (!hex) return "0, 240, 255";
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
        frequency: 8 + i * 2.5,
        decay: 0.92,
        phase: Math.random() * Math.PI * 2,
        thickness: 4.5 - i * 0.6 // 아래줄일수록 두꺼운 줄
      });
    }
  }

  // 💡 파티클 생성 함수
  spawnSparks(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        color: color,
        life: 1.0
      });
    }
  }

  // 💡 스피커 사운드 파동 링 생성
  spawnSoundRing(x, y, color, maxRadius) {
    this.soundRings.push({
      x: x,
      y: y,
      radius: 20,
      maxRadius: maxRadius,
      color: color,
      alpha: 0.9,
      speed: 4 + Math.random() * 4
    });
  }

  // =========================================================================
  // 🖌️ 스피커 단상 렌더링 도우미 (Left / Right Speakers)
  // =========================================================================
  drawSpeaker(ctx, x, y, width, height, pulse, color, isLeft) {
    ctx.save();
    ctx.translate(x, y);

    // 스피커 캐비닛 외곽
    ctx.fillStyle = "#101420";
    ctx.strokeStyle = `rgba(${color}, 0.6)`;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, 12);
    ctx.fill();
    ctx.stroke();

    // 트위터 (상단 소형 유닛)
    ctx.fillStyle = `rgba(${color}, 0.3)`;
    ctx.beginPath();
    ctx.arc(0, -height * 0.25, width * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 우퍼 (하단 대형 유닛 - pulse 반응 수축/팽창)
    const wooferRadius = (width * 0.35) * (1.0 + pulse * 0.35);
    ctx.fillStyle = `rgba(${color}, ${0.2 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(0, height * 0.2, wooferRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2 + pulse * 4;
    ctx.strokeStyle = `rgba(${color}, ${0.8 + pulse * 0.2})`;
    ctx.stroke();

    // 더스트 캡 (우퍼 중앙 캡)
    ctx.fillStyle = `rgba(${color}, ${0.6 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(0, height * 0.2, wooferRadius * 0.35, 0, Math.PI * 2);
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

    // ⚡ 관제탑 슬라이더 연동
    const rawScatter = globalSettings.scatterExponent ?? globalSettings.scatter ?? globalSettings.range ?? 25;
    const scatterSpeed = Math.max(1.0, Math.min(500.0, rawScatter * 10.0));

    const rawGlow = globalSettings.glowScale ?? globalSettings.glow ?? globalSettings.scale ?? 50;
    const scaleFactor = Math.max(0.2, Math.min(3.5, rawGlow / 40.0));

    // 4-Stem 오디오 음압
    const vocalsVol = (targetAudio.vocalsVol ?? targetAudio.mid ?? 0) * gainVal;
    const drumsVol  = (targetAudio.drumsVol  ?? targetAudio.bass ?? 0) * gainVal;
    const bassVol   = (targetAudio.bassVol   ?? targetAudio.bass ?? 0) * gainVal;
    const otherVol  = (targetAudio.otherVol  ?? targetAudio.treble ?? 0) * gainVal;

    this.time += 0.016 * (scatterSpeed / 50.0);

    const W = this.canvas.width;
    const H = this.canvas.height;

    // 💡 [Export 비율 대응]: 16:9 / 9:16 레터박스 영점 연산
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

    // 캔버스 레터박스 클리핑
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, W, H);

    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    // 팔레트 지정
    let bgColor = "#060913";
    let isDark = true;

    const customColors = globalSettings.customColors || {};
    const cGas1 = this.hexToRgb(customColors.gas1);
    const cGas2 = this.hexToRgb(customColors.gas2);
    const cStar = this.hexToRgb(customColors.star);

    let mainColor = cGas1;
    let accentColor = cGas2;
    let stringColor = cStar;

    if (colorStyle === 'neon') {
      bgColor = "#050714"; isDark = true;
      mainColor = "0, 240, 255"; accentColor = "255, 0, 128"; stringColor = "255, 255, 255";
    } else if (colorStyle === 'pastel') {
      bgColor = "#f8f6f0"; isDark = false;
      mainColor = "80, 160, 230"; accentColor = "230, 100, 160"; stringColor = "60, 60, 80";
    } else if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      bgColor = "#0d111a"; isDark = true;
      mainColor = "180, 200, 220"; accentColor = "120, 140, 160"; stringColor = "220, 235, 255";
    }

    // 배경 마감
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(renderX, renderY, renderW, renderH);

    // ---------------------------------------------------------------------
    // 1. 🔊 좌우 스피커 & 드럼 무대 연출
    // ---------------------------------------------------------------------
    const speakerW = renderW * 0.15 * scaleFactor;
    const speakerH = renderH * 0.55 * scaleFactor;

    const leftSpeakerX = renderX + renderW * 0.15;
    const rightSpeakerX = renderX + renderW * 0.85;
    const speakerY = renderY + renderH * 0.5;

    // 좌측 스피커 (베이스 & 드럼 타격 연동)
    this.drawSpeaker(this.ctx, leftSpeakerX, speakerY, speakerW, speakerH, bassVol * 1.5, mainColor, true);
    // 우측 스피커 (기타 & 보컬 연동)
    this.drawSpeaker(this.ctx, rightSpeakerX, speakerY, speakerW, speakerH, otherVol * 1.5, accentColor, false);

    // 스피커 파동 링 발생
    if (bassVol > 0.08 && Math.random() < 0.3) {
      this.spawnSoundRing(leftSpeakerX, speakerY + speakerH * 0.2, mainColor, speakerW * 2.5);
    }
    if (otherVol > 0.08 && Math.random() < 0.3) {
      this.spawnSoundRing(rightSpeakerX, speakerY + speakerH * 0.2, accentColor, speakerW * 2.5);
    }

    // 파동 링 렌더링 & 업데이트
    for (let i = this.soundRings.length - 1; i >= 0; i--) {
      const ring = this.soundRings[i];
      ring.radius += ring.speed;
      ring.alpha -= 0.02;

      if (ring.alpha <= 0 || ring.radius >= ring.maxRadius) {
        this.soundRings.splice(i, 1);
        continue;
      }

      this.ctx.strokeStyle = `rgba(${ring.color}, ${ring.alpha})`;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // ---------------------------------------------------------------------
    // 2. 🎸 중앙 기타 6현 물리학 & 음에 맞춘 줄 튕김 연출
    // ---------------------------------------------------------------------
    const guitarStartX = leftSpeakerX + speakerW * 0.7;
    const guitarEndX = rightSpeakerX - speakerW * 0.7;
    const guitarWidth = guitarEndX - guitarStartX;
    const centerY = renderY + renderH * 0.5;

    const stringGap = (renderH * 0.22) / (this.stringCount - 1);
    const topStringY = centerY - (renderH * 0.11);

    // 베이스/드럼 음압에 따른 기타 줄 튕김 트리거
    this.strings.forEach((str, idx) => {
      // 짝수 줄은 베이스, 홀수 줄은 드럼/기타 음압에 반응
      const triggerVol = (idx % 2 === 0) ? bassVol : drumsVol;
      
      if (triggerVol > 0.05 && Math.random() < 0.4) {
        str.amplitude = (15 + triggerVol * 35) * scaleFactor;
        str.phase = Math.random() * Math.PI * 2;

        // Spark 파티클 팝업
        const sparkX = guitarStartX + Math.random() * guitarWidth;
        const sparkY = topStringY + idx * stringGap;
        this.spawnSparks(sparkX, sparkY, idx % 2 === 0 ? mainColor : accentColor, 4);
      }

      // 현 진동 감쇄 연산
      str.amplitude *= str.decay;
      str.phase += 0.2;
    });

    // 💡 [보컬 반응]: 기타 지판 중앙 발광 오라
    if (vocalsVol > 0.03) {
      const auraRadius = (renderW * 0.18) * (1.0 + vocalsVol * 0.8);
      const gradient = this.ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, auraRadius);
      gradient.addColorStop(0, `rgba(${accentColor}, ${0.35 * vocalsVol})`);
      gradient.addColorStop(1, `rgba(${mainColor}, 0)`);

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, auraRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 🎸 기타 줄 6개 렌더링
    for (let i = 0; i < this.stringCount; i++) {
      const str = this.strings[i];
      const restY = topStringY + i * stringGap;

      this.ctx.beginPath();
      this.ctx.moveTo(guitarStartX, restY);

      const segments = 80;
      for (let s = 1; s <= segments; s++) {
        const ratio = s / segments;
        const px = guitarStartX + ratio * guitarWidth;
        
        // 현 양 끝은 고정되고 중앙으로 갈수록 크게 흔들리는 Sine Envelope 수식
        const envelope = Math.sin(ratio * Math.PI);
        const waveY = Math.sin(ratio * str.frequency + str.phase + this.time * 10) * str.amplitude * envelope;

        this.ctx.lineTo(px, restY + waveY);
      }

      // 기타 줄 두께 및 Glow
      const glowAmount = Math.max(2, str.amplitude * 0.8);
      this.ctx.shadowColor = `rgb(${mainColor})`;
      this.ctx.shadowBlur = glowAmount;

      this.ctx.strokeStyle = `rgba(${stringColor}, ${0.85 + (str.amplitude > 2 ? 0.15 : 0)})`;
      this.ctx.lineWidth = (str.thickness + str.amplitude * 0.1) * scaleFactor;
      this.ctx.stroke();

      this.ctx.shadowBlur = 0; // 초기화
    }

    // ---------------------------------------------------------------------
    // 3. 💥 피킹 Spark 파티클 렌더링 & 업데이트
    // ---------------------------------------------------------------------
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;

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
      particleCount: `Guitar Stage (Strings:6 / Sparks:${this.particles.length})`,
      isCovering: true,
      activeFunction: `GuitarStage[4Stem_${colorStyle.toUpperCase()}]`
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
