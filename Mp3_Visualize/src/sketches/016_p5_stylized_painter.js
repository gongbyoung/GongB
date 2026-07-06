/**
 * src/sketches/016_p5_stylized_painter.js
 * - 블랙스크린 버그 해결 및 loadPixels 최적화 유지
 * - [교정] 양파링 비네팅 -> 부드러운 진짜 그라데이션 비네팅으로 변경
 * - [교정] 모니터 깨짐 세로선 -> 미세하고 자연스러운 필름 스크래치로 변경
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
    this.pg = null; 
    this.chunkIndices = [];
    this.totalChunks = 0; 
    this.drawnCount = 0;
    this.isImageLoaded = false;
    
    this.simulatedProgress = 0; 
    this.currentStyle = '';
    
    this.lastProgress = 0; 
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
        
        this.pg = p.createGraphics(p.width, p.height);
        this.pg.background(15, 18, 25); 
        
        p.loadImage('https://picsum.photos/seed/cosmic/800/600', (img) => {
            if(!this.isImageLoaded) this.prepareCanvas(img, p);
        });
        
        p.noLoop(); 
      };

      p.draw = () => {
        p.clear();
        if (this.pg) p.image(this.pg, 0, 0); 

        if (!this.currentAudioData || !this.isImageLoaded) {
            this.drawDropUI(p);
            return;
        }

        let scatter = 2.2, gain = 1.0;
        let colorStyle = 'neon';
        if (window.cosmicEngineSettings) {
          scatter = window.cosmicEngineSettings.scatterExponent || 2.2;
          gain = window.cosmicEngineSettings.audioGain || 1.0;
          colorStyle = window.cosmicEngineSettings.colorStyle || 'neon';
        }

        if (this.currentStyle !== colorStyle) {
            this.currentStyle = colorStyle;
            this.resetCanvas(p); 
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

        if (progress < this.lastProgress) {
            this.resetCanvas(p);
        }
        this.lastProgress = progress;

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
            
            let pIndex = (imgY * this.sourceImg.width + imgX) * 4;
            let r = this.sourceImg.pixels[pIndex];
            let g = this.sourceImg.pixels[pIndex + 1];
            let b = this.sourceImg.pixels[pIndex + 2];
            
            this.drawStylizedStroke(p, x, y, r, g, b, colorStyle);
        }

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

        // 💡 80% 진행 시 오래된 사진 필터 발동
        if (colorStyle === 'custom' && progress >= 0.8) {
            this.drawOldPhotoEffect(p);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

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

  // 💡 [수정됨] 오래된 사진 필터 그리기
  drawOldPhotoEffect(p) {
      // 1. 전체적으로 빛바랜 따뜻한 세피아 톤 베이스를 아주 옅게 깝니다.
      p.noStroke();
      p.fill(60, 40, 20, 20); 
      p.rect(0, 0, p.width, p.height);

      // 2. 부드러운 방사형(Radial) 그라데이션 비네팅 (양파링 제거)
      let cx = p.width / 2;
      let cy = p.height / 2;
      let maxRadius = p.max(p.width, p.height);

      let gradient = p.drawingContext.createRadialGradient(cx, cy, maxRadius * 0.3, cx, cy, maxRadius * 0.8);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');     // 렌즈 중앙은 완전 투명
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');   // 가장자리로 갈수록 부드러운 검은 그림자

      p.drawingContext.fillStyle = gradient;
      p.noStroke();
      p.rect(0, 0, p.width, p.height);

      // 3. 미세하고 짧은 빈티지 필름 스크래치 (모니터 깨짐 제거)
      if (this.smoothHigh > 0.15) {
          // 한 프레임당 2~5개 정도의 얇고 투명한 스크래치만 무작위 생성
          let scratchCount = Math.floor(p.random(2, 6));
          p.stroke(255, 255, 255, 30 + (this.smoothHigh * 50)); 
          p.strokeWeight(p.random(0.5, 1.5));

          for (let i = 0; i < scratchCount; i++) {
              let nx = p.random(p.width);
              let ny = p.random(p.height);
              let len = p.random(20, 100); // 쫙쫙 긋지 않고 짧은 선으로 제한
              p.line(nx, ny, nx, ny + len);
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

  handleDragOver(e) { e.preventDefault(); }

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
      this.sourceImg.loadPixels(); 
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
      
      this.totalChunks = this.chunkIndices.length; 
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
