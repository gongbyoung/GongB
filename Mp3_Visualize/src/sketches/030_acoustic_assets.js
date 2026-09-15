/**
 * src/sketches/030_acoustic_assets.js
 * - [030호 어쿠스틱 에셋 파티클 & 공명 엔진]
 * - 직접 모델링한 PNG 에셋(assets/models/)을 100% 활용하는 2D 스프라이트 렌더러
 * - 현악기(Bass): 배경에서 은은하게 회전하며 공명 + 베지어 곡선 현(String) 진동
 * - 피아노(Mid): 타격 시 화면 중앙에서 특정 타겟 좌표를 향해 날아가는 건반/피아노 에셋
 * - 기타/음표(Treble): 고음역대에서 흩날리는 음악 기호 에셋들
 */

export default class AcousticAssetsSketch {
  constructor(container) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    if (this.container) {
      this.container.appendChild(this.canvas);
    }

    this.time = 0;
    this.version = "030호 어쿠스틱 에셋 파티클 엔진 Ver 1.0";
    
    this.particles = [];
    this.bgInstruments = [];
    this.loadedImages = { strings: [], pianos: [], notes: [] };

    this.initAssets();
  }

  init() {
    this.resize();
  }

  // 📂 모델링하신 PNG 파일들을 카테고리별로 자동 로드
  initAssets() {
    const basePath = 'assets/models/';
    
    const stringFiles = ['VIOLIN001.png', 'GUITAR002.png', 'GUITAR003.png', 'GUITAR004.png'];
    const pianoFiles = ['PIANO001.png', 'PIANO002.png', 'KEYBOARD001.png', 'KEYBOARD002.png'];
    const noteFiles = ['MUSIC14_001.png', 'MUSIC14_002.png', 'MUSIC14_003.png', 'MUSIC18_001.png', 'HIGHMUSIC_001.png'];

    const loadImg = (filename, category) => {
      const img = new Image();
      img.src = basePath + filename;
      img.onload = () => this.loadedImages[category].push(img);
    };

    stringFiles.forEach(f => loadImg(f, 'strings'));
    pianoFiles.forEach(f => loadImg(f, 'pianos'));
    noteFiles.forEach(f => loadImg(f, 'notes'));

    // 배경에서 천천히 회전할 현악기(첼로/바이올린/기타) 세팅
    for(let i=0; i<3; i++) {
      this.bgInstruments.push({
        angle: Math.random() * Math.PI * 2,
        speed: (Math.random() < 0.5 ? 1 : -1) * (0.002 + Math.random() * 0.005),
        scale: 0.5 + Math.random() * 0.5,
        offset: Math.random() * Math.PI * 2
      });
    }
  }

  resize(w, h) {
    this.width = w || (this.container ? this.container.clientWidth : 800) || 800;
    this.height = h || (this.container ? this.container.clientHeight : 600) || 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  // 🎯 파티클 발사 함수: 지정된 타겟(tx, ty)을 향해 에셋이 날아감
  spawnParticle(category, W, H, speedMult) {
    const assets = this.loadedImages[category];
    if (assets.length === 0) return;

    const img = assets[Math.floor(Math.random() * assets.length)];
    
    // 화면 하단 중앙에서 스폰
    const startX = W / 2 + (Math.random() * 200 - 100);
    const startY = H + 50;

    // 타겟은 오선지 느낌으로 캔버스 상단 곡선 궤도 내에 지정
    const targetX = W * 0.1 + Math.random() * (W * 0.8);
    const targetY = H * 0.1 + Math.random() * (H * 0.5);

    this.particles.push({
      img: img,
      x: startX, y: startY,
      tx: targetX, ty: targetY,
      life: 1.0,
      decay: 0.01 + Math.random() * 0.015,
      scale: (Math.random() * 0.4 + 0.3) * (category === 'pianos' ? 1.5 : 1.0),
      angle: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.05,
      speed: (0.04 + Math.random() * 0.04) * speedMult
    });
  }

  update(audioData) {
    if (!this.ctx || !this.canvas) return;

    const W = this.canvas.width;
    const H = this.canvas.height;
    const settings = window.cosmicEngineSettings || {};
    
    const bass = audioData && audioData.bass ? audioData.bass : 0;
    const mid = audioData && audioData.mid ? audioData.mid : 0;
    const treble = audioData && audioData.treble ? audioData.treble : 0;
    
    const glowVal = settings.glowIntensity ?? 0.85;
    const gainVal = settings.audioGain ?? 1.0;
    const gaugeVal = settings.gaugeValue ?? 0.5; 

    this.time += 0.01 + (bass * 0.02 * gainVal);

    // 📐 16:9 / 9:16 레터박스 엔진
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
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, W, H);
    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    const centerX = renderX + renderW / 2;
    const centerY = renderY + renderH / 2;

    // 1. 따뜻한 어쿠스틱 나무 질감의 배경 그라데이션
    const bgGrad = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, renderW * 0.8);
    bgGrad.addColorStop(0, '#1a100c'); // 다크 브라운 마호가니톤
    bgGrad.addColorStop(1, '#050302');
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(renderX, renderY, renderW, renderH);

    // 2. 🎻 배경 현악기(Strings) 공명 렌더링 (Bass에 반응)
    if (this.loadedImages.strings.length > 0) {
      this.bgInstruments.forEach((bgInst, idx) => {
        bgInst.angle += bgInst.speed * (1 + bass * 2.0); // 베이스가 울리면 회전 속도 증가
        const img = this.loadedImages.strings[idx % this.loadedImages.strings.length];
        
        // 공명하는 듯한 심장박동 스케일링
        const pulse = Math.sin(this.time * 2 + bgInst.offset) * 0.05 + (bass * 0.2 * gaugeVal);
        const finalScale = (bgInst.scale + pulse) * glowVal;

        this.ctx.save();
        this.ctx.translate(centerX, centerY);
        this.ctx.rotate(bgInst.angle);
        
        // 은은하게 배경에 스며들도록 블렌딩 및 투명도 조절
        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.globalAlpha = 0.15 + (bass * 0.3 * gaugeVal);
        
        const w = img.width * finalScale;
        const h = img.height * finalScale;
        this.ctx.drawImage(img, -w/2, -h/2, w, h);
        this.ctx.restore();
      });
    }

    // 3. 〰️ 베지어 곡선 현(Acoustic Strings) 그리기
    this.ctx.lineWidth = 2 + bass * 5;
    this.ctx.strokeStyle = `rgba(255, 215, 0, ${0.3 + bass * 0.5})`; // 황금빛 현
    this.ctx.shadowBlur = 10 + bass * 20;
    this.ctx.shadowColor = '#d4af37';

    for(let i=0; i<5; i++) {
      this.ctx.beginPath();
      const yOffset = renderY + (renderH * 0.2) + (i * (renderH * 0.15));
      const wave = Math.sin(this.time * 5 + i) * (20 + bass * 150 * gaugeVal); // 줄이 튕겨지는 효과
      
      this.ctx.moveTo(renderX, yOffset);
      this.ctx.quadraticCurveTo(centerX, yOffset + wave, renderX + renderW, yOffset);
      this.ctx.stroke();
    }
    this.ctx.shadowBlur = 0;

    // 4. 🎹 피아노 & 🎶 음표 파티클 스폰 로직 (Mid, Treble에 반응)
    // 피아노 타격음(Mid)이 임계치를 넘으면 피아노 건반 에셋 발사
    if (mid > 0.4 && Math.random() < 0.2) {
      this.spawnParticle('pianos', renderW, renderH, gainVal);
    }
    // 고음역(Treble)이 임계치를 넘으면 음표 에셋 발사
    if (treble > 0.3 && Math.random() < 0.4) {
      this.spawnParticle('notes', renderW, renderH, gainVal);
    }

    // 5. 파티클 물리 이동 및 드로잉
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      
      // 타겟(tx, ty)을 향해 부드럽게 감속하며 날아감 (Easing)
      p.x += (p.tx - p.x) * p.speed;
      p.y += (p.ty - p.y) * p.speed;
      p.angle += p.rotSpeed;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(renderX + p.x, renderY + p.y);
      this.ctx.rotate(p.angle);
      
      // 나타날 땐 선명하게, 사라질 땐 서서히 페이드아웃
      this.ctx.globalAlpha = p.life > 0.5 ? 1.0 : p.life * 2;
      
      const w = p.img.width * p.scale * glowVal;
      const h = p.img.height * p.scale * glowVal;
      
      // 피아노 건반이나 음표에서 은은한 빛이 나도록 쉐도우 처리
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
      
      this.ctx.drawImage(p.img, -w/2, -h/2, w, h);
      this.ctx.restore();
    }

    // 6. 최상단 SRT 캘리그래피 자막 렌더링
    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "";
    if (subtitleText) {
      this.ctx.globalAlpha = 1.0;
      const baseFontSize = Math.max(28, Math.min(52, renderW * 0.065));
      const fontSize = baseFontSize * (1.0 + (mid * 0.05 * gaugeVal));
      
      const rawFont = window.cosmicEngineSettings?.fontFamily || "Noto Sans KR";
      const cleanFontName = rawFont.replace(/['"]/g, ''); 
      
      this.ctx.font = `bold ${fontSize}px "${cleanFontName}", sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const lines = subtitleText.split('\n');
      const lineHeight = fontSize * 1.35;

      lines.forEach((line, idx) => {
        const lineY = centerY + (idx - (lines.length - 1) / 2) * lineHeight;

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        [-2, 2].forEach(ox => {
          [-2, 2].forEach(oy => {
            this.ctx.fillText(line, centerX + ox, lineY + oy);
          });
        });

        this.ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
        this.ctx.shadowBlur = 18;
        this.ctx.fillStyle = "#faf6ed"; // 서정적인 한지 미색 폰트
        this.ctx.fillText(line, centerX, lineY);
        this.ctx.shadowBlur = 0;
      });
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Assets: ${this.particles.length}`,
      isCovering: true,
      activeFunction: `AcousticEngine[Ratio:${exportRatio}]`
    };
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
  }
}
