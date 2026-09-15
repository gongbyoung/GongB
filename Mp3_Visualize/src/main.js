/**
 * ============================================================================
 * 🚨 [CRITICAL CORE] main.js 절대 보호 구역 안내서 🚨
 * ============================================================================
 * 아래 명시된 변수, 함수, DOM 선택자들은 001~029번까지의 모든 스케치 파일과 
 * index.html의 UI가 정상 작동하기 위한 뼈대(Architecture)입니다. 
 * 임의로 이름(변수명/함수명)을 변경하거나 삭제할 경우 치명적인 오작동이 발생합니다.
 * 
 * [1. 절대 변경 금지: 전역(Global) 변수 및 상태 객체]
 * - window.cosmicEngineSettings : 관제탑(우측 패널)의 모든 슬라이더/컬러/비율 설정값 저장소
 * - window.latestCompiledAudioData : 001~029 스케치가 공통으로 받아가는 오디오 4-Stem/주파수 데이터
 * - window.currentSubtitleText : SRT에서 추출된 현재 자막 텍스트 (스케치 내부에서 호출됨)
 * - window.currentUploadedImageElement : 업로드된 배경 이미지 객체 (019, 020, 029 등에 BG로 깔림)
 * 
 * [2. 절대 변경 금지: 핵심 오디오 & 렌더링 파이프라인 함수]
 * - initAudioContext() & safeDecodeAudio() : 브라우저 오디오 정책 우회 및 다중 스템 해독기
 * - toggleMultiStemPlayback() : 4-Stem(보컬,드럼,베이스,기타) 오디오 동기화 재생 엔진
 * - renderEngineTicker() : 초당 60프레임으로 오디오 데이터를 쪼개어 각 스케치의 update()로 쏴주는 심장부
 * 
 * [3. 절대 변경 금지: 스마트 방어 가드 로직]
 * - isUserManualClick & manager.switchSketch() 오버라이드 로직 : 
 *   자막/단어 매칭에 의해 스케치가 멋대로 튀어버리는 것을 막고, 사용자가 직접 클릭했을 때만 넘어가게 하는 방어벽
 * 
 * [4. 절대 변경 금지: index.html DOM 연결 ID]
 * - 'audio-player', 'stage-wrapper', 'btn-play-music', 'select-poem-font', '.btn-export-ratio' 등
 * ============================================================================
 */
/**
 * ============================================================================
 * 🚨 [CRITICAL CORE] main.js 절대 보호 구역 안내서 🚨
 * ============================================================================
 */

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
let delayNode = null;

const stemBuffers = { vocals: null, drums: null, bass: null, other: null };
const stemSources = { vocals: null, drums: null, bass: null, other: null };
const stemAnalysers = { vocals: null, drums: null, bass: null, other: null };
let isMultiStemPlaying = false;

const poemTextInput = document.getElementById('input-poem-text') || document.getElementById('poem-input');
const batchMp3Input = document.getElementById('file-batch-mp3');
const batchStatusText = document.getElementById('batch-load-status');
const srtInput = document.getElementById('file-srt');

const fontSelect = document.getElementById('select-poem-font');
const customFontInput = document.getElementById('file-custom-font');

window.cosmicEngineSettings = window.cosmicEngineSettings || {};
window.cosmicEngineSettings.poemText = poemTextInput ? poemTextInput.value : "떠날 때의 님의 얼굴";
window.cosmicEngineSettings.exportRatio = "full";
window.cosmicEngineSettings.lockSketch = true; 
window.cosmicEngineSettings.fontFamily = fontSelect ? fontSelect.value : "Noto Sans KR";

window.currentUploadedImageElement = null;

// 💡 [자막 On/Off 토글 로직 추가]
window.cosmicEngineSettings.showSubtitle = true; // 기본값은 켜짐
const btnToggleSubtitle = document.getElementById('btn-toggle-subtitle');

