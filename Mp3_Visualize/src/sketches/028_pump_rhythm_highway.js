/**
 * src/sketches/028_pump_rhythm_highway.js
 * - [028호 펌프 리듬 하이웨이 Ver 2.0 - 4-Stem 12-Lane Precision Engine]
 * - 🎮 12개 레인: 4개 스템(Drums, Bass, Vocals, Other) x 3개 서브 대역 정밀 매핑
 * - 🎨 스템별 전용 고대비 노트 색상 (Red/Cyan/Gold/Purple) 및 그룹 헤더 표시
 * - 📐 16:9(가로) & 9:16(세로) Export 비율 자동 뷰포트 레터박스 완전 대응
 * - ⚡ 오디오 스템별 노트 낙하 & 하단 판정선(Hit Line) 스파크 폭발 연출
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
    this.version = "028호 펌프 리듬 하이웨이 Ver 2.0 (4-Stem 12-Lanes)";
    
    this.laneCount = 12; // 4-Stem x 3-Lanes
    this.notes = [];
    this.particles = [];
    this.hitEffects = [];
    this.laneCooldowns = new Array(12).fill(0);
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

  spawnHitParticles(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 2 + Math.random() * 4,
        color: color,
        life: 1.0
      });
    }
  }

  spawnHitEffect(x, y, color) {
    this.hitEffects.push({
      x: x, y: y,
      radius: 10,
      maxRadius: 35,
      color: color,
      alpha: 1.0
    });
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

    // Export 비율 파악 ('full', '16:9', '9:16')
    const exportRatio = (globalSettings.exportRatio || globalSettings.exportSetting || globalSettings.aspectRatio || 'full').toLowerCase();

    // 관제탑 슬라이더 연동
    const rawScatter = globalSettings.scatterExponent ?? globalSettings.scatter ?? globalSettings.range ?? 25;
    const noteSpeed = (0.012 + (rawScatter / 50.0) * 0.025); // 노트 낙하 속도

    const rawGlow = globalSettings.glowScale ?? globalSettings.glow ?? globalSettings.scale ?? 50;
    const scaleFactor = Math.max(0.3, Math.min(3.0, rawGlow / 40.0));

    // 4-Stem 개별 음압 수신
    const vocalsVol = (targetAudio.vocalsVol ?? targetAudio.mid ?? 0) * gainVal;
    const drumsVol  = (targetAudio.drumsVol  ?? targetAudio.bass ?? 0) * gainVal;
    const bassVol   = (targetAudio.bassVol   ?? targetAudio.bass ?? 0) * gainVal;
    const otherVol  = (targetAudio.otherVol  ?? targetAudio.treble ?? 0) * gainVal;

    // 스펙트럼 데이터 수신
    const spectrum = targetAudio.bassSpectrum || targetAudio.spectrum || targetAudio.frequencyData || new Float32Array(64);

    this.time += 0.016;

    const W = this.canvas.width;
    const H = this.canvas.height;

    // 💡 [16:9 가로 / 9:16 세로 대응]: 뷰포트 레터박스 영점 계산
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

    // 캔버스 바탕
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, W, H);

    // 선택 비율 영역 클리핑
    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    // 스템별 고해상도 색상 팔레트
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

    const topTrackW = renderW * 0.14;    // 상단 트랙 폭
    const bottomTrackW = renderW * 0.88; // 하단 트랙 폭

    // ---------------------------------------------------------------------
    // 1. 4-Stem x 3-Lanes = 12개 레인 에너지 산출 & 노트 생성
    // ---------------------------------------------------------------------
    const laneEnergies = new Float32Array(12);

    // 스템별 3개 서브 대역 분할 연산
    // Drums (Lane 0~2)
    laneEnergies[0] = Math.max(drumsVol * 1.5, this.getBandAverage(spectrum, 0, 2) * 3.5 * gainVal);
    laneEnergies[1] = Math.max(drumsVol * 1.2, this.getBandAverage(spectrum, 3, 6) * 3.0 * gainVal);
    laneEnergies[2] = Math.max(drumsVol * 1.0, this.getBandAverage(spectrum, 7, 12) * 3.0 * gainVal);

    // Bass (Lane 3~5)
    laneEnergies[3] = Math.max(bassVol * 1.5, this.getBandAverage(spectrum, 0, 3) * 3.5 * gainVal);
    laneEnergies[4] = Math.max(bassVol * 1.3, this.getBandAverage(spectrum, 4, 8) * 3.0 * gainVal);
    laneEnergies[5] = Math.max(bassVol * 1.0, this.getBandAverage(spectrum, 9, 15) * 3.0 * gainVal);

    // Vocals (Lane 6~8)
    laneEnergies[6] = Math.max(vocalsVol * 1.2, this.getBandAverage(spectrum, 12, 18) * 3.0 * gainVal);
    laneEnergies[7] = Math.max(vocalsVol * 1.5, this.getBandAverage(spectrum, 19, 28) * 3.5 * gainVal);
    laneEnergies[8] = Math.max(vocalsVol * 1.2, this.getBandAverage(spectrum, 29, 40) * 3.0 * gainVal);

    // Other (Lane 9~11)
    laneEnergies[9]  = Math.max(otherVol * 1.2, this.getBandAverage(spectrum, 15, 24) * 3.0 * gainVal);
    laneEnergies[10] = Math.max(otherVol * 1.5, this.getBandAverage(spectrum, 25, 38) * 3.5 * gainVal);
    laneEnergies[11] = Math.max(otherVol * 1.2, this.getBandAverage(spectrum, 39, 55) * 3.0 * gainVal);

    // 노트 생성 검사
    for (let l = 0; l < this.laneCount; l++) {
      if (this.laneCooldowns[l] > 0) {
        this.laneCooldowns[l]--;
      }

      if (laneEnergies[l] > 0.12 && this.laneCooldowns[l] <= 0) {
        this.notes.push({
          lane: l,
          progress: 0.0,
          energy: laneEnergies[l]
        });
        this.laneCooldowns[l] = 6 + Math.floor(Math.random() * 4);
      }
    }

    // ---------------------------------------------------------------------
    // 2. 3D 원근 트랙 & 4-Stem 그룹 가이드선 렌더링
    // ---------------------------------------------------------------------
    this.ctx.lineWidth = 1.2;

    for (let i = 0; i <= this.laneCount; i++) {
      const norm = i / this.laneCount;
      const topX = centerX - (topTrackW * 0.5) + norm * topTrackW;
      const bottomX = centerX - (bottomTrackW * 0.5) + norm * bottomTrackW;

      // 4-Stem 경계선(0, 3, 6, 9, 12)은 더 두껍게 표시
      const isGroupBorder = i % 3 === 0;
      this.ctx.strokeStyle = isGroupBorder ? `rgba(255, 255, 255, 0.45)` : `rgba(255, 255, 255, 0.12)`;
      this.ctx.lineWidth = isGroupBorder ? 2.5 : 1.0;

      this.ctx.beginPath();
      this.ctx.moveTo(topX, vanishY);
      this.ctx.lineTo(bottomX, renderY + renderH);
      this.ctx.stroke();
    }

    // 수평 마디선
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
    // 3. 4-Stem 스템명 표시 (DRUMS, BASS, VOCAL, OTHER)
    // ---------------------------------------------------------------------
    const labelY = vanishY - 8;
    const stemLabels = [
      { text: "DRUM", color: colorDrums, centerIdx: 1 },
      { text: "BASS", color: colorBass, centerIdx: 4 },
      { text: "VOCAL", color: colorVocals, centerIdx: 7 },
      { text: "OTHER", color: colorOther, centerIdx: 10 }
    ];

    this.ctx.font = `900 ${Math.max(9, renderW * 0.012)}px sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';

    stemLabels.forEach(label => {
      const norm = (label.centerIdx + 0.5) / this.laneCount;
      const lx = centerX - (topTrackW * 0.5) + norm * topTrackW;
      this.ctx.fillStyle = `rgba(${label.color}, 0.85)`;
      this.ctx.fillText(label.text, lx, labelY);
    });

    // ---------------------------------------------------------------------
    // 4. 하단 네온 판정선 (Hit Line) & 12개 페달 버튼
    // ---------------------------------------------------------------------
    const hitTrackW = topTrackW + 0.84 * (bottomTrackW - topTrackW);
    const hitStartX = centerX - hitTrackW * 0.5;

    this.ctx.shadowColor = `rgb(${colorBass})`;
    this.ctx.shadowBlur = 12;
    this.ctx.strokeStyle = `rgba(255, 255, 255, 0.9)`;
    this.ctx.lineWidth = 4;

    this.ctx.beginPath();
    this.ctx.moveTo(hitStartX, hitY);
    this.ctx.lineTo(centerX + hitTrackW * 0.5, hitY);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    const laneW = hitTrackW / this.laneCount;

    for (let l = 0; l < this.laneCount; l++) {
      const btnX = hitStartX + (l + 0.5) * laneW;
      const btnW = laneW * 0.75 * scaleFactor;
      const btnH = 10 * scaleFactor;

      let laneColor = colorDrums;
      if (l >= 9) laneColor = colorOther;
      else if (l >= 6) laneColor = colorVocals;
      else if (l >= 3) laneColor = colorBass;

      const isCooling = this.laneCooldowns[l] > 0;
      this.ctx.fillStyle = isCooling ? `rgba(${laneColor}, 0.95)` : `rgba(${laneColor}, 0.3)`;
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
      const noteH = (7 + p * 16) * scaleFactor;

      // 스템별 지정 색상 가져오기
      let curNoteColor = colorDrums;
      if (note.lane >= 9) curNoteColor = colorOther;
      else if (note.lane >= 6) curNoteColor = colorVocals;
      else if (note.lane >= 3) curNoteColor = colorBass;

      this.ctx.fillStyle = `rgba(${curNoteColor}, ${Math.min(1.0, p * 2.0)})`;
      this.ctx.shadowColor = `rgb(${curNoteColor})`;
      this.ctx.shadowBlur = 8 * p;

      this.ctx.fillRect(noteX - noteW * 0.5, curY - noteH * 0.5, noteW, noteH);
      this.ctx.shadowBlur = 0;

      // 🎯 판정선 타격 이벤트
      if (p >= 1.0) {
        const hitX = curStartX + (note.lane + 0.5) * curLaneW;
        this.spawnHitParticles(hitX, hitY, curNoteColor, 8);
        this.spawnHitEffect(hitX, hitY, curNoteColor);

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
      particleCount: `4-Stem 12-Lane Highway (Notes:${this.notes.length} / Sparks:${this.particles.length})`,
      isCovering: true,
      activeFunction: `PumpHighway4Stem[12Lanes_${colorStyle.toUpperCase()}]`
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
