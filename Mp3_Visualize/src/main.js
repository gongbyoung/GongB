/**
 * src/main.js
 * - [버전] Ver 5.0 (로컬 탐색창 기반 .json 프리셋 파일 다운로드/오픈 전면 탑재판)
 * - 각 스케치명에 최적화된 이름 자동 조립 프리셋 다운로드 파일 시스템 시공 완료
 */

import { AudioAnalyzer } from './core/AudioAnalyzer.js';
import { SketchManager } from './core/SketchManager.js';
import { VideoRecorder } from './core/VideoRecorder.js';

const analyzer = new AudioAnalyzer();
const manager = new SketchManager('canvas-stage');
const recorder = new VideoRecorder('canvas-stage');

const audioPlayer = document.getElementById('audio-player');
const sketchItems = document.querySelectorAll('#sketch-list li');
const stageWrapper = document.getElementById('stage-wrapper');

const audioInput = document.getElementById('file-audio');
const srtInput = document.getElementById('file-srt');
const imageInput = document.getElementById('file-image');

let parsedSubtitles = [];

audioPlayer.addEventListener('play', () => { analyzer.connectAudioElement(audioPlayer); });
audioInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    audioPlayer.pause(); const audioURL = URL.createObjectURL(file); audioPlayer.src = audioURL;
    audioPlayer.load(); audioPlayer.play();
});

function parseSRT(data) {
    const cleanData = data.replace(/\r/g, '').trim(); const blocks = cleanData.split('\n\n'); const subs = [];
    function timeToSeconds(t) {
        if (!t) return 0; const parts = t.trim().split(':'); if (parts.length < 3) return 0;
        const secs = parts[2].split(','); return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(secs[0]) + (parseInt(secs[1]) || 0) / 1000;
    }
    blocks.forEach(block => {
        const lines = block.split('\n');
        if (lines.length >= 3) {
            const timeLine = lines[1];
            if (timeLine && timeLine.includes('-->')) {
                const times = timeLine.split('-->'); const textLines = lines.slice(2).join(' ').trim();
                subs.push({ start: timeToSeconds(times[0]), end: timeToSeconds(times[1]), text: textLines });
            }
        }
    });
    return subs;
}

srtInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = (event) => { parsedSubtitles = parseSRT(event.target.result); }; reader.readAsText(file);
});

function updateCurrentSubtitle() {
    if (parsedSubtitles.length === 0) { window.currentSubtitleText = ""; return; }
    const currentTime = audioPlayer.currentTime;
    const currentSub = parsedSubtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end);
    window.currentSubtitleText = currentSub ? currentSub.text : "";
}
audioPlayer.addEventListener('timeupdate', updateCurrentSubtitle);

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const imgURL = URL.createObjectURL(file); const img = new Image(); img.src = imgURL;
    img.onload = () => { window.currentUploadedImageElement = img; };
});

sketchItems.forEach(item => {
    item.addEventListener('click', async (e) => {
        sketchItems.forEach(li => li.classList.remove('active')); e.currentTarget.classList.add('active');
        const sketchFile = e.currentTarget.getAttribute('data-sketch'); await manager.switchSketch(sketchFile, analyzer);
    });
});

const ratioButtons = {
    full: document.getElementById('btn-ratio-full'),
    i169: document.getElementById('btn-ratio-169'),
    i916: document.getElementById('btn-ratio-916')
};

Object.keys(ratioButtons).forEach(key => {
    if (ratioButtons[key]) {
        ratioButtons[key].addEventListener('click', (e) => {
            Object.values(ratioButtons).forEach(btn => { if(btn) btn.classList.remove('active'); }); e.currentTarget.classList.add('active');
            stageWrapper.className = '';
            if (key === 'full') stageWrapper.className = 'ratio-full';
            if (key === 'i169') stageWrapper.className = 'ratio-169';
            if (key === 'i916') stageWrapper.className = 'ratio-916';
            setTimeout(() => { manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight); }, 150);
        });
    }
});

const recordBtn = document.getElementById('btn-record');
let isRecording = false;
if (recordBtn) {
    recordBtn.addEventListener('click', async () => {
        if (!isRecording) {
            isRecording = true; recordBtn.innerText = '⏹️ 녹화 중지 및 MP4 저장'; recordBtn.classList.add('recording'); await recorder.start();
        } else {
            isRecording = false; recordBtn.innerText = '🔴 녹화 시작 (Record)'; recordBtn.classList.remove('recording'); await recorder.stop();
        }
    });
}

const audioSliders = {
    low: document.getElementById('slide-audio-low'), high: document.getElementById('slide-audio-high'),
    filledTrack: document.getElementById('dual-filled-track'), valBounds: document.getElementById('val-audio-bounds'),
    lblBass: document.getElementById('lbl-bass-range'), lblMid: document.getElementById('lbl-mid-range'), lblTreble: document.getElementById('lbl-treble-range')
};

