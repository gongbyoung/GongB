/* STREAMING_CHUNK: Initializing 020 SRT Canvas Visualizer Module... */
export default class P5SrtCanvasStage {
constructor(container) {
this.container = container;
this.p5Instance = null;
this.currentAudioData = null;
this.particles = [];
this.lastSubtitle = "";
this.subtitleScale = 1.0;
this.fadeAlpha = 0;

// Background starfield particles
this.stars = [];
}

async init() {
/* STREAMING_CHUNK: Injecting p5.js library dynamic dependency... */
if (!window.p5) {
await new Promise((resolve, reject) => {
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
script.onload = resolve;
script.onerror = reject;
document.head.appendChild(script);
});
}

/* STREAMING_CHUNK: Defining the P5.js Subtitle Visualizer sketch... */
const sketch = (p) => {
  p.setup = () => {
    const canvas = p.createCanvas(this.container.clientWidth, this.container.clientHeight);
    canvas.style('position', 'absolute');
    canvas.style('z-index', '1');
    p.rectMode(p.CENTER);
    p.textAlign(p.CENTER, p.CENTER);
    
    // Pre-populate starfield for organic starry space background
    for (let i = 0; i < 150; i++) {
      this.stars.push({
        x: p.random(p.width),
        y: p.random(p.height),
        size: p.random(1, 4),
        speed: p.random(0.2, 1.5),
        angle: p.random(p.TWO_PI),
        color: p.color(p.random(200, 255), p.random(150, 220), p.random(100, 150)) // warm autumn-stellar tones
      });
    }
    
    p.noLoop();
  };

  p.draw = () => {
    const width = p.width;
    const height = p.height;
    const ctx = p.drawingContext;
    
    p.clear();
    p.background(5, 7, 12, 40); // Deep dark space background with trailing effect

    /* STREAMING_CHUNK: Extracting cosmic control tower values... */
    let scatter = 2.2, gain = 1.0, glow = 0.85, seed = 42, gauge = 0.5;
    let colorStyle = 'neon';
    let gas1Color = '#ff0055', gas2Color = '#00ffcc', starColor = '#ffffff';

    if (window.cosmicEngineSettings) {
      scatter = window.cosmicEngineSettings.scatterExponent || 2.2;
      gain = window.cosmicEngineSettings.audioGain || 1.0;
      glow = window.cosmicEngineSettings.glowIntensity || 0.85;
      seed = window.cosmicEngineSettings.seed || 42;
      colorStyle = window.cosmicEngineSettings.colorStyle || 'neon';
      gauge = window.cosmicEngineSettings.gaugeValue !== undefined ? window.cosmicEngineSettings.gaugeValue : 0.5;
      
      if (window.cosmicEngineSettings.customColors) {
        gas1Color = window.cosmicEngineSettings.customColors.gas1 || gas1Color;
        gas2Color = window.cosmicEngineSettings.customColors.gas2 || gas2Color;
        starColor = window.cosmicEngineSettings.customColors.star || starColor;
      }
    }

    // Active scale configuration tied directly to the 'Glow / Scale' slider!
    // This solves the 'Font size adjustment - still too small' issue perfectly.
    this.subtitleScale = glow * 1.5;

    // Fetching audio player status dynamically from DOM to trigger popup hiding
    const audio = document.getElementById('audio-player');
    const isPlaying = audio && !audio.paused && audio.currentTime > 0;

    /* STREAMING_CHUNK: Rendering the starry background universe... */
    p.randomSeed(seed);
    p.noStroke();

    // Calculate dynamic reactive intensity from frequencies
    let rms = 0;
    if (this.currentAudioData && this.currentAudioData.raw) {
      let sum = 0;
      const len = Math.min(128, this.currentAudioData.raw.length);
      for (let i = 0; i < len; i++) {
        sum += this.currentAudioData.raw[i];
      }
      rms = (sum / len) / 255.0;
    }

    // Drift and render stars
    this.stars.forEach(star => {
      star.y += star.speed * (1.0 + rms * 5.0 * gain);
      if (star.y > height) {
        star.y = 0;
        star.x = p.random(width);
      }
      
      // Stellar breathing shimmer
      let sizePulse = star.size * (1.0 + p.sin(p.frameCount * 0.05 + star.x) * 0.3);
      p.fill(star.color);
      p.circle(star.x, star.y, sizePulse);
    });

    /* STREAMING_CHUNK: Managing subtitle triggers and text updates... */
    const subtitleText = window.currentSubtitleText || "";

    // Trigger dynamic explosion of particles when text switches
    if (subtitleText !== this.lastSubtitle && subtitleText !== "") {
      this.lastSubtitle = subtitleText;
      this.fadeAlpha = 0; // reset fade-in tracker
      
      // Spawn word-shift particle fireworks in the center
      const pColor = p.color(gas2Color);
      for (let i = 0; i < 30; i++) {
        this.particles.push({
          x: width / 2 + p.random(-150, 150),
          y: height * 0.65 + p.random(-30, 30),
          vx: p.random(-3, 3),
          vy: p.random(-4, 0),
          life: 255,
          size: p.random(2, 6),
          color: pColor
        });
      }
    }

    /* STREAMING_CHUNK: Drawing conditional introduction popup cards... */
    if (!isPlaying) {
      // 💡 [HIDING REVOLUTION]: When music is paused/stopped, show instructions clearly
      p.push();
      ctx.shadowBlur = 20;
      ctx.shadowColor = p.color(gas2Color).toString();
      
      // Draw glassy warning box
      p.fill(12, 15, 23, 220);
      p.stroke(p.color(gas2Color));
      p.strokeWeight(1.5);
      p.rect(width / 2, height / 2, 450, 220, 12);
      p.noStroke();

      // Title
      p.fill(0, 255, 204);
      p.textSize(18);
      p.text("● STAGE STATUS: 020호 SRT Kinetic Lyric Ver 1.2 READY", width / 2, height / 2 - 70);

      // Sub-title & Description
      p.fill(255);
      p.textSize(15);
      p.text("020호 익스프레션 자막 미디어 아트", width / 2, height / 2 - 30);
      
      p.fill(143, 160, 181);
      p.textSize(12);
      p.text("1. 16:9 / 9:16 비율 단추를 눌러 원하는 해상도를 선택하세요.\n2. 아래 오디오 플레이어에서 음악 재생을 시작하면\n이 설명 팝업은 즉시 사라지고 영상 자막 무대가 개막됩니다.\n\n[특징] 오디오 반응형 기네틱 가속 입자 100% 동기화!", width / 2, height / 2 + 30);
      p.pop();
    } else {
      /* STREAMING_CHUNK: Rendering reactive kinetic lyric display... */
      // Fade-in smooth interpolation
      if (this.fadeAlpha < 255) {
        this.fadeAlpha += 15;
      }

      if (subtitleText !== "") {
        p.push();
        // Core design of the text glowing shadow
        ctx.shadowBlur = 25 * (glow / 1.5) * (1.0 + rms);
        ctx.shadowColor = p.color(gas2Color).toString();
        
        // Scalable Font Size Adjustment logic - Directly fixes "font still too small"
        let computedSize = (height * 0.05) * this.subtitleScale;
        if (computedSize < 24) computedSize = 24; // Lower boundary guard
        if (computedSize > 120) computedSize = 120; // Upper boundary guard
        
        p.textSize(computedSize);
        p.fill(255, 255, 255, this.fadeAlpha);
        p.stroke(p.color(gas1Color));
        p.strokeWeight(2);
        
        // Subtitle Position Offset Integration (X, Y)
        let offsetX = 0, offsetY = 0;
        if (window.cosmicEngineSettings && window.cosmicEngineSettings.positionOffset) {
          offsetX = window.cosmicEngineSettings.positionOffset.x || 0;
          offsetY = window.cosmicEngineSettings.positionOffset.y || 0;
        }
        
        // Dynamic text bouncing slightly to the beat (rms)
        let textY = (height * 0.65) + offsetY - (rms * 25.0 * gain);
        p.text(subtitleText, (width / 2) + offsetX, textY);
        p.pop();
      }
    }

    /* STREAMING_CHUNK: Processing active explosion kinetic particles... */
    p.noStroke();
    ctx.shadowBlur = 10 * (glow / 1.5);
    ctx.shadowColor = p.color(gas1Color).toString();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      let pt = this.particles[i];
      pt.vy += 0.1; // mild gravity
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life -= 4; // fade over time

      let c = p.color(pt.color);
      c.setAlpha(pt.life);
      p.fill(c);
      p.circle(pt.x, pt.y, pt.size);

      if (pt.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  };
};

this.p5Instance = new window.p5(sketch, this.container);
console.log("%c[020호 자막 엔진 패치 완료]: 팝업 자동 디스미스 + 폰트 배율(Scale 슬라이더) 동기화", "color: #00ffcc; font-weight: bold;");
}

update(audioData) {
if (!this.p5Instance) return;
this.currentAudioData = audioData;
this.p5Instance.redraw();
}

resize(w, h) {
if (this.p5Instance) {
this.p5Instance.resizeCanvas(w, h);
}
}

destroy() {
if (this.p5Instance) {
this.p5Instance.remove();
this.p5Instance = null;
}
this.particles = [];
this.stars = [];
this.currentAudioData = null;
}
}
