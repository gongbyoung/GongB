import { AudioAnalyzer } from './core/AudioAnalyzer.js';
import { SketchManager } from './core/SketchManager.js';
import { VideoRecorder } from './core/VideoRecorder.js';
import { WordVisualMatcher } from './core/WordVisualMatcher.js';
import { LyricSync } from './core/LyricSync.js';

const analyzer = new AudioAnalyzer();
const manager = new SketchManager('canvas-stage');
const recorder = new VideoRecorder('canvas-stage');

const audioPlayer = document.getElementById('audio-player');
const stageWrapper = document.getElementById('stage-wrapper');
const deckPlayBtn = document.getElementById('btn-play-music');

let isAudioAnalyzerConnected = false;

let audioCtx = null;
const stemBuffers = { vocals: null, drums: null, bass: null, other: null };
const stemSources = { vocals: null, drums: null, bass: null, other: null };
const stemAnalysers = { vocals: null, drums: null, bass: null, other: null };
let isMultiStemPlaying = false;

// DOM 요소 탐색 (다양한 ID 호환 대응)
const poemTextInput = document.getElementById('input-poem-text') || document.getElementById('poem-input');
const mainMp3Input = document.getElementById('file-main-mp3') || document.getElementById('file-main') || document.getElementById('file-mp3');
const batchMp3Input = document.getElementById('file-batch-mp3');
const batchStatusText = document.getElementById('batch-load-status');
const srtInput = document.getElementById('file-srt');

window.cosmicEngineSettings = window.cosmicEngineSettings || {};
window.cosmicEngineSettings.poemText = poemTextInput ? poemTextInput.value : "떠날 때의 님의 얼굴";
window.cosmicEngineSettings.exportRatio = "full";

// =========================================================================
// 💡 가사 단어 ↔ 스케치 자동 매칭 + SRT 타이밍 동기화
// =========================================================================
const wordMatcher = new WordVisualMatcher(manager, analyzer);

// 🎯 [Fix] getCurrentTime의 ... 생략 구문을 실제 동작 로직으로 교체하여 문법 에러 수리
const lyricSync = new LyricSync({
  wordMatcher,
  getCurrentTime: () => {
    if (isMultiStemPlaying && audioCtx) {
      return audioCtx.currentTime - (window.stemStartTime || audioCtx.currentTime);
    }
    return audioPlayer ? audioPlayer.currentTime : 0;
  },
  onCueChange: (cue) => {
    // 💡 틀글자(poemText)는 건드리지 않고, 오직 실시간 자막 변수만 업데이트
    window.currentSubtitleText = cue.text;
  },
});

srtInput?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await lyricSync.loadFromFile(file);
  lyricSync.start();
});

poemTextInput?.addEventListener('input', (e) => {
  const text = e.target.value || "떠날 때의 님의 얼굴";
  window.cosmicEngineSettings.poemText = text;
  window.currentSubtitleText = text;
  wordMatcher.applyForText(text);
});

wordMatcher.applyForText(window.cosmicEngineSettings.poemText);

function stopAllActiveStems() {
  Object.keys(stemSources).forEach(key => {
    if (stemSources[key]) {
      try { stemSources[key].stop(); } catch(e){}
      stemSources[key] = null;
    }
  });
  isMultiStemPlaying = false;
  if (deckPlayBtn) deckPlayBtn.innerText = "▶️ 음악 재생 (Play)";
}

async function safeDecodeAudio(file) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  const arrayBuffer = await file.arrayBuffer();
  return await audioCtx.decodeAudioData(arrayBuffer.slice(0));
}

// =========================================================================
// 🎯 메인 단일 MP3 업로드 감지
// =========================================================================
mainMp3Input?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  stopAllActiveStems();
  Object.keys(stemBuffers).forEach(key => stemBuffers[key] = null);

  const audioUrl = URL.createObjectURL(file);
  if (audioPlayer) {
    audioPlayer.src = audioUrl;
    audioPlayer.load();
  }

  isAudioAnalyzerConnected = false;

  if (batchStatusText) {
    batchStatusText.style.color = "#00ffcc";
    batchStatusText.innerHTML = `🎵 단일 MP3 로딩 완료: <strong>${file.name}</strong>`;
  }

  console.log(`[🎵 Main MP3 Loaded] ${file.name} 적용 완료!`);
});

