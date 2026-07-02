import { AudioAnalyzer } from './core/AudioAnalyzer.js';
import { SketchManager } from './core/SketchManager.js';

// 1. 코어 엔진 인스턴스 초기화
const analyzer = new AudioAnalyzer();
const manager = new SketchManager('canvas-stage');

const audioPlayer = document.getElementById('audio-player');
const sketchItems = document.querySelectorAll('#sketch-list li');

// 2. 오디오 최초 재생 시 오디오 컨텍스트 연동 (브라우저 보안 정책 해제)
audioPlayer.addEventListener('play', () => {
    analyzer.connectAudioElement(audioPlayer);
});

// 3. 사이드바 UI 클릭 시 스케치 전환 이벤트 매핑
sketchItems.forEach(item => {
    item.addEventListener('click', async (e) => {
        sketchItems.forEach(li => li.classList.remove('active'));
        e.currentTarget.classList.add('active');

        // 파일명만 담백하게 매니저에게 전달
        const sketchFile = e.currentTarget.getAttribute('data-sketch');
        await manager.switchSketch(sketchFile, analyzer);
    });
});

// 4. 페이지 로드 시 첫 번째 스케치 자동 가동
const defaultSketch = document.querySelector('#sketch-list li.active').getAttribute('data-sketch');
manager.switchSketch(defaultSketch, analyzer);

// 5. 윈도우 리사이즈 이벤트 바인딩
window.addEventListener('resize', () => {
    manager.resize(window.innerWidth, window.innerHeight);
});
