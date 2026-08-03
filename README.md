# 竹知了

一转就"哇哇"叫的传统玩具，Web 模拟版。零依赖单文件，手机优先。

**在线试玩：<https://zhuzhiliao.imsai.cc>**

[![Stars](https://img.shields.io/github/stars/imsai-sh/zhuzhiliao?style=social)](https://github.com/imsai-sh/zhuzhiliao/stargazers)
![玩法](https://img.shields.io/badge/%E7%8E%A9%E6%B3%95-%E6%8C%89%E4%BD%8F%E7%94%BB%E5%9C%88%E7%94%A9%E8%B5%B7%E6%9D%A5-e2603f)

> 甩两下要是听见了小时候那声"哇——哇——"，顺手点个 ⭐ **Star** 吧。

## 玩法

直接用浏览器打开 `index.html` 即可（无需构建、无需联网）。

- **按住屏幕画圈**：像甩真玩具一样，转得越快叫得越响（触屏时锚点会自动抬到指尖上方，避免手挡住小蝉）
- **自动甩**：不想动手就点它（空格键也行）
- **甩手机**（手机端，需 HTTPS 或本地文件）：握住手机划圈，重力方向在机身坐标里转动，直接驱动甩杆（iOS 首次需授权动作传感器；普通 http 局域网地址下浏览器不派发传感器事件，该按钮会自动隐藏）

### 局域网试玩

在项目目录起个静态服务，手机连同一 Wi-Fi 访问 `http://<电脑IP>:8123`：

```bash
python3 -m http.server 8123
```

## HarmonyOS 离线版

[`harmonyos/`](harmonyos/) 提供基于 ArkUI + ArkWeb 的 HarmonyOS 应用。网页、声音与 3D 资源均打包进 HAP，
无需联网即可运行；“甩手机”由原生 `SensorServiceKit` 采集加速度，再通过 JavaScript Proxy 驱动网页物理模型。

- 支持 phone、tablet 与 2in1，包含竖屏、横屏及沉浸式安全区适配
- 最低兼容 HarmonyOS 6.1.1（API 24），目标 API 26
- 不申请网络权限；加速度计权限为安装时系统授予

构建、签名和验证说明见 [`harmonyos/README.md`](harmonyos/README.md)。

## 真实玩具的发声原理

竹筒一端蒙竹膜，膜心系一根涂了**松香**的线，线的另一头拴在小竹签上。
甩起来转圈时，线在松香上"黏–滑"交替摩擦，脉冲沿线传到竹膜，
膜与筒腔共鸣放大——就是那声"哇——哇——"。

## 声音

主音源是**真实竹知了的录音采样**：从实拍视频里截取 1.72 秒（恰好 4 个"哇"周期、
包络边界自动搜索对齐），尾部 50ms 等功率交叉淡化烘进头部做成无缝循环，
以 AAC 内嵌在 HTML 里保持单文件。回放速率随甩动转速变化
（录音里的甩速约 2.33 圈/秒，甩得越快叫得越急越高），再叠每圈相位的音高微摆。

采样解码失败时回退到纯合成链：

| 真实玩具 | 合成兜底实现 |
|---|---|
| 松香黏滑摩擦产生脉冲 | 锯齿波振荡器，频率随转速升高（55~195 Hz），tanh 软削波增毛糙谐波 |
| 蝉鸣颗粒感 | 24~45 Hz 正弦低频调幅 + 带通摩擦噪声底 |
| 竹膜 + 筒腔共鸣 | 三个并联带通共振峰（1050 / 2150 / 3350 Hz） |
| 转圈带来的"哇——哇——" | 带通滤波器中心频率随转动相位扫频 |

## 物理

竹筒是绳系质点（重力 + 只拉不推的弹性绳 + 空气阻力，1/240s 定步长积分）。
发声核心变量是**绳方向的角速度**：竹筒绕甩杆转得越快、绳越紧，声音越响越亮；
角速度低于约 1.1 圈/秒或绳未张紧时不发声，松手后靠惯性余音渐歇。

## 技术

- 单文件 `index.html`：Canvas 2D 渲染 + Web Audio API，无任何依赖（含内嵌录音）
- SEO：head 里有 OG/Twitter 卡片与 JSON-LD（WebSite + WebApplication/VideoGame）；`<noscript>` 里有一段
  玩具介绍作为无 JS 环境（含不执行 JS 的百度蜘蛛）可读的静态正文，正常用户不可见；根目录 `robots.txt`、
  `sitemap.xml`、`og-image.jpg`（1200×630 页面实拍）、`404.html`（有了它 Cloudflare Pages 才会对未知路径
  返回真 404，否则任意路径都是 200 + 首页的 soft-404）
- 移动端优先：安全区适配、绳长随屏幕缩放、拇指小圈即可甩响（触摸时锚点自动上移避免手挡）、多点触控互斥、`devicemotion` 体感模式
- 音频在首次触摸/点击时初始化，触摸在抬手时补解锁（user activation 规则）；iOS 的 `interrupted` 状态与旧内核 `roundRect` 均有兜底
- 静态场景预合成为离屏层，静置 8 秒自动挂起音频线程省电

## 实时计数

页面底部有一行全站统计：**此刻在线 · 唯一来客 · 访问次数 · 全球哇数**，外加只存在浏览器
localStorage 里的**个人哇数**。手动甩出的每一圈记一"哇"，自动甩不计。

后端是 `worker/` 里的一个 Cloudflare Worker + 单实例 SQLite **Durable Object**：

- **实时推送**：所有在线玩家挂在同一个 DO 的 WebSocket（Hibernation API）上，任何人甩出哇，
  350ms 合并广播推给全场；挂机连接休眠零费用，心跳 ping/pong 由运行时自动应答不唤醒 DO
- **同步策略**：客户端本地先累计，1.2s 批量走 WS 上报；页面关闭用 `sendBeacon` 兜底补报；
  断线指数退避重连，重连不重复计访问
- **成本控制**：计数在内存自增、2 秒合并落盘（SQLite 行写入有限额）；免费套餐足够跑
- **防刷**：单连接哇数限速（10s 滑动窗口）、单条消息哇数上限、并发连接上限、
  按 IP 的连接/补报频控、单连接 hi 去重
- **路由**：`zhuzhiliao.imsai.cc/api/*` 走 zone route 进 Worker，其余流量走 Pages；
  唯一访客用 localStorage 里的随机 UUID 在 DO 的 SQLite 表去重

部署：`cd worker && npx wrangler deploy`（Pages 部署页面本体，Worker 承接 `/api/*`）。

## 点个 Star ⭐

竹知了是小时候路边摊上几块钱的玩意儿，会响、会烦人、会被大人没收，现在实物越来越难找了。
这个 Web 版想做的事很简单：让它继续能被随手甩响 —— 一个 HTML 文件，零依赖、零构建，
存下来断网也能玩，二十年后双击照样出声。

如果它甩响了你的某段回忆，或者你觉得这套「真实录音采样 + 绳系质点物理 + Durable Object
实时计数」塞进单文件的做法有点意思：

- 点个 [⭐ Star](https://github.com/imsai-sh/zhuzhiliao/stargazers) —— Star 多了才排得上 GitHub 的搜索和推荐
- 把 <https://zhuzhiliao.imsai.cc> 甩给一个也玩过竹知了的人，看他愣两秒
- 有 Bug、有想法、有更像真玩具的调参，欢迎提 Issue / PR

全球哇数正在页面底部实时跳动，你的每一圈都算数。
