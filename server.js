// ============================================================
// server.js  — LingSync 实时语音识别项目 后端总装版
// ============================================================

// ====【引入核心模块】====
import express from "express";
import bodyParser from "body-parser";
import { WebSocketServer } from "ws";
import http from "http";
import path from "path"; // <<< 引入GPS模块
import { fileURLToPath } from "url"; // <<< 引入GPS模块

// ====【文件路径初始化】====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====【创建Express应用与HTTP服务器】====
const app = express();
const server = http.createServer(app);

// ====【中间件配置】====
app.use(bodyParser.json({ limit: "10mb" }));

// ====【最终总装：增加静态文件服务】====
app.use(express.static(path.join(__dirname, "public"))); // <<< 最终总装：增加静态文件服务

// ====【创建 WebSocket 服务器】====
const wss = new WebSocketServer({ server });

// ====【可选：加载环境变量 (Deepgram API Key等)】====
import dotenv from "dotenv";
dotenv.config();

// ====【Deepgram 流式ASR配置】====
import WebSocket from "ws";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const DEEPGRAM_REALTIME_URL = "wss://api.deepgram.com/v1/listen"; // Deepgram实时接口地址

// ============================================================
// 【核心逻辑】：前端 ↔ Node中继 ↔ Deepgram 实时语音识别
// ============================================================

wss.on("connection", async (wsClient) => {
  console.log("✅ 新前端连接已建立");

  // === 建立与 Deepgram 的 WebSocket 连接 ===
  const dgWs = new WebSocket(DEEPGRAM_REALTIME_URL, {
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
  });

  dgWs.on("open", () => {
    console.log("🔗 已连接 Deepgram 实时识别服务");
  });

  // === 当前端发送音频数据帧 ===
  wsClient.on("message", (data) => {
    if (dgWs.readyState === WebSocket.OPEN) {
      dgWs.send(data); // 将音频数据直接中继到Deepgram
    }
  });

  // === 当 Deepgram 返回识别结果 ===
  dgWs.on("message", (msg) => {
    try {
      const res = JSON.parse(msg);
      if (res.channel?.alternatives?.[0]?.transcript) {
        const transcript = res.channel.alternatives[0].transcript;
        wsClient.send(JSON.stringify({ transcript }));
      }
    } catch (err) {
      console.error("⚠️ Deepgram响应解析失败：", err);
    }
  });

  // === 双向关闭管理 ===
  wsClient.on("close", () => {
    console.log("❌ 前端断开连接");
    dgWs.close();
  });

  dgWs.on("close", () => {
    console.log("🔒 Deepgram连接已关闭");
  });

  dgWs.on("error", (err) => {
    console.error("🚨 Deepgram连接错误：", err);
  });
});

// ============================================================
// 【启动服务器】
// ============================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 服务器运行中：http://localhost:${PORT}`);
  console.log(`📁 正在服务静态文件：${path.join(__dirname, "public")}`);
});
