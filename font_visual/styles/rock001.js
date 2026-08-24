// styles/rock001.js
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['rock001'] = {
        name: 'Rock 001',
        backgroundColor: '#200000',
        textColor: 'rgba(255,255,255,0.2)',
        glowColor: '#ff3300',
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
            'heavyDrop': {
                name: '헤비 드롭',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: (1 - easeOutBounce(t)) * -300 };
                }
            },
            'shakeViolent': {
                name: '격렬한 흔들림',
                apply: function(led, time, ctx, state) {
                    const duration = 0.4;
                    const t = Math.min(1, (time - led.start) / duration);
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: 0,
                        offsetX: Math.sin(t * Math.PI * 20) * 30 * (1 - t),
                        offsetY: Math.cos(t * Math.PI * 16) * 20 * (1 - t)
                    };
                }
            },
            'explodeIn': {
                name: '폭발 등장',
                apply: function(led, time, ctx, state) {
                    const duration = 0.5;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 0.2 + 0.8 * easeOutBack(t), rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'glitchRock': {
                name: '글리치',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: 0,
                        offsetX: (Math.random() - 0.5) * 40 * (1 - t),
                        offsetY: (Math.random() - 0.5) * 40 * (1 - t)
                    };
                }
            },
            'slamZoom': {
                name: '강한 줌',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 0.1 + 0.9 * easeInBack(t), rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'thrash': {
                name: '트래시',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: Math.sin(t * Math.PI * 15) * 30 * (1 - t),
                        offsetX: Math.cos(t * Math.PI * 12) * 20 * (1 - t),
                        offsetY: 0
                    };
                }
            }
        }
    };
})();
