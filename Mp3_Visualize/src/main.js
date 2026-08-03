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
    if (deckPlayBtn) deckPlayBtn.innerText = "▶️ 음악 재생 (Play)";
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

// 💡 [수리] '▶️ 음악 재생' 버튼 누르면 4개 스템 음원 자동 스마트 연결
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
                });
            } else {
                audioPlayer.pause(); deckPlayBtn.innerText = "▶️ 음악 재생 (Play)";
            }
        }
    });
}

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

window.addEventListener('DOMContentLoaded', () => {
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
    color: document
