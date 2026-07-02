import { AudioAnalyzer } from './core/AudioAnalyzer.js';
import { SketchManager } from './core/SketchManager.js';
// 💡 레코더 모듈 임포트 추가
import { VideoRecorder } from './core/VideoRecorder.js';

const analyzer = new AudioAnalyzer();
const manager = new SketchManager('canvas-stage');
// 💡 레코더 인스턴스 초기화 연결
const recorder = new VideoRecorder('canvas-stage');

const audioPlayer = document.getElementById('audio-player');
const sketchItems = document.querySelectorAll('#sketch-list li');
const stageWrapper = document.getElementById('stage-wrapper');

audioPlayer.addEventListener('play', () => {
    analyzer.connectAudioElement(audioPlayer);
});

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
        if (key === 'full') stageWrapper.classList.add('ratio-full');
        if (key === 'i169') stageWrapper.classList.add('ratio-169');
        if (key === 'i916') stageWrapper.classList.add('ratio-916');

        setTimeout(() => {
            manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight);
        }, 320);
    });
});

// 🛠️ 5. [레코더 제어 파트 완전 조립]
const recordBtn = document.getElementById('btn-record');
let isRecording = false;

recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
        isRecording = true;
        recordBtn.innerText = '⏹️ 녹화 중지 및 MP4 저장';
        recordBtn.classList.add('recording');
        
        // 💥 레코더 엔진 구동 가동!
        await recorder.start();
    } else {
        isRecording = false;
        recordBtn.innerText = '🔴 녹화 시작 (Record)';
        recordBtn.classList.remove('recording');
        
        // 💥 레코더 엔진 정지 및 즉시 파일 다운로드 트리거!
        await recorder.stop();
    }
});

const defaultSketch = document.querySelector('#sketch-list li.active').getAttribute('data-sketch');
manager.switchSketch(defaultSketch, analyzer);

window.addEventListener('resize', () => {
    manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight);
});

// 🎛️ [주파수 튜닝 슬라이더 이벤트 링킹 파트]
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
    // 1. 값 추출
    const bL = parseInt(sliders.bassLow.value);
    const bH = parseInt(sliders.bassHigh.value);
    const mL = parseInt(sliders.midLow.value);
    const mH = parseInt(sliders.midHigh.value);
    const tL = parseInt(sliders.trebleLow.value);
    const tH = parseInt(sliders.trebleHigh.value);

    // 2. UI 텍스트 업데이트
    valueDisplays.bass.innerText = `${bL} - ${bH} Hz`;
    valueDisplays.mid.innerText = `${mL} - ${mH} Hz`;
    valueDisplays.treble.innerText = `${tL} - ${tH} Hz`;

    // 3. 분석기 엔진에 실시간 동적 주입
    analyzer.updateBounds({
        bassLow: bL,     bassHigh: bH,
        midLow: mL,      midHigh: mH,
        trebleLow: tL,   trebleHigh: tH
    });
}

// 모든 슬라이더에 입력 탐지 이벤트 일괄 매핑
Object.values(sliders).forEach(slider => {
    slider.addEventListener('input', handleSliderChange);
});
