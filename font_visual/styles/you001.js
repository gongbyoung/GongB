// styles/you001.js - YOU 스타일 (95% 안전영역 + 초중종성 제자리 + 108모션 베이스)
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['you001'] = {
        name: 'YOU 001 - 너를 위한',
        description: '초중종성 제자리 조립 + 95% 안전영역 + 2배 크기 기반. 댄스/발라드/락/전통/동요/자장가 108개 모션 베이스',
        author: 'SRT Motion Studio V10',
        presets: {
            // === JAMO 제자리 시리즈 (핵심) ===
            'jamoInPlace': {
                name: '초중종성 제자리 조립',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, Math.max(0, (time - led.start) / 0.48));
                    const e = easeOutElastic(t);
                    const decomp = led.jamo ? led.jamo : (typeof decomposeKorean === 'function' ? decomposeKorean(led.char) : null);
                    
                    // 초성은 왼쪽에서, 중성은 위에서, 종성은 아래에서 같은 자리로
                    let offX = 0, offY = 0, rot = 0, sc = 1, op = 1;
                    if (led.jamoIndex === 0) { // 초성
                        offX = (1 - e) * (-60 + (Math.random()-0.5)*20);
                        offY = (1 - e) * (-40);
                        rot = (1 - e) * -22;
                        sc = 0.15 + e * 0.85;
                        op = t < 0.82 ? t : 0;
                    } else if (led.jamoIndex === 1) { // 중성
                        offX = (1 - e) * (50);
                        offY = (1 - e) * (-20);
                        rot = (1 - e) * 18;
                        sc = 0.15 + e * 0.85;
                        op = t < 0.82 ? t : 0;
                    } else if (led.jamoIndex === 2) { // 종성
                        offX = (1 - e) * 10;
                        offY = (1 - e) * 70;
                        rot = (1 - e) * -12;
                        sc = 0.15 + e * 0.85;
                        op = t < 0.82 ? t : 0;
                    } else { // 완성 글자
                        const finalT = Math.min(1, Math.max(0, (time - led.start - 0.28) / 0.48));
                        const fe = easeOutBack(finalT);
                        sc = 0.55 + fe * 0.45;
                        op = finalT;
                    }
                    return { opacity: op, scale: sc, rotation: rot, offsetX: offX, offsetY: offY };
                }
            },
            'jamoWave': {
                name: '초중종성 웨이브',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.5);
                    const e = easeOutElastic(t);
                    const waveY = Math.sin(time * 8 + (led.jamoIndex||0) * 1.2) * 10 * (1 - t*0.5);
                    return {
                        opacity: t < 0.82 ? t : 1,
                        scale: 0.2 + e * 0.8,
                        rotation: (1 - e) * 20,
                        offsetX: 0,
                        offsetY: waveY + (1 - e) * -40
                    };
                }
            },
            'jamoPop3': {
                name: '초중종성 3단 팝',
                apply: function(led, time, ctx, state) {
                    const d = (led.jamoIndex || 0) * 0.07;
                    const t = Math.min(1, Math.max(0, (time - led.start - d) / 0.42));
                    const e = easeOutBack(t);
                    return {
                        opacity: t,
                        scale: t < 0.7 ? t * 2.2 : 1 + Math.sin((t-0.7)*8)*0.15,
                        rotation: (1 - e) * 15 * ((led.jamoIndex||0)%2?1:-1),
                        offsetX: (1 - e) * ((led.jamoIndex||0)*10 - 10),
                        offsetY: (1 - e) * -70
                    };
                }
            },

            // === CHAR 시리즈 (2배 크기 + 95% 안전영역 대응) ===
            'slam': {
                name: '슬램 팝',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.35);
                    const e = easeOutBack(t);
                    return {
                        opacity: t,
                        scale: e * 1.25,
                        rotation: (1 - e) * 12 * (led.index % 2 ? 1 : -1),
                        offsetX: 0,
                        offsetY: (1 - e) * -90
                    };
                }
            },
            'bounce': {
                name: '바운스 드롭',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.5);
                    const e = easeOutBounce(t);
                    return {
                        opacity: 1,
                        scale: 0.4 + e * 0.6,
                        rotation: 0,
                        offsetX: 0,
                        offsetY: (1 - e) * -220
                    };
                }
            },
            'elastic': {
                name: '탄성 회전',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.6);
                    const e = easeOutElastic(t);
                    return {
                        opacity: t,
                        scale: e,
                        rotation: (1 - e) * 360,
                        offsetX: 0,
                        offsetY: 0
                    };
                }
            },
            'glitch': {
                name: '글리치',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.4);
                    const e = easeInOutCubic(t);
                    const glitchX = t < 0.88 ? (Math.random() - 0.5) * (1 - t) * 80 : 0;
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: (1 - t) * 8,
                        offsetX: glitchX,
                        offsetY: 0
                    };
                }
            },
            'wave': {
                name: '웨이브',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.6);
                    const wy = Math.sin(led.index * 0.7 + time * 8) * 22;
                    return {
                        opacity: t,
                        scale: 1,
                        rotation: 0,
                        offsetX: 0,
                        offsetY: wy
                    };
                }
            },

            // === WORD / SENTENCE 시리즈 ===
            'wordPop': {
                name: '단어 팝',
                apply: function(led, time, ctx, state) {
                    // word 단위에서는 led가 단어 그룹
                    const t = Math.min(1, (time - led.start) / 0.45);
                    const e = easeOutBack(t);
                    return {
                        opacity: t,
                        scale: 0.2 + e * 0.8,
                        rotation: 0,
                        offsetX: 0,
                        offsetY: (1 - e) * -50
                    };
                }
            },
            'wordBounce': {
                name: '단어 바운스',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.5);
                    const e = easeOutBounce(t);
                    return {
                        opacity: 1,
                        scale: 0.5 + e * 0.5,
                        rotation: 0,
                        offsetX: 0,
                        offsetY: (1 - e) * -180
                    };
                }
            },
            'sentenceDrop': {
                name: '문장 드롭',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.6);
                    const e = easeOutBack(t);
                    return {
                        opacity: t,
                        scale: 0.5 + e * 0.5,
                        rotation: 0,
                        offsetX: 0,
                        offsetY: (1 - e) * -80
                    };
                }
            },

            // === YOU 시그니처 프리셋 ===
            'youHeartbeat': {
                name: 'YOU 하트비트',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.6);
                    const e = easeOutBack(t);
                    const beat = 1 + Math.sin(time * 10 + led.index) * 0.12 * e;
                    return {
                        opacity: t,
                        scale: (0.3 + e * 0.7) * beat,
                        rotation: 0,
                        offsetX: 0,
                        offsetY: (1 - e) * -30
                    };
                }
            },
            'youOrbit': {
                name: 'YOU 오빗',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.7);
                    const ang = time * 3 + led.index * 0.6;
                    return {
                        opacity: t,
                        scale: t,
                        rotation: 0,
                        offsetX: Math.cos(ang) * 80 * (1 - t * 0.5),
                        offsetY: Math.sin(ang) * 80 * (1 - t * 0.5)
                    };
                }
            }
        }
    };
})();
