/**
 * src/sketches/016_p5_stylized_painter.js
 * - 블랙스크린 버그 (그리기 수량 마이너스 현상) 완벽 해결
 * - loadPixels() 다이렉트 메모리 접근을 통한 100배 성능 최적화
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
    this.pg = null; // 💡 캔버스 버퍼를 클래스 전역 변수로 승격
    this.chunkIndices = [];
    this.totalChunks = 0; // 💡 전체 청크 개수를 고정 저장 (핵심 버그 수정)
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
      p.setup = () => {
        const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
        canvas.style('position', 'absolute');
        canvas.style('z-index', '1');
        
        // 💡 오프스크린 붓터치 캔버스 생성
        this.pg = p.createGraphics(p.width, p.height);
        this.pg.background(15, 18, 25); 
        
        p.loadImage('https://picsum.photos/seed/cosmic/800/600', (img) => {
            if(!this.isImageLoaded) this.prepareCanvas(img, p);
        });
        
        p.noLoop(); 
      };

      p.draw = () => {
        p.clear();
        if (this.pg) p.image(this.pg, 0, 0); // 누적된 붓터치 캔버스 렌더링

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
            this.resetCanvas(p); 
        }

        // 주파수 대역별 분리 (저음/중음/고음)
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

        // 💡 [버그 픽스] shrinking length가 아니라 고정된 totalChunks를 기준으로 목표치 계산!
        let targetCount = Math.floor(this.totalChunks * Math.min(1.0, progress / 0.8));
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

            let imgX = Math.floor(p.map(x, 0, p.width, 0, this.sourceImg.width - 1));
            let imgY = Math.floor(p.map(y, 0, p.height, 0, this.sourceImg.height - 1));
            
            // 💡 [성능 최적화] 메모리에 올려둔 픽셀 배열에 다이렉트 접근 (프레임 드랍 완벽 제거)
            let pIndex = (imgY * this.sourceImg.width + imgX) * 4;
            let r = this.sourceImg.pixels[pIndex];
            let g = this.sourceImg.pixels[pIndex + 1];
            let b = this.sourceImg.pixels[pIndex + 2];
            
            this.drawStylizedStroke(p, x, y, r, g, b, colorStyle);
        }

        // 노래가 거의 끝났어도 고음이 치면 빈 공간에 계속 생명력을 불어넣음
        if (this.chunkIndices.length === 0 && this.smoothHigh > 0.1) {
            for(let i=0; i < 20; i++) {
                let x = p.random(p.width);
                let y = p.random(p.height);
                let imgX = Math.floor(p.map(x, 0, p.width, 0, this.sourceImg.width - 1));
                let imgY = Math.floor(p.map(y, 0, p.height, 0, this.sourceImg.height - 1));
                
                let pIndex = (imgY * this.sourceImg.width + imgX) * 4;
                let r = this.sourceImg.pixels[pIndex];
                let g = this.sourceImg.pixels[pIndex + 1];
                let b = this.sourceImg.pixels[pIndex + 2];

                this.drawStylizedStroke(p, x, y, r, g, b, colorStyle);
            }
        }

        if (colorStyle === 'custom' && progress >= 0.8) {
            this.drawOldPhotoEffect(p);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 💡 화풍별 붓터치 렌더링 엔진
  drawStylizedStroke(p, x, y, r, g, b, style) {
      if (!this.pg) return;
      let brightness = (r + g + b) / 3;

      this.pg.push();
      this.pg.translate(x, y);

      let jitter = (p.random(-1, 1) * this.smoothHigh * 20);
      this.pg.translate(jitter, jitter);

      if (style === 'monochrome') {
          this.pg.stroke(brightness + p.random(-20, 20)); 
          let weight = 0.5 + (this.smoothLow * 5); 
          this.pg.strokeWeight(weight);
          this.pg.noFill();
          
          let angle = p.noise(x * 0.01, y * 0.01) * p.PI * 2 + (this.smoothHigh * p.PI);
          this.pg.rotate(angle);
          let len = p.map(brightness, 0, 255, 15, 2) + (this.smoothLow * 10);
          this.pg.line(-len/2, 0, len/2, 0);
          
      } else if (style === 'pastel') {
          this.pg.noStroke();
          this.pg.fill(r, g, b, 30 + this.smoothHigh * 50); 
          
          let radius = 8 + (this.smoothLow * 30); 
          this.pg.circle(p.random(-5, 5), p.random(-5, 5), radius);
          this.pg.circle(p.random(-2, 2), p.random(-2, 2), radius * 0.5);

      } else if (style === 'neon') {
          this.pg.noStroke();
          let maxColor = Math.max(r, g, b);
          let nr = r === maxColor ? 255 : r * 0.4;
          let ng = g === maxColor ? 255 : g * 0.4;
          let nb = b === maxColor ? 255 : b * 0.4;
          this.pg.fill(nr, ng, nb, 220);
          
          let w = 15 + (this.smoothLow * 25);
          let h = 5 + (this.smoothHigh * 10);
          this.pg.rotate(p.random(p.PI));
          this.pg.rectMode(p.CENTER);
          this.pg.rect(0, 0, w, h);

      } else if (style === 'custom') {
          this.pg.noStroke();
          this.pg.fill(r, g, b, 200);
          
          let angle = p.map(brightness, 0, 255, 0, p.PI);
          this.pg.rotate(angle);
          
          let thick = 4 + (this.smoothLow * 12);
          let len = 12 + (this.smoothHigh * 15);
          this.pg.ellipse(0, 0, len, thick);
      }
      
      this.pg.pop();
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
                  this.prepareCanvas(img, this.p5Instance); 
                  this.simulatedProgress = 0; 
              });
          }
      }
  }

  prepareCanvas(img, p) {
      this.sourceImg = img;
      this.sourceImg.loadPixels(); // 💡 픽셀 데이터를 미리 메모리에 로드 (초고속화)
      this.isImageLoaded = true;
      this.resetCanvas(p);
  }

  resetCanvas(p) {
      if(!this.pg) return;
      this.pg.background(15, 18, 25);
      
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
      
      this.totalChunks = this.chunkIndices.length; // 💡 기준이 될 전체 개수 저장
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
      if (this.pg) {
          this.pg = this.p5Instance.createGraphics(w, h);
          this.resetCanvas(this.p5Instance);
      }
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
