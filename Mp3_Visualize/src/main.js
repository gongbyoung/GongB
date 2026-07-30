import { AudioAnalyzer } from './core/AudioAnalyzer.js';
import { SketchManager } from './core/SketchManager.js';
import { VideoRecorder } from './core/VideoRecorder.js';

const analyzer = new AudioAnalyzer();
const manager = new SketchManager('canvas-stage');
const recorder = new VideoRecorder('canvas-stage');

const audioPlayer = document.getElementById('audio-player');
const stageWrapper = document.getElementById('stage-wrapper');
const imageInput = document.getElementById('file-image');
const deckPlayBtn = document.getElementById('btn-play-music');
const recordBtn = document.getElementById('btn-record') || document.querySelector('.btn-record') || document.getElementById('btn-start-record');

let isAudioAnalyzerConnected = false;
const broadcast = new BroadcastChannel('cosmic_fft_channel');

let audioCtx = null;
const stemBuffers = { vocals: null, drums: null, bass: null, other: null };
const stemSources = { vocals: null, drums: null, bass: null, other: null };
const stemAnalysers = { vocals: null, drums: null, bass: null, other: null };
let isMultiStemPlaying = false;

const poemTextInput = document.getElementById('input-poem-text');
const btnPlayMulti = document.getElementById('btn-play-multi-stems');
const batchMp3Input = document.getElementById('file-batch-mp3');
const batchStatusText = document.getElementById('batch-load-status');

window.cosmicEngineSettings = window.cosmicEngineSettings || {};
window.cosmicEngineSettings.poemText = poemTextInput ? poemTextInput.value : "떠날 때의 님의 얼굴";

poemTextInput?.addEventListener('input', (e) => {
    window.cosmicEngineSettings.poemText = e.target.value || "떠날 때의 님의 얼굴";
});

function stopAllActiveStems() {
    Object.keys(stemSources).forEach(key => {
        if (stemSources[key]) {
            try { stemSources[key].stop(); } catch(e){}
            stemSources[key] = null;
        }
    });
    isMultiStemPlaying = false;
    if (btnPlayMulti) btnPlayMulti.innerText = "▶️ 4-Stem 동시 재생 (Sync Play)";
}

async function safeDecodeAudio(file) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    const arrayBuffer = await file.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuffer.slice(0));
}

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
                audioPlayer.src = URL.createObjectURL(file);
                audioPlayer.load();
                loadedNames.main = file.name;
            }
        } catch (err) {
            console.error(`[Audio Decode Error] ${file.name} 변환 실패:`, err);
        }
    }

    let summaryHtml = "✅ <strong>인식 완료:</strong><br>";
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
        if (deckPlayBtn) deckPlayBtn.innerText = "▶️ 음악 재생 (Play)";

        const startTargetTime = audioCtx.currentTime + 0.05;
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
        if (btnPlayMulti) btnPlayMulti.innerText = "⏸️ 동시 일시정지 (Pause)";
    }
}

btnPlayMulti?.addEventListener('click', toggleMultiStemPlayback);

let initialRanges = { totalBands: 4, ranges: [] };
const savedLatestConfig = localStorage.getItem('cosmic_fft_active_latest');
if (savedLatestConfig) {
    try { initialRanges = JSON.parse(savedLatestConfig); } catch(e) {}
}
window.customFrequencyRanges = initialRanges;

broadcast.onmessage = (e) => {
    if (e.data && e.data.type === 'RANGE_UPDATE' && e.data.config) {
        window.customFrequencyRanges = e.data.config;
    }
};

const sketchDescriptions = {
    '001_p5_wave.js': `<strong style="color:#00ffcc; font-size:12px;">📊 [001호 파형] 오디오 파형 반응형</strong>`,
    '002_three_cube.js': `<strong style="color:#00ffcc; font-size:12px;">🧊 [002호 큐브] 3D 큐브 링 비주얼라이저</strong>`,
    '005_three_floor_eq.js': `<strong style="color:#00ffcc; font-size:12px;">🎛️ [005호 그리드] 비트 연동 네온 매트릭스</strong>`,
    '007_three_cosmic_nebula.js': `<strong style="color:#00ffcc; font-size:12px;">🌌 [007호 성운] 3D 파티클 은하수</strong>`,
    '009_three_fireworks.js': `<strong style="color:#00ffcc; font-size:12px;">🎆 [009호 불꽃] 드럼 비트 폭발 불꽃</strong>`,
    '021_matrix_press.js': `<strong style="color:#00ffcc; font-size:12px;">🎚️ [021호 32채널] 런치패드 이퀄라이저</strong>`
};

