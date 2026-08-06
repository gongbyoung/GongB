/**
 * src/core/SketchManager.js
 * - [Fix] main.js의 manager.update() 수신 메서드 추가
 * - 001(파형): Real/Synthetic Waveform(TimeDomain) 데이터 완벽 보장
 * - 017, 018, 019: volume, overall, energy, level, bass, mid, treble 호환
 * - 004, 020: poemText, currentSubtitle, subtitles 동기화
 */

export class SketchManager {
  constructor(canvasContainerId) {
    this.container = typeof canvasContainerId === 'string'
      ? document.getElementById(canvasContainerId)
      : canvasContainerId;

    this.currentSketch = null;       
    this.animationFrameId = null;    
    this.currentSketchId = null;     
    this.lastAudioData = null;
  }

  async switchSketch(sketchFileName, audioAnalyzerInstance) {
    if (this.currentSketchId === sketchFileName) return;

    this.cleanup();

    const cleanFileName = sketchFileName.replace(/^sketches\//, '');

    try {
      const sketchModule = await import(`../sketches/${cleanFileName}`);
      
      this.currentSketch = new sketchModule.default(this.container);
      this.currentSketchId = sketchFileName;

      if (typeof this.currentSketch.init === 'function') {
        this.currentSketch.init();
      }

      console.log(`[🎯 Success] 스케치 로드 완료: ${cleanFileName}`);
    } catch (error) {
      console.error(`[❌ Error] 스케치 로드 실패 (${cleanFileName}):`, error);
    }
  }

  // =========================================================================
  // 💡 [핵심] main.js ticker에서 직접 호출하는 update() 데이터 수신부
  // =========================================================================
  update(rawAudioData) {
    if (!this.currentSketch) return;
    const normalized = this.normalizeAudioData(rawAudioData);
    if (typeof this.currentSketch.update === 'function') {
      this.currentSketch.update(normalized);
    }
  }

  normalizeAudioData(raw) {
    const data = raw || {};

    // 1. 4-Stem 및 1곡 음압 추출
    const vocal = data.vocalsVol ?? data.vocalVol ?? data.vocals ?? data.vocal ?? data.stems?.vocals ?? 0;
    const drum  = data.drumsVol  ?? data.drumVol  ?? data.drums  ?? data.drum  ?? data.stems?.drums  ?? 0;
    const bass  = data.bassVol   ?? data.bass     ?? data.low    ?? data.stems?.bass   ?? 0;
    const other = data.otherVol  ?? data.othersVol?? data.other  ?? data.guitar?? data.stems?.other  ?? 0;

    const mid    = data.mid ?? vocal;
    const treble = data.treble ?? data.high ?? other;
    
    const calcOverall = (vocal + drum + bass + other) / 4;
    const overall = (data.overall ?? data.volume ?? data.vol ?? calcOverall) || 0;

    // 2. 주파수 스펙트럼(spectrum) 정규화
    let spectrum = data.spectrum || data.frequencyData || data.freqData || data.dataArray || data.raw;

    if (spectrum && spectrum.length > 0) {
      if (spectrum instanceof Uint8Array || (typeof spectrum[0] === 'number' && spectrum[0] > 1.0)) {
        const normSpec = new Float32Array(spectrum.length);
        for (let i = 0; i < spectrum.length; i++) {
          normSpec[i] = spectrum[i] / 255.0;
        }
        spectrum = normSpec;
      }
    } else {
      const synSpec = new Float32Array(64);
      const t = Date.now() * 0.005;
      for (let i = 0; i < 64; i++) {
        let val = 0;
        if (i < 16) {
          const w = 1.0 - (i / 16);
          val = (bass * 0.7 + drum * 0.8) * (0.6 + 0.4 * Math.sin(t * 3 + i * 0.4)) * w;
        } else if (i < 42) {
          const w = 1.0 - Math.abs(i - 28) / 14;
          val = (vocal * 0.85) * (0.6 + 0.4 * Math.cos(t * 4 + i * 0.3)) * Math.max(0, w);
        } else {
          const w = (i - 42) / 22;
          val = (other * 0.85) * (0.6 + 0.4 * Math.sin(t * 5 + i * 0.5)) * Math.max(0, w);
        }
        synSpec[i] = Math.min(1.0, Math.max(0.01, val));
      }
      spectrum = synSpec;
    }

    // 3. 🎯 [001 파형 복구]: 실시간 TimeDomain PCM Waveform
    let waveform = data.waveform || data.timeDomainData || data.pcmData;
    if (!waveform || waveform.length === 0) {
      const waveLen = 128;
      const synWave = new Float32Array(waveLen);
      const t = Date.now() * 0.008;
      for (let i = 0; i < waveLen; i++) {
        const phase = (i / waveLen) * Math.PI * 4;
        synWave[i] = Math.sin(phase + t) * (0.3 + vocal * 0.7) +
                     Math.sin(phase * 2 - t * 1.5) * (bass * 0.5);
      }
      waveform = synWave;
    }

    // 4. 🎯 [004, 020 자막/타이포 복구]
    const poemText = window.cosmicEngineSettings?.poemText || window.poemText || "떠날 때의 님의 얼굴";
    const currentSub = window.currentSubtitleText || window.currentSubtitle || poemText;
    const srtList = window.currentSrtData || window.srtSubtitles || [];

    return {
      ...data,
      // 4-Stem 속성
      vocalsVol: vocal,
      drumsVol: drum,
      bassVol: bass,
      otherVol: other,
      vocal: vocal,
      drum: drum,
      other: other,
      // 🎯 [017, 018, 019 구버전 호환 속성]
      volume: overall,
      overall: overall,
      energy: overall,
      level: overall,
      bass: Math.max(bass, drum),
      mid: Math.max(mid, vocal),
      treble: Math.max(treble, other),
      low: Math.max(bass, drum),
      high: Math.max(treble, other),
      // 🎯 [001 배열 데이터]
      spectrum: spectrum,
      frequencyData: spectrum,
      waveform: waveform,
      timeDomainData: waveform,
      // 🎯 [004, 020 타이포/자막 속성]
      poemText: poemText,
      poem: poemText,
      srtData: srtList,
      subtitles: srtList,
      currentSubtitle: currentSub,
      subtitle: currentSub,
      isMultiStem: data.isMultiStem ?? true
    };
  }

  cleanup() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.currentSketch && typeof this.currentSketch.destroy === 'function') {
      this.currentSketch.destroy();
    }

    if (this.container) {
      this.container.innerHTML = '';
    }

    this.currentSketch = null;
    this.currentSketchId = null;

    console.log('[🧹 Clean-up] 이전 스케치 자원 해제 완료');
  }

  resize(width, height) {
    if (this.currentSketch && typeof this.currentSketch.resize === 'function') {
      this.currentSketch.resize(width, height);
    }
  }
}
