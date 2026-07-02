export class AudioAnalyzer {
  constructor(fftSize = 2048) {
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.fftSize = fftSize;

    // 💡 동적 튜닝을 위한 상태 변수 기본값 선언
    this.bounds = {
      bassLow: 20,     bassHigh: 250,
      midLow: 250,     midHigh: 4000,
      trebleLow: 4000, trebleHigh: 16000
    };
  }

  init() {
    if (this.audioContext) return;
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8; 
    
    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);
  }

  connectAudioElement(audioElement) {
    this.init();
    if (this.source) {
      this.source.disconnect();
    }
    this.source = this.audioContext.createMediaElementSource(audioElement);
    this.source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  getAverageVolumeInRange(lowFreq, highFreq) {
    if (!this.analyser) return 0;

    const sampleRate = this.audioContext.sampleRate;
    const binCount = this.analyser.frequencyBinCount;
    const hzPerBin = sampleRate / this.fftSize; 

    const lowIndex = Math.floor(lowFreq / hzPerBin);
    const highIndex = Math.min(Math.floor(highFreq / hzPerBin), binCount - 1);

    if (lowIndex > highIndex) return 0;

    let sum = 0;
    let count = 0;

    for (let i = lowIndex; i <= highIndex; i++) {
      sum += this.dataArray[i];
      count++;
    }

    return count > 0 ? (sum / count) / 255 : 0;
  }

  /**
   * 💡 외부 슬라이더 조작 값을 분석기에 실시간 주입하는 메소드
   */
  updateBounds(newBounds) {
    this.bounds = { ...this.bounds, ...newBounds };
  }

  getAudioData() {
    if (!this.analyser) {
      return { volume: 0, bass: 0, mid: 0, treble: 0, subBass: 0, raw: [] };
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    let totalSum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      totalSum += this.dataArray[i];
    }
    const volume = (totalSum / this.dataArray.length) / 255;

    // 💡 고정 값이 아닌, 실시간 변형되는 this.bounds 값을 타도록 매핑 변경
    const subBass = this.getAverageVolumeInRange(20, 60);     
    const bass = this.getAverageVolumeInRange(this.bounds.bassLow, this.bounds.bassHigh);       
    const mid = this.getAverageVolumeInRange(this.bounds.midLow, this.bounds.midHigh);      
    const treble = this.getAverageVolumeInRange(this.bounds.trebleLow, this.bounds.trebleHigh);  

    return {
      volume: volume,
      subBass: subBass,
      bass: bass,
      mid: mid,
      treble: treble,
      raw: Array.from(this.dataArray)
    };
  }
}
