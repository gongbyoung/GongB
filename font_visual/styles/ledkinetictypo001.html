// styles/ledkinetictypo001.js
// LED 키네틱 타이포그래피 전용 스타일
// 자모 LED가 순차적으로 점등되며, 다양한 등장 효과를 제공합니다.

(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['ledkinetictypo001'] = {
        name: 'LED Kinetic Typo 001',
        presets: {
            // 1. 기본 점등 (현재 동작과 동일)
            'static': {
                name: '기본 점등',
                apply: function(led, time, ctx, state) {
                    // 아무 변화 없이 즉시 켜짐
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },

            // 2. 페이드 인 (0.3초 동안 서서히 나타남)
            'fadeIn': {
                name: '페이드 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.3;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: t, scale: 1, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },

            // 3. 팝 인 (0.4초 동안 튀어오르며 등장)
            'popIn': {
                name: '팝 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.4;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = 1 + 0.3 * easeOutBack(t);
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },

            // 4. 바운스 인 (0.6초 동안 바운스)
            'bounceIn': {
                name: '바운스 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.6;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = easeOutBounce(t);
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },

            // 5. 회전 인 (0.5초 동안 360도 회전하며 등장)
            'rotateIn': {
                name: '회전 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.5;
                    const t = Math.min(1, (time - led.start) / duration);
                    return { opacity: 1, scale: 1, rotation: (1 - t) * 360, offsetX: 0, offsetY: 0 };
                }
            },

            // 6. 글로우 펄스 (켜진 후에도 은은하게 빛나는 효과)
            'glowPulse': {
                name: '글로우 펄스',
                apply: function(led, time, ctx, state) {
                    // 등장은 0.2초 페이드 인
                    const fadeDuration = 0.2;
                    const fadeT = Math.min(1, (time - led.start) / fadeDuration);
                    const opacity = fadeT;

                    // 시간에 따라 크기가 약간 변동 (1 ~ 1.05)
                    const scale = 1 + Math.sin(time * 5) * 0.03;

                    return { opacity: opacity, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },

            // 7. 웨이브 인 (0.5초 동안 좌우로 흔들리며 등장)
            'waveIn': {
                name: '웨이브 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.5;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetX = Math.sin(t * Math.PI * 6) * 20 * (1 - t);
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: offsetX, offsetY: 0 };
                }
            },

            // 8. 슬라이드 인 (0.4초 동안 아래에서 위로 올라옴)
            'slideUp': {
                name: '슬라이드 업',
                apply: function(led, time, ctx, state) {
                    const duration = 0.4;
                    const t = Math.min(1, (time - led.start) / duration);
                    const offsetY = (1 - t) * 80; // 80px 아래에서 시작
                    return { opacity: 1, scale: 1, rotation: 0, offsetX: 0, offsetY: offsetY };
                }
            },

            // 9. 줌 인 (0.35초 동안 커지며 등장)
            'zoomIn': {
                name: '줌 인',
                apply: function(led, time, ctx, state) {
                    const duration = 0.35;
                    const t = Math.min(1, (time - led.start) / duration);
                    const scale = 0.2 + 0.8 * t;
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: 0, offsetY: 0 };
                }
            },

            // 10. 딜레이 등장 (자모마다 0.05초 간격으로 켜짐 - app.js에서 이미 순차 점등하므로 효과는 미미)
            // 실제로는 각 자모의 start 시간이 이미 순차적이므로 추가 딜레이 불필요하지만,
            // 만약 개별 등장 효과를 주고 싶다면 여기서 시간 지연을 줄 수 있음.
        }
    };
})();