// =========================================================================
// 🎯 4-Stem 분리 MP3 일괄 업로드 감지
// =========================================================================
batchMp3Input?.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  if (!files || files.length === 0) return;

  stopAllActiveStems();
  if (audioPlayer) audioPlayer.pause();

  if (batchStatusText) batchStatusText.innerText = "⏳ MP3 파일 고속 해독 중...";

  let loadedNames = { vocals: null, drums: null, bass: null, other: null, main: null };

  for (let file of files) {
    const name = file.name.toLowerCase();
    const createStemAnalyser = () => {
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      return analyser;
    };

    try {
      if (name.includes('vocal') || name.includes('보컬')) {
        stemBuffers.vocals = await safeDecodeAudio(file);
        stemAnalysers.vocals = createStemAnalyser();
        loadedNames.vocals = file.name;
      } else if (name.includes('drum') || name.includes('드럼')) {
        stemBuffers.drums = await safeDecodeAudio(file);
        stemAnalysers.drums = createStemAnalyser();
        loadedNames.drums = file.name;
      } else if (name.includes('bass') || name.includes('베이스')) {
        stemBuffers.bass = await safeDecodeAudio(file);
        stemAnalysers.bass = createStemAnalyser();
        loadedNames.bass = file.name;
      } else if (name.includes('other') || name.includes('기타') || name.includes('inst')) {
        stemBuffers.other = await safeDecodeAudio(file);
        stemAnalysers.other = createStemAnalyser();
        loadedNames.other = file.name;
      } else if (!loadedNames.main) {
        if (audioPlayer) {
          audioPlayer.src = URL.createObjectURL(file);
          audioPlayer.load();
        }
        loadedNames.main = file.name;
      }
    } catch (err) {
      console.error(`[Audio Decode Error] ${file.name} 변환 실패:`, err);
    }
  }

  let summaryHtml = "✅ <strong>인식 완료 목록:</strong><br>";
  if (loadedNames.vocals) summaryHtml += `🎤 보컬: ${loadedNames.vocals}<br>`;
  if (loadedNames.drums)  summaryHtml += `🥁 드럼: ${loadedNames.drums}<br>`;
  if (loadedNames.bass)   summaryHtml += `🎸 베이스: ${loadedNames.bass}<br>`;
  if (loadedNames.other)  summaryHtml += `🎹 기타: ${loadedNames.other}<br>`;

  if (batchStatusText) {
    batchStatusText.style.color = "#00ffcc";
    batchStatusText.innerHTML = summaryHtml;
  }

  if (stemBuffers.vocals || stemBuffers.drums || stemBuffers.bass || stemBuffers.other) {
    toggleMultiStemPlayback();
  }
});

async function toggleMultiStemPlayback() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  
  if (isMultiStemPlaying) {
    stopAllActiveStems();
  } else {
    if (audioPlayer) audioPlayer.pause();

    const startTargetTime = audioCtx.currentTime + 0.05;
    window.stemStartTime = startTargetTime;
    let loadedCount = 0;

    Object.keys(stemBuffers).forEach(key => {
      if (stemBuffers[key]) {
        loadedCount++;
        const source = audioCtx.createBufferSource();
        source.buffer = stemBuffers[key];
        source.connect(stemAnalysers[key]);
        stemAnalysers[key].connect(audioCtx.destination);
        source.start(startTargetTime);
        stemSources[key] = source;
      }
    });

    if (loadedCount === 0) {
      alert("MP3 스템 파일 변환 중입니다. 잠시 후 다시 시작해주세요!");
      return;
    }
    isMultiStemPlaying = true;
    if (deckPlayBtn) deckPlayBtn.innerText = "⏸️ 음악 일시정지 (Pause)";
  }
}

if (deckPlayBtn) {
  deckPlayBtn.addEventListener('click', () => {
    const hasStems = Object.values(stemBuffers).some(b => b !== null);
    if (hasStems) {
      toggleMultiStemPlayback();
    } else if (audioPlayer) {
      if (audioPlayer.paused) {
        audioPlayer.play().then(() => {
          deckPlayBtn.innerText = "⏸️ 음악 일시정지 (Pause)";
          if (!isAudioAnalyzerConnected) {
            try { analyzer.connectAudioElement(audioPlayer); } catch (err) {}
            isAudioAnalyzerConnected = true;
          }
        }).catch(e => console.warn("오디오 플레이 에러:", e));
      } else {
        audioPlayer.pause();
        deckPlayBtn.innerText = "▶️ 음악 재생 (Play)";
      }
    }
  });
}

function getStemVolume(analyser) {
  if (!analyser) return 0;
  try {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let maxVal = 0, sum = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] > maxVal) maxVal = data[i];
      sum += data[i];
    }
    const avg = (sum / data.length) / 255.0;
    const peak = maxVal / 255.0;
    return Math.min(1.0, (avg * 0.3 + peak * 0.7) * 4.0);
  } catch (e) {
    return 0;
  }
}

function getMergedTimeDomainWaveform() {
  const wave = new Float32Array(128);
  let activeAnalysers = Object.values(stemAnalysers).filter(a => a !== null);
  
  if (activeAnalysers.length > 0) {
    const temp = new Uint8Array(128);
    activeAnalysers[0].getByteTimeDomainData(temp);
    for (let i = 0; i < 128; i++) {
      wave[i] = (temp[i] - 128) / 128.0;
    }
  }
  return wave;
}

