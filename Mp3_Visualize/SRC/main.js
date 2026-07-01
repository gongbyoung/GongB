import { AudioAnalyzer } from './core/AudioAnalyzer.js';
import { SketchManager } from './core/SketchManager.js';

// 1. 인스턴스 초기화
const analyzer = new AudioAnalyzer();
const manager = new SketchManager('canvas-stage'); // index.html의 스테이지 ID 바인딩

const audioPlayer = document.getElementById('audio-player');
const sketchItems = document.querySelectorAll('#sketch-list li');

// 2. 오디오가 재생 시작될 때 컨텍스트 바인딩 (브라우저 정책 대응)
audioPlayer.addEventListener('play', () => {
    analyzer.connectAudioElement(audioPlayer);
});

// 3. 사이드바 메뉴 클릭 시 스케치 동적 전환 이벤트 바인딩
sketchItems.forEach(item => {
    item.addEventListener('click', async (e) => {
        // 활성화 클래스 변경
        sketchItems.forEach(li => li.classList.remove('active'));
        e.currentTarget.classList.add('active');

        // 선택된 스케치 파일명 획득 후 매니저에게 스위칭 명령
const sketchFile = e.currentTarget.getAttribute('data-sketch');
// main.js와 sketches 폴더는 같은 src 폴더 안에 있으므로 ./sketches/ 가 맞습니다.
await manager.switchSketch(`./sketches/${sketchFile}`, analyzer);
    });
});

// 4. 초기 첫 번째 스케치 자동 로드
const defaultSketch = document.querySelector('#sketch-list li.active').getAttribute('data-sketch');
manager.switchSketch(defaultSketch, analyzer);

// 5. 윈도우 리사이즈 대응
window.addEventListener('resize', () => {
    manager.resize(window.innerWidth, window.innerHeight);
});

