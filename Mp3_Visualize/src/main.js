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

audioPlayer.addEventListener('play', () => {
    analyzer.connectAudioElement(audioPlayer);
});

audioInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    audioPlayer.pause();
    const audioURL = URL.createObjectURL(file);
    audioPlayer.src = audioURL;
    audioPlayer.load();
    audioPlayer.play();
});

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
        console.log(`[📝 SRT] 자막 로드 완료: ${parsedSubtitles.length}문장`);
    };
    reader.readAsText(file);
});

function updateCurrentSubtitle() {
    if (parsedSubtitles.length === 0) {
        window.currentSubtitleText = "";
        return;
    }
    const currentTime = audioPlayer.currentTime;
    const currentSub = parsedSubtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end);
    window.currentSubtitleText = currentSub ? currentSub.text : "";
}
audioPlayer.addEventListener('timeupdate', updateCurrentSubtitle);

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const imgURL = URL.createObjectURL(file);
    const img = new Image();
    img.src = imgURL;
    img.onload = () => {
        window.currentUploadedImageElement = img;
    };
});

// 💥 [추가] 6호 우주 엔진 실시간 슬라이더 컨트롤러 이벤트 묶기
const cosmicSliders = {
    seed: document.getElementById('slide-cosmic-seed'),
    color: document.getElementById('select-cosmic-color'),
    glow: document.getElementById('slide-cosmic-glow'),
    gain: document.getElementById('slide-cosmic-gain')
};

const cosmicDisplays = {
    seed: document.getElementById('val-cosmic-seed'),
    glow: document.getElementById('val-cosmic-glow'),
    gain: document.getElementById('val-cosmic-gain')
};

function syncCosmicControls() {
    const seedVal = parseInt(cosmicSliders.seed.value);
    const colorVal = cosmicSliders.color.value;
    const glowVal = parseFloat(cosmicSliders.glow.value) / 100;
    const gainVal = parseFloat(cosmicSliders.gain.value) / 100;

    cosmicDisplays.seed.innerText = seedVal;
    cosmicDisplays.glow.innerText = glowVal.toFixed(2);
    cosmicDisplays.gain.innerText = gainVal.toFixed(1);

    // 💡 현재 켜져 있는 스케치가 6호라면 슬라이더 물리 수치들을 직접 강제 주입
    if (manager.currentFile === '006_three_organic_flower.js' && manager.currentSketch) {
        let isSeedChanged = (manager.currentSketch.currentSeed !== seedVal);
        
        manager.currentSketch.currentSeed = seedVal;
        manager.currentSketch.colorStyle = colorVal;
        manager.currentSketch.glowIntensity = glowVal;
        manager.currentSketch.audioGain = gainVal;

        // 씨드가 직접 바뀌었을 때만 우주 공간 파티클 재배치 메커니즘을 트리거
        if (isSeedChanged && typeof manager.currentSketch.buildCosmos === 'function') {
            manager.currentSketch.buildCosmos();
        }
    }
}

Object.values(cosmicSliders).forEach(el => {
    el.addEventListener('input', syncCosmicControls);
    el.addEventListener('change', syncCosmicControls);
});

// 💡 매니저 인스턴스가 로드 성공한 직후 수치를 주입받을 수 있도록 구조 패치 전개
const originalSwitch = manager.switchSketch;
manager.switchSketch = async function(fileName, analyzerInstance) {
    manager.currentFile = fileName; // 현재 구동중인 파일명 추적 기록용 필드 확보
    await originalSwitch.call(manager, fileName, analyzerInstance);
    syncCosmicControls(); // 스케치가 켜지자마자 현재 슬라이더 셋업값 강제 인젝션
};

sketchItems.forEach(item => {
    item.addEventListener('click', async (e) => {
        sketchItems.forEach(li => li.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const sketchFile = e.currentTarget.getAttribute('data-sketch');
        await manager.switchSketch(sketchFile, analyzer);
    });
});

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
        setTimeout(() => { manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight); }, 320);
    });
});

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

const sliders = {
    bassLow: document.getElementById('slide-bass-low'), bassHigh: document.getElementById('slide-bass-high'),
    midLow: document.getElementById('slide-mid-low'),   midHigh: document.getElementById('slide-mid-high'),
    trebleLow: document.getElementById('slide-treble-low'), trebleHigh: document.getElementById('slide-treble-high')
};
const valueDisplays = {
    bass: document.getElementById('val-bass'), mid: document.getElementById('val-mid'), treble: document.getElementById('val-treble')
};
function handleSliderChange() {
    const bL = parseInt(sliders.bassLow.value);   const bH = parseInt(sliders.bassHigh.value);
    const mL = parseInt(sliders.midLow.value);    const mH = parseInt(sliders.midHigh.value);
    const tL = parseInt(sliders.trebleLow.value); const tH = parseInt(sliders.trebleHigh.value);
    valueDisplays.bass.innerText = `${bL} - ${bH} Hz`; valueDisplays.mid.innerText = `${mL} - ${mH} Hz`; valueDisplays.treble.innerText = `${tL} - ${tH} Hz`;
    analyzer.updateBounds({ bassLow: bL, bassHigh: bH, midLow: mL, midHigh: mH, trebleLow: tL, trebleHigh: tH });
}
Object.values(sliders).forEach(slider => slider.addEventListener('input', handleSliderChange));

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
            bassLow: sliders.bassLow.value, bassHigh: sliders.bassHigh.value,
            midLow: sliders.midLow.value, midHigh: sliders.midHigh.value,
            trebleLow: sliders.trebleLow.value, trebleHigh: sliders.trebleHigh.value
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
    sliders.bassLow.value = config.sliders.bassLow; sliders.bassHigh.value = config.sliders.bassHigh;
    sliders.midLow.value = config.sliders.midLow; sliders.midHigh.value = config.sliders.midHigh;
    sliders.trebleLow.value = config.sliders.trebleLow; sliders.trebleHigh.value = config.sliders.trebleHigh;
    handleSliderChange();
    stageWrapper.className = config.ratio;
    Object.values(ratioButtons).forEach(btn => btn.classList.remove('active'));
    if (config.ratio.includes('ratio-full')) ratioButtons.full.classList.add('active');
    if (config.ratio.includes('ratio-169')) ratioButtons.i169.classList.add('active');
    if (config.ratio.includes('ratio-916')) ratioButtons.i916.classList.add('active');
    manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight);
    sketchItems.forEach(li => { li.classList.remove('active'); if (li.getAttribute('data-sketch') === config.sketch) li.classList.add('active'); });
    await manager.switchSketch(config.sketch, analyzer);
    presetStatus.innerText = '📂 프리셋 로딩 완수!';
    presetStatus.style.color = '#0077ff';
});

const defaultSketch = document.querySelector('#sketch-list li.active').getAttribute('data-sketch');
manager.switchSketch(defaultSketch, analyzer);
window.addEventListener('resize', () => { manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight); });
