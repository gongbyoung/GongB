// dance001.js
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['dance001'] = {
        name: 'Dance 001',
        presets: {
            'bounceIn': {
                name: '바운스 인',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.4);
                    const scale = easeOutBounce(t);
                    return { opacity: 1, scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },
            'waveIn': {
                name: '웨이브 인',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.6);
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: 0,
                        offsetX: Math.sin(t * Math.PI * 6) * 30 * (1 - t),
                        offsetY: 0
                    };
                }
            },
            'spinIn': {
                name: '회전 인',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.5);
                    return { opacity: 1, scale: 1, rotation: (1 - t) * 720, offsetX: 0, offsetY: 0 };
                }
            },
            // ... 더 많은 댄스 전용 프리셋
        }
    };
})();
