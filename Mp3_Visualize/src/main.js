/**
 * src/main.js
 * 미디어 리소스 업로드, 오디오 튜닝, 스케치 매니저 및 
 * 우측 Cosmic Studio 패널 데이터 실시간 동기화 마스터 스크립트
 * (정밀 주소 타게팅 보완 버젼)
 */

import { AudioAnalyzer } from './core/AudioAnalyzer.js';
import { SketchManager } from './core/SketchManager.js';
import { VideoRecorder } from './core/VideoRecorder.js';

// 1. 코어 엔진 인스턴스 초기화
const analyzer = new AudioAnalyzer();
const manager = new SketchManager('canvas-stage');
const recorder = new VideoRecorder('canvas-stage');

const audioPlayer = document.getElementById('audio-player');
const sketchItems = document.querySelectorAll('#sketch-list li');
const stageWrapper = document.getElementById('stage-wrapper');

// 파일 업로드 인풋 엘리먼트 캡처
const audioInput = document.getElementById('file-audio');
const srtInput = document.getElementById('file-srt');
const imageInput = document.getElementById('file-image');

// 자막 보관용 로컬 배열 변수
let parsedSubtitles = [];

// 2. 오디오 가동 및 실시간 업로드 스위칭 파트
audioPlayer.addEventListener('play', () => {
    analyzer.connectAudioElement(audioPlayer);
});

audioInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    audioPlayer.pause();
    const audioURL = URL.createObjectURL(file);
    audioPlayer.src = audioURL;
    
    console.log(`[🎵 Audio] 새로운 음악으로 교체 완료: ${file.name}`);
    audioPlayer.load();
    audioPlayer.play();
});

// 3. SRT 자막 파싱 및 전역 안전 연동 파트
function parseSRT(data) {
    const cleanData = data.replace(/\r/g, '').trim();
    const blocks = cleanData.split('\n\n');
    const subs = [];
    
    function timeToSeconds(t) {
        if (!t) return 0;
        const parts = t.trim().split(':');
        if (parts.length < 3) return 0;
        const secs = parts[2].split(',');
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(secs[0]) + (parseInt(secs[1]) || 0) / 1000;
    }
    
    blocks.forEach(block => {
        const lines = block.split('\n');
        if (lines.length >= 3) {
            const timeLine = lines[1];
            if (timeLine && timeLine.includes('-->')) {
                const times = timeLine.split('-->');
                const textLines = lines.slice(2).join(' ').trim();
                subs.push({ start: timeToSeconds(times[0]), end: timeToSeconds(times[1]), text: textLines });
            }
        }
    });
    return subs;
}

srtInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        parsedSubtitles = parseSRT(event.target.result);
        console.log(`[📝 SRT] 커스텀 자막 로드 성공: ${parsedSubtitles.length}문장`);
    };
    reader.readAsText(file);
});

// 오디오가 실시간으로 흘러갈 때 현재 싱크 자막을 찾아 window 전역 창 변수에 안전하게 기록
function updateCurrentSubtitle() {
    if (parsedSubtitles.length === 0) {
        window.currentSubtitleText = "";
        return;
    }
    const currentTime = audioPlayer.currentTime;
    const currentSub = parsedSubtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end);
    window.currentSubtitleText = currentSub ? currentSub.text : "";
}

// 브라우저 자체 오디오 타임 업데이트 이벤트에 싱크 연결
audioPlayer.addEventListener('timeupdate', updateCurrentSubtitle);


// 4. BG/Texture 이미지 실시간 업로드 및 전역 변수 바인딩 파트
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const imgURL = URL.createObjectURL(file);
    const img = new Image();
    img.src = imgURL;
    img.onload = () => {
        window.currentUploadedImageElement = img; 
        console.log(`[🖼️ Image] 가상 텍스처 엘리먼트 빌드 완료: ${file.name}`);
    };
});


