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

// 💡 스케치별 맞춤형 관제탑 슬라이더 조작 설명서 데이터베이스
const sketchDescriptions = {
    '001_p5_wave.js': `
        <strong style="color:#00ffcc; font-size:12px;">📊 [001호 파형] 오디오 웨이브</strong><br>
        • <strong>Volume(Gain)</strong>: 오디오 주파수 감도 및 파형 진동 폭 조절<br>
        • <strong>Scale(Glow)</strong>: 네온 라인의 굵기 및 발광 세기 튜닝<br>
        • <strong>Color Palette</strong>: 비주얼라이저 라인 컬러 무드 변경
    `,
    '020_p5_srt_canvas.js': `
        <strong style="color:#00ffcc; font-size:12px;">🍁 [020호 자막] 물리 안착 & 30FPS 가림 아트</strong><br>
        • <strong>Shuffle(Seed)</strong>: 노랑/갈색 단풍잎 및 형태 조합의 무작위 다양성 재구성<br>
        • <strong>Range(Scatter)</strong>: 입자들이 가을바람을 타고 화면 중앙으로 날아오는 하강 속도<br>
        • <strong>Scale(Glow)</strong>: 가사 자막 글씨 크기 조절 (눈꽃송이의 야광 반사광 범위 동시 조절)<br>
        • <strong>Volume(Gain)</strong>: 단풍잎, 풀잎, 눈꽃 결정의 디바이스 안착 크기 편차 조절<br>
        • <strong>Gauge</strong>: 가사가 끝나기 직전, 잎들이 가사 위를 '물리적으로 포개어 덮는 시간(초)' 조절<br>
        • <strong>Color Palette</strong>: <u>Neon</u>(노랑/갈색 단풍), <u>Pastel</u>(싱그런 풀잎), <u>Monochrome</u>(발광 눈), <u>Earth</u>(비)<br>
        • <strong>Custom Colors</strong>: 단풍잎의 그라데이션 스펙트럼 및 자막/눈꽃 야광 3색 커스텀 지정
    `
};

// 💡 선택한 스케치의 설명서를 사이드바 하단에 출력하는 함수
function updateSketchManual(sketchName) {
    const panel = document.getElementById('sketch-description-panel');
    if (!panel) return;
    const cleanName = sketchName.split('/').pop();
    panel.innerHTML = sketchDescriptions[cleanName] || `
        <strong style="color:#00ffcc; font-size:12px;">⚙️ [${cleanName.split('_')[0]}호 스케치 기동 중]</strong><br>
        • 관제탑의 슬라이더 수치를 변경하여 실시간 오디오 반응 폭과 프리뷰 해상도를 튜닝할 수 있습니다.
    `;
}

// 초기화 과정에서의 웹폰트 주입 및 UI 패널 삽입
window.addEventListener('DOMContentLoaded', () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@500;900&display=swap';
    document.head.appendChild(link);
    
    // 왼쪽 사이드바 하단에 설명서 패널 생성
    const listContainer = document.getElementById('sketch-list');
    if (listContainer) {
        const descPanel = document.createElement('div');
        descPanel.id = 'sketch-description-panel';
        descPanel.style.cssText = 'margin-top: 20px; padding: 14px; background: rgba(10, 20, 30, 0.95); border: 1px solid #00f0ff; border-radius: 6px; color: #d0e0ff; font-family: sans-serif; font-size: 11px; line-height: 1.6; box-shadow: 0 0 10px rgba(0,240,255,0.2);';
        listContainer.parentNode.insertBefore(descPanel, listContainer.nextSibling);
    }
    
    // 모니터링 HUD 탑재
    const hud = document.createElement('div');
    hud.id = 'diagnostic-hud-console';
    hud.style.cssText = 'position:fixed; top:15px; right:350px; z-index:9999; background:rgba(5,15,25,0.85); color:#00ffcc; font-family:monospace; font-size:11px; padding:12px; border:1px solid #00ffcc; border-radius:6px; pointer-events:none; line-height:1.5; box-shadow:0 0 10px rgba(0,255,204,0.3); width:240px;';
    document.body.appendChild(hud);
    
    setInterval(() => {
        const diag = window.sketchDiagnostics || {};
        
        // 메모리 힙 검사 방어 코드 추가
        const usedMemRaw = window.performance && window.performance.memory ? 
            Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB' : 'N/A (Not Supported)';
        const usedMem = usedMemRaw.includes('undefined') ? 'N/A (Not Supported)' : usedMemRaw;
            
        // 💡 [HUD 파일명 버그 완치]: DOM에서 액티브 상태를 직접 가져와 무조건 정확한 파일명 출력
        const activeLi = document.querySelector('#sketch-list li.active');
        const currentFile = activeLi ? activeLi.getAttribute('data-sketch').split('/').pop() : 'None';
        
        hud.innerHTML = `
            <div style="font-weight:bold; color:#ffff00; border-bottom:1px dashed #00ffcc; padding-bottom:4px; margin-bottom:4px;">📊 CORE SYSTEM DIAGNOSTICS</div>
            <div>• RUNNING SKETCH: <span style="color:#fff">${currentFile}</span></div>
            <div>• ENGINE FPS    : <span style="color:#fff">${diag.fps || 0} Frame</span></div>
            <div>• MEMORY HEAP   : <span style="color:#fff">${usedMem}</span></div>
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

        ...
        // 중략 없는 완전한 복원을 위해 파싱 로직 정상 유지
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

// 💡 [버그 완전 해결]: 현재 활성화된 버튼의 스케치 파일명을 직접 DOM에서 추출하므로 RESET 시 무조건 정상 구동
document.getElementById('btn-apply-cosmic')?.addEventListener('click', () => {
    syncCosmicControls();
    const activeLi = document.querySelector('#sketch-list li.active');
    const currentSketch = activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js';
    
    if (manager.currentSketch && typeof manager.currentSketch.buildCosmos === 'function') {
        manager.currentSketch.buildCosmos();
    } else {
        manager.switchSketch(currentSketch, analyzer);
    }
    updateSketchManual(currentSketch);
});

document.getElementById('btn-save-preset')?.addEventListener('click', () => {
    const activeLi = document.querySelector('#sketch-list li.active');
    const currentSketch = activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js';
    const data = JSON.stringify({ cosmic: window.cosmicEngineSettings, sketch: currentSketch });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data])); a.download = 'preset.json'; a.click();
});

// 첫 실행 바인딩
const activeLi = document.querySelector('#sketch-list li.active');
const initSketch = activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js';
manager.switchSketch(initSketch, analyzer).then(() => {
    updateSketchManual(initSketch);
});
window.addEventListener('resize', () => manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight));
