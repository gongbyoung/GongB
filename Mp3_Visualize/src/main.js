import { AudioAnalyzer } from './core/AudioAnalyzer.js';
import { SketchManager } from './core/SketchManager.js';
import { VideoRecorder } from './core/VideoRecorder.js';

const analyzer = new AudioAnalyzer();
const manager = new SketchManager('canvas-stage');
const recorder = new VideoRecorder('canvas-stage');

const audioPlayer = document.getElementById('audio-player');
const sketchItems = document.querySelectorAll('#sketch-list li');
const stageWrapper = document.getElementById('stage-wrapper');
const imageInput = document.getElementById('file-image');
const deckPlayBtn = document.getElementById('btn-play-music');

// 녹화 시작/중지 컨트롤 버튼 바인딩
const recordBtn = document.getElementById('btn-record') || document.querySelector('.btn-record') || document.getElementById('btn-start-record');

let isAudioAnalyzerConnected = false;

const broadcast = new BroadcastChannel('cosmic_fft_channel');

// 💡 4-Stem MP3 멀티 트랙 오디오 엔진 변수
let audioCtx = null;
const stemBuffers = { vocals: null, drums: null, bass: null, other: null };
const stemSources = { vocals: null, drums: null, bass: null, other: null };
const stemAnalysers = { vocals: null, drums: null, bass: null, other: null };
let isMultiStemPlaying = false;

// 💡 UI 입력 엘리먼트 바인딩
const poemTextInput = document.getElementById('input-poem-text');
const btnPlayMulti = document.getElementById('btn-play-multi-stems');

// 시 문구 전역 데이터 세팅 및 실시간 수신
window.cosmicEngineSettings = window.cosmicEngineSettings || {};
window.cosmicEngineSettings.poemText = poemTextInput ? poemTextInput.value : "떠날 때의 님의 얼굴";

poemTextInput?.addEventListener('input', (e) => {
    window.cosmicEngineSettings.poemText = e.target.value || "떠날 때의 님의 얼굴";
});

// 💡 4개 MP3 스템 파일 각각 독립 로딩 및 분석기 바인딩
async function loadStemFile(fileInputId, stemKey) {
    const input = document.getElementById(fileInputId);
    if (!input) return;
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        const arrayBuffer = await file.arrayBuffer();
        stemBuffers[stemKey] = await audioCtx.decodeAudioData(arrayBuffer);
        
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        stemAnalysers[stemKey] = analyser;
    });
}

loadStemFile('file-stem-vocals', 'vocals');
loadStemFile('file-stem-drums', 'drums');
loadStemFile('file-stem-bass', 'bass');
loadStemFile('file-stem-other', 'other');

// 💡 4개 MP3 오차 없는 칼동기화 (Sync) 재생 / 일시정지 함수
function toggleMultiStemPlayback() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    if (isMultiStemPlaying) {
        Object.keys(stemSources).forEach(key => {
            if (stemSources[key]) {
                try { stemSources[key].stop(); } catch(e){}
                stemSources[key] = null;
            }
        });
        isMultiStemPlaying = false;
        if (btnPlayMulti) btnPlayMulti.innerText = "▶️ 4-Stem 동시 재생 (Sync Play)";
    } else {
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
            alert("최소 1개 이상의 MP3 스템(보컬, 드럼 등) 파일을 로드해 주세요!");
            return;
        }

        isMultiStemPlaying = true;
        if (btnPlayMulti) btnPlayMulti.innerText = "⏸️ 동시 일시정지 (Pause)";
    }
}

btnPlayMulti?.addEventListener('click', toggleMultiStemPlayback);

// 기동 초기 단계에서 브라우저 메모리에 복원된 최신 주파수 분할 테이블 마운트
let initialRanges = { totalBands: 4, ranges: [] };
const savedLatestConfig = localStorage.getItem('cosmic_fft_active_latest');
if (savedLatestConfig) {
    try {
        initialRanges = JSON.parse(savedLatestConfig);
    } catch(e) {
        console.warn("메인 무대 메모리 주파수 규칙 적재 우회:", e);
    }
}
window.customFrequencyRanges = initialRanges;