function handleDualAudioSliderChange() {
    if (!audioSliders.low || !audioSliders.high) return;
    let lVal = parseInt(audioSliders.low.value); let hVal = parseInt(audioSliders.high.value);
    if (lVal >= hVal) { audioSliders.low.value = hVal - 2; lVal = hVal - 2; }
    if (audioSliders.filledTrack) { audioSliders.filledTrack.style.left = lVal + '%'; audioSliders.filledTrack.style.right = (100 - hVal) + '%'; }
    if (audioSliders.valBounds) audioSliders.valBounds.innerText = `${lVal}% | ${hVal}%`;
    if (audioSliders.lblBass) audioSliders.lblBass.innerText = `0% ~ ${lVal}%`;
    if (audioSliders.lblMid) audioSliders.lblMid.innerText = `${lVal}% ~ ${hVal}%`;
    if (audioSliders.lblTreble) audioSliders.lblTreble.innerText = `${hVal}% ~ 100%`;

    const bL = 20; const bH = Math.floor(THREE.MathUtils.mapLinear(lVal, 5, 95, 120, 600));
    const mL = bH; const mH = Math.floor(THREE.MathUtils.mapLinear(hVal, 5, 95, 1500, 6500));
    const tL = mH; const tH = 16000;
    analyzer.updateBounds({ bassLow: bL, bassHigh: bH, midLow: mL, midHigh: mH, trebleLow: tL, trebleHigh: tH });
}

if (audioSliders.low && audioSliders.high) {
    audioSliders.low.addEventListener('input', handleDualAudioSliderChange); audioSliders.high.addEventListener('input', handleDualAudioSliderChange);
    handleDualAudioSliderChange();
}

const cosmicControls = {
    numSeed: document.getElementById('num-cosmic-seed'), numScatter: document.getElementById('num-cosmic-scatter'),
    color: document.getElementById('select-cosmic-color'), numGlow: document.getElementById('num-cosmic-glow'),
    numGain: document.getElementById('num-cosmic-gain'),
    pickGas1: document.getElementById('picker-gas1'), pickGas2: document.getElementById('picker-gas2'), pickStar: document.getElementById('picker-star'),
    offsetX: document.getElementById('num-offset-x'), offsetY: document.getElementById('num-offset-y'), offsetZ: document.getElementById('num-offset-z'),
    numGauge: document.getElementById('num-cosmic-gauge')
};

function syncCosmicControls() {
    if (!cosmicControls.numSeed) return; 
    const seedVal = parseInt(cosmicControls.numSeed.value) || 42; const scatterVal = (parseFloat(cosmicControls.numScatter.value) || 22) / 10; 
    const colorVal = cosmicControls.color ? cosmicControls.color.value : 'neon'; const glowVal = (parseFloat(cosmicControls.numGlow.value) || 85) / 100;
    const gainVal = (parseFloat(cosmicControls.numGain.value) || 100) / 100;
    const cGas1 = cosmicControls.pickGas1 ? cosmicControls.pickGas1.value : '#ff0055'; const cGas2 = cosmicControls.pickGas2 ? cosmicControls.pickGas2.value : '#00ffcc'; const cStar = cosmicControls.pickStar ? cosmicSliders.pickStar.value : '#ffffff';
    const offX = cosmicControls.offsetX ? parseFloat(cosmicControls.offsetX.value) : 0; const offY = cosmicControls.offsetY ? parseFloat(cosmicControls.offsetY.value) : 0; const offZ = cosmicControls.offsetZ ? parseFloat(cosmicControls.offsetZ.value) : 0;
    const gaugeValue = cosmicControls.numGauge ? parseInt(cosmicControls.numGauge.value) : 50;

    window.cosmicEngineSettings = {
        seed: seedVal, scatterExponent: scatterVal, colorStyle: colorVal, glowIntensity: glowVal, audioGain: gainVal,
        customColors: { gas1: cGas1, gas2: cGas2, star: cStar }, positionOffset: { x: offX, y: offY, z: offZ }, gaugeValue: gaugeValue / 100
    };
}

Object.values(cosmicControls).forEach(el => {
    if (el) { el.addEventListener('input', syncCosmicControls); el.addEventListener('change', syncCosmicControls); }
});

const applyCosmicBtn = document.getElementById('btn-apply-cosmic');
if (applyCosmicBtn) {
    applyCosmicBtn.addEventListener('click', () => {
        syncCosmicControls();
        if (manager.currentSketch && typeof manager.currentSketch.buildCosmos === 'function') { manager.currentSketch.buildCosmos(); }
    });
}

// ==========================================================================
// 💡 [대수술 완료] 로컬 탐색창 허브 연동 오버홀 파트 (.json 다이렉트 파일 입출력)
// ==========================================================================
const savePresetBtn = document.getElementById('btn-save-preset');
const loadPresetBtn = document.getElementById('btn-load-preset');
const hiddenPresetInput = document.getElementById('hidden-preset-file-input');
const presetStatus = document.getElementById('preset-status');

