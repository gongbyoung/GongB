import ImageAnalyzer from '../core/ImageAnalyzer.js';

export default class P5StylizedArtPainter {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.brushTexture = null; // 💡 텍스처로 사용할 이미지
    this.sourceImg = null;
    this.pg = null;
    this.points = [];
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
    this.setupSketch();
  }

  setupSketch() {
    new window.p5((p) => {
      p.setup = () => {
        p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        this.pg = p.createGraphics(p.width, p.height);
        this.pg.background(15);
        p.noLoop();
      };
      p.draw = () => {
        p.clear();
        if (this.pg) p.image(this.pg, 0, 0);
      };
      
      // 드래그 앤 드롭
      this.container.ondragover = (e) => e.preventDefault();
      this.container.ondrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        const url = URL.createObjectURL(file);
        p.loadImage(url, (img) => this.prepareCanvas(img, p));
      };
    }, this.container);
  }

  prepareCanvas(img, p) {
    this.sourceImg = img;
    this.brushTexture = img; // 💡 드롭한 이미지가 곧 브러시의 텍스처가 됨
    this.points = ImageAnalyzer.extractFeatures(img, p, 8, 30);
    p.shuffle(this.points, true);
    this.pg.background(15);
    p.redraw();
  }

  update(audioData) {
    if (!this.pg || this.points.length === 0) return;
    
    // 저/중/고음 데이터 추출
    let low = audioData.raw[2] / 255;
    let high = audioData.raw[60] / 255;

    // 💡 붓터치: 막대기 대신 텍스처를 찍어냄
    let pt = this.points.pop();
    let size = (10 + low * 50) * (1.0 - high); // 저음일 때 크게, 고음일 때 미세하게
    
    this.pg.push();
    this.pg.tint(pt.r, pt.g, pt.b, 200);
    // 💡 원본 이미지의 일부를 붓모양으로 잘라서 캔버스에 찍음
    this.pg.image(this.brushTexture, pt.x, pt.y, size, size);
    this.pg.pop();
    
    this.p5Instance.redraw();
  }

  resize(w, h) { if (this.p5Instance) this.p5Instance.resizeCanvas(w, h); }
  destroy() { if (this.p5Instance) this.p5Instance.remove(); }
}
