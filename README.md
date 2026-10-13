# ToonLab

**AI-driven character animation experiments · AI 驱动的动画角色实验**

Production target: https://toonlab.verinasci.com

## 首版链路

点击 Start ToonLab → Azure Speech 合成固定介绍 → 用户使用 Demo Code 或自己的 OpenRouter Key → Worker 请求大模型 → Azure Speech 合成回复 → TalkingHead 同步播放音频和口型。

页面为单屏响应式布局：Desktop 左侧角色、右侧交互；Mobile 角色全屏，Conversation / Settings 收在底部抽屉。角色说话时 Mobile 抽屉自动收起，用户仍可手动展开。回复文本以角色底部单行字幕显示，并按 TTS word-boundary 时间随发音推进。

角色资源会在页面打开后异步预加载；首次加载和后续切换角色都使用角色区域内的统一加载状态。角色切换期间整个 Settings / Conversation 控制区会暂时锁定，避免在加载或回滚期间产生并发状态。浏览器音频仍在首次用户交互时激活，以符合自动播放限制。

如果浏览器已经保存 Demo Code 或 OpenRouter API Key，则跳过首次 Start 引导并直接进入 Conversation；如果没有凭证，首次介绍结束后自动进入 Settings → OpenRouter access，并聚焦当前凭证输入框。

使用 **Azure Speech 官方免费 F0 资源**，默认 `en-US-AriaNeural`，不使用 Edge Read Aloud。用户无需提供 TTS Key；项目维护者配置 Azure 资源。当前可在页面切换 Aria、Jenny、Guy、Sara 四个 en-US Neural voice，当前实验保留英语输出。TalkingHead 播放链统一使用 speech gain 提升语音响度。

OpenRouter 模型可直接输入 model id，默认 `openrouter/free`。Conversation 页面不展示具体模型名称；模型只在 Settings 中配置。

角色设置在 Settings 中只显示当前角色和 Change。点击 Change 打开 Character Picker，先选择 Renderer，再查看和选择该 Renderer 下的角色。当前 Renderer 只有 `TalkingHead`；数据模型已将 `character` 与 `renderer` 分开保存，为后续增加其他 renderer（例如 Live2D）预留接口。

TalkingHead 当前上游仓库提供的 5 类示例角色都已加入 ToonLab：

- MPFB
- Ready Player Me
- Avaturn
- AvatarSDK / MetaPerson
- VRoid

`brunette-t.glb` 只是 Ready Player Me 示例的另一参考姿态，不作为独立角色。

角色资产、角色 preset 和 TalkingHead 浏览器 runtime **锁定到同一个上游 commit** `2afe6d79779313db8909badebf46f9805a6c7b70`。构建时分别下载并校验 Git blob hash，再由 ToonLab 打包或同源提供。这样 Avaturn / AvatarSDK 使用的骨骼 retarget、MPFB / VRoid 的 dynamic-bones 配置与实际 runtime 保持一致，不依赖浏览器运行时访问第三方角色域名，也不受 npm 已发布版本与上游角色样例不同步的影响。

## 语音与口型架构

- Worker `POST /api/tts/token` 使用资源密钥向 Azure STS 换取短期令牌（有效期 10 分钟）。响应 `no-store`；浏览器只在一次合成的内存中使用令牌。
- 浏览器使用打包的 Microsoft Speech SDK，订阅 `visemeReceived` 与 `wordBoundary`，同时接收 WAV 音频、Viseme ID / audioOffset 和字幕词边界。
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

`dev:web` 仅启动前端，令牌及聊天 API 需要 Worker。构建与测试会先准备并校验 pinned TalkingHead runtime；角色资产同样按固定上游 commit 准备。`check` 包含 OpenRouter 两种鉴权、默认模型、角色 registry / preset、runtime 锁定、令牌隔离、Viseme/字幕时间映射、SDK 清理与错误测试、Vite 构建和 Worker dry-run。

Mock 测试不代表真实 Azure 合成或浏览器动画已验收。配置 F0 资源后应逐个验证五个角色的加载、待机、说话、姿态切换、手臂/头发等骨骼表现，以及固定介绍、模型回复、闭唇/圆唇、停顿收口和移动端音频激活。

GitHub Actions 提供手动部署，需在仓库 Settings → Secrets and variables → Actions 配置两个 repository secrets：`CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。Account ID 填管理 `verinasci.com` 的 Cloudflare 账号 ID。Azure 与可选 Demo Code/OpenRouter Demo Key 等 Worker Secret 需事先配置在 Cloudflare Worker。

## 官方参考

- [Azure Speech 免费定价](https://azure.microsoft.com/en-us/pricing/details/speech/)
- [STS Token](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech#how-to-get-an-sts-access-token)
- [原生 Viseme](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme)

## 技术栈与许可

Vite · Cloudflare Workers + Static Assets · Microsoft Speech SDK · TalkingHead · Three.js · OpenRouter。

角色来源与各自许可见 `public/avatars/NOTICE.md`。MPFB 示例为 CC0；Ready Player Me、Avaturn、AvatarSDK 与 VRoid 上游示例带有非商业使用限制或单独条款，因此 ToonLab 仅将它们用于实验验证，商业部署前必须重新核对并替换不适用资产。

项目代码 MIT；角色资产按各自来源许可使用。
