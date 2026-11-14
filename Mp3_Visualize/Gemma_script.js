// ===============================================
// Web Audio API를 사용한 오디오 분석 및 시각화 로직 (script.js)
// ===============================================

const canvas = document.getElementById('visualizerCanvas');
const ctx = canvas.getContext('2d');
const audioFileInput = document.getElementById('audioFile');
const startButton = document.getElementById('startButton');
const statusMessage = document.getElementById('statusMessage');

// 캔버스 크기 설정 (DDR 스타일 그리드 비율 고려)
canvas.width = 800; // 너비
canvas.height = 600; // 높이

let audioContext;
let analyser;
let source;
let bufferSource;
let dataArray;

// --- 전역 상수 및 변수 (DDR 그리드 설정) ---
const NOTE_COUNT = 8; // 가상의 노트 라인 개수
const FLOOR_Y = canvas.height * 0.9; // 바닥 위치 (캔버스 높이의 90%)
const START_Y = 50; // 맨 위 시작 위치

/**
 * @description 초기화 및 이벤트 리스너 설정
 */
function setupEventListeners() {
    startButton.addEventListener('click', initializeAudioContext);
    audioFileInput.addEventListener('change', handleFileChange);
}

/**
 * @description 파일 입력 변경 시 처리
 */
function handleFileChange(event) {
    const file = event.target.files[0];
    if (file) {
        statusMessage.textContent = `파일 로드 성공: ${file.name}. 분석 준비 완료!`;
        // 실제 오디오 데이터를 전역 변수에 저장하거나, 바로 Context에 연결할 수 있음
        window.audioFile = file; 
    } else {
        statusMessage.textContent = "음악 파일 선택이 취소되었습니다.";
    }
}

/**
 * @description Web Audio Context 초기화 및 분석 시작
 */
function initializeAudioContext() {
    if (!window.audioFile) {
        alert("먼저 음악 파일을 로드해주세요.");
        return;
    }
    
    // 1. 오디오 컨텍스트 생성 (사용자 상호작용이 필요할 때만 초기화하는 것이 중요)
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048; // 분석 해상도 설정

        // 시각화를 위해 주기적인 데이터 분석 루프를 시작합니다.
        drawLoop();
    }
    
    // 2. 파일 로딩 및 재생 준비
    const fileURL = URL.createObjectURL(window.audioFile);
    source = audioContext.createMediaElementSource(document.createElement('audio'));
    source.connect(analyser);
    analyser.connect(audioContext.destination); // 소리도 들리게 연결

    // 실제 오디오 요소를 만들고 데이터를 source에 연결하는 과정이 필요하지만, 
    // 여기서는 개념 구현을 위해 간단히 재생 시작만 합니다.
    const audioPlayer = document.createElement('audio');
    audioPlayer.src = fileURL;
    audioPlayer.play();

    statusMessage.textContent = "✅ 오디오 분석 및 시각화가 시작되었습니다! (브라우저에서 소리가 나야 함)";
}


// -----------------------------------------------------------
// 핵심: 비동기 애니메이션 루프와 데이터 처리
// -----------------------------------------------------------

let lastTime = 0;
const NOTE_GRAVITY = 5; // 노트가 떨어지는 가속도 (시각적 조정용)
let notes = []; // 현재 활성화된 모든 노트 객체를 저장할 배열

/**
 * @description 애니메이션 프레임마다 호출되는 메인 루프 함수
 * Web Audio API의 데이터를 가져와서 노트를 업데이트하고 캔버스에 그립니다.
 */
function drawLoop(timestamp) {
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;

    // 1. 캔버스 지우기 (매 프레임마다 이전 그림을 지움)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. 오디오 데이터 분석 (주파수 추출)
    // analyser.getByteFrequencyData()를 사용해 현재 주파수별 진폭 데이터를 가져옵니다.
    dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : 1);
    if (analyser) {
        analyser.getByteFrequencyData(dataArray);
        // 이 dataArray가 바로 음악의 '현재 음색' 정보를 담고 있습니다.
        processAudioAnalysis(dataArray, timestamp / 1000); // 시간도 함께 전달
    }

    // 3. 노트 업데이트 및 그리기
    updateAndDrawNotes();

    // 다음 프레임 요청 (브라우저의 기본 애니메이션 루프)
    requestAnimationFrame(drawLoop);
}

/**
 * @description Web Audio API 데이터를 분석하여 '노트'를 생성/업데이트하는 로직 (가장 중요!)
 * 이 함수 내부에서 주파수 -> 음정 -> 노트 위치 매핑을 해야 합니다.
 */
/**
 * @description Web Audio API 데이터를 분석하여 '노트'를 생성/업데이트하는 로직 (핵심 구현)
 * data: 주파수 빈별 진폭 배열
 * currentTime: 현재 시간(초)
 */
