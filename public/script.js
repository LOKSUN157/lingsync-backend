// ============================================
// LingSync 实时语音识别系统 - 前端核心逻辑
// 版本：2.0 (完全重构版)
// 架构：WebSocket + MediaRecorder 流式处理
// ============================================

class LingSyncClient {
  constructor() {
    // ===== 核心组件 =====
    this.ws = null; // WebSocket连接
    this.mediaRecorder = null; // 媒体录制器
    this.audioStream = null; // 音频流

    // ===== 状态管理 =====
    this.isRecording = false; // 录音状态
    this.isConnected = false; // WebSocket连接状态
    this.isMicAuthorized = false; // 麦克风授权状态

    // ===== DOM元素缓存 =====
    this.elements = {
      startBtn: document.getElementById("startRecordingBtn"),
      stopBtn: document.getElementById("stopRecordingBtn"),
      transcriptOutput: document.getElementById("transcriptOutput"),
      clearBtn: document.getElementById("clearTranscriptBtn"),
      wsStatus: document.getElementById("wsStatus"),
      recordStatus: document.getElementById("recordStatus"),
      micStatus: document.getElementById("micStatus"),
      errorMessage: document.getElementById("errorMessage"),
    };

    // ===== 配置参数 =====
    this.config = {
      wsUrl: `ws://${window.location.hostname}:${window.location.port || 3000}`,
      audioTimeslice: 250, // 音频切片时间间隔（毫秒）
      audioMimeType: "audio/webm", // 音频格式
      reconnectDelay: 3000, // 重连延迟
      maxReconnectAttempts: 5, // 最大重连次数
    };

    this.reconnectAttempts = 0; // 当前重连次数

    // 初始化
    this.init();
  }

  // ==========================================
  // 初始化方法
  // ==========================================
  init() {
    console.log("🚀 LingSync客户端初始化中...");

    // 绑定事件监听器
    this.bindEvents();

    // 请求麦克风权限（提前请求，优化用户体验）
    this.requestMicrophonePermission();

    console.log("✅ LingSync客户端初始化完成");
  }

  // ==========================================
  // 事件绑定
  // ==========================================
  bindEvents() {
    // 开始录音按钮
    this.elements.startBtn.addEventListener("click", () => {
      this.startRecording();
    });

    // 停止录音按钮
    this.elements.stopBtn.addEventListener("click", () => {
      this.stopRecording();
    });

    // 清空字幕按钮
    this.elements.clearBtn.addEventListener("click", () => {
      this.clearTranscript();
    });

    // 页面关闭时清理资源
    window.addEventListener("beforeunload", () => {
      this.cleanup();
    });
  }

