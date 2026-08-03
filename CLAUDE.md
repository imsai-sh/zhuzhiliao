# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

竹知了 —— 传统玩具的 Web 模拟版（甩起来"哇哇"叫的竹筒玩具）。核心承诺：**零依赖、单文件、无构建**，用浏览器直开 `index.html` 即可玩（含 `file://`）。线上地址 <https://zhuzhiliao.imsai.cc>，页面走 Cloudflare Pages，`/api/*` 走 Worker。

## 开发流程和注意事项
- 禁止擅自push到远程oss
- 在独立branch/worktree开发完毕之后，将局域网可验证的https网址链接展示给用户审核(每个 worktree 用随机端口，否则会产生冲突)，审核通过后才能合并到main，然后deploy到cloudflare

## 常用命令

没有构建、lint、测试。开发即改 `index.html` 后刷新浏览器。

```bash
# 局域网试玩（手机连同一 Wi-Fi 访问 http://<电脑IP>:8123）
python3 -m http.server 8123

# 局域网 HTTPS（手机"甩手机"体感模式需要安全上下文才有 devicemotion）
python3 .claude/tls/serve-https.py        # 默认 8443，证书在 .claude/tls/，不进 git

# 校验 HarmonyOS 离线包中的共享 Web 资源
python3 harmonyos/tools/sync_web_assets.py --check

# 部署计数后端
cd worker && npx wrangler deploy
```

## 架构

四块代码，边界清晰：

### `index.html`（~1350 行，主体）

单文件包含全部 HTML/CSS/JS，按注释分节：**物理 → 声音 → 视觉特效粒子 → 绘制 → 主循环 & 交互 → 计数**。

- **物理是唯一事实源**：竹筒是绳系质点（重力 + 只拉不推的弹性绳 + 空气阻力），1/240s 定步长积分。发声核心变量是绳方向角速度，声音、2D 绘制、3D 层都只消费物理状态。
- **声音**：主音源是内嵌 base64 AAC 真实录音采样（变量 `ZZL_SAMPLE`，无缝循环，回放速率随转速），解码失败回退纯 Web Audio 合成链。音频初始化受 user activation 规则约束（首次触摸/点击时解锁）；有僵尸 AudioContext 心跳检测与重建（后台切回失声问题）。
- **计数**：本地先累计，1.2s 批量走 WebSocket 上报；页面关闭 `sendBeacon` 兜底；断线指数退避重连。个人哇数只存 localStorage。

### `3d/`（可选 WebGL 渲染层）

主站通过动态 `import('./3d/boot3d.js')` 在 2D 画布上叠一层透明 WebGL。**物理、声音、计数全部留在主站**，3D 层只是每帧接收物理状态摆位姿。

- `boot3d.js`：`init(canvas)` 返回 `{resize, render, clear, dispose}`，失败返回 `null`；`file://` 直开或 WebGL 不可用时 import/init 静默失败，主站自动回落 2D 手绘小蝉——**这个回落链不能破**。
- `model.js`：纯代码程序化 Three.js 模型（Canvas 2D 生成贴图，无外部网格/贴图资源），比例按实物三视图测量，以筒身高为 1 单位。
- `vendor/`：three.js 与 OrbitControls 直接 vendor 进仓库（importmap 映射 `three`），不走 npm。

### `worker/`（Cloudflare Worker 计数后端）

单文件 `worker/src/index.js`：一个 Worker + 单实例 SQLite Durable Object `Counter` 承载全站计数与实时推送。

- **WebSocket Hibernation API**：挂机连接休眠零费用，心跳 ping/pong 由 `setWebSocketAutoResponse` 运行时自动应答不唤醒 DO。
- **成本控制**：计数内存自增、350ms 合并广播、2s 合并落盘（SQLite 行写入有免费额度限制）——改计数逻辑时保持这套合并策略。
- **防刷**：文件头部一组常量（单条消息哇数上限、单连接滑动窗口限速、并发连接上限、按 IP 频控），调参改常量即可。
- 路由配置在 `worker/wrangler.jsonc`（zone route `zhuzhiliao.imsai.cc/api/*`）。

### `harmonyos/`（HarmonyOS 离线应用）

独立的 DevEco Studio Stage 工程，用 ArkWeb 从 `entry/src/main/resources/rawfile/web/` 加载离线网页。
ArkTS 只负责沉浸式窗口、安全区、URL 拦截和原生加速度计桥接；物理、声音与绘制仍由网页实现。
该目录不改变根目录 Web 版的零依赖、零构建约束。
离线页相对 Web 主站的分叉记录在 `harmonyos/WEB_SNAPSHOT.md`；修改根目录 `3d/` 共享资源后，
用 `python3 harmonyos/tools/sync_web_assets.py --write` 同步并重新运行烟测。

## 约束

- **Web 主站不引入任何构建步骤或 npm 依赖**：新资源要么内嵌（base64）、要么 vendor 进仓库、要么走可静默失败的动态 import；`harmonyos/` 的 DevEco 构建保持在独立目录内。
- **移动端优先**：改交互/布局时注意安全区适配、多点触控互斥、触屏锚点上移、绳长随屏幕缩放这些已有处理。
- 修改 3D 层时保持接口不变（主站只认 `init` 返回的四个方法），且任何失败都必须静默回落 2D。
- README.md 详细记录了发声原理、采样制作方式、物理模型和后端同步策略，改相关行为时同步更新。
