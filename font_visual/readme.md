# 자모 LED 키네틱 타이포그래피 개발 가이드

## 📁 프로젝트 구조
project/
├── index.html
├── css/
│ └── style.css
├── js/
│ ├── utils.js # 공통 유틸리티 (SRT 파싱, 한글 분해, 이징 등)
│ ├── colorStyles.js # 색상 스타일 정의
│ ├── recorder.js # MP4 저장
│ └── app.js # 메인 컨트롤러 (UI, 렌더링, 타이머)
├── styles/ # ★ 스타일별 타이포 모션 파일들
│ ├── drive001.js
│ ├── dance001.js
│ ├── ballad001.js
│ ├── rock001.js
│ ├── newage001.js
│ ├── traditional001.js
│ └── sleeping001.js
└── README.md # 개발 가이드 (이 파일)

text

---

## 전역 객체
- `window.TypoMotionStyles`: 스타일 저장소
- 각 스타일: `{ name, backgroundColor, textColor, glowColor, layout, presets }`

## 스타일 파일 작성 템플릿
```javascript
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};
    window.TypoMotionStyles['styleId'] = {
        name: '표시 이름',
        backgroundColor: '#000000',
        textColor: 'rgba(255,255,255,0.3)',
        glowColor: '#ffd700',
        layout: function(leds, canvas, ctx) {
            // 배치 로직
        },
        presets: {
            'presetId': {
                name: '프리셋 이름',
                apply: function(led, time, ctx, state) {
                    return { opacity, scale, rotation, offsetX, offsetY };
                }
            }
        }
    };
})();
### 스타일 객체 예시

```javascript
window.TypoMotionStyles['dance001'] = {
    name: 'Dance 001',
    presets: {
        bounceIn: {
            name: '바운스 인',
            apply: function(led, time, ctx, state) {
                // ...
            }
        },
        // ...
    }
};
🧰 공통 유틸리티 함수 (utils.js)
이 함수들은 전역으로 노출되어 모든 스타일 파일에서 사용할 수 있습니다.

함수	설명
timeToSeconds(srtTimeStr)	"00:00:03,500" → 초(float) 변환
parseSRT(content)	SRT 문자열을 큐 배열로 파싱
formatTime(seconds)	초 → "00:00.00" 표시용
decomposeKorean(syllable)	한글 음절 → [초성, 중성, 종성] 배열
easeOutBounce(p)	바운스 이징
easeOutBack(p)	백 이징
easeOutElastic(p)	탄성 이징
easeInOutCubic(p)	부드러운 인아웃
🎨 색상 스타일 (colorStyles.js)
함수	설명
getColorForCue(index, styleName)	큐 인덱스와 스타일명으로 색상 반환
지원 색상 스타일명
스타일명	설명
'harmony'	골든 앵글 기반 HSL (추천)
'monochrome'	흑백
'pastel'	파스텔톤
'neon'	네온컬러
'primary'	원색계열
📦 메인 상태 변수 (app.js에서 관리)
변수	설명
allLeds	현재 화면의 모든 자모 LED 객체 배열
currentTime	현재 재생/타임라인 시간 (초)
currentFont	현재 선택된 폰트 문자열
currentFontSize	현재 폰트 크기 (px)
scatterAmount	흩어짐 정도 (0 ~ 1)
currentColorStyle	현재 색상 스타일명
currentStyleId	로드된 타이포 스타일 ID (예: 'dance001')
currentPresetId	선택된 모션 프리셋 ID
⚙️ 핵심 함수 (app.js)
함수	설명
loadSRT(content)	SRT 로드 시 전체 처리 (파싱 → LED 생성 → 배치)
buildAllLeds()	음절별 자모 LED 생성 (중복 자모를 음절별로 복제)
assignInitialPositions()	LED 초기 랜덤 배치
avoidOverlaps()	LED 겹침 회피 (물리적 반발 알고리즘)
render()	캔버스에 현재 상태를 그림
applyMotionPreset(led, time)	현재 프리셋을 LED에 적용하여 변형 반환
loadStyle(styleId)	스타일 JS 파일을 동적으로 로드
populatePresetSelect()	로드된 스타일의 프리셋들을 UI 드롭다운에 추가
🚀 스타일 파일 작성 방법
styles/ 폴더 안에 새 JS 파일을 만듭니다.
파일 이름은 [styleId].js 형식으로 지정합니다.
(예: jazz001.js, ballad002.js)

템플릿
javascript
// styles/dance001.js
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['dance001'] = {
        name: 'Dance 001',
        presets: {
            'bounceIn': {
                name: '바운스 인',
                apply: function(led, time, ctx, state) {
                    // led: { char, start, end, color, x, y, baseX, baseY, ... }
                    // time: 현재 재생 시간(초)
                    // ctx: CanvasRenderingContext2D
                    // state: { currentFont, currentFontSize, scatterAmount }
                    
                    const t = Math.min(1, (time - led.start) / 0.4);
                    const scale = easeOutBounce(t);
                    
                    return { 
                        opacity: 1, 
                        scale: scale, 
                        rotation: 0, 
                        offsetX: 0, 
                        offsetY: 0 
                    };
                }
            },
            // ... 다른 프리셋들
        }
    };
})();
필수 반환 객체
apply 함수는 항상 아래 속성들을 포함한 객체를 반환해야 합니다.

속성	타입	설명
opacity	number	0 ~ 1 (1 = 완전 불투명)
scale	number	배율 (1 = 원래 크기)
rotation	number	회전 각도 (도 단위)
offsetX	number	x축 추가 이동 (px)
offsetY	number	y축 추가 이동 (px)
offsetX, offsetY는 LED의 기본 위치(led.x, led.y)에 더해집니다.

➕ index.html에 새 스타일 추가하기
styles/ 폴더에 스타일 JS 파일을 추가합니다. (예: jazz001.js)

index.html의 <select id="styleSelect"> 안에 <option>을 추가합니다.

html
<select id="styleSelect">
    <option value="">-- 스타일 선택 --</option>
    <option value="drive001">드라이브</option>
    <option value="dance001">댄스</option>
    <option value="ballad001">발라드</option>
    <option value="rock001">락</option>
    <option value="newage001">뉴에이지</option>
    <option value="traditional001">국악</option>
    <option value="sleeping001">수면</option>
    <!-- 새 스타일 -->
    <option value="jazz001">재즈</option>
</select>
저장하고 index.html을 열면 드롭다운에서 선택할 수 있습니다.

⚠️ 주의사항
모든 스타일 파일은 IIFE(즉시 실행 함수) 로 작성하여 전역 오염을 방지합니다.

스타일 파일 내에서 utils.js의 공용 함수(decomposeKorean, easeOutBounce 등)를 자유롭게 사용할 수 있습니다.

apply 함수는 동기식으로 작동해야 하며, led 객체를 직접 수정하면 안 됩니다. (반환값만 사용)

LED가 활성화되기 전(비활성 상태)에는 apply 함수가 호출되지 않습니다.
비활성 상태의 렌더링은 app.js에서 외곽선으로 자동 처리됩니다.
