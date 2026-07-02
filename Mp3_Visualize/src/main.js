// 📝 [src/main.js 내부 - 자막 파서 및 싱크 엔진 교정]

function parseSRT(data) {
    // 공백 및 줄바꿈 문자를 정규화하여 파서 오작동 원천 차단
    const cleanData = data.replace(/\r/g, '').trim();
    
    // 더 유연하게 시간대와 텍스트 블록을 분리하는 느슨한 정규식 체계 도입
    const blocks = cleanData.split('\n\n');
    const subs = [];

    function timeToSeconds(t) {
        if (!t) return 0;
        const parts = t.trim().split(':');
        if (parts.length < 3) return 0;
        const secs = parts[2].split(',');
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(secs[0]) + (parseInt(secs[1]) || 0) / 1000;
    }

    blocks.forEach(block => {
        const lines = block.split('\n');
        if (lines.length >= 3) {
            // 두 번째 줄에서 시간대 매칭 ( --> 패턴 추출)
            const timeLine = lines[1];
            if (timeLine && timeLine.includes('-->')) {
                const times = timeLine.split('-->');
                // 시간 이후에 나오는 모든 줄을 하나의 자막 텍스트로 합치기
                const textLines = lines.slice(2).join(' ').trim();
                
                subs.push({
                    start: timeToSeconds(times[0]),
                    end: timeToSeconds(times[1]),
                    text: textLines
                });
            }
        }
    });

    return subs;
}

function getCurrentSubtitle() {
    if (parsedSubtitles.length === 0) return "";
    
    // 오디오의 실시간 재생 시간 타임스탬프 획득
    const currentTime = audioPlayer.currentTime;
    
    // 현재 시간에 걸쳐 있는 자막 블록 탐색
    const currentSub = parsedSubtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end);
    
    // 자막이 없는 구간일 때는 빈 문자열 대신 음악 감상 중 텍스트를 리턴하여 
    // 기존의 고정 디폴트 문구(MUSIC VISUAL STAGE)를 지워버리도록 처리
    return currentSub ? currentSub.text : "";
}
