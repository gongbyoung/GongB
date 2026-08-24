// styles/drive001.js
// 드라이브 스타일: 빠르고 에너제틱한 모션

(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['drive001'] = {
        name: 'Drive 001',
        presets: {
            'fastZoomIn': {
                name: '빠른 줌 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.2;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = 0.1 + 0.9 * t;
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'quickSlideLeft': {
                name: '왼쪽에서 슬라이드',
                apply: function(led, time, ctx, state) {
                    const duration = 0.25;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetX = (1 - t) * -120;
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: offsetX, offsetY: 0 };
                }
            },
            'spinFast': {
                name: '빠른 회전',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    const rotation = (1 - t) * 540;
                    return { opacity: 1, scale: 1, rotation: rotation, offsetX: 0, offsetY: 0 };
                }
            },
            'shakeHard': {
                name: '강한 흔들림',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetX = Math.sin(t * Math.PI * 12) * 15 * (1 - t);
                    const offsetY = Math.cos(t * Math.PI * 8) * 8 * (1 - t);
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: offsetX, offsetY: offsetY };
                }
            },
            'bounceDrop': {
                name: '드롭 바운스',
                apply: function(led, time, ctx, state) {
                    const duration = 0.5;
                    const t = Math.min(1, (time - led.start) / duration);
                    const bounce = easeOutBounce(t);
                    const offsetY = (1 - bounce) * -200;
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: offsetY };
                }
            },
            'elasticPop': {
                name: '탄성 팝',
                apply: function(led, time, ctx, state) {
                    const duration = 0.4;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = easeOutElastic(t);
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'fastFade': {
                name: '빠른 페이드',
                apply: function(led, time, ctx, state) {
                    const duration = 0.15;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: t, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'blinkIn': {
                name: '깜빡이며 등장',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    const blink = Math.abs(Math.sin(t * Math.PI * 4));
                    return { opacity: blink, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            }
        }
    };
})();
