// styles/drive001.js
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['drive001'] = {
        name: 'Drive 001',
        backgroundColor: '#0a0a20',
        textColor: 'rgba(255,255,255,0.25)',
        glowColor: '#00ccff',
        layout: function(leds, canvas, ctx) {
            leds.forEach((led, i) => {
                led.baseX = (i * 37) % canvas.width;
                led.baseY = (i * 53) % canvas.height;
            });
        },
        presets: {
            'fastZoomIn': {
                name: '빠른 줌 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.2;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 0.1 + 0.9 * t, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'quickSlideLeft': {
                name: '왼쪽에서 슬라이드',
                apply: function(led, time, ctx, state) {
                    const duration = 0.25;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: (1 - t) * -120, offsetY: 0 };
                }
            },
            'spinFast': {
                name: '빠른 회전',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 1, rotation: (1 - t) * 540, offsetX: 0, offsetY: 0 };
                }
            },
            'shakeHard': {
                name: '강한 흔들림',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: 0,
                        offsetX: Math.sin(t * Math.PI * 12) * 15 * (1 - t),
                        offsetY: Math.cos(t * Math.PI * 8) * 8 * (1 - t)
                    };
                }
            },
            'elasticPop': {
                name: '탄성 팝',
                apply: function(led, time, ctx, state) {
                    const duration = 0.4;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: easeOutElastic(t), rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'blinkIn': {
                name: '깜빡이며 등장',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: Math.abs(Math.sin(t * Math.PI * 4)), scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            }
        }
    };
})();