function updateSketchManual(sketchName) {
    const panel = document.getElementById('sketch-description-panel');
    if (!panel) return;
    const cleanName = sketchName.split('/').pop();
    panel.innerHTML = sketchDescriptions[cleanName] || `<strong style="color:#00ffcc; font-size:12px;">⚙️ [${cleanName.split('_')[0]}호 스케치 기동]</strong>`;
}

window.addEventListener('DOMContentLoaded', () => {
    const listContainer = document.getElementById('sketch-list');
    if (listContainer) {
        const descPanel = document.createElement('div');
        descPanel.id = 'sketch-description-panel';
        descPanel.style.cssText = 'margin-top: 15px; padding: 12px; background: rgba(8, 12, 26, 0.96); border: 1px solid #00f0ff; border-radius: 6px; color: #d0e0ff; font-family: sans-serif; font-size: 11px; line-height: 1.6;';
        listContainer.parentNode.insertBefore(descPanel, listContainer.nextSibling);
    }
    
    const hud = document.createElement('div');
    hud.id = 'diagnostic-hud-console';
    hud.style.cssText = 'position:fixed; top:15px; right:320px; z-index:9999; background:rgba(5,15,25,0.85); color:#00ffcc; font-family:monospace; font-size:11px; padding:12px; border:1px solid #00ffcc; border-radius:6px; pointer-events:none; width:240px;';
    document.body.appendChild(hud);
    
    setInterval(() => {
        const diag = window.sketchDiagnostics || {};
        const usedMemRaw = window.performance && window.performance.memory ? Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB' : 'N/A';
        const activeLi = document.querySelector('#sketch-list li.active');
        const currentFile = activeLi ? activeLi.getAttribute('data-sketch').split('/').pop() : 'None';
        
        hud.innerHTML = `
            <div style="font-weight:bold; color:#ffff00; border-bottom:1px dashed #00ffcc; padding-bottom:4px; margin-bottom:4px;">📊 CORE SYSTEM DIAGNOSTICS</div>
            <div>• RUNNING SKETCH: <span style="color:#fff">${currentFile}</span></div>
            <div>• ENGINE FPS    : <span style="color:#fff">${diag.fps || 0} Frame</span></div>
            <div>• MEMORY HEAP   : <span style="color:#fff">${usedMemRaw}</span></div>
            <div>• ACTIVE SHAPE  : <span style="color:#fff">${diag.particleCount || 0} Pcs</span></div>
            <div>• CORE FUNCTION : <span style="color:#ff00ff">${diag.activeFunction || 'Idle'}</span></div>
        `;
    }, 200);
});

imageInput?.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const imgURL = URL.createObjectURL(file); const img = new Image(); img.src = imgURL;
    img.onload = () => { window.currentUploadedImageElement = img; };
});

const audioInput = document.getElementById('file-audio') || document.getElementById('file-mp3') || document.querySelector('input[type="file"][accept*="audio"]');
if (audioInput) {
    audioInput.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        audioPlayer.src = URL.createObjectURL(file);
        audioPlayer.load();
        isAudioAnalyzerConnected = false;
        if (deckPlayBtn) deckPlayBtn.innerText = "▶️ 음악 재생 (Play)";
    });
}

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
            updateSketchManual(targetSketch);
        } catch(err) {
            console.error(`[Sketch Switch Error] ${targetSketch} 로딩 실패:`, err);
        }
    });
}

const ratioButtons = { full: document.getElementById('btn-ratio-full'), i169: document.getElementById('btn-ratio-169'), i916: document.getElementById('btn-ratio-916') };
Object.keys(ratioButtons).forEach(key => {
    if (ratioButtons[key]) {
        ratioButtons[key].addEventListener('click', (e) => {
            Object.values(ratioButtons).forEach(b => b?.classList.remove('active')); e.currentTarget.classList.add('active');
            stageWrapper.className = (key === 'full') ? 'ratio-full' : (key === 'i169') ? 'ratio-169' : 'ratio-916';
            setTimeout(() => { manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight); }, 60);
        });
    }
});

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

