/**
 * 어떤 SRT 포맷(BOM, CRLF/LF, 쉼표/마침표 타임코드)도 100% 인식하는 강력한 SRT 파서
 */
function parseSRT(srtText) {
    if (!srtText) return [];

    // 1. UTF-8 BOM 제거 및 줄바꿈 정규화
    let cleanText = srtText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 2. 자막 블록 단위 분할
    const blocks = cleanText.trim().split(/\n\n+/);
    const parsedList = [];

    function timeToMs(tStr) {
        if (!tStr) return 0;
        tStr = tStr.trim().replace('.', ','); // 마침표를 쉼표로 자동 정규화
        const parts = tStr.split(':');
        let h = 0, m = 0, s = 0, ms = 0;

        if (parts.length === 3) {
            h = parseInt(parts[0], 10) || 0;
            m = parseInt(parts[1], 10) || 0;
            const secParts = parts[2].split(',');
            s = parseInt(secParts[0], 10) || 0;
            ms = parseInt(secParts[1], 10) || 0;
        }
        return h * 3600000 + m * 60000 + s * 1000 + ms;
    }

    blocks.forEach((block, index) => {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let timeLineIndex = lines.findIndex(l => l.includes('-->'));

        if (timeLineIndex !== -1) {
            const timeParts = lines[timeLineIndex].split('-->');
            const startMs = timeToMs(timeParts[0]);
            const endMs = timeToMs(timeParts[1]);
            const text = lines.slice(timeLineIndex + 1).join(' ');

            if (endMs > startMs && text.length > 0) {
                parsedList.push({ id: index + 1, start: startMs, end: endMs, text: text });
            }
        }
    });

    console.log(`✅ SRT 파싱 완료: 총 ${parsedList.length}개 자막 감지됨`, parsedList);
    return parsedList;
}

// SRT 파일 업로드 시 예외 처리 및 UI 피드백 강화
srtFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            subtitles = parseSRT(event.target.result);
            if (subtitles.length > 0) {
                totalDuration = subtitles[subtitles.length - 1].end + 1000;
                totalTimeEl.textContent = formatTime(totalDuration);
                subtitleCountInfo.textContent = `(자막 ${subtitles.length}개 로드 완료)`;
                
                statusMessage.style.display = 'none';
                btnPlay.disabled = false;
                btnExportWebM.disabled = false;

                // 첫 번째 자막 화면 즉시 프리뷰 렌더링
                drawFrame(subtitles[0].start);
            } else {
                throw new Error("자막 구문('-->')을 찾지 못했습니다.");
            }
        } catch (err) {
            console.error("❌ SRT 파일 파싱 오류:", err);
            statusMessage.style.display = 'block';
            statusMessage.style.color = '#ff6b6b';
            statusMessage.textContent = `⚠️ 오류: ${err.message}`;
            subtitleCountInfo.textContent = `(파싱 실패)`;
        }
    };
    reader.readAsText(file, 'utf-8');
});
