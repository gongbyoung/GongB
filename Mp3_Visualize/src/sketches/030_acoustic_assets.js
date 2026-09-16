/**
 * src/sketches/030_acoustic_assets.js
 * - [030호 홀로그램 스테이지 엔진 Ver 5.0 - 유기적(Organic) 설계]
 * - 구도를 중앙으로 이동, 스트링(선) 교차 및 뒤섞임 효과 적용
 * - 연기(Smoke) 디졸브 및 유체역학적 상승 효과 적용
 * - 우측 패널 UI (Shuffle, Range, Scale, Volume, Gauge) 100% 연동
 */

export default class HolographicStageSketch {
  constructor(container) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    if (this.container) {
      this.container.appendChild(this.canvas);
    }

    this.time = 0;
    this.version = "030호 유기적 홀로그램 Ver 5.0";
    
    this.smokeParticles = [];
    this.drumShapes = [];
    
    this.smokeTexture = this.createSmokeTexture();
    this.lastDrums = 0;
    
    this.init();
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

  // ☁️ 사실적인 연기 텍스처 (중심은 진하고 가장자리는 매우 부드럽게 퍼짐)
  createSmokeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.3)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return canvas;
  }

  // 🥁 기하학 도형 스폰
  spawnDrumShape(x, y, intensity, spreadRange, scaleMulti, speedMulti, isAmbient = false) {
    const types = ['triangle', 'ring', 'circle'];
    const colors = ['#ff2a6d', '#05d9e8', '#ff7a00', '#d1f7ff', '#b537f2'];
    
    const count = isAmbient ? 1 : Math.floor(intensity * 4) + 1; 
    
    for (let i = 0; i < count; i++) {
      this.drumShapes.push({
        type: types[Math.floor(Math.random() * types.length)],
        // Range 슬라이더에 따라 좌우 퍼짐 정도가 다름
        x: x + (Math.random() * spreadRange - spreadRange / 2),
        y: y,
        vx: (Math.random() - 0.5) * 6 * speedMulti,
        vy: isAmbient ? -(Math.random() * 2 + 1) * speedMulti : -(Math.random() * 8 + 4) * intensity * speedMulti,
        size: (Math.random() * 15 + 8) * scaleMulti,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.0,
        decay: 0.015 + Math.random() * 0.015,
        angle: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2
      });
    }
  }

  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const W = this.canvas.width;
    const H = this.canvas.height;
    const settings = window.cosmicEngineSettings || {};
    
    // 🎛️ 오디오 데이터 매핑
    const targetAudio = (audioData && audioData.vol !== undefined) ? audioData : (window.latestCompiledAudioData || {});
    const gaugeVal = settings.gaugeValue ?? 0.5; 
    
    // Gauge 슬라이더 값에 비례하여 소리 반응 증폭
    const vocals = (targetAudio.vocalsVol !== undefined ? targetAudio.vocalsVol : (targetAudio.mid || 0)) * gaugeVal * 2.5;
    const drums  = (targetAudio.drumsVol  !== undefined ? targetAudio.drumsVol  : (targetAudio.bass || 0)) * gaugeVal * 2.5;
    const strings= (targetAudio.otherVol  !== undefined ? targetAudio.otherVol  : (targetAudio.treble || 0)) * gaugeVal * 2.5;
    const vol = targetAudio.vol || 0;

    // 🎛️ 관제탑 UI 값 변수화
    const seedVal = settings.seed ?? 42;                             // Shuffle: 선 꼬임/파장 뒤섞기
    const scatterVal = settings.scatterExponent ?? 2.2;              // Range: 영역 넓이
    const glowVal = settings.glowIntensity ?? 0.85;                  // Scale: 크기
    const gainVal = settings.audioGain ?? 1.0;                       // Volume: 속도

    // 시간의 흐름 (Volume 속도에 비례)
    this.time += (0.01 + (strings * 0.02)) * gainVal;

    // 📐 레터박스 엔진
    let exportRatio = settings.exportRatio || 'full';
    let renderW = W, renderH = H, renderX = 0, renderY = 0;
    if (exportRatio === '16:9') {
      renderH = W * (9/16);
      if (renderH > H) { renderH = H; renderW = H * (16/9); }
      renderX = (W - renderW)/2; renderY = (H - renderH)/2;
    } else if (exportRatio === '9:16') {
      renderW = H * (9/16);
      if (renderW > W) { renderW = W; renderH = W * (16/9); }
      renderX = (W - renderW)/2; renderY = (H - renderH)/2;
    }

    this.ctx.save();
    this.ctx.fillStyle = "#020204"; 
    this.ctx.fillRect(0, 0, W, H);
    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    // 💡 구도 변경: 화면의 55% 지점 (중앙보다 아주 살짝 아래)으로 모든 중심 이동
    const centerX = renderX + renderW / 2;
    const centerY = renderY + renderH * 0.55; 
    
    // Range(Scatter)에 따른 가로 폭 계산
    const spreadRange = renderW * 0.3 * scatterVal; 

    // ==========================================
    // 1. 🎻 STRING 파트 : 뒤섞이는 빛의 물결
    // ==========================================
    const lineColors = ['#00ffcc', '#ff0055', '#4d4dff', '#ffaa00', '#cc00ff'];
    this.ctx.globalCompositeOperation = 'screen';
    
    for (let i = 0; i < 5; i++) {
      this.ctx.beginPath();
      this.ctx.lineWidth = 1.5 + (strings * 3);
      this.ctx.strokeStyle = lineColors[i % lineColors.length];
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = this.ctx.strokeStyle;
      this.ctx.globalAlpha = 0.3 + (strings * 0.7);

      // 💡 [선 뒤섞임 1]: 각 선의 중심축(yBase)이 제자리에 있지 않고 시간에 따라 위아래로 유영함
      // Shuffle(seedVal)값을 더해 선들이 서로 다르게 꼬이도록 유도
      const driftY = Math.sin(this.time * 0.5 + i * (seedVal * 0.1)) * (40 * scatterVal);
      const yBase = centerY + driftY;
      
      this.ctx.moveTo(renderX, yBase);
      for (let x = renderX; x <= renderX + renderW; x += 20) {
        // 💡 [선 뒤섞임 2]: 파장 빈도와 진폭도 셔플값에 영향을 받아 불규칙적으로 일렁임
        const freq = 0.005 + (i * 0.002) * (seedVal * 0.05);
        const amp = 10 + (strings * 80) + Math.sin(this.time * 1.5 + i + x * 0.01) * (20 * scatterVal);
        const waveY = Math.sin(x * freq + this.time * (2 + i*0.3)) * amp;
        
        // 좁은 공간에서 선명하게 보이기 위해 Y 진폭 제한
        this.ctx.lineTo(x, yBase + waveY);
      }
      this.ctx.stroke();
    }
    this.ctx.shadowBlur = 0;

    // ==========================================
    // 2. 🎤 VOCAL 파트 : 부피가 줄어들며 흩날리는 연기
    // ==========================================
    if (vocals > 0.1 || Math.random() < 0.15) {
      const isAmbient = vocals <= 0.1;
      this.smokeParticles.push({
        // Range 슬라이더로 연기가 좌우로 퍼지는 범위 조절
        x: centerX + (Math.random() * spreadRange - spreadRange / 2),
        y: centerY + 20,
        // 위로 올라가면서 좌우로 흔들리는(drift) 기본값
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: Math.random() * 0.05 + 0.02,
        
        vy: isAmbient ? -(Math.random() * 1.5 + 0.5) * gainVal : -(Math.random() * 3 + 1.5) * vocals * gainVal,
        
        // Scale 슬라이더로 기본 연기 덩치 조절 (다양한 크기로 생성)
        size: (Math.random() * 50 + 20) * glowVal,
        
        life: 1.0,
        decay: 0.004 + Math.random() * 0.006,
        hue: 240 + Math.random() * 120 // 푸른색 ~ 보라색 ~ 핑크색 톤
      });
    }

    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      let p = this.smokeParticles[i];
      
      // 💡 [연기 효과]: 위로 올라갈수록 좌우로 살랑살랑 흔들림
      p.x += Math.sin(this.time * 5 + p.driftPhase) * 1.5;
      p.y += p.vy;
      
      // 💡 [연기 효과]: 위로 올라갈수록 크기가 서서히 작아짐 (디졸브 효과)
      p.size *= 0.985; 
      
      p.life -= p.decay;

      if (p.life <= 0 || p.size < 5) {
        this.smokeParticles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      
      // 서서히 페이드아웃 되며, 보컬이 강할 때 투명도가 진해짐
      this.ctx.globalAlpha = p.life * (0.4 + vocals * 0.6);
      this.ctx.globalCompositeOperation = 'screen';
      
      // 연기 틴팅
      this.ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.life})`;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      this.ctx.fill();

      // 연기 텍스처 입히기 (부드러운 그라데이션)
      this.ctx.drawImage(this.smokeTexture, -p.size, -p.size, p.size * 2, p.size * 2);
      this.ctx.restore();
    }

    // ==========================================
    // 3. 🥁 DRUM 파트 : 기하학 도형 (Shapes)
    // ==========================================
    this.ctx.globalCompositeOperation = 'source-over';
    
    // 중앙 발광 패드 (소리의 근원지)
    this.ctx.globalCompositeOperation = 'screen';
    const floorGrad = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, renderW * 0.3 * glowVal);
    floorGrad.addColorStop(0, `rgba(100, 150, 255, ${0.1 + drums * 0.4})`);
    floorGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = floorGrad;
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY, spreadRange * 0.8, 30 * glowVal, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalCompositeOperation = 'source-over';

    if (drums > 0.25 && drums > this.lastDrums + 0.02) {
      this.spawnDrumShape(centerX, centerY, drums, spreadRange, glowVal, gainVal, false);
    } else if (Math.random() < 0.05) {
      this.spawnDrumShape(centerX, centerY, 0.2, spreadRange, glowVal, gainVal, true);
    }
    this.lastDrums = drums;

    for (let i = this.drumShapes.length - 1; i >= 0; i--) {
      let s = this.drumShapes[i];
      
      s.vy += 0.3 * gainVal; // 중력 적용 (속도 슬라이더 연동)
      s.x += s.vx;
      s.y += s.vy;
      s.angle += s.rotSpeed;
      s.life -= s.decay;

      // 중앙선(centerY) 주변을 보이지 않는 바닥으로 삼아 튕김
      const bounceY = centerY + 10;
      if (s.y > bounceY) {
        s.y = bounceY;
        s.vy *= -0.6;
        s.vx *= 0.8; 
      }

      if (s.life <= 0) {
        this.drumShapes.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(s.x, s.y);
      this.ctx.rotate(s.angle);
      this.ctx.globalAlpha = s.life;
      
      this.ctx.shadowBlur = 10 * glowVal;
      this.ctx.shadowColor = s.color;

      if (s.type === 'triangle') {
        this.ctx.strokeStyle = s.color;
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -s.size);
        this.ctx.lineTo(s.size * 0.866, s.size * 0.5);
        this.ctx.lineTo(-s.size * 0.866, s.size * 0.5);
        this.ctx.closePath();
        this.ctx.stroke();
      } else if (s.type === 'ring') {
        this.ctx.strokeStyle = s.color;
        this.ctx.lineWidth = 3.5;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, s.size, 0, Math.PI * 2);
        this.ctx.stroke();
      } else {
        this.ctx.fillStyle = s.color;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, s.size * 0.7, 0, Math.PI * 2);
        this.ctx.fill();
      }
      
      this.ctx.restore();
    }

    // ==========================================
    // 4. ✍️ 자막 (중앙 상단에 우아하게 배치)
    // ==========================================
    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "";
    
    if (subtitleText && settings.showSubtitle !== false) {
      this.ctx.globalAlpha = 1.0;
      this.ctx.globalCompositeOperation = 'source-over';
      const baseFontSize = Math.max(26, Math.min(48, renderW * 0.055));
      const fontSize = baseFontSize * (1.0 + (vol * 0.05)); 
      
      const rawFont = settings.fontFamily || "Noto Sans KR";
      const cleanFontName = rawFont.replace(/['"]/g, ''); 
      
      this.ctx.font = `bold ${fontSize}px "${cleanFontName}", sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const lines = subtitleText.split('\n');
      const lineHeight = fontSize * 1.35;

      // 💡 자막 위치를 중앙(centerY)보다 약간 위로 올려서 스트링/연기와 균형을 맞춤
      const textCenterY = centerY - (renderH * 0.2);

      lines.forEach((line, idx) => {
        const lineY = textCenterY + (idx - (lines.length - 1) / 2) * lineHeight;

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        [-2, 2].forEach(ox => {
          [-2, 2].forEach(oy => {
            this.ctx.fillText(line, centerX + ox, lineY + oy);
          });
        });

        this.ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        this.ctx.shadowBlur = 15;
        this.ctx.fillStyle = "#ffffff"; 
        this.ctx.fillText(line, centerX, lineY);
        this.ctx.shadowBlur = 0;
      });
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Smoke:${this.smokeParticles.length} | Shapes:${this.drumShapes.length}`,
      isCovering: true,
      activeFunction: `OrganicHolo[UI-Synced]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.smokeParticles = [];
    this.drumShapes = [];
  }
}
