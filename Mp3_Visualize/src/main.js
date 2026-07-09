/**
 * src/main.js
 * - [버전] Ver 5.1 (cosmicControls 오타 완치 및 프리셋 파일 입출력 안정화 패치판)
 * - 슬라이더 간섭 잔재(cosmicSliders, cosmicFacilities)를 완벽히 도려내고 cosmicControls로 통일
 * - Shuffle, Range, Scale, Volume 인풋 박스 기반의 완벽한 단독 데이터 파이프라인
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
    const reader = new FileReader(); reader.onload = (event) => { parsedSubtitles = parseSRT(event.target.result); window.parsedSubtitles = parsedSubtitles; }; reader.readAsText(file);
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

// 💡 [수리 기포 마커] cosmicControls 단독 인풋 허브 매립 완수
const cosmicControls = {
    numSeed: document.getElementById('num-cosmic-seed'),
    numScatter: document.getElementById('num-cosmic-scatter'),
    color: document.getElementById('select-cosmic-color'),
    numGlow: document.getElementById('num-cosmic-glow'),
    numGain: document.getElementById('num-cosmic-gain'),
    pickGas1: document.getElementById('picker-gas1'),
    pickGas2: document.getElementById('picker-gas2'),
    pickStar: document.getElementById('picker-star'),
    offsetX: document.getElementById('num-offset-x'),
    offsetY: document.getElementById('num-offset-y'),
    offsetZ: document.getElementById('num-offset-z'),
    numGauge: document.getElementById('num-cosmic-gauge')
};

function syncCosmicControls() {
    if (!cosmicControls.numSeed) return; 

    const seedVal = parseInt(cosmicControls.numSeed.value) || 42;
    const scatterVal = (parseFloat(cosmicControls.numScatter.value) || 22) / 10; 
    const colorVal = cosmicControls.color ? cosmicControls.color.value : 'neon';
    const glowVal = (parseFloat(cosmicControls.numGlow.value) || 85) / 100;
    const gainVal = (parseFloat(cosmicControls.numGain.value) || 100) / 100;
    
    const cGas1 = cosmicControls.pickGas1 ? cosmicControls.pickGas1.value : '#ff0055';
    const cGas2 = cosmicControls.pickGas2 ? cosmicControls.pickGas2.value : '#00ffcc';
    const cStar = cosmicControls.pickStar ? cosmicControls.pickStar.value : '#ffffff';

    const offX = cosmicControls.offsetX ? parseFloat(cosmicControls.offsetX.value) : 0;
    const offY = cosmicControls.offsetY ? parseFloat(cosmicControls.offsetY.value) : 0;
    const offZ = cosmicControls.offsetZ ? parseFloat(cosmicControls.offsetZ.value) : 0;
    const gaugeValue = cosmicControls.numGauge ? parseInt(cosmicControls.numGauge.value) : 50;

    window.cosmicEngineSettings = {
        seed: seedVal,
        scatterExponent: scatterVal,
        colorStyle: colorVal,
        glowIntensity: glowVal,
        audioGain: gainVal,
        customColors: { gas1: cGas1, gas2: cGas2, star: cStar },
        positionOffset: { x: offX, y: offY, z: offZ },
        gaugeValue: gaugeValue / 100
    };
}

Object.values(cosmicControls).forEach(el => {
    if (el) {
        el.addEventListener('input', syncCosmicControls);
        el.addEventListener('change', syncCosmicControls);
    }
});

const applyCosmicBtn = document.getElementById('btn-apply-cosmic');
if (applyCosmicBtn) {
    applyCosmicBtn.addEventListener('click', () => {
        syncCosmicControls();
        if (manager.currentSketch && typeof manager.currentSketch.buildCosmos === 'function') {
            manager.currentSketch.buildCosmos();
        }
    });
}

// 💡 [에러 교정 완료] 다른 이름으로 저장 및 열기 기능의 변수 충돌 완전 소멸
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

        const exportData = {
            factoryMeta: "GongB Visualizer Preset",
            sketch: activeSketch,
            ratioKey: activeRatioKey,
            cosmic: {
                seed: cosmicControls.numSeed.value,
                scatter: cosmicControls.numScatter.value,
                color: cosmicControls.color ? cosmicControls.color.value : 'neon',
                glow: cosmicControls.numGlow.value,
                gain: cosmicControls.numGain.value,
                gas1: cosmicControls.pickGas1.value,
                gas2: cosmicControls.pickGas2.value,
                star: cosmicControls.pickStar.value,
                offsetX: cosmicControls.offsetX.value,
                offsetY: cosmicControls.offsetY.value,
                offsetZ: cosmicControls.offsetZ.value,
                gauge: cosmicControls.numGauge.value
            },
            audioBounds: { low: audioSliders.low.value, high: audioSliders.high.value }
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const cleanName = activeSketch.split('.')[0];
        a.href = url;
        a.download = `${cleanName}_preset.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (presetStatus) { presetStatus.innerText = "💾 로컬 프리셋 파일 추출 완수!"; presetStatus.style.color = "#00ffcc"; }
    });
}

if (loadPresetBtn && hiddenPresetInput) {
    loadPresetBtn.addEventListener('click', () => { hiddenPresetInput.click(); });
    hiddenPresetInput.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const config = JSON.parse(event.target.result);
                if (config.cosmic) {
                    cosmicControls.numSeed.value = config.cosmic.seed; cosmicControls.numScatter.value = config.cosmic.scatter;
                    if (cosmicControls.color) cosmicControls.color.value = config.cosmic.color; cosmicControls.numGlow.value = config.cosmic.glow;
                    cosmicControls.numGain.value = config.cosmic.gain; cosmicControls.pickGas1.value = config.cosmic.gas1;
                    cosmicControls.pickGas2.value = config.cosmic.gas2; cosmicControls.pickStar.value = config.cosmic.star;
                    cosmicControls.offsetX.value = config.cosmic.offsetX || 0; cosmicControls.offsetY.value = config.cosmic.offsetY || 0;
                    cosmicControls.offsetZ.value = config.cosmic.offsetZ || 0; cosmicControls.numGauge.value = config.cosmic.gauge || 50;
                    syncCosmicControls();
                }
                if (config.audioBounds && audioSliders.low && audioSliders.high) {
                    audioSliders.low.value = config.audioBounds.low; audioSliders.high.value = config.audioBounds.high; handleDualAudioSliderChange();
                }
                const targetRatioKey = config.ratioKey || 'full';
                Object.keys(ratioButtons).forEach(key => {
                    if (ratioButtons[key]) { if (key === targetRatioKey) ratioButtons[key].classList.add('active'); else ratioButtons[key].classList.remove('active'); }
                });
                stageWrapper.className = '';
                if (targetRatioKey === 'full') stageWrapper.className = 'ratio-full';
                if (targetRatioKey === '169') stageWrapper.className = 'ratio-169';
                if (targetRatioKey === '916') stageWrapper.className = 'ratio-916';
                
                setTimeout(() => { manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight); }, 150);
                if (config.sketch) {
                    sketchItems.forEach(li => { li.classList.remove('active'); if (li.getAttribute('data-sketch') === config.sketch) li.classList.add('active'); });
                    await manager.switchSketch(config.sketch, analyzer);
                }
                if (presetStatus) { presetStatus.innerText = `📂 로드 완수: ${file.name}`; presetStatus.style.color = "#0077ff"; }
            } catch (err) {
                if (presetStatus) { presetStatus.innerText = "❌ 프리셋 로드 실패"; presetStatus.style.color = "#ff0055"; }
            }
        };
        reader.readAsText(file); e.target.value = "";
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
