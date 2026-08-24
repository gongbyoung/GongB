// 전역 상태
let allLeds = [];
let currentTime = 0;
let currentFont = "'Noto Sans KR', 'Malgun Gothic', sans-serif";
let currentFontSize = 80;
let scatterAmount = 0.5;
let currentColorStyle = 'harmony';
let currentStyleId = '';
let currentPresetId = '';
let isPlaying = false, isRecording = false;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const audio = document.getElementById('audio');

// 스타일 동적 로드
function loadStyle(styleId) {
    if (!styleId) return;
    // 이미 로드된 경우 스킵
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
    const presetSelect = document.getElementById('presetSelect');
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

// 프리셋 적용
function applyMotionPreset(led, time) {
    if (!currentPresetId || !window.TypoMotionStyles[currentStyleId]) return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
    const preset = window.TypoMotionStyles[currentStyleId].presets[currentPresetId];
    return preset.apply(led, time, ctx, {
        currentFont, currentFontSize, scatterAmount
    });
}

// 렌더링
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    allLeds.forEach(led => {
        const isLit = led.start <= currentTime;
        if (isLit) {
            const transform = applyMotionPreset(led, currentTime);
            ctx.save();
            ctx.globalAlpha = transform.opacity;
            ctx.translate(led.x + (transform.offsetX || 0), led.y + (transform.offsetY || 0));
            ctx.rotate((transform.rotation || 0) * Math.PI / 180);
            ctx.scale(transform.scale || 1, transform.scale || 1);
            ctx.font = `${currentFontSize}px ${currentFont}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = led.color;
            ctx.shadowColor = led.color;
            ctx.shadowBlur = 15;
            ctx.fillText(led.char, 0, 0);
            ctx.restore();
        } else {
            // 비활성 외곽선
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 2;
            ctx.strokeText(led.char, led.x, led.y);
        }
    });

    updateCurrentSentence();
}

// ... 기타 이벤트 바인딩, 초기화 등
