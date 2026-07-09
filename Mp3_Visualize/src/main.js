/**
 * src/main.js
 * - [버전] Ver 4.17 (지형변경 ~ 폭발력 및 출력 비율 전수 통합 마스터 프리셋 완결판)
 * - 저장 버튼 클릭 시 Cosmic Studio 슬라이더 및 컬러 세팅, 출력 비율 버튼 상태까지 전체 바인딩 아카이빙
 * - 불러오기 시 슬라이더 핸들의 하드웨어 위치와 출력 비율 레이아웃 패널 상태를 100% 실시간 복조 동기화
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

const audioInput = document.getElementById('file-audio');
const srtInput = document.getElementById('file-srt');
const imageInput = document.getElementById('file-image');

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

// 4. BG/Texture 이미지 실시간 업로드 및 전역 안전 바인딩
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const imgURL = URL.createObjectURL(file);
    const img = new Image();
    img.src = imgURL;
    img.onload = () => {
        window.currentUploadedImageElement = img; 
        console.log(`%c[🖼️ Image] 가상 텍스처 업데이트 매핑 완료: ${file.name}`, "color: #00ffcc; font-weight: bold;");
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
    if (ratioButtons[key]) {
        ratioButtons[key].addEventListener('click', (e) => {
            Object.values(ratioButtons).forEach(btn => { if(btn) btn.classList.remove('active'); });
            e.currentTarget.classList.add('active');
            
            stageWrapper.className = '';
            if (key === 'full') stageWrapper.className = 'ratio-full';
            if (key === 'i169') stageWrapper.className = 'ratio-169';
            if (key === 'i916') stageWrapper.className = 'ratio-916';
            
            setTimeout(() => {
                manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight);
            }, 320);
        });
    }
});

// 7. MP4 레코더 버튼 제어 파트
const recordBtn = document.getElementById('btn-record');
let isRecording = false;

if (recordBtn) {
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
}

// 8. 듀얼 핸들 멀티 레인지 제어 관제 결합 로직
const audioSliders = {
    low: document.getElementById('slide-audio-low'),
    high: document.getElementById('slide-audio-high'),
    filledTrack: document.getElementById('dual-filled-track'),
    valBounds: document.getElementById('val-audio-bounds'),
    lblBass: document.getElementById('lbl-bass-range'),
    lblMid: document.getElementById('lbl-mid-range'),
    lblTreble: document.getElementById('lbl-treble-range')
};

function handleDualAudioSliderChange() {
    if (!audioSliders.low || !audioSliders.high) return;

    let lVal = parseInt(audioSliders.low.value);
    let hVal = parseInt(audioSliders.high.value);

    if (lVal >= hVal) {
        audioSliders.low.value = hVal - 2;
        lVal = hVal - 2;
    }

    if (audioSliders.filledTrack) {
        audioSliders.filledTrack.style.left = lVal + '%';
        audioSliders.filledTrack.style.right = (100 - hVal) + '%';
    }

    if (audioSliders.valBounds) audioSliders.valBounds.innerText = `${lVal}% | ${hVal}%`;
    if (audioSliders.lblBass) audioSliders.lblBass.innerText = `0% ~ ${lVal}%`;
    if (audioSliders.lblMid) audioSliders.lblMid.innerText = `${lVal}% ~ ${hVal}%`;
    if (audioSliders.lblTreble) audioSliders.lblTreble.innerText = `${hVal}% ~ 100%`;

    const bL = 20;
    const bH = Math.floor(THREE.MathUtils.mapLinear(lVal, 5, 95, 120, 600));
    const mL = bH;
    const mH = Math.floor(THREE.MathUtils.mapLinear(hVal, 5, 95, 1500, 6500));
    const tL = mH;
    const tH = 16000;

    analyzer.updateBounds({ bassLow: bL, bassHigh: bH, midLow: mL, midHigh: mH, trebleLow: tL, trebleHigh: tH });
}

if (audioSliders.low && audioSliders.high) {
    audioSliders.low.addEventListener('input', handleDualAudioSliderChange);
    audioSliders.high.addEventListener('input', handleDualAudioSliderChange);
    handleDualAudioSliderChange();
}

// 9. 🌌 Cosmic Studio Tuning 제어 데이터 동기화 파이프라인 파트
const cosmicSliders = {
    seed: document.getElementById('slide-cosmic-seed'),
    scatter: document.getElementById('slide-cosmic-scatter'),
    color: document.getElementById('select-cosmic-color'),
    glow: document.getElementById('slide-cosmic-glow'),
    gain: document.getElementById('slide-cosmic-gain'),
    pickGas1: document.getElementById('picker-gas1') || document.getElementById('picker-cosmic-color1'),
    pickGas2: document.getElementById('picker-gas2') || document.getElementById('picker-cosmic-color2'),
    pickStar: document.getElementById('picker-star') || document.getElementById('picker-cosmic-color3')
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
    const colorVal = cosmicSliders.color ? cosmicSliders.color.value : 'neon';
    const glowVal = cosmicSliders.glow ? parseFloat(cosmicSliders.glow.value) / 100 : 0.85;
    const gainVal = cosmicSliders.gain ? parseFloat(cosmicSliders.gain.value) / 100 : 1.0;

    const cGas1 = cosmicSliders.pickGas1 ? cosmicSliders.pickGas1.value : '#ff0055';
    const cGas2 = cosmicSliders.pickGas2 ? cosmicSliders.pickGas2.value : '#00ffcc';
    const cStar = cosmicSliders.pickStar ? cosmicSliders.pickStar.value : '#ffffff';

    if (cosmicDisplays.seed) cosmicDisplays.seed.innerText = seedVal;
    if (cosmicDisplays.scatter) cosmicDisplays.scatter.innerText = scatterVal.toFixed(1);
    if (cosmicDisplays.glow) cosmicDisplays.glow.innerText = glowVal.toFixed(2);
    if (cosmicDisplays.gain) cosmicDisplays.gain.innerText = gainVal.toFixed(1);

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

// 10. 프리셋 저장 및 로딩 시스템 파트 (전수 통합 스토리지 대개조)
const savePresetBtn = document.getElementById('btn-save-preset');
const loadPresetBtn = document.getElementById('btn-load-preset');
const presetStatus = document.getElementById('preset-status');

if (localStorage.getItem('gongb_visual_preset')) {
    if (presetStatus) {
        presetStatus.innerText = '✅ 최근 저장된 설정을 불러올 수 있습니다.';
        presetStatus.style.color = '#00ffcc';
    }
}

if (savePresetBtn) {
    savePresetBtn.addEventListener('click', () => {
        const activeLi = document.querySelector('#sketch-list li.active');
        const activeSketch = activeLi ? activeLi.getAttribute('data-sketch') : '002_three_cube.js';
        
        // 현재 선택되어 작동 중인 화면 뷰 비율 키값 역산 가공
        let activeRatioKey = 'full';
        if (stageWrapper.classList.contains('ratio-169')) activeRatioKey = 'i169';
        if (stageWrapper.classList.contains('ratio-916')) activeRatioKey = 'i916';

        // 💡 [기획 수정] 지형변경부터 폭발력, 컬러 메트릭스, 출력 비율까지 통째로 묶어 오브젝트 팩 빌드
        const masterSettings = {
            sketch: activeSketch,
            ratioKey: activeRatioKey,
            cosmic: {
                seed: cosmicSliders.seed ? cosmicSliders.seed.value : 42,
                scatter: cosmicSliders.scatter ? cosmicSliders.scatter.value : 22,
                color: cosmicSliders.color ? cosmicSliders.color.value : 'neon',
                glow: cosmicSliders.glow ? cosmicSliders.glow.value : 85,
                gain: cosmicSliders.gain ? cosmicSliders.gain.value : 100,
                gas1: cosmicSliders.pickGas1 ? cosmicSliders.pickGas1.value : '#ff0055',
                gas2: cosmicSliders.pickGas2 ? cosmicSliders.pickGas2.value : '#00ffcc',
                star: cosmicSliders.pickStar ? cosmicSliders.pickStar.value : '#ffffff'
            },
            audioBounds: {
                low: audioSliders.low ? audioSliders.low.value : 25,
                high: audioSliders.high ? audioSliders.high.value : 75
            }
        };

        localStorage.setItem('gongb_visual_preset', JSON.stringify(masterSettings));
        if (presetStatus) {
            presetStatus.innerText = '💾 스튜디오 마스터 프리셋 저장 완수!';
            presetStatus.style.color = '#00ffcc';
            setTimeout(() => { presetStatus.innerText = '✅ 최근 저장된 설정을 불러올 수 있습니다.'; }, 2000);
        }
    });
}

if (loadPresetBtn) {
    loadPresetBtn.addEventListener('click', async () => {
        const savedData = localStorage.getItem('gongb_visual_preset');
        if (!savedData) { 
            if (presetStatus) { presetStatus.innerText = '❌ 불러올 프리셋 데이터가 없습니다.'; presetStatus.style.color = '#ff0055'; } 
            return; 
        }
        
        const config = JSON.parse(savedData);
        
        // 💡 1. [상단 Cosmic Studio 패널 하드웨어 포인터 완벽 복조 복원]
        if (config.cosmic) {
            if (cosmicSliders.seed) cosmicSliders.seed.value = config.cosmic.seed;
            if (cosmicSliders.scatter) cosmicSliders.scatter.value = config.cosmic.scatter;
            if (cosmicSliders.color) cosmicSliders.color.value = config.cosmic.color;
            if (cosmicSliders.glow) cosmicSliders.glow.value = config.cosmic.glow;
            if (cosmicSliders.gain) cosmicSliders.gain.value = config.cosmic.gain;
            if (cosmicSliders.pickGas1) cosmicSliders.pickGas1.value = config.cosmic.gas1;
            if (cosmicSliders.pickGas2) cosmicSliders.pickGas2.value = config.cosmic.gas2;
            if (cosmicSliders.pickStar) cosmicSliders.pickStar.value = config.cosmic.star;
            
            // 수치 변경 사항 강제 적용 리프레시 동기화
            syncCosmicControls();
        }

        // 💡 2. [하단 오디오 슬라이더 대역폭 복조 복원]
        if (config.audioBounds && audioSliders.low && audioSliders.high) {
            audioSliders.low.value = config.audioBounds.low;
            audioSliders.high.value = config.audioBounds.high;
            handleDualAudioSliderChange();
        }
        
        // 💡 3. [출력 화면 비율 레이아웃 버튼 상태 완벽 복조 복원]
        const targetRatioKey = config.ratioKey || 'full';
        Object.keys(ratioButtons).forEach(key => {
            if (ratioButtons[key]) {
                if (key === targetRatioKey) ratioButtons[key].classList.add('active');
                else ratioButtons[key].classList.remove('active');
            }
        });

        stageWrapper.className = '';
        if (targetRatioKey === 'full') stageWrapper.className = 'ratio-full';
        if (targetRatioKey === 'i169') stageWrapper.className = 'ratio-169';
        if (targetRatioKey === 'i916') stageWrapper.className = 'ratio-916';
        
        // 캔버스 사이즈 리컴파일 재정렬
        setTimeout(() => {
            manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight);
        }, 150);
        
        // 💡 4. 활성화 스케치 액티브 라벨 복원
        if (config.sketch) {
            sketchItems.forEach(li => { 
                li.classList.remove('active'); 
                if (li.getAttribute('data-sketch') === config.sketch) li.classList.add('active'); 
            });
            await manager.switchSketch(config.sketch, analyzer);
        }
        
        if (presetStatus) {
            presetStatus.innerText = '📂 마스터 프리셋 로딩 완수!';
            presetStatus.style.color = '#0077ff';
        }
    });
}

// 11. 초기 구동 및 브라우저 크기 조정 연동 파트
const activeLi = document.querySelector('#sketch-list li.active');
const defaultSketch = activeLi ? activeLi.getAttribute('data-sketch') : '001_p5_wave.js';
manager.switchSketch(defaultSketch, analyzer);

window.addEventListener('resize', () => { 
    manager.resize(stageWrapper.clientWidth, stageWrapper.clientHeight); 
});

const originalSwitch = manager.switchSketch;
manager.switchSketch = async function(fileName, analyzerInstance) {
    manager.currentFile = fileName; 
    await originalSwitch.call(manager, fileName, analyzerInstance);
    syncCosmicControls(); 
};
