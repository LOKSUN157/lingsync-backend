// server.js — 终极健壮版本
import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";

// ESM模块中的__dirname计算（双重验证）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = http.createServer(app);

// ===== 🔥 关键修复1：显式favicon路由（最高优先级） =====
// 这些路由必须在 express.static 之前声明
app.get("/favicon.ico", (req, res) => {
  const faviconPath = path.join(__dirname, "public", "favicon.ico");

  // 调试日志
  console.log("🎯 [FAVICON请求] 路径:", faviconPath);
  console.log("📁 [文件存在?]", fs.existsSync(faviconPath));

  if (fs.existsSync(faviconPath)) {
    res.setHeader("Content-Type", "image/x-icon");
    res.setHeader("Cache-Control", "public, max-age=86400"); // 缓存1天
    res.sendFile(faviconPath);
  } else {
    console.error("❌ [错误] favicon.ico 文件不存在！");
    res.status(404).send("Favicon not found");
  }
});

app.get("/favicon.png", (req, res) => {
  const faviconPath = path.join(__dirname, "public", "favicon.png");

  console.log("🎯 [FAVICON-PNG请求] 路径:", faviconPath);
  console.log("📁 [文件存在?]", fs.existsSync(faviconPath));

  if (fs.existsSync(faviconPath)) {
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(faviconPath);
  } else {
    console.error("❌ [错误] favicon.png 文件不存在！");
    res.status(404).send("Favicon PNG not found");
  }
});

// ===== 🔥 关键修复2：调试端点 =====
app.get("/debug/favicon", (req, res) => {
  const publicPath = path.join(__dirname, "public");
  const icoPath = path.join(publicPath, "favicon.ico");
  const pngPath = path.join(publicPath, "favicon.png");

  res.json({
    timestamp: new Date().toISOString(),
    paths: {
      __dirname,
      publicFolder: publicPath,
      faviconIco: icoPath,
      faviconPng: pngPath,
    },
    fileStatus: {
      "favicon.ico存在": fs.existsSync(icoPath),
      "favicon.png存在": fs.existsSync(pngPath),
      public文件夹存在: fs.existsSync(publicPath),
    },
    publicFolderContents: fs.existsSync(publicPath)
      ? fs.readdirSync(publicPath)
      : "文件夹不存在",
  });
});

// ===== 静态文件服务（在favicon路由之后） =====
app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders: (res, filePath) => {
      // 为所有静态文件设置正确的MIME类型
      if (filePath.endsWith(".ico")) {
        res.setHeader("Content-Type", "image/x-icon");
      } else if (filePath.endsWith(".png")) {
        res.setHeader("Content-Type", "image/png");
      }
    },
  })
);

// ===== WebSocket服务器 =====
const wss = new WebSocketServer({ server });

// ... (您的WebSocket逻辑保持不变) ...

// ===== 服务器启动 =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 服务器运行中：http://localhost:${PORT}`);
  console.log(`🔍 调试端点：http://localhost:${PORT}/debug/favicon`);
  console.log(`📁 Public目录：${path.join(__dirname, "public")}`);
});