function processAudioAnalysis(data, currentTime) {
    // 1. 가장 에너지가 높은 주파수 대역 찾기 (Dominant Pitch Detection)
    let maxEnergy = -1;
    let dominantFreqIndex = -1;

    for (let i = 0; i < data.length; i++) {
        if (data[i] > maxEnergy) {
            maxEnergy = data[i];
            dominantFreqIndex = i;
        }
    }

    // 2. 임계값 체크: 소리가 충분히 클 때만 노트를 생성 시도
    const ENERGY_THRESHOLD = 60; // 테스트를 위해 이 값을 낮추었습니다. (0~255)
    if (maxEnergy < ENERGY_THRESHOLD) {
        return;
    }

    // 3. 주파수(Hz) 계산 및 피치 추정
    const frequencyHz = calculateHzFromIndex(dominantFreqIndex);

    // 4. 유효한 음정 범위 검사
    const MIN_PITCH_HZ = 100; // 최소 주파수 제한 (노이즈 방지)
    const MAX_PITCH_HZ = 2500; // 최대 주파수 제한 (음악의 자연스러운 범위를 따름)

    if (frequencyHz >= MIN_PITCH_HZ && frequencyHz <= MAX_PITCH_HZ) {
        // 5. 노트 생성 로직 실행
        const newNote = {
            time: currentTime,
            pitchHz: frequencyHz, // 분석된 실제 Hz 값 저장
            x: mapPitchToX(frequencyHz), // 피치에 따라 x좌표를 결정 (DDR처럼)
            y: START_Y,
            isActive: true,
            // 노트를 생성한 시점의 에너지 크기 정보도 남겨두면 좋습니다.
            energy: maxEnergy 
        };
        notes.push(newNote);

        console.log(`[NOTE DETECTED] Time: ${currentTime.toFixed(2)}s | Pitch: ${frequencyHz.toFixed(1)} Hz | X: ${newNote.x.toFixed(0)}`);
    }
}

/**
 * @description FFT 인덱스를 실제 주파수 (Hz) 값으로 변환합니다.
 */
function calculateHzFromIndex(index) {
    // Web Audio API가 활성화되어 있다면, Context의 sampleRate를 사용해야 정확합니다.
    const sampleRate = audioContext ? audioContext.sampleRate : 44100; // Fallback
    const fftSize = analyser ? analyser.fftSize : 2048;

    // Frequency = index * (SampleRate / FFTSize) 공식 적용
    return index * (sampleRate / fftSize);
}

/**
 * @description 추출된 피치(Hz)를 그리드상의 X 좌표로 매핑합니다. 
 * 이 함수가 DDR의 '어느 열'에 해당하는지를 결정하는 핵심입니다.
 */
function mapPitchToX(frequencyHz) {
    // MIN_FREQ와 MAX_FREQ는 processAudioAnalysis 내부에서 사용된 상수 정의와 일치해야 합니다.
    const MIN_FREQ = 100;
    const MAX_FREQ = 2500; 
    const CANVAS_WIDTH = canvas.width;

    if (frequencyHz < MIN_FREQ) return 0;
    if (frequencyHz > MAX_FREQ) return CANVAS_WIDTH - 1;

    // 선형 보간(Linear Interpolation): Min/Max 주파수를 좌우 끝에 매핑합니다.
    let normalizedFreq = Math.min(Math.max(frequencyHz, MIN_FREQ), MAX_FREQ);
    let ratio = (normalizedFreq - MIN_FREQ) / (MAX_FREQ - MIN_FREQ);

    return CANVAS_WIDTH * ratio; 
}

/**
 * @description 현재 존재하는 모든 노트의 위치를 업데이트하고 그림을 그립니다.
 */
function updateAndDrawNotes() {
    // 1. 노트 업데이트 (중력 및 시간 흐름 적용)
    for (let i = notes.length - 1; i >= 0; i--) {
        const note = notes[i];

        // 노트의 Y 위치를 아래로 떨어뜨립니다 (시뮬레이션)
        note.y += NOTE_GRAVITY; 
        
        // 2. 바닥에 닿았는지 확인하고, 충돌 처리합니다.
        if (note.y >= FLOOR_Y && note.isActive) {
             drawHitFeedback(note); // 히트 피드백 그리기
             notes.splice(i, 1); // 노트 제거
             continue;
        }

        // 3. 노트 그리기
        ctx.fillStyle = '#ff006e'; // DDR 스타일의 분홍색/빨간색
        ctx.fillRect(note.x - 20, note.y, 40, 15); 
    }
}

/**
 * @description 노트가 바닥에 닿았을 때 '음이 나는' 시각적 피드백을 그립니다.
 */
function drawHitFeedback(note) {
     // 충돌 지점에 밝은 빛이나 폭발 효과를 주는 로직 추가 필요
    ctx.fillStyle = '#ffff00'; // 노란색 히트 표시
    ctx.beginPath();
    ctx.arc(note.x, FLOOR_Y - 15, 20, 0, Math.PI * 2);
    ctx.fill();
}

// 초기 실행 함수 호출
setupEventListeners();