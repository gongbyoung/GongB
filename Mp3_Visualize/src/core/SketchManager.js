/**
 * src/core/SketchManager.js
 * - [Fix] TypeError: getContext is not a function 호환성 수리
 * - canvas-stage가 <div> 컨테이너든 <canvas>든 안전하게 자동 판별
 */

export class SketchManager {
  constructor(containerId) {
    this.container = typeof containerId === 'string' 
      ? document.getElementById(containerId) 
      : containerId;

    if (!this.container) {
      console.error(`[SketchManager Error] "${containerId}" 엘리먼트를 찾을 수 없습니다.`);
    }

    // 💡 <canvas> 태그인지 <div> 컨테이너인지 안전하게 판별
    this.isCanvas = this.container && this.container.tagName === 'CANVAS';
    this.ctx = this.isCanvas ? this.container.getContext('2d') : null;

    this.currentSketch = null;
    this.currentFilename = null;
  }

  async switchSketch(filename, analyzer) {
    if (this.currentFilename === filename) return;

    // 이전 스케치 안전하게 제거
    if (this.currentSketch) {
      if (typeof this.currentSketch.destroy === 'function') {
        this.currentSketch.destroy();
      }
      this.currentSketch = null;
    }

    this.currentFilename = filename;

    try {
      // ESM 모듈 동적 로드
      const SketchModule = await import(`../${filename}`);
      const SketchClass = SketchModule.default;

      // 스케치 생성 (컨테이너 타입에 따라 안전 전달)
      this.currentSketch = new SketchClass(this.isCanvas ? this.ctx : this.container);

      if (this.currentSketch && typeof this.currentSketch.connectAudioAnalyzer === 'function') {
        this.currentSketch.connectAudioAnalyzer(analyzer);
      }

      console.log(`[Success] 스케치 로드 완료: ${filename}`);
    } catch (error) {
      console.error(`[Error] 스케치 로드 실패: (${filename}):`, error);
    }
  }

  update(audioData) {
    if (this.currentSketch && typeof this.currentSketch.update === 'function') {
      this.currentSketch.update(audioData);
    }
  }

  resize(w, h) {
    if (this.isCanvas && this.container) {
      this.container.width = w;
      this.container.height = h;
    }
    if (this.currentSketch && typeof this.currentSketch.resize === 'function') {
      this.currentSketch.resize(w, h);
    }
  }
}