if (savePresetBtn) {
    savePresetBtn.addEventListener('click', () => {
        const activeLi = document.querySelector('#sketch-list li.active');
        const activeSketch = activeLi ? activeLi.getAttribute('data-sketch') : '002_three_cube.js';
        let activeRatioKey = 'full';
        if (stageWrapper.classList.contains('ratio-169')) activeRatioKey = 'i169';
        if (stageWrapper.classList.contains('ratio-916')) activeRatioKey = 'i916';

        // 파일 내부에 바인딩할 통합 데이터 오브젝트 빌드
        const exportData = {
            factoryMeta: "GongB Visualizer Preset",
            sketch: activeSketch,
            ratioKey: activeRatioKey,
            cosmic: {
                seed: cosmicControls.numSeed.value, scatter: cosmicControls.numScatter.value,
                color: cosmicControls.color ? cosmicControls.color.value : 'neon', glow: cosmicControls.numGlow.value,
                gain: cosmicControls.numGain.value, gas1: cosmicControls.pickGas1.value, gas2: cosmicControls.pickGas2.value, star: cosmicControls.pickStar.value,
                offsetX: cosmicControls.offsetX.value, offsetY: cosmicControls.offsetY.value, offsetZ: cosmicControls.offsetZ.value,
                gauge: cosmicControls.numGauge.value
            },
            audioBounds: { low: audioSliders.low.value, high: audioSliders.high.value }
        };

        // 가상 앵커를 활용한 탐색창 기반 파일 즉시 추출 다운로드 트리거
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        // 파일명을 스케치 이름 접두사와 결합하여 직관적으로 자동 설정 (예: 007_nebula_preset.json)
        const cleanName = activeSketch.split('.')[0];
        a.href = url;
        a.download = `${cleanName}_preset.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (presetStatus) { presetStatus.innerText = "💾 로컬 탐색창으로 파일 추출 완수!"; presetStatus.style.color = "#00ffcc"; }
    });
}

// 불러오기 클릭 시 하드웨어 인풋 이벤트를 토글 개방
if (loadPresetBtn && hiddenPresetInput) {
    loadPresetBtn.addEventListener('click', () => { hiddenPresetInput.click(); });
    
    hiddenPresetInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const config = JSON.parse(event.target.result);
                
                // 1. 넘버링 수치 하드웨어 인젝션 복원
                if (config.cosmic) {
                    cosmicControls.numSeed.value = config.cosmic.seed; cosmicControls.numScatter.value = config.cosmic.scatter;
                    if (cosmicControls.color) cosmicControls.color.value = config.cosmic.color; cosmicControls.numGlow.value = config.cosmic.glow;
                    cosmicControls.numGain.value = config.cosmic.gain; cosmicControls.pickGas1.value = config.cosmic.gas1;
                    cosmicControls.pickGas2.value = config.cosmic.gas2; cosmicControls.pickStar.value = config.cosmic.star;
                    cosmicControls.offsetX.value = config.cosmic.offsetX || 0; cosmicControls.offsetY.value = config.cosmic.offsetY || 0;
                    cosmicControls.offsetZ.value = config.cosmic.offsetZ || 0; cosmicControls.numGauge.value = config.cosmic.gauge || 50;
                    syncCosmicControls();
                }
                // 2. 하단 주파수 슬라이더 복원
                if (config.audioBounds && audioSliders.low && audioSliders.high) {
                    audioSliders.low.value = config.audioBounds.low; audioSliders.high.value = config.audioBounds.high; handleDualAudioSliderChange();
                }
                // 3. 화면 비율 노드 복원
                const targetRatioKey = config.ratioKey || 'full';
                Object.keys(ratioButtons).forEach(key => {
                    if (ratioButtons[key]) { if (key === targetRatioKey) ratioButtons[key].classList.add('active'); else ratioButtons[key].classList.remove('active'); }
                });
                stageWrapper.className = '';
                if (targetRatioKey === 'full') stageWrapper.className = 'ratio-full';
                if (targetRatioKey === 'i169') stageWrapper.className = 'ratio-169';
                if (targetRatioKey === 'i916') stageWrapper.className = 'ratio-916';
                
                setTimeout(() => { manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight); }, 150);

                // 4. 스케치 자동 타게팅 교체 복원
                if (config.sketch) {
                    sketchItems.forEach(li => { li.classList.remove('active'); if (li.getAttribute('data-sketch') === config.sketch) li.classList.add('active'); });
                    await manager.switchSketch(config.sketch, analyzer);
                }

                if (presetStatus) { presetStatus.innerText = `📂 로드 완수: ${file.name}`; presetStatus.style.color = "#0077ff"; }
            } catch (err) {
                if (presetStatus) { presetStatus.innerText = "❌ 파싱 실패: 손상된 파일"; presetStatus.style.color = "#ff0055"; }
            }
        };
        reader.readAsText(file);
        // 연속 바인딩을 위해 인풋 버퍼 클리어
        e.target.value = "";
    });
}

const activeLi = document.querySelector('#sketch-list li.active');
const defaultSketch = activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js';
manager.switchSketch(defaultSketch, analyzer);

window.addEventListener('resize', () => { manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight); });
const originalSwitch = manager.switchSketch;
manager.switchSketch = async function(fileName, analyzerInstance) {
    manager.currentFile = fileName; await originalSwitch.call(manager, fileName, analyzerInstance); syncCosmicControls(); 
};
