import { AudioAnalyzer } from './core/AudioAnalyzer.js';
import { SketchManager } from './core/SketchManager.js';
import { VideoRecorder } from './core/VideoRecorder.js';

const analyzer = new AudioAnalyzer();
const manager = new SketchManager('canvas-stage');
const recorder = new VideoRecorder('canvas-stage');

const audioPlayer = document.getElementById('audio-player');
const sketchItems = document.querySelectorAll('#sketch-list li');
const stageWrapper = document.getElementById('stage-wrapper');
const srtInput = document.getElementById('file-srt');
const imageInput = document.getElementById('file-image');
const audioInput = document.getElementById('file-audio');
const playMusicBtn = document.getElementById('btn-play-music');

let parsedSubtitles = [];
let isAudioAnalyzerConnected = false;

// 1. 미디어 아트용 고품격 구글 웹폰트 동적 인젝션 시공
window.addEventListener('DOMContentLoaded', () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@500;900&display=swap';
    document.head.appendChild(link);
    
    // 2. 녹화 영상에 기록되지 않는 모니터링 전용 투명 진단 HUD 콘솔 동적 생성
    const hud = document.createElement('div');
    hud.id = 'diagnostic-hud-console';
    hud.style.cssText = 'position:fixed; top:15px; right:350px; z-index:9999; background:rgba(5,15,25,0.85); color:#00ffcc; font-family:monospace; font-size:11px; padding:12px; border:1px solid #00ffcc; border-radius:6px; pointer-events:none; line-height:1.5; box-shadow:0 0 10px rgba(0,255,204,0.3); width:240px;';
    document.body.appendChild(hud);
    
    setInterval(() => {
        const diag = window.sketchDiagnostics || {};
        const memInfo = window.performance && window.performance.memory ? 
            Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB' : 'N/A';
            
        const activeLi = document.querySelector('#sketch-list li.active');
        const currentFile = activeLi ? activeLi.getAttribute('data-sketch') : 'None';
        
        hud.innerHTML = `
            <div style="font-weight:bold; color:#ffff00; border-bottom:1px dashed #00ffcc; padding-bottom:4px; margin-bottom:4px;">📊 CORE SYSTEM DIAGNOSTICS</div>
            <div>• RUNNING SKETCH: <span style="color:#fff">${currentFile}</span></div>
            <div>• ENGINE FPS    : <span style="color:#fff">${diag.fps || 0} Frame</span></div>
            <div>• MEMORY HEAP   : <span style="color:#fff">${memInfo}</span></div>
            <div>• ACTIVE SHAPE  : <span style="color:#fff">${diag.particleCount || 0} Pcs</span></div>
            <div>• TIME WINDOW   : <span style="color:#fff">${diag.isCovering ? '⚠️ BURYING LAYER' : 'NORMAL'}</span></div>
            <div>• CORE FUNCTION : <span style="color:#ff00ff">${diag.activeFunction || 'Idle'}</span></div>
            <div style="font-size:10px; color:#888; border-top:1px dashed #444; margin-top:4px; padding-top:2px;">* 본 HUD는 비디오 녹화 저장 시 제외됩니다.</div>
        `;
    }, 200);
});

// 초기 자산 자동 로딩
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const srtRes = await fetch('assets/sample.srt');
        if (srtRes.ok) {
            parsedSubtitles = parseSRT(await srtRes.text());
            window.parsedSubtitles = parsedSubtitles;
        }
        const img = new Image(); img.src = 'assets/sample.jpg';
        img.onload = () => { window.currentUploadedImageElement = img; };
    } catch (err) { console.warn("기본 자산 파일 초기화 대기 중"); }
});

// 미리보기 재생 버튼
playMusicBtn.addEventListener('click', () => {
    if (audioPlayer.paused) {
        audioPlayer.play();
        if (!isAudioAnalyzerConnected) {
            analyzer.connectAudioElement(audioPlayer);
            isAudioAnalyzerConnected = true;
        }
        playMusicBtn.innerText = '⏸️ 일시정지 (Pause)';
    } else {
        audioPlayer.pause();
        playMusicBtn.innerText = '▶️ 음악 재생 (Play)';
    }
});

audioInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    audioPlayer.pause(); 
    audioPlayer.src = URL.createObjectURL(file);
    audioPlayer.load();
    playMusicBtn.innerText = '▶️ 음악 재생 (Play)';
});