broadcast.onmessage = (e) => {
    if (e.data && e.data.type === 'RANGE_UPDATE' && e.data.config) {
        window.customFrequencyRanges = e.data.config;
    }
};

const sketchDescriptions = {
    '001_p5_wave.js': `<strong style="color:#00ffcc; font-size:12px;">📊 [001호 파형] 오디오 웨이브</strong><br>• <strong>Volume(Gain)</strong>: 오디오 주파수 감도 및 파형 진동 폭 조절<br>• <strong>Scale(Glow)</strong>: 네온 라인의 굵기 및 발광 세기 튜닝`,
    '005_three_floor_eq.js': `<strong style="color:#00ffcc; font-size:12px;">🎛️ [005호 그리드] 순수 기하학 네온 매트릭스</strong><br>• <strong>Shuffle(Seed)</strong>: 프레임 형상 일제 변환<br>• <strong>Offset(X, Y, Z)</strong>: 배경 이미지 위치 및 배율 줌 제어`,
    '022_poem_typography.js': `<strong style="color:#00ffcc; font-size:12px;">✍️ [022호 시타이포] 4-Stem 모션 타이포그래피</strong><br>• <strong>보컬</strong>: 글자 튀오름 | <strong>드럼</strong>: 충격 펄스<br>• <strong>베이스</strong>: 네온 발광 | <strong>기타</strong>: 회전 파동`
};

function updateSketchManual(sketchName) {
    const panel = document.getElementById('sketch-description-panel');
    if (!panel) return;
    const cleanName = sketchName.split('/').pop();
    panel.innerHTML = sketchDescriptions[cleanName] || `<strong style="color:#00ffcc; font-size:12px;">⚙️ [${cleanName.split('_')[0]}호 스케치 기동]</strong><br>• 관제탑 슬라이더로 수치 제어가 가능합니다.`;
}

window.addEventListener('DOMContentLoaded', () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;900&display=swap';
    document.head.appendChild(link);
    
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

// 배경 이미지 업로드 디코더
imageInput?.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const imgURL = URL.createObjectURL(file); const img = new Image(); img.src = imgURL;
    img.onload = () => { window.currentUploadedImageElement = img; };
});

// 외부 MP3 오디오 스트림 인젝터 (단일 오디오 용)
const audioInput = document.getElementById('file-audio') || document.getElementById('file-mp3') || document.querySelector('input[type="file"][accept*="audio"]');
if (audioInput) {
    audioInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const audioURL = URL.createObjectURL(file);
        audioPlayer.src = audioURL;
        audioPlayer.load();
        
        isAudioAnalyzerConnected = false;
        if (deckPlayBtn) {
            deckPlayBtn.innerText = "▶️ 음악 재생 (Play)";
        }
    });
}

sketchItems.forEach(item => {
    item.addEventListener('click', async (e) => {
        sketchItems.forEach(li => li.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const targetSketch = e.currentTarget.getAttribute('data-sketch');
        await manager.switchSketch(targetSketch, analyzer);
        syncCosmicControls();
        updateSketchManual(targetSketch);
    });
});

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
        ...window.cosmicEngineSettings, // 시 문구 데이터 보존
        seed: parseInt(cosmicControls.numSeed.value),
        scatterExponent: parseFloat(cosmicControls.numScatter.value) / 10,
        colorStyle: cosmicControls.color.value,
        glowIntensity: parseFloat(cosmicControls.numGlow.value) / 100,
        audioGain: parseFloat(cosmicControls.numGain.value) / 100,
        customColors: { gas1: cosmicControls.pickGas1.value, gas2: cosmicControls.pickGas2.value, star: cosmicControls.pickStar.value },
        positionOffset: { x: 0, y: 0, z: 0 },
        gaugeValue: parseInt(cosmicControls.numGauge.value) / 100
    };
}

