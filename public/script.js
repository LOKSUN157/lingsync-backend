// server.js — Whisper 在线语音识别最终版（v4.2）
// ===================================================
// ✅ 运行前请确保已设置环境变量：export OPENAI_API_KEY="你的OpenAI密钥"
// ✅ 安装依赖：npm install express cors body-parser openai

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { Readable } from "stream";
import OpenAI from "openai";

const app = express();
const port = 3001;

// ====================
// 中间件
// ====================
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" })); // 支持大音频Base64数据

// ====================
// 初始化 OpenAI 客户端
// ====================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ====================
// /api/transcribe — 在线语音识别接口
// ====================
app.post("/api/transcribe", async (req, res) => {
  try {
    console.log("🎧 Received audio data for online transcription...");

    // 1️⃣ 获取前端传来的 Base64 编码音频
    const base64Audio = req.body.audio;
    if (!base64Audio || typeof base64Audio !== "string") {
      return res.status(400).json({ error: "Missing or invalid audio data." });
    }

    // 2️⃣ 去除前缀 (例如 data:audio/webm;base64,)
    const cleanedBase64 = base64Audio.replace(/^data:audio\/\w+;base64,/, "");

    // 3️⃣ 转换为 Buffer
    const audioBuffer = Buffer.from(cleanedBase64, "base64");

    // 4️⃣ 将 Buffer 转换为可读流（不落地文件）
    const audioStream = new Readable();
    audioStream.push(audioBuffer);
    audioStream.push(null);
    // 关键：为 Whisper 提供 filename 信息，以便识别文件类型
    audioStream.path = "audio.webm";

    console.log("🚀 Sending in-memory audio stream to Whisper...");

    // 5️⃣ 调用 OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: "whisper-1",
      language: "ru", // 指定为俄语，提高识别准确性
    });

    // 6️⃣ 提取识别结果
    const resultText = transcription.text?.trim() || "(未识别到语音内容)";
    console.log("✅ Whisper Transcription Result:", resultText);

    // 7️⃣ 返回结果
    res.json({ text: resultText });
  } catch (error) {
    console.error("❌ Transcription error:", error);
    res.status(500).json({
      error: "Failed to transcribe audio.",
      details: error.message || error.toString(),
    });
  }
});

// ====================
// 示例翻译API（保持不变）
// ====================
app.post("/api/translate", async (req, res) => {
  console.log("🌐 Received translation request:", req.body.text);
  res.json({ translation: "您好，这是一段测试文本。" });
});

// ====================
// 启动服务器
// ====================
app.listen(port, () => {
  console.log(`✅ LingSync backend running on http://localhost:${port}`);
});
