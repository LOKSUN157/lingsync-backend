// ============================================================
// script.js — LingSync 前端逻辑（最终修正版）
// ============================================================

// ====【统一API地址定义】====
const API_BASE_URL = "http://localhost:3000"; // <<< 修正：更新端口号为3000

// ====【全局变量定义】====
let mediaRecorder;
let audioChunks = [];
let ws; // WebSocket连接对象

// ====【WebSocket连接初始化函数】====
function initWebSocket() {
  ws = new WebSocket("ws://localhost:3000"); // <<< 修正：更新端口号为3000

  ws.onopen = () => {
    console.log("✅ 已连接至 WebSocket 服务器");
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.transcript) {
      const output = document.getElementById("transcript");
      output.textContent = data.transcript; // 实时更新识别结果
    }
  };

  ws.onclose = () => {
    console.log("❌ WebSocket连接已关闭");
  };

  ws.onerror = (err) => {
    console.error("🚨 WebSocket错误：", err);
  };
}

// ====【开始录音函数】====
async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioChunks = [];
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
      // 将音频片段以ArrayBuffer形式发送给后端
      event.data.arrayBuffer().then((buffer) => {
        ws.send(buffer);
      });
    }
  };

  mediaRecorder.start(250); // 每250ms发送一个音频片段
  console.log("🎙️ 录音开始，实时传输中...");
}

// ====【停止录音函数】====
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    console.log("🛑 录音已停止");
  }
}

// ====【一次性上传录音（备用功能）】====
async function uploadAudio(blob) {
  const formData = new FormData();
  formData.append("audio", blob, "recording.wav");

  // 使用统一的 API_BASE_URL 构建 URL
  const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
    // <<< 修正：更新端口号为3000
    method: "POST",
    body: formData,
  });

  const result = await response.json();
  document.getElementById("transcript").textContent = result.text;
}

// ====【事件绑定】====
document.getElementById("startBtn").addEventListener("click", () => {
  initWebSocket();
  startRecording();
});

document.getElementById("stopBtn").addEventListener("click", () => {
  stopRecording();
});
