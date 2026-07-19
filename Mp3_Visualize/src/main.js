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

// 좌측 사이드바 음악 재생 버튼 매핑
const deckPlayBtn = document.getElementById('btn-play-music');

let isAudioAnalyzerConnected = false;

// 스케치별 맞춤형 관제탑 설명서 데이터베이스
const sketchDescriptions = {
    '001_p5_wave.js': `
        <strong style="color:#00ffcc; font-size:12px;">📊 [001호 파형] 오디오 웨이브</strong><br>
        • <strong>Volume(Gain)</strong>: 오디오 주파수 감도 및 파형 진동 폭 조절<br>
        • <strong>Scale(Glow)</strong>: 네온 라인의 굵기 및 발광 세기 튜닝<br>
        • <strong>Color Palette</strong>: 비주얼라이저 라인 컬러 무드 변경
    `,
    '003_glsl_noise.js': `
        <strong style="color:#00ffcc; font-size:12px;">🔮 [003호 오로라] 밤의 수면 & 이미지 굴절</strong><br>
        • <strong>Shuffle(Seed)</strong>: 오로라 세포 모양 무작위 전면 변환 및 위상 배치 조정<br>
        • <strong>Volume(Gain)</strong>: 주파수 유입에 따른 유체 소용돌이 일렁임 진폭 강도 제어
    `,
    '005_three_floor_eq.js': `
        <strong style="color:#00ffcc; font-size:12px;">🎛️ [005호 그리드] 순수 기하학 네온 매트릭스</strong><br>
        • <strong>Shuffle(Seed)</strong>: 인덱스에 따라 사각형(1), 원형(2), 랜덤(0) 프레임 형상 일제 변환<br>
        • <strong>Offset(X, Y)</strong>: 배경 이미지의 중심 좌표를 좌우/상하로 미세 이동<br>
        • <strong>Offset(Z)</strong>: 배경 이미지의 배율 크기를 줌인/줌아웃 확대 축소
    `,
    '007_three_cosmic_nebula.js': `
        <strong style="color:#00ffcc; font-size:12px;">🌌 [007호 성운] 오로라 가스 클라우드</strong><br>
        • <strong>Scale(Glow)</strong>: 가스 구체들의 원천 코어 크기 조절<br>
        • <strong>Volume(Gain)</strong>: 주파수 유입에 따른 프랙탈 가스 뒤틀림 밀도 변위
    `,
    '014_p5_pendulums.js': `
        <strong style="color:#00ffcc; font-size:12px;">🎛️ [014호 매트릭스] 40,000셀 초고밀도 군무</strong><br>
        • <strong>Scale(Glow)</strong>: 막대기 기하학 세포의 시각적 선 두께(굵기) 조절<br>
        • <strong>Gauge</strong>: 흔들리는 기하학 세포 막대기의 물리적 길이 제어
    `
};

function updateSketchManual(sketchName) {
    const panel = document.getElementById('sketch-description-panel');
    if (!panel) return;
    const cleanName = sketchName.split('/').pop();
    panel.innerHTML = sketchDescriptions[cleanName] || `
        <strong style="color:#00ffcc; font-size:12px;">⚙️ [${cleanName.split('_')[0]}호 스케치 기동 중]</strong><br>
        • 관제탑의 슬라이더 수치를 변경하여 실시간 오디오 반응 폭과 프리뷰 해상도를 튜닝할 수 있습니다.
    `;
}

window.addEventListener('DOMContentLoaded', () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@500;900&display=swap';
    document.head.appendChild(link);
    
    const listContainer = document.getElementById('sketch-list');
    if (listContainer) {
        const descPanel = document.createElement('div');
        descPanel.id = 'sketch-description-panel';
        descPanel.style.cssText = 'margin-top: 15px; padding: 12px; background: rgba(8, 12, 26, 0.96); border: 1px solid #00f0ff; border-radius: 6px; color: #d0e0ff; font-family: sans-serif; font-size: 11px; line-height: 1.6; box-shadow: 0 0 10px rgba(0,240,255,0.15);';
        listContainer.parentNode.insertBefore(descPanel, listContainer.nextSibling);
    }
    
    const hud = document.createElement('div');
    hud.id = 'diagnostic-hud-console';
    hud.style.cssText = 'position:fixed; top:15px; right:320px; z-index:9999; background:rgba(5,15,25,0.85); color:#00ffcc; font-family:monospace; font-size:11px; padding:12px; border:1px solid #00ffcc; border-radius:6px; pointer-events:none; line-height:1.5; box-shadow:0 0 10px rgba(0,255,204,0.3); width:240px;';
    document.body.appendChild(hud);
    
    setInterval(() => {
        const diag = window.sketchDiagnostics || {};
        const usedMemRaw = window.performance && window.performance.memory ? 
            Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB' : 'N/A';
            
        const activeLi = document.querySelector('#sketch-list li.active');
        const currentFile = activeLi ? activeLi.getAttribute('data-sketch').split('/').pop() : 'None';
        
        hud.innerHTML = `
            <div style="font-weight:bold; color:#ffff00; border-bottom:1px dashed #00ffcc; padding-bottom:4px; margin-bottom:4px;">📊 CORE SYSTEM DIAGNOSTICS</div>
            <div>• RUNNING SKETCH: <span style="color:#fff">${currentFile}</span></div>
            <div>• ENGINE FPS    : <span style="color:#fff">${diag.fps || 0} Frame</span></div>
            <div>• MEMORY HEAP   : <span style="color:#fff">${usedMemRaw}</span></div>
            <div>• ACTIVE SHAPE  : <span style="color:#fff">${diag.particleCount || 0} Pcs</span></div>
            <div>• TIME WINDOW   : <span style="color:#fff">${diag.isCovering ? '⚠️ BURYING LAYER' : 'NORMAL'}</span></div>
            <div>• CORE FUNCTION : <span style="color:#ff00ff">${diag.activeFunction || 'Idle'}</span></div>
            <div style="font-size:10px; color:#888; border-top:1px dashed #444; margin-top:4px; padding-top:2px;">* 본 HUD는 비디오 녹화 저장 시 제외됩니다.</div>
        `;
    }, 200);
});

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const imgURL = URL.createObjectURL(file); const img = new Image(); img.src = imgURL;
    img.onload = () => { window.currentUploadedImageElement = img; };
});

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

