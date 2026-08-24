// styles/traditional001.js
// 국악 스타일: 절제되고 우아한 모션

(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['traditional001'] = {
        name: 'Traditional 001',
        presets: {
            'elegantFade': {
                name: '우아한 페이드',
                apply: function(led, time, ctx, state) {
                    const duration = 0.8;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: t, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'gentleSlide': {
                name: '부드러운 슬라이드',
                apply: function(led, time, ctx, state) {
                    const duration = 0.5;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetX = (1 - t) * 60;
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: offsetX, offsetY: 0 };
                }
            },
            'slowTurn': {
                name: '느린 회전',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    const rotation = (1 - t) * 90;
                    return { opacity: 1, scale: 1, rotation: rotation, offsetX: 0, offsetY: 0 };
                }
            },
            'brushStroke': {
                name: '붓 터치',
                apply: function(led, time, ctx, state) {
                    const duration = 0.4;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = 0.5 + 0.5 * easeInOutCubic(t);
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'subtleFloat': {
                name: '미세한 떠오름',
                apply: function(led, time, ctx, state) {
                    const duration = 0.7;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetY = (1 - t) * 20;
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: offsetY };
                }
            },
            'ceremonial': {
                name: '의식적인 등장',
                apply: function(led, time, ctx, state) {
                    const duration = 0.8;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = 0.3 + 0.7 * t;
                    const rotation = (1 - t) * 15;
                    return { opacity: 1, scale: scale, rotation: rotation, offsetX: 0, offsetY: 0 };
                }
            },
            'softGlow': {
                name: '은은한 글로우',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    const opacity = t;
                    const scale = 1 + Math.sin(time * 2.5) * 0.03;
                    return { opacity: opacity, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'inkSpread': {
                name: '먹물 번짐',
                apply: function(led, time, ctx, state) {
                    const duration = 0.7;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = 0.2 + 0.8 * t;
                    const opacity = t;
                    return { opacity: opacity, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            }
        }
    };
})();
