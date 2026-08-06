/**
 * src/core/WordVisualMatcher.js
 * - 시 문구(가사)에 포함된 단어를 감지해서, 기존 sketches/ 목록 중
 *   가장 어울리는 스케치로 자동 전환하고 색상 팔레트도 함께 바꿔주는 매칭 모듈
 * - 새 스케치를 만들지 않고, 이미 있는 001~026번 스케치를 재활용하는 방식
 *
 * 사용법 (main.js):
 *   import { WordVisualMatcher } from './core/WordVisualMatcher.js';
 *   const wordMatcher = new WordVisualMatcher(manager, analyzer);
 *   wordMatcher.applyForText(window.cosmicEngineSettings.poemText);
 */

// 단어 사전: 위쪽에 있는 항목이 우선순위가 높음 (먼저 매칭되는 것을 사용)
export const WORD_VISUAL_MAP = [
  {
    keywords: ['꽃'],
    sketch: '006_three_organic_flower.js', // 메이커 - 꽃과 직접 매칭
    palette: { gas1: '#ff6f91', gas2: '#ffe066', star: '#ffffff' },
  },
  {
    keywords: ['노래', '가락', '소리'],
    sketch: '001_p5_wave.js', // 파형 - 소리/음악 자체를 표현
    palette: { gas1: '#38bdf8', gas2: '#a78bfa', star: '#ffffff' },
  },
  {
    keywords: ['산', '물', '강'],
    sketch: '025_fluid_ink_wash.js', // 수묵잉크 - 산수화 느낌
    palette: { gas1: '#94a3b8', gas2: '#1e293b', star: '#e2e8f0' },
  },
  {
    keywords: ['별', '보석', '진주'],
    sketch: '007_three_cosmic_nebula.js', // 성운 - 반짝이는 이미지
    palette: { gas1: '#f472b6', gas2: '#facc15', star: '#ffffff' },
  },
  {
    keywords: ['달'],
    sketch: '019_p5_512_circles.js', // 원반 - 달 이미지
    palette: { gas1: '#cbd5e1', gas2: '#64748b', star: '#f8fafc' },
  },
  {
    keywords: ['해', '빛', '노을'],
    sketch: '015_three_p5_aurora.js', // 유체 - 번지는 빛
    palette: { gas1: '#fb923c', gas2: '#f87171', star: '#fff7ed' },
  },
  {
    keywords: ['눈물', '물보라'],
    sketch: '011_p5_ocean_wave.js', // 물보라
    palette: { gas1: '#38bdf8', gas2: '#0ea5e9', star: '#e0f2fe' },
  },
  {
    keywords: ['구름'],
    sketch: '017_p5_fbm_cloud.js', // 구름
    palette: { gas1: '#e2e8f0', gas2: '#94a3b8', star: '#ffffff' },
  },
  {
    keywords: ['얼굴', '님', '당신'],
    sketch: '022_poem_typography.js', // 시타이포 - 문구 자체를 표현
    palette: null, // 팔레트는 건드리지 않음
  },
];

export class WordVisualMatcher {
  constructor(sketchManager, audioAnalyzerInstance) {
    this.manager = sketchManager;
    this.analyzer = audioAnalyzerInstance;
    this.lastMatchedSketch = null;
  }

  /** 텍스트 안에서 사전 순서대로 첫 매칭 항목을 찾는다 (substring 매칭 - 조사 붙어도 감지됨) */
  findMatch(text) {
    if (!text) return null;
    for (const entry of WORD_VISUAL_MAP) {
      if (entry.keywords.some((kw) => text.includes(kw))) {
        return entry;
      }
    }
    return null;
  }

  /** 매칭된 스케치로 전환 + 팔레트 적용. 이미 같은 스케치면 재로딩하지 않음(깜빡임 방지) */
  async applyForText(text) {
    const entry = this.findMatch(text);
    if (!entry) return false;

    if (entry.sketch !== this.lastMatchedSketch) {
      await this.manager.switchSketch(entry.sketch, this.analyzer);
      this.lastMatchedSketch = entry.sketch;
      this._highlightSketchButton(entry.sketch);
    }

    if (entry.palette) {
      window.cosmicEngineSettings = {
        ...window.cosmicEngineSettings,
        customColors: entry.palette,
      };
      this._syncColorPickers(entry.palette);
    }

    return true;
  }

  /** 사이드바 스케치 목록의 active 표시를 자동 전환된 스케치에 맞춰 갱신 */
  _highlightSketchButton(sketchFileName) {
    document.querySelectorAll('#sketch-list li').forEach((li) => li.classList.remove('active'));
    const targetLi = document.querySelector(`#sketch-list li[data-sketch="${sketchFileName}"]`);
    if (targetLi) targetLi.classList.add('active');
  }

  /** 우측 Color Style Palette 컬러피커도 함께 갱신 (RESET 누르면 실제 반영됨) */
  _syncColorPickers(palette) {
    const gas1 = document.getElementById('picker-gas1');
    const gas2 = document.getElementById('picker-gas2');
    const star = document.getElementById('picker-star');
    if (gas1 && palette.gas1) gas1.value = palette.gas1;
    if (gas2 && palette.gas2) gas2.value = palette.gas2;
    if (star && palette.star) star.value = palette.star;
  }
}
