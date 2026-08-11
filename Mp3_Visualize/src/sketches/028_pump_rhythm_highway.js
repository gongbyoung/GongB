/**
 * src/sketches/028_pump_rhythm_highway.js
 * - [028호 펌프 리듬 하이웨이 Ver 18.0 - Vocal Background Line Chart]
 * - 🎤 VOCAL 레인 삭제 및 배경 꺽은선 그래프(Zigzag Line Chart) 전환 (왼쪽~오른쪽 볼륨 지그재그 흐름)
 * - 🥁 DRUM (5 Lanes) : 5개 세부 주파수 대역 분산
 * - 🎸 BASS (5 Lanes) : 5개 세부 주파수 대역 분산
 * - 🎹 OTHER (1 Lane) : 기타/인스트 단독 레인
 * - 총 11개 레인 구조 & 관제탑 노브(Volume, Range, Scale, Gauge, Shuffle) 완벽 연동
 */

export default class PumpRhythmHighwaySketch {
  constructor(container) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    if (this.container) {
      this.container.appendChild(this.canvas);
    }

    this.time = 0;
    this.version = "028호 펌프 리듬 하이웨이 Ver 18.0 (Vocal Background Line)";
    
    this.laneCount = 11; // 5(Drum) + 5(Bass) + 1(Other) [Vocal은 배경 그래프로 이동]
    this.notes = [];
    this.particles = [];
    this.hitEffects = [];
    
    this.laneCooldowns = new Array(11).fill(0);
    this.prevEnergies = new Float32Array(11);
    this.vocalHistory = []; // 배경 꺽은선 그래프용 볼륨 히스토리 버퍼
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