// 16:9 / 9:16 비동기 레이아웃 타이밍 제어기
const ratioButtons = { 
    full: document.getElementById('btn-ratio-full'), 
    i169: document.getElementById('btn-ratio-169'), 
    i916: document.getElementById('btn-ratio-916') 
};

Object.keys(ratioButtons).forEach(key => {
    if (ratioButtons[key]) {
        ratioButtons[key].addEventListener('click', (e) => {
            Object.values(ratioButtons).forEach(b => b?.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            stageWrapper.className = (key === 'full') ? 'ratio-full' : (key === 'i169') ? 'ratio-169' : 'ratio-916';
            
            setTimeout(() => {
                const computedWidth = stageWrapper.clientWidth;
                const computedHeight = stageWrapper.clientHeight;
                manager.resize(computedWidth, computedHeight);
            }, 60);
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

Object.values(cosmicControls).forEach(el => {
    el?.addEventListener('input', () => { syncCosmicControls(); });
});

document.getElementById('btn-apply-cosmic')?.addEventListener('click', () => {
    syncCosmicControls();
    const activeLi = document.querySelector('#sketch-list li.active');
    const currentSketch = activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js';
    manager.switchSketch(currentSketch, analyzer);
    updateSketchManual(currentSketch);
});

document.getElementById('btn-save-preset')?.addEventListener('click', () => {
    const activeLi = document.querySelector('#sketch-list li.active');
    const currentSketch = activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js';
    const data = JSON.stringify({ cosmic: window.cosmicEngineSettings, sketch: currentSketch });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data])); a.download = 'preset.json'; a.click();
});

// 💡 [수리 핵심]: 오디오 컨텍스트 연결을 재생 버튼 클릭 시 1회만 실행하도록 안정화
if (deckPlayBtn && audioPlayer) {
    deckPlayBtn.addEventListener('click', () => {
        if (audioPlayer.paused) {
            audioPlayer.play().then(() => {
                deckPlayBtn.innerText = "⏸️ 일시정지 (Pause)";
                
                // 단 한 번만 안전하게 오디오 랩퍼 스트림 노드 연결 및 중복 차단
                if (!isAudioAnalyzerConnected) {
                    try {
                        analyzer.connectAudioElement(audioPlayer);
                    } catch (err) {
                        console.warn("오디오 컨텍스트 연결 상태 우회:", err);
                    }
                    isAudioAnalyzerConnected = true;
                }
            }).catch(e => console.error("재생 시작 실패:", e));
        } else {
            audioPlayer.pause();
            deckPlayBtn.innerText = "▶️ 음악 재생 (Play)";
        }
    });
}

function renderEngineTicker() {
    requestAnimationFrame(renderEngineTicker);

    let compiledAudioData = { bass: 0, mid: 0, treble: 0, vol: 0, raw: new Uint8Array(256) };
    
    // 안전 장치 가드 하에 주파수 데이터 분배 수혈
    if (isAudioAnalyzerConnected && analyzer) {
        if (typeof analyzer.getAudioData === 'function') {
            compiledAudioData = analyzer.getAudioData();
        } else if (typeof analyzer.getAnalysisData === 'function') {
            compiledAudioData = analyzer.getAnalysisData();
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

    // 루프 마비 없이 스케치 매니저 드로우 유도
    manager.update(compiledAudioData);
}

const activeLi = document.querySelector('#sketch-list li.active');
const initSketch = activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js';
syncCosmicControls();

manager.switchSketch(initSketch, analyzer).then(() => {
    updateSketchManual(initSketch);
    renderEngineTicker();
});

window.addEventListener('resize', () => manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight));
