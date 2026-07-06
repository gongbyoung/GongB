/**
 * src/sketches/016_p5_stylized_painter.js
 * - 저음(Large): 캔버스 구도를 잡는 큰 획
 * - 중음(Mid): 형태를 다듬는 중간 터치
 * - 고음(High): 빛과 질감을 표현하는 아주 미세한 터치
 * - 완성도: 곡의 80% 지점에서 100% 완성
 */
export default class P5StylizedArtPainter {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.currentAudioData = null;
    
    // 💡 붓터치 큐(Queue)를 크기별로 분리
    this.largeStrokes = [];
    this.mediumStrokes = [];
    this.fineStrokes = [];
    
    this.pg = null; 
    this.isImageLoaded = false;
    this.drawnCount = 0;
    this.totalStrokes = 0;
  }

  async init() {
    if (!window.p5) {
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }

    this.container.addEventListener('dragover', (e) => e.preventDefault());
    this.container.addEventListener('drop', this.handleDrop.bind(this));

    const sketch = (p) => {
      p.setup = () => {
        p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        this.pg = p.createGraphics(p.width, p.height);
        this.pg.background(15, 18, 25);
        p.noLoop();
      };

      p.draw = () => {
        p.clear();
        if (this.pg) p.image(this.pg, 0, 0);
        if (!this.isImageLoaded) this.drawDropUI(p);
      };
    };
    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 💡 이미지 로드 시 획을 3단계 크기로 분류하여 큐에 담음
  prepareCanvas(img, p) {
    this.sourceImg = img;
    this.sourceImg.loadPixels();
    this.pg.background(15, 18, 25);
    
    this.largeStrokes = [];
    this.mediumStrokes = [];
    this.fineStrokes = [];

    let step = 4;
    for (let y = 0; y < p.height; y += step) {
      for (let x = 0; x < p.width; x += step) {
        let strokeData = { x, y };
        let rand = p.random();
        // 전체 터치의 10%는 큰 획, 30%는 중간 획, 60%는 미세 터치
        if (rand < 0.1) this.largeStrokes.push(strokeData);
        else if (rand < 0.4) this.mediumStrokes.push(strokeData);
        else this.fineStrokes.push(strokeData);
      }
    }
    this.totalStrokes = this.largeStrokes.length + this.mediumStrokes.length + this.fineStrokes.length;
    this.drawnCount = 0;
    this.isImageLoaded = true;
  }

  update(audioData) {
    if (!this.p5Instance || !this.isImageLoaded) return;
    this.currentAudioData = audioData;

    // 진행률 (곡의 80%를 100% 완료로 간주)
    const audioEl = document.querySelector('audio');
    let progress = audioEl ? (audioEl.currentTime / (audioEl.duration * 0.8)) : 0;
    progress = Math.min(progress, 1.0);

    // 💡 주파수 분석
    let low = (audioData.raw[2] + audioData.raw[3]) / 510;
    let mid = (audioData.raw[20] + audioData.raw[21]) / 510;
    let high = (audioData.raw[60] + audioData.raw[61]) / 510;

    // 💡 진행률에 맞춰 그리기
    let targetDrawn = Math.floor(this.totalStrokes * progress);
    let drawBudget = targetDrawn - this.drawnCount;

    // 저음(Large) -> 중음(Mid) -> 고음(Fine) 순으로 붓을 꺼냄
    this.executeDrawing(drawBudget, low, mid, high);

    this.p5Instance.redraw();
  }

  executeDrawing(budget, low, mid, high) {
    let p = this.p5Instance;
    let count = 0;
    
    // 저음 기반 큰 획 (Bass -> Large)
    while(count < budget && this.largeStrokes.length > 0) {
      this.paint(this.largeStrokes.pop(), low * 20 + 10, 'large');
      count++;
    }
    // 중음 기반 중간 획 (Mid -> Medium)
    while(count < budget && this.mediumStrokes.length > 0) {
      this.paint(this.mediumStrokes.pop(), mid * 10 + 5, 'medium');
      count++;
    }
    // 고음 기반 미세 터치 (High -> Fine)
    while(count < budget && this.fineStrokes.length > 0) {
      this.paint(this.fineStrokes.pop(), high * 2 + 1, 'fine');
      count++;
    }
    this.drawnCount += count;
  }

  paint(pos, size, type) {
    let p = this.p5Instance;
    let imgX = Math.floor(p.map(pos.x, 0, p.width, 0, this.sourceImg.width - 1));
    let imgY = Math.floor(p.map(pos.y, 0, p.height, 0, this.sourceImg.height - 1));
    let c = this.sourceImg.get(imgX, imgY);
    
    this.pg.fill(c);
    this.pg.noStroke();
    // 타입별로 붓의 질감을 다르게 표현
    if(type === 'large') this.pg.ellipse(pos.x, pos.y, size, size/2);
    else if(type === 'medium') this.pg.circle(pos.x, pos.y, size);
    else this.pg.rect(pos.x, pos.y, size, size);
  }

  handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    const url = URL.createObjectURL(file);
    this.p5Instance.loadImage(url, (img) => this.prepareCanvas(img, this.p5Instance));
  }

  drawDropUI(p) {
    p.fill(255);
    p.textAlign(p.CENTER);
    p.text("이미지를 드래그하여 캔버스에 올려주세요", p.width/2, p.height/2);
  }
}
