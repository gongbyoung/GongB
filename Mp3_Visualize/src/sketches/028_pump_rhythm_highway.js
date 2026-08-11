/**
 * src/sketches/028_pump_rhythm_highway.js
 * - [028호 펌프 리듬 하이웨이 Ver 7.0 - Dynamic Delay Switch Engine]
 * - 🎯 main.js의 가변 지연(028 선택 시 1.0초)과 정확히 맞물려 노트가 판정선 도착 시 100% 소리 출력
 * - ⚡ 4개 스템 개별 주파수 정밀 온셋 분석
 * - 📐 16:9 / 9:16 Export 및 Gauge 원근 폭 조율 지원
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
    this.version = "028호 펌프 리듬 하이웨이 Ver 7.0 (Dynamic Delay Sync)";
    
    this.laneCount = 12; // 4-Stem x 3-Lanes
    this.notes = [];
    this.particles = [];
    this.hitEffects = [];
    
    this.laneCooldowns = new Array(12).fill(0);
    this.prevEnergies = new Float32Array(12);
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

  getShapeForLane(lane, seed) {
    const pseudo = Math.abs(Math.sin(seed * 12.9898 + lane * 78.233) * 43758.5453);
    return Math.floor(pseudo) % 6;
  }

  spawnHitParticles(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 2 + Math.random() * 3.5,
        color: color,
        life: 1.0
      });
    }
  }

  spawnHitEffect(x, y, color) {
    this.hitEffects.push({
      x: x, y: y,
      radius: 8,
      maxRadius: 32,
      color: color,
      alpha: 1.0
    });
  }

  drawNoteShape(ctx, shapeType, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();

    switch (shapeType) {
      case 1:
        ctx.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.3);
        ctx.fill();
        break;
      case 2:
        ctx.arc(x, y, Math.min(w, h) * 0.45, 0, Math.PI * 2);
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
          const r = Math.min(w, h) * 0.5;
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
      case 5:
        ctx.moveTo(x, y - h / 2);
        ctx.lineTo(x + w / 2, y + h / 2);
        ctx.lineTo(x - w / 2, y + h / 2);
        ctx.closePath();
        ctx.fill();
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

    // 🎯 노트가 아래 판정선까지 낙하하는 시간: Exactly 1.0초
    const noteSpeed = 1.0 / 60.0;

    const rawGlow = globalSettings.glowScale ?? globalSettings.glow ?? globalSettings.scale ?? 50;
    const scaleFactor = Math.max(0.3, Math.min(3.0, rawGlow / 40.0));

    // 4-Stem 개별 주파수 스펙트럼 수신
    const drumsSpec  = targetAudio.drumsSpectrum  || new Float32Array(64);
    const bassSpec   = targetAudio.bassSpectrum   || new Float32Array(64);
    const vocalsSpec = targetAudio.vocalsSpectrum || new Float32Array(64);
    const otherSpec  = targetAudio.otherSpectrum  || new Float32Array(64);

    const drumsVol  = (targetAudio.drumsVol  ?? 0) * gainVal;
    const bassVol   = (targetAudio.bassVol   ?? 0) * gainVal;
    const vocalsVol = (targetAudio.vocalsVol ?? 0) * gainVal;
    const otherVol  = (targetAudio.otherVol  ?? 0) * gainVal;

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

    // 팔레트 지정
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

    const centerX = renderX + renderW / 2;
    const vanishY = renderY + renderH * 0.12;  // 상단 원근점
    const hitY = renderY + renderH * 0.84;     // 하단 판정선

    const topTrackW = renderW * (0.08 + gaugeVal * 0.32);
    const bottomTrackW = renderW * 0.88;

    // ---------------------------------------------------------------------
    // 1. 4개 스템 개별 주파수 분석 & 온셋 피크 감지
    // ---------------------------------------------------------------------
    const curEnergies = new Float32Array(12);

    // DRUMS (0~2)
    curEnergies[0] = Math.max(drumsVol * 1.5, this.getBandAverage(drumsSpec, 0, 2) * 3.5 * gainVal);
    curEnergies[1] = Math.max(drumsVol * 1.2, this.getBandAverage(drumsSpec, 3, 7) * 3.0 * gainVal);
    curEnergies[2] = Math.max(drumsVol * 1.0, this.getBandAverage(drumsSpec, 8, 15) * 3.0 * gainVal);

    // BASS (3~5)
    curEnergies[3] = Math.max(bassVol * 1.5, this.getBandAverage(bassSpec, 0, 3) * 3.5 * gainVal);
    curEnergies[4] = Math.max(bassVol * 1.3, this.getBandAverage(bassSpec, 4, 8) * 3.0 * gainVal);
    curEnergies[5] = Math.max(bassVol * 1.0, this.getBandAverage(bassSpec, 9, 15) * 3.0 * gainVal);

    // VOCAL (6~8)
    curEnergies[6] = Math.max(vocalsVol * 1.2, this.getBandAverage(vocalsSpec, 12, 18) * 3.0 * gainVal);
    curEnergies[7] = Math.max(vocalsVol * 1.5, this.getBandAverage(vocalsSpec, 19, 28) * 3.5 * gainVal);
    curEnergies[8] = Math.max(vocalsVol * 1.2, this.getBandAverage(vocalsSpec, 29, 40) * 3.0 * gainVal);

    // OTHER (9~11)
    curEnergies[9]  = Math.max(otherVol * 1.2, this.getBandAverage(otherSpec, 15, 24) * 3.0 * gainVal);
    curEnergies[10] = Math.max(otherVol * 1.5, this.getBandAverage(otherSpec, 25, 38) * 3.5 * gainVal);
    curEnergies[11] = Math.max(otherVol * 1.2, this.getBandAverage(otherSpec, 39, 55) * 3.0 * gainVal);

    for (let l = 0; l < this.laneCount; l++) {
      if (this.laneCooldowns[l] > 0) this.laneCooldowns[l]--;
    }

    const stemGroups = [
      { lanes: [0, 1, 2] },  // Drums
      { lanes: [3, 4, 5] },  // Bass
      { lanes: [6, 7, 8] },  // Vocals
      { lanes: [9, 10, 11] } // Other
    ];

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
        const isSpike = (energy - prevEnergy) > 0.08;

        if (isSpike && energy > 0.20 && this.laneCooldowns[winnerLane] <= 0) {
          this.notes.push({
            lane: winnerLane,
            progress: 0.0,
            energy: energy,
            shapeType: this.getShapeForLane(winnerLane, seedVal)
          });
          this.laneCooldowns[winnerLane] = 10 + Math.floor(Math.random() * 5);
        }
      }

      for (let l of group.lanes) {
        this.prevEnergies[l] = curEnergies[l];
      }
    });

    // ---------------------------------------------------------------------
    // 2. 3D 원근 트랙 렌더링
    // ---------------------------------------------------------------------
    for (let i = 0; i <= this.laneCount; i++) {
      const norm = i / this.laneCount;
      const topX = centerX - (topTrackW * 0.5) + norm * topTrackW;
      const bottomX = centerX - (bottomTrackW * 0.5) + norm * bottomTrackW;

      const isGroupBorder = i % 3 === 0;
      this.ctx.strokeStyle = isGroupBorder ? `rgba(255, 255, 255, 0.45)` : `rgba(255, 255, 255, 0.12)`;
      this.ctx.lineWidth = isGroupBorder ? 2.2 : 0.8;

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
    // 3. 상단 스템 라벨
    // ---------------------------------------------------------------------
    const labelY = vanishY - 8;
    const stemLabels = [
      { text: "DRUM", color: colorDrums, centerIdx: 1 },
      { text: "BASS", color: colorBass, centerIdx: 4 },
      { text: "VOCAL", color: colorVocals, centerIdx: 7 },
      { text: "OTHER", color: colorOther, centerIdx: 10 }
    ];

    const dynamicFontSize = Math.max(7, Math.min(13, (topTrackW / 12) * 0.95));
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
    // 4. 하단 네온 판정선 (Hit Line) & 12개 페달
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
      if (l >= 9) laneColor = colorOther;
      else if (l >= 6) laneColor = colorVocals;
      else if (l >= 3) laneColor = colorBass;

      const isHitNow = curEnergies[l] > 0.20;
      this.ctx.fillStyle = isHitNow ? `rgba(${laneColor}, 0.95)` : `rgba(${laneColor}, 0.22)`;
      this.ctx.fillRect(btnX - btnW * 0.5, hitY - btnH * 0.5, btnW, btnH);
    }

    // ---------------------------------------------------------------------
    // 5. 노트 낙하 렌더링 & 판정선 타격 처리
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
      if (note.lane >= 9) curNoteColor = colorOther;
      else if (note.lane >= 6) curNoteColor = colorVocals;
      else if (note.lane >= 3) curNoteColor = colorBass;

      const fillRGBA = `rgba(${curNoteColor}, ${Math.min(1.0, p * 2.0)})`;

      this.ctx.shadowColor = `rgb(${curNoteColor})`;
      this.ctx.shadowBlur = 8 * p;

      this.drawNoteShape(this.ctx, note.shapeType, noteX, curY, noteW, noteH, fillRGBA);
      this.ctx.shadowBlur = 0;

      // 🎯 정확히 1.0초 지연 소리와 맞물려 하단 판정선을 때리는 순간
      if (p >= 1.0) {
        const hitX = curStartX + (note.lane + 0.5) * curLaneW;
        this.spawnHitParticles(hitX, hitY, curNoteColor, 8);
        this.spawnHitEffect(hitX, hitY, curNoteColor);

        this.notes.splice(i, 1);
      }
    }

    // ---------------------------------------------------------------------
    // 6. 타격 충격파 & 스파크 렌더링
    // ---------------------------------------------------------------------
    for (let i = this.hitEffects.length - 1; i >= 0; i--) {
      const fx = this.hitEffects[i];
      fx.radius += 2.5;
      fx.alpha -= 0.06;

      if (fx.alpha <= 0 || fx.radius >= fx.maxRadius) {
        this.hitEffects.splice(i, 1);
        continue;
      }

      this.ctx.strokeStyle = `rgba(${fx.color}, ${fx.alpha})`;
      this.ctx.lineWidth = 3;
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
      particleCount: `Dynamic Sync Highway (Notes:${this.notes.length})`,
      isCovering: true,
      activeFunction: `PumpHighwayDynamicSync[12Lanes_${colorStyle.toUpperCase()}]`
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
  }
}
