/**
 * src/main.js
 * 미디어 리소스 업로드, 오디오 튜닝, 스케치 매니저 및 
 * 우측 Cosmic Studio 패널 데이터 실시간 동기화 마스터 스크립트
 */

import SketchManager from './SketchManager.js';

// 1. 글로벌 상태 및 매니저 초기화
const container = document.getElementById('canvas-stage');
const manager = new SketchManager(container);

// 초기 스케치 로드 (001 파형 스케치로 시작)
manager.loadSketch('001_p5_wave.js');

// 2. 오디오 분석 인스턴스 전역 연동 설정
const audioPlayer = document.getElementById('audio-player');
let audioContext, analyser, source, dataArray;

function setupAudio() {
    if (audioContext) return; // 이미 컨텍스트가 존재하면 중복 생성 방지
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    
    source = audioContext.createMediaElementSource(audioPlayer);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
}

// 최초 유저 인터랙션(재생) 시 오디오 컨텍스트 활성화 및 락 해제
audioPlayer.addEventListener('play', () => {
    setupAudio();
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
});

// 3. 좌측 사이드바: 스케치 메뉴 리스트 스위칭 이벤트 리널 정의
const sketchItems = document.querySelectorAll('#sketch-list li');
sketchItems.forEach(item => {
    item.addEventListener('click', () => {
        sketchItems.forEach(li => li.classList.remove('active'));
        item.classList.add('active');
        
        const sketchFile = item.getAttribute('data-sketch');
        manager.loadSketch(sketchFile);
    });
});

// 4. 오디오 주파수 대역폭 튜닝 슬라이더 인터페이스 연동
const audioSliders = {
    bassLow: document.getElementById('slide-bass-low'),
    bassHigh: document.getElementById('slide-bass-high'),
    midLow: document.getElementById('slide-mid-low'),
    midHigh: document.getElementById('slide-mid-high'),
    trebleLow: document.getElementById('slide-treble-low'),
    trebleHigh: document.getElementById('slide-treble-high')
};

const audioDisplays = {
    bass: document.getElementById('val-bass'),
    mid: document.getElementById('val-mid'),
    treble: document.getElementById('val-treble')
};

function updateAudioTuningDisplay() {
    if (!audioSliders.bassLow) return; // 요소 가드
    audioDisplays.bass.innerText = `${audioSliders.bassLow.value} - ${audioSliders.bassHigh.value} Hz`;
    audioDisplays.mid.innerText = `${audioSliders.midLow.value} - ${audioSliders.midHigh.value} Hz`;
    audioDisplays.treble.innerText = `${audioSliders.trebleLow.value} - ${audioSliders.trebleHigh.value} Hz`;
}

// 오디오 슬라이더 이벤트 바인딩
Object.values(audioSliders).forEach(slider => {
    if (slider) {
        slider.addEventListener('input', updateAudioTuningDisplay);
    }
});

// 5. 화면 비율 제어 및 반응형 리사이즈 매핑
const ratioButtons = {
    full: document.getElementById('btn-ratio-full'),
    r169: document.getElementById('btn-ratio-169'),
    r916: document.getElementById('btn-ratio-916')
};
const stageWrapper = document.getElementById('stage-wrapper');

function changeRatio(ratioClass, activeBtn) {
    stageWrapper.className = '';
    stageWrapper.classList.add(ratioClass);
    
    Object.values(ratioButtons).forEach(btn => {
        if (btn) btn.classList.remove('active');
    });
    if (activeBtn) activeBtn.classList.add('active');
    
    // 구조 변경 즉시 스케치 캔버스 리사이즈 트리거 발동
    setTimeout(() => {
        manager.resize();
    }, 100);
}

if (ratioButtons.full) ratioButtons.full.addEventListener('click', () => changeRatio('ratio-full', ratioButtons.full));
if (ratioButtons.r169) ratioButtons.r169.addEventListener('click', () => changeRatio('ratio-169', ratioButtons.r169));
if (ratioButtons.r916) ratioButtons.r916.addEventListener('click', () => changeRatio('ratio-916', ratioButtons.r916));

window.addEventListener('resize', () => {
    manager.resize();
});


// 6. 🌌 [우측 패널 핵심독점 코너] Cosmic Studio Tuning 제어 데이터 동기화 파이프라인
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
    if (!cosmicSliders.seed) return; // 요소 방어막

    const seedVal = parseInt(cosmicSliders.seed.value);
    const scatterVal = parseFloat(cosmicSliders.scatter.value) / 10; // 0.5 ~ 5.0 범위 변환
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

    // 전역 공유 객체 창고 데이터 업데이트 갱신
    window.cosmicEngineSettings = {
        seed: seedVal,
        scatterExponent: scatterVal,
        colorStyle: colorVal,
        glowIntensity: glowVal,
        audioGain: gainVal,
        customColors: { gas1: cGas1, gas2: cGas2, star: cStar }
    };

    // 현재 열린 스케치가 007번 성운 무대라면 즉각 실시간 뷰 재생성 트리거 가동
    if (manager.currentFile === '007_three_cosmic_nebula.js' && manager.currentSketch) {
        const sk = manager.currentSketch;
        
        // 데이터가 바뀌었으면 리프레시 엔진 빌드 함수 호출
        if (typeof sk.buildCosmos === 'function') {
            sk.buildCosmos();
        }
    }
}

// 모든 우주 튜닝 제어 엘리먼트에 이벤트 일괄 할당
Object.values(cosmicSliders).forEach(el => {
    if (el) {
        el.addEventListener('input', syncCosmicControls);
        el.addEventListener('change', syncCosmicControls);
    }
});


// 7. 메인 오디오 틱 애니메이션 루프 실행 파트
function animate() {
    requestAnimationFrame(animate);
    
    let parsedAudioData = { subBass: 0, bass: 0, mid: 0, treble: 0, volume: 0 };
    
    if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        
        let total = 0;
        let bSum = 0, mSum = 0, tSum = 0;
        
        for (let i = 0; i < dataArray.length; i++) {
            const val = dataArray[i] / 255.0;
            total += val;
            
            if (i < 15) bSum += val;        // 저역대 (Bass)
            else if (i < 120) mSum += val;  // 중역대 (Mid)
            else tSum += val;               // 고역대 (Treble)
        }
        
        const len = dataArray.length;
        parsedAudioData = {
            subBass: (bSum / 15) * 1.5,
            bass: bSum / 15,
            mid: mSum / 105,
            treble: tSum / (len - 120),
            volume: total / len
        };
    }
    
    // 현재 구동중인 스케치 객체로 오디오 분석 데이터 패스
    manager.update(parsedAudioData);
}

// 최초 제어 초기화 및 애니메이션 루프 시동
updateAudioTuningDisplay();
syncCosmicControls();
animate();
