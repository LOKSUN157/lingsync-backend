// ==============================
// LingSync 前端逻辑（v4.2 稳定版）
// ==============================

document.addEventListener("DOMContentLoaded", () => {
  // === 获取DOM元素 ===
  const startButton = document.getElementById("start-button");
  const translationOutput = document.getElementById("translation-output");
  const synthesisOutput = document.getElementById("synthesis-output");
  const playButton = document.getElementById("play-button");

  // === 开始按钮点击事件 ===
  startButton.addEventListener("click", async () => {
    try {
      startButton.disabled = true;
      startButton.textContent = "处理中...";
      translationOutput.textContent = "🎧 正在识别与翻译...";
      synthesisOutput.textContent = "";

      // （此处暂用模拟音频数据；后续前端可替换为真实Base64音频）
      const mockAudioData = "data:audio/webm;base64,GkXfo59ChoEBQv...";

      // 1️⃣ 向后端发送音频识别请求
      const transcribeResponse = await fetch(
        "http://localhost:3001/api/transcribe",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: mockAudioData }),
        }
      );

      if (!transcribeResponse.ok) throw new Error("语音识别请求失败");
      const transcribeData = await transcribeResponse.json();
      const russianText = transcribeData.text || "（无识别结果）";

      // 2️⃣ 请求翻译API
      const translateResponse = await fetch(
        "http://localhost:3001/api/translate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: russianText }),
        }
      );

      if (!translateResponse.ok) throw new Error("翻译请求失败");
      const translateData = await translateResponse.json();
      const chineseText = translateData.translation || "（翻译失败）";

      // 3️⃣ 更新界面
      translationOutput.textContent = chineseText;
      synthesisOutput.textContent = russianText;
    } catch (error) {
      console.error("❌ 处理过程中发生错误:", error);
      translationOutput.textContent = "⚠️ 处理出错，请检查终端日志并重试。";
    } finally {
      startButton.disabled = false;
      startButton.textContent = "开始传译";
    }
  });

  // === 播放按钮事件（仅演示） ===
  playButton.addEventListener("click", () => {
    const textToPlay = synthesisOutput.textContent;
    if (textToPlay && textToPlay.trim() !== "（等待生成...）") {
      alert(`🔊 正在播放（模拟）: "${textToPlay}"`);
    } else {
      alert("⚠️ 当前没有可播放的内容。");
    }
  });
});