  hexToRgb(hex) {
    if (!hex) return "0, 240, 255";
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
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

  getGlobalShape(seed) {
    const s = Math.abs(Math.floor(seed)) % 500;
    if (s < 100) return 0;      // 0~99   : 직사각형
    if (s < 200) return 1;      // 100~199: 라운드 사각
    if (s < 300) return 2;      // 200~299: 원형
    if (s < 400) return 3;      // 300~399: 다이아몬드
    return 4;                   // 400~500: 별형
  }

  spawnHitParticles(x, y, color, count = 8, scaleFactor = 1.0) {
    const finalCount = Math.floor(count * scaleFactor);
    for (let i = 0; i < finalCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 6) * scaleFactor;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.0,
        size: (2 + Math.random() * 4) * scaleFactor,
        color: color,
        life: 1.0
      });
    }
  }

  spawnHitEffect(x, y, color, scaleFactor = 1.0) {
    this.hitEffects.push({
      x: x, y: y,
      radius: 8 * scaleFactor,
      maxRadius: 35 * scaleFactor,
      color: color,
      alpha: 1.0
    });
  }

  drawNoteShape(ctx, shapeType, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();

    switch (shapeType) {
      case 1:
        ctx.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.35);
        ctx.fill();
        break;
      case 2:
        ctx.arc(x, y, Math.min(w, h) * 0.48, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 3:
        ctx.moveTo(x, y - h / 2);
        ctx.lineTo(x + w / 2, y);
        ctx.lineTo(x, y + h / 2);
        ctx.lineTo(x - w / 2, y);
        ctx.closePath();
        ctx.fill();
        break;
      case 4:
        {
          const r = Math.min(w, h) * 0.55;
          const ir = r * 0.45;
          for (let i = 0; i < 10; i++) {
            const cr = i % 2 === 0 ? r : ir;
            const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
            const px = x + Math.cos(a) * cr;
            const py = y + Math.sin(a) * cr;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
        break;
      default:
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
        break;
    }
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
    const gaugeVal = globalSettings.gaugeValue ?? 0.5;

    const exportRatio = (globalSettings.exportRatio || globalSettings.exportSetting || globalSettings.aspectRatio || 'full').toLowerCase();

    // Range (Scatter): 노이즈 게이트 감도
    const rawScatter = globalSettings.scatterExponent ?? globalSettings.scatter ?? globalSettings.range ?? 25;
    const silenceGate = 0.01 + (rawScatter / 100.0) * 0.12;

    // Scale (Glow): 크기 및 이펙트 규모
    const rawGlow = globalSettings.glowScale ?? globalSettings.glow ?? globalSettings.scale ?? 50;
    const scaleFactor = Math.max(0.3, Math.min(3.0, rawGlow / 40.0));

    const noteSpeed = 0.018;

    const rawDrumsV  = (targetAudio.drumsVol  ?? 0) * gainVal;
    const rawBassV   = (targetAudio.bassVol   ?? 0) * gainVal;
    const rawVocalsV = (targetAudio.vocalsVol ?? 0) * gainVal;
    const rawOtherV  = (targetAudio.otherVol  ?? 0) * gainVal;

    const passDrums  = rawDrumsV > silenceGate;
    const passBass   = rawBassV > silenceGate;
    const passOther  = rawOtherV > silenceGate;

    const drumsSpec  = passDrums  ? (targetAudio.drumsSpectrum  || new Float32Array(64)) : new Float32Array(64);
    const bassSpec   = passBass   ? (targetAudio.bassSpectrum   || new Float32Array(64)) : new Float32Array(64);
    const otherSpec  = passOther  ? (targetAudio.otherSpectrum  || new Float32Array(64)) : new Float32Array(64);

    // 💡 보컬 볼륨을 배경 꺽은선 그래프 히스토리에 누적 (최대 120개 포인트)
    this.vocalHistory.push(rawVocalsV * gainVal);
    if (this.vocalHistory.length > 120) {
      this.vocalHistory.shift();
    }

    this.time += 0.016;

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

    const customColors = globalSettings.customColors || {};
    const cGas1 = this.hexToRgb(customColors.gas1);
    const cGas2 = this.hexToRgb(customColors.gas2);
    const cStar = this.hexToRgb(customColors.star);

    let colorDrums  = "255, 60, 80";   // Red Coral
    let colorBass   = "0, 230, 255";   // Cyan Blue
    let colorVocals = "255, 215, 0";   // Gold Yellow
    let colorOther  = "190, 80, 255";  // Purple Magenta

    if (colorStyle === 'pastel') {
      colorDrums  = "240, 110, 130"; colorBass   = "90, 170, 230";
      colorVocals = "230, 180, 80";  colorOther  = "170, 120, 220";
    } else if (colorStyle === 'monochrome' || colorStyle === 'earth') {
      colorDrums  = "220, 225, 240"; colorBass   = "180, 195, 215";
      colorVocals = "240, 245, 255"; colorOther  = "150, 165, 185";
    } else if (colorStyle === 'custom') {
      colorDrums  = cGas1; colorBass = cGas2; colorVocals = cStar; colorOther = "180, 100, 255";
    }

    const bgGrad = this.ctx.createLinearGradient(renderX, renderY, renderX, renderY + renderH);
    bgGrad.addColorStop(0, "#101426");
    bgGrad.addColorStop(0.5, "#050712");
    bgGrad.addColorStop(1, "#020308");

    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(renderX, renderY, renderW, renderH);

    // ---------------------------------------------------------------------
    // 🎤 배경 꺽은선 그래프 (Vocal Zigzag Background Line Chart)
    // ---------------------------------------------------------------------
    this.ctx.save();
    this.ctx.strokeStyle = `rgba(${colorVocals}, 0.28)`;
    this.ctx.lineWidth = 2.5 * scaleFactor;
    this.ctx.beginPath();
    const chartStepX = renderW / (this.vocalHistory.length - 1 || 1);
    const chartBaseY = renderY + renderH * 0.45; // 화면 중앙 배경 부근

    for (let i = 0; i < this.vocalHistory.length; i++) {
      const hx = renderX + i * chartStepX;
      // 볼륨 높이에 따라 지그재그로 꺾이는 파형 그래프 연출
      const hy = chartBaseY - (this.vocalHistory[i] * 180 * scaleFactor) + Math.sin(i * 0.5 + this.time * 3) * 15;
      if (i === 0) this.ctx.moveTo(hx, hy);
      else this.ctx.lineTo(hx, hy);
    }
    this.ctx.stroke();
    this.ctx.restore();

    const centerX = renderX + renderW / 2;
    const vanishY = renderY + renderH * 0.12;
    const hitY = renderY + renderH * 0.84;

    const topTrackW = renderW * (0.08 + gaugeVal * 0.32);
    const bottomTrackW = renderW * 0.88;

    // ---------------------------------------------------------------------
    // 1. 11개 레인 주파수 산출 & 노트 생성 (5 Drum + 5 Bass + 1 Other)
    // ---------------------------------------------------------------------
    const curEnergies = new Float32Array(11);

    if (passDrums) {
      curEnergies[0] = this.getBandAverage(drumsSpec, 0, 1) * 3.5 * gainVal;
      curEnergies[1] = this.getBandAverage(drumsSpec, 2, 4) * 3.5 * gainVal;
      curEnergies[2] = this.getBandAverage(drumsSpec, 5, 9) * 3.5 * gainVal;
      curEnergies[3] = this.getBandAverage(drumsSpec, 10, 18) * 3.5 * gainVal;
      curEnergies[4] = this.getBandAverage(drumsSpec, 19, 35) * 3.5 * gainVal;
    }

    if (passBass) {
      curEnergies[5] = this.getBandAverage(bassSpec, 0, 1) * 3.5 * gainVal;
      curEnergies[6] = this.getBandAverage(bassSpec, 2, 3) * 3.5 * gainVal;
      curEnergies[7] = this.getBandAverage(bassSpec, 4, 6) * 3.5 * gainVal;
      curEnergies[8] = this.getBandAverage(bassSpec, 7, 10) * 3.5 * gainVal;
      curEnergies[9] = this.getBandAverage(bassSpec, 11, 18) * 3.5 * gainVal;
    }

    if (passOther) {
      curEnergies[10] = Math.max(rawOtherV * 1.5, this.getBandAverage(otherSpec, 10, 35) * 3.5 * gainVal);
    }

    for (let l = 0; l < this.laneCount; l++) {
      if (this.laneCooldowns[l] > 0) this.laneCooldowns[l]--;
    }

    const stemGroups = [
      { lanes: [0, 1, 2, 3, 4] }, // Drum (5)
      { lanes: [5, 6, 7, 8, 9] }, // Bass (5)
      { lanes: [10] }             // Other (1)
    ];

    const globalShapeType = this.getGlobalShape(seedVal);

    stemGroups.forEach(group => {
      let maxEnergy = 0;
      let winnerLane = -1;

      for (let l of group.lanes) {
        if (curEnergies[l] > maxEnergy) {
          maxEnergy = curEnergies[l];
          winnerLane = l;
        }
      }

      if (winnerLane !== -1) {
        const energy = curEnergies[winnerLane];
        const prevEnergy = this.prevEnergies[winnerLane];
        const isSpike = (energy - prevEnergy) > 0.04;

        if (isSpike && energy > (silenceGate * 2.5) && this.laneCooldowns[winnerLane] <= 0) {
          this.notes.push({
            lane: winnerLane,
            progress: 0.0,
            energy: energy,
            shapeType: globalShapeType
          });
          this.laneCooldowns[winnerLane] = 10 + Math.floor(Math.random() * 4);
        }
      }

      for (let l of group.lanes) {
        this.prevEnergies[l] = curEnergies[l];
      }
    });

    // ---------------------------------------------------------------------
    // 2. 3D 원근 트랙 렌더링 (11개 레인 기준)
    // ---------------------------------------------------------------------
    for (let i = 0; i <= this.laneCount; i++) {
      const norm = i / this.laneCount;
      const topX = centerX - (topTrackW * 0.5) + norm * topTrackW;
      const bottomX = centerX - (bottomTrackW * 0.5) + norm * bottomTrackW;

      const isGroupBorder = (i === 0 || i === 5 || i === 10 || i === 11);
      this.ctx.strokeStyle = isGroupBorder ? `rgba(255, 255, 255, 0.50)` : `rgba(255, 255, 255, 0.12)`;
      this.ctx.lineWidth = isGroupBorder ? 2.4 : 0.8;

      this.ctx.beginPath();
      this.ctx.moveTo(topX, vanishY);
      this.ctx.lineTo(bottomX, renderY + renderH);
      this.ctx.stroke();
    }

    const gridLines = 8;
    this.ctx.strokeStyle = `rgba(255, 255, 255, 0.12)`;
    this.ctx.lineWidth = 1.0;
    for (let g = 0; g < gridLines; g++) {
      const p = ((this.time * 1.5 + g / gridLines) % 1.0);
      const gy = vanishY + p * (renderH - vanishY);
      const gw = topTrackW + p * (bottomTrackW - topTrackW);

      this.ctx.beginPath();
      this.ctx.moveTo(centerX - gw * 0.5, gy);
      this.ctx.lineTo(centerX + gw * 0.5, gy);
      this.ctx.stroke();
    }

    // ---------------------------------------------------------------------
    // 3. 상단 스템 라벨 렌더링 (DRUM, BASS, OTHER)
    // ---------------------------------------------------------------------
    const labelY = vanishY - 8;
    const stemLabels = [
      { text: "DRUM", color: colorDrums, centerIdx: 2.0 },
      { text: "BASS", color: colorBass, centerIdx: 7.0 },
      { text: "OTHER", color: colorOther, centerIdx: 10.0 }
    ];

    const dynamicFontSize = Math.max(7, Math.min(13, (topTrackW / 11) * 0.95));
    this.ctx.font = `900 ${dynamicFontSize}px sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';

    stemLabels.forEach(label => {
      const norm = (label.centerIdx + 0.5) / this.laneCount;
      const lx = centerX - (topTrackW * 0.5) + norm * topTrackW;

      this.ctx.fillStyle = `rgba(${label.color}, 0.9)`;
      this.ctx.fillText(label.text, lx, labelY);
    });

    // ---------------------------------------------------------------------
    // 4. 하단 네온 판정선 (Hit Line) & 11개 페달
    // ---------------------------------------------------------------------
    const hitTrackW = topTrackW + 0.84 * (bottomTrackW - topTrackW);
    const hitStartX = centerX - hitTrackW * 0.5;

    this.ctx.shadowColor = `rgb(${colorBass})`;
    this.ctx.shadowBlur = 10;
    this.ctx.strokeStyle = `rgba(255, 255, 255, 0.9)`;
    this.ctx.lineWidth = 3.5;

    this.ctx.beginPath();
    this.ctx.moveTo(hitStartX, hitY);
    this.ctx.lineTo(centerX + hitTrackW * 0.5, hitY);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    const laneW = hitTrackW / this.laneCount;

    for (let l = 0; l < this.laneCount; l++) {
      const btnX = hitStartX + (l + 0.5) * laneW;
      const btnW = laneW * 0.78 * scaleFactor;
      const btnH = 9 * scaleFactor;

      let laneColor = colorDrums;
      if (l === 10) laneColor = colorOther;
      else if (l >= 5) laneColor = colorBass;

      const isHitNow = curEnergies[l] > (silenceGate * 2.0);
      this.ctx.fillStyle = isHitNow ? `rgba(${laneColor}, 0.95)` : `rgba(${laneColor}, 0.22)`;
      this.ctx.fillRect(btnX - btnW * 0.5, hitY - btnH * 0.5, btnW, btnH);
    }

    // ---------------------------------------------------------------------
    // 5. 노트 낙하 렌더링
    // ---------------------------------------------------------------------
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      note.progress += noteSpeed;

      const p = note.progress;
      const curY = vanishY + p * (hitY - vanishY);

      const curTrackW = topTrackW + p * (bottomTrackW - topTrackW);
      const curLaneW = curTrackW / this.laneCount;
      const curStartX = centerX - curTrackW * 0.5;

      const noteX = curStartX + (note.lane + 0.5) * curLaneW;
      const noteW = curLaneW * 0.82 * scaleFactor;
      const noteH = (8 + p * 14) * scaleFactor;

      let curNoteColor = colorDrums;
      if (note.lane === 10) curNoteColor = colorOther;
      else if (note.lane >= 5) curNoteColor = colorBass;

      const fillRGBA = `rgba(${curNoteColor}, ${Math.min(1.0, p * 2.0)})`;

      this.ctx.shadowColor = `rgb(${curNoteColor})`;
      this.ctx.shadowBlur = 8 * p;

      this.drawNoteShape(this.ctx, note.shapeType, noteX, curY, noteW, noteH, fillRGBA);
      this.ctx.shadowBlur = 0;

      if (p >= 1.0) {
        const hitX = curStartX + (note.lane + 0.5) * curLaneW;
        this.spawnHitParticles(hitX, hitY, curNoteColor, 8, scaleFactor);
        this.spawnHitEffect(hitX, hitY, curNoteColor, scaleFactor);

        this.notes.splice(i, 1);
      }
    }

    // ---------------------------------------------------------------------
    // 6. 파티클 렌더링
    // ---------------------------------------------------------------------
    for (let i = this.hitEffects.length - 1; i >= 0; i--) {
      const fx = this.hitEffects[i];
      fx.radius += 2.5 * scaleFactor;
      fx.alpha -= 0.06;

      if (fx.alpha <= 0 || fx.radius >= fx.maxRadius) {
        this.hitEffects.splice(i, 1);
        continue;
      }

      this.ctx.strokeStyle = `rgba(${fx.color}, ${fx.alpha})`;
      this.ctx.lineWidth = 3 * scaleFactor;
      this.ctx.beginPath();
      this.ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life -= 0.04;

      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.fillStyle = `rgba(${pt.color}, ${pt.life})`;
      this.ctx.beginPath();
      this.ctx.arc(pt.x, pt.y, pt.size * pt.life, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Background Vocal Line (Notes:${this.notes.length})`,
      isCovering: true,
      activeFunction: `PumpHighwayVocalBg[11Lanes_${colorStyle.toUpperCase()}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.notes = [];
    this.particles = [];
    this.hitEffects = [];
    this.vocalHistory = [];
  }
}
