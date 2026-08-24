// js/app.js
// 메인 컨트롤러

// ==================== 전역 상태 ====================
let allLeds = [];
let currentTime = 0;
let currentFont = "'Noto Sans KR', 'Malgun Gothic', sans-serif";
let currentFontSize = 80;
let scatterAmount = 0.5;
let currentColorStyle = 'harmony';
let currentStyleId = '';
let currentPresetId = '';
let isPlaying = false;
let isRecording = false;
let mediaRecorder = null;
let audioCtx = null;
let audioSource = null;
let audioDest = null;

// ==================== DOM 요소 ====================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const audio = document.getElementById('audio');
const timeline = document.getElementById('timeline');
const timeDisplay = document.getElementById('timeDisplay');
const currentSentenceEl = document.getElementById('currentSentence');
const fontSelect = document.getElementById('fontSelect');
const customFontInput = document.getElementById('customFont');
const applyFontBtn = document.getElementById('applyFontBtn');
const systemFontsBtn = document.getElementById('systemFontsBtn');
const scatterSlider = document.getElementById('scatterSlider');
const scatterValueSpan = document.getElementById('scatterValue');
const fontSizeSlider = document.getElementById('fontSizeSlider');
const fontSizeValueSpan = document.getElementById('fontSizeValue');
const shuffleBtn = document.getElementById('shuffleBtn');
const aspectRatioSelect = document.getElementById('aspectRatio');
const colorStyleSelect = document.getElementById('colorStyle');
const styleSelect = document.getElementById('styleSelect');
const presetSelect = document.getElementById('presetSelect');
const saveBtn = document.getElementById('saveBtn');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const srtFileInput = document.getElementById('srtFile');
const audioFileInput = document.getElementById('audioFile');
const loadSampleBtn = document.getElementById('loadSample');

// ==================== 초기화 ====================
function init() {
    setupTimeline();
    updateTimeDisplay();
    render();
}

// ==================== SRT 로딩 ====================
function loadSRT(content) {
    // SRT 파싱
    const cues = parseSRT(content);
    // 색상 적용
    cues.forEach((cue, idx) => {
        cue.color = getColorForCue(idx, currentColorStyle);
    });
    // LED 생성
    buildAllLeds(cues);
    // 초기 배치
    assignInitialPositions();
    avoidOverlaps();
    // 타임라인 설정
    setupTimeline();
    currentTime = 0;
    updateTimeDisplay();
    render();
}

// ==================== LED 생성 ====================
function buildAllLeds(cues) {
    allLeds = [];
    cues.forEach((cue, cueIdx) => {
        const chars = Array.from(cue.text);
        chars.forEach((char, charIdx) => {
            if (char.trim() === '') return;
            const components = decomposeKorean(char);
            const numComponents = components.length;
            const step = (cue.end - cue.start) / numComponents;
            const fullLitTime = cue.start + (numComponents - 1) * step;

            components.forEach((comp, compIdx) => {
                allLeds.push({
                    char: comp,
                    cueIdx,
                    charIdx,
                    compIdx,
                    start: cue.start + compIdx * step,
                    end: cue.end,
                    fullLitTime,
                    color: cue.color,
                    x: 0, y: 0, baseX: 0, baseY: 0
                });
            });
        });
    });

    // LED 개수에 따라 폰트 크기 자동 조정
    if (allLeds.length > 200) {
        currentFontSize = Math.min(80, Math.max(30, 80 * (200 / allLeds.length) * 1.5));
        fontSizeSlider.value = currentFontSize;
        fontSizeValueSpan.textContent = Math.round(currentFontSize);
    }
}

// ==================== 위치 배치 ====================
function assignInitialPositions() {
    const w = canvas.width;
    const h = canvas.height;
    const margin = Math.max(30, currentFontSize / 2 + 5);
    const centerX = w / 2;
    const centerY = h / 2;
    const maxRadius = Math.min(w, h) * 0.45;

    allLeds.forEach(led => {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * maxRadius;
        led.baseX = centerX + Math.cos(angle) * dist;
        led.baseY = centerY + Math.sin(angle) * dist;
        updateLedPosition(led, margin);
    });
}

function updateLedPosition(led, margin) {
    const spreadFactor = scatterAmount;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const x = centerX + (led.baseX - centerX) * spreadFactor;
    const y = centerY + (led.baseY - centerY) * spreadFactor;
    led.x = Math.min(Math.max(x, margin), canvas.width - margin);
    led.y = Math.min(Math.max(y, margin), canvas.height - margin);
}

