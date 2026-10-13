# ToonLab

**AI-driven character animation experiments · AI 驱动的动画角色实验**

Production target: https://toonlab.verinasci.com

## 首版链路

点击 Start ToonLab → Azure Speech 合成固定介绍 → 用户在本地保存 OpenRouter Key → Worker 请求大模型 → Azure Speech 合成回复 → TalkingHead 同步播放音频和口型。

使用 **Azure Speech 官方免费 F0 资源**，默认 `en-US-AriaNeural`，不使用 Edge Read Aloud。用户无需提供 TTS Key；项目维护者配置 Azure 资源。当前实验保留英语输出。

## 语音与口型架构

- Worker `POST /api/tts/token` 使用资源密钥向 Azure STS 换取短期令牌（有效期 10 分钟）。响应 `no-store`；浏览器只在一次合成的内存中使用令牌。
- 浏览器使用打包的 Microsoft Speech SDK，订阅 `visemeReceived`，同时接收 WAV 音频和 Azure 原生 Viseme ID / audioOffset。
- 100 ns 时间单位转换为毫秒；22 个 Azure Viseme 映射到 TalkingHead 的 Oculus 嘴形。双元音使用代表嘴形，属于角色绑定映射的近似，不是单词内部时间推算。
- SDK 禁用自行播放音频，TalkingHead 统一控制音频与嘴形，避免双重播放。静音事件用于结束前一个嘴形。
- 缺少原生 Viseme 时明确失败，不回退到根据英文单词推算口型。
- 文本分段至 460 字符，每段上限 500；合成超时 30 秒、音频上限 2 MB；成功、失败、取消结果、超时均关闭 synthesizer。
- P0 仍为每段合成完再播放，尚未实现流式低延迟对话。

## Azure 免费资源配置

在 Azure Portal 创建 **Speech** 资源，定价层选择 **Free F0**（不是 S0）。官方定价目前为神经 TTS 每月免费 50 万字符；F0 的额度和并发受平台限制，额度耗尽时应报错，不自动升级付费。

代码调用同一官方 API，不能从资源 Key 推断 F0 / S0；免费属性由 Azure 资源的定价层决定。

本地：复制 `.dev.vars.example` 为 `.dev.vars`，填写资源的 Key 和 Region，文件不会提交 git。

生产：

```bash
npx wrangler secret put AZURE_SPEECH_KEY
npx wrangler secret put AZURE_SPEECH_REGION
npm run deploy
```

Region 必须是资源的区域标识（例如 `eastasia`），不是 URL。资源密钥仅保存在 Worker Secret，不放入前端、Vite 环境变量、仓库或 localStorage。

令牌具备临时访问资源的权限。此 P0 的令牌端点面向站点访问者开放；Origin 检查不等同于认证，令牌可在到期前被站外复用，浏览器文本长度限制也不是资源级限额。公开实验使用专用 F0 资源；后续需要严格用户配额时，再加认证与访问控制。

## OpenRouter Key 安全边界

- 用户 Key 仅存浏览器 localStorage，可修改或清除。
- Key 只发送至 `/api/chat`，Worker 只用于对应 OpenRouter 请求。
- `/api/tts/token` 不发送或转发 OpenRouter Key；Azure 资源密钥不返回浏览器。
- 不记录、持久化或缓存令牌和语音；前端依赖通过本地构建打包。
- 无 D1、KV、R2、Queues、DO 或用户 Key 服务端存储。

## 开发与验证

Node.js 22+。

```bash
npm ci
npm run dev
npm run check
```

`dev:web` 仅启动前端，令牌及聊天 API 需要 Worker。`check` 包含令牌隔离、Viseme 映射、SDK 清理与错误测试、Vite 构建和 Worker dry-run。

Mock 测试不代表真实 Azure 合成或浏览器口型已验收。配置 F0 资源后检查固定介绍、模型回复、闭唇/圆唇、停顿收口、移动端音频激活，以及额度/网络错误。

GitHub Actions 提供手动部署，需配置 `CLOUDFLARE_API_TOKEN`；Azure 两项 Worker Secret 需事先配置。

## 官方参考

- [Azure Speech 免费定价](https://azure.microsoft.com/en-us/pricing/details/speech/)
- [STS Token](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech#how-to-get-an-sts-access-token)
- [原生 Viseme](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme)

## 技术栈与许可

Vite · Cloudflare Workers + Static Assets · Microsoft Speech SDK · TalkingHead · Three.js · OpenRouter。

初始角色为可替换参考模型。MIT。
