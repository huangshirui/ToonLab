# ToonLab

**AI-driven character animation experiments · AI 驱动的动画角色实验**

Production target: https://toonlab.verinasci.com

## 首版链路

点击 Start ToonLab → Azure Speech 合成固定介绍 → 用户使用 Demo Code 或自己的 OpenRouter Key → Worker 请求大模型 → Azure Speech 合成回复 → TalkingHead 同步播放音频和口型。

页面为单屏响应式布局：Desktop 左侧角色、右侧交互；Mobile 角色全屏，Conversation / Settings 收在底部抽屉。角色说话时 Mobile 抽屉自动收起，用户仍可手动展开。回复文本以角色底部单行字幕显示。

使用 **Azure Speech 官方免费 F0 资源**，默认 `en-US-AriaNeural`，不使用 Edge Read Aloud。用户无需提供 TTS Key；项目维护者配置 Azure 资源。当前可在页面切换 Aria、Jenny、Guy、Davis 四个 en-US Neural voice，当前实验保留英语输出。

OpenRouter 模型可直接输入 model id，默认 `openrouter/auto`。角色选择已作为设置项抽出，目前只有随站点部署的 `MPFB Demo`，便于后续继续增加角色 renderer / asset。

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

## OpenRouter 访问与 Demo Code

页面提供互斥的两种 OpenRouter 访问方式：

- **API key**：用户自己的 Key，仅存浏览器 localStorage；请求时以 Bearer token 发送给 ToonLab Worker，再由 Worker 转发给 OpenRouter。
- **Demo code**：用户只输入共享 Demo Code；Worker 校验成功后使用 Worker Secret 中的 OpenRouter Demo API Key。Demo API Key 永远不会返回浏览器。

Demo 模式需要在本地 `.dev.vars` 或生产 Worker Secrets 同时配置：

```bash
npx wrangler secret put DEMO_CODE
npx wrangler secret put OPENROUTER_DEMO_API_KEY
```

两种凭证不会在同一请求中同时使用；Worker 也会拒绝同时携带两种凭证的请求。Demo Code 适合实验访问，不应视为用户级认证或配额系统。

## OpenRouter / Speech 安全边界

- 用户 OpenRouter Key 与 Demo Code 仅存浏览器 localStorage，可修改或清除。
- OpenRouter 凭证只发送至 `/api/chat`；`/api/tts/token` 不发送或转发 OpenRouter 凭证。
- Azure 资源密钥与 OpenRouter Demo API Key 只保存在 Worker Secret，不返回浏览器。
- 不记录、持久化或缓存令牌和语音；前端依赖通过本地构建打包。
- 无 D1、KV、R2、Queues、DO 或用户 Key 服务端存储。

## 开发与验证

Node.js 22+。

```bash
npm ci
npm run dev
npm run check
```

`dev:web` 仅启动前端，令牌及聊天 API 需要 Worker。`check` 包含 OpenRouter 两种鉴权、令牌隔离、Viseme 映射、SDK 清理与错误测试、Vite 构建和 Worker dry-run。

Mock 测试不代表真实 Azure 合成或浏览器口型已验收。配置 F0 资源后检查固定介绍、模型回复、闭唇/圆唇、停顿收口、移动端音频激活，以及额度/网络错误。

GitHub Actions 提供手动部署，需在仓库 Settings → Secrets and variables → Actions 配置两个 repository secrets：`CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。Account ID 填管理 `verinasci.com` 的 Cloudflare 账号 ID。Azure 与可选 Demo Code/OpenRouter Demo Key 等 Worker Secret 需事先配置在 Cloudflare Worker。

## 官方参考

- [Azure Speech 免费定价](https://azure.microsoft.com/en-us/pricing/details/speech/)
- [STS Token](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech#how-to-get-an-sts-access-token)
- [原生 Viseme](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme)

## 技术栈与许可

Vite · Cloudflare Workers + Static Assets · Microsoft Speech SDK · TalkingHead · Three.js · OpenRouter。

初始角色使用 TalkingHead 的 MPFB 示例（CC0），随站点部署，不依赖浏览器访问 Ready Player Me。构建从固定上游提交下载模型并校验 SHA-256，拆分为同源 glTF、几何和贴图，保留骨架和所有口型形变；每个文件低于 Workers 25 MiB 限制。模型总下载约 37 MB，首次加载仍需要时间。构建机器需能访问 GitHub，缓存目录不入库。来源与许可见 `public/avatars/NOTICE.md`。

项目代码 MIT；示例模型 CC0。