// ==================== 겹침 회피 ====================
function avoidOverlaps() {
    if (allLeds.length < 2) return;
    ctx.font = `${currentFontSize}px ${currentFont}`;
    const widths = allLeds.map(led => ctx.measureText(led.char).width);
    const margin = Math.max(20, currentFontSize / 2 + 5);
    const iterations = 300;
    const pushForce = 0.4;

    for (let iter = 0; iter < iterations; iter++) {
        let moved = false;
        for (let i = 0; i < allLeds.length; i++) {
            for (let j = i + 1; j < allLeds.length; j++) {
                const a = allLeds[i];
                const b = allLeds[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = (widths[i] + widths[j]) / 2 + 3;
                if (dist < minDist && dist > 0) {
                    const overlap = (minDist - dist) / 2;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    a.x -= nx * overlap * pushForce;
                    a.y -= ny * overlap * pushForce;
                    b.x += nx * overlap * pushForce;
                    b.y += ny * overlap * pushForce;
                    a.x = Math.min(Math.max(a.x, margin), canvas.width - margin);
                    a.y = Math.min(Math.max(a.y, margin), canvas.height - margin);
                    b.x = Math.min(Math.max(b.x, margin), canvas.width - margin);
                    b.y = Math.min(Math.max(b.y, margin), canvas.height - margin);
                    moved = true;
                }
            }
        }
        if (!moved) break;
    }
}

function reshufflePositions() {
    assignInitialPositions();
    avoidOverlaps();
    render();
}

// ==================== 타임라인 ====================
function setupTimeline() {
    const maxTime = allLeds.length > 0 ? Math.max(...allLeds.map(led => led.end)) : 0;
    timeline.max = maxTime || 0;
    timeline.value = 0;
}

function updateTimeDisplay() {
    timeDisplay.textContent = formatTime(currentTime);
}

// ==================== 렌더링 ====================
function isLedLit(led, time) {
    return time >= led.start;
}

function applyMotionPreset(led, time) {
    if (!currentStyleId || !currentPresetId || !window.TypoMotionStyles?.[currentStyleId]?.presets?.[currentPresetId]) {
        return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
    }
    const preset = window.TypoMotionStyles[currentStyleId].presets[currentPresetId];
    return preset.apply(led, time, ctx, {
        currentFont,
        currentFontSize,
        scatterAmount
    });
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (allLeds.length === 0) {
        ctx.fillStyle = '#666';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SRT 파일을 로드하세요', canvas.width / 2, canvas.height / 2);
        updateCurrentSentence();
        return;
    }

    const fontFamily = currentFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${currentFontSize}px ${fontFamily}`;

    const inactiveColor = 'rgba(255,255,255,0.3)';

    allLeds.forEach(led => {
        const isActive = isLedLit(led, currentTime);
        if (isActive) {
            const transform = applyMotionPreset(led, currentTime);
            ctx.save();
            ctx.globalAlpha = transform.opacity;
            ctx.translate(led.x + (transform.offsetX || 0), led.y + (transform.offsetY || 0));
            ctx.rotate((transform.rotation || 0) * Math.PI / 180);
            ctx.scale(transform.scale || 1, transform.scale || 1);
            ctx.fillStyle = led.color;
            ctx.shadowColor = led.color;
            ctx.shadowBlur = 15;
            ctx.fillText(led.char, 0, 0);
            ctx.restore();
        } else {
            ctx.strokeStyle = inactiveColor;
            ctx.lineWidth = 2;
            ctx.strokeText(led.char, led.x, led.y);
        }
    });

    updateCurrentSentence();
}

function updateCurrentSentence() {
    // 현재 활성화된 큐 찾기
    const activeCue = allLeds.length > 0 ? allLeds.find(led => led.start <= currentTime && currentTime <= led.end) : null;
    if (!activeCue) {
        currentSentenceEl.textContent = '';
        return;
    }
    // activeCue의 cueIdx로 원래 큐 찾기 (현재 allLeds에 cue 정보가 없으므로, 직접 찾기 어려움)
    // 간단히 현재 시간에 해당하는 첫 번째 LED의 cueIdx를 사용
    // 실제로는 cues 배열을 따로 저장하는 것이 좋음 (아래에서 처리)
    // 임시로 빈 문자열 처리
    currentSentenceEl.textContent = '';
}

// cues 배열을 따로 저장하도록 수정 필요
let cues = [];

// loadSRT에서 cues를 업데이트하도록 수정
function loadSRT(content) {
    cues = parseSRT(content);
    cues.forEach((cue, idx) => {
        cue.color = getColorForCue(idx, currentColorStyle);
    });
    buildAllLeds(cues);
    assignInitialPositions();
    avoidOverlaps();
    setupTimeline();
    currentTime = 0;
    updateTimeDisplay();
    render();
}

// updateCurrentSentence에서 cues 사용
function updateCurrentSentence() {
    const activeCue = cues.find(cue => currentTime >= cue.start && currentTime <= cue.end);
    if (!activeCue) {
        currentSentenceEl.textContent = '';
        return;
    }
    const chars = Array.from(activeCue.text);
    let html = '';
    chars.forEach(char => {
        if (char.trim() === '') {
            html += ' ';
            return;
        }
        const components = decomposeKorean(char);
        const numComp = components.length;
        const step = (activeCue.end - activeCue.start) / numComp;
        const fullLitTime = activeCue.start + (numComp - 1) * step;
        const isLit = currentTime >= fullLitTime;
        if (isLit) {
            html += `<span style="color:${activeCue.color};">${char}</span>`;
        } else {
            html += char;
        }
    });
    currentSentenceEl.innerHTML = html;
}

// ==================== 애니메이션 루프 ====================
let lastFrameTime = performance.now();
function animationLoop(now) {
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    if (isPlaying && !isRecording) {
        currentTime += dt;
        const maxTime = parseFloat(timeline.max);
        if (currentTime >= maxTime) {
            currentTime = maxTime;
            isPlaying = false;
            audio.pause();
        }
        timeline.value = currentTime;
        updateTimeDisplay();
    }

    if (isRecording) {
        currentTime += dt;
        const maxTime = parseFloat(timeline.max);
        if (currentTime >= maxTime) {
            currentTime = maxTime;
            render();
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            isRecording = false;
            isPlaying = false;
            audio.pause();
            if (audioCtx) audioCtx.suspend();
        } else {
            timeline.value = currentTime;
            updateTimeDisplay();
        }
    }

    render();
    requestAnimationFrame(animationLoop);
}
requestAnimationFrame(animationLoop);

// ==================== 이벤트 리스너 ====================
// SRT 파일 로드
srtFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadSRT(ev.target.result);
    reader.readAsText(file);
});

// 샘플 SRT
loadSampleBtn.addEventListener('click', () => {
    const sample = `1
00:00:00,000 --> 00:00:03,000
안녕하세요

2
00:00:03,500 --> 00:00:07,000
오늘은 즐거운 날

3
00:00:07,500 --> 00:00:11,000
함께 노래해요

4
00:00:11,500 --> 00:00:15,000
라라라 라라라

5
00:00:15,500 --> 00:00:20,000
신나는 음악과 함께
`;
    loadSRT(sample);
});

// 오디오 파일 로드
audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    audio.src = URL.createObjectURL(file);
    audio.load();
    if (audioCtx) {
        audioCtx.close().catch(() => {});
    }
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioSource = audioCtx.createMediaElementSource(audio);
    audioDest = audioCtx.createMediaStreamDestination();
    audioSource.connect(audioDest);
    audioSource.connect(audioCtx.destination);
});

// 재생/정지
playBtn.addEventListener('click', () => {
    if (allLeds.length === 0) return;
    isPlaying = true;
    if (audio.src) {
        audio.currentTime = currentTime;
        audio.play().catch(() => {});
    }
});

stopBtn.addEventListener('click', () => {
    isPlaying = false;
    isRecording = false;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    audio.pause();
    if (audioCtx) audioCtx.suspend();
});

// 타임라인
timeline.addEventListener('input', () => {
    currentTime = parseFloat(timeline.value);
    updateTimeDisplay();
    render();
});

// 화면 비율
aspectRatioSelect.addEventListener('change', () => {
    if (aspectRatioSelect.value === '16:9') {
        canvas.width = 1280;
        canvas.height = 720;
    } else {
        canvas.width = 720;
        canvas.height = 1280;
    }
    assignInitialPositions();
    avoidOverlaps();
    render();
});

// 색상 스타일
colorStyleSelect.addEventListener('change', () => {
    currentColorStyle = colorStyleSelect.value;
    cues.forEach((cue, idx) => {
        cue.color = getColorForCue(idx, currentColorStyle);
    });
    allLeds.forEach(led => {
        led.color = cues[led.cueIdx].color;
    });
    render();
});

// 타이포 스타일 로드
styleSelect.addEventListener('change', () => {
    const styleId = styleSelect.value;
    if (!styleId) {
        currentStyleId = '';
        currentPresetId = '';
        presetSelect.disabled = true;
        presetSelect.innerHTML = '<option value="">-- 모션 선택 --</option>';
        return;
    }
    loadStyle(styleId);
});

function loadStyle(styleId) {
    if (window.TypoMotionStyles && window.TypoMotionStyles[styleId]) {
        applyStyle(styleId);
        return;
    }
    const script = document.createElement('script');
    script.src = `styles/${styleId}.js`;
    script.onload = () => applyStyle(styleId);
    document.head.appendChild(script);
}

function applyStyle(styleId) {
    currentStyleId = styleId;
    populatePresetSelect(styleId);
}

function populatePresetSelect(styleId) {
    presetSelect.disabled = false;
    presetSelect.innerHTML = '<option value="">-- 모션 선택 --</option>';
    const style = window.TypoMotionStyles[styleId];
    Object.keys(style.presets).forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = style.presets[key].name;
        presetSelect.appendChild(opt);
    });
}

// 프리셋 선택
presetSelect.addEventListener('change', () => {
    currentPresetId = presetSelect.value;
});

// 폰트
fontSelect.addEventListener('change', () => {
    currentFont = fontSelect.value;
    avoidOverlaps();
    render();
});

applyFontBtn.addEventListener('click', () => {
    const customFont = customFontInput.value.trim();
    if (customFont) {
        currentFont = `'${customFont}', sans-serif`;
        fontSelect.value = currentFont;
        avoidOverlaps();
        render();
    }
});

systemFontsBtn.addEventListener('click', async () => {
    if (navigator.fonts && navigator.fonts.query) {
        try {
            const fonts = await navigator.fonts.query();
            const fontSet = new Set();
            fonts.forEach(f => {
                if (f.family && f.family !== '') fontSet.add(f.family);
            });
            const fontList = Array.from(fontSet).sort();
            if (fontList.length === 0) {
                alert('시스템 폰트를 찾을 수 없습니다.');
                return;
            }
            fontList.forEach(font => {
                const opt = document.createElement('option');
                opt.value = `'${font}', sans-serif`;
                opt.textContent = font;
                fontSelect.appendChild(opt);
            });
            alert(`${fontList.length}개의 시스템 폰트를 추가했습니다.`);
        } catch (err) {
            alert('시스템 폰트를 불러올 수 없습니다: ' + err.message);
        }
    } else {
        alert('이 브라우저는 시스템 폰트 목록을 지원하지 않습니다. 직접 입력해주세요.');
    }
});

// 흩어짐/글자 크기
scatterSlider.addEventListener('input', () => {
    scatterAmount = scatterSlider.value / 100;
    scatterValueSpan.textContent = scatterSlider.value;
    allLeds.forEach(led => updateLedPosition(led, Math.max(20, currentFontSize / 2 + 5)));
    avoidOverlaps();
    render();
});

fontSizeSlider.addEventListener('input', () => {
    currentFontSize = parseInt(fontSizeSlider.value);
    fontSizeValueSpan.textContent = currentFontSize;
    avoidOverlaps();
    render();
});

shuffleBtn.addEventListener('click', reshufflePositions);

// MP4 저장
saveBtn.addEventListener('click', async () => {
    if (isRecording) return;
    if (allLeds.length === 0) {
        alert('SRT 자막을 먼저 로드하세요.');
        return;
    }
    const maxTime = parseFloat(timeline.max);
    if (maxTime <= 0) return;

    isPlaying = true;
    isRecording = true;
    currentTime = 0;
    timeline.value = 0;

    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();

    const canvasStream = canvas.captureStream(60);
    let combinedStream = canvasStream;
    if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
        combinedStream = new MediaStream();
        canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
        audioDest.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
    }

    const mimeType = getSupportedMimeType();
    mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 8_000_000
    });

    const chunks = [];
    mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kinetic_${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        isRecording = false;
        isPlaying = false;
    };

    mediaRecorder.start(1000);

    if (audio.src && audioCtx) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
});

// ==================== 초기화 실행 ====================
init();
