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

// 1. 초기 자산 로딩
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const srtRes = await fetch('assets/sample.srt');
        const srtText = await srtRes.text();
        parsedSubtitles = parseSRT(srtText);
        window.parsedSubtitles = parsedSubtitles;
        const img = new Image();
        img.src = 'assets/sample.jpg';
        img.onload = () => { window.currentUploadedImageElement = img; };
    } catch (err) { console.error("기본 자산 로드 실패"); }
});

// 2. 음악 재생 제어
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

audioInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    audioPlayer.pause(); 
    audioPlayer.src = URL.createObjectURL(file);
    audioPlayer.load();
    playMusicBtn.innerText = '▶️ 음악 재생 (Play)';
});

// 3. 자막 파싱
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

// 4. 스케치 및 비율 제어
sketchItems.forEach(item => {
    item.addEventListener('click', async (e) => {
        sketchItems.forEach(li => li.classList.remove('active'));
        e.currentTarget.classList.add('active');
        await manager.switchSketch(e.currentTarget.getAttribute('data-sketch'), analyzer);
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

// 5. 녹화 및 슬라이더 제어
const recordBtn = document.getElementById('btn-record');
let isRecording = false;
recordBtn?.addEventListener('click', async () => {
    if (!isRecording) { isRecording = true; await recorder.start(); recordBtn.innerText = '⏹️ 녹화 중지'; }
    else { isRecording = false; await recorder.stop(); recordBtn.innerText = '🔴 녹화 시작 (Record)'; }
});

const audioSliders = { low: document.getElementById('slide-audio-low'), high: document.getElementById('slide-audio-high') };
function handleAudioSlider() {
    if (!audioSliders.low || !audioSliders.high) return;
    const bL = 20; const bH = Math.floor(THREE.MathUtils.mapLinear(parseInt(audioSliders.low.value), 5, 95, 120, 600));
    const mL = bH; const mH = Math.floor(THREE.MathUtils.mapLinear(parseInt(audioSliders.high.value), 5, 95, 1500, 6500));
    analyzer.updateBounds({ bassLow: bL, bassHigh: bH, midLow: mL, midHigh: mH, trebleLow: mL, trebleHigh: 16000 });
}
audioSliders.low?.addEventListener('input', handleAudioSlider);
audioSliders.high?.addEventListener('input', handleAudioSlider);

// 6. 관제탑 통제 허브
const cosmicControls = {
    numSeed: document.getElementById('num-cosmic-seed'), numScatter: document.getElementById('num-cosmic-scatter'),
    color: document.getElementById('select-cosmic-color'), numGlow: document.getElementById('num-cosmic-glow'),
    numGain: document.getElementById('num-cosmic-gain'), pickGas1: document.getElementById('picker-gas1'),
    pickGas2: document.getElementById('picker-gas2'), pickStar: document.getElementById('picker-star'),
    offsetX: document.getElementById('num-offset-x'), offsetY: document.getElementById('num-offset-y'),
    offsetZ: document.getElementById('num-offset-z'), numGauge: document.getElementById('num-cosmic-gauge')
};

function syncCosmicControls() {
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
Object.values(cosmicControls).forEach(el => el?.addEventListener('input', syncCosmicControls));
document.getElementById('btn-apply-cosmic')?.addEventListener('click', () => { syncCosmicControls(); manager.currentSketch?.buildCosmos?.(); });

// 7. 프리셋 저장/불러오기
document.getElementById('btn-save-preset')?.addEventListener('click', () => {
    const data = JSON.stringify({ cosmic: window.cosmicEngineSettings, sketch: manager.currentFile });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data])); a.download = 'preset.json'; a.click();
});

// 초기화
const activeLi = document.querySelector('#sketch-list li.active');
manager.switchSketch(activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js', analyzer);
window.addEventListener('resize', () => manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight));