// 5. 사이드바 UI 클릭 시 스케치 전환 이벤트 매핑 파트
sketchItems.forEach(item => {
    item.addEventListener('click', async (e) => {
        sketchItems.forEach(li => li.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        const sketchFile = e.currentTarget.getAttribute('data-sketch');
        await manager.switchSketch(sketchFile, analyzer);
    });
});


// 6. 화면 비율 스위칭 인터랙션 파트
const ratioButtons = {
    full: document.getElementById('btn-ratio-full'),
    i169: document.getElementById('btn-ratio-169'),
    i916: document.getElementById('btn-ratio-916')
};

Object.keys(ratioButtons).forEach(key => {
    ratioButtons[key].addEventListener('click', (e) => {
        Object.values(ratioButtons).forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        stageWrapper.className = '';
        if (key === 'full') stageWrapper.className = 'ratio-full';
        if (key === 'i169') stageWrapper.className = 'ratio-169';
        if (key === 'i916') stageWrapper.className = 'ratio-916';
        
        setTimeout(() => {
            manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight);
        }, 320);
    });
});


// 7. MP4 레코더 버튼 제어 파트
const recordBtn = document.getElementById('btn-record');
let isRecording = false;

recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
        isRecording = true;
        recordBtn.innerText = '⏹️ 녹화 중지 및 MP4 저장';
        recordBtn.classList.add('recording');
        await recorder.start();
    } else {
        isRecording = false;
        recordBtn.innerText = '🔴 녹화 시작 (Record)';
        recordBtn.classList.remove('recording');
        await recorder.stop();
    }
});


// 8. 주파수 튜닝 슬라이더 이벤트 링킹 파트
const sliders = {
    bassLow: document.getElementById('slide-bass-low'),
    bassHigh: document.getElementById('slide-bass-high'),
    midLow: document.getElementById('slide-mid-low'),
    midHigh: document.getElementById('slide-mid-high'),
    trebleLow: document.getElementById('slide-treble-low'),
    trebleHigh: document.getElementById('slide-treble-high')
};

const valueDisplays = {
    bass: document.getElementById('val-bass'),
    mid: document.getElementById('val-mid'),
    treble: document.getElementById('val-treble')
};

function handleSliderChange() {
    const bL = parseInt(sliders.bassLow.value);   const bH = parseInt(sliders.bassHigh.value);
    const mL = parseInt(sliders.midLow.value);    const mH = parseInt(sliders.midHigh.value);
    const tL = parseInt(sliders.trebleLow.value); const tH = parseInt(sliders.trebleHigh.value);
    
    valueDisplays.bass.innerText = `${bL} - ${bH} Hz`;
    valueDisplays.mid.innerText = `${mL} - ${mH} Hz`;
    valueDisplays.treble.innerText = `${tL} - ${tH} Hz`;
    
    analyzer.updateBounds({ bassLow: bL, bassHigh: bH, midLow: mL, midHigh: mH, trebleLow: tL, trebleHigh: tH });
}
Object.values(sliders).forEach(slider => slider.addEventListener('input', handleSliderChange));


// 9. 🌌 [우측 패널] Cosmic Studio Tuning 제어 데이터 동기화 파이프라인 파트
const cosmicSliders = {
    seed: document.getElementById('slide-cosmic-seed'),
    scatter: document.getElementById('slide-cosmic-scatter'),
    color: document.getElementById('select-cosmic-color'),
    glow: document.getElementById('slide-cosmic-glow'),
    gain: document.getElementById('slide-cosmic-gain'),
    pickGas1: document.getElementById('picker-gas1'),
    pickGas2: document.getElementById('picker-gas2'),
    pickStar: document.getElementById('picker-star')
};

const cosmicDisplays = {
    seed: document.getElementById('val-cosmic-seed'),
    scatter: document.getElementById('val-cosmic-scatter'),
    glow: document.getElementById('val-cosmic-glow'),
    gain: document.getElementById('val-cosmic-gain')
};

function syncCosmicControls() {
    if (!cosmicSliders.seed) return; 

    const seedVal = parseInt(cosmicSliders.seed.value);
    const scatterVal = parseFloat(cosmicSliders.scatter.value) / 10; 
    const colorVal = cosmicSliders.color.value;
    const glowVal = parseFloat(cosmicSliders.glow.value) / 100;
    const gainVal = parseFloat(cosmicSliders.gain.value) / 100;

    const cGas1 = cosmicSliders.pickGas1.value;
    const cGas2 = cosmicSliders.pickGas2.value;
    const cStar = cosmicSliders.pickStar.value;

    cosmicDisplays.seed.innerText = seedVal;
    cosmicDisplays.scatter.innerText = scatterVal.toFixed(1);
    cosmicDisplays.glow.innerText = glowVal.toFixed(2);
    cosmicDisplays.gain.innerText = gainVal.toFixed(1);

    window.cosmicEngineSettings = {
        seed: seedVal,
        scatterExponent: scatterVal,
        colorStyle: colorVal,
        glowIntensity: glowVal,
        audioGain: gainVal,
        customColors: { gas1: cGas1, gas2: cGas2, star: cStar }
    };

    if (manager.currentFile === '007_three_cosmic_nebula.js' && manager.currentSketch) {
        const sk = manager.currentSketch;
        if (typeof sk.buildCosmos === 'function') {
            sk.buildCosmos();
        }
    }
}

