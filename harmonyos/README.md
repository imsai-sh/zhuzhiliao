# 竹知了 for HarmonyOS

这是“竹知了”的 HarmonyOS 离线应用。应用使用 ArkUI 承载 ArkWeb，并从应用包内加载网页、声音与 3D 资源；
无需网络权限，断网也能完整游玩。

## 技术方案

- Stage 模型 ArkUI 应用，入口位于 `entry/src/main/ets/`
- ArkWeb 加载 `$rawfile('web/index.html')`，禁止在线图片、文件访问及外部 URL 导航
- `SensorServiceKit` 订阅原生加速度计，通过 `javaScriptProxy` 向网页提供体感数据
- 状态栏与导航栏透明，页面扩展至系统与刘海安全区
- phone、tablet、2in1 共用一套响应式页面

网页资源位于 `entry/src/main/resources/rawfile/web/`。这是面向离线应用的副本：移除了在线遥测和全站实时计数，
增加了应用内关于页、原生体感桥接、竖屏/横屏布局及无障碍状态。`3d/` 下的共享渲染资源与仓库根目录版本保持一致。
当前快照来源和同步规则见 [`WEB_SNAPSHOT.md`](WEB_SNAPSHOT.md)。

## 环境要求

- DevEco Studio，带 HarmonyOS SDK API 26
- 最低兼容 HarmonyOS 6.1.1（API 24）
- 首次打开工程时使用 DevEco Studio 自带的 OHPM/Hvigor 同步项目

## 构建与签名

在 DevEco Studio 中打开本目录，然后选择 **Build > Build Hap(s)/APP(s) > Build Hap(s)**。
也可以在已配置 `DEVECO_SDK_HOME` 且 `hvigorw` 位于 `PATH` 的终端执行：

```shell
hvigorw --mode module -p product=default assembleHap --no-daemon
```

调试 HAP 默认输出到 `entry/build/default/outputs/default/`。仓库不包含证书或签名配置；真机安装和发布前，
请在 DevEco Studio 中配置自己的签名，并且不要提交证书、密钥、`local.properties` 或构建产物。

## 权限与离线边界

应用仅声明 `ohos.permission.ACCELEROMETER`。这是普通的系统授予权限，不会弹出运行时授权框。
传感器只在用户开启“甩手机”时订阅，关闭体感、切换自动模式或页面退后台时停止。应用不声明
`ohos.permission.INTERNET`，ArkWeb 也会拦截 HTTP/HTTPS 导航。

## 验证

ArkTS/HAP 构建完成后，可安装到设备验证沉浸式安全区和原生传感器。网页层提供 Playwright 冒烟测试，
覆盖紧凑手机、竖屏手机、竖屏平板、横屏平板和桌面尺寸，并用原生桥模拟器验证体感启停：

```shell
python -m pip install playwright
python -m playwright install chromium
python -m http.server 8123 --directory entry/src/main/resources/rawfile/web
```

另开终端，在 `harmonyos/` 下运行：

```shell
python tools/web_smoke_test.py
```

测试输出写入已忽略的 `artifacts/web-responsive/`。如果使用系统 Chrome，可通过 `ZZL_CHROMIUM`
环境变量指定其可执行文件。

提交前还应在仓库根目录运行共享资源一致性检查：

```shell
python harmonyos/tools/sync_web_assets.py --check
```
