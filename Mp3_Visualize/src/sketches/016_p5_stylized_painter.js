/**
 * src/sketches/016_p5_stylized_painter.js
 * - UI 슬라이더(Seed, Scatter, Size, Gain) 조작 시 미리보기 캔버스 실시간 즉각 갱신
 * - 각 슬라이더의 값을 화풍별 브러시 물리 엔진에 완벽하게 매핑
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
    this.lastProgress = 0; 
    this.isPreviewMode = true; 

    // 💡 UI 상태 변화를 추적하기 위한 캐시 변수
    this.currentSettings = {
        style: 'neon',
        scatter: 2.2,
        gain: 1.0,
        seed: 42,
        glow: 0.25
    };
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

        // 1. 전역 UI 세팅값 로드
        let s_scatter = window.cosmicEngineSettings?.scatterExponent ?? 2.2;
        let s_gain = window.cosmicEngineSettings?.audioGain ?? 1.0;
        let s_seed = window.cosmicEngineSettings?.seed ?? 42;
        let s_glow = window.cosmicEngineSettings?.glowAmount ?? (window.cosmicEngineSettings?.size ?? 0.25);
        let s_style = window.cosmicEngineSettings?.colorStyle ?? 'neon';

        const audioEl = document.querySelector('audio');
        let isPlaying = audioEl && !audioEl.paused;
        
        // 💡 2. UI 슬라이더가 단 하나라도 변경되었는지 감지
        let settingsChanged = (
            this.currentSettings.style !== s_style ||
            this.currentSettings.scatter !== s_scatter ||
            this.currentSettings.gain !== s_gain ||
            this.currentSettings.seed !== s_seed ||
            this.currentSettings.glow !== s_glow
        );

        if (settingsChanged) {
            this.currentSettings = { style: s_style, scatter: s_scatter, gain: s_gain, seed: s_seed, glow: s_glow };
            
            if (!isPlaying) {
                // 음악 정지 상태에서 슬라이더를 만지면 즉시 미리보기 갱신
                this.resetCanvas(p, true);
            } else if (this.currentSettings.style !== s_style) {
                // 재생 중에는 다른 건 놔두고 '스타일'이 바뀔 때만 리셋
                this.resetCanvas(p, false);
            }
        }

        let progress = 0;
        if (audioEl && audioEl.duration) {
            progress = audioEl.currentTime / audioEl.duration;
        } else {
            if (isPlaying) this.simulatedProgress += 0.016 / 180.0;
            progress = this.simulatedProgress;
        }

        if (isPlaying && this.isPreviewMode) {
            this.resetCanvas(p, false); // 재생 버튼 누르는 순간 지우고 그리기 시작
        }

        if (progress < this.lastProgress) {
            this.resetCanvas(p, !isPlaying);
        }
        this.lastProgress = progress;

        let lowSum = 0, midSum = 0, highSum = 0;
        let lowCount = 0, midCount = 0, highCount = 0;

        for(let i = 2; i < 12; i++) { lowSum += this.currentAudioData.raw[i] || 0; lowCount++; }
        for(let i = 12; i < 35; i++) { midSum += this.currentAudioData.raw[i] || 0; midCount++; }
        for(let i = 35; i < 90; i++) { highSum += this.currentAudioData.raw[i] || 0; highCount++; }

        let targetLow = lowCount > 0 ? Math.pow((lowSum / lowCount) / 255.0, 1.5) : 0;
        let targetMid = midCount > 0 ? Math.pow((midSum / midCount) / 255.0, 1.5) : 0;
        let targetHigh = highCount > 0 ? Math.pow((highSum / highCount) / 255.0, 1.5) : 0;

        this.smoothLow += (targetLow * s_gain - this.smoothLow) * 0.2;
        this.smoothMid += (targetMid * s_gain - this.smoothMid) * 0.2;
        this.smoothHigh += (targetHigh * s_gain - this.smoothHigh) * 0.2;

        if (!this.isPreviewMode) {
            let targetCount = Math.floor(this.totalChunks * Math.min(1.0, progress / 0.8));
            let strokesToDraw = Math.max(0, targetCount - this.drawnCount);
            
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
                
                this.drawStylizedStroke(p, x, y, r, g, b, s_style);
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

                    this.drawStylizedStroke(p, x, y, r, g, b, s_style);
                }
            }
        }

        if (s_style === 'custom' && (progress >= 0.8 || this.isPreviewMode)) {
            this.drawOldPhotoEffect(p);
        }
      };
    };

    this.p5Instance = new window.p5(sketch, this.container);
  }

  // 💡 [핵심] 브러시 물리 엔진에 슬라이더 값 매핑
  drawStylizedStroke(p, x, y, r, g, b, style) {
      if (!this.pg) return;
      let brightness = (r + g + b) / 3;

      let scatterMod = this.currentSettings.scatter / 2.2;
      let sizeMod = Math.max(0.1, this.currentSettings.glow * 4.0); // Size 조절비율

      this.pg.push();
      this.pg.translate(x, y);

      // 분산범위(Scatter)가 높을수록 붓터치가 원래 위치에서 더 많이 어긋남
      let jitter = (p.random(-1, 1) * this.smoothHigh * 20 * scatterMod);
      this.pg.translate(jitter, jitter);

      if (style === 'monochrome') {
          this.pg.stroke(brightness + p.random(-20, 20)); 
          let weight = (0.5 + (this.smoothLow * 5)) * sizeMod; 
          this.pg.strokeWeight(weight);
          this.pg.noFill();
          let angle = p.noise(x * 0.01, y * 0.01) * p.PI * 2 + (this.smoothHigh * p.PI);
          this.pg.rotate(angle);
          
          let len = (p.map(brightness, 0, 255, 15, 2) + (this.smoothLow * 10)) * scatterMod;
          this.pg.line(-len/2, 0, len/2, 0);
          
      } else if (style === 'pastel') {
          this.pg.noStroke();
          this.pg.fill(r, g, b, 30 + this.smoothHigh * 50); 
          let radius = (8 + (this.smoothLow * 30)) * sizeMod; 
          this.pg.circle(p.random(-5, 5), p.random(-5, 5), radius);
          this.pg.circle(p.random(-2, 2), p.random(-2, 2), radius * 0.5);

      } else if (style === 'neon') {
          this.pg.noStroke();
          let maxColor = Math.max(r, g, b);
          let nr = r === maxColor ? 255 : r * 0.4;
          let ng = g === maxColor ? 255 : g * 0.4;
          let nb = b === maxColor ? 255 : b * 0.4;
          this.pg.fill(nr, ng, nb, 220);
          
          let w = (15 + (this.smoothLow * 25)) * sizeMod;
          let h = (5 + (this.smoothHigh * 10)) * sizeMod;
          this.pg.rotate(p.random(p.PI));
          this.pg.rectMode(p.CENTER);
          this.pg.rect(0, 0, w, h);

      } else if (style === 'custom') {
          this.pg.noStroke();
          this.pg.fill(r, g, b, 200);
          let angle = p.map(brightness, 0, 255, 0, p.PI);
          this.pg.rotate(angle);
          let thick = (4 + (this.smoothLow * 12)) * sizeMod;
          let len = (12 + (this.smoothHigh * 15)) * scatterMod;
          this.pg.ellipse(0, 0, len, thick);
      }
      
      this.pg.pop();
  }

  drawOldPhotoEffect(p) {
      p.noStroke();
      p.fill(60, 40, 20, 20); 
      p.rect(0, 0, p.width, p.height);

      let cx = p.width / 2;
      let cy = p.height / 2;
      let maxRadius = p.max(p.width, p.height);

      let gradient = p.drawingContext.createRadialGradient(cx, cy, maxRadius * 0.3, cx, cy, maxRadius * 0.8);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');     
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');   

      p.drawingContext.fillStyle = gradient;
      p.noStroke();
      p.rect(0, 0, p.width, p.height);

      if (this.smoothHigh > 0.15) {
          let scratchCount = Math.floor(p.random(2, 6));
          p.stroke(255, 255, 255, 30 + (this.smoothHigh * 50)); 
          p.strokeWeight(p.random(0.5, 1.5));

          for (let i = 0; i < scratchCount; i++) {
              let nx = p.random(p.width);
              let ny = p.random(p.height);
              let len = p.random(20, 100); 
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
      this.resetCanvas(p, true);
  }

  resetCanvas(p, isPreview = false) {
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
      this.isPreviewMode = isPreview;

      // 💡 미리보기 모드일 때 전체 그림 한 번에 렌더링
      if (isPreview && this.sourceImg) {
          // 지형변경(Seed) 연동: p5 난수 엔진 초기화
          p.randomSeed(this.currentSettings.seed);
          p.noiseSeed(this.currentSettings.seed);

          let tempLow = this.smoothLow, tempMid = this.smoothMid, tempHigh = this.smoothHigh;
          
          // 폭발력(Gain) 연동: 미리보기 시 음악이 최대로 터진 것처럼 가상 주파수 주입
          this.smoothLow = 0.5 * this.currentSettings.gain; 
          this.smoothMid = 0.5 * this.currentSettings.gain; 
          this.smoothHigh = 0.5 * this.currentSettings.gain;

          while (this.chunkIndices.length > 0) {
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
              
              this.drawStylizedStroke(p, x, y, r, g, b, this.currentSettings.style);
          }
          
          this.smoothLow = tempLow; this.smoothMid = tempMid; this.smoothHigh = tempHigh;
      }
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
          this.resetCanvas(this.p5Instance, this.isPreviewMode);
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
