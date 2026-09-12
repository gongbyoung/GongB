/**
 * src/sketches/020_p5_srt_canvas.js
 * - [020호 10종 고도별 구름 대기 시뮬레이터 Ver 21.0]
 * - 상층운(권운, 권적운, 권층운), 중층운(고적운, 고층운), 하층운(층적운, 층운, 난층운), 수직운(적운, 적란운) 총 500개 구름 배치
 * - 관제탑 Gauge 슬라이더: 구름 세기(불투명도 및 밀도) 조절
 * - 관제탑 Scatter 슬라이더: 구름 움직임(이동 속도 및 바람 세기) 조절
 */
export default class P5SrtCanvasStage {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    
    this.clouds = []; // 총 500개의 구름 입자 보관소
    this.cloudTextures = {}; // 10종 구름 텍스처 캐시
    
    this.accumulationBuffer = null;
    this.subtitleBuffer = null; 
    this.lastWidth = 0;
    this.lastHeight = 0;
    
    this.lastTrackedText = "";
    this.lastRenderedText = "";
    this.lastRenderedFontSize = 0;
    this.lastRenderedColor = "";
    
    this.currentFont = 'Black Han Sans';
    this.version = "020호 10종 고도별 구름 대기 시스템 Ver 21.0";
  }

  init() {
    const sketch = (p) => {
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        this.accumulationBuffer = p.createGraphics(p.width, p.height);
        this.accumulationBuffer.clear();
        
        this.lastWidth = p.width;
        this.lastHeight = p.height;
        
        const fontPool = ['Black Han Sans', 'Noto Sans KR'];
        this.currentFont = p.random(fontPool);
        
        // 10종 구름 텍스처 생성 팩토리 가동
        this.createCloudTextureFactories(p);
        
        // 500개의 구름을 10종류 고도별로 분류하여 생성
        this.initClouds(p);
        
        p.frameRate(30);
        p.loop();
      };

      p.draw = () => {
        p.clear();
        
        const settings = window.cosmicEngineSettings || { 
          seed: 42, scatterExponent: 2.2, glowIntensity: 0.85, audioGain: 1.0, gaugeValue: 0.5, colorStyle: 'neon',
          customColors: { gas1: '#ff4500', gas2: '#8b0000', star: '#ffff00' }
        };
        
        const custom = settings.customColors || { gas1: '#ff4500', gas2: '#8b0000', star: '#ffff00' };

        if (this.lastWidth !== p.width || this.lastHeight !== p.height) {
          let newBuffer = p.createGraphics(p.width, p.height);
          newBuffer.image(this.accumulationBuffer, 0, 0);
          if (this.accumulationBuffer) this.accumulationBuffer.remove();
          this.accumulationBuffer = newBuffer;
          this.lastWidth = p.width;
          this.lastHeight = p.height;
        }

        // 최하단 배경 이미지 합성
        if (window.currentUploadedImageElement) {
          p.drawingContext.drawImage(window.currentUploadedImageElement, 0, 0, p.width, p.height);
        } else {
          // 기본 하늘 그라데이션 배경
          let skyGrad = p.drawingContext.createLinearGradient(0, 0, 0, p.height);
          skyGrad.addColorStop(0, '#1a2a6c');
          skyGrad.addColorStop(0.5, '#b21f1f');
          skyGrad.addColorStop(1, '#fdbb2d');
          p.drawingContext.fillStyle = skyGrad;
          p.fillRect(0, 0, p.width, p.height);
        }

        // SRT 가사 동기화 설정
        const audioEl = document.getElementById('audio-player');
        const subs = window.parsedSubtitles || [];
        const currentTime = audioEl ? audioEl.currentTime : 0;
        const currentSub = subs.find(s => currentTime >= s.start && currentTime <= s.end);
        const text = window.currentSubtitleText || "";

        const glowRaw = settings.glowIntensity > 5 ? settings.glowIntensity : settings.glowIntensity * 100;
        const fontSize = p.map(glowRaw, 10, 250, 52, 210);
        const tracking = fontSize * 0.74;
        const leading = fontSize * 1.45;

        const offX = settings.positionOffset?.x || 0;
        const offY = settings.positionOffset?.y || 0;

        // 관제탑 컨트롤러 수치 연동 (세기 & 움직임)
        const gaugeRaw = settings.gaugeValue > 1 ? settings.gaugeValue : settings.gaugeValue * 100;
        const intensityFactor = p.map(gaugeRaw, 0, 100, 0.3, 1.5); // 세기 (불투명도/크기)

        const scatterRaw = settings.scatterExponent > 5 ? settings.scatterExponent : settings.scatterExponent * 10;
        const movementSpeed = p.map(scatterRaw, 5, 50, 0.2, 3.0); // 움직임 (풍속)

        // 500개 구름 물리 업데이트 및 렌더링
        this.updateAndDrawClouds(p, movementSpeed, intensityFactor);

        // 시스템 진단 HUD 통신
        window.sketchDiagnostics = {
          fps: p.floor(p.frameRate()),
          particleCount: this.clouds.length,
          isCovering: !!currentSub,
          activeFunction: `CloudSystem[500Clouds_10Types]`
        };

        // 자막 렌더링 (최상단)
        this.drawSubtitle(p, settings, custom, currentSub, fontSize, tracking, leading, offX, offY);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  // ☁️ 10종 고도별 구름 텍스처 그래픽 생성 팩토리
  createCloudTextureFactories(p) {
    const cloudTypes = [
      'cirrus', 'cirrocumulus', 'cirrostratus', // 상층운 (3종)
      'altocumulus', 'altostratus',             // 중층운 (2종)
      'stratocumulus', 'stratus', 'nimbostratus', // 하층운 (3종)
      'cumulus', 'cumulonimbus'                 // 수직운 (2종)
    ];

    cloudTypes.forEach((type, idx) => {
      let pg = p.createGraphics(256, 128);
      let ctx = pg.drawingContext;
      ctx.save();
      ctx.translate(128, 64);

      let grad = ctx.createRadialGradient(0, 0, 10, 0, 0, 60);
      
      if (type === 'nimbostratus' || type === 'cumulonimbus') {
        grad.addColorStop(0, 'rgba(100, 110, 130, 0.85)');
        grad.addColorStop(1, 'rgba(40, 45, 60, 0)');
      } else if (type === 'cirrus' || type === 'cirrostratus') {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.80)');
        grad.addColorStop(0.6, 'rgba(240, 245, 255, 0.4)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();

      // 구름 형태별 디자인 세부 드로잉
      if (type === 'cirrus') {
        // 권운: 털 모양의 가늘고 긴 형태
        ctx.ellipse(0, 0, 90, 20, 0.2, 0, Math.PI * 2);
      } else if (type === 'cirrocumulus' || type === 'altocumulus') {
        // 비늘/둥근 덩어리 형태
        for (let i = -3; i <= 3; i++) {
          ctx.arc(i * 22, (i % 2) * 5, 25, 0, Math.PI * 2);
        }
      } else if (type === 'cumulus' || type === 'cumulonimbus') {
        // 뭉게구름 및 탑 모양 수직운
        ctx.arc(-30, 10, 35, 0, Math.PI * 2);
        ctx.arc(0, -10, 45, 0, Math.PI * 2);
        ctx.arc(30, 10, 35, 0, Math.PI * 2);
        ctx.arc(0, 15, 40, 0, Math.PI * 2);
      } else {
        // 일반적층형 구름
        ctx.ellipse(0, 0, 110, 45, 0, 0, Math.PI * 2);
      }

      ctx.fill();
      ctx.restore();
      this.cloudTextures[type] = pg;
    });
  }

  // ☁️ 총 500개의 구름을 10종류로 분류하여 고도별 배치 초기화
  initClouds(p) {
    this.clouds = [];
    const types = [
      { name: 'cirrus', altitude: 'high', yMin: 0.02, yMax: 0.22 },
      { name: 'cirrocumulus', altitude: 'high', yMin: 0.05, yMax: 0.25 },
      { name: 'cirrostratus', altitude: 'high', yMin: 0.10, yMax: 0.30 },
      { name: 'altocumulus', altitude: 'middle', yMin: 0.30, yMax: 0.50 },
      { name: 'altostratus', altitude: 'middle', yMin: 0.35, yMax: 0.55 },
      { name: 'stratocumulus', altitude: 'low', yMin: 0.55, yMax: 0.75 },
      { name: 'stratus', altitude: 'low', yMin: 0.60, yMax: 0.80 },
      { name: 'nimbostratus', altitude: 'low', yMin: 0.65, yMax: 0.85 },
      { name: 'cumulus', altitude: 'vertical', yMin: 0.20, yMax: 0.70 },
      { name: 'cumulonimbus', altitude: 'vertical', yMin: 0.15, yMax: 0.80 }
    ];

    const totalClouds = 500;
    const perTypeCount = Math.floor(totalClouds / types.length); // 종류당 약 50개씩 총 500개

    types.forEach(t => {
      for (let i = 0; i < perTypeCount; i++) {
        this.clouds.push({
          x: p.random(-100, p.width + 100),
          y: p.random(p.height * t.yMin, p.height * t.yMax),
          speed: p.random(0.15, 0.8),
          scale: p.random(0.6, 1.8),
          alpha: p.random(120, 240),
          type: t.name,
          altitude: t.altitude
        });
      }
    });
  }

  // ☁️ 구름 움직임 및 세기 물리 연산 반영 렌더링
  updateAndDrawClouds(p, movementSpeed, intensityFactor) {
    if (!this.cloudTextures) return;

    this.clouds.forEach(c => {
      // 움직임 조절 (Scatter 슬라이더 연동 풍속)
      c.x += c.speed * movementSpeed;
      
      // 화면 밖으로 나가면 반대편으로 순환 루프
      if (c.x > p.width + 150) {
        c.x = -150;
        c.y = p.random(p.height * 0.02, p.height * 0.85);
      }

      let pg = this.cloudTextures[c.type];
      if (!pg) return;

      p.push();
      p.tint(255, c.alpha * intensityFactor);
      let renderSizeW = 180 * c.scale * (intensityFactor * 0.9);
      let renderSizeH = 90 * c.scale * (intensityFactor * 0.9);
      p.imageMode(p.CENTER);
      p.image(pg, c.x, c.y, renderSizeW, renderSizeH);
      p.pop();
    });
  }

  renderSubtitleCache(p, text, fontSize, tracking, leading, textColorStyle) {
    if (!text) { if (this.subtitleBuffer) this.subtitleBuffer.clear(); return; }
    const lines = text.split(" ");
    let maxLineChars = 0;
    lines.forEach(l => { if (l.length > maxLineChars) maxLineChars = l.length; });
    
    const reqW = Math.max(120, p.floor(maxLineChars * tracking + 60));
    const reqH = Math.max(120, p.floor(lines.length * leading + 60));
    
    if (!this.subtitleBuffer || this.subtitleBuffer.width < reqW || this.subtitleBuffer.height < reqH) {
      if (this.subtitleBuffer) this.subtitleBuffer.remove();
      this.subtitleBuffer = p.createGraphics(reqW, reqH);
    }
    
    let sb = this.subtitleBuffer;
    sb.clear(); 
    sb.textFont(this.currentFont || 'sans-serif'); 
    sb.textSize(fontSize); sb.textAlign(p.CENTER, p.CENTER);
    sb.fill(textColorStyle); sb.noStroke();
    
    lines.forEach((line, lineIdx) => {
      let currentLineY = (sb.height / 2) + (lineIdx * leading) - ((lines.length - 1) * leading * 0.5);
      let chars = line.split("");
      chars.forEach((char, charIdx) => {
        let finalX = (sb.width / 2) + (charIdx * tracking) - ((chars.length - 1) * tracking * 0.5);
        sb.text(char, finalX, currentLineY);
      });
    });
  }

  drawSubtitle(p, settings, custom, currentSub, fontSize, tracking, leading, offX, offY) {
    const text = window.currentSubtitleText || "";
    if (!text) return; 

    const style = settings.colorStyle;
    let textColorStyle = '#ffffff';
    if (style === 'monochrome' || style === 'earth' || style === 'custom') {
      textColorStyle = custom?.star || '#ffffff'; 
    }

    const safeFontSize = isNaN(fontSize) || fontSize <= 0 ? 60 : fontSize;
    const safeTracking = isNaN(tracking) || tracking <= 0 ? 40 : tracking;
    const safeLeading = isNaN(leading) || leading <= 0 ? 80 : leading;

    if (text !== this.lastRenderedText || safeFontSize !== this.lastRenderedFontSize || textColorStyle !== this.lastRenderedColor) {
      this.renderSubtitleCache(p, text, safeFontSize, safeTracking, safeLeading, textColorStyle);
      this.lastRenderedText = text;
      this.lastRenderedFontSize = safeFontSize;
      this.lastRenderedColor = textColorStyle;
    }

    if (!this.subtitleBuffer) return;

    p.push(); p.imageMode(p.CENTER);
    p.tint(255, 255);
    p.image(this.subtitleBuffer, (p.width / 2) + offX, (p.height / 2) + offY);
    p.pop();
  }

  update(audioData) {}
  resize(w, h) { if (this.p5Instance) this.p5Instance.resizeCanvas(w, h); }

  destroy() {
    if (this.p5Instance) { this.p5Instance.remove(); this.p5Instance = null; }
    if (this.accumulationBuffer) { this.accumulationBuffer.remove(); this.accumulationBuffer = null; }
    if (this.subtitleBuffer) { this.subtitleBuffer.remove(); this.subtitleBuffer = null; }
    if (this.cloudTextures) {
      Object.values(this.cloudTextures).forEach(g => g?.remove());
      this.cloudTextures = {};
    }
    this.clouds = [];
  }
}
