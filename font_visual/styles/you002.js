// styles/calligraphy001.js
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    // 캘리그라피 먹 번짐 및 질감 캐시용 오프스크린 캔버스 버퍼
    let paperCanvas = null;
    let paperCtx = null;

    // 한지/화선지 질감 초기화
    function initPaperTexture(width, height) {
        if (!paperCanvas || paperCanvas.width !== width || paperCanvas.height !== height) {
            paperCanvas = document.createElement('canvas');
            paperCanvas.width = width;
            paperCanvas.height = height;
            paperCtx = paperCanvas.getContext('2d');

            // 미세 먹 섬유질 및 화선지 그레인 노이즈 생성
            const imgData = paperCtx.createImageData(width, height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const grain = (Math.random() - 0.5) * 12;
                data[i] = 245 + grain;     // R
                data[i + 1] = 243 + grain; // G
                data[i + 2] = 238 + grain; // B (전통 화선지 톤)
                data[i + 3] = 255;
            }
            paperCtx.putImageData(imgData, 0, 0);
        }
    }

    // 간단한 해시 함수: 글자마다 고유하되 일관된 변형값 생성
    function getHash(str, idx) {
        let hash = 0;
        const key = str + '_' + idx;
        for (let i = 0; i < key.length; i++) {
            hash = (hash << 5) - hash + key.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    window.TypoMotionStyles['calligraphy001'] = {
        name: '감성 캘리그라피 (Ink Brush)',
        backgroundColor: '#f5f3ee', // 화선지 백색
        textColor: '#1a1818',       // 먹색
        glowColor: '#7a1c1c',        // 낙관(인장) 주홍색

        // 1. 조형적 캘리그라피 배치 로직 (구도 설계)
        layout: function(leds, canvas, ctx) {
            initPaperTexture(canvas.width, canvas.height);

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const total = leds.length;
            if (total === 0) return;

            // 전체 문장에서 핵심 강조 글자(Primary Focus) 결정
            // 레퍼런스처럼 문장의 중간~후반 핵심 명사를 크게 강조
            const emphasisCenter = Math.floor(total * 0.45);

            let currentX = centerX - (total * 30);
            let currentY = centerY;

            leds.forEach((led, i) => {
                const h = getHash(led.char || '', i);
                const distFromEmphasis = Math.abs(i - emphasisCenter);

                // 핵심 강조 글자 판별 (거리 기준)
                const isEmphasis = distFromEmphasis <= 1;
                
                // 스케일 가중치: 강조 단어는 2.2배 이상 거대하게, 앞뒤 보조어는 축소
                led.customScale = isEmphasis ? 2.3 : (0.75 + (h % 30) * 0.01);
                
                // 손글씨 특유의 미세한 Y축 불규칙 흐름 (Baseline Variation)
                const organicYOffset = Math.sin(i * 1.8) * 18 + ((h % 40) - 20);
                
                // 레퍼런스 특유의 겹침(Interlocking) 구조: 간격을 타이트하게 파고듦
                const spacing = (led.customScale * 48) * 0.72;

                led.baseX = currentX + spacing;
                led.baseY = currentY + organicYOffset;

                // 세로형 배열이나 지그재그 행간 처리를 위한 인덱스 오프셋
                if (i > 0 && i % 4 === 0 && total > 6) {
                    currentX -= spacing * 2.8;
                    currentY += 75;
                } else {
                    currentX += spacing;
                }

                // 캘리 고유 기울기 (Slant & Organic Tilt)
                led.customAngle = ((h % 20) - 10) * (Math.PI / 180);
            });
        },

        presets: {
            // 프리셋 1: 먹물이 서서히 스며들며 피어나는 동양화 붓글씨 모션
            'inkBleed': {
                name: '먹 번짐 피어오름 (Ink Bleed)',
                apply: function(led, time, ctx, state) {
                    const cueDuration = (led.end - led.start) || 1.5;
                    const elapsed = time - led.start;
                    const progress = Math.min(Math.max(elapsed / cueDuration, 0), 1);

                    // 비활성 구간
                    if (time < led.start) {
                        return { opacity: 0, scale: 0, rotation: 0, offsetX: 0, offsetY: 0 };
                    }

                    // 수묵화 붓글씨 물리 시뮬레이션:
                    // 1. 착지(Impact): 붓이 닿으며 순간적으로 납작해짐 (Squash)
                    // 2. 번짐(Absorption): 획이 자리잡으며 정교한 라인으로 수렴
                    let scaleFactor = led.customScale || 1.0;
                    let opacity = 1;
                    let offsetX = 0;
                    let offsetY = 0;
                    let rotation = led.customAngle || 0;

                    if (progress < 0.25) {
                        // 붓이 종이에 닿아 먹물이 퍼지는 단계
                        const p = progress / 0.25;
                        const impactSquash = Math.sin(p * Math.PI);
                        scaleFactor *= (0.7 + p * 0.3 + impactSquash * 0.25);
                        opacity = Math.pow(p, 1.8);
                        offsetY = -15 * (1 - p); // 위에서 먹물이 스며내려옴
                        
                        // 먹물 번짐 효과: 활성 단계에서 캔버스 컨텍스트 블러/필터 연동
                        ctx.shadowColor = 'rgba(20, 18, 18, 0.45)';
                        ctx.shadowBlur = (1 - p) * 16 * (state.intensityAmount || 0.6);
                    } else if (progress < 0.9) {
                        // 붓글씨 완성 및 미세한 숨결 모션 (Staging)
                        const p = (progress - 0.25) / 0.65;
                        const breathing = Math.sin(p * Math.PI * 2) * 1.5;
                        offsetY = breathing;
                        ctx.shadowColor = 'transparent';
                        ctx.shadowBlur = 0;
                    } else {
                        // 서서히 여운을 남기며 다음 획으로 연결 (Follow Through)
                        const p = (progress - 0.9) / 0.1;
                        opacity = 1 - p * 0.2;
                    }

                    return {
                        opacity: opacity,
                        scale: scaleFactor,
                        rotation: rotation,
                        offsetX: offsetX,
                        offsetY: offsetY
                    };
                }
            },

            // 프리셋 2: 역동적이고 날카로운 획갈림(비백) 캘리 모션
            'dynamicStroke': {
                name: '갈필 파갈 (Fast Brush Stroke)',
                apply: function(led, time, ctx, state) {
                    const elapsed = time - led.start;
                    const duration = (led.end - led.start) || 1.2;
                    const progress = Math.min(Math.max(elapsed / duration, 0), 1);

                    if (time < led.start) {
                        return { opacity: 0, scale: 0, rotation: 0, offsetX: 0, offsetY: 0 };
                    }

                    let scaleFactor = led.customScale || 1.0;
                    let rotation = led.customAngle || 0;
                    let offsetX = 0;
                    let offsetY = 0;

                    const intensity = state.intensityAmount || 0.7;

                    if (progress < 0.2) {
                        // 강한 붓의 탄성 오버슈트 (Anticipation & Snap)
                        const p = progress / 0.2;
                        const snap = Math.sin(p * Math.PI * 0.5);
                        offsetX = (1 - snap) * 45 * intensity;
                        rotation += (1 - snap) * -0.25;
                        scaleFactor *= (1.4 - snap * 0.4);
                    }

                    return {
                        opacity: progress > 0.85 ? mapLinear(progress, 0.85, 1.0, 1, 0) : 1,
                        scale: scaleFactor,
                        rotation: rotation,
                        offsetX: offsetX,
                        offsetY: offsetY
                    };
                }
            }
        }
    };

    function mapLinear(val, inMin, inMax, outMin, outMax) {
        return outMin + (outMax - outMin) * ((val - inMin) / (inMax - inMin));
    }
})();
