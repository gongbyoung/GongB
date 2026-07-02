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
