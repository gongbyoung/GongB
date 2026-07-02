import { AudioAnalyzer } from './core/AudioAnalyzer.js';
import { SketchManager } from './core/SketchManager.js';

// 1. 코어 엔진 인스턴스 초기화
const analyzer = new AudioAnalyzer();
const manager = new SketchManager('canvas-stage');

const audioPlayer = document.getElementById('audio-player');
const sketchItems = document.querySelectorAll('#sketch-list li');
const stageWrapper = document.getElementById('stage-wrapper');

// 2. 오디오 가동 연동
audioPlayer.addEventListener('play', () => {
    analyzer.connectAudioElement(audioPlayer);
});

// 3. 스케치 전환 매핑
sketchItems.forEach(item => {
    item.addEventListener('click', async (e) => {
        sketchItems.forEach(li => li.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const sketchFile = e.currentTarget.getAttribute('data-sketch');
        await manager.switchSketch(sketchFile, analyzer);
    });
});

// 4. ⚙️ [신규 기능 연동] 화면 비율 스위칭 마스터 인터랙션
const ratioButtons = {
    full: document.getElementById('btn-ratio-full'),
    i169: document.getElementById('btn-ratio-169'),
    i916: document.getElementById('btn-ratio-916')
};

Object.keys(ratioButtons).forEach(key => {
    ratioButtons[key].addEventListener('click', (e) => {
        // 버튼 액티브 스타일 순환
        Object.values(ratioButtons).forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');

        // 박스 스타일 체인지 및 캔버스 강제 리사이징 유도
        stageWrapper.className = '';
        if (key === 'full') stageWrapper.classList.add('ratio-full');
        if (key === 'i169') stageWrapper.classList.add('ratio-169');
        if (key === 'i916') stageWrapper.classList.add('ratio-916');

        // 조금의 간격을 두고 매니저 크기 조율 통보
        setTimeout(() => {
            manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight);
        }, 320); // CSS Transition 시간에 맞춰 최적화
    });
});

// 5. 🔴 [신규 기능 뼈대] 레코딩 버튼 제어 파트
const recordBtn = document.getElementById('btn-record');
let isRecording = false;

recordBtn.addEventListener('click', () => {
    if (!isRecording) {
        isRecording = true;
        recordBtn.innerText = '⏹️ 녹화 중지 및 MP4 저장';
        recordBtn.classList.add('recording');
        console.log('[🎥 Recorder] 녹화 시작...');
        // TODO: VideoRecorder 엔진 시작 호출 구문 배치 예정
    } else {
        isRecording = false;
        recordBtn.innerText = '🔴 녹화 시작 (Record)';
        recordBtn.classList.remove('recording');
        console.log('[🎥 Recorder] 녹화 완료 및 파일 압축 중...');
        // TODO: VideoRecorder 엔진 중지 및 다운로드 로직 배치 예정
    }
});

// 6. 초기 구동 및 브라우저 크기 조정 연동
const defaultSketch = document.querySelector('#sketch-list li.active').getAttribute('data-sketch');
manager.switchSketch(defaultSketch, analyzer);

window.addEventListener('resize', () => {
    manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight);
});
