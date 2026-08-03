import { webview } from '@kit.ArkWeb';
import { sensor } from '@kit.SensorServiceKit';

/**
 * ArkWeb does not consistently dispatch DeviceMotionEvent on HarmonyOS.
 * This object is injected into the local page and lets JavaScript pull the
 * latest native accelerometer sample only while motion control is enabled.
 */
class HarmonyMotionBridge {
  private subscribed: boolean = false;
  private available: boolean = true;
  private x: number = 0;
  private y: number = 0;
  private z: number = 0;
  private timestamp: number = 0;

  private readonly accelerometerCallback = (data: sensor.AccelerometerResponse): void => {
    this.x = data.x;
    this.y = data.y;
    this.z = data.z;
    this.timestamp = data.timestamp;
  };

  start(): boolean {
    if (this.subscribed) {
      return true;
    }

    this.timestamp = 0;
    try {
      sensor.on(
        sensor.SensorId.ACCELEROMETER,
        this.accelerometerCallback,
        { interval: 'game' }
      );
      this.subscribed = true;
      this.available = true;
      return true;
    } catch (error) {
      this.subscribed = false;
      this.available = false;
      console.error(`Unable to start accelerometer: ${JSON.stringify(error)}`);
      return false;
    }
  }

  stop(): void {
    if (!this.subscribed) {
      return;
    }

    try {
      sensor.off(sensor.SensorId.ACCELEROMETER, this.accelerometerCallback);
    } catch (error) {
      console.error(`Unable to stop accelerometer: ${JSON.stringify(error)}`);
    } finally {
      this.subscribed = false;
      this.timestamp = 0;
    }
  }

  getSample(): string {
    return JSON.stringify({
      available: this.available,
      active: this.subscribed,
      x: this.x,
      y: this.y,
      z: this.z,
      timestamp: this.timestamp
    });
  }

  dispose(): void {
    this.stop();
  }
}

@Entry
@Component
struct Index {
  private controller: webview.WebviewController = new webview.WebviewController();
  private motionBridge: HarmonyMotionBridge = new HarmonyMotionBridge();
  @State private pageReady: boolean = false;

  aboutToDisappear(): void {
    this.motionBridge.dispose();
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Web({
        src: $rawfile('web/index.html'),
        controller: this.controller
      })
        .width('100%')
        .height('100%')
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(false)
        .onlineImageAccess(false)
        .zoomAccess(false)
        .javaScriptProxy({
          object: this.motionBridge,
          name: 'HarmonyMotion',
          methodList: ['start', 'stop', 'getSample'],
          controller: this.controller
        })
        .backgroundColor('#0A1028')
        .onPageBegin(() => {
          this.motionBridge.stop();
          this.pageReady = false;
        })
        .onPageEnd(() => {
          this.pageReady = true;
        })
        .onOverrideUrlLoading((request) => {
          const url: string = request.getRequestUrl();
          return url.startsWith('http://') || url.startsWith('https://');
        })

      if (!this.pageReady) {
        Column({ space: 12 }) {
          LoadingProgress()
            .width(32)
            .height(32)
            .color('#E2603F')
          Text('正在唤醒竹蝉…')
            .fontSize(14)
            .fontColor('#F0E6D2')
            .fontWeight(FontWeight.Medium)
            .letterSpacing(2)
        }
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .padding({ left: 24, right: 24, top: 20, bottom: 20 })
        .backgroundColor('#0A1028')
        .hitTestBehavior(HitTestMode.None)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#0A1028')
    .expandSafeArea(
      [SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END]
    )
  }
}
