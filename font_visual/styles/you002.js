// styles/you002.js
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    // 1. 유니코드 기반 한글 음절 구조 분석 (논문: 한글 활자디자인 조형적 비례 연구 기반)
    function analyzeHangul(char) {
        if (!char) return { type: 'etc', weight: 1.0, isWide: false };
        const code = char.charCodeAt(0);
        if (code < 0xAC00 || code > 0xD7A3) {
            // 특수문자, 알파벳, 한자, 공백 등
            return { type: 'symbol', weight: 0.6, isWide: false };
        }
        const syllableIndex = code - 0xAC00;
        const jong = syllableIndex % 28;
        const jung = Math.floor((syllableIndex - jong) / 28) % 21;
        const cho = Math.floor(Math.floor((syllableIndex - jong) / 28) / 21);

        // 중성 형태 판별 (가로모임: ㅗ, ㅛ, ㅜ, ㅠ, ㅡ / 세로모임: ㅏ, ㅑ, ㅓ, ㅕ, ㅣ / 복합)
        const isHorizontalVowel = [8, 12, 13, 17, 18].includes(jung); // ㅗ, ㅜ, ㅡ 계열
        const hasBatchim = jong > 0;

        return {
            type: 'hangul',
            cho: cho,
            jung: jung,
            jong: jong,
            hasBatchim: hasBatchim,
            isHorizontalVowel: isHorizontalVowel,
            // 종성 유무 및 모음 형태에 따른 무게(Weight) 배분
            weight: hasBatchim ? 1.35 : 1.0,
            isWide: isHorizontalVowel
        };
    }

    // 일관된 유기적 변형(Organic Variance)을 위한 해시 함수
    function getVariance(str, index) {
        let val = 0;
        const seed = (str || 'calli') + '_' + index;
        for (let i = 0; i < seed.length; i++) {
            val = (val << 5) - val + seed.charCodeAt(i);
            val |= 0;
        }
        return (Math.abs(val) % 1000) / 1000; // 0.0 ~ 1.0 반환
    }

    window.TypoMotionStyles['you002'] = {
        name: '글쓰기 (서예 조형학)',
        backgroundColor: '#f7f5f0', // 은은한 한지/화선지 미색
        textColor: 'rgba(28, 26, 26, 0.25)', // 마르기 전 연한 먹빛 (비활성)
        glowColor: '#8a1f1f',        // 전통 전각(인장) 주홍색

        // 2. 조형 배치 (Layout): 탈네모틀 비례 및 속공간 파고들기
        layout: function(leds, canvas, ctx) {
            if (!leds || leds.length === 0) return;

            const total = leds.length;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            // 큐(문장) 단위로 그룹핑하여 조형적 군집(Cluster) 형성
            const cues = {};
            leds.forEach(led => {
                const cIdx = led.cueIdx || 0;
                if (!cues[cIdx]) cues[cIdx] = [];
                cues[cIdx].push(led);
            });

            Object.keys(cues).forEach(cIdx => {
                const group = cues[cIdx];
                const groupLen = group.length;
                if (groupLen === 0) return;

                // 문장 내 감정 강조점(Focal Point) 탐색: 글자 수가 긴 명사나 중심 글자
                const focusIdx = Math.min(Math.floor(groupLen * 0.4), groupLen - 1);

                // 기준 폰트 크기 산출
                const baseSize = Math.min(canvas.width / (groupLen * 0.8), 85);

                // 중심 배치를 위한 전체 폭 사전 계산
                let totalWidth = 0;
                const charMetrics = group.map((led, i) => {
                    const info = analyzeHangul(led.char);
                    const v = getVariance(led.char, i);
                    
                    // 핵심어는 최대 1.9배까지 확대, 보조 조사는 0.7배 축소 (극단적 스케일 대비)
                    const dist = Math.abs(i - focusIdx);
                    let scale = (dist === 0) ? 1.85 : (dist === 1 ? 1.25 : 0.75 + v * 0.3);
                    
                    // 받침이 있는 글자는 속공간 확보를 위해 추가 면적 부여
                    if (info.hasBatchim) scale *= 1.1;

                    const width = baseSize * scale * (info.isWide ? 0.95 : 0.75);
                    totalWidth += width;
                    return { info, scale, width, v };
                });

                // 캘리그라피 군집 시작 X좌표 (화면 정중앙 기준 정렬)
                let cursorX = centerX - (totalWidth * 0.5);

                group.forEach((led, i) => {
                    const m = charMetrics[i];
                    
                    // 논문 응용: '기준선 탈피' (Y축 흐름선 - 필맥의 기운생동)
                    // 중심 글자는 아래로 묵직하게 가라앉고, 보조 글자는 위/아래로 넘나듦
                    const baselineShift = (m.scale > 1.4) 
                        ? (m.scale - 1.0) * 18 
                        : Math.sin(i * 1.5) * 24 + ((m.v - 0.5) * 20);

                    // 캘리그라피 속공간 맞물림: 글자 간격을 인위적으로 15%~20% 좁혀 파고듦
                    const interlockingOffset = m.width * 0.15;
                    
                    led.baseX = cursorX + (m.width / 2) - interlockingOffset;
                    led.baseY = centerY + baselineShift;
                    
                    // 스타일 커스텀 파라미터 저장
                    led.calliScale = m.scale;
                    // 자연스러운 붓의 꺾임 각도 (-8도 ~ +8도)
                    led.calliAngle = ((m.v - 0.5) * 16) * (Math.PI / 180);
                    led.calliWeight = m.info.weight;

                    cursorX += m.width - interlockingOffset;
                });
            });
        },

        // 3. 서예 모션 프리셋: 전통 서예의 3단계 필획 (기필-행필-수필)
        presets: {
            'calliWriting': {
                name: '일필휘지 (기필·행필·수필)',
                apply: function(led, time, ctx, state) {
                    const start = led.start;
                    const end = led.end;
                    const duration = Math.max(end - start, 0.4);
                    const elapsed = time - start;
                    const progress = Math.min(Math.max(elapsed / duration, 0), 1);

                    // 아직 등장하지 않은 글자
                    if (time < start) {
                        return { opacity: 0, scale: 0, rotation: 0, offsetX: 0, offsetY: 0 };
                    }

                    const intensity = (state.intensityAmount !== undefined ? state.intensityAmount : 50) / 50;
                    const range = (state.rangeAmount !== undefined ? state.rangeAmount : 50) / 50;

                    let opacity = 1.0;
                    let scale = led.calliScale || 1.0;
                    let rotation = led.calliAngle || 0;
                    let offsetX = 0;
                    let offsetY = 0;

                    // [단계 1: 기필(起筆) - 0.0 ~ 0.2]
                    // 붓이 종이에 닿기 전 멈칫(Anticipation) 후 묵직하게 내리찍음 (Squash & Impact)
                    if (progress < 0.2) {
                        const p = progress / 0.2;
                        // 오버슈트 탄성 곡선: 위에서 아래로 내려오며 종이를 누름
                        const dropIn = Math.sin(p * Math.PI * 0.5);
                        const squash = Math.sin(p * Math.PI);

                        offsetY = (1 - dropIn) * -35 * range;
                        // 기필 시 붓털이 눌리는 물리 현상 (가로 확장, 세로 압축)
                        scale *= (0.6 + 0.4 * dropIn + squash * 0.3 * intensity);
                        rotation += (1 - p) * -0.2;
                        opacity = Math.pow(p, 1.4);

                        // 먹물이 화선지에 번지는 효과 연출 (그림자 이용)
                        ctx.shadowColor = 'rgba(20, 18, 18, 0.6)';
                        ctx.shadowBlur = (1 - p) * 20 * intensity;
                    }
                    // [단계 2: 행필(行筆) - 0.2 ~ 0.85]
                    // 획이 미끄러지듯 그어지며 살아 숨쉬는 곡선 궤적 유지 (Staging & 필맥)
                    else if (progress < 0.85) {
                        const p = (progress - 0.2) / 0.65;
                        // 미세한 필맥의 호흡 (Breathing Oscillations)
                        const breath = Math.sin(p * Math.PI * 2);
                        offsetY = breath * 2.5 * intensity;
                        rotation += breath * 0.03;
                        
                        ctx.shadowColor = 'rgba(20, 18, 18, 0.15)';
                        ctx.shadowBlur = 3;
                    }
                    // [단계 3: 수필(收筆) - 0.85 ~ 1.0]
                    // 붓끝을 회수하며 힘을 거둠 (Follow Through & 회봉)
                    else {
                        const p = (progress - 0.85) / 0.15;
                        // 획의 끝에서 붓을 살짝 들어올리는 모션
                        offsetY = -p * 6 * range;
                        scale *= (1.0 - p * 0.08);
                        ctx.shadowBlur = 0;
                    }

                    // 전역 잔상(Trail) 및 강도 파라미터 연동
                    if (state.scatterAmount > 0) {
                        const scatter = state.scatterAmount * 15;
                        offsetX += (Math.random() - 0.5) * scatter;
                        offsetY += (Math.random() - 0.5) * scatter;
                    }

                    return {
                        opacity: opacity,
                        scale: scale,
                        rotation: rotation,
                        offsetX: offsetX,
                        offsetY: offsetY
                    };
                }
            },

            'boldContrast': {
                name: '갈필 먹번짐 (High Contrast)',
                apply: function(led, time, ctx, state) {
                    const elapsed = time - led.start;
                    const duration = Math.max(led.end - led.start, 0.3);
                    const progress = Math.min(Math.max(elapsed / duration, 0), 1);

                    if (time < led.start) {
                        return { opacity: 0, scale: 0, rotation: 0, offsetX: 0, offsetY: 0 };
                    }

                    let scale = (led.calliScale || 1.0);
                    let rotation = led.calliAngle || 0;
                    let offsetY = 0;

                    if (progress < 0.25) {
                        const p = progress / 0.25;
                        // 거친 붓의 급격한 낙하 및 튀어오름
                        const pop = Math.sin(p * Math.PI * 1.5) * Math.exp(-p * 3);
                        scale *= (1.0 + pop * 0.6);
                        offsetY = (1 - p) * -50;
                    }

                    return {
                        opacity: progress > 0.9 ? 1 - (progress - 0.9) / 0.1 : 1,
                        scale: scale,
                        rotation: rotation,
                        offsetX: 0,
                        offsetY: offsetY
                    };
                }
            }
        }
    };
})();
