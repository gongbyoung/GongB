// styles/traditional001.js
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['traditional001'] = {
        name: 'Traditional 001',
        backgroundColor: '#1a1a10',
        textColor: 'rgba(255,255,255,0.2)',
        glowColor: '#ccaa66',
        layout: function(leds, canvas, ctx) {
            const cols = Math.ceil(Math.sqrt(leds.length));
            leds.forEach((led, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                led.baseX = (col + 0.5) * (canvas.width / cols);
                led.baseY = (row + 0.5) * (canvas.height / Math.ceil(leds.length / cols));
            });
        },
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
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: (1 - t) * 60, offsetY: 0 };
                }
            },
            'slowTurn': {
                name: '느린 회전',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 1, rotation: (1 - t) * 90, offsetX: 0, offsetY: 0 };
                }
            },
            'brushStroke': {
                name: '붓 터치',
                apply: function(led, time, ctx, state) {
                    const duration = 0.4;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 0.5 + 0.5 * easeInOutCubic(t), rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'subtleFloat': {
                name: '미세한 떠오름',
                apply: function(led, time, ctx, state) {
                    const duration = 0.7;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: (1 - t) * 20 };
                }
            },
            'inkSpread': {
                name: '먹물 번짐',
                apply: function(led, time, ctx, state) {
                    const duration = 0.7;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: t, scale: 0.2 + 0.8 * t, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            }
        }
    };
})();
