/**
 * SRT 자막 파서 및 Canvas 캘리그라피 애니메이션 엔진
 */
const srtFileInput = document.getElementById('srtFileInput');
const fontSelect = document.getElementById('fontSelect');
const textColorInput = document.getElementById('textColorInput');
const btnPlay = document.getElementById('btnPlay');
const btnPause = document.getElementById('btnPause');
const btnExportWebM = document.getElementById('btnExportWebM');
const canvas = document.getElementById('subCanvas');
const ctx = canvas.getContext('2d');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');

let subtitles = [];
let isPlaying = false;
let animationFrameId = null;
let startTime = null;
let pausedTime = 0;
let totalDuration = 0;

// 1. SRT 파싱 함수 (시작/종료 ms 계산)
function parseSRT(srtText) {
    const regex = /(\d+)\r?\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\r?\n([\s\S]*?)(?=\r?\n\r?\n|\r?\n*$)/g;
    const items = [];
    let match;

    function timeToMs(timeStr) {
        const [h, m, sWithMs] = timeStr.split(':');
        const [s, ms] = sWithMs.split(',');
        return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms);
    }

    while ((match = regex.exec(srtText)) !== null) {
        items.push({
            id: parseInt(match[1]),
            start: timeToMs(match[2]),
            end: timeToMs(match[3]),
            text: match[4].replace(/\r?\n/g, ' ').trim()
        });
    }
    return items;
}

// 2. 붓글씨 애니메이션 렌더링
function drawFrame(currentMs) {
    currentTimeEl.textContent = formatTime(currentMs);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const activeSub = subtitles.find(sub => currentMs >= sub.start && currentMs <= sub.end);
    if (!activeSub) return;

    const subDuration = activeSub.end - activeSub.start;
    const writeDuration = Math.min(1500, subDuration * 0.5); // 자막 시간의 첫 50% 동안 붓글씨 써짐
    const elapsedTime = currentMs - activeSub.start;
    const progress = Math.min(1.0, elapsedTime / writeDuration); // 0.0 ~ 1.0 진행률

    renderCalligraphyText(activeSub.text, progress, fontSelect.value, textColorInput.value);
}

function renderCalligraphyText(text, progress, fontStyle, color) {
    const fontSize = 72;
    const x = canvas.width / 2;
    const y = canvas.height * 0.82;

    ctx.save();
    ctx.font = `bold ${fontSize}px ${fontStyle}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const startX = x - (textWidth / 2);

    if (progress >= 1.0) {
        // [멈춤 상태] 자막 유지
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    } else {
        // [써지는 상태] 붓글씨 마스크 클리핑
        ctx.save();
        ctx.beginPath();
        const currentClipWidth = (textWidth + 60) * progress;
        const maskX = startX - 30;
        
        ctx.rect(maskX, y - fontSize, currentClipWidth, fontSize * 2);
        ctx.clip();

        ctx.fillStyle = color;
        ctx.fillText(text, x, y);

        // 붓터치 잔상 포인트 효과
        const headX = maskX + currentClipWidth;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(headX - 10, y + (Math.sin(progress * Math.PI * 4) * 4), 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
    ctx.restore();
}

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    const milli = Math.floor(ms % 1000).toString().padStart(3, '0');
    return `${m}:${s}.${milli}`;
}
