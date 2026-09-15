/**
 * src/sketches/030_acoustic_assets.js
 * - [030호 우아한 어쿠스틱 디오라마 Ver 2.0]
 * - 거대 악기는 배경에서 우아하게 숨 쉬고(공명), 음표와 물방울만 서정적으로 떠오릅니다.
 * - 자막 On/Off 기능 완벽 대응
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
    this.version = "030호 어쿠스틱 디오라마 Ver 2.0";
    
    this.particles = [];
    this.loadedImages = { instruments: [], notes: [] };
    this.currentMainInstrument = null; // 중앙을 장식할 메인 악기 1개

    this.initAssets();
  }

  init() {
    this.resize();
  }

  // 📂 모델링 에셋 로드 및 역할 분리
  initAssets() {
    const basePath = 'assets/models/';
    
    // 악기류 (배경에서 은은하게 렌더링될 거대 오브젝트)
    const instrumentFiles = [
      'PIANO001.png', 'PIANO002.png', 'VIOLIN001.png', 'GUITAR002.png', 'GUITAR003.png', 'GUITAR004.png',
      'CYLOPHONE001.png', 'DRUM_001.png', 'DRUM_002.png'
    ];
    
    // 파티클류 (피아노 선율에 맞춰 화면을 떠다닐 에셋)
    const noteFiles = [
      'MUSIC14_001.png', 'MUSIC14_002.png', 'MUSIC14_003.png', 'MUSIC18_001.png', 'HIGHMUSIC_001.png',
      'PURE_WATER_001.png', 'PURE_WATER_002.png', 'PURE_WATER_003.png'
    ];

    const loadImg = (filename, category) => {
      const img = new Image();
      img.src = basePath + filename;
      img.onload = () => {
        this.loadedImages[category].push(img);
        // 악기 이미지가 하나라도 로드되면 메인 악기로 지정
        if (category === 'instruments' && !this.currentMainInstrument) {
          this.pickNewMainInstrument();
        }
      };
      // 에러 무시 처리 (없는 파일 대비)
      img.onerror = () => { console.warn(`Asset missing: ${filename}`); };
    };

    instrumentFiles.forEach(f => loadImg(f, 'instruments'));
    noteFiles.forEach(f => loadImg(f, 'notes'));
  }

  pickNewMainInstrument() {
    if (this.loadedImages.instruments.length > 0) {
      const idx = Math.floor(Math.random() * this.loadedImages.instruments.length);
      this.currentMainInstrument = this.loadedImages.instruments[idx];
    }
  }

  resize(w, h) {
    this.width = w || (this.container ? this.container.clientWidth : 800) || 800;
    this.height = h || (this.container ? this.container.clientHeight : 600) || 600;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  // 🎶 음표/물방울 파티클 스폰 (위로 부드럽게 상승)
  spawnNote(W, H) {
    const assets = this.loadedImages.notes;
    if (assets.length === 0) return;

    const img = assets[Math.floor(Math.random() * assets.length)];
    
    this.particles.push({
      img: img,
      x: W * 0.1 + Math.random() * (W * 0.8),
      y: H + 50,
      life: 1.0,
      decay: 0.005 + Math.random() * 0.005, // 매우 천천히 사라짐
      scale: Math.random() * 0.3 + 0.2,     // 작고 귀엽게
      angle: (Math.random() - 0.5) * 0.5,   // 살짝만 기울어짐
      rotSpeed: (Math.random() - 0.5) * 0.01,
      speedY: 1.5 + Math.random() * 2.0,    // 위로 떠오르는 속도
      wavePhase: Math.random() * Math.PI * 2,
      waveAmp: Math.random() * 1.5
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
    
    const gainVal = settings.audioGain ?? 1.0;
    const gaugeVal = settings.gaugeValue ?? 0.5; 

    this.time += 0.01 + (bass * 0.01 * gainVal);

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
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, W, H);
    this.ctx.beginPath();
    this.ctx.rect(renderX, renderY, renderW, renderH);
    this.ctx.clip();

    const centerX = renderX + renderW / 2;
    const centerY = renderY + renderH / 2;

    // 1. 깊이 있는 어쿠스틱 나무 질감 배경
    const bgGrad = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, renderW * 0.8);
    bgGrad.addColorStop(0, '#261612'); // 따뜻한 우드 톤
    bgGrad.addColorStop(1, '#050302');
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(renderX, renderY, renderW, renderH);

    // 2. 🎻 거대한 메인 악기 공명 렌더링 (단 1개만 우아하게)
    // 셔플 슬라이더의 값을 이용해 가끔씩 메인 악기를 교체
    if (Math.random() < 0.001) this.pickNewMainInstrument();

    if (this.currentMainInstrument) {
      this.ctx.save();
      this.ctx.translate(centerX, centerY);
      
      // 베이스에 맞춰 천천히 숨쉬듯 커졌다 작아지는 스케일링
      const baseScale = Math.min(renderW, renderH) / this.currentMainInstrument.width * 1.5;
      const pulse = bass * 0.15 * gaugeVal;
      const finalScale = baseScale + pulse;

      // 악기가 배경에 스며들도록 부드러운 투명도 처리
      this.ctx.globalCompositeOperation = 'screen';
      this.ctx.globalAlpha = 0.15 + (bass * 0.2); 
      
      const w = this.currentMainInstrument.width * finalScale;
      const h = this.currentMainInstrument.height * finalScale;
      this.ctx.drawImage(this.currentMainInstrument, -w/2, -h/2, w, h);
      this.ctx.restore();
    }

    // 3. 〰️ 서정적인 황금빛 현(String) 파동
    this.ctx.lineWidth = 1.5 + bass * 3;
    this.ctx.strokeStyle = `rgba(255, 215, 0, ${0.4 + bass * 0.4})`; // 빛나는 금선
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = '#d4af37';

    for(let i=0; i<6; i++) {
      this.ctx.beginPath();
      // 현들이 화면을 가로지름
      const yOffset = renderY + (renderH * 0.15) + (i * (renderH * 0.14));
      // 베이스가 칠 때 현이 강하게 튕겨짐
      const wave = Math.sin(this.time * 4 + i * 1.5) * (15 + bass * 120 * gaugeVal); 
      
      this.ctx.moveTo(renderX, yOffset);
      this.ctx.quadraticCurveTo(centerX, yOffset + wave, renderX + renderW, yOffset);
      this.ctx.stroke();
    }
    this.ctx.shadowBlur = 0;

    // 4. 🎶 음표/물방울 에셋 스폰 (피아노, 고음역에 반응)
    // 멜로디(Mid)나 고음(Treble)이 칠 때 예쁜 음표가 퐁퐁 솟아오름
    if ((mid > 0.3 || treble > 0.3) && Math.random() < 0.25) {
      this.spawnNote(renderW, renderH);
    }

    // 5. 음표 파티클 부드러운 상승 물리 로직
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      
      // 위로 올라가며 좌우로 살랑살랑 흔들림 (수중 공기방울처럼)
      p.y -= p.speedY * gainVal;
      p.x += Math.sin(this.time * 2 + p.wavePhase) * p.waveAmp;
      p.angle += p.rotSpeed;
      p.life -= p.decay;

      if (p.life <= 0 || p.y < renderY - 100) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(renderX + p.x, p.y);
      this.ctx.rotate(p.angle);
      
      // 나타날 때와 사라질 때 부드러운 페이드 효과
      this.ctx.globalAlpha = p.life > 0.8 ? (1.0 - p.life) * 5 : p.life * 1.2;
      
      const w = p.img.width * p.scale;
      const h = p.img.height * p.scale;
      
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = "rgba(255, 255, 255, 0.4)";
      
      this.ctx.drawImage(p.img, -w/2, -h/2, w, h);
      this.ctx.restore();
    }

    // 6. ✍️ 최상단 자막 (자막 끄기 토글 상태 확인!)
    const subtitleText = window.currentSubtitleText || window.cosmicEngineSettings?.poemText || "";
    // 💡 토글 설정이 켜져 있을 때만 그리기
    if (subtitleText && settings.showSubtitle !== false) {
      this.ctx.globalAlpha = 1.0;
      const baseFontSize = Math.max(28, Math.min(52, renderW * 0.065));
      const fontSize = baseFontSize * (1.0 + (mid * 0.05 * gaugeVal)); // 목소리(mid)에 살짝 반응
      
      const rawFont = settings.fontFamily || "Noto Sans KR";
      const cleanFontName = rawFont.replace(/['"]/g, ''); 
      
      this.ctx.font = `bold ${fontSize}px "${cleanFontName}", sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const lines = subtitleText.split('\n');
      const lineHeight = fontSize * 1.35;

      lines.forEach((line, idx) => {
        const lineY = centerY + (idx - (lines.length - 1) / 2) * lineHeight;

        this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        [-2, 2].forEach(ox => {
          [-2, 2].forEach(oy => {
            this.ctx.fillText(line, centerX + ox, lineY + oy);
          });
        });

        this.ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        this.ctx.shadowBlur = 15;
        this.ctx.fillStyle = "#faf6ed"; 
        this.ctx.fillText(line, centerX, lineY);
        this.ctx.shadowBlur = 0;
      });
    }

    this.ctx.restore();

    window.sketchDiagnostics = {
      fps: 60,
      particleCount: `Notes: ${this.particles.length}`,
      isCovering: true,
      activeFunction: `Diorama[Sub:${settings.showSubtitle !== false ? 'ON' : 'OFF'}]`
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
