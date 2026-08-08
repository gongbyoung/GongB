/**
 * src/core/LyricSync.js
 * - SRT 파일을 파싱해서 { start, end, text } 큐 목록을 만들고,
 *   재생 시간(currentTime)에 맞춰 현재 활성 가사 줄을 감지 → WordVisualMatcher에 전달
 * - 일반 MP3(<audio>) 재생과 4-Stem(Web Audio 버퍼 소스) 재생 둘 다 지원
 *   (getCurrentTime 콜백을 외부에서 주입받는 방식으로 재생 방식과 분리)
 *
 * 사용법 (main.js):
 *   import { LyricSync } from './core/LyricSync.js';
 *
 *   const lyricSync = new LyricSync({
 *     wordMatcher,
 *     getCurrentTime: () => { ... 아래 통합 가이드 참고 ... },
 *     onCueChange: (cue) => { poemTextInput.value = cue.text; }
 *   });
 *
 *   document.getElementById('file-srt')?.addEventListener('change', async (e) => {
 *     const file = e.target.files[0];
 *     if (file) { await lyricSync.loadFromFile(file); lyricSync.start(); }
 *   });
 */

/** SRT 시간 문자열("00:00:12,345")을 초 단위 숫자로 변환 */
function srtTimeToSeconds(t) {
  const m = t.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return 0;
  const [, h, min, sec, ms] = m;
  return (+h) * 3600 + (+min) * 60 + (+sec) + (+ms) / 1000;
}

/** SRT 원문 텍스트를 { start, end, text } 배열로 파싱 */
export function parseSRT(srtText) {
  const normalized = srtText.replace(/\r/g, '').trim();
  const blocks = normalized.split(/\n\s*\n/);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (lines.length < 2) continue;

    const timeLineIndex = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIndex === -1) continue;

    const [startStr, endStr] = lines[timeLineIndex].split('-->').map((s) => s.trim());
    const start = srtTimeToSeconds(startStr);
    const end = srtTimeToSeconds(endStr);
    const text = lines.slice(timeLineIndex + 1).join(' ').trim();

    if (text) cues.push({ start, end, text });
  }

  return cues.sort((a, b) => a.start - b.start);
}

export class LyricSync {
  /**
   * @param {object} opts
   * @param {object} opts.wordMatcher - WordVisualMatcher 인스턴스
   * @param {() => number} opts.getCurrentTime - 현재 재생 시간(초)을 반환하는 함수 (재생 방식 무관하게 외부에서 주입)
   * @param {(cue: {start:number,end:number,text:string}) => void} [opts.onCueChange] - 큐가 바뀔 때마다 호출 (UI 갱신용)
   */
  constructor({ wordMatcher, getCurrentTime, onCueChange }) {
    this.wordMatcher = wordMatcher;
    this.getCurrentTime = getCurrentTime;
    this.onCueChange = onCueChange || (() => {});
    this.cues = [];
    this.activeCueIndex = -1;
    this.rafId = null;
  }

  /** File 객체(.srt)를 읽어서 큐 목록을 로드 */
  async loadFromFile(file) {
    const text = await file.text();
    this.cues = parseSRT(text);
    this.activeCueIndex = -1;
    console.log(`[LyricSync] SRT 로드 완료 - 총 ${this.cues.length}개 큐`);
  }

  /** 매 프레임 현재 시간을 확인해서 활성 큐가 바뀌면 자동으로 스케치/팔레트 적용 */
  start() {
    if (this.rafId) return; // 이미 실행 중이면 중복 시작 방지
    const tick = () => {
      this._checkCue();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  _checkCue() {
    if (this.cues.length === 0) return;

    const t = this.getCurrentTime();
    const idx = this.cues.findIndex((c) => t >= c.start && t <= c.end);

    if (idx !== -1 && idx !== this.activeCueIndex) {
      this.activeCueIndex = idx;
      const cue = this.cues[idx];
      this.wordMatcher.applyForText(cue.text);
      this.onCueChange(cue);
    } else if (idx === -1 && this.activeCueIndex !== -1) {
      // 자막이 없는 공백 구간 - 마지막 스케치/팔레트를 그대로 유지 (원하면 여기서 기본 스케치로 되돌릴 수 있음)
      this.activeCueIndex = -1;
    }
  }
}