function parseSRT(data) {
    if (!data) return [];
    const blocks = data.replace(/\r/g, '').trim().split('\n\n');
    return blocks.map(b => {
        const lines = b.split('\n');
        if (lines.length < 3) return null;
        const timeLine = lines[1];
        if (!timeLine || !timeLine.includes('-->')) return null;
        const times = timeLine.split('-->');
        if (times.length < 2) return null;

        function timeToSeconds(t) {
            if (!t) return 0;
            const p = t.trim().split(':');
            if (p.length < 3) return 0;
            return parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseFloat(p[2].replace(',', '.'));
        }
        const textLines = lines.slice(2).join(' ').trim();
        return { start: timeToSeconds(times[0]), end: timeToSeconds(times[1]), text: textLines };
    }).filter(Boolean);
}

audioPlayer.addEventListener('timeupdate', () => {
    if (parsedSubtitles.length === 0) return;
    const sub = parsedSubtitles.find(s => audioPlayer.currentTime >= s.start && audioPlayer.currentTime <= s.end);
    window.currentSubtitleText = sub ? sub.text : "";
});

srtInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader(); 
    reader.onload = (event) => { 
        parsedSubtitles = parseSRT(event.target.result); 
        window.parsedSubtitles = parsedSubtitles; 
    }; 
    reader.readAsText(file);
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
        await manager.switchSketch(e.currentTarget.getAttribute('data-sketch'), analyzer);
        syncCosmicControls();
    });
});

const ratioButtons = { full: document.getElementById('btn-ratio-full'), i169: document.getElementById('btn-ratio-169'), i916: document.getElementById('btn-ratio-916') };
Object.keys(ratioButtons).forEach(key => {
    if (ratioButtons[key]) {
        ratioButtons[key].addEventListener('click', (e) => {
            Object.values(ratioButtons).forEach(b => b?.classList.remove('active'));
            e.currentTarget.classList.add('active');
            stageWrapper.className = (key === 'full') ? 'ratio-full' : (key === 'i169') ? 'ratio-169' : 'ratio-916';
            manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight);
        });
    }
});

const cosmicControls = {
    numSeed: document.getElementById('num-cosmic-seed'), numScatter: document.getElementById('num-cosmic-scatter'),
    color: document.getElementById('select-cosmic-color'), numGlow: document.getElementById('num-cosmic-glow'),
    numGain: document.getElementById('num-cosmic-gain'), pickGas1: document.getElementById('picker-gas1'),
    pickGas2: document.getElementById('picker-gas2'), pickStar: document.getElementById('picker-star'),
    offsetX: document.getElementById('num-offset-x'), offsetY: document.getElementById('num-offset-y'),
    offsetZ: document.getElementById('num-offset-z'), numGauge: document.getElementById('num-cosmic-gauge')
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
        positionOffset: { x: parseFloat(cosmicControls.offsetX.value), y: parseFloat(cosmicControls.offsetY.value), z: parseFloat(cosmicControls.offsetZ.value) },
        gaugeValue: parseInt(cosmicControls.numGauge.value) / 100
    };
}

Object.values(cosmicControls).forEach(el => {
    el?.addEventListener('input', () => {
        syncCosmicControls();
    });
});

// 💡 [버그 완전 치료]: 현재 활성화된 스케치 이름을 DOM에서 직접 뜯어와 재시동하므로 리셋 시 화면 증발 원천 차단
document.getElementById('btn-apply-cosmic')?.addEventListener('click', () => {
    syncCosmicControls();
    if (manager.currentSketch && typeof manager.currentSketch.buildCosmos === 'function') {
        manager.currentSketch.buildCosmos();
    } else {
        const activeLi = document.querySelector('#sketch-list li.active');
        const currentSketch = activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js';
        manager.switchSketch(currentSketch, analyzer);
    }
});

document.getElementById('btn-save-preset')?.addEventListener('click', () => {
    const activeLi = document.querySelector('#sketch-list li.active');
    const currentSketch = activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js';
    const data = JSON.stringify({ cosmic: window.cosmicEngineSettings, sketch: currentSketch });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data])); a.download = 'preset.json'; a.click();
});

const activeLi = document.querySelector('#sketch-list li.active');
manager.switchSketch(activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js', analyzer);
window.addEventListener('resize', () => manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight));
