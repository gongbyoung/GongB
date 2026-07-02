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

// 💾 [프리셋 저장 및 로딩 시스템 로직 파트]
const savePresetBtn = document.getElementById('btn-save-preset');
const loadPresetBtn = document.getElementById('btn-load-preset');
const presetStatus = document.getElementById('preset-status');

// 페이지 로드 시 기존 저장된 프리셋이 있는지 검사하여 텍스트 갱신
if (localStorage.getItem('gongb_visual_preset')) {
    presetStatus.innerText = '✅ 최근 저장된 설정을 불러올 수 있습니다.';
    presetStatus.style.color = '#00ffcc';
}

// 1. 현재 모든 수치 캡처 후 LocalStorage에 구워버리기
savePresetBtn.addEventListener('click', () => {
    // 현재 활성화된 스케치명 획득
    const activeSketch = document.querySelector('#sketch-list li.active').getAttribute('data-sketch');
    
    // 현재 활성화된 화면 비율 획득
    const activeRatio = stageWrapper.className;

    // 현재 슬라이더 수치들을 하나의 객체로 바인딩
    const currentSettings = {
        sketch: activeSketch,
        ratio: activeRatio,
        sliders: {
            bassLow: sliders.bassLow.value,
            bassHigh: sliders.bassHigh.value,
            midLow: sliders.midLow.value,
            midHigh: sliders.midHigh.value,
            trebleLow: sliders.trebleLow.value,
            trebleHigh: sliders.trebleHigh.value
        }
    };

    // 브라우저 로컬 저장소에 JSON 문자열로 저장
    localStorage.setItem('gongb_visual_preset', JSON.stringify(currentSettings));
    
    // 알림 피드백 애니메이션 효과 효과
    presetStatus.innerText = '💾 성공적으로 저장되었습니다!';
    presetStatus.style.color = '#00ffcc';
    setTimeout(() => {
        presetStatus.innerText = '✅ 최근 저장된 설정을 불러올 수 있습니다.';
    }, 2000);
});

// 2. LocalStorage에서 값을 파싱해와 캔버스 및 슬라이더 복구하기
loadPresetBtn.addEventListener('click', async () => {
    const savedData = localStorage.getItem('gongb_visual_preset');
    
    if (!savedData) {
        presetStatus.innerText = '❌ 불러올 프리셋 데이터가 없습니다.';
        presetStatus.style.color = '#ff0055';
        return;
    }

    const config = JSON.parse(savedData);

    // [복구 1] 슬라이더 물리 수치 대입 및 텍스트 리프레시
    sliders.bassLow.value = config.sliders.bassLow;
    sliders.bassHigh.value = config.sliders.bassHigh;
    sliders.midLow.value = config.sliders.midLow;
    sliders.midHigh.value = config.sliders.midHigh;
    sliders.trebleLow.value = config.sliders.trebleLow;
    sliders.trebleHigh.value = config.sliders.trebleHigh;
    handleSliderChange(); // 주파수 분석 엔진 동기화 함수 강제 호출

    // [복구 2] 화면 비율 래퍼 마스크 및 버튼 스타일 동기화
    stageWrapper.className = config.ratio;
    Object.values(ratioButtons).forEach(btn => btn.classList.remove('active'));
    if (config.ratio.includes('ratio-full')) ratioButtons.full.classList.add('active');
    if (config.ratio.includes('ratio-169')) ratioButtons.i169.classList.add('active');
    if (config.ratio.includes('ratio-916')) ratioButtons.i916.classList.add('active');
    manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight);

    // [복구 3] 대상 미디어 아트 스케치 동적 복구
    sketchItems.forEach(li => {
        li.classList.remove('active');
        if (li.getAttribute('data-sketch') === config.sketch) {
            li.classList.add('active');
        }
    });
    await manager.switchSketch(config.sketch, analyzer);

    presetStatus.innerText = '📂 프리셋 로딩 완수!';
    presetStatus.style.color = '#0077ff';
});
