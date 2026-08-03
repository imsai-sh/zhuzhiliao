# Web 离线快照维护

HarmonyOS HAP 必须在模块资源目录内直接包含运行时文件，因此不能通过跨目录符号链接复用仓库根目录的 Web 资源。
首次离线快照基于上游提交 `567508d35e1a91bb376e01e620c21587f3a3146a`。

## 共享资源

以下文件应与仓库根目录逐字节一致：

- `3d/boot3d.js`
- `3d/model.js`
- `3d/vendor/OrbitControls.js`
- `3d/vendor/three.module.min.js`

检查一致性：

```shell
python harmonyos/tools/sync_web_assets.py --check
```

根目录资源更新后同步：

```shell
python harmonyos/tools/sync_web_assets.py --write
```

## `index.html` 分叉

离线 `index.html` 是有意维护的应用专用入口，而不是根页面的完整镜像。它保留物理、声音、2D/3D 绘制，
并有以下差异：

- 移除 VibeCafé telemetry、Cloudflare WebSocket 统计、Beacon 上报、Service Worker 和 PWA 安装流程
- 不包含 PWA manifest 与 Apple touch icon；HarmonyOS 图标由 `AppScope/` 和模块资源提供
- 将在线计数改为仅保存在 `localStorage` 的本机计数
- 增加 `HarmonyMotion` 原生加速度计桥接、应用内关于页、沉浸式安全区与多端布局
- 外部 HTTP/HTTPS 导航由 ArkWeb 容器拦截，应用不声明网络权限

同步根页面的新功能时应手工移植到该入口，随后运行共享资源检查、Playwright 烟测和 HAP 构建。