if (btnToggleSubtitle) {
  btnToggleSubtitle.addEventListener('click', () => {
    window.cosmicEngineSettings.showSubtitle = !window.cosmicEngineSettings.showSubtitle;
    if (window.cosmicEngineSettings.showSubtitle) {
      btnToggleSubtitle.innerText = "👁️ 자막 끄기 (Hide Subtitle)";
      btnToggleSubtitle.style.color = "#00ffcc";
    } else {
      btnToggleSubtitle.innerText = "🙈 자막 켜기 (Show Subtitle)";
      btnToggleSubtitle.style.color = "#ff4444";
    }
  });
}

// 🔤 [수리 완료]: 폰트 선택 드롭다운 연동
fontSelect?.addEventListener('change', (e) => {
  window.cosmicEngineSettings.fontFamily = e.target.value;
});

// 🔤 [수리 완료]: 내 컴퓨터 TTF/OTF 파일 업로드 연동 및 알림창 추가
customFontInput?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const fontName = `CustomFont_${Date.now()}`;
  const fontUrl = URL.createObjectURL(file);
  
  try {
    const fontFace = new FontFace(fontName, `url("${fontUrl}")`);
    await fontFace.load();
    document.fonts.add(fontFace);
    window.cosmicEngineSettings.fontFamily = fontName;
    alert(`[폰트 적용 성공] ${file.name} 폰트가 화면에 적용되었습니다!`);
  } catch (err) {
    console.error("Font Load Error:", err);
    alert("폰트 파일을 읽을 수 없습니다. 지원되는 TTF/OTF 파일인지 확인해주세요.");
  }
});

const wordMatcher = new WordVisualMatcher(manager, analyzer);

const lyricSync = new LyricSync({
  wordMatcher,
  getCurrentTime: () => {
    if (isMultiStemPlaying && audioCtx) {
      return audioCtx.currentTime - (window.stemStartTime || audioCtx.currentTime);
    }
    return audioPlayer ? audioPlayer.currentTime : 0;
  },
  onCueChange: (cue) => {
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
  if (!window.cosmicEngineSettings.lockSketch) {
    wordMatcher.applyForText(text);
  }
});

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

async function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  if (!delayNode) {
    delayNode = audioCtx.createDelay(2.0);
    delayNode.delayTime.value = 0.0;
    delayNode.connect(audioCtx.destination);
  }
}

async function safeDecodeAudio(file) {
  await initAudioContext();
  const arrayBuffer = await file.arrayBuffer();
  return await audioCtx.decodeAudioData(arrayBuffer.slice(0));
}

function updateAudioDelayForSketch(sketchFileName) {
  if (!delayNode) return;
  if (sketchFileName && sketchFileName.includes('028')) {
    delayNode.delayTime.value = 1.0;
  } else {
    delayNode.delayTime.value = 0.0;
  }
}

document.querySelectorAll('input[type="file"]').forEach(input => {
  if (input.id === 'file-srt' || input.id === 'file-batch-mp3' || input.id === 'file-custom-font') return;

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.includes('image')) {
      const img = new Image();
      img.onload = () => {
        window.currentUploadedImageElement = img;
        console.log("[🖼️ Image Loaded]: 배경 이미지 적용 완료");
      };
      img.src = URL.createObjectURL(file);
      return;
    }

    if (file.type.includes('audio') || file.name.toLowerCase().endsWith('.mp3') || file.name.toLowerCase().endsWith('.wav')) {
      stopAllActiveStems();
      Object.keys(stemBuffers).forEach(key => stemBuffers[key] = null);

      const audioUrl = URL.createObjectURL(file);
      if (audioPlayer) {
        audioPlayer.src = audioUrl;
        audioPlayer.load();
      }
      isAudioAnalyzerConnected = false;
    }
  });
});

