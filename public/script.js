// 等待页面加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    // 获取DOM元素
    const startButton = document.getElementById('start-button');
    const translationOutput = document.getElementById('translation-output');
    const synthesisOutput = document.getElementById('synthesis-output');
    const playButton = document.getElementById('play-button');

    // 为开始按钮添加点击事件监听
    startButton.addEventListener('click', async () => {
        try {
            // 禁用按钮，防止重复点击
            startButton.disabled = true;
            startButton.textContent = '处理中...';
            translationOutput.textContent = '正在识别与翻译...';
            synthesisOutput.textContent = '';


            // a. 发送语音识别请求
            console.log('开始语音识别...');
            const transcribeResponse = await fetch('http://localhost:3001/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio: "mock_audio_data" }) // 模拟发送音频数据
            });

            if (!transcribeResponse.ok) {
                throw new Error('语音识别请求失败');
            }

            const transcribeData = await transcribeResponse.json(); // <<< 修正#1：获取完整的JSON对象
            const russianText = transcribeData.text;              // <<< 修正#2：从对象中“解包”出真正的文本
            console.log('语音识别结果:', russianText);

            // b. 发送翻译请求
            console.log('开始翻译...');
            const translateResponse = await fetch('http://localhost:3001/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: russianText }) // <<< 现在我们发送的是正确的文本
            });

            if (!translateResponse.ok) {
                throw new Error('翻译请求失败');
            }

            const translateData = await translateResponse.json();     // <<< 修正#3：获取完整的翻译JSON对象
            const chineseText = translateData.translation;          // <<< 修正#4：从对象中“解包”出真正的翻译文本
            console.log('翻译结果:', chineseText);

            // c. 更新翻译输出区域
            translationOutput.textContent = chineseText; // <<< 现在我们显示的是正确的文本

            // d. 更新合成输出区域
            synthesisOutput.textContent = russianText; // <<< 现在我们显示的是正确的文本

        } catch (error) {
            console.error('处理过程中发生错误:', error);
            translationOutput.textContent = '处理出错，请检查终端日志并重试';
            synthesisOutput.textContent = '';
        } finally {
            // 恢复按钮状态
            startButton.disabled = false;
            startButton.textContent = '开始传译';
        }
    });

    // 为播放按钮添加点击事件（预留）
    playButton.addEventListener('click', () => {
        const textToPlay = synthesisOutput.textContent;
        if (textToPlay) {
            console.log('正在播放:', textToPlay);
            alert(`正在播放（模拟）: "${textToPlay}"`);
        } else {
            alert('没有可播放的内容。');
        }
    });
});

```
---
