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
// 💡 [오디오 중복 연결 방지 락 체결]: InvalidStateError 원천 차단용 전역 플래그
let isAudioAnalyzerConnected = false;

// 1. 초기 자산 자동 로딩 (assets/)
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const srtRes = await fetch('assets/sample.srt');
        if (srtRes.ok) {
            parsedSubtitles = parseSRT(await srtRes.text());
            window.parsedSubtitles = parsedSubtitles;
        }
        const img = new Image(); 
        img.src = 'assets/sample.jpg';
        img.onload = () => { window.currentUploadedImageElement = img; };
    } catch (err) { 
        console.warn("기본 자산 파일 초기화 대기 중"); 
    }
});

// 2. 미리보기 재생 버튼 제어
playMusicBtn.addEventListener('click', () => {
    if (audioPlayer.paused) {
        audioPlayer.play();
        
        // 💡 [핵심 수리]: 오디오 커넥션은 브라우저 세션당 단 1회만 연결하도록 제한하여 무력화 해제
        if (!isAudioAnalyzerConnected) {
            analyzer.connectAudioElement(audioPlayer);
            isAudioAnalyzerConnected = true;
            console.log("🔊 오디오 분석 엔진 최초 연결 성공 (안전 락 작동 중)");
        }
        
        playMusicBtn.innerText = '⏸️ 일시정지 (Pause)';
    } else {
        audioPlayer.pause();
        playMusicBtn.innerText = '▶️ 음악 재생 (Play)';
    }
});

// 3. 외부 오디오 파일 로드 (교체 시에도 기존 오디오 노드는 유지되므로 오버랩 에러 없음)
audioInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    audioPlayer.pause(); 
    audioPlayer.src = URL.createObjectURL(file);
    audioPlayer.load();
    playMusicBtn.innerText = '▶️ 음악 재생 (Play)';
});

// 4. 안전 가드 처리가 완료된 SRT 자막 파싱 엔진
function parseSRT(data) {
    if (!data) return [];
    const blocks = data.replace(/\r/g, '').trim().split('\n\n');
    return blocks.map(b => {
        const lines = b.split('\n');
        if (lines.length < 3) return null;
        
        const timeLine = lines[1];
        if (!timeLine || !timeLine.includes('-->')) return null; // 타임라인 손상 방어
        
        const times = timeLine.split('-->');
        if (times.length < 2) return null;

        // 트림 연산 안정화 구조
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

// 외부 자막 파일 주입 리스너
srtInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader(); 
    reader.onload = (event) => { 
        parsedSubtitles = parseSRT(event.target.result); 
        window.parsedSubtitles = parsedSubtitles; 
    }; 
    reader.readAsText(file);
});

// 5. 이미지 입력 제어
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const imgURL = URL.createObjectURL(file); const img = new Image(); img.src = imgURL;
    img.onload = () => { window.currentUploadedImageElement = img; };
});

// 6. 스케치 전환
sketchItems.forEach(item => {
    item.addEventListener('click', async (e) => {
        sketchItems.forEach(li => li.classList.remove('active'));
        e.currentTarget.classList.add('active');
        await manager.switchSketch(e.currentTarget.getAttribute('data-sketch'), analyzer);
        syncCosmicControls();
    });
});

// 7. 비율 전환 (지연 없이 즉시 리사이즈 보정)
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

// 8. 관제탑 통제 허브 및 실시간 프리뷰 강제 렌더러 연동
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
        if (manager.currentSketch && typeof manager.currentSketch.update === 'function') {
            manager.currentSketch.update(null); 
        }
    });
});

document.getElementById('btn-apply-cosmic')?.addEventListener('click', () => {
    syncCosmicControls();
    if (manager.currentSketch && typeof manager.currentSketch.buildCosmos === 'function') {
        manager.currentSketch.buildCosmos();
    } else {
        manager.switchSketch(manager.currentFile, analyzer);
    }
});

// 9. 녹화 및 프리셋 데이터 입출력
const recordBtn = document.getElementById('btn-record');
let isRecording = false;
recordBtn?.addEventListener('click', async () => {
    if (!isRecording) { isRecording = true; await recorder.start(); recordBtn.innerText = '⏹️ 녹화 중지'; }
    else { isRecording = false; await recorder.stop(); recordBtn.innerText = '🔴 녹화 시작 (Record)'; }
});

document.getElementById('btn-save-preset')?.addEventListener('click', () => {
    const data = JSON.stringify({ cosmic: window.cosmicEngineSettings, sketch: manager.currentFile });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data])); a.download = 'preset.json'; a.click();
});

// 시스템 기동 초기화
const activeLi = document.querySelector('#sketch-list li.active');
const defaultSketch = activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js';
manager.switchSketch(defaultSketch, analyzer);
window.addEventListener('resize', () => manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight));
