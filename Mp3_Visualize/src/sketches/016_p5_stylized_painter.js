/**
 * src/sketches/016_p5_stylized_painter.js
 * 로딩된 이미지를 음악의 주파수(저/중/고음) 물리 법칙에 따라
 * 4가지 화풍(스케치, 수채화, 야수파, 인상파+오래된사진)으로 실시간으로 그려나가는 엔진
 */
export default class P5StylizedArtPainter {
  constructor(container) {
    this.container = container;
    this.p5Instance = null;
    this.currentAudioData = null;
    
    this.smoothLow = 0;
    this.smoothMid = 0;
    this.smoothHigh = 0;
    
    this.sourceImg = null;
    this.chunkIndices = [];
    this.drawnCount = 0;
    this.isImageLoaded = false;
    
    this.simulatedProgress = 0; 
    this.currentStyle = '';
  }

  async init() {
    if (!window.p5) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    this.container.addEventListener('dragover', this.handleDragOver.bind(this));
    this.container.addEventListener('drop', this.handleDrop.bind(this));

    const sketch = (p) => {
      let pg; 

      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        pg = p.createGraphics(p.width, p.height);
        pg.background(15, 18, 25); 
        
        p.loadImage('https://picsum.photos/seed/cosmic/800/600', (img) => {
            if(!this.isImageLoaded) this.prepareCanvas(img, p, pg);
        });
        
        p.noLoop(); 
      };

      p.draw = () => {
        p.clear();
        p.image(pg, 0, 0);

        if (!this.currentAudioData || !this.isImageLoaded) {
            this.drawDropUI(p);
            return;
        }

        let scatter = 2.2, gain = 1.0;
        let colorStyle = 'neon';
        if (window.cosmicEngineSettings) {
          scatter = Number.isFinite(window.cosmicEngineSettings.scatterExponent) ? window.cosmicEngineSettings.scatterExponent : 2.2;
          gain = Number.isFinite(window.cosmicEngineSettings.audioGain) ? window.cosmicEngineSettings.audioGain : 1.0;
          colorStyle = window.cosmicEngineSettings.colorStyle || 'neon';
        }

        if (this.currentStyle !== colorStyle) {
            this.currentStyle = colorStyle;
            this.resetCanvas(p, pg); 
        }

        let lowSum = 0, midSum = 0, highSum = 0;
        let lowCount = 0, midCount = 0, highCount = 0;

        for(let i = 2; i < 12; i++) { lowSum += this.currentAudioData.raw[i] || 0; lowCount++; }
        for(let i = 12; i < 35; i++) { midSum += this.currentAudioData.raw[i] || 0; midCount++; }
        for(let i = 35; i < 90; i++) { highSum += this.currentAudioData.raw[i] || 0; highCount++; }

        let targetLow = lowCount > 0 ? Math.pow((lowSum / lowCount) / 255.0, 1.5) : 0;
        let targetMid = midCount > 0 ? Math.pow((midSum / midCount) / 255.0, 1.5) : 0;
        let targetHigh = highCount > 0 ? Math.pow((highSum / highCount) / 255.0, 1.5) : 0;

        this.smoothLow += (targetLow * gain - this.smoothLow) * 0.2;
        this.smoothMid += (targetMid * gain - this.smoothMid) * 0.2;
        this.smoothHigh += (targetHigh * gain - this.smoothHigh) * 0.2;

        let progress = 0;
        const audioEl = document.querySelector('audio');
        if (audioEl && audioEl.duration) {
            progress = audioEl.currentTime / audioEl.duration;
        } else {
            this.simulatedProgress += 0.016 / 180.0;
            progress = this.simulatedProgress;
        }

        let targetCount = Math.floor(this.chunkIndices.length * Math.min(1.0, progress / 0.8));
        let strokesToDraw = targetCount - this.drawnCount;
        
        let burstStrokes = Math.floor(this.smoothMid * 150 * scatter); 
        strokesToDraw = Math.max(strokesToDraw, burstStrokes);

        let step = 6; 
        for (let i = 0; i < strokesToDraw; i++) {
            if (this.chunkIndices.length === 0) break; 
            
            let idx = this.chunkIndices.pop();
            this.drawnCount++;

            let x = (idx % Math.floor(p.width / step)) * step;
            let y = Math.floor(idx / Math.floor(p.width / step)) * step;

            let imgX = Math.floor(p.map(x, 0, p.width, 0, this.sourceImg.width));
            let imgY = Math.floor(p.map(y, 0, p.height, 0, this.sourceImg.height));
            let c = this.sourceImg.get(imgX, imgY);
            
            this.drawStylizedStroke(pg, p, x, y, c, colorStyle);
        }

        if (this.chunkIndices.length === 0 && this.smoothHigh > 0.1) {
            for(let i=0; i < 20; i++) {
                let x = p.random(p.width);
                let y = p.random(p.height);
                let imgX = Math.floor(p.map(x, 0, p.width, 0, this.sourceImg.width));
                let imgY = Math.floor(p.map(y, 0, p.height, 0, this.sourceImg.height));
                this.drawStylizedStroke(pg, p, x, y, this.sourceImg.get(imgX, imgY), colorStyle);
            }
        }

        if (colorStyle === 'custom' && progress >= 0.8) {
            this.drawOldPhotoEffect(p);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  drawStylizedStroke(pg, p, x, y, c, style) {
      let r = p.red(c);
      let g = p.green(c);
      let b = p.blue(c);
      let brightness = (r + g + b) / 3;

      pg.push();
      pg.translate(x, y);

      let jitter = (p.random(-1, 1) * this.smoothHigh * 20);
      pg.translate(jitter, jitter);

      if (style === 'monochrome') {
          pg.stroke(brightness + p.random(-20, 20)); 
          let weight = 0.5 + (this.smoothLow * 5); 
          pg.strokeWeight(weight);
          pg.noFill();
          
          let angle = p.noise(x * 0.01, y * 0.01) * p.PI * 2 + (this.smoothHigh * p.PI);
          let len = p.map(brightness, 0, 255, 15, 2) + (this.smoothLow * 10);
          pg.line(-len/2, -len/2, len/2, len/2);
          
      } else if (style === 'pastel') {
          pg.noStroke();
          pg.fill(r, g, b, 30 + this.smoothHigh * 50); 
          
          let radius = 8 + (this.smoothLow * 30); 
          pg.circle(p.random(-5, 5), p.random(-5, 5), radius);
          pg.circle(p.random(-2, 2), p.random(-2, 2), radius * 0.5);

      } else if (style === 'neon') {
          pg.noStroke();
          let maxColor = Math.max(r, g, b);
          let nr = r === maxColor ? 255 : r * 0.4;
          let ng = g === maxColor ? 255 : g * 0.4;
          let nb = b === maxColor ? 255 : b * 0.4;
          pg.fill(nr, ng, nb, 220);
          
          let w = 15 + (this.smoothLow * 25);
          let h = 5 + (this.smoothHigh * 10);
          pg.rotate(p.random(p.PI));
          pg.rectMode(p.CENTER);
          pg.rect(0, 0, w, h);

      } else if (style === 'custom') {
          pg.noStroke();
          pg.fill(r, g, b, 200);
          
          let angle = p.map(brightness, 0, 255, 0, p.PI);
          pg.rotate(angle);
          
          let thick = 4 + (this.smoothLow * 12);
          let len = 12 + (this.smoothHigh * 15);
          pg.ellipse(0, 0, len, thick);
      }
      
      pg.pop();
  }

  drawOldPhotoEffect(p) {
      p.noStroke();
      p.fill(60, 40, 20, 30); 
      p.rect(0, 0, p.width, p.height);

      p.noFill();
      for(let i=0; i<50; i++) {
          p.stroke(0, 0, 0, i * 2);
          p.strokeWeight(5);
          let r = p.max(p.width, p.height) * 1.5 - (i * 15);
          if(r > 0) p.circle(p.width/2, p.height/2, r);
      }

      if (this.smoothHigh > 0.2) {
          p.stroke(255, 255, 255, 100);
          p.strokeWeight(1);
          for(let i=0; i<10; i++) {
              let nx = p.random(p.width);
              p.line(nx, 0, nx, p.height);
          }
      }
  }

  drawDropUI(p) {
      p.push();
      p.fill(255, 255, 255, 100 + p.sin(p.millis() * 0.005) * 50);
      p.noStroke();
      p.textSize(24);
      p.textAlign(p.CENTER, p.CENTER);
      p.text("원하는 이미지를 드래그 & 드롭하여 캔버스에 올려주세요", p.width/2, p.height/2);
      p.pop();
  }

  handleDragOver(e) {
      e.preventDefault();
  }

  handleDrop(e) {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          if (this.p5Instance) {
              this.p5Instance.loadImage(url, (img) => {
                  this.prepareCanvas(img, this.p5Instance, this.p5Instance._setupDone ? this.p5Instance._elements[0] : null); 
                  this.simulatedProgress = 0; 
              });
          }
      }
  }

  prepareCanvas(img, p, pg) {
      this.sourceImg = img;
      this.isImageLoaded = true;
      this.resetCanvas(p, pg);
  }

  resetCanvas(p, pg) {
      if(!pg) return;
      pg.background(15, 18, 25);
      
      this.chunkIndices = [];
      let step = 6;
      let cols = Math.floor(p.width / step);
      let rows = Math.floor(p.height / step);
      
      for(let i = 0; i < cols * rows; i++) {
          this.chunkIndices.push(i);
      }
      
      for (let i = this.chunkIndices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.chunkIndices[i], this.chunkIndices[j]] = [this.chunkIndices[j], this.chunkIndices[i]];
      }
      
      this.drawnCount = 0;
  }

  update(audioData) {
    if (!this.p5Instance) return;
    this.currentAudioData = audioData;
    this.p5Instance.redraw(); 
  }

  resize(w, h) {
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
      this.isImageLoaded = false; 
    }
  }

  destroy() {
    this.container.removeEventListener('dragover', this.handleDragOver);
    this.container.removeEventListener('drop', this.handleDrop);
    
    if (!this.p5Instance) return;
    this.p5Instance.remove();
    this.p5Instance = null;
    this.currentAudioData = null;
    this.sourceImg = null;
  }
}