  // ==========================================
  // 麦克风权限请求
  // ==========================================
  async requestMicrophonePermission() {
    try {
      console.log("🎤 请求麦克风权限...");

      // 请求音频流（仅用于权限检查）
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true, // 回声消除
          noiseSuppression: true, // 噪音抑制
          autoGainControl: true, // 自动增益控制
        },
      });

      // 立即停止（不实际使用，只是检查权限）
      stream.getTracks().forEach((track) => track.stop());

      this.isMicAuthorized = true;
      this.updateMicStatus("已授权", "connected");
      console.log("✅ 麦克风权限已授予");
    } catch (error) {
      this.isMicAuthorized = false;
      this.updateMicStatus("未授权", "disconnected");
      console.error("❌ 麦克风权限被拒绝：", error);
      this.showError("麦克风权限被拒绝，请在浏览器设置中允许访问麦克风");
    }
  }

  // ==========================================
  // 开始录音
  // ==========================================
  async startRecording() {
    try {
      console.log("🎬 开始录音流程...");

      // 检查麦克风权限
      if (!this.isMicAuthorized) {
        await this.requestMicrophonePermission();
        if (!this.isMicAuthorized) {
          return;
        }
      }

      // 步骤1：建立WebSocket连接
      await this.connectWebSocket();

      // 步骤2：获取音频流
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.log("🎤 音频流已获取");

      // 步骤3：初始化MediaRecorder
      this.initMediaRecorder();

      // 步骤4：开始录制
      this.mediaRecorder.start(this.config.audioTimeslice);
      console.log(`🔴 录音已开始（切片间隔：${this.config.audioTimeslice}ms）`);

      // 更新状态
      this.isRecording = true;
      this.updateRecordStatus("录音中", "recording");
      this.updateButtonStates();
    } catch (error) {
      console.error("❌ 启动录音失败：", error);
      this.showError(`启动录音失败：${error.message}`);
      this.cleanup();
    }
  }

  // ==========================================
  // 停止录音
  // ==========================================
  stopRecording() {
    console.log("⏹️ 停止录音流程...");

    try {
      // 停止MediaRecorder
      if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
        this.mediaRecorder.stop();
        console.log("✅ MediaRecorder已停止");
      }

      // 停止音频流
      if (this.audioStream) {
        this.audioStream.getTracks().forEach((track) => {
          track.stop();
          console.log("✅ 音频轨道已停止");
        });
        this.audioStream = null;
      }

      // 关闭WebSocket
      if (this.ws) {
        this.ws.close();
        console.log("✅ WebSocket连接已关闭");
      }

      // 更新状态
      this.isRecording = false;
      this.updateRecordStatus("待机中", "idle");
      this.updateButtonStates();
    } catch (error) {
      console.error("❌ 停止录音时出错：", error);
      this.showError(`停止录音失败：${error.message}`);
    }
  }

  // ==========================================
  // WebSocket连接管理
  // ==========================================
  connectWebSocket() {
    return new Promise((resolve, reject) => {
      try {
        console.log(`🔗 正在连接到 ${this.config.wsUrl}...`);

        this.ws = new WebSocket(this.config.wsUrl);

        // 连接成功
        this.ws.onopen = () => {
          console.log("✅ WebSocket连接已建立");
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.updateWsStatus("已连接", "connected");
          resolve();
        };

        // 接收消息
        this.ws.onmessage = (event) => {
          this.handleWebSocketMessage(event);
        };

        // 连接关闭
        this.ws.onclose = (event) => {
          console.log("🔒 WebSocket连接已关闭", event);
          this.isConnected = false;
          this.updateWsStatus("未连接", "disconnected");

          // 如果是异常关闭且正在录音，尝试重连
          if (
            this.isRecording &&
            this.reconnectAttempts < this.config.maxReconnectAttempts
          ) {
            this.attemptReconnect();
          }
        };

        // 连接错误
        this.ws.onerror = (error) => {
          console.error("🚨 WebSocket连接错误：", error);
          this.updateWsStatus("错误", "disconnected");
          reject(new Error("WebSocket连接失败"));
        };
      } catch (error) {
        console.error("❌ 创建WebSocket时出错：", error);
        reject(error);
      }
    });
  }

  // ==========================================
  // WebSocket重连
  // ==========================================
  attemptReconnect() {
    this.reconnectAttempts++;
    console.log(
      `🔄 尝试重连 (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`
    );

    setTimeout(async () => {
      try {
        await this.connectWebSocket();
        console.log("✅ 重连成功");
      } catch (error) {
        console.error("❌ 重连失败：", error);
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
          this.showError("连接失败次数过多，已停止录音");
          this.stopRecording();
        }
      }
    }, this.config.reconnectDelay);
  }

  // ==========================================
  // 处理WebSocket消息
  // ==========================================
  handleWebSocketMessage(event) {
    try {
      const data = JSON.parse(event.data);
      console.log("📨 收到服务器消息：", data);

      // 检查是否包含转录文本
      if (
        data.channel &&
        data.channel.alternatives &&
        data.channel.alternatives.length > 0
      ) {
        const transcript = data.channel.alternatives[0].transcript;
        const isFinal = data.is_final || false;

        if (transcript && transcript.trim() !== "") {
          this.displayTranscript(transcript, isFinal);
        }
      }
    } catch (error) {
      console.error("❌ 解析WebSocket消息失败：", error);
    }
  }

  // ==========================================
  // MediaRecorder初始化
  // ==========================================
  initMediaRecorder() {
    try {
      // 检查浏览器支持的MIME类型
      let mimeType = this.config.audioMimeType;
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.warn(`⚠️ ${mimeType} 不支持，尝试其他格式...`);

        const alternatives = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/ogg;codecs=opus",
          "audio/mp4",
        ];

        for (const type of alternatives) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            console.log(`✅ 使用音频格式：${mimeType}`);
            break;
          }
        }
      }

      // 创建MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: mimeType,
      });

      // 数据可用时发送
      this.mediaRecorder.ondataavailable = (event) => {
        if (
          event.data.size > 0 &&
          this.ws &&
          this.ws.readyState === WebSocket.OPEN
        ) {
          this.ws.send(event.data);
          console.log(`📤 发送音频数据：${event.data.size} 字节`);
        }
      };

      // 录制停止
      this.mediaRecorder.onstop = () => {
        console.log("🛑 MediaRecorder已停止");
      };

      // 录制错误
      this.mediaRecorder.onerror = (error) => {
        console.error("🚨 MediaRecorder错误：", error);
        this.showError("录音过程中发生错误");
        this.stopRecording();
      };

      console.log("✅ MediaRecorder初始化完成");
    } catch (error) {
      console.error("❌ 初始化MediaRecorder失败：", error);
      throw error;
    }
  }

  // ==========================================
  // 显示转录文本
  // ==========================================
  displayTranscript(text, isFinal) {
    const timestamp = new Date().toLocaleTimeString("zh-CN");
    const finalClass = isFinal ? "final" : "";

    // 创建新的转录行
    const transcriptLine = document.createElement("div");
    transcriptLine.className = `transcript-line ${finalClass}`;
    transcriptLine.innerHTML = `
          <span class="transcript-timestamp">[${timestamp}]</span>
          <span>${text}</span>
      `;

    // 如果是临时结果，替换最后一行；如果是最终结果，添加新行
    if (!isFinal && this.elements.transcriptOutput.lastChild) {
      const lastChild = this.elements.transcriptOutput.lastChild;
      if (!lastChild.classList.contains("final")) {
        this.elements.transcriptOutput.removeChild(lastChild);
      }
    }

    this.elements.transcriptOutput.appendChild(transcriptLine);

    // 自动滚动到底部
    this.elements.transcriptOutput.scrollTop =
      this.elements.transcriptOutput.scrollHeight;

    console.log(`📝 显示转录文本 [${isFinal ? "最终" : "临时"}]：${text}`);
  }

  // ==========================================
  // 清空字幕
  // ==========================================
  clearTranscript() {
    this.elements.transcriptOutput.innerHTML = "";
    console.log("🗑️ 字幕已清空");
  }

  // ==========================================
  // UI状态更新方法
  // ==========================================
  updateWsStatus(text, className) {
    this.elements.wsStatus.textContent = text;
    this.elements.wsStatus.className = `status-value ${className}`;
  }

  updateRecordStatus(text, className) {
    this.elements.recordStatus.textContent = text;
    this.elements.recordStatus.className = `status-value ${className}`;
  }

  updateMicStatus(text, className) {
    this.elements.micStatus.textContent = text;
    this.elements.micStatus.className = `status-value ${className}`;
  }

  updateButtonStates() {
    this.elements.startBtn.disabled = this.isRecording;
    this.elements.stopBtn.disabled = !this.isRecording;
  }

  // ==========================================
  // 错误提示
  // ==========================================
  showError(message) {
    this.elements.errorMessage.textContent = `❌ ${message}`;
    this.elements.errorMessage.classList.add("show");

    // 5秒后自动隐藏
    setTimeout(() => {
      this.elements.errorMessage.classList.remove("show");
    }, 5000);
  }

  // ==========================================
  // 资源清理
  // ==========================================
  cleanup() {
    console.log("🧹 清理资源...");

    // 停止录音
    if (this.isRecording) {
      this.stopRecording();
    }

    // 关闭WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // 停止音频流
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }

    // 清理MediaRecorder
    this.mediaRecorder = null;

    console.log("✅ 资源清理完成");
  }
}

// ============================================
// 页面加载完成后初始化
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("📄 页面加载完成，初始化LingSync客户端...");

  // 创建全局实例
  window.lingSyncClient = new LingSyncClient();

  console.log("🎉 LingSync客户端已就绪！");
});