// 💡 60FPS 메인 렌더링 틱 엔진
function renderEngineTicker() {
  requestAnimationFrame(renderEngineTicker);

  let compiledAudioData = { bass: 0, mid: 0, treble: 0, vol: 0, raw: new Uint8Array(256), waveform: new Float32Array(128) };
  
  try {
    if (isAudioAnalyzerConnected && analyzer) {
      if (typeof analyzer.getAudioData === 'function') {
        compiledAudioData = analyzer.getAudioData();
      } else if (analyzer.analyser) {
        const bufferLength = analyzer.analyser.frequencyBinCount || 256;
        const dataArray = new Uint8Array(bufferLength);
        analyzer.analyser.getByteFrequencyData(dataArray);
        compiledAudioData.raw = dataArray;
        
        let b = 0, m = 0, t = 0;
        for (let i = 0; i < 20; i++) b += (dataArray[i] || 0);
        for (let i = 20; i < 100; i++) m += (dataArray[i] || 0);
        for (let i = 100; i < 220; i++) t += (dataArray[i] || 0);
        compiledAudioData.bass = (b / 20) / 255.0;
        compiledAudioData.mid = (m / 80) / 255.0;
        compiledAudioData.treble = (t / 120) / 255.0;
        compiledAudioData.vol = (b + m + t) / 220 / 255.0;
      }
    }

    if (isMultiStemPlaying) {
      compiledAudioData.isMultiStem = true;
      compiledAudioData.vocalsVol = getStemVolume(stemAnalysers.vocals);
      compiledAudioData.drumsVol  = getStemVolume(stemAnalysers.drums);
      compiledAudioData.bassVol   = getStemVolume(stemAnalysers.bass);
      compiledAudioData.otherVol  = getStemVolume(stemAnalysers.other);
      compiledAudioData.waveform  = getMergedTimeDomainWaveform();
    } else {
      compiledAudioData.isMultiStem = false;
      compiledAudioData.vocalsVol = Math.min(1.0, (compiledAudioData.mid || 0) * 3.5);
      compiledAudioData.drumsVol  = Math.min(1.0, (compiledAudioData.bass || 0) * 4.0);
      compiledAudioData.bassVol   = Math.min(1.0, (compiledAudioData.bass || 0) * 3.5);
      compiledAudioData.otherVol  = Math.min(1.0, (compiledAudioData.treble || 0) * 3.5);
    }

    window.latestCompiledAudioData = compiledAudioData;
    
    if (manager && typeof manager.update === 'function') {
      manager.update(compiledAudioData);
    }
  } catch (err) {
    // 에러 방어
  }
}

const cosmicControls = {
  numSeed: document.getElementById('num-cosmic-seed'), numScatter: document.getElementById('num-cosmic-scatter'),
  color: document.getElementById('select-cosmic-color'), numGlow: document.getElementById('num-cosmic-glow'),
  numGain: document.getElementById('num-cosmic-gain'), pickGas1: document.getElementById('picker-gas1'),
  pickGas2: document.getElementById('picker-gas2'), pickStar: document.getElementById('picker-star'),
  numGauge: document.getElementById('num-cosmic-gauge')
};

function syncCosmicControls() {
  if (!cosmicControls.numSeed) return;
  window.cosmicEngineSettings = {
    ...window.cosmicEngineSettings,
    seed: parseInt(cosmicControls.numSeed.value),
    scatterExponent: parseFloat(cosmicControls.numScatter.value) / 10,
    colorStyle: cosmicControls.color.value,
    glowIntensity: parseFloat(cosmicControls.numGlow.value) / 100,
    audioGain: (parseFloat(cosmicControls.numGain.value) || 10) / 10,
    customColors: { gas1: cosmicControls.pickGas1.value, gas2: cosmicControls.pickGas2.value, star: cosmicControls.pickStar.value },
    gaugeValue: parseInt(cosmicControls.numGauge.value) / 100
  };
}

Object.values(cosmicControls).forEach(el => { el?.addEventListener('input', syncCosmicControls); });

document.querySelectorAll('.btn-export-ratio, [data-ratio]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const ratio = e.currentTarget.getAttribute('data-ratio') || e.currentTarget.innerText.trim();
    window.cosmicEngineSettings.exportRatio = ratio;
    console.log(`[📐 Export Ratio Changed] ${ratio}`);
  });
});

const sketchListContainer = document.getElementById('sketch-list');
if (sketchListContainer) {
  sketchListContainer.addEventListener('click', async (e) => {
    const targetLi = e.target.closest('li[data-sketch]');
    if (!targetLi) return;

    document.querySelectorAll('#sketch-list li').forEach(li => li.classList.remove('active'));
    targetLi.classList.add('active');

    const targetSketch = targetLi.getAttribute('data-sketch');
    try {
      await manager.switchSketch(targetSketch, analyzer);
      syncCosmicControls();
    } catch(err) {
      console.error(`[Sketch Switch Error] ${targetSketch} 로딩 실패:`, err);
    }
  });
}

const activeLi = document.querySelector('#sketch-list li.active');
const initSketch = activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js';
syncCosmicControls();
manager.switchSketch(initSketch, analyzer).then(() => {
  renderEngineTicker();
}).catch(err => {
  renderEngineTicker();
});

window.addEventListener('resize', () => manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight));
