// js/utils.js
// 공통 유틸리티 함수들

function timeToSeconds(str) {
    const parts = str.split(':');
    if (parts.length === 3) {
        const [h, m, s] = parts;
        const [sec, ms] = s.split(',');
        return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(sec) + (parseInt(ms || 0) / 1000);
    }
    return 0;
}

function parseSRT(content) {
    const blocks = content.trim().split(/\n\s*\n/);
    const cues = [];
    blocks.forEach((block, idx) => {
        const lines = block.trim().split('\n');
        if (lines.length < 2) return;
        const timeLineIndex = lines.findIndex(l => l.includes('-->'));
        if (timeLineIndex === -1) return;
        const timeLine = lines[timeLineIndex];
        const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
        const start = timeToSeconds(startStr);
        const end = timeToSeconds(endStr);
        const text = lines.slice(timeLineIndex + 1)
            .join('\n')
            .replace(/\{\\.*?\}/g, '')
            .replace(/<[^>]*>/g, '')
            .trim();
        cues.push({ start, end, text });
    });
    return cues;
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

// 한글 자모 분해
const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const JUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
const JONG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

function decomposeKorean(syllable) {
    const code = syllable.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
        const offset = code - 0xAC00;
        const choIdx = Math.floor(offset / 588);
        const jungIdx = Math.floor((offset % 588) / 28);
        const jongIdx = offset % 28;
        const result = [CHO[choIdx], JUNG[jungIdx]];
        if (jongIdx > 0) result.push(JONG[jongIdx]);
        return result;
    }
    return [syllable];
}

// 이징 함수들
function easeOutBounce(p) {
    if (p < 1 / 2.75) return 7.5625 * p * p;
    if (p < 2 / 2.75) return 7.5625 * (p -= 1.5 / 2.75) * p + 0.75;
    if (p < 2.5 / 2.75) return 7.5625 * (p -= 2.25 / 2.75) * p + 0.9375;
    return 7.5625 * (p -= 2.625 / 2.75) * p + 0.984375;
}

function easeOutBack(p) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

function easeOutElastic(p) {
    if (p === 0 || p === 1) return p;
    return Math.pow(2, -10 * p) * Math.sin((p - 0.075) * (2 * Math.PI) / 0.3) + 1;
}

function easeInOutCubic(p) {
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

function easeInBack(p) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * p * p * p - c1 * p * p;
}