batchMp3Input?.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  if (!files || files.length === 0) return;

  stopAllActiveStems();
  if (audioPlayer) audioPlayer.pause();

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
      } else if (name.includes('drum') || name.includes('드럼')) {
        stemBuffers.drums = await safeDecodeAudio(file);
        stemAnalysers.drums = createStemAnalyser();
      } else if (name.includes('bass') || name.includes('베이스')) {
        stemBuffers.bass = await safeDecodeAudio(file);
        stemAnalysers.bass = createStemAnalyser();
      } else if (name.includes('other') || name.includes('기타') || name.includes('inst')) {
        stemBuffers.other = await safeDecodeAudio(file);
        stemAnalysers.other = createStemAnalyser();
      }
    } catch (err) {}
  }

  if (stemBuffers.vocals || stemBuffers.drums || stemBuffers.bass || stemBuffers.other) {
    toggleMultiStemPlayback();
  }
});

async function toggleMultiStemPlayback() {
  await initAudioContext();
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
        stemAnalysers[key].connect(delayNode);
        source.start(startTargetTime);
        stemSources[key] = source;
      }
    });

    if (loadedCount === 0) return;
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
        }).catch(e => {});
      } else {
        audioPlayer.pause();
        deckPlayBtn.innerText = "▶️ 음악 재생 (Play)";
      }
    }
  });
}

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

    window.latestCompiledAudioData = compiledAudioData;
    if (manager && typeof manager.update === 'function') {
      manager.update(compiledAudioData);
    }
  } catch (err) {}
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

// 📐 [수리 완료]: index.html에 작성된 실제 버튼 ID를 직접 타겟팅하여 연결
const updateExportRatio = (ratioVal) => {
  window.cosmicEngineSettings.exportRatio = ratioVal;
  if (stageWrapper) {
    stageWrapper.classList.remove('ratio-full', 'ratio-169', 'ratio-916');
    if (ratioVal === '16:9') stageWrapper.classList.add('ratio-169');
    else if (ratioVal === '9:16') stageWrapper.classList.add('ratio-916');
    else stageWrapper.classList.add('ratio-full');

    if (manager) manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight);
    console.log(`[📐 Ratio Active]: ${ratioVal} 화면 비율 적용`);
  }
};

document.getElementById('btn-ratio-full')?.addEventListener('click', () => updateExportRatio('full'));
document.getElementById('btn-ratio-169')?.addEventListener('click', () => updateExportRatio('16:9'));
document.getElementById('btn-ratio-916')?.addEventListener('click', () => updateExportRatio('9:16'));


let isUserManualClick = false;

const originalSwitchSketch = manager.switchSketch.bind(manager);
manager.switchSketch = async function(sketchName, ...args) {
  if (window.cosmicEngineSettings.lockSketch && !isUserManualClick) {
    return; 
  }
  return originalSwitchSketch(sketchName, ...args);
};

const sketchListContainer = document.getElementById('sketch-list');
if (sketchListContainer) {
  sketchListContainer.addEventListener('click', async (e) => {
    const targetLi = e.target.closest('li[data-sketch]');
    if (!targetLi) return;

    document.querySelectorAll('#sketch-list li').forEach(li => li.classList.remove('active'));
    targetLi.classList.add('active');

    const targetSketch = targetLi.getAttribute('data-sketch');
    try {
      isUserManualClick = true; 
      updateAudioDelayForSketch(targetSketch);
      await originalSwitchSketch(targetSketch, analyzer);
      isUserManualClick = false; 
      syncCosmicControls();
    } catch(err) {
      isUserManualClick = false;
    }
  });
}

const activeLi = document.querySelector('#sketch-list li.active');
const initSketch = activeLi ? activeLi.getAttribute('data-sketch') : '029_infinite_mandala.js';
syncCosmicControls();
updateAudioDelayForSketch(initSketch);

originalSwitchSketch(initSketch, analyzer).then(() => {
  renderEngineTicker();
}).catch(err => {
  renderEngineTicker();
});

window.addEventListener('resize', () => {
  if (manager && stageWrapper) manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight);
});
