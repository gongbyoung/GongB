// styles/drive001.js
// 자동차 드라이브 느낌의 타이포 스타일
(function() {
    if (!window.TypoMotionStyles) window.TypoMotionStyles = {};

    window.TypoMotionStyles['drive001'] = {
        name: 'Drive 001',
        backgroundColor: '#0a0a20',
        textColor: 'rgba(255,255,255,0.25)',
        glowColor: '#00ccff',
        // 도로(차선) 형태로 배치하는 레이아웃
        layout: function(leds, canvas, ctx) {
            const laneCount = 5; // 5개의 차선
            const laneHeight = canvas.height / laneCount;

            leds.forEach((led, i) => {
                const lane = i % laneCount; // LED를 차선에 분배
                // 각 차선의 중앙에서 약간의 랜덤 오프셋
                const randomOffset = (Math.random() - 0.5) * 40; 
                led.baseX = (Math.random() * canvas.width * 0.8) + 50; // 화면 전체에 분포
                led.baseY = (lane * laneHeight) + (laneHeight / 2) + randomOffset;
            });
        },
        presets: {
            'speedBurst': {
                name: '슝~ 하고 지나가기',
                apply: function(led, time, ctx, state) {
                    const intensity = state.intensityAmount || 0.5;
                    const duration = 1.2;
                    const t = Math.min(1, (time - led.start) / duration);
                    const speed = 600 * intensity; // 이동 속도
                    return {
                        opacity: t < 0.2 ? t / 0.2 : (t > 0.8 ? (1 - t) / 0.2 : 1),
                        scale: 1,
                        rotation: 0,
                        offsetX: (1 - t) * speed, // 왼쪽에서 오른쪽으로 슝~
                        offsetY: 0
                    };
                }
            },
            'shakeAndBurst': {
                name: '흔들리다가 뭉쳤다가 슝~',
                apply: function(led, time, ctx, state) {
                    const intensity = state.intensityAmount || 0.5;
                    const t = Math.min(1, (time - led.start) / 1.0);
                    // 앞부분: 흔들리며 진동
                    let offsetX = 0;
                    if (t < 0.4) {
                        offsetX = Math.sin(time * 50) * 15 * intensity * (1 - t);
                    }
                    // 중간: 뭉쳐짐 (Scale 축소)
                    let scale = 1;
                    if (t >= 0.4 && t < 0.6) scale = 0.5;
                    // 뒷부분: 슝~ 하고 나감
                    if (t >= 0.6) {
                        const moveT = (t - 0.6) / 0.4;
                        offsetX = moveT * 800 * intensity;
                    }
                    return { opacity: 1, scale: scale, rotation: 0, offsetX: offsetX, offsetY: 0 };
                }
            },
            'airResistance': {
                name: '바람 저항 (앞 작고 뒤 크게)',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.8);
                    // 움직일 때는 앞으로 가는 것처럼 작아졌다가, 멈추면 커짐
                    const isMoving = t < 0.7;
                    const scale = isMoving ? 0.6 + 0.4 * t : 1 + 0.2 * Math.sin(time * 10); 
                    return {
                        opacity: 1,
                        scale: scale,
                        rotation: 0,
                        offsetX: isMoving ? (1 - t) * 300 : 0,
                        offsetY: 0
                    };
                }
            },
            'tireSpin': {
                name: '타이어 스핀',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.9);
                    const spinSpeed = 900 * (state.intensityAmount || 0.5);
                    return {
                        opacity: 1,
                        scale: 0.8 + 0.2 * t,
                        rotation: (1 - t) * spinSpeed,
                        offsetX: (1 - t) * 250,
                        offsetY: 0
                    };
                }
            },
            'laneChange': {
                name: '차선 변경',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.7);
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: t * 15, // 살짝 기울어짐
                        offsetX: (1 - t) * 200,
                        offsetY: Math.sin(t * Math.PI) * 150 // 옆 차선으로 이동
                    };
                }
            },
            'drift': {
                name: '드리프트',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 1.0);
                    const driftAngle = Math.sin(t * Math.PI) * 40;
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: driftAngle,
                        offsetX: (1 - t) * 500,
                        offsetY: Math.sin(t * Math.PI) * 80
                    };
                }
            },
            'hardBrake': {
                name: '급 브레이크',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 1.1);
                    // 빠르게 들어오다가 멈추고 살짝 뒤로 밀림
                    let offsetX = (1 - t) * 600;
                    if (t > 0.7) offsetX = Math.sin((t - 0.7) * 20) * 20 * (1 - t); 
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: 0,
                        offsetX: offsetX,
                        offsetY: 0
                    };
                }
            },
            'engineVibration': {
                name: '엔진 진동',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 1.0);
                    const vibration = Math.sin(time * 60) * 5 * (state.intensityAmount || 0.5);
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: 0,
                        offsetX: vibration,
                        offsetY: Math.cos(time * 60) * 3
                    };
                }
            },
            'drafting': {
                name: '드래프팅 (뒤 따라가기)',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 1.0);
                    // 앞 차량 뒤에 붙어 작게 따라가다가, 시간이 지나면 정상 크기로!
                    const scale = (t < 0.5) ? 0.5 + (t * 0.8) : 1;
                    return {
                        opacity: t < 0.2 ? t / 0.2 : 1,
                        scale: scale,
                        rotation: 0,
                        offsetX: (1 - t) * 150,
                        offsetY: 0
                    };
                }
            },
            'nitroBoost': {
                name: '니트로 부스트',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 0.5); // 매우 짧은 시간에!
                    return {
                        opacity: 1,
                        scale: 2.5 - (1.5 * t), // 갑자기 커졌다가 빠르게 작아짐
                        rotation: 0,
                        offsetX: (1 - t) * 800, // 미친 속도로 이동
                        offsetY: 0
                    };
                }
            },
            'pothole': {
                name: '포트홀 (움푹 파인 곳)',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 1.0);
                    // 딥! 빠졌다가 튀어오르는 효과
                    const offsetY = Math.sin(t * Math.PI) * 60;
                    return {
                        opacity: 1,
                        scale: 1 + Math.sin(t * Math.PI) * 0.3,
                        rotation: Math.sin(t * Math.PI) * 20,
                        offsetX: 0,
                        offsetY: offsetY
                    };
                }
            },
            'headlight': {
                name: '전조등',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 1.0);
                    // 앞을 비추듯 커졌다가 가면서 작아짐
                    const scale = (t < 0.3) ? 1 + t * 2 : 1.6 - (t - 0.3) * 1.5;
                    return {
                        opacity: 1,
                        scale: scale,
                        rotation: 0,
                        offsetX: (1 - t) * 250,
                        offsetY: 0
                    };
                }
            },
            'exhaust': {
                name: '배기 가스',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 1.0);
                    // 뒤로 살짝 밀렸다가 앞으로 슝~
                    const offsetX = (t < 0.3) ? -(t * 50) : (t - 0.3) * 500;
                    return {
                        opacity: 1,
                        scale: 0.5 + (t * 0.5),
                        rotation: Math.sin(time * 10) * 10,
                        offsetX: offsetX,
                        offsetY: 0
                    };
                }
            },
            'parallelPark': {
                name: '평행 주차',
                apply: function(led, time, ctx, state) {
                    const t = Math.min(1, (time - led.start) / 1.0);
                    // 옆으로 갔다가 들어오는 주차 동작
                    const offsetX = Math.sin(t * Math.PI) * 100;
                    const offsetY = Math.sin(t * Math.PI * 2) * 50;
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: Math.sin(t * Math.PI) * 45,
                        offsetX: offsetX,
                        offsetY: offsetY
                    };
                }
            },
            'windStream': {
                name: '바람을 가르며',
                apply: function(led, time, ctx, state) {
                    const intensity = state.intensityAmount || 0.5;
                    const t = Math.min(1, (time - led.start) / 1.0);
                    // 좌우로 심하게 요동치면서 빠르게 이동
                    const sway = Math.sin(time * 20) * 20 * intensity * (1 - t);
                    return {
                        opacity: 1,
                        scale: 1,
                        rotation: sway * 0.5,
                        offsetX: (1 - t) * 500,
                        offsetY: sway
                    };
                }
            }
        }
    };
})();