if (deckPlayBtn && audioPlayer) {
    deckPlayBtn.addEventListener('click', () => {
        if (audioPlayer.paused) {
            stopAllActiveStems();
            audioPlayer.play().then(() => {
                deckPlayBtn.innerText = "⏸️ 일시정지 (Pause)";
                if (!isAudioAnalyzerConnected) {
                    try { analyzer.connectAudioElement(audioPlayer); } catch (err) {}
                    isAudioAnalyzerConnected = true;
                }
            });
        } else {
            audioPlayer.pause(); deckPlayBtn.innerText = "▶️ 음악 재생 (Play)";
        }
    });
}

if (recordBtn) {
    recordBtn.addEventListener('click', () => {
        if (!recorder || !recorder.isRecording) {
            if (audioPlayer && audioPlayer.src) {
                audioPlayer.currentTime = 0;
                audioPlayer.play().then(() => {
                    if (deckPlayBtn) deckPlayBtn.innerText = "⏸️ 일시정지 (Pause)";
                    if (!isAudioAnalyzerConnected) {
                        try { analyzer.connectAudioElement(audioPlayer); } catch (err) {}
                        isAudioAnalyzerConnected = true;
                    }
                }).catch(err => console.warn("오디오 재생 오류:", err));
            }
            if (recorder && typeof recorder.start === 'function') recorder.start();
            recordBtn.innerText = "⏹️ 녹화 중지 (Stop)";
            recordBtn.style.backgroundColor = "#e11d48";
        } else {
            if (recorder && typeof recorder.stop === 'function') recorder.stop();
            if (audioPlayer) {
                audioPlayer.pause();
                if (deckPlayBtn) deckPlayBtn.innerText = "▶️ 음악 재생 (Play)";
            }
            recordBtn.innerText = "🔴 녹화 시작 (Record)";
            recordBtn.style.backgroundColor = "";
        }
    });
}

// 💡 [피크 음압 추출 + 10배 증폭]
function getStemVolume(analyser) {
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let maxVal = 0, sum = 0;
    for (let i = 0; i < data.length; i++) {
        if (data[i] > maxVal) maxVal = data[i];
        sum += data[i];
    }
    const avg = (sum / data.length) / 255.0;
    const peak = maxVal / 255.0;
    // 💡 음압 수치를 8배~10배 스케일업
    return Math.min(1.0, (avg * 0.4 + peak * 0.6) * 3.5);
}

function renderEngineTicker() {
    requestAnimationFrame(renderEngineTicker);

    let compiledAudioData = { bass: 0, mid: 0, treble: 0, vol: 0, raw: new Uint8Array(256) };
    
    if (isAudioAnalyzerConnected && analyzer) {
        if (typeof analyzer.getAudioData === 'function') {
            compiledAudioData = analyzer.getAudioData();
        } else if (analyzer.analyser) {
            const bufferLength = analyzer.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyzer.analyser.getByteFrequencyData(dataArray);
            compiledAudioData.raw = dataArray;
            
            let b = 0, m = 0, t = 0;
            for (let i = 0; i < 20; i++) b += dataArray[i];
            for (let i = 20; i < 100; i++) m += dataArray[i];
            for (let i = 100; i < 220; i++) t += dataArray[i];
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
    } else {
        compiledAudioData.isMultiStem = false;
        compiledAudioData.vocalsVol = Math.min(1.0, compiledAudioData.mid * 3.0);
        compiledAudioData.drumsVol  = Math.min(1.0, compiledAudioData.bass * 3.5);
        compiledAudioData.bassVol   = Math.min(1.0, compiledAudioData.bass * 3.0);
        compiledAudioData.otherVol  = Math.min(1.0, compiledAudioData.treble * 3.0);
    }

    window.latestCompiledAudioData = compiledAudioData;
    manager.update(compiledAudioData);
}

const activeLi = document.querySelector('#sketch-list li.active');
const initSketch = activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js';
syncCosmicControls();
manager.switchSketch(initSketch, analyzer).then(() => {
    updateSketchManual(initSketch);
    renderEngineTicker();
}).catch(err => {
    console.error("초기 스케치 기동 에러:", err);
    renderEngineTicker();
});

window.addEventListener('resize', () => manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight));
