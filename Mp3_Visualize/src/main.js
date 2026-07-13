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

// 1. 초기 자산 자동 로딩 (assets/)
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const srtRes = await fetch('assets/sample.srt');
        parsedSubtitles = parseSRT(await srtRes.text());
        window.parsedSubtitles = parsedSubtitles;
        const img = new Image(); img.src = 'assets/sample.jpg';
        img.onload = () => { window.currentUploadedImageElement = img; };
    } catch (err) { console.warn("기본 자산 로드 대기 중"); }
});

// 2. 미리보기 재생 버튼 로직
playMusicBtn.addEventListener('click', () => {
    if (audioPlayer.paused) {
        audioPlayer.play();
        analyzer.connectAudioElement(audioPlayer);
        playMusicBtn.innerText = '⏸️ 일시정지 (Pause)';
    } else {
        audioPlayer.pause();
        playMusicBtn.innerText = '▶️ 음악 재생 (Play)';
    }
});

// 3. 파일 로드 (재생 즉시 안됨)
audioInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    audioPlayer.pause(); 
    audioPlayer.src = URL.createObjectURL(file);
    audioPlayer.load();
    playMusicBtn.innerText = '▶️ 음악 재생 (Play)';
});

// 4. 자막 파싱 및 전역 업데이트
function parseSRT(data) {
    const blocks = data.replace(/\r/g, '').trim().split('\n\n');
    return blocks.map(b => {
        const lines = b.split('\n');
        if (lines.length < 3) return null;
        const times = lines[1].split('-->');
        function timeToSeconds(t) {
            const p = t.trim().split(':');
            return parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseFloat(p[2].replace(',', '.'));
        }
        return { start: timeToSeconds(times[0]), end: timeToSeconds(times[1]), text: lines.slice(2).join(' ') };
    }).filter(Boolean);
}

audioPlayer.addEventListener('timeupdate', () => {
    if (parsedSubtitles.length === 0) return;
    const sub = parsedSubtitles.find(s => audioPlayer.currentTime >= s.start && audioPlayer.currentTime <= s.end);
    window.currentSubtitleText = sub ? sub.text : "";
});

// 5. 스케치 전환
sketchItems.forEach(item => {
    item.addEventListener('click', async (e) => {
        sketchItems.forEach(li => li.classList.remove('active'));
        e.currentTarget.classList.add('active');
        await manager.switchSketch(e.currentTarget.getAttribute('data-sketch'), analyzer);
        syncCosmicControls();
    });
});

// 6. 비율 전환 (지연 없이 즉시 리사이즈)
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

// 7. 관제탑 허브 및 프리셋 로직
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
        scatterExponent: parseFloat(cosmicControls.numScatter.value),
        colorStyle: cosmicControls.color.value,
        glowIntensity: parseFloat(cosmicControls.numGlow.value),
        audioGain: parseFloat(cosmicControls.numGain.value),
        customColors: { gas1: cosmicControls.pickGas1.value, gas2: cosmicControls.pickGas2.value, star: cosmicControls.pickStar.value },
        positionOffset: { x: parseFloat(cosmicControls.offsetX.value), y: parseFloat(cosmicControls.offsetY.value), z: parseFloat(cosmicControls.offsetZ.value) },
        gaugeValue: parseFloat(cosmicControls.numGauge.value)
    };
}

// 💡 [핵심 수리 완료]: 슬라이더 인풋 변경시 스케치 인스턴스 강제 수동 리드로우 동기화 트리거 체결
Object.values(cosmicControls).forEach(el => {
    el?.addEventListener('input', () => {
        syncCosmicControls();
        if (manager.currentSketch && typeof manager.currentSketch.update === 'function') {
            manager.currentSketch.update(null); // 프리뷰 상태에서도 변경 즉시 시각화
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

// 8. 녹화 및 프리셋 로직
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

const activeLi = document.querySelector('#sketch-list li.active');
manager.switchSketch(activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js', analyzer);
window.addEventListener('resize', () => manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight));
