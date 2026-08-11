/**
 * src/sketches/028_pump_rhythm_highway.js
 * - [028호 펌프 리듬 하이웨이 Ver 4.0 - True Onset Pitch & Hold Note Engine]
 * - 🎯 롱노트(Hold Note) 이식: 베이스/보컬의 길게 늘어지는 음을 3D 리본 테일로 연속 연출
 * - ⚡ 트랜지언트 피크(Onset) 감지: 로봇 같은 단순 연속 발사를 금지하고 진짜 연주 타격 시에만 노트 출격
 * - 🎵 12-Lane 피치 매핑: 악기별 3개 음역대 Pitch 변화 실시간 반응
 * - 🎛️ Gauge 슬라이더: 상단 트랙 원근 폭 실시간 조절
 * - 🔀 Shuffle (Seed): 노트 쉐이프 무작위화
 * - 🎨 Color Style Palette 테마 연동
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
    this.version = "028호 펌프 리듬 하이웨이 Ver 4.0 (Hold Notes)";
    
    this.laneCount = 12; // 4-Stem x 3-Lanes
    this.notes = [];
    this.particles = [];
    this.hitEffects = [];
    
    // 이전 프레임 음압 기록 (트랜지언트 온셋 감지용)
    this.prevEnergies = new Float32Array(12);
    this.activeHoldNotes = new Array(12).fill(null);
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

  spawnHitParticles(x, y, color, count = 4) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
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
      maxRadius: 30,
      color: color,
      alpha: 1.0
    });
  }

  // 🖌️ 숏노트 헤더 쉐이프 렌더링 도우미
  drawNoteHeader(ctx, shapeType, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();

    switch (shapeType) {
      case 1: // 라운드 사각
        ctx.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.3);
        ctx.fill();
        break;
      case 2: // 원형
        ctx.arc(x, y, Math.min(w, h) * 0.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 3: // 다이아몬드
        ctx.moveTo(x, y - h / 2);
        ctx.lineTo(x + w / 2, y);
        ctx.lineTo(x, y + h / 2);
        ctx.lineTo(x - w / 2, y);
        ctx.closePath();
        ctx.fill();
        break;
      case 4: // 별형
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
      case 5: // 삼각형
        ctx.moveTo(x, y - h / 2);
        ctx.lineTo(x + w / 2, y + h / 2);
        ctx.lineTo(x - w / 2, y + h / 2);
        ctx.closePath();
        ctx.fill();
        break;
      default: // 기본 직사각형
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

    const rawScatter = globalSettings.scatterExponent ?? globalSettings.scatter ?? globalSettings.range ?? 25;
    const noteSpeed = (0.010 + (rawScatter / 50.0) * 0.022); // 노트 낙하 속도

    const rawGlow = globalSettings.glowScale ?? globalSettings.glow ?? globalSettings.scale ?? 50;
    const scaleFactor = Math.max(0.3, Math.min(3.0, rawGlow / 40.0));

    // 4-Stem 개별 음압
    const vocalsVol = (targetAudio.vocalsVol ?? targetAudio.mid ?? 0) * gainVal;
    const drumsVol  = (targetAudio.drumsVol  ?? targetAudio.bass ?? 0) * gainVal;
    const bassVol   = (targetAudio.bassVol   ?? targetAudio.bass ?? 0) * gainVal;
    const otherVol  = (targetAudio.otherVol  ?? targetAudio.treble ?? 0) * gainVal;

    // 64채널 스펙트럼
    const spectrum = targetAudio.bassSpectrum || targetAudio.spectrum || targetAudio.frequencyData || new Float32Array(64);

    this.time += 0.016;

    const W = this.canvas.width;
    const H = this.canvas.height;

    // 뷰포트 레터박스 연산
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

    // 🎨 Color Style Palette
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

    // 배경 그라데이션
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
    // 1. 🎯 [핵심 수리 1]: 12개 레인 음압 & 트랜지언트 피크(Onset) 산출
    // ---------------------------------------------------------------------
    const curEnergies = new Float32Array(12);

    // Drums (Lane 0~2)
    curEnergies[0] = Math.max(drumsVol * 1.5, this.getBandAverage(spectrum, 0, 2) * 3.5 * gainVal);
    curEnergies[1] = Math.max(drumsVol * 1.2, this.getBandAverage(spectrum, 3, 6) * 3.0 * gainVal);
    curEnergies[2] = Math.max(drumsVol * 1.0, this.getBandAverage(spectrum, 7, 12) * 3.0 * gainVal);

    // Bass (Lane 3~5) - 롱노트 지원
    curEnergies[3] = Math.max(bassVol * 1.6, this.getBandAverage(spectrum, 0, 3) * 3.8 * gainVal);
    curEnergies[4] = Math.max(bassVol * 1.4, this.getBandAverage(spectrum, 4, 8) * 3.2 * gainVal);
    curEnergies[5] = Math.max(bassVol * 1.1, this.getBandAverage(spectrum, 9, 15) * 3.2 * gainVal);

    // Vocals (Lane 6~8) - 롱노트 지원
    curEnergies[6] = Math.max(vocalsVol * 1.2, this.getBandAverage(spectrum, 12, 18) * 3.0 * gainVal);
    curEnergies[7] = Math.max(vocalsVol * 1.5, this.getBandAverage(spectrum, 19, 28) * 3.5 * gainVal);
    curEnergies[8] = Math.max(vocalsVol * 1.2, this.getBandAverage(spectrum, 29, 40) * 3.0 * gainVal);

    // Other (Lane 9~11)
    curEnergies[9]  = Math.max(otherVol * 1.2, this.getBandAverage(spectrum, 15, 24) * 3.0 * gainVal);
    curEnergies[10] = Math.max(otherVol * 1.5, this.getBandAverage(spectrum, 25, 38) * 3.5 * gainVal);
    curEnergies[11] = Math.max(otherVol * 1.2, this.getBandAverage(spectrum, 39, 55) * 3.0 * gainVal);

    // 스템 그룹별 피크 검사 및 롱노트 연장 처리
    const stemGroups = [
      { lanes: [0, 1, 2], isHoldable: false }, // Drums (숏노트 위주)
      { lanes: [3, 4, 5], isHoldable: true },  // Bass (롱노트 지원)
      { lanes: [6, 7, 8], isHoldable: true },  // Vocals (롱노트 지원)
      { lanes: [9, 10, 11], isHoldable: true } // Other (롱노트 지원)
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

      for (let l of group.lanes) {
        const energy = curEnergies[l];
        const prevEnergy = this.prevEnergies[l];
        const isSpike = (energy - prevEnergy) > 0.08; // 음역 타격 순간 (Attack Spike)
        const isSustained = energy > 0.16;             // 음 지속 중

        const activeHold = this.activeHoldNotes[l];

        if (group.isHoldable && activeHold) {
          if (isSustained) {
            // 💡 [핵심]: 음이 지속되는 동안 롱노트의 꼬리(length)를 길게 연장!
            activeHold.length += noteSpeed;
          } else {
            // 음이 끊어지면 롱노트 생성 종결
            activeHold.isHolding = false;
            this.activeHoldNotes[l] = null;
          }
        } else if (l === winnerLane && isSpike && energy > 0.14) {
          // 💡 [신규 타격]: 새로운 노트 생성
          const newNote = {
            lane: l,
            progress: 0.0,
            length: 0.0, // 0.0이면 숏노트, 음 지속 시 롱노트로 증가
            isHolding: group.isHoldable,
            energy: energy,
            shapeType: this.getShapeForLane(l, seedVal)
          };

          this.notes.push(newNote);

          if (group.isHoldable) {
            this.activeHoldNotes[l] = newNote;
          }
        }

        this.prevEnergies[l] = energy;
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

    // 마디선
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
    // 3. 상단 4-Stem 라벨 렌더링
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
    // 4. 하단 네온 판정선 (Hit Line) & 12개 레인 페달
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

      const activeHold = this.activeHoldNotes[l];
      const isPressing = activeHold || curEnergies[l] > 0.16;

      this.ctx.fillStyle = isPressing ? `rgba(${laneColor}, 0.95)` : `rgba(${laneColor}, 0.25)`;
      this.ctx.fillRect(btnX - btnW * 0.5, hitY - btnH * 0.5, btnW, btnH);
    }

    // ---------------------------------------------------------------------
    // 5. 🎯 [핵심 수리 2]: 숏노트 & 3D 롱노트(Hold Ribbon) 낙하 렌더링
    // ---------------------------------------------------------------------
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      note.progress += noteSpeed;

      const pHead = note.progress;                    // 머리 위치 (0.0 ~ 1.0)
      const pTail = Math.max(0.0, pHead - note.length); // 꼬리 위치

      let curNoteColor = colorDrums;
      if (note.lane >= 9) curNoteColor = colorOther;
      else if (note.lane >= 6) curNoteColor = colorVocals;
      else if (note.lane >= 3) curNoteColor = colorBass;

      // 💡 [3D 롱노트 리본 렌더링]
      if (note.length > 0.02) {
        const yHead = vanishY + pHead * (hitY - vanishY);
        const yTail = vanishY + pTail * (hitY - vanishY);

        const trackW_Head = topTrackW + pHead * (bottomTrackW - topTrackW);
        const trackW_Tail = topTrackW + pTail * (bottomTrackW - topTrackW);

        const laneW_Head = trackW_Head / this.laneCount;
        const laneW_Tail = trackW_Tail / this.laneCount;

        const startX_Head = centerX - trackW_Head * 0.5;
        const startX_Tail = centerX - trackW_Tail * 0.5;

        const xHead = startX_Head + (note.lane + 0.5) * laneW_Head;
        const xTail = startX_Tail + (note.lane + 0.5) * laneW_Tail;

        const wHead = laneW_Head * 0.76 * scaleFactor;
        const wTail = laneW_Tail * 0.76 * scaleFactor;

        // 롱노트 몸통 (3D 사다리꼴 패스)
        this.ctx.fillStyle = `rgba(${curNoteColor}, 0.65)`;
        this.ctx.beginPath();
        this.ctx.moveTo(xTail - wTail * 0.5, yTail);
        this.ctx.lineTo(xTail + wTail * 0.5, yTail);
        this.ctx.lineTo(xHead + wHead * 0.5, yHead);
        this.ctx.lineTo(xHead - wHead * 0.5, yHead);
        this.ctx.closePath();
        this.ctx.fill();

        // 롱노트 외곽선 발광
        this.ctx.strokeStyle = `rgba(${curNoteColor}, 0.95)`;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }

      // 💡 [노트 머리 헤더 렌더링]
      if (pHead <= 1.0) {
        const curY = vanishY + pHead * (hitY - vanishY);
        const curTrackW = topTrackW + pHead * (bottomTrackW - topTrackW);
        const curLaneW = curTrackW / this.laneCount;
        const curStartX = centerX - curTrackW * 0.5;

        const noteX = curStartX + (note.lane + 0.5) * curLaneW;
        const noteW = curLaneW * 0.82 * scaleFactor;
        const noteH = (8 + pHead * 14) * scaleFactor;

        const fillRGBA = `rgba(${curNoteColor}, ${Math.min(1.0, pHead * 2.0)})`;

        this.ctx.shadowColor = `rgb(${curNoteColor})`;
        this.ctx.shadowBlur = 8 * pHead;

        this.drawNoteHeader(this.ctx, note.shapeType, noteX, curY, noteW, noteH, fillRGBA);
        this.ctx.shadowBlur = 0;
      }

      // 🎯 [판정선 지속 타격 연출]
      if (pHead >= 1.0) {
        const hitX = (centerX - (topTrackW + 0.84 * (bottomTrackW - topTrackW)) * 0.5) + (note.lane + 0.5) * laneW;
        
        // 롱노트가 지나가는 동안 타격 스파크 연속 방출
        if (Math.random() < 0.4) {
          this.spawnHitParticles(hitX, hitY, curNoteColor, 3);
          this.spawnHitEffect(hitX, hitY, curNoteColor);
        }
      }

      // 꼬리까지 완전히 판정선을 통과하면 노트 파기
      if (pTail >= 1.0) {
        this.notes.splice(i, 1);
      }
    }

    // ---------------------------------------------------------------------
    // 6. 타격 충격파 & 스파크 파티클 렌더링
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
      particleCount: `Hold Highway (Notes:${this.notes.length} / ActiveHolds:${this.activeHoldNotes.filter(h => h !== null).length})`,
      isCovering: true,
      activeFunction: `PumpHighwayHoldNotes[12Lanes_${colorStyle.toUpperCase()}]`
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
