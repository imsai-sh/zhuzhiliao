# 竹知了

一转就"哇哇"叫的传统玩具，Web 模拟版。零依赖单文件，手机优先。

**在线试玩：<https://imsai.top>**

> [!TIP]
> **新开源项目：[Fish Pocket](https://github.com/imsai-sh/fish-pocket)**
>
> 让 DeepSeek Harness 运行在 iPhone 和 iPad 上，随时随地使用。欢迎 Star 关注、一起共建。
>
> 往期推荐：[DSH 1024Store](https://github.com/imsai-sh/dsh-1024store)——DeepSeek Harness 的开源插件市场，在线搜索、安装和排行 dsh 插件：<https://deepseek1024.com>。

> [!CAUTION]
> **本项目未授权任何人再分发或公开部署。**
>
> 官方站点只有 <https://imsai.top>，**其他任何域名上的部署都未经授权**。
>
> 已发现有人擅自修改本项目代码后公开部署，包括将页面中作者原创的手绘小蝉形象替换为
> 真实人物形象。此类衍生版本与本项目及作者没有任何关系，作者未参与、未授权、也不
> 认可；其内容以及由此产生的全部法律责任，由该版本的制作者和部署者自行承担。作者
> 保留就侵犯著作权及其他合法权益的行为追究责任的权利。
>
> 源码公开仅供学习交流，权利范围见 [LICENSE](LICENSE)。
>
> *This project is NOT open source. Redistribution and public deployment are not
> permitted. The only official site is <https://imsai.top> — any deployment
> on another domain is unauthorized and unaffiliated with this project or its author,
> who bears no responsibility for its content. See [LICENSE](LICENSE).*

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

## 哇数计数

页面底部只显示**你自己的哇数**：手动甩出的每一圈记一"哇"，自动甩不计。这个数存在你
浏览器的 localStorage 里，**不上传、不联网、没有后端**——页面加载完就再不发任何请求。

> 早先有过一套 Cloudflare Worker + Durable Object 的全站实时计数（在线人数、访问量、
> 全球哇数）。现已整体下线，后端代码也从仓库移除；想看实现可以翻 git 历史。

## 点个 Star ⭐

竹知了是小时候路边摊上几块钱的玩意儿，会响、会烦人、会被大人没收，现在实物越来越难找了。
这个 Web 版想做的事很简单：让它继续能被随手甩响 —— 一个 HTML 文件，零依赖、零构建，
存下来断网也能玩，二十年后双击照样出声。

如果它甩响了你的某段回忆，或者你觉得这套「真实录音采样 + 绳系质点物理」塞进单文件的
做法有点意思：

- 点个 [⭐ Star](https://github.com/imsai-sh/zhuzhiliao/stargazers) —— Star 多了才排得上 GitHub 的搜索和推荐
- 把 <https://imsai.top> 甩给一个也玩过竹知了的人，看他愣两秒
- 有 Bug、有想法、有更像真玩具的调参，欢迎提 Issue / PR

<a href="https://www.star-history.com/#imsai-sh/zhuzhiliao&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=imsai-sh/zhuzhiliao&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=imsai-sh/zhuzhiliao&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=imsai-sh/zhuzhiliao&type=Date" />
  </picture>
</a>

## 许可与声明

**本项目不是 OSI 意义上的开源项目。** 源码公开是为了技术分享，完整条款见 [LICENSE](LICENSE)：

- **允许**：阅读研究源码、在自己拥有或控制的设备上本地运行、为学习或个人使用而修改
- **不授权**：再分发（含修改版，无论是否收费）、部署到第三方可访问的位置、对外提供任何
  形式的服务、任何商业使用、移除或篡改版权声明
- **内容限制**：不得用本项目或其修改版制作、传播侵犯他人合法权益的内容，包括未经许可
  使用真实人物的姓名、肖像、声音或其他人格标识；违反者许可自动终止

官方站点只有 <https://imsai.top>，其他域名上的部署均未经授权，与本项目和作者
无关——详见[页首声明](#竹知了)。需要超出上述范围的授权，请先联系作者取得书面许可。

### 关于 Issue 与讨论区

**欢迎提交功能性的 Issue** —— Bug 反馈、浏览器兼容问题、物理或声音的调参建议、想让它
更像真玩具的想法、实现细节的讨论，都很欢迎，也是这个区域存在的意义。提之前带上复现
步骤和设备/浏览器信息会更容易被修掉。

本仓库 Issue、Pull Request、Discussion 等区域的内容，由各自的发布者提交并对其独立负责。
这些内容**不代表本项目作者的观点或立场**，作者未对其进行事先审查，也不对其真实性、
合法性承担责任。

与本项目技术无关的内容——尤其是针对他人或公众人物的评论、影射、人身攻击，以及其他
违法违规言论——将被删除或隐藏，必要时锁定议题并封禁相关账号。

*Functional issues are welcome: bug reports, browser compatibility problems, tuning
suggestions, and implementation questions. Issues, pull requests, and discussions are
submitted by their respective authors, who bear sole responsibility for their content;
such content does not represent the views of this project's author and is not reviewed
in advance. Off-topic content — in particular remarks targeting other individuals or
public figures — will be removed.*