Object.values(cosmicControls).forEach(el => { el?.addEventListener('input', () => { syncCosmicControls(); }); });

if (deckPlayBtn && audioPlayer) {
    deckPlayBtn.addEventListener('click', () => {
        if (audioPlayer.paused) {
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

// 녹화 시작 클릭 시 0초 리셋 후 음악과 녹화를 동시 집행하는 이벤트 트리거
if (recordBtn) {
    recordBtn.addEventListener('click', () => {
        if (!recorder || !recorder.isRecording) {
            if (audioPlayer && audioPlayer.src) {
                audioPlayer.currentTime = 0;
                audioPlayer.play().then(() => {
                    if (deckPlayBtn) {
                        deckPlayBtn.innerText = "⏸️ 일시정지 (Pause)";
                    }
                    if (!isAudioAnalyzerConnected) {
                        try { analyzer.connectAudioElement(audioPlayer); } catch (err) {}
                        isAudioAnalyzerConnected = true;
                    }
                }).catch(err => console.warn("오디오 재생 트리거 차단:", err));
            }

            if (recorder && typeof recorder.start === 'function') {
                recorder.start();
            }
            
            recordBtn.innerText = "⏹️ 녹화 중지 (Stop)";
            recordBtn.style.backgroundColor = "#e11d48";
        } 
        else {
            if (recorder && typeof recorder.stop === 'function') {
                recorder.stop();
            }
            if (audioPlayer) {
                audioPlayer.pause();
                if (deckPlayBtn) deckPlayBtn.innerText = "▶️ 음악 재생 (Play)";
            }
            
            recordBtn.innerText = "🔴 녹화 시작 (Record)";
            recordBtn.style.backgroundColor = "";
        }
    });
}

// 💡 스템별 순간 음압 추출 헬퍼 함수
function getStemVolume(analyser) {
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    return (sum / data.length) / 255.0;
}

function renderEngineTicker() {
    requestAnimationFrame(renderEngineTicker);

    let compiledAudioData = { bass: 0, mid: 0, treble: 0, vol: 0, raw: new Uint8Array(256) };
    
    // 1. 단일 오디오 재생 시 데이터 추출
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

    if (compiledAudioData.raw && compiledAudioData.raw.length > 0) {
        broadcast.postMessage({ type: 'AUDIO_STREAM', raw: Array.from(compiledAudioData.raw) });
    }

    if (window.customFrequencyRanges && window.customFrequencyRanges.ranges && window.customFrequencyRanges.ranges.length > 0) {
        compiledAudioData.customBands = window.customFrequencyRanges.ranges.map(band => {
            let sum = 0; let count = 0;
            for (let i = band.start; i <= band.end; i++) { sum += compiledAudioData.raw[i] || 0; count++; }
            return count > 0 ? (sum / count) / 255.0 : 0;
        });

        if (compiledAudioData.customBands[0] !== undefined) compiledAudioData.bass = compiledAudioData.customBands[0];
        if (compiledAudioData.customBands[1] !== undefined) compiledAudioData.mid = compiledAudioData.customBands[1];
        if (compiledAudioData.customBands[2] !== undefined) compiledAudioData.treble = compiledAudioData.customBands[2];
    }

    // 💡 2. 4-Stem 멀티 트랙 재생 시 악기별 음압 주입
    if (isMultiStemPlaying) {
        compiledAudioData.vocalsVol = getStemVolume(stemAnalysers.vocals);
        compiledAudioData.drumsVol  = getStemVolume(stemAnalysers.drums);
        compiledAudioData.bassVol   = getStemVolume(stemAnalysers.bass);
        compiledAudioData.otherVol  = getStemVolume(stemAnalysers.other);
    }

    manager.update(compiledAudioData);
}

const activeLi = document.querySelector('#sketch-list li.active');
const initSketch = activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js';
syncCosmicControls();
manager.switchSketch(initSketch, analyzer).then(() => { updateSketchManual(initSketch); renderEngineTicker(); });
window.addEventListener('resize', () => manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight));
