/**
 * src/sketches/016_p5_stylized_painter.js
 * - 분산범위: 저/중/고음 획 크기 대비(Contrast) 조절
 * - 발광/크기: 획의 절대 두께 및 색상 농도(Saturation/Opacity)
 * - 폭발력: 음악 비트에 따라 터져 나오는 획의 개수(Strokes per Frame)
 */
export default class P5StylizedArtPainter {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.currentAudioData = null;
    
    this.largeStrokes = [];
    this.mediumStrokes = [];
    this.fineStrokes = [];
    
    this.pg = null; 
    this.isImageLoaded = false;
    this.drawnCount = 0;
    this.totalStrokes = 0;
  }

  // ... (init, handleDragOver, handleDrop 동일)
  
  // 💡 [핵심] UI 설정값을 붓 엔진에 1:1 직결
  getUIParams() {
      const settings = window.cosmicEngineSettings || {};
      return {
          scatter: settings.scatterExponent ?? 2.2, // 획 크기 대비
          glow: settings.glowAmount ?? 0.25,        // 색상 농도 및 절대 크기
          burst: settings.audioGain ?? 1.0,         // 폭발력 (주파수 반응 개수)
          style: settings.colorStyle ?? 'neon'
      };
  }

  update(audioData) {
    if (!this.p5Instance || !this.isImageLoaded) return;
    this.currentAudioData = audioData;
    const ui = this.getUIParams();

    const audioEl = document.querySelector('audio');
    let progress = audioEl ? (audioEl.currentTime / (audioEl.duration * 0.8)) : 0;
    progress = Math.min(progress, 1.0);

    // 음악 주파수
    let low = (audioData.raw[2] + audioData.raw[3]) / 510;
    let mid = (audioData.raw[20] + audioData.raw[21]) / 510;
    let high = (audioData.raw[60] + audioData.raw[61]) / 510;

    // 💡 폭발력 적용: 획의 숫자를 Burst(audioGain)에 비례해서 증가
    let baseRate = Math.floor(20 * ui.burst); 
    let targetDrawn = Math.floor(this.totalStrokes * progress);
    let drawBudget = Math.min(targetDrawn - this.drawnCount, baseRate);

    // 💡 분산범위(Scatter) 적용: 저/중/고음의 획 크기 대비 조정
    let scatterMod = ui.scatter; // 높을수록 고음은 작게, 저음은 크게
    let sizeBase = ui.glow * 10; // 절대 크기 조절

    this.executeDrawing(drawBudget, low, mid, high, scatterMod, sizeBase);
    this.drawnCount += drawBudget;
    this.p5Instance.redraw();
  }

  executeDrawing(budget, l, m, h, sMod, sBase) {
    // 💡 분산 범위(sMod)를 적용한 계산식
    let largeSize = (l * 20 + 10) * sBase * sMod; 
    let midSize = (m * 10 + 5) * sBase;
    let fineSize = (h * 2 + 1) * sBase / sMod;

    while(budget > 0 && this.largeStrokes.length > 0) { this.paint(this.largeStrokes.pop(), largeSize, 'large'); budget--; }
    while(budget > 0 && this.mediumStrokes.length > 0) { this.paint(this.mediumStrokes.pop(), midSize, 'medium'); budget--; }
    while(budget > 0 && this.fineStrokes.length > 0) { this.paint(this.fineStrokes.pop(), fineSize, 'fine'); budget--; }
  }

  paint(pos, size, type) {
    let p = this.p5Instance;
    let c = this.sourceImg.get(pos.x, pos.y);
    // 💡 발광/크기(ui.glow) 슬라이더에 따른 색상 농도 반영
    let alpha = 200 * this.getUIParams().glow; 
    this.pg.fill(p.red(c), p.green(c), p.blue(c), alpha);
    this.pg.noStroke();
    
    if(type === 'large') this.pg.ellipse(pos.x, pos.y, size, size/2);
    else if(type === 'medium') this.pg.circle(pos.x, pos.y, size);
    else this.pg.rect(pos.x, pos.y, size, size);
  }
}