Object.values(cosmicSliders).forEach(el => {
    if (el) {
        el.addEventListener('input', syncCosmicControls);
        el.addEventListener('change', syncCosmicControls);
    }
});

if (cosmicSliders.pickGas1) cosmicSliders.pickGas1.addEventListener('change', syncCosmicControls);
if (cosmicSliders.pickGas2) cosmicSliders.pickGas2.addEventListener('change', syncCosmicControls);
if (cosmicSliders.pickStar) cosmicSliders.pickStar.addEventListener('change', syncCosmicControls);


// 10. 프리셋 저장 및 로딩 시스템 파트
const savePresetBtn = document.getElementById('btn-save-preset');
const loadPresetBtn = document.getElementById('btn-load-preset');
const presetStatus = document.getElementById('preset-status');

if (localStorage.getItem('gongb_visual_preset')) {
    presetStatus.innerText = '✅ 최근 저장된 설정을 불러올 수 있습니다.';
    presetStatus.style.color = '#00ffcc';
}

savePresetBtn.addEventListener('click', () => {
    const activeSketch = document.querySelector('#sketch-list li.active').getAttribute('data-sketch');
    const activeRatio = stageWrapper.className;
    const currentSettings = {
        sketch: activeSketch, ratio: activeRatio,
        sliders: {
            bassLow: sliders.bassLow.value,       bassHigh: sliders.bassHigh.value,
            midLow: sliders.midLow.value,         midHigh: sliders.midHigh.value,
            trebleLow: sliders.trebleLow.value,   trebleHigh: sliders.trebleHigh.value
        }
    };
    localStorage.setItem('gongb_visual_preset', JSON.stringify(currentSettings));
    presetStatus.innerText = '💾 성공적으로 저장되었습니다!';
    presetStatus.style.color = '#00ffcc';
    setTimeout(() => { presetStatus.innerText = '✅ 최근 저장된 설정을 불러올 수 있습니다.'; }, 2000);
});

loadPresetBtn.addEventListener('click', async () => {
    const savedData = localStorage.getItem('gongb_visual_preset');
    if (!savedData) { presetStatus.innerText = '❌ 불러올 프리셋 데이터가 없습니다.'; presetStatus.style.color = '#ff0055'; return; }
    
    const config = JSON.parse(savedData);
    sliders.bassLow.value = config.sliders.bassLow;   sliders.bassHigh.value = config.sliders.bassHigh;
    sliders.midLow.value = config.sliders.midLow;     sliders.midHigh.value = config.sliders.midHigh;
    sliders.trebleLow.value = config.sliders.trebleLow; sliders.trebleHigh.value = config.sliders.trebleHigh;
    handleSliderChange();
    
    stageWrapper.className = config.ratio;
    manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight);
    
    sketchItems.forEach(li => { li.classList.remove('active'); if (li.getAttribute('data-sketch') === config.sketch) li.classList.add('active'); });
    await manager.switchSketch(config.sketch, analyzer);
    
    presetStatus.innerText = '📂 프리셋 로딩 완수!';
    presetStatus.style.color = '#0077ff';
});


// 11. 초기 구동 및 브라우저 크기 조정 연동 파트
const defaultSketch = document.querySelector('#sketch-list li.active').getAttribute('data-sketch');
manager.switchSketch(defaultSketch, analyzer);

window.addEventListener('resize', () => { 
    manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight); 
});

// 스케치 로드 직후 동적 연동 주입을 위한 후처리 래핑
const originalSwitch = manager.switchSketch;
manager.switchSketch = async function(fileName, analyzerInstance) {
    manager.currentFile = fileName; 
    await originalSwitch.call(manager, fileName, analyzerInstance);
    syncCosmicControls(); 
};