// dance001.js
if (window.TypoMotionStyles === undefined) window.TypoMotionStyles = {};

window.TypoMotionStyles['dance001'] = {
    name: 'Dance 001',
    presets: {
        'bounceIn': {
            name: '바운스 인',
            apply: (led, time, ctx, state) => {
                const t = Math.min(1, (time - led.start) / 0.4);
                const scale = easeOutBounce(t);
                return { opacity: 1, scale, rotation: 0, offsetX: 0, offsetY: 0 };
            }
        },
        'waveIn': { ... },
        // ...
    }
};
