/**
 * src/core/SketchManager.js
 * - [Fix] SyntaxError: Unexpected token 'export' ➔ Dynamic ESM import() 적용
 * - This file handles dynamic loading and switching of creative sketches.
 */

export class SketchManager {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`[SketchManager Error] Canvas element with id "${canvasId}" not found.`);
    }
    this.ctx = this.canvas.getContext('2d');
    this.currentSketch = null;
    this.currentFilename = null;
  }

  async switchSketch(filename, analyzer) {
    // filename: "sketches/025_fluid_ink_wash.js"
    if (this.currentFilename === filename) return;

    // Clean up the previous sketch
    if (this.currentSketch) {
      this.currentSketch.destroy();
      this.currentSketch = null;
    }

    this.currentFilename = filename;

        const mainBtn = document.getElementById('btn-play-music');
        mainBtn.innerText = "▶️ 음악 재생 (Play)";
        mainBtn.classList.remove('btn-pause');

    try {
      // 💡 [수리] 에러 원인 해결: 구형 script tag 동적 생성 대신
      // 현대적이고 네이티브한 ES 모듈 동적 import() 구문을 사용합니다.
      // The leading '../' assumes the manager is in src/core and filename starts with sketches/.
      const SketchModule = await import(`../${filename}`);
      const SketchClass = SketchModule.default;
      this.currentSketch = new SketchClass(this.ctx);

      // Connect audio analyzer if the sketch supports it
      if (this.currentSketch && typeof this.currentSketch.connectAudioAnalyzer === 'function') {
          this.currentSketch.connectAudioAnalyzer(analyzer);
      }

      console.log(`[Success] 스케치 로드 완료: ${filename}`);

    } catch (error) {
      // 콘솔에 빨간색 에러 메시지가 출력된 바로 그 위치입니다.
      console.error(`[Error] 스케치 로드 실패: (${filename}):`, error);
    }
  }

  update(audioData) {
    if (this.currentSketch && typeof this.currentSketch.update === 'function') {
      this.currentSketch.update(audioData);
    }
  }

  resize(w, h) {
    if (this.canvas) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    if (this.currentSketch && typeof this.currentSketch.resize === 'function') {
      this.currentSketch.resize(w, h);
    }
  }
}
